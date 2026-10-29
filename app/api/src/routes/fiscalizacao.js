/**
 * fiscalizacao.js - Recursos do modulo de Fiscalizacao.
 *
 * Mesma ideia de frotas.js: so configuracoes para a fabrica em crud.js.
 *
 *   /api/fiscalizacao/servico-diario  escala do dia, por turno
 *   /api/fiscalizacao/equipes         equipes e seus integrantes
 *   /api/fiscalizacao/apoios          apoios extras acionados no turno
 *   /api/fiscalizacao/ocorrencias     ocorrencias atendidas
 *   /api/fiscalizacao/checklists      checklists das viaturas
 *   /api/fiscalizacao/pontuacao       itens de pontuacao (so o gestor ve)
 *
 * A Pontuacao usa a MESMA permissao para ver e para gerenciar, de proposito:
 * e a tela restrita ao gestor da Fiscalizacao.
 */
import { Router } from "express";
import { criarCrud } from "../crud.js";
import { pool, query } from "../db.js";
import { autenticar, exigePermissao } from "../auth.js";
import { registrarAuditoria } from "../auditoria.js";
import equipamentosFisc from "./equipamentosFisc.js";
import servicoEquipe from "./servicoEquipe.js";
import { historicoCnh, arquivosCnh } from "./detalhes.js";

const VER = "FISCALIZACAO_VISUALIZAR";

export const servicoDiario = criarCrud({
  tabela: "servico_diario",
  id: "id_servico_diario",
  entidade: "servico_diario",
  select: `servico_diario.*,
           coordenador.nome AS coordenador,
           (SELECT COUNT(*)::int FROM servico_equipe se
             WHERE se.id_servico_diario = servico_diario.id_servico_diario) AS equipes,
           (SELECT COUNT(*)::int FROM ocorrencia o
             WHERE o.id_servico_diario = servico_diario.id_servico_diario) AS ocorrencias`,
  from: `servico_diario
         JOIN servidor coordenador ON coordenador.id_servidor = servico_diario.id_coordenador`,
  busca: ["coordenador.nome", "servico_diario.turno"],
  filtros: {
    status: "servico_diario.status", turno: "servico_diario.turno",
    coordenador: "servico_diario.id_coordenador",
    dataDe: "servico_diario.data", dataAte: "servico_diario.data",
  },
  ordenaveis: {
    data: "servico_diario.data", turno: "servico_diario.turno",
    status: "servico_diario.status", coordenador: "coordenador.nome",
  },
  ordemPadrao: "servico_diario.data DESC",
  campos: [
    "data", "turno", "id_coordenador", "criado_por", "hora_inicio",
    "hora_encerramento", "status", "encerrado_por",
  ],
  obrigatorios: ["data", "turno", "id_coordenador", "criado_por"],
  permissoes: { ver: VER, gerenciar: "FISCALIZACAO_GERENCIAR_SERVICO" },
});

/*
 * Equipes do servico (18/10). Entra quem foi marcado; quem saiu e apagado do
 * servico se ainda nao trabalhou nele (sem checklist e sem ocorrencia), e
 * fica CANCELADA se ja trabalhou - o que aconteceu nao some.
 */
servicoDiario.put("/:id/equipes", autenticar, exigePermissao("FISCALIZACAO_GERENCIAR_SERVICO"), async (req, res, next) => {
  const id = Number(req.params.id);
  const marcadas = [...new Set((Array.isArray(req.body?.equipes) ? req.body.equipes : []).map(Number))]
    .filter((n) => Number.isInteger(n) && n > 0);
  if (!marcadas.length) return res.status(400).json({ erro: "Marque pelo menos uma equipe para o serviço." });
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    const sd = await cliente.query("SELECT status FROM servico_diario WHERE id_servico_diario = $1 FOR UPDATE", [id]);
    if (!sd.rows[0]) { await cliente.query("ROLLBACK"); return res.status(404).json({ erro: "Serviço diário não encontrado." }); }
    if (sd.rows[0].status === "ENCERRADO") {
      await cliente.query("ROLLBACK");
      return res.status(400).json({ erro: "O serviço já foi encerrado; as equipes não mudam mais." });
    }
    const atuais = await cliente.query("SELECT id_equipe, status FROM servico_equipe WHERE id_servico_diario = $1", [id]);
    const antes = atuais.rows.filter((r) => r.status !== "CANCELADA").map((r) => Number(r.id_equipe));
    for (const eq of marcadas) {
      await cliente.query(
        `INSERT INTO servico_equipe (id_servico_diario, id_equipe, status) VALUES ($1, $2, 'ATIVA')
         ON CONFLICT (id_servico_diario, id_equipe) DO UPDATE SET status = 'ATIVA'
           WHERE servico_equipe.status = 'CANCELADA'`, [id, eq]);
    }
    for (const r of atuais.rows) {
      const eq = Number(r.id_equipe);
      if (marcadas.includes(eq)) continue;
      const usou = await cliente.query(
        `SELECT (EXISTS (SELECT 1 FROM checklist_fiscalizacao WHERE id_servico_diario = $1 AND id_equipe = $2)
              OR EXISTS (SELECT 1 FROM distribuicao_ocorrencia WHERE id_servico_diario = $1 AND id_equipe = $2)) AS usou`,
        [id, eq]);
      if (usou.rows[0].usou) {
        await cliente.query("UPDATE servico_equipe SET status = 'CANCELADA' WHERE id_servico_diario = $1 AND id_equipe = $2", [id, eq]);
      } else {
        await cliente.query("DELETE FROM servico_equipe WHERE id_servico_diario = $1 AND id_equipe = $2", [id, eq]);
      }
    }
    await cliente.query("COMMIT");
    await registrarAuditoria({
      idUsuario: req.usuario.id_usuario, acao: "EDITAR", entidade: "servico_equipe",
      idRegistro: id, dadosAnteriores: { equipes: antes }, dadosNovos: { equipes: marcadas },
    });
    res.json({ ok: true });
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    next(e);
  } finally {
    cliente.release();
  }
});

/** Iniciar (Aberto -> Em servico) e encerrar (Em servico -> Encerrado). */
servicoDiario.put("/:id/situacao", autenticar, exigePermissao("FISCALIZACAO_GERENCIAR_SERVICO"), async (req, res, next) => {
  const id = Number(req.params.id);
  const acao = String(req.body?.acao || "").toUpperCase();
  if (!["INICIAR", "ENCERRAR"].includes(acao)) return res.status(400).json({ erro: "Ação inválida." });
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    const { rows } = await cliente.query("SELECT * FROM servico_diario WHERE id_servico_diario = $1 FOR UPDATE", [id]);
    const sd = rows[0];
    if (!sd) { await cliente.query("ROLLBACK"); return res.status(404).json({ erro: "Serviço diário não encontrado." }); }
    if (acao === "INICIAR" && sd.status !== "ABERTO") {
      await cliente.query("ROLLBACK"); return res.status(400).json({ erro: "Só um serviço em aberto pode ser iniciado." });
    }
    if (acao === "ENCERRAR" && sd.status !== "EM_SERVICO") {
      await cliente.query("ROLLBACK"); return res.status(400).json({ erro: "Só um serviço em andamento pode ser encerrado." });
    }
    const agora = new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
    if (acao === "INICIAR") {
      await cliente.query(
        "UPDATE servico_diario SET status = 'EM_SERVICO', hora_inicio = COALESCE(hora_inicio, $2::time) WHERE id_servico_diario = $1",
        [id, agora]);
    } else {
      await cliente.query(
        `UPDATE servico_diario SET status = 'ENCERRADO', hora_encerramento = $2::time, encerrado_por = $3
          WHERE id_servico_diario = $1`, [id, agora, req.usuario.id_usuario]);
      await cliente.query(
        "UPDATE servico_equipe SET status = 'FINALIZADA' WHERE id_servico_diario = $1 AND status = 'ATIVA'", [id]);
    }
    await cliente.query("COMMIT");
    await registrarAuditoria({
      idUsuario: req.usuario.id_usuario, acao: "EDITAR", entidade: "servico_diario", idRegistro: id,
      dadosAnteriores: { status: sd.status },
      dadosNovos: { status: acao === "INICIAR" ? "EM_SERVICO" : "ENCERRADO" },
      justificativa: acao === "INICIAR" ? "Serviço iniciado." : "Serviço encerrado.",
    });
    res.json({ ok: true });
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    next(e);
  } finally {
    cliente.release();
  }
});

export const equipes = criarCrud({
  tabela: "equipe",
  id: "id_equipe",
  entidade: "equipe",
  select: `equipe.*,
           (SELECT COUNT(*)::int FROM equipe_servidor es
             WHERE es.id_equipe = equipe.id_equipe AND es.status AND es.data_fim IS NULL) AS integrantes,
           -- Fiscais atuais da equipe (09/10): nomes para a lista e ids para o cadastro.
           (SELECT string_agg(sx.nome, ', ' ORDER BY sx.nome)
              FROM equipe_servidor es JOIN servidor sx ON sx.id_servidor = es.id_servidor
             WHERE es.id_equipe = equipe.id_equipe AND es.status AND es.data_fim IS NULL) AS nomes_integrantes,
           (SELECT COALESCE(json_agg(es.id_servidor::text ORDER BY es.posicao NULLS LAST, es.id_servidor), '[]'::json)
              FROM equipe_servidor es
             WHERE es.id_equipe = equipe.id_equipe AND es.status AND es.data_fim IS NULL) AS fiscais,
           CASE WHEN equipe.apoio THEN 'APOIO' ELSE 'NORMAL' END AS modalidade,
           -- Fiscal 1 e Fiscal 2 (21/10): pela posicao na equipe.
           f1.id_servidor::text AS fiscal1, f1.nome AS fiscal1_nome, f1.matricula AS fiscal1_matricula,
           f2.id_servidor::text AS fiscal2, f2.nome AS fiscal2_nome, f2.matricula AS fiscal2_matricula,
           -- Turno atual (18/10): Diurno 06:00-19:00 ou Noturno 19:00-23:59.
           (SELECT t.turno FROM equipe_turno t
             WHERE t.id_equipe = equipe.id_equipe AND t.data_inicio <= CURRENT_DATE
               AND (t.data_fim IS NULL OR t.data_fim >= CURRENT_DATE)
             ORDER BY t.data_inicio DESC LIMIT 1) AS turno`,
  from: `equipe
         LEFT JOIN LATERAL (
           SELECT sx.id_servidor, sx.nome, sx.matricula FROM equipe_servidor es JOIN servidor sx ON sx.id_servidor = es.id_servidor
            WHERE es.id_equipe = equipe.id_equipe AND es.status AND es.data_fim IS NULL
            ORDER BY es.posicao NULLS LAST, sx.nome LIMIT 1) f1 ON TRUE
         LEFT JOIN LATERAL (
           SELECT sx.id_servidor, sx.nome, sx.matricula FROM equipe_servidor es JOIN servidor sx ON sx.id_servidor = es.id_servidor
            WHERE es.id_equipe = equipe.id_equipe AND es.status AND es.data_fim IS NULL
            ORDER BY es.posicao NULLS LAST, sx.nome OFFSET 1 LIMIT 1) f2 ON TRUE`,
  busca: ["equipe.numero", "equipe.tipo", "equipe.observacoes", "equipe.policial", "f1.nome", "f1.matricula", "f2.nome", "f2.matricula"],
  filtros: { status: "equipe.status", tipo: "equipe.tipo" },
  ordenaveis: { numero: "equipe.numero", tipo: "equipe.tipo", status: "equipe.status" },
  ordemPadrao: "equipe.numero",
  campos: ["numero", "tipo", "status", "observacoes", "apoio", "policial"],
  obrigatorios: ["numero", "tipo"],
  permissoes: { ver: VER, gerenciar: "FISCALIZACAO_GERENCIAR_EQUIPES" },
});

