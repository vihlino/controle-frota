/**
 * relatoriosRotas.js - Geracao e atestacao de relatorios.
 *
 * O FLUXO
 * -------
 *   Gerar -> AGUARDANDO_ATESTE -> responsavel confere -> Atestar -> ATESTADO
 *
 * ATESTE ENCAMINHADO (07/10, migracao 036)
 * ----------------------------------------
 * Quem gera responde se o relatorio precisa de ateste. Se nao precisa, ele
 * nasce GERADO. Se precisa, escolhe de 1 a 3 usuarios: cada um vira uma
 * linha PENDENTE em `atestacao`, recebe o aviso no sino e so eles atestam
 * aquele relatorio (ser escolhido ja e a autorizacao). Quando o ultimo
 * atesta, o relatorio passa a ATESTADO. Relatorios antigos
 * (ateste_designado = false) seguem a regra de antes.
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

// Usuarios que podem ser escolhidos para atestar: todos os ativos.
router.get("/atestantes", autenticar, exigePermissao("RELATORIOS_GERAR"), async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT u.id_usuario, s.nome, s.cargo_funcao AS cargo, st.nome AS setor
         FROM usuario u
         JOIN servidor s ON s.id_servidor = u.id_servidor
         LEFT JOIN setor st ON st.id_setor = s.id_setor
        WHERE u.status = TRUE AND s.status = TRUE
        ORDER BY s.nome`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
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
    if (req.query.status === "MEU_ATESTE") {
      valores.push(req.usuario.id_usuario);
      condicoes.push(`EXISTS (SELECT 1 FROM atestacao am
                               WHERE am.id_relatorio = r.id_relatorio
                                 AND am.id_usuario = $${valores.length}
                                 AND am.status = 'PENDENTE')`);
    } else if (req.query.status) {
      valores.push(req.query.status);
      condicoes.push(`r.status = $${valores.length}`);
    }
    // Periodo: pega o relatorio cuja GERACAO caiu na faixa. E assim que a
    // pessoa procura ("os relatorios de agosto"), e nao pelo periodo interno
    // do documento, que ela nem sempre lembra.
    if (req.query.dataDe) {
      valores.push(req.query.dataDe);
      condicoes.push(`r.data_geracao >= $${valores.length}::date`);
    }
    if (req.query.dataAte) {
      valores.push(req.query.dataAte);
      condicoes.push(`r.data_geracao < ($${valores.length}::date + 1)`);
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
    const pagVal = [...valores, req.usuario.id_usuario, porPagina, (pagina - 1) * porPagina];
    const pEu = pagVal.length - 2;

    const { rows } = await query(
      `SELECT r.id_relatorio, r.nome, r.tipo, r.modulo, r.periodo_inicio, r.periodo_fim,
              r.data_geracao, r.formato, r.status, r.hash_sha256,
              s.nome AS gerado_por_nome, s.cargo_funcao AS gerado_por_cargo,
              jsonb_array_length(COALESCE(r.snapshot -> 'linhas', '[]'::jsonb)) AS registros,
              r.ateste_designado,
              (SELECT COUNT(*) FROM atestacao ac WHERE ac.id_relatorio = r.id_relatorio)::int AS atestos_total,
              (SELECT COUNT(*) FROM atestacao ac WHERE ac.id_relatorio = r.id_relatorio
                  AND ac.status = 'ATESTADO')::int AS atestos_feitos,
              EXISTS (SELECT 1 FROM atestacao ae WHERE ae.id_relatorio = r.id_relatorio
                         AND ae.id_usuario = $${pEu} AND ae.status = 'PENDENTE') AS meu_ateste_pendente,
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
// Com ateste, nasce AGUARDANDO_ATESTE e ja encaminhado aos escolhidos; sem
// ateste, nasce GERADO.
router.post("/", autenticar, exigePermissao("RELATORIOS_GERAR"), async (req, res, next) => {
  const cliente = await pool.connect();
  try {
    const { tipo, periodo_inicio, periodo_fim } = req.body;
    const modelo = MODELOS[tipo];
    if (!modelo) return res.status(400).json({ erro: "Tipo de relatório inválido." });
    if (!periodo_inicio || !periodo_fim) {
      return res.status(400).json({ erro: "Informe o período inicial e final." });
    }
    if (periodo_fim < periodo_inicio) {
      return res.status(400).json({ erro: "A data final não pode ser anterior à inicial." });
    }

    if (typeof req.body.precisa_ateste !== "boolean") {
      return res.status(400).json({ erro: "Informe se o relatório precisa de ateste." });
    }
    const precisaAteste = req.body.precisa_ateste;
    const atestantes = precisaAteste
      ? (Array.isArray(req.body.atestantes) ? req.body.atestantes : []).map(Number)
      : [];
    if (precisaAteste) {
      if (atestantes.length < 1 || atestantes.length > 3 || atestantes.some((n) => !Number.isInteger(n) || n <= 0)) {
        return res.status(400).json({ erro: "Escolha de 1 a 3 pessoas para atestar." });
      }
      if (new Set(atestantes).size !== atestantes.length) {
        return res.status(400).json({ erro: "A mesma pessoa foi escolhida mais de uma vez para atestar." });
      }
      const validos = await query(
        `SELECT u.id_usuario FROM usuario u JOIN servidor s ON s.id_servidor = u.id_servidor
          WHERE u.id_usuario = ANY($1::bigint[]) AND u.status = TRUE AND s.status = TRUE`,
        [atestantes]
      );
      if (validos.rows.length !== atestantes.length) {
        return res.status(400).json({ erro: "Algum usuário escolhido para atestar não está ativo no sistema." });
      }
    }

    // A consulta do modelo roda isolada: se ela falhar (uma coluna renomeada
    // no banco, por exemplo), a mensagem diz QUAL relatorio quebrou, em vez de
    // um 500 seco que obriga a abrir o log do servidor para descobrir.
    let dados;
    try {
      dados = await query(modelo.sql, [periodo_inicio, periodo_fim]);
    } catch (e) {
      console.error(`[relatorio ${tipo}] falha na consulta:`, e.message);
      return res.status(500).json({
        erro: `Não foi possível montar o relatório "${modelo.nome}": ${e.message}`,
      });
    }

    const conteudo = {
      colunas: modelo.colunas,
      linhas: dados.rows,
      geradoEm: new Date().toISOString(),
      periodo: { inicio: periodo_inicio, fim: periodo_fim },
    };

    await cliente.query("BEGIN");
    const { rows } = await cliente.query(
      `INSERT INTO relatorio
         (nome, tipo, modulo, periodo_inicio, periodo_fim, gerado_por, formato,
          snapshot, hash_sha256, status, ateste_designado)
       VALUES ($1, $2, $3, $4, $5, $6, 'PDF', $7, $8, $9, $10)
       RETURNING id_relatorio, nome, tipo, status, data_geracao`,
      [
        modelo.nome, tipo, modelo.modulo, periodo_inicio, periodo_fim,
        req.usuario.id_usuario, JSON.stringify(conteudo), calcularHash(conteudo),
        precisaAteste ? "AGUARDANDO_ATESTE" : "GERADO", precisaAteste,
      ]
    );
    for (const [i, idUsuario] of atestantes.entries()) {
      await cliente.query(
        `INSERT INTO atestacao (id_relatorio, id_usuario, ordem, status)
         VALUES ($1, $2, $3, 'PENDENTE')`,
        [rows[0].id_relatorio, idUsuario, i + 1]
      );
    }
    await cliente.query("COMMIT");

    await registrarAuditoria({
      idUsuario: req.usuario.id_usuario,
      acao: "GERAR_RELATORIO",
      entidade: "relatorio",
      idRegistro: rows[0].id_relatorio,
      dadosNovos: {
        tipo, periodo_inicio, periodo_fim, registros: dados.rows.length,
        precisa_ateste: precisaAteste, atestantes,
      },
    });

    res.status(201).json({ ...rows[0], registros: dados.rows.length });
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    next(e);
  } finally {
    cliente.release();
  }
});

// Abre o relatorio salvo: devolve o snapshot, nao uma consulta nova. Um
// relatorio atestado precisa mostrar exatamente o que foi atestado.
// Quem foi escolhido para atestar abre o relatorio mesmo sem a permissao de
// ver relatorios: o encaminhamento ja e a autorizacao.
router.get("/:id", autenticar, async (req, res, next) => {
  try {
    if (!(req.usuario.permissoes || []).includes("RELATORIOS_VISUALIZAR")) {
      const escolhido = await query(
        "SELECT 1 FROM atestacao WHERE id_relatorio = $1 AND id_usuario = $2",
        [Number(req.params.id), req.usuario.id_usuario]
      );
      if (!escolhido.rows[0]) {
        return res.status(403).json({ erro: "Seu perfil não tem acesso a este relatório." });
      }
    }
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
    if (!relatorio) return res.status(404).json({ erro: "Relatório não encontrado." });

    const atestacoes = await query(
      `SELECT a.ordem, a.id_usuario, a.status, a.data_solicitacao, a.data_atestacao,
              a.observacao, s.nome, s.cargo_funcao AS cargo
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
router.post("/:id/atestar", autenticar,
  async (req, res, next) => {
    const cliente = await pool.connect();
    try {
      const idRelatorio = Number(req.params.id);
      await cliente.query("BEGIN");

      const relatorio = await cliente.query(
        "SELECT id_relatorio, status, ateste_designado FROM relatorio WHERE id_relatorio = $1 FOR UPDATE",
        [idRelatorio]
      );
      if (!relatorio.rows[0]) {
        await cliente.query("ROLLBACK");
        return res.status(404).json({ erro: "Relatório não encontrado." });
      }
      if (relatorio.rows[0].status === "CANCELADO") {
        await cliente.query("ROLLBACK");
        return res.status(409).json({ erro: "Relatório cancelado não pode ser atestado." });
      }

      // Relatorio com ateste encaminhado: so os escolhidos atestam, cada um
      // a sua linha. O ultimo a atestar fecha o relatorio como ATESTADO.
      if (relatorio.rows[0].ateste_designado) {
        const minha = await cliente.query(
          `SELECT id_atestacao, ordem, status FROM atestacao
            WHERE id_relatorio = $1 AND id_usuario = $2`,
          [idRelatorio, req.usuario.id_usuario]
        );
        if (!minha.rows[0]) {
          await cliente.query("ROLLBACK");
          return res.status(403).json({ erro: "Este relatório foi encaminhado para outras pessoas atestarem." });
        }
        if (minha.rows[0].status !== "PENDENTE") {
          await cliente.query("ROLLBACK");
          return res.status(409).json({ erro: "Você já atestou este relatório." });
        }
        await cliente.query(
          `UPDATE atestacao SET status = 'ATESTADO', data_atestacao = CURRENT_TIMESTAMP, observacao = $2
            WHERE id_atestacao = $1`,
          [minha.rows[0].id_atestacao, req.body.observacao || null]
        );
        const faltam = await cliente.query(
          "SELECT COUNT(*)::int AS n FROM atestacao WHERE id_relatorio = $1 AND status = 'PENDENTE'",
          [idRelatorio]
        );
        const novoStatus = faltam.rows[0].n === 0 ? "ATESTADO" : "AGUARDANDO_ATESTE";
        await cliente.query("UPDATE relatorio SET status = $2 WHERE id_relatorio = $1", [idRelatorio, novoStatus]);
        await cliente.query("COMMIT");
        await registrarAuditoria({
          idUsuario: req.usuario.id_usuario,
          acao: "ATESTAR_RELATORIO",
          entidade: "relatorio",
          idRegistro: idRelatorio,
          justificativa: req.body.observacao || null,
          dadosNovos: { status: novoStatus, ordem: minha.rows[0].ordem, faltam: faltam.rows[0].n },
        });
        return res.json({ ok: true, status: novoStatus });
      }

      // Relatorio gerado sem ateste.
      if (relatorio.rows[0].status === "GERADO") {
        await cliente.query("ROLLBACK");
        return res.status(409).json({ erro: "Este relatório foi gerado sem necessidade de ateste." });
      }

      // Relatorios antigos: a regra de antes, com a permissao de atestar.
      if (!(req.usuario.permissoes || []).includes("RELATORIOS_ATESTAR")) {
        await cliente.query("ROLLBACK");
        return res.status(403).json({ erro: "Seu perfil não tem permissão para atestar relatórios." });
      }

      // ATE TRES ATESTOS por relatorio.
      // Um so bastava para o documento valer, mas quem confere a frota queria
      // o aval de mais de uma pessoa no MESMO papel - o gestor, o fiscal e o
      // responsavel pelo setor, por exemplo. Tres e o limite: dali em diante
      // a lista de assinaturas vira ruido e nao acrescenta responsabilidade.
      const jaFeitos = await cliente.query(
        `SELECT COALESCE(MAX(ordem), 0) AS ultima,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE id_usuario = $2)::int AS meus
           FROM atestacao WHERE id_relatorio = $1`,
        [idRelatorio, req.usuario.id_usuario]
      );
      const { ultima, total, meus } = jaFeitos.rows[0];

      if (meus > 0) {
        await cliente.query("ROLLBACK");
        return res.status(409).json({ erro: "Você já atestou este relatório." });
      }
      if (total >= 3) {
        await cliente.query("ROLLBACK");
        return res.status(409).json({
          erro: "Este relatório já tem os três atestos permitidos.",
        });
      }

      const proxima = { rows: [{ ordem: Number(ultima) + 1 }] };

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
