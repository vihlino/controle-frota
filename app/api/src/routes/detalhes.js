/**
 * detalhes.js - Consultas das telas de detalhe.
 *
 * Sao consultas que nao cabem no padrao da fabrica crud.js, porque juntam
 * varias tabelas ou montam formatos proprios.
 *
 *   /api/frotas/inspecoes/:id/itens      itens verificados de uma inspecao
 *   /api/frotas/veiculos/:id/historico   linha do tempo do veiculo, com
 *                                        checklists, inspecoes, OS e sinistros
 *                                        reunidos num UNION
 *   /api/frotas/veiculos/:id/resumo      contagens para os cartoes do topo
 */
import { Router, json } from "express";
import { pool, query } from "../db.js";
import { registrarAuditoria } from "../auditoria.js";
import { autenticar, exigePermissao } from "../auth.js";

const router = Router();
const verFrotas = exigePermissao("FROTAS_VISUALIZAR");
/*
 * Detalhes do veiculo: Frotas, ou a Fiscalizacao quando o veiculo e uma
 * VIATURA (tela de Viaturas, 18/10).
 */
async function verVeiculo(req, res, next) {
  const p = req.usuario?.permissoes || [];
  if (p.includes("FROTAS_VISUALIZAR")) return next();
  if (!p.includes("FISCALIZACAO_VISUALIZAR")) return res.status(403).json({ erro: "Sem permissão para esta ação." });
  try {
    const { rows } = await query("SELECT viatura FROM veiculo WHERE id_veiculo = $1", [Number(req.params.id)]);
    if (!rows[0]?.viatura) return res.status(404).json({ erro: "Viatura não encontrada." });
    next();
  } catch (e) {
    next(e);
  }
}
// Ficha de motorista/servidor: Frotas (Motoristas) e Administracao (Servidores).
const verPessoas = exigePermissao("FROTAS_VISUALIZAR", "ADMIN_VISUALIZAR");

/*
 * Usuarios ativos para os campos "Responsavel" (ex.: agendar inspecao). A
 * lista de usuarios da Administracao exige ADMIN_VISUALIZAR, e o Gestor de
 * Frotas ficava com o campo vazio e sem conseguir agendar (09/10).
 */