export const apoios = criarCrud({
  tabela: "apoio_extra",
  id: "id_apoio",
  entidade: "apoio_extra",
  select: `apoio_extra.*, equipe.numero AS equipe, veiculo.placa, servidor.nome AS servidor`,
  from: `apoio_extra
         LEFT JOIN equipe   ON equipe.id_equipe     = apoio_extra.id_equipe
         LEFT JOIN veiculo  ON veiculo.id_veiculo   = apoio_extra.id_veiculo
         LEFT JOIN servidor ON servidor.id_servidor = apoio_extra.id_servidor`,
  busca: ["apoio_extra.motivo", "equipe.numero", "servidor.nome"],
  filtros: { servico: "apoio_extra.id_servico_diario", equipe: "apoio_extra.id_equipe" },
  ordenaveis: { hora_inicio: "apoio_extra.hora_inicio", equipe: "equipe.numero" },
  ordemPadrao: "apoio_extra.hora_inicio DESC",
  campos: [
    "id_servico_diario", "id_equipe", "id_veiculo", "id_servidor",
    "motivo", "hora_inicio", "hora_fim", "observacoes",
  ],
  obrigatorios: ["id_servico_diario", "motivo"],
  permissoes: { ver: VER, gerenciar: "FISCALIZACAO_GERENCIAR_EQUIPES" },
});

export const ocorrencias = criarCrud({
  tabela: "ocorrencia",
  id: "id_ocorrencia",
  entidade: "ocorrencia",
  select: `ocorrencia.*,
           criador.nome AS criado_por_nome,
           servico_diario.data AS data_servico, servico_diario.turno`,
  from: `ocorrencia
         JOIN usuario  u_cri ON u_cri.id_usuario = ocorrencia.criado_por
         JOIN servidor criador ON criador.id_servidor = u_cri.id_servidor
         LEFT JOIN servico_diario ON servico_diario.id_servico_diario = ocorrencia.id_servico_diario`,
  busca: ["ocorrencia.protocolo", "ocorrencia.tipo", "ocorrencia.endereco", "ocorrencia.descricao", "ocorrencia.bairro"],
  filtros: {
    status: "ocorrencia.status", tipo: "ocorrencia.tipo", categoria: "ocorrencia.categoria",
    servico: "ocorrencia.id_servico_diario",
    dataDe: "ocorrencia.data", dataAte: "ocorrencia.data",
  },
  ordenaveis: {
    data: "ocorrencia.data", protocolo: "ocorrencia.protocolo",
    tipo: "ocorrencia.tipo", status: "ocorrencia.status",
  },
  ordemPadrao: "ocorrencia.data DESC, ocorrencia.hora DESC",
  campos: [
    "protocolo", "tipo", "descricao", "data", "hora", "endereco", "observacoes",
    "id_servico_diario", "criado_por", "status", "descricao_atendimento",
    "data_finalizacao", "categoria", "bairro", "referencia", "sentido_via",
  ],
  obrigatorios: ["tipo", "descricao", "data", "hora", "endereco", "criado_por"],
  permissoes: { ver: VER, gerenciar: "FISCALIZACAO_GERENCIAR_OCORRENCIAS" },
});

export const checklistsFiscalizacao = criarCrud({
  tabela: "checklist_fiscalizacao",
  // Equipamentos e os dois fiscais que assinaram saem junto com o checklist.
  filhos: [
    { tabela: "checklist_fiscal_equipamento", chave: "id_checklist" },
    { tabela: "checklist_fiscal_servidor", chave: "id_checklist" },
  ],
  id: "id_checklist",
  entidade: "checklist_fiscalizacao",
  select: `checklist_fiscalizacao.*,
           veiculo.placa, veiculo.marca, veiculo.modelo,
           equipe.numero AS equipe,
           (checklist_fiscalizacao.odometro_chegada - checklist_fiscalizacao.odometro_saida) AS km_rodado`,
  from: `checklist_fiscalizacao
         JOIN veiculo ON veiculo.id_veiculo = checklist_fiscalizacao.id_veiculo
         LEFT JOIN equipe ON equipe.id_equipe = checklist_fiscalizacao.id_equipe`,
  busca: ["veiculo.placa", "equipe.numero"],
  filtros: {
    veiculo: "checklist_fiscalizacao.id_veiculo",
    equipe: "checklist_fiscalizacao.id_equipe",
    status: "checklist_fiscalizacao.status",
    dataDe: "checklist_fiscalizacao.data_abertura",
    dataAte: "checklist_fiscalizacao.data_abertura",
  },
  ordenaveis: {
    data_abertura: "checklist_fiscalizacao.data_abertura",
    placa: "veiculo.placa", equipe: "equipe.numero",
  },
  ordemPadrao: "checklist_fiscalizacao.data_abertura DESC",
  campos: [
    "id_veiculo", "id_servico_diario", "id_equipe", "data_abertura", "hora_saida",
    "hora_chegada", "odometro_saida", "odometro_chegada", "observacoes",
    "status", "data_finalizacao",
  ],
  obrigatorios: ["id_veiculo", "odometro_saida"],
  // Corrigir checklist tem permissao PROPRIA (migracao 019): quem gerencia as
  // viaturas nao ganha de brinde o poder de reescrever o historico delas.
  permissoes: { ver: VER, gerenciar: "FISCALIZACAO_EDITAR_CHECKLIST" },
  // O checklist e prova de um fato. Alterar um numero dele exige dizer por
  // que, e o motivo fica na auditoria junto do antes e do depois.
  exigeJustificativa: true,
});

// Pontuacao: tela restrita ao gestor da Fiscalizacao. A permissao de leitura
// aqui e a mesma de gerenciar, de proposito.
export const pontuacaoItens = criarCrud({
  tabela: "pontuacao_item",
  id: "id_item",
  entidade: "pontuacao_item",
  select: `pontuacao_item.*,
           (SELECT COUNT(*)::int FROM pontuacao_registro r
             WHERE r.id_item = pontuacao_item.id_item) AS registros`,
  from: "pontuacao_item",
  busca: ["pontuacao_item.codigo", "pontuacao_item.nome", "pontuacao_item.descricao"],
  filtros: { ativo: "pontuacao_item.ativo" },
  ordenaveis: {
    codigo: "pontuacao_item.codigo", nome: "pontuacao_item.nome",
    valor_pontos: "pontuacao_item.valor_pontos",
  },
  ordemPadrao: "pontuacao_item.codigo",
  campos: ["codigo", "nome", "descricao", "valor_pontos", "ativo", "criado_por"],
  obrigatorios: ["codigo", "nome", "valor_pontos"],
  permissoes: {
    ver: "FISCALIZACAO_GERENCIAR_PONTUACAO",
    gerenciar: "FISCALIZACAO_GERENCIAR_PONTUACAO",
  },
});

/*
 * Integrantes da equipe (09/10): a tela manda a lista inteira de fiscais.
 * Quem saiu ganha data_fim = hoje (o historico continua valendo para as
 * ocorrencias e a pontuacao daquele periodo); quem entrou comeca hoje.
 */
equipes.put("/:id/integrantes", autenticar, exigePermissao("FISCALIZACAO_GERENCIAR_EQUIPES"),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const novos = [...new Set((Array.isArray(req.body?.servidores) ? req.body.servidores : [])
        .map(Number).filter((n) => Number.isInteger(n) && n > 0))];
      const eq = await query("SELECT 1 FROM equipe WHERE id_equipe = $1", [id]);
      if (!eq.rows[0]) return res.status(404).json({ erro: "Equipe não encontrada." });
      const atuais = (await query(
        `SELECT id_servidor FROM equipe_servidor
          WHERE id_equipe = $1 AND status AND data_fim IS NULL`, [id]
      )).rows.map((r) => Number(r.id_servidor));
      const sairam = atuais.filter((s) => !novos.includes(s));
      const entraram = novos.filter((s) => !atuais.includes(s));
      if (sairam.length) {
        await query(
          `UPDATE equipe_servidor SET data_fim = CURRENT_DATE, status = FALSE
            WHERE id_equipe = $1 AND id_servidor = ANY($2::bigint[]) AND status AND data_fim IS NULL`,
          [id, sairam]
        );
      }
      for (const s of entraram) {
        // Saiu e voltou no mesmo dia: reaproveita a linha de hoje.
        await query(
          `INSERT INTO equipe_servidor (id_equipe, id_servidor, data_inicio, status)
           VALUES ($1, $2, CURRENT_DATE, TRUE)
           ON CONFLICT (id_equipe, id_servidor, data_inicio)
           DO UPDATE SET data_fim = NULL, status = TRUE`,
          [id, s]
        );
      }
      // A ordem da lista e a posicao (Fiscal 1, Fiscal 2), 21/10.
      for (let i = 0; i < novos.length; i++) {
        await query(
          "UPDATE equipe_servidor SET posicao = $3 WHERE id_equipe = $1 AND id_servidor = $2 AND status AND data_fim IS NULL",
          [id, novos[i], i + 1]);
      }
      if (sairam.length || entraram.length) {
        await registrarAuditoria({
          idUsuario: req.usuario.id_usuario, acao: "EDITAR", entidade: "equipe_servidor",
          idRegistro: id, dadosAnteriores: { fiscais: atuais }, dadosNovos: { fiscais: novos },
        });
      }
      res.json({ ok: true, entraram, sairam });
    } catch (e) {
      next(e);
    }
  });

/*
 * Turno da equipe (18/10): escolhido no cadastro. O historico fica em
 * equipe_turno - trocar o turno encerra o anterior ontem e abre o novo hoje
 * (no mesmo dia, so troca o valor do registro de hoje).
 */
