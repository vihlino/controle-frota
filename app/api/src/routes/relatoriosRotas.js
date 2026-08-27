/**
 * relatoriosRotas.js - Geracao e atestacao de relatorios.
 *
 * O FLUXO
 * -------
 *   Gerar -> AGUARDANDO_ATESTE -> responsavel confere -> Atestar -> ATESTADO
 *
 * O QUE TORNA ISSO DIFERENTE DE UMA CONSULTA
 * ------------------------------------------
 * Ao gerar, o resultado e CONGELADO num snapshot JSON dentro da tabela e selado
 * com um hash. Quando o relatorio e aberto depois, ele mostra o snapshot, nao
 * uma consulta nova. Isso e essencial: um relatorio atestado precisa mostrar
 * exatamente o que foi atestado, mesmo que os dados tenham mudado depois.
 *
 * O hash e conferido a cada abertura e o resultado vai no campo "integro". Se
 * alguem alterar o snapshot direto no banco, a tela avisa.
 *
 * A atestacao grava quem atestou, cargo, data, hora e observacao na tabela
 * atestacao - nao e so um PDF baixado.
 */
import { Router } from "express";
import { query, pool } from "../db.js";
import { autenticar, exigePermissao } from "../auth.js";
import { registrarAuditoria } from "../auditoria.js";
import { MODELOS, calcularHash } from "../relatorios.js";

const router = Router();

// Catalogo dos tipos disponiveis - alimenta a tela "Gerar relatorio".
router.get("/tipos", autenticar, exigePermissao("RELATORIOS_VISUALIZAR"), (_req, res) => {
  res.json(
    Object.entries(MODELOS).map(([tipo, m]) => ({
      tipo, nome: m.nome, descricao: m.descricao, modulo: m.modulo,
      colunas: m.colunas.map((c) => c.rotulo),
    }))
  );
});

router.get("/", autenticar, exigePermissao("RELATORIOS_VISUALIZAR"), async (req, res, next) => {
  try {
    const pagina = Math.max(1, Number(req.query.pagina) || 1);
    const porPagina = Math.min(100, Math.max(5, Number(req.query.porPagina) || 10));

    const condicoes = [];
    const valores = [];
    if (req.query.tipo) {
      valores.push(req.query.tipo);
      condicoes.push(`r.tipo = $${valores.length}`);
    }
    if (req.query.status) {
      valores.push(req.query.status);
      condicoes.push(`r.status = $${valores.length}`);
    }
    if (req.query.busca) {
      valores.push(`%${String(req.query.busca).trim()}%`);
      condicoes.push(`(r.nome ILIKE $${valores.length} OR r.tipo ILIKE $${valores.length})`);
    }
    const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";

    const FROM = `relatorio r
                  JOIN usuario u ON u.id_usuario = r.gerado_por
                  JOIN servidor s ON s.id_servidor = u.id_servidor`;

    const total = await query(`SELECT COUNT(*)::int AS total FROM ${FROM} ${where}`, valores);
    const pagVal = [...valores, porPagina, (pagina - 1) * porPagina];

    const { rows } = await query(
      `SELECT r.id_relatorio, r.nome, r.tipo, r.modulo, r.periodo_inicio, r.periodo_fim,
              r.data_geracao, r.formato, r.status, r.hash_sha256,
              s.nome AS gerado_por_nome, s.cargo_funcao AS gerado_por_cargo,
              jsonb_array_length(COALESCE(r.snapshot -> 'linhas', '[]'::jsonb)) AS registros,
              (SELECT jsonb_build_object(
                        'nome', sa.nome, 'cargo', sa.cargo_funcao,
                        'data', a.data_atestacao, 'observacao', a.observacao)
                 FROM atestacao a
                 JOIN usuario ua ON ua.id_usuario = a.id_usuario
                 JOIN servidor sa ON sa.id_servidor = ua.id_servidor
                WHERE a.id_relatorio = r.id_relatorio AND a.status = 'ATESTADO'
                ORDER BY a.data_atestacao DESC LIMIT 1) AS atestado_por
         FROM ${FROM} ${where}
        ORDER BY r.data_geracao DESC
        LIMIT $${pagVal.length - 1} OFFSET $${pagVal.length}`,
      pagVal
    );

    res.json({
      itens: rows,
      total: total.rows[0].total,
      pagina,
      porPagina,
      paginas: Math.max(1, Math.ceil(total.rows[0].total / porPagina)),
    });
  } catch (e) {
    next(e);
  }
});