router.get("/responsaveis", autenticar,
  exigePermissao("FROTAS_VISUALIZAR", "FISCALIZACAO_VISUALIZAR", "ADMIN_VISUALIZAR"),
  async (_req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT u.id_usuario, s.nome, s.cargo_funcao AS cargo
           FROM usuario u JOIN servidor s ON s.id_servidor = u.id_servidor
          WHERE u.status = TRUE AND s.status = TRUE
          ORDER BY s.nome`
      );
      res.json(rows);
    } catch (e) {
      next(e);
    }
  });

// Itens verificados de uma inspecao, na ordem em que foram registrados.
router.get("/inspecoes/:id/itens", autenticar, verFrotas, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id_inspecao_item, item, grupo, resultado, observacao
         FROM inspecao_item
        WHERE id_inspecao = $1
        ORDER BY id_inspecao_item`,
      [Number(req.params.id)]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Historico completo de um veiculo: checklists, inspecoes, OS e sinistros
// reunidos numa linha do tempo unica.
router.get("/veiculos/:id/historico", autenticar, verVeiculo, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await query(
      `SELECT * FROM (
         SELECT 'CHECKLIST' AS origem, c.id_checklist AS id_registro,
                c.data_abertura AS data, c.status,
                COALESCE(c.percurso, 'Checklist do veiculo') AS titulo,
                s.nome AS pessoa
           FROM checklist_frotas c
           JOIN servidor s ON s.id_servidor = c.id_servidor
          WHERE c.id_veiculo = $1

         UNION ALL
         SELECT 'INSPECAO', i.id_inspecao, i.data_realizacao, i.status,
                COALESCE(i.numero, 'Inspecao ' || i.tipo), s.nome
           FROM inspecao i
           JOIN usuario u  ON u.id_usuario  = i.id_gestor
           JOIN servidor s ON s.id_servidor = u.id_servidor
          WHERE i.id_veiculo = $1

         UNION ALL
         SELECT 'MANUTENCAO', os.id_os, os.data_abertura::date, os.status,
                COALESCE(os.descricao, os.servico_realizado, 'Ordem de servico'), s.nome
           FROM ordem_servico os
           JOIN usuario u  ON u.id_usuario  = os.id_solicitante
           JOIN servidor s ON s.id_servidor = u.id_servidor
          WHERE os.id_veiculo = $1

         UNION ALL
         SELECT 'SINISTRO', si.id_sinistro, si.data, si.status,
                COALESCE(si.numero, 'Sinistro') || ' - ' || si.local, s.nome
           FROM sinistro si
           JOIN servidor s ON s.id_servidor = si.id_servidor
          WHERE si.id_veiculo = $1
       ) linha
       ORDER BY data DESC
       LIMIT 60`,
      [id]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Resumo do veiculo para a tela de detalhes: contagens de cada modulo.
router.get("/veiculos/:id/resumo", autenticar, verVeiculo, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await query(
      `SELECT
         (SELECT COUNT(*)::int FROM checklist_frotas WHERE id_veiculo = $1) AS checklists,
         (SELECT COUNT(*)::int FROM inspecao WHERE id_veiculo = $1) AS inspecoes,
         (SELECT COUNT(*)::int FROM ordem_servico
           WHERE id_veiculo = $1 AND status NOT IN ('RESOLVIDA','CANCELADA')) AS os_abertas,
         (SELECT COUNT(*)::int FROM sinistro WHERE id_veiculo = $1) AS sinistros,
         (SELECT COUNT(*)::int FROM documento_veiculo
           WHERE id_veiculo = $1 AND substituido_em IS NULL) AS documentos,
         -- Pela DATA, nao pela coluna status: ela e escrita por gatilho e
         -- congela no dia do cadastro, entao documento que venceu depois disso
         -- continuava contado como valido na Ficha do Veiculo.
         (SELECT COUNT(*)::int FROM documento_veiculo
           WHERE id_veiculo = $1 AND status <> 'INATIVO'
             AND data_validade IS NOT NULL
             AND data_validade < CURRENT_DATE) AS documentos_vencidos,
         (SELECT COALESCE(SUM(custo), 0) FROM ordem_servico WHERE id_veiculo = $1) AS custo_manutencao,
         -- 29/10: "Custo manutencao (12 meses)" e "Proxima manutencao" do desenho.
         (SELECT COALESCE(SUM(custo), 0) FROM ordem_servico
           WHERE id_veiculo = $1 AND COALESCE(data_fechamento, data_abertura::date) >= CURRENT_DATE - INTERVAL '12 months') AS custo_manutencao_12m,
         (SELECT MIN(proxima_manutencao) FROM ordem_servico
           WHERE id_veiculo = $1 AND proxima_manutencao >= CURRENT_DATE) AS proxima_manutencao,
         -- Cartao "Status e controle" da ficha do veiculo.
         (SELECT MAX(data_abertura + COALESCE(hora_saida, '00:00'::time))
            FROM checklist_frotas WHERE id_veiculo = $1) AS ultimo_checklist,
         (SELECT s.nome FROM checklist_frotas c JOIN servidor s ON s.id_servidor = c.id_servidor
           WHERE c.id_veiculo = $1 AND c.status = 'ABERTO'
           ORDER BY c.data_abertura DESC, c.hora_saida DESC LIMIT 1) AS condutor_atual,
         -- Ultima manutencao = a ultima OS FECHADA (servico feito), nunca data futura.
         (SELECT MAX(data_fechamento) FROM ordem_servico
           WHERE id_veiculo = $1 AND status = 'RESOLVIDA' AND data_fechamento <= CURRENT_DATE) AS ultima_manutencao,
         (SELECT CURRENT_DATE - MAX(data_fechamento) FROM ordem_servico
           WHERE id_veiculo = $1 AND status = 'RESOLVIDA' AND data_fechamento <= CURRENT_DATE) AS dias_desde_manutencao,
         (SELECT MAX(data_realizacao) FROM inspecao
           WHERE id_veiculo = $1 AND status = 'FINALIZADA') AS ultima_inspecao,
         -- Proxima inspecao: a agendada que ainda nao foi feita; sem agendamento,
         -- a data sugerida pela ultima inspecao feita.
         COALESCE(
           (SELECT MIN(data_programada) FROM inspecao
             WHERE id_veiculo = $1 AND status = 'ABERTA' AND data_programada IS NOT NULL),
           (SELECT proxima_inspecao FROM inspecao
             WHERE id_veiculo = $1 AND status = 'FINALIZADA' AND proxima_inspecao IS NOT NULL
             ORDER BY data_realizacao DESC LIMIT 1)
         ) AS proxima_inspecao`,
      [id]
    );
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

/*
 * Historico de um registro, tirado da AUDITORIA: quem fez o que e quando.
 * E o rastro de verdade (criacao, edicoes com justificativa, fechamento,
 * anexos), e nao uma linha do tempo deduzida das datas.
 *
 *   /api/frotas/historico/os/:id          OS (ordem_servico)
 *   /api/frotas/historico/sinistro/:id    sinistro + fotos/documentos dele
 *   /api/frotas/historico/documento/:id   documento + arquivos + renovacao
 */
const FILTRO_HISTORICO = {
  // Cadastro do servidor e o acesso dele ao sistema (usuario).
  servidor: `((a.entidade = 'servidor' AND a.id_registro = $1)
              OR (a.entidade = 'usuario'
                  AND a.id_registro IN (SELECT id_usuario FROM usuario WHERE id_servidor = $1)))`,
  os: "(a.entidade = 'ordem_servico' AND a.id_registro = $1)",
  // 29/10: a correcao dos itens (sub-abas do checklist) entra no historico.
  checklist: "(a.entidade IN ('checklist', 'checklist_equipamento') AND a.id_registro = $1)",
  sinistro: `((a.entidade IN ('sinistro', 'sinistro_envolvido') AND a.id_registro = $1)
              OR (a.entidade = 'sinistro_arquivo'
                  AND COALESCE(a.dados_novos->>'id_sinistro', a.dados_anteriores->>'id_sinistro') = $1::text))`,
  documento: `((a.entidade = 'documento' AND a.id_registro = $1)
               OR (a.entidade = 'documento' AND a.acao = 'ATUALIZAR_DOCUMENTO'
                   AND a.dados_novos->>'id_documento_anterior' = $1::text)
               OR (a.entidade = 'documento_arquivo'
                   AND COALESCE(a.dados_novos->>'id_documento', a.dados_anteriores->>'id_documento') = $1::text))`,
};

router.get("/historico/:tipo/:id", autenticar,
  exigePermissao("FROTAS_VISUALIZAR", "ADMIN_VISUALIZAR", "FISCALIZACAO_VISUALIZAR"),
  async (req, res, next) => {
  try {
    const filtro = FILTRO_HISTORICO[req.params.tipo];
    if (!filtro) return res.status(404).json({ erro: "Histórico não encontrado." });
    // Quem so tem a Fiscalizacao: so o historico das OS de viaturas (09/10).
    const p = req.usuario?.permissoes || [];
    if (!p.includes("FROTAS_VISUALIZAR") && !p.includes("ADMIN_VISUALIZAR")) {
      if (req.params.tipo !== "os") return res.status(403).json({ erro: "Sem permissão para esta ação." });
      const v = await query(
        `SELECT ve.viatura FROM ordem_servico o JOIN veiculo ve ON ve.id_veiculo = o.id_veiculo
          WHERE o.id_os = $1`, [Number(req.params.id)]);
      if (!v.rows[0]?.viatura) return res.status(403).json({ erro: "Sem permissão para esta ação." });
    }
    const { rows } = await query(
      `SELECT a.id_auditoria, a.data_hora, a.acao, a.entidade, a.id_registro, a.justificativa,
              COALESCE(s.nome, u.login) AS usuario,
              COALESCE(a.dados_novos->>'nome', a.dados_anteriores->>'nome') AS arquivo,
              a.dados_novos->>'id_documento_anterior' AS id_documento_anterior,
              -- 29/10: o antes e o depois, para o Historico do Documento dizer
              -- o que mudou ("data de validade de X para Y"). So no documento:
              -- nos outros a tela nao usa e o JSON pode ser grande.
              ${req.params.tipo === "documento" ? "a.dados_anteriores, a.dados_novos" : "NULL AS dados_anteriores, NULL AS dados_novos"}
         FROM auditoria a
         LEFT JOIN usuario u ON u.id_usuario = a.id_usuario
         LEFT JOIN servidor s ON s.id_servidor = u.id_servidor
        WHERE ${filtro}
        ORDER BY a.data_hora DESC, a.id_auditoria DESC
        LIMIT 100`,
      [Number(req.params.id)]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

/*
 * Ficha do motorista / servidor (08/10).
 *
 * Os dados do cadastro, o acesso ao sistema (usuario e perfil), o resumo dos
 * ultimos 6 meses e o "Historico de atividades": checklists que ele fez, OS
 * que pediu, sinistros em que era o condutor e as alteracoes do cadastro,
 * tudo numa linha do tempo so.
 *
 * As listas completas de checklists, OS e sinistros vem das rotas de cada
 * modulo com o filtro ?servidor=ID.
 */
/**
 * CNHs anteriores da pessoa (migracao 049), da mais recente para a mais
 * antiga. Quem fez a alteracao vem da auditoria do cadastro gravada no mesmo
 * minuto. Usada tambem pela ficha do Fiscal.
 */
export async function historicoCnh(idServidor) {
  const { rows } = await query(
    `SELECT h.id_historico, h.cnh, h.categoria_cnh, h.cnh_data_emissao, h.cnh_data_validade,
            h.substituida_em, h.motivo,
            (SELECT COALESCE(sa.nome, ua.login)
               FROM auditoria a
               LEFT JOIN usuario ua ON ua.id_usuario = a.id_usuario
               LEFT JOIN servidor sa ON sa.id_servidor = ua.id_servidor
              WHERE a.entidade = 'servidor' AND a.id_registro = h.id_servidor
                AND a.data_hora BETWEEN h.substituida_em - INTERVAL '1 minute'
                                    AND h.substituida_em + INTERVAL '1 minute'
              ORDER BY abs(extract(epoch FROM a.data_hora - h.substituida_em))
              LIMIT 1) AS alterado_por
       FROM servidor_cnh_historico h
      WHERE h.id_servidor = $1
      ORDER BY h.substituida_em DESC`,
    [idServidor]
  ).catch(() => ({ rows: [] })); // banco sem a 049 ainda: ficha sem historico
  return rows;
}

/*
 * "Atualizar CNH" (26/10): troca so os dados da CNH, pela aba CNH dos
 * Detalhes do Motorista/Servidor/Fiscal. O gatilho da migracao 049 guarda a
 * CNH antiga; aqui o motivo e gravado nessa linha (migracao 051) e a
 * alteracao vai para a auditoria (de onde sai o "por quem" do historico).
 */
const CATEGORIAS_CNH = ["A", "B", "AB", "C", "D", "E", "AC", "AD", "AE"];
const MOTIVOS_CNH = ["Renovação", "Mudança de categoria", "Segunda via", "Correção de dados"];
router.put("/servidores/:id/cnh", autenticar,
  exigePermissao("FROTAS_GERENCIAR_SERVIDORES", "ADMIN_GERENCIAR_SERVIDORES", "FISCALIZACAO_GERENCIAR_FISCAIS"),
  async (req, res, next) => {
    const id = Number(req.params.id);
    const b = req.body || {};
    const cnh = String(b.cnh || "").replace(/\D/g, "");
    const categoria = String(b.categoria_cnh || "").toUpperCase();
    const emissao = String(b.cnh_data_emissao || "").slice(0, 10);
    const validade = String(b.cnh_data_validade || "").slice(0, 10);
    const motivo = MOTIVOS_CNH.includes(b.motivo) ? b.motivo : null;
    // Desenho de 29/10: orgao emissor, UF, RENACH e observacoes (opcionais).
    const texto = (v, max) => (String(v ?? "").trim().slice(0, max) || null);
    const orgao = texto(b.cnh_orgao_emissor, 60);
    const uf = texto(b.cnh_uf, 2)?.toUpperCase() || null;
    const renach = texto(b.cnh_renach, 20);
    const observacoes = texto(b.cnh_observacoes, 2000);
    if (uf && !/^[A-Z]{2}$/.test(uf)) return res.status(400).json({ erro: "UF inválida." });
    const dataOk = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(new Date(d));
    if (cnh.length < 9 || cnh.length > 15) return res.status(400).json({ erro: "Informe o número da CNH (só números)." });
    if (!CATEGORIAS_CNH.includes(categoria)) return res.status(400).json({ erro: "Escolha a categoria da CNH." });
    if (!dataOk(emissao) || !dataOk(validade)) return res.status(400).json({ erro: "Informe as datas de emissão e de validade." });
    if (validade <= emissao) return res.status(400).json({ erro: "A validade precisa ser depois da emissão." });
    if (!motivo) return res.status(400).json({ erro: "Escolha o motivo da atualização." });
    const cliente = await pool.connect();
    let anterior = null;
    try {
      await cliente.query("BEGIN");
      const antes = await cliente.query(
        `SELECT cnh, categoria_cnh, cnh_data_emissao, cnh_data_validade, condutor,
                cnh_orgao_emissor, cnh_uf, cnh_renach, cnh_observacoes
           FROM servidor WHERE id_servidor = $1 FOR UPDATE`, [id]);
      if (!antes.rows[0]) {
        await cliente.query("ROLLBACK");
        cliente.release();
        return res.status(404).json({ erro: "Servidor não encontrado." });
      }
      anterior = antes.rows[0];
      await cliente.query(
        `UPDATE servidor SET cnh = $2, categoria_cnh = $3, cnh_data_emissao = $4,
                cnh_data_validade = $5, condutor = TRUE,
                cnh_orgao_emissor = $6, cnh_uf = $7, cnh_renach = $8, cnh_observacoes = $9
          WHERE id_servidor = $1`,
        [id, cnh, categoria, emissao, validade, orgao, uf, renach, observacoes]);
      // A linha que o gatilho acabou de criar (se a CNH mudou de verdade).
      await cliente.query(
        `UPDATE servidor_cnh_historico SET motivo = $2
          WHERE id_historico = (SELECT max(id_historico) FROM servidor_cnh_historico
                                 WHERE id_servidor = $1 AND motivo IS NULL
                                   AND substituida_em >= now() - INTERVAL '1 minute')`,
        [id, motivo]);
      await cliente.query("COMMIT");
    } catch (e) {
      await cliente.query("ROLLBACK").catch(() => {});
      cliente.release();
      return next(e);
    }
    cliente.release();
    try {
      await registrarAuditoria({
        idUsuario: req.usuario.id_usuario, acao: "ALTERAR", entidade: "servidor", idRegistro: id,
        justificativa: `Atualizar CNH - ${motivo}`,
        dadosAnteriores: anterior,
        dadosNovos: {
          cnh, categoria_cnh: categoria, cnh_data_emissao: emissao, cnh_data_validade: validade,
          cnh_orgao_emissor: orgao, cnh_uf: uf, cnh_renach: renach, cnh_observacoes: observacoes,
        },
      });
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

/*
 * Arquivo da CNH (migracao 052, desenho de 29/10): a foto ou o PDF da
 * carteira. Enviar de novo guarda mais um; a tela mostra o ultimo.
 */
const TIPOS_ARQUIVO_CNH = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_ARQUIVO_CNH = 10 * 1024 * 1024;
const corpoArquivoCnh = json({ limit: "15mb" });
const verCnh = exigePermissao("FROTAS_VISUALIZAR", "ADMIN_VISUALIZAR", "FISCALIZACAO_VISUALIZAR");
const gerenciarCnh = exigePermissao("FROTAS_GERENCIAR_SERVIDORES", "ADMIN_GERENCIAR_SERVIDORES", "FISCALIZACAO_GERENCIAR_FISCAIS");

/** Arquivos da CNH da pessoa (sem o conteudo), do mais novo para o mais antigo. */
export async function arquivosCnh(idServidor) {
  const { rows } = await query(
    `SELECT a.id_arquivo, a.nome, a.tipo, a.bytes, a.criado_em,
            (SELECT s.nome FROM usuario u JOIN servidor s ON s.id_servidor = u.id_servidor
              WHERE u.id_usuario = a.enviado_por) AS enviado_por_nome
       FROM servidor_cnh_arquivo a WHERE a.id_servidor = $1 ORDER BY a.id_arquivo DESC`,
    [idServidor]
  ).catch(() => ({ rows: [] })); // banco sem a 052 ainda
  return rows;
}

router.get("/servidores/:id/cnh/arquivos", autenticar, verCnh, async (req, res, next) => {
  try {
    res.json(await arquivosCnh(Number(req.params.id)));
  } catch (e) {
    next(e);
  }
});

router.get("/servidores/:id/cnh/arquivos/:idArquivo", autenticar, verCnh, async (req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT nome, tipo, conteudo FROM servidor_cnh_arquivo WHERE id_arquivo = $1 AND id_servidor = $2",
      [Number(req.params.idArquivo), Number(req.params.id)]
    );
    if (!rows[0]) return res.status(404).json({ erro: "Arquivo não encontrado." });
    res.setHeader("Content-Type", rows[0].tipo);
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(rows[0].nome)}`);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(rows[0].conteudo);
  } catch (e) {
    next(e);
  }
});

router.post("/servidores/:id/cnh/arquivos", corpoArquivoCnh, autenticar, gerenciarCnh, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const nome = String(req.body?.nome || "").trim().slice(0, 255) || "cnh";
    const m = /^data:([a-z/+.-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(String(req.body?.dataUrl || "").trim());
    if (!m) return res.status(400).json({ erro: "Arquivo inválido." });
    const tipo = m[1].toLowerCase();
    if (!TIPOS_ARQUIVO_CNH.includes(tipo)) return res.status(400).json({ erro: "Envie a CNH em PDF, JPG ou PNG." });
    const buffer = Buffer.from(m[2], "base64");
    if (!buffer.length || buffer.length > MAX_ARQUIVO_CNH) return res.status(400).json({ erro: "O arquivo precisa ter até 10 MB." });
    const { rows: existe } = await query("SELECT 1 FROM servidor WHERE id_servidor = $1", [id]);
    if (!existe[0]) return res.status(404).json({ erro: "Servidor não encontrado." });
    const { rows } = await query(
      `INSERT INTO servidor_cnh_arquivo (id_servidor, nome, tipo, bytes, conteudo, enviado_por)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_arquivo, nome, tipo, bytes, criado_em`,
      [id, nome, tipo, buffer.length, buffer, req.usuario.id_usuario]
    );
    await registrarAuditoria({
      idUsuario: req.usuario.id_usuario, acao: "ALTERAR", entidade: "servidor", idRegistro: id,
      justificativa: "Arquivo da CNH anexado", dadosNovos: { arquivo_cnh: nome, tipo, bytes: buffer.length },
    });
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.get("/servidores/:id/ficha", autenticar, verPessoas, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const s = await query(
      `SELECT s.*, st.nome AS setor, c.nome AS cargo,
              (s.cnh_data_validade - CURRENT_DATE) AS cnh_dias
         FROM servidor s
         LEFT JOIN setor st ON st.id_setor = s.id_setor
         LEFT JOIN cargo c  ON c.id_cargo  = s.id_cargo
        WHERE s.id_servidor = $1`,
      [id]
    );
    if (!s.rows[0]) return res.status(404).json({ erro: "Servidor não encontrado." });

    const usuario = await query(
      `SELECT u.id_usuario, u.login, u.status, u.ultimo_acesso, p.nome AS perfil
         FROM usuario u JOIN perfil p ON p.id_perfil = u.id_perfil
        WHERE u.id_servidor = $1`,
      [id]
    );

    const SEIS = "CURRENT_DATE - INTERVAL '6 months'";
    const OS_DELE = `ordem_servico o LEFT JOIN usuario uo ON uo.id_usuario = o.id_solicitante
                     WHERE COALESCE(o.id_servidor_solicitante, uo.id_servidor) = $1`;
    const resumo = await query(
      `SELECT
         (SELECT COUNT(*)::int FROM checklist_frotas WHERE id_servidor = $1) AS checklists,
         (SELECT COUNT(*)::int FROM checklist_frotas WHERE id_servidor = $1 AND data_abertura >= ${SEIS}) AS checklists_6m,
         (SELECT COUNT(*)::int FROM ${OS_DELE}) AS manutencoes,
         (SELECT COUNT(*)::int FROM ${OS_DELE} AND o.data_abertura >= ${SEIS}) AS manutencoes_6m,
         (SELECT COUNT(*)::int FROM sinistro WHERE id_servidor = $1) AS sinistros,
         (SELECT COUNT(*)::int FROM sinistro WHERE id_servidor = $1 AND data >= ${SEIS}) AS sinistros_6m,
         -- Multas (037): total, ainda em aberto e pontos dos ultimos 12 meses.
         (SELECT COUNT(*)::int FROM multa WHERE id_servidor = $1 AND status <> 'CANCELADA') AS multas,
         (SELECT COUNT(*)::int FROM multa WHERE id_servidor = $1 AND status IN ('PENDENTE', 'EM_RECURSO')) AS multas_abertas,
         (SELECT COALESCE(SUM(pontos), 0)::int FROM multa
           WHERE id_servidor = $1 AND status <> 'CANCELADA'
             AND data >= CURRENT_DATE - INTERVAL '12 months') AS pontos_12m,
         (SELECT MAX(data_abertura + COALESCE(hora_saida, '00:00'::time))
            FROM checklist_frotas WHERE id_servidor = $1) AS ultimo_checklist,
         (SELECT v.placa FROM checklist_frotas c JOIN veiculo v ON v.id_veiculo = c.id_veiculo
           WHERE c.id_servidor = $1 AND c.status = 'ABERTO'
           ORDER BY c.data_abertura DESC, c.hora_saida DESC LIMIT 1) AS veiculo_em_uso`,
      [id]
    );

    const atividades = await query(
      `SELECT * FROM (
         SELECT 'CHECKLIST' AS origem, c.id_checklist AS id_registro,
                (c.data_abertura + COALESCE(c.hora_saida, '00:00'::time)) AS quando,
                'Checklist de saída - ' || v.placa
                  || COALESCE(' (' || NULLIF(c.percurso, '') || ')', '') AS descricao,
                s.nome AS pessoa, c.status
           FROM checklist_frotas c
           JOIN veiculo v ON v.id_veiculo = c.id_veiculo
           JOIN servidor s ON s.id_servidor = c.id_servidor
          WHERE c.id_servidor = $1
         UNION ALL
         SELECT 'MANUTENCAO', o.id_os, o.data_abertura,
                COALESCE(o.numero || ' - ', '') || v.placa || ' - '
                  || split_part(COALESCE(o.descricao, ''), E'\n', 1),
                COALESCE(so.nome, sc.nome), o.status
           FROM ordem_servico o
           JOIN veiculo v ON v.id_veiculo = o.id_veiculo
           LEFT JOIN usuario uo ON uo.id_usuario = o.id_solicitante
           LEFT JOIN servidor so ON so.id_servidor = uo.id_servidor
           LEFT JOIN servidor sc ON sc.id_servidor = o.id_servidor_solicitante
          WHERE COALESCE(o.id_servidor_solicitante, uo.id_servidor) = $1
         UNION ALL
         SELECT 'SINISTRO', x.id_sinistro, (x.data + COALESCE(x.hora, '00:00'::time)),
                COALESCE(x.numero || ' - ', '') || v.placa || ' - ' || COALESCE(x.local, ''),
                sr.nome, x.status
           FROM sinistro x
           JOIN veiculo v ON v.id_veiculo = x.id_veiculo
           LEFT JOIN usuario ur ON ur.id_usuario = x.id_responsavel
           LEFT JOIN servidor sr ON sr.id_servidor = ur.id_servidor
          WHERE x.id_servidor = $1
         UNION ALL
         SELECT 'MULTA', m.id_multa, (m.data + COALESCE(m.hora, '00:00'::time)),
                'Multa ' || COALESCE(m.numero_auto || ' ', '') || '- ' || v.placa || ' - ' || m.descricao,
                sm.nome, m.status
           FROM multa m
           JOIN veiculo v ON v.id_veiculo = m.id_veiculo
           LEFT JOIN usuario um ON um.id_usuario = m.criado_por
           LEFT JOIN servidor sm ON sm.id_servidor = um.id_servidor
          WHERE m.id_servidor = $1
         UNION ALL
         SELECT 'CADASTRO', a.id_registro, a.data_hora,
                CASE
                  WHEN a.entidade = 'usuario' AND a.acao = 'CRIAR' THEN 'Acesso ao sistema criado'
                  WHEN a.entidade = 'usuario' AND a.acao = 'ALTERAR_SENHA' THEN 'Senha de acesso alterada'
                  WHEN a.entidade = 'usuario' THEN 'Acesso ao sistema alterado'
                  WHEN a.acao = 'CRIAR' THEN 'Cadastro do servidor criado'
                  WHEN a.acao = 'EXCLUIR' THEN 'Cadastro do servidor excluído'
                  ELSE 'Dados do cadastro alterados'
                END || COALESCE(' - Motivo: ' || a.justificativa, ''),
                COALESCE(sa.nome, ua.login), NULL
           FROM auditoria a
           LEFT JOIN usuario ua ON ua.id_usuario = a.id_usuario
           LEFT JOIN servidor sa ON sa.id_servidor = ua.id_servidor
          WHERE ${FILTRO_HISTORICO.servidor}
       ) t
       ORDER BY quando DESC NULLS LAST
       LIMIT 100`,
      [id]
    );

    res.json({
      ...s.rows[0],
      usuario: usuario.rows[0] || null,
      resumo: resumo.rows[0],
      atividades: atividades.rows,
      cnh_historico: await historicoCnh(id),
      cnh_arquivos: await arquivosCnh(id),
    });
  } catch (e) {
    next(e);
  }
});

export default router;