equipes.put("/:id/turno", autenticar, exigePermissao("FISCALIZACAO_GERENCIAR_EQUIPES"), async (req, res, next) => {
  const id = Number(req.params.id);
  const turno = String(req.body?.turno || "").toUpperCase();
  if (!["DIURNO", "NOTURNO"].includes(turno)) return res.status(400).json({ erro: "Escolha o turno: Diurno ou Noturno." });
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    const { rows } = await cliente.query(
      `SELECT * FROM equipe_turno
        WHERE id_equipe = $1 AND data_inicio <= CURRENT_DATE AND (data_fim IS NULL OR data_fim >= CURRENT_DATE)
        ORDER BY data_inicio DESC LIMIT 1 FOR UPDATE`,
      [id]
    );
    const atual = rows[0];
    if (atual?.turno === turno) {
      await cliente.query("COMMIT");
      return res.json({ ok: true, turno, alterado: false });
    }
    if (atual && String(atual.data_inicio).slice(0, 10) === new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })) {
      await cliente.query("UPDATE equipe_turno SET turno = $2, alterado_por = $3 WHERE id_equipe_turno = $1",
        [atual.id_equipe_turno, turno, req.usuario.id_usuario]);
    } else {
      if (atual) {
        await cliente.query("UPDATE equipe_turno SET data_fim = CURRENT_DATE - 1 WHERE id_equipe_turno = $1", [atual.id_equipe_turno]);
      }
      await cliente.query(
        `INSERT INTO equipe_turno (id_equipe, turno, data_inicio, motivo, alterado_por)
         VALUES ($1, $2, CURRENT_DATE, 'Definido no cadastro da equipe.', $3)`,
        [id, turno, req.usuario.id_usuario]
      );
    }
    await cliente.query("COMMIT");
    await registrarAuditoria({
      idUsuario: req.usuario.id_usuario, acao: "EDITAR", entidade: "equipe_turno",
      idRegistro: id, dadosAnteriores: { turno: atual?.turno || null }, dadosNovos: { turno },
    });
    res.json({ ok: true, turno, alterado: true });
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    next(e);
  } finally {
    cliente.release();
  }
});

const router = Router();

/*
 * Servico Diario (desenho de 18/10): a lista mostra UMA LINHA POR EQUIPE no
 * servico (servico_equipe). Viatura, saida e retorno vem do checklist da
 * viatura daquela equipe naquele servico; os fiscais, do checklist (Fiscal 1
 * e 2) ou, sem checklist, da composicao da equipe no dia.
 */
// 21/10: a situacao e a da EQUIPE no servico. Em servico desde o "Continuar"
// do checklist da viatura; encerrado ao finalizar o checklist.
const SITUACAO_LINHA = `CASE
    WHEN se.status = 'CANCELADA' THEN 'CANCELADA'
    WHEN se.status = 'FINALIZADA' OR sd.status = 'ENCERRADO' THEN 'ENCERRADO'
    WHEN se.status = 'EM_SERVICO' THEN 'EM_SERVICO'
    WHEN EXISTS (SELECT 1 FROM checklist_fiscalizacao cx WHERE cx.id_servico_diario = se.id_servico_diario
                  AND cx.id_equipe = se.id_equipe AND cx.status = 'ABERTO') THEN 'EM_SERVICO'
    WHEN EXISTS (SELECT 1 FROM checklist_fiscalizacao cx WHERE cx.id_servico_diario = se.id_servico_diario
                  AND cx.id_equipe = se.id_equipe) THEN 'ENCERRADO'
    ELSE 'ABERTO' END`;

router.get("/servico-diario/painel", autenticar, exigePermissao(VER), async (req, res, next) => {
  try {
    const q = req.query;
    const valores = [];
    const onde = [];
    const p = (v) => { valores.push(v); return `$${valores.length}`; };
    if (q.dataDe) onde.push(`l.data >= ${p(q.dataDe)}`);
    if (q.dataAte) onde.push(`l.data <= ${p(q.dataAte)}`);
    if (q.turno) onde.push(`l.turno = ${p(String(q.turno))}`);
    if (q.equipe) onde.push(`l.id_equipe = ${p(Number(q.equipe))}`);
    if (q.veiculo) onde.push(`l.id_veiculo = ${p(Number(q.veiculo))}`);
    if (q.status) onde.push(`l.situacao = ${p(String(q.status))}`);
    if (q.fiscal) onde.push(`${p(Number(q.fiscal))} = ANY(l.ids_fiscais)`);
    if (q.busca) {
      const b = p(`%${String(q.busca).trim()}%`);
      onde.push(`(l.codigo ILIKE ${b} OR l.equipe ILIKE ${b} OR l.placa ILIKE ${b} OR l.coordenador ILIKE ${b})`);
    }
    const filtro = onde.length ? `WHERE ${onde.join(" AND ")}` : "";
    const porPagina = Math.min(Math.max(Number(q.porPagina) || 10, 1), 100);
    const pagina = Math.max(Number(q.pagina) || 1, 1);

    const base = `
      WITH l AS (
        SELECT sd.id_servico_diario, sd.data, sd.turno, sd.status AS status_servico,
               sd.hora_inicio, sd.hora_encerramento, COALESCE(se.id_coordenador, sd.id_coordenador) AS id_coordenador,
               co.nome AS coordenador,
               se.id_servico_equipe, se.numero AS codigo, se.id_equipe, se.status AS status_equipe, eq.numero AS equipe,
               ap.numero AS equipe_apoio,
               c.id_checklist, c.hora_saida, c.hora_chegada, c.status AS status_checklist,
               v.id_veiculo, v.placa, v.marca, v.modelo,
               ${SITUACAO_LINHA} AS situacao,
               COALESCE(fc.nomes, fe.nomes) AS fiscais,
               COALESCE(fc.ids, fe.ids, ARRAY[]::bigint[]) AS ids_fiscais,
               (SELECT COUNT(DISTINCT d.id_ocorrencia)::int FROM distribuicao_ocorrencia d
                 WHERE d.id_servico_diario = sd.id_servico_diario AND d.id_equipe = se.id_equipe AND d.status <> 'CANCELADA') AS ocorrencias
          FROM servico_diario sd
          LEFT JOIN servico_equipe se ON se.id_servico_diario = sd.id_servico_diario
          -- Coordenador: o do servico da equipe (21/10); nos antigos, o do turno.
          LEFT JOIN servidor co ON co.id_servidor = COALESCE(se.id_coordenador, sd.id_coordenador)
          LEFT JOIN equipe eq ON eq.id_equipe = se.id_equipe
          LEFT JOIN LATERAL (
            SELECT * FROM checklist_fiscalizacao c
             WHERE c.id_servico_diario = sd.id_servico_diario AND c.id_equipe = se.id_equipe
             ORDER BY c.data_abertura DESC, c.hora_saida DESC NULLS LAST LIMIT 1) c ON TRUE
          -- Viatura: a do checklist; sem checklist, a escolhida no servico (21/10).
          LEFT JOIN veiculo v ON v.id_veiculo = COALESCE(c.id_veiculo, se.id_veiculo)
          LEFT JOIN equipe ap ON ap.id_equipe = se.id_equipe_apoio
          LEFT JOIN LATERAL (
            SELECT array_agg(sx.nome ORDER BY cs.tipo) AS nomes, array_agg(sx.id_servidor) AS ids
              FROM checklist_fiscal_servidor cs JOIN servidor sx ON sx.id_servidor = cs.id_servidor
             WHERE cs.id_checklist = c.id_checklist) fc ON c.id_checklist IS NOT NULL
          LEFT JOIN LATERAL (
            SELECT array_agg(sx.nome ORDER BY sx.nome) AS nomes, array_agg(sx.id_servidor) AS ids
              FROM equipe_servidor es JOIN servidor sx ON sx.id_servidor = es.id_servidor
             WHERE es.id_equipe = se.id_equipe AND es.data_inicio <= sd.data
               AND (es.data_fim IS NULL OR es.data_fim >= sd.data)) fe ON se.id_equipe IS NOT NULL
         -- Servico sem equipe (modelo antigo, equipes marcadas depois) nao aparece mais.
         WHERE se.id_servico_equipe IS NOT NULL
      )`;
    const total = await query(`${base} SELECT COUNT(*)::int AS n FROM l ${filtro}`, valores);
    const itens = await query(
      `${base} SELECT * FROM l ${filtro}
        ORDER BY l.data DESC, l.codigo DESC NULLS FIRST
        LIMIT ${porPagina} OFFSET ${(pagina - 1) * porPagina}`,
      valores
    );
    const n = total.rows[0].n;
    res.json({ itens: itens.rows, total: n, pagina, porPagina, paginas: Math.max(Math.ceil(n / porPagina), 1) });
  } catch (e) {
    next(e);
  }
});

/*
 * Detalhes da Viatura (desenho do Cesar, 18/10) numa chamada so. Fica na
 * Fiscalizacao porque quem so tem a Fiscalizacao nao ve as rotas de Frotas
 * (checklists de frota, sinistros); aqui so entra veiculo que e viatura.
 */