// Gera o relatorio: roda o modelo, guarda o snapshot do conteudo e sela com hash.
// O relatorio nasce AGUARDANDO_ATESTE.
router.post("/", autenticar, exigePermissao("RELATORIOS_GERAR"), async (req, res, next) => {
  try {
    const { tipo, periodo_inicio, periodo_fim } = req.body;
    const modelo = MODELOS[tipo];
    if (!modelo) return res.status(400).json({ erro: "Tipo de relatorio invalido." });
    if (!periodo_inicio || !periodo_fim) {
      return res.status(400).json({ erro: "Informe o periodo inicial e final." });
    }
    if (periodo_fim < periodo_inicio) {
      return res.status(400).json({ erro: "A data final nao pode ser anterior a inicial." });
    }

    const dados = await query(modelo.sql, [periodo_inicio, periodo_fim]);

    const conteudo = {
      colunas: modelo.colunas,
      linhas: dados.rows,
      geradoEm: new Date().toISOString(),
      periodo: { inicio: periodo_inicio, fim: periodo_fim },
    };

    const { rows } = await query(
      `INSERT INTO relatorio
         (nome, tipo, modulo, periodo_inicio, periodo_fim, gerado_por, formato,
          snapshot, hash_sha256, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'PDF', $7, $8, 'AGUARDANDO_ATESTE')
       RETURNING id_relatorio, nome, tipo, status, data_geracao`,
      [
        modelo.nome, tipo, modelo.modulo, periodo_inicio, periodo_fim,
        req.usuario.id_usuario, JSON.stringify(conteudo), calcularHash(conteudo),
      ]
    );

    await registrarAuditoria({
      idUsuario: req.usuario.id_usuario,
      acao: "GERAR_RELATORIO",
      entidade: "relatorio",
      idRegistro: rows[0].id_relatorio,
      dadosNovos: { tipo, periodo_inicio, periodo_fim, registros: dados.rows.length },
    });

    res.status(201).json({ ...rows[0], registros: dados.rows.length });
  } catch (e) {
    next(e);
  }
});

// Abre o relatorio salvo: devolve o snapshot, nao uma consulta nova. Um
// relatorio atestado precisa mostrar exatamente o que foi atestado.
router.get("/:id", autenticar, exigePermissao("RELATORIOS_VISUALIZAR"), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT r.*, s.nome AS gerado_por_nome, s.cargo_funcao AS gerado_por_cargo,
              st.nome AS gerado_por_setor
         FROM relatorio r
         JOIN usuario u  ON u.id_usuario  = r.gerado_por
         JOIN servidor s ON s.id_servidor = u.id_servidor
         JOIN setor st   ON st.id_setor   = s.id_setor
        WHERE r.id_relatorio = $1`,
      [Number(req.params.id)]
    );
    const relatorio = rows[0];
    if (!relatorio) return res.status(404).json({ erro: "Relatorio nao encontrado" });

    const atestacoes = await query(
      `SELECT a.ordem, a.status, a.data_solicitacao, a.data_atestacao, a.observacao,
              s.nome, s.cargo_funcao AS cargo
         FROM atestacao a
         JOIN usuario u  ON u.id_usuario  = a.id_usuario
         JOIN servidor s ON s.id_servidor = u.id_servidor
        WHERE a.id_relatorio = $1
        ORDER BY a.ordem`,
      [relatorio.id_relatorio]
    );

    // Confere se o conteudo continua igual ao que foi selado na geracao.
    const integro = relatorio.snapshot
      ? calcularHash(relatorio.snapshot) === relatorio.hash_sha256
      : null;

    res.json({ ...relatorio, atestacoes: atestacoes.rows, integro });
  } catch (e) {
    next(e);
  }
});

// Atesta o relatorio. Registra quem atestou, cargo, data e hora dentro do
// sistema - nao e so um PDF baixado.
router.post("/:id/atestar", autenticar, exigePermissao("RELATORIOS_ATESTAR"),
  async (req, res, next) => {
    const cliente = await pool.connect();
    try {
      const idRelatorio = Number(req.params.id);
      await cliente.query("BEGIN");

      const relatorio = await cliente.query(
        "SELECT id_relatorio, status FROM relatorio WHERE id_relatorio = $1 FOR UPDATE",
        [idRelatorio]
      );
      if (!relatorio.rows[0]) {
        await cliente.query("ROLLBACK");
        return res.status(404).json({ erro: "Relatorio nao encontrado" });
      }
      if (relatorio.rows[0].status === "ATESTADO") {
        await cliente.query("ROLLBACK");
        return res.status(409).json({ erro: "Este relatorio ja foi atestado." });
      }
      if (relatorio.rows[0].status === "CANCELADO") {
        await cliente.query("ROLLBACK");
        return res.status(409).json({ erro: "Relatorio cancelado nao pode ser atestado." });
      }

      const proxima = await cliente.query(
        "SELECT COALESCE(MAX(ordem), 0) + 1 AS ordem FROM atestacao WHERE id_relatorio = $1",
        [idRelatorio]
      );

      await cliente.query(
        `INSERT INTO atestacao
           (id_relatorio, id_usuario, ordem, status, data_atestacao, observacao)
         VALUES ($1, $2, $3, 'ATESTADO', CURRENT_TIMESTAMP, $4)`,
        [idRelatorio, req.usuario.id_usuario, proxima.rows[0].ordem, req.body.observacao || null]
      );

      await cliente.query(
        "UPDATE relatorio SET status = 'ATESTADO' WHERE id_relatorio = $1",
        [idRelatorio]
      );

      await cliente.query("COMMIT");

      await registrarAuditoria({
        idUsuario: req.usuario.id_usuario,
        acao: "ATESTAR_RELATORIO",
        entidade: "relatorio",
        idRegistro: idRelatorio,
        justificativa: req.body.observacao || null,
        dadosNovos: { status: "ATESTADO" },
      });

      res.json({ ok: true });
    } catch (e) {
      await cliente.query("ROLLBACK").catch(() => {});
      next(e);
    } finally {
      cliente.release();
    }
  }
);

export default router;