router.get("/viaturas/:id/ficha", autenticar, exigePermissao(VER), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const v = await query(
      `SELECT v.*, st.nome AS setor,
              (SELECT codigo FROM qr_code q WHERE q.id_veiculo = v.id_veiculo) AS qr_codigo,
              (SELECT f.atualizado_em FROM veiculo_foto f WHERE f.id_veiculo = v.id_veiculo) AS foto_em
         FROM veiculo v JOIN setor st ON st.id_setor = v.id_setor
        WHERE v.id_veiculo = $1`, [id]);
    const viatura = v.rows[0];
    if (!viatura) return res.status(404).json({ erro: "Viatura não encontrada." });
    if (!viatura.viatura) return res.status(404).json({ erro: "Este veículo não é uma viatura da Fiscalização." });

    const checklists = await query(
      `SELECT c.id_checklist, c.data_abertura, c.hora_saida, c.hora_chegada, c.status,
              c.odometro_saida, c.odometro_chegada,
              (c.odometro_chegada - c.odometro_saida) AS km_rodado,
              eq.id_equipe, eq.numero AS equipe,
              (SELECT string_agg(sx.nome, ', ' ORDER BY cs.tipo)
                 FROM checklist_fiscal_servidor cs JOIN servidor sx ON sx.id_servidor = cs.id_servidor
                WHERE cs.id_checklist = c.id_checklist) AS fiscais
         FROM checklist_fiscalizacao c
         LEFT JOIN equipe eq ON eq.id_equipe = c.id_equipe
        WHERE c.id_veiculo = $1
        ORDER BY c.data_abertura DESC, c.hora_saida DESC NULLS LAST LIMIT 200`, [id]);

    const manutencoes = await query(
      `SELECT id_os, numero, data_abertura, data_agendada, data_fechamento, tipo, descricao,
              quilometragem, status, oficina, custo, proxima_manutencao
         FROM ordem_servico WHERE id_veiculo = $1
        ORDER BY data_abertura DESC LIMIT 200`, [id]);

    const ocorrencias = await query(
      `SELECT DISTINCT ON (o.id_ocorrencia)
              o.id_ocorrencia, o.protocolo, o.tipo, o.data, o.hora, o.endereco, o.descricao, o.status,
              eq.numero AS equipe
         FROM distribuicao_ocorrencia d
         JOIN ocorrencia o ON o.id_ocorrencia = d.id_ocorrencia
         LEFT JOIN equipe eq ON eq.id_equipe = d.id_equipe
        WHERE d.id_veiculo = $1
        ORDER BY o.id_ocorrencia, d.data DESC, d.hora DESC`, [id]);
    ocorrencias.rows.sort((a, b) =>
      String(b.data).localeCompare(String(a.data)) || String(b.hora).localeCompare(String(a.hora)));

    const sinistros = await query(
      `SELECT x.id_sinistro, x.numero, x.data, x.hora, x.tipo, x.local, x.descricao, x.status,
              s.nome AS condutor
         FROM sinistro x LEFT JOIN servidor s ON s.id_servidor = x.id_servidor
        WHERE x.id_veiculo = $1 ORDER BY x.data DESC LIMIT 200`, [id]);

    const documentos = await query(
      `SELECT d.id_documento, d.tipo_documento, d.categoria, d.numero_documento, d.data_validade,
              d.data_emissao, d.orgao_emissor, d.observacoes,
              d.status, (d.data_validade - CURRENT_DATE) AS dias_para_vencer,
              (SELECT COUNT(*)::int FROM documento_arquivo a WHERE a.id_documento = d.id_documento) AS arquivos,
              (SELECT json_build_object('id_arquivo', a.id_arquivo, 'nome', a.nome, 'tipo', a.tipo, 'bytes', a.bytes)
                 FROM documento_arquivo a WHERE a.id_documento = d.id_documento
                ORDER BY a.id_arquivo DESC LIMIT 1) AS ultimo_arquivo
         FROM documento_veiculo d
        WHERE d.id_veiculo = $1 AND d.substituido_em IS NULL
        ORDER BY d.data_validade NULLS LAST`, [id]);

    const cadastro = await query(
      `SELECT a.data_hora, a.acao, a.justificativa, COALESCE(sa.nome, ua.login) AS pessoa
         FROM auditoria a
         LEFT JOIN usuario ua ON ua.id_usuario = a.id_usuario
         LEFT JOIN servidor sa ON sa.id_servidor = ua.id_servidor
        WHERE a.entidade = 'veiculo' AND a.id_registro = $1
        ORDER BY a.data_hora DESC LIMIT 50`, [id]);

    // 29/10: equipamentos da viatura (o que esta cadastrado nela) e a
    // proxima inspecao, para a Visao Geral no desenho dos Detalhes do Veiculo.
    const equipamentos = await query(
      `SELECT e.id_equipamento, e.nome, e.conferencia, COALESCE(ve.quantidade, 0)::int AS quantidade
         FROM equipamento e
         LEFT JOIN veiculo_equipamento ve ON ve.id_equipamento = e.id_equipamento AND ve.id_veiculo = $1
        WHERE e.status
        ORDER BY e.ordem NULLS LAST, e.nome`, [id]);
    const extra = (await query(
      `SELECT COALESCE(
                (SELECT MIN(data_programada) FROM inspecao
                  WHERE id_veiculo = $1 AND status = 'ABERTA' AND data_programada IS NOT NULL),
                (SELECT proxima_inspecao FROM inspecao
                  WHERE id_veiculo = $1 AND status = 'FINALIZADA' AND proxima_inspecao IS NOT NULL
                  ORDER BY data_realizacao DESC LIMIT 1)) AS proxima_inspecao,
              (SELECT COALESCE(SUM(custo), 0) FROM ordem_servico
                WHERE id_veiculo = $1 AND COALESCE(data_fechamento, data_abertura::date) >= CURRENT_DATE - INTERVAL '12 months') AS custo_manutencao_12m`,
      [id])).rows[0];

    const ultimo = checklists.rows[0] || null;
    const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const proxima = manutencoes.rows
      .map((o) => o.proxima_manutencao && String(o.proxima_manutencao).slice(0, 10))
      .filter((d) => d && d >= hoje).sort()[0] || null;

    res.json({
      ...viatura,
      checklists: checklists.rows,
      manutencoes: manutencoes.rows,
      ocorrencias: ocorrencias.rows,
      sinistros: sinistros.rows,
      documentos: documentos.rows,
      cadastro: cadastro.rows,
      equipamentos: equipamentos.rows,
      resumo: {
        proxima_inspecao: extra.proxima_inspecao,
        custo_manutencao_12m: extra.custo_manutencao_12m,
        equipe_atual: ultimo ? { id_equipe: ultimo.id_equipe, numero: ultimo.equipe } : null,
        ultimo_checklist: ultimo,
        proxima_manutencao: proxima,
        os_abertas: manutencoes.rows.filter((o) => !["RESOLVIDA", "CANCELADA"].includes(o.status)).length,
        documentos_vencidos: documentos.rows.filter((d) => d.dias_para_vencer !== null && d.dias_para_vencer < 0).length,
      },
    });
  } catch (e) {
    next(e);
  }
});

/** Historico (auditoria) de um registro, com quem fez. */
async function historicoDe(entidades, id) {
  const { rows } = await query(
    `SELECT a.data_hora, a.acao, a.entidade, a.justificativa, a.dados_anteriores, a.dados_novos,
            COALESCE(sa.nome, ua.login) AS pessoa
       FROM auditoria a
       LEFT JOIN usuario ua ON ua.id_usuario = a.id_usuario
       LEFT JOIN servidor sa ON sa.id_servidor = ua.id_servidor
      WHERE a.entidade = ANY($1) AND a.id_registro = $2
      ORDER BY a.data_hora DESC LIMIT 100`, [entidades, id]);
  return rows;
}

/*
 * Detalhes da Ocorrencia (desenho do Cesar, 18/10). O SITRA guarda da
 * ocorrencia: protocolo, tipo (QRU/Programada), data e hora, local,
 * descricao, observacoes, situacao e o atendimento; a equipe e a viatura vem
 * da distribuicao. Envolvidos, fotos e infracoes nao existem no sistema.
 */
router.get("/ocorrencias/:id/ficha", autenticar, exigePermissao(VER), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const vePontos = (req.usuario?.permissoes || []).includes("FISCALIZACAO_GERENCIAR_PONTUACAO");
    const o = await query(
      `SELECT o.*, cr.nome AS criado_por_nome, cr.matricula AS criado_por_matricula,
              sd.data AS servico_data, sd.turno AS servico_turno, sd.status AS servico_status,
              co.nome AS coordenador, co.matricula AS coordenador_matricula
         FROM ocorrencia o
         LEFT JOIN usuario u ON u.id_usuario = o.criado_por
         LEFT JOIN servidor cr ON cr.id_servidor = u.id_servidor
         LEFT JOIN servico_diario sd ON sd.id_servico_diario = o.id_servico_diario
         LEFT JOIN servidor co ON co.id_servidor = sd.id_coordenador
        WHERE o.id_ocorrencia = $1`, [id]);
    const oc = o.rows[0];
    if (!oc) return res.status(404).json({ erro: "Ocorrência não encontrada." });

    const distribuicoes = await query(
      `SELECT d.id_distribuicao, d.data, d.hora, d.tipo, d.motivo_reatribuicao, d.status,
              d.id_equipe, eq.numero AS equipe, d.id_veiculo, v.placa, v.marca, v.modelo,
              co.nome AS coordenador
         FROM distribuicao_ocorrencia d
         LEFT JOIN equipe eq ON eq.id_equipe = d.id_equipe
         LEFT JOIN veiculo v ON v.id_veiculo = d.id_veiculo
         LEFT JOIN servidor co ON co.id_servidor = d.id_coordenador
        WHERE d.id_ocorrencia = $1
        ORDER BY d.data DESC, d.hora DESC, d.id_distribuicao DESC`, [id]);
    const atual = distribuicoes.rows.find((d) => d.status === "ATIVA") || distribuicoes.rows[0] || null;
    // Codigo do servico (SD) da equipe que atendeu.
    if (atual && oc.id_servico_diario) {
      const se = await query(
        "SELECT id_servico_equipe, numero FROM servico_equipe WHERE id_servico_diario = $1 AND id_equipe = $2",
        [oc.id_servico_diario, atual.id_equipe]);
      if (se.rows[0]) { oc.id_servico_equipe = se.rows[0].id_servico_equipe; oc.servico_codigo = se.rows[0].numero; }
    }

    // Fiscais da equipe que atendeu, naquele dia.
    const fiscais = atual ? await query(
      `SELECT s.id_servidor, s.nome, s.matricula, c.nome AS cargo
         FROM equipe_servidor es
         JOIN servidor s ON s.id_servidor = es.id_servidor
         LEFT JOIN cargo c ON c.id_cargo = s.id_cargo
        WHERE es.id_equipe = $1 AND es.data_inicio <= $2 AND (es.data_fim IS NULL OR es.data_fim >= $2)
        ORDER BY s.nome`, [atual.id_equipe, atual.data]) : { rows: [] };

    const pontuacao = vePontos ? await query(
      `SELECT r.id_pontuacao, r.data_registro, r.quantidade, r.pontos_aplicados, r.observacao,
              i.codigo, i.nome AS item, eq.numero AS equipe, s.nome AS servidor
         FROM pontuacao_registro r
         JOIN pontuacao_item i ON i.id_item = r.id_item
         LEFT JOIN equipe eq ON eq.id_equipe = r.id_equipe
         LEFT JOIN servidor s ON s.id_servidor = r.id_servidor
        WHERE r.entidade_origem = 'ocorrencia' AND r.id_registro_origem = $1
        ORDER BY r.data_registro DESC`, [id]) : null;

    // Envolvidos, fotos/documentos e ocorrencias ligadas (migracao 044).
    const envolvidos = await query(
      "SELECT id_envolvido, tipo, identificacao, placa_documento FROM ocorrencia_envolvido WHERE id_ocorrencia = $1 ORDER BY id_envolvido", [id]);
    const arquivos = await query(
      "SELECT id_arquivo, categoria, nome, tipo, bytes, criado_em FROM ocorrencia_arquivo WHERE id_ocorrencia = $1 ORDER BY categoria DESC, id_arquivo", [id]);
    const ligadas = await query(
      `SELECT id_ocorrencia, protocolo, tipo, status, descricao, data, hora,
              CASE WHEN id_ocorrencia = $2 THEN 'ORIGEM' ELSE 'DERIVADA' END AS relacao
         FROM ocorrencia WHERE id_ocorrencia = $2 OR id_ocorrencia_origem = $1
        ORDER BY data, hora`, [id, oc.id_ocorrencia_origem || 0]);

    res.json({
      ...oc,
      envolvidos: envolvidos.rows,
      arquivos: arquivos.rows,
      ligadas: ligadas.rows,
      distribuicao: atual,
      distribuicoes: distribuicoes.rows,
      fiscais: fiscais.rows,
      pontuacao: pontuacao ? pontuacao.rows : null,
      historico: await historicoDe(["ocorrencia"], id),
    });
  } catch (e) {
    next(e);
  }
});

// Lista das fotos/documentos da ocorrencia (aba Ocorrencias da viatura, 29/10).
router.get("/ocorrencias/:id/arquivos", autenticar, exigePermissao(VER), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id_arquivo, categoria, nome, tipo, bytes, criado_em
         FROM ocorrencia_arquivo WHERE id_ocorrencia = $1 ORDER BY categoria DESC, id_arquivo`,
      [Number(req.params.id)]);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Foto ou documento da ocorrencia (miniatura / abrir).
router.get("/ocorrencias/arquivos/:id", autenticar, exigePermissao(VER), async (req, res, next) => {
  try {
    const { rows } = await query("SELECT nome, tipo, conteudo FROM ocorrencia_arquivo WHERE id_arquivo = $1", [Number(req.params.id)]);
    if (!rows[0]) return res.status(404).json({ erro: "Arquivo não encontrado." });
    res.setHeader("Content-Type", rows[0].tipo);
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(rows[0].nome)}`);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(rows[0].conteudo);
  } catch (e) {
    next(e);
  }
});

/*
 * Detalhes do Checklist da Fiscalizacao (desenho do Cesar, 18/10). O
 * checklist da viatura guarda: saida e chegada (hora e odometro), os dois
 * fiscais, os equipamentos conferidos em cada etapa e as observacoes. Itens
 * "conforme / nao conforme", fotos, area de atuacao e percurso nao existem
 * no checklist da Fiscalizacao.
 */
router.get("/checklists/:id/ficha", autenticar, exigePermissao(VER), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const vePontos = (req.usuario?.permissoes || []).includes("FISCALIZACAO_GERENCIAR_PONTUACAO");
    const c = await query(
      `SELECT c.*, (c.odometro_chegada - c.odometro_saida) AS km_rodado,
              v.placa, v.marca, v.modelo, v.tipo_veiculo,
              eq.numero AS equipe,
              sd.data AS servico_data, sd.turno AS servico_turno, sd.status AS servico_status,
              co.nome AS coordenador, co.matricula AS coordenador_matricula,
              se.id_servico_equipe, se.numero AS servico_codigo
         FROM checklist_fiscalizacao c
         LEFT JOIN servico_equipe se ON se.id_servico_diario = c.id_servico_diario AND se.id_equipe = c.id_equipe
         JOIN veiculo v ON v.id_veiculo = c.id_veiculo
         LEFT JOIN equipe eq ON eq.id_equipe = c.id_equipe
         LEFT JOIN servico_diario sd ON sd.id_servico_diario = c.id_servico_diario
         LEFT JOIN servidor co ON co.id_servidor = sd.id_coordenador
        WHERE c.id_checklist = $1`, [id]);
    const ck = c.rows[0];
    if (!ck) return res.status(404).json({ erro: "Checklist não encontrado." });

    const fiscais = await query(
      `SELECT cs.tipo, s.id_servidor, s.nome, s.matricula
         FROM checklist_fiscal_servidor cs JOIN servidor s ON s.id_servidor = cs.id_servidor
        WHERE cs.id_checklist = $1 ORDER BY cs.tipo`, [id]);

    // Equipamentos: o que a viatura deve ter (veiculo_equipamento) e o que
    // foi conferido na saida e na chegada.
    const equipamentos = await query(
      `SELECT e.id_equipamento, e.nome, e.conferencia,
              CASE e.conferencia
                WHEN 'POR_FISCAL' THEN (SELECT COUNT(*) FROM checklist_fiscal_servidor cs WHERE cs.id_checklist = $1)::int
                WHEN 'OBRIGATORIO' THEN 1
                ELSE COALESCE(ve.quantidade, 0) END AS previsto,
              sai.quantidade AS saida, sai.observacao AS obs_saida,
              che.quantidade AS chegada, che.observacao AS obs_chegada
         FROM equipamento e
         LEFT JOIN veiculo_equipamento ve ON ve.id_equipamento = e.id_equipamento AND ve.id_veiculo = $2
         LEFT JOIN checklist_fiscal_equipamento sai
                ON sai.id_equipamento = e.id_equipamento AND sai.id_checklist = $1 AND sai.etapa = 'SAIDA'
         LEFT JOIN checklist_fiscal_equipamento che
                ON che.id_equipamento = e.id_equipamento AND che.id_checklist = $1 AND che.etapa = 'CHEGADA'
        WHERE e.status OR sai.id_checklist IS NOT NULL OR che.id_checklist IS NOT NULL
        ORDER BY e.ordem NULLS LAST, e.id_equipamento`, [id, ck.id_veiculo]);

    const ocorrencias = (ck.id_servico_diario && ck.id_equipe) ? await query(
      `SELECT DISTINCT ON (o.id_ocorrencia)
              o.id_ocorrencia, o.protocolo, o.tipo, o.data, o.hora, o.endereco, o.descricao, o.status
         FROM distribuicao_ocorrencia d JOIN ocorrencia o ON o.id_ocorrencia = d.id_ocorrencia
        WHERE d.id_servico_diario = $1 AND d.id_equipe = $2
        ORDER BY o.id_ocorrencia`, [ck.id_servico_diario, ck.id_equipe]) : { rows: [] };
    ocorrencias.rows.sort((a, b) => String(a.hora).localeCompare(String(b.hora)));

    // Pontuacao: a lancada por este checklist e a da equipe no mesmo dia.
    const pontuacao = vePontos ? await query(
      `SELECT r.id_pontuacao, r.data_registro, r.quantidade, r.pontos_aplicados, r.observacao,
              r.entidade_origem, i.codigo, i.nome AS item, s.nome AS servidor
         FROM pontuacao_registro r
         JOIN pontuacao_item i ON i.id_item = r.id_item
         LEFT JOIN servidor s ON s.id_servidor = r.id_servidor
        WHERE (r.entidade_origem = 'checklist_fiscalizacao' AND r.id_registro_origem = $1)
           OR ($2::bigint IS NOT NULL AND r.id_equipe = $2 AND r.data_registro::date = $3::date
               AND r.entidade_origem IS DISTINCT FROM 'checklist_fiscalizacao')
        ORDER BY r.data_registro DESC`, [id, ck.id_equipe, ck.data_abertura]) : null;

    // OS abertas pelo QR Code durante o checklist e as fotos (21/10).
    const osChecklist = await query(
      `SELECT id_os, numero, descricao, gravidade, momento, status, data_abertura
         FROM ordem_servico WHERE origem = 'CHECKLIST_FISCALIZACAO' AND id_registro_origem = $1
        ORDER BY data_abertura`, [id]);
    const fotos = await query(
      "SELECT id_foto, momento, tipo, bytes FROM checklist_fiscal_foto WHERE id_checklist = $1 ORDER BY momento, id_foto", [id]);
    res.json({
      ...ck,
      os: osChecklist.rows,
      fotos: fotos.rows,
      fiscais: fiscais.rows,
      equipamentos: equipamentos.rows,
      ocorrencias: ocorrencias.rows,
      pontuacao: pontuacao ? pontuacao.rows : null,
      historico: await historicoDe(["checklist_fiscalizacao"], id),
    });
  } catch (e) {
    next(e);
  }
});

/*
 * Pontuacao (desenho do Cesar, 18/10): a classificacao dos FISCAIS no
 * periodo. A pontuacao e a da ficha do fiscal: a lancada para ele e a da
 * equipe em que ele estava no dia. Multas, ocorrencias e checklists sao do
 * mesmo periodo. Motorista nao entra: pontuacao no SITRA e da Fiscalizacao.
 */
const PONTOS = "FISCALIZACAO_GERENCIAR_PONTUACAO";
function filtroPeriodo(q, coluna, p) {
  const partes = [];
  if (q.dataDe) partes.push(`${coluna}::date >= ${p(q.dataDe)}::date`);
  if (q.dataAte) partes.push(`${coluna}::date <= ${p(q.dataAte)}::date`);
  return partes.length ? ` AND ${partes.join(" AND ")}` : "";
}

router.get("/pontuacao/ranking", autenticar, exigePermissao(PONTOS), async (req, res, next) => {
  try {
    const q = req.query;
    const valores = [];
    const p = (v) => { valores.push(v); return `$${valores.length}`; };
    const naEquipe = (dataCol, equipeCol) => `EXISTS (
      SELECT 1 FROM equipe_servidor es
       WHERE es.id_servidor = s.id_servidor AND es.id_equipe = ${equipeCol}
         AND es.data_inicio <= ${dataCol}::date AND (es.data_fim IS NULL OR es.data_fim >= ${dataCol}::date))`;
    const perR = filtroPeriodo(q, "r.data_registro", p);
    const perM = filtroPeriodo(q, "m.data", p);
    const perD = filtroPeriodo(q, "d.data", p);
    const perC = filtroPeriodo(q, "c.data_abertura", p);
    const onde = [
      `s.status`,
      `(unaccent_simples(cg.nome) = 'FISCAL DE TRANSITO'
         OR EXISTS (SELECT 1 FROM equipe_servidor ex WHERE ex.id_servidor = s.id_servidor))`,
    ];
    if (q.busca) {
      const b = p(`%${String(q.busca).trim()}%`);
      onde.push(`(s.nome ILIKE ${b} OR s.matricula ILIKE ${b})`);
    }
    if (q.equipe) {
      onde.push(`EXISTS (SELECT 1 FROM equipe_servidor ey WHERE ey.id_servidor = s.id_servidor
                          AND ey.id_equipe = ${p(Number(q.equipe))} AND ey.status AND ey.data_fim IS NULL)`);
    }
    const base = `
      WITH l AS (
        SELECT s.id_servidor, s.nome, s.matricula, cg.nome AS cargo,
               (SELECT string_agg(eq.numero, ', ' ORDER BY eq.numero)
                  FROM equipe_servidor ez JOIN equipe eq ON eq.id_equipe = ez.id_equipe
                 WHERE ez.id_servidor = s.id_servidor AND ez.status AND ez.data_fim IS NULL) AS equipe,
               pts.positivos, pts.negativos, pts.lancamentos,
               COALESCE(pts.positivos, 0) + COALESCE(pts.negativos, 0) AS pontos,
               (SELECT COUNT(*)::int FROM multa m
                 WHERE m.id_servidor = s.id_servidor AND m.status <> 'CANCELADA'${perM}) AS multas,
               (SELECT COUNT(DISTINCT d.id_ocorrencia)::int FROM distribuicao_ocorrencia d
                 WHERE ${naEquipe("d.data", "d.id_equipe")}${perD}) AS ocorrencias,
               (SELECT COUNT(*)::int FROM checklist_fiscal_servidor cs
                  JOIN checklist_fiscalizacao c ON c.id_checklist = cs.id_checklist
                 WHERE cs.id_servidor = s.id_servidor${perC}) AS checklists
          FROM servidor s
          LEFT JOIN cargo cg ON cg.id_cargo = s.id_cargo
          LEFT JOIN LATERAL (
            SELECT COALESCE(SUM(r.pontos_aplicados) FILTER (WHERE r.pontos_aplicados > 0), 0) AS positivos,
                   COALESCE(SUM(r.pontos_aplicados) FILTER (WHERE r.pontos_aplicados < 0), 0) AS negativos,
                   COUNT(*)::int AS lancamentos
              FROM pontuacao_registro r
             WHERE (r.id_servidor = s.id_servidor
                    OR (r.id_servidor IS NULL AND r.id_equipe IS NOT NULL AND ${naEquipe("r.data_registro", "r.id_equipe")}))${perR}
          ) pts ON TRUE
         WHERE ${onde.join(" AND ")}
      )`;
    const porPagina = Math.min(Math.max(Number(q.porPagina) || 10, 1), 100);
    const pagina = Math.max(Number(q.pagina) || 1, 1);
    const total = await query(`${base} SELECT COUNT(*)::int AS n FROM l`, valores);
    const itens = await query(
      `${base} SELECT *, RANK() OVER (ORDER BY pontos DESC)::int AS posicao FROM l
        ORDER BY pontos DESC, nome LIMIT ${porPagina} OFFSET ${(pagina - 1) * porPagina}`, valores);
    const n = total.rows[0].n;
    res.json({ itens: itens.rows, total: n, pagina, porPagina, paginas: Math.max(Math.ceil(n / porPagina), 1) });
  } catch (e) {
    next(e);
  }
});

/** Lancamentos de pontuacao de um fiscal no periodo (painel ao lado da lista). */
router.get("/pontuacao/servidor/:id", autenticar, exigePermissao(PONTOS), async (req, res, next) => {
  try {
    const valores = [Number(req.params.id)];
    const p = (v) => { valores.push(v); return `$${valores.length}`; };
    const per = filtroPeriodo(req.query, "r.data_registro", p);
    const { rows } = await query(
      `SELECT r.id_pontuacao, r.data_registro, r.quantidade, r.pontos_aplicados, r.observacao,
              i.codigo, i.nome AS item, eq.numero AS equipe, (r.id_servidor IS NOT NULL) AS individual
         FROM pontuacao_registro r
         JOIN pontuacao_item i ON i.id_item = r.id_item
         LEFT JOIN equipe eq ON eq.id_equipe = r.id_equipe
        WHERE (r.id_servidor = $1
               OR (r.id_servidor IS NULL AND r.id_equipe IS NOT NULL AND EXISTS (
                     SELECT 1 FROM equipe_servidor es
                      WHERE es.id_servidor = $1 AND es.id_equipe = r.id_equipe
                        AND es.data_inicio <= r.data_registro::date
                        AND (es.data_fim IS NULL OR es.data_fim >= r.data_registro::date))))${per}
        ORDER BY r.data_registro DESC LIMIT 200`, valores);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

/*
 * Detalhes do Servico Diario (desenho do Cesar, 20/10): uma EQUIPE num
 * servico (servico_equipe), com o codigo SD-AAAA-NNNNN. Do desenho saiu o que
 * o SITRA nao tem: tipo de servico, area de atuacao, percurso, pontos
 * fiscalizados, documentos conferidos, autos/advertencias e observacoes
 * finais. Viatura, saida e chegada vem do checklist da viatura da equipe.
 */
router.get("/servico-diario/linha/:id/ficha", autenticar, exigePermissao(VER), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const base = await query(
      `SELECT se.id_servico_equipe, se.numero AS codigo, se.status AS status_equipe, se.id_equipe,
              se.id_veiculo AS id_veiculo_previsto, se.observacoes, se.criado_em, se.hora_inicio AS hora_inicio_equipe,
              se.hora_fim AS hora_fim_equipe, se.id_equipe_apoio, ap.numero AS equipe_apoio, ap.policial AS apoio_policial,
              eq.numero AS equipe, eq.tipo AS tipo_equipe, eq.apoio AS equipe_e_apoio, eq.policial,
              cse.nome AS servico_criado_por,
              sd.id_servico_diario, sd.data, sd.turno, sd.status AS status_servico,
              sd.hora_inicio, sd.hora_encerramento, sd.hora_criacao, COALESCE(se.id_coordenador, sd.id_coordenador) AS id_coordenador,
              co.nome AS coordenador, co.matricula AS coordenador_matricula,
              cr.nome AS criado_por_nome, cr.matricula AS criado_por_matricula,
              en.nome AS encerrado_por_nome,
              ${SITUACAO_LINHA} AS situacao
         FROM servico_equipe se
         JOIN servico_diario sd ON sd.id_servico_diario = se.id_servico_diario
         JOIN equipe eq ON eq.id_equipe = se.id_equipe
         LEFT JOIN equipe ap ON ap.id_equipe = se.id_equipe_apoio
         LEFT JOIN usuario use_ ON use_.id_usuario = se.criado_por
         LEFT JOIN servidor cse ON cse.id_servidor = use_.id_servidor
         LEFT JOIN servidor co ON co.id_servidor = COALESCE(se.id_coordenador, sd.id_coordenador)
         LEFT JOIN usuario ucr ON ucr.id_usuario = sd.criado_por
         LEFT JOIN servidor cr ON cr.id_servidor = ucr.id_servidor
         LEFT JOIN usuario uen ON uen.id_usuario = sd.encerrado_por
         LEFT JOIN servidor en ON en.id_servidor = uen.id_servidor
        WHERE se.id_servico_equipe = $1`, [id]);
    const sv = base.rows[0];
    if (!sv) return res.status(404).json({ erro: "Serviço diário não encontrado." });

    const checklists = await query(
      `SELECT c.id_checklist, c.data_abertura, c.hora_saida, c.hora_chegada, c.status,
              c.odometro_saida, c.odometro_chegada, c.observacoes, c.observacoes_equipe, c.observacoes_chegada,
              (c.odometro_chegada - c.odometro_saida) AS km_rodado,
              v.id_veiculo, v.placa, v.marca, v.modelo, v.cor, v.ano_fabricacao, v.ano_modelo,
              v.tipo_combustivel, v.tipo_veiculo, v.status AS status_veiculo, v.quilometragem_atual,
              (SELECT string_agg(sx.nome, ', ' ORDER BY cs.tipo)
                 FROM checklist_fiscal_servidor cs JOIN servidor sx ON sx.id_servidor = cs.id_servidor
                WHERE cs.id_checklist = c.id_checklist) AS fiscais
         FROM checklist_fiscalizacao c JOIN veiculo v ON v.id_veiculo = c.id_veiculo
        WHERE c.id_servico_diario = $1 AND c.id_equipe = $2
        ORDER BY c.data_abertura, c.hora_saida NULLS LAST`, [sv.id_servico_diario, sv.id_equipe]);

    // Fiscais da equipe no dia; "no checklist" = assinou um checklist do servico.
    const fiscais = await query(
      `SELECT s.id_servidor, s.nome, s.matricula, cg.nome AS cargo,
              (SELECT cs.tipo FROM checklist_fiscal_servidor cs
                 JOIN checklist_fiscalizacao c ON c.id_checklist = cs.id_checklist
                WHERE cs.id_servidor = s.id_servidor AND c.id_servico_diario = $2 AND c.id_equipe = $1
                ORDER BY cs.tipo LIMIT 1) AS papel
         FROM equipe_servidor es
         JOIN servidor s ON s.id_servidor = es.id_servidor
         LEFT JOIN cargo cg ON cg.id_cargo = s.id_cargo
        WHERE es.id_equipe = $1 AND es.data_inicio <= $3 AND (es.data_fim IS NULL OR es.data_fim >= $3)
        ORDER BY s.nome`, [sv.id_equipe, sv.id_servico_diario, sv.data]);

    const ocorrencias = await query(
      `SELECT DISTINCT ON (o.id_ocorrencia)
              o.id_ocorrencia, o.protocolo, o.tipo, o.categoria, o.data, o.hora, o.endereco, o.descricao, o.status,
              v.placa AS viatura
         FROM distribuicao_ocorrencia d
         JOIN ocorrencia o ON o.id_ocorrencia = d.id_ocorrencia
         LEFT JOIN veiculo v ON v.id_veiculo = d.id_veiculo
        WHERE d.id_servico_diario = $1 AND d.id_equipe = $2 AND d.status <> 'CANCELADA'
        ORDER BY o.id_ocorrencia`, [sv.id_servico_diario, sv.id_equipe]);
    ocorrencias.rows.sort((a, b) => String(a.hora).localeCompare(String(b.hora)));

    const historico = await query(
      `SELECT a.data_hora, a.acao, a.entidade, a.justificativa, a.dados_anteriores, a.dados_novos,
              COALESCE(sa.nome, ua.login) AS pessoa
         FROM auditoria a
         LEFT JOIN usuario ua ON ua.id_usuario = a.id_usuario
         LEFT JOIN servidor sa ON sa.id_servidor = ua.id_servidor
        WHERE a.entidade IN ('servico_diario', 'servico_equipe') AND a.id_registro = $1
        ORDER BY a.data_hora DESC LIMIT 100`, [sv.id_servico_diario]);

    // Viatura escolhida no servico (21/10), para quando ainda nao ha checklist.
    const prevista = sv.id_veiculo_previsto ? (await query(
      `SELECT v.id_veiculo, v.placa, v.marca, v.modelo, v.cor, v.ano_fabricacao, v.ano_modelo,
              v.tipo_combustivel, v.tipo_veiculo, v.status AS status_veiculo, v.quilometragem_atual
         FROM veiculo v WHERE v.id_veiculo = $1`, [sv.id_veiculo_previsto])).rows[0] : null;
    const fotos = await query(
      "SELECT id_foto, nome, tipo, bytes, criado_em FROM servico_equipe_foto WHERE id_servico_equipe = $1 ORDER BY id_foto", [id]);
    const historicoEquipe = await query(
      `SELECT a.data_hora, a.acao, a.entidade, a.justificativa, COALESCE(sa.nome, ua.login) AS pessoa
         FROM auditoria a
         LEFT JOIN usuario ua ON ua.id_usuario = a.id_usuario
         LEFT JOIN servidor sa ON sa.id_servidor = ua.id_servidor
        WHERE a.entidade = 'servico_equipe' AND a.id_registro = $1
        ORDER BY a.data_hora DESC LIMIT 100`, [id]);
    const cks = checklists.rows;
    const ocs = ocorrencias.rows;
    res.json({
      ...sv,
      checklists: cks,
      viatura: cks.length ? cks[cks.length - 1] : prevista,
      viatura_prevista: prevista,
      fotos: fotos.rows,
      fiscais: fiscais.rows,
      ocorrencias: ocs,
      historico: [...historicoEquipe.rows, ...historico.rows.filter((h) => h.entidade === "servico_diario")],
      resumo: {
        ocorrencias: ocs.length,
        finalizadas: ocs.filter((o) => o.status === "FINALIZADA").length,
        intercorrencias: ocs.filter((o) => o.status === "INTERCORRENCIA").length,
        checklists: cks.length,
        km_rodado: cks.reduce((t, c) => t + Math.max(Number(c.km_rodado) || 0, 0), 0),
        saida: cks[0]?.hora_saida || null,
        chegada: cks.length ? cks[cks.length - 1].hora_chegada : null,
      },
    });
  } catch (e) {
    next(e);
  }
});

/** Um servico com as suas equipes (janela de Editar). */
router.get("/servico-diario/:id/completo", autenticar, exigePermissao(VER), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const s = await query(
      `SELECT sd.*, co.nome AS coordenador, co.matricula AS coordenador_matricula,
              enc.login AS encerrado_por_login
         FROM servico_diario sd
         JOIN servidor co ON co.id_servidor = sd.id_coordenador
         LEFT JOIN usuario enc ON enc.id_usuario = sd.encerrado_por
        WHERE sd.id_servico_diario = $1`, [id]);
    if (!s.rows[0]) return res.status(404).json({ erro: "Serviço diário não encontrado." });
    const eqs = await query(
      `SELECT se.id_servico_equipe, se.numero AS codigo, se.id_equipe, se.status, eq.numero AS equipe,
              (SELECT COUNT(DISTINCT d.id_ocorrencia)::int FROM distribuicao_ocorrencia d
                WHERE d.id_servico_diario = se.id_servico_diario AND d.id_equipe = se.id_equipe) AS ocorrencias,
              (SELECT COUNT(*)::int FROM checklist_fiscalizacao c
                WHERE c.id_servico_diario = se.id_servico_diario AND c.id_equipe = se.id_equipe) AS checklists
         FROM servico_equipe se JOIN equipe eq ON eq.id_equipe = se.id_equipe
        WHERE se.id_servico_diario = $1 ORDER BY eq.numero`, [id]);
    res.json({ ...s.rows[0], equipes: eqs.rows });
  } catch (e) {
    next(e);
  }
});

/*
 * Ficha do fiscal (08/10) - mesma tela de Detalhes do Motorista, com o que
 * e da Fiscalizacao: ocorrencias atendidas pelas equipes dele, checklists de
 * viatura que ele assinou, pontuacao (so para quem gerencia a pontuacao),
 * equipes, servicos que coordenou e o historico de atividades.
 *
 * Ocorrencia e pontuacao sao registradas por EQUIPE: entram as da equipe em
 * que o fiscal estava NAQUELE dia (data_inicio/data_fim do equipe_servidor).
 * Pontuacao lancada direto para o servidor tambem entra.
 */
router.get("/fiscais/:id/ficha", autenticar,
  exigePermissao(VER, "ADMIN_VISUALIZAR"),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const permissoes = req.usuario?.permissoes || [];
      const s = await query(
        `SELECT s.*, st.nome AS setor, c.nome AS cargo,
                (s.cnh_data_validade - CURRENT_DATE) AS cnh_dias
           FROM servidor s
           LEFT JOIN setor st ON st.id_setor = s.id_setor
           LEFT JOIN cargo c  ON c.id_cargo  = s.id_cargo
          WHERE s.id_servidor = $1`,
        [id]
      );
      const fiscal = s.rows[0];
      if (!fiscal) return res.status(404).json({ erro: "Fiscal não encontrado." });
      // Mesmo recorte da lista de servidores: quem so ve a Fiscalizacao
      // enxerga apenas o proprio setor.
      const amplo = permissoes.includes("ADMIN_VISUALIZAR") || permissoes.includes("FROTAS_VISUALIZAR");
      if (!amplo && String(fiscal.id_setor) !== String(req.usuario?.id_setor ?? -1)) {
        return res.status(403).json({ erro: "Este servidor é de outro setor." });
      }
      const vePontos = permissoes.includes("FISCALIZACAO_GERENCIAR_PONTUACAO");

      const usuario = await query(
        `SELECT u.login, u.status, u.ultimo_acesso, p.nome AS perfil
           FROM usuario u JOIN perfil p ON p.id_perfil = u.id_perfil
          WHERE u.id_servidor = $1`,
        [id]
      );

      const equipes = await query(
        `SELECT e.id_equipe, e.numero, e.tipo, es.data_inicio, es.data_fim,
                (es.status AND es.data_fim IS NULL) AS atual,
                (SELECT t.turno FROM equipe_turno t
                  WHERE t.id_equipe = e.id_equipe AND t.data_inicio <= CURRENT_DATE
                    AND (t.data_fim IS NULL OR t.data_fim >= CURRENT_DATE)
                  ORDER BY t.data_inicio DESC LIMIT 1) AS turno,
                (SELECT string_agg(sx.nome, ', ' ORDER BY sx.nome)
                   FROM equipe_servidor ex JOIN servidor sx ON sx.id_servidor = ex.id_servidor
                  WHERE ex.id_equipe = e.id_equipe AND ex.id_servidor <> $1
                    AND ex.status AND ex.data_fim IS NULL) AS colegas
           FROM equipe_servidor es
           JOIN equipe e ON e.id_equipe = es.id_equipe
          WHERE es.id_servidor = $1
          ORDER BY atual DESC, es.data_inicio DESC`,
        [id]
      );

      // Equipe do fiscal NAQUELE dia.
      const NA_EQUIPE = (dataCol, equipeCol) => `EXISTS (
        SELECT 1 FROM equipe_servidor es
         WHERE es.id_servidor = $1 AND es.id_equipe = ${equipeCol}
           AND es.data_inicio <= ${dataCol}
           AND (es.data_fim IS NULL OR es.data_fim >= ${dataCol}))`;

      const ocorrencias = await query(
        `SELECT DISTINCT ON (o.id_ocorrencia)
                o.id_ocorrencia, o.protocolo, o.tipo, o.data, o.hora, o.endereco,
                o.descricao, o.status, eq.numero AS equipe
           FROM ocorrencia o
           JOIN distribuicao_ocorrencia d ON d.id_ocorrencia = o.id_ocorrencia
           JOIN equipe eq ON eq.id_equipe = d.id_equipe
          WHERE ${NA_EQUIPE("d.data", "d.id_equipe")}
          ORDER BY o.id_ocorrencia, d.data DESC, d.hora DESC`,
        [id]
      );
      ocorrencias.rows.sort((a, b) =>
        String(b.data).localeCompare(String(a.data)) || String(b.hora).localeCompare(String(a.hora)));

      const checklists = await query(
        `SELECT c.id_checklist, c.data_abertura, c.hora_saida, c.hora_chegada, c.status,
                (c.odometro_chegada - c.odometro_saida) AS km_rodado, cs.tipo AS papel,
                v.placa, v.marca, v.modelo, eq.numero AS equipe
           FROM checklist_fiscal_servidor cs
           JOIN checklist_fiscalizacao c ON c.id_checklist = cs.id_checklist
           JOIN veiculo v ON v.id_veiculo = c.id_veiculo
           LEFT JOIN equipe eq ON eq.id_equipe = c.id_equipe
          WHERE cs.id_servidor = $1
          ORDER BY c.data_abertura DESC, c.hora_saida DESC
          LIMIT 200`,
        [id]
      );

      const pontuacao = vePontos ? await query(
        `SELECT r.id_pontuacao, r.data_registro, r.quantidade, r.pontos_aplicados, r.observacao,
                r.entidade_origem, i.codigo, i.nome AS item, eq.numero AS equipe,
                (r.id_servidor IS NOT NULL) AS individual
           FROM pontuacao_registro r
           JOIN pontuacao_item i ON i.id_item = r.id_item
           LEFT JOIN equipe eq ON eq.id_equipe = r.id_equipe
          WHERE r.id_servidor = $1
             OR (r.id_servidor IS NULL AND r.id_equipe IS NOT NULL
                 AND ${NA_EQUIPE("r.data_registro::date", "r.id_equipe")})
          ORDER BY r.data_registro DESC
          LIMIT 300`,
        [id]
      ) : null;

      const servicos = await query(
        `SELECT id_servico_diario, data, turno, status
           FROM servico_diario WHERE id_coordenador = $1
          ORDER BY data DESC LIMIT 100`,
        [id]
      );

      const cadastro = await query(
        `SELECT a.data_hora, a.acao, a.entidade, a.justificativa, COALESCE(sa.nome, ua.login) AS pessoa
           FROM auditoria a
           LEFT JOIN usuario ua ON ua.id_usuario = a.id_usuario
           LEFT JOIN servidor sa ON sa.id_servidor = ua.id_servidor
          WHERE (a.entidade = 'servidor' AND a.id_registro = $1)
             OR (a.entidade = 'usuario'
                 AND a.id_registro IN (SELECT id_usuario FROM usuario WHERE id_servidor = $1))
          ORDER BY a.data_hora DESC LIMIT 50`,
        [id]
      );

      // Sinistros em que o fiscal era o condutor (aba Sinistros, 18/10). Vem
      // aqui, e nao da rota de Frotas, porque quem so ve a Fiscalizacao nao
      // tem acesso a lista de sinistros de Frotas.
      const sinistros = await query(
        `SELECT x.id_sinistro, x.numero, x.data, x.tipo, x.status, v.placa, v.marca, v.modelo,
                -- Para o resumo ao lado da lista (26/10).
                x.hora, x.local, x.descricao, x.bo, x.houve_terceiros, x.gravidade_danos,
                x.orcamento_pecas, x.orcamento_mao_obra, x.orcamento_outros,
                (SELECT sr.nome FROM usuario ur JOIN servidor sr ON sr.id_servidor = ur.id_servidor
                  WHERE ur.id_usuario = x.id_responsavel) AS responsavel
           FROM sinistro x JOIN veiculo v ON v.id_veiculo = x.id_veiculo
          WHERE x.id_servidor = $1
          ORDER BY x.data DESC LIMIT 200`,
        [id]
      );

      const multasResumo = await query(
        `SELECT COUNT(*) FILTER (WHERE status <> 'CANCELADA')::int AS multas,
                COUNT(*) FILTER (WHERE status IN ('PENDENTE', 'EM_RECURSO'))::int AS multas_abertas,
                COALESCE(SUM(pontos) FILTER (WHERE status <> 'CANCELADA'
                  AND data >= CURRENT_DATE - INTERVAL '12 months'), 0)::int AS pontos_12m
           FROM multa WHERE id_servidor = $1`,
        [id]
      );

      const seisMeses = new Date();
      seisMeses.setMonth(seisMeses.getMonth() - 6);
      const recente = (d) => d && new Date(d) >= seisMeses;
      const soma = (lista) => lista.reduce((t, r) => t + Number(r.pontos_aplicados || 0), 0);

      res.json({
        ...fiscal,
        usuario: usuario.rows[0] || null,
        equipes: equipes.rows,
        ocorrencias: ocorrencias.rows,
        checklists: checklists.rows,
        pontuacao: pontuacao ? pontuacao.rows : null,
        servicos: servicos.rows,
        sinistros: sinistros.rows,
        cadastro: cadastro.rows,
        cnh_historico: await historicoCnh(id),
        cnh_arquivos: await arquivosCnh(id),
        resumo: {
          ocorrencias: ocorrencias.rows.length,
          ocorrencias_6m: ocorrencias.rows.filter((o) => recente(o.data)).length,
          checklists: checklists.rows.length,
          checklists_6m: checklists.rows.filter((c) => recente(c.data_abertura)).length,
          servicos: servicos.rows.length,
          sinistros: sinistros.rows.length,
          pontos: pontuacao ? soma(pontuacao.rows) : null,
          pontos_6m: pontuacao ? soma(pontuacao.rows.filter((r) => recente(r.data_registro))) : null,
          ...multasResumo.rows[0],
        },
      });
    } catch (e) {
      next(e);
    }
  });

/*
 * Ficha da equipe (09/10) - a tela de Detalhes da Equipe numa chamada so.
 *
 * O que o SITRA guarda da equipe: numero, tipo, situacao, observacoes, os
 * fiscais (equipe_servidor, com entrada e saida) e o turno (equipe_turno). O
 * resto vem do trabalho dela:
 *   - viaturas: as que a equipe usou (checklists de viatura) - a viatura nao
 *     e presa a equipe, entao a tela mostra as usadas, com quantas vezes;
 *   - ocorrencias: as distribuidas para a equipe;
 *   - servicos: os servicos diarios em que ela entrou (e quem coordenou);
 *   - pontuacao: a lancada para a equipe (so quem gerencia a pontuacao ve);
 *   - historico: criacao e alteracoes do cadastro e da composicao.
 */
router.get("/equipes/:id/ficha", autenticar, exigePermissao(VER), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const permissoes = req.usuario?.permissoes || [];
    const vePontos = permissoes.includes("FISCALIZACAO_GERENCIAR_PONTUACAO");

    const e = await query(
      `SELECT e.*,
              (SELECT t.turno FROM equipe_turno t
                WHERE t.id_equipe = e.id_equipe AND t.data_inicio <= CURRENT_DATE
                  AND (t.data_fim IS NULL OR t.data_fim >= CURRENT_DATE)
                ORDER BY t.data_inicio DESC LIMIT 1) AS turno,
              (SELECT MIN(a.data_hora) FROM auditoria a
                WHERE a.entidade = 'equipe' AND a.id_registro = e.id_equipe AND a.acao = 'CRIAR') AS criada_em,
              (SELECT MAX(a.data_hora) FROM auditoria a
                WHERE a.entidade IN ('equipe', 'equipe_servidor', 'equipe_turno') AND a.id_registro = e.id_equipe) AS atualizada_em
         FROM equipe e WHERE e.id_equipe = $1`,
      [id]
    );
    const equipe = e.rows[0];
    if (!equipe) return res.status(404).json({ erro: "Equipe não encontrada." });

    const fiscais = await query(
      `SELECT s.id_servidor, s.nome, s.matricula, s.status AS servidor_ativo, c.nome AS cargo,
              es.data_inicio, es.data_fim, (es.status AND es.data_fim IS NULL) AS atual
         FROM equipe_servidor es
         JOIN servidor s ON s.id_servidor = es.id_servidor
         LEFT JOIN cargo c ON c.id_cargo = s.id_cargo
        WHERE es.id_equipe = $1
        ORDER BY atual DESC, s.nome, es.data_inicio DESC`,
      [id]
    );

    const viaturas = await query(
      `SELECT v.id_veiculo, v.placa, v.marca, v.modelo, v.tipo_veiculo, v.status,
              COUNT(*)::int AS usos,
              COUNT(*) FILTER (WHERE c.data_abertura >= CURRENT_DATE - INTERVAL '6 months')::int AS usos_6m,
              MAX(c.data_abertura) AS ultimo_uso,
              COALESCE(SUM(GREATEST(c.odometro_chegada - c.odometro_saida, 0)), 0)::int AS km
         FROM checklist_fiscalizacao c
         JOIN veiculo v ON v.id_veiculo = c.id_veiculo
        WHERE c.id_equipe = $1
        GROUP BY v.id_veiculo
        ORDER BY MAX(c.data_abertura) DESC`,
      [id]
    );

    const ocorrencias = await query(
      `SELECT DISTINCT ON (o.id_ocorrencia)
              o.id_ocorrencia, o.protocolo, o.tipo, o.data, o.hora, o.endereco, o.status,
              v.placa AS viatura
         FROM distribuicao_ocorrencia d
         JOIN ocorrencia o ON o.id_ocorrencia = d.id_ocorrencia
         LEFT JOIN veiculo v ON v.id_veiculo = d.id_veiculo
        WHERE d.id_equipe = $1
        ORDER BY o.id_ocorrencia, d.data DESC, d.hora DESC`,
      [id]
    );
    ocorrencias.rows.sort((a, b) =>
      String(b.data).localeCompare(String(a.data)) || String(b.hora).localeCompare(String(a.hora)));

    const servicos = await query(
      `SELECT sd.id_servico_diario, sd.data, sd.turno, sd.status, se.status AS status_equipe,
              se.id_servico_equipe, se.numero AS codigo, ${SITUACAO_LINHA} AS situacao,
              v.id_veiculo, v.placa, v.marca, v.modelo,
              (SELECT COUNT(DISTINCT d.id_ocorrencia)::int FROM distribuicao_ocorrencia d
                WHERE d.id_servico_diario = se.id_servico_diario AND d.id_equipe = se.id_equipe AND d.status <> 'CANCELADA') AS ocorrencias,
              s.nome AS coordenador, s.matricula AS coordenador_matricula
         FROM servico_equipe se
         JOIN servico_diario sd ON sd.id_servico_diario = se.id_servico_diario
         LEFT JOIN veiculo v ON v.id_veiculo = COALESCE(
           (SELECT c.id_veiculo FROM checklist_fiscalizacao c WHERE c.id_servico_diario = se.id_servico_diario
             AND c.id_equipe = se.id_equipe ORDER BY c.id_checklist DESC LIMIT 1), se.id_veiculo)
         LEFT JOIN servidor s ON s.id_servidor = COALESCE(se.id_coordenador, sd.id_coordenador)
        WHERE se.id_equipe = $1
        ORDER BY sd.data DESC, sd.hora_inicio DESC NULLS LAST
        LIMIT 200`,
      [id]
    );

    const pontuacao = vePontos ? await query(
      `SELECT r.id_pontuacao, r.data_registro, r.quantidade, r.pontos_aplicados, r.observacao,
              i.codigo, i.nome AS item, s.nome AS servidor
         FROM pontuacao_registro r
         JOIN pontuacao_item i ON i.id_item = r.id_item
         LEFT JOIN servidor s ON s.id_servidor = r.id_servidor
        WHERE r.id_equipe = $1
        ORDER BY r.data_registro DESC
        LIMIT 300`,
      [id]
    ) : null;

    const historico = await query(
      `SELECT a.data_hora, a.acao, a.entidade, a.justificativa, a.dados_anteriores, a.dados_novos,
              COALESCE(sa.nome, ua.login) AS pessoa
         FROM auditoria a
         LEFT JOIN usuario ua ON ua.id_usuario = a.id_usuario
         LEFT JOIN servidor sa ON sa.id_servidor = ua.id_servidor
        WHERE a.entidade IN ('equipe', 'equipe_servidor', 'equipe_turno') AND a.id_registro = $1
        ORDER BY a.data_hora DESC LIMIT 100`,
      [id]
    );

    const seisMeses = new Date();
    seisMeses.setMonth(seisMeses.getMonth() - 6);
    const recente = (d) => d && new Date(d) >= seisMeses;
    const soma = (lista) => lista.reduce((t, r) => t + Number(r.pontos_aplicados || 0), 0);
    const ultimoServico = servicos.rows[0] || null;

    res.json({
      ...equipe,
      ultimo_servico: ultimoServico,
      fiscais: fiscais.rows,
      viaturas: viaturas.rows,
      ocorrencias: ocorrencias.rows,
      servicos: servicos.rows,
      pontuacao: pontuacao ? pontuacao.rows : null,
      historico: historico.rows,
      resumo: {
        fiscais_ativos: fiscais.rows.filter((f) => f.atual).length,
        viaturas: viaturas.rows.length,
        viaturas_6m: viaturas.rows.filter((v) => v.usos_6m > 0).length,
        ocorrencias: ocorrencias.rows.length,
        ocorrencias_6m: ocorrencias.rows.filter((o) => recente(o.data)).length,
        servicos: servicos.rows.length,
        servicos_6m: servicos.rows.filter((s) => recente(s.data)).length,
        pontos: pontuacao ? soma(pontuacao.rows) : null,
        pontos_6m: pontuacao ? soma(pontuacao.rows.filter((r) => recente(r.data_registro))) : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Servico por equipe (21/10) antes do CRUD: rotas /equipe, /ocorrencias-disponiveis, /fotos.
router.use("/servico-diario", servicoEquipe);
router.use("/servico-diario", servicoDiario);
router.use("/equipes", equipes);
router.use("/apoios", apoios);
router.use("/ocorrencias", ocorrencias);
router.use("/checklists", checklistsFiscalizacao);
router.use("/pontuacao", pontuacaoItens);
router.use("/equipamentos", equipamentosFisc);

export default router;
