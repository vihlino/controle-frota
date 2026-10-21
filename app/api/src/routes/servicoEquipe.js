/**
 * servicoEquipe.js - Servico diario POR EQUIPE (pedido do Cesar, 21/10).
 *
 * "Sera aberto o servico diario para equipe, nao sera permitido selecionar
 * mais de 1 equipe por vez" e as ocorrencias sao designadas ja na abertura.
 * Nao ha mais o passo "Iniciar servico": a equipe entra em servico quando toca
 * em "Continuar" no checklist da viatura (QR Code) e sai quando finaliza.
 *
 * O servico do dia/turno (servico_diario) continua como agrupador: abrir o
 * servico de uma equipe usa o do dia/turno que ainda nao foi encerrado ou cria
 * um. O coordenador e escolhido no formulario (21/10: "todo dia ira mudar")
 * e fica no servico da equipe (servico_equipe.id_coordenador, migracao 046).
 * Cada equipe no servico (servico_equipe) tem o seu codigo SD, a viatura, a
 * equipe de apoio, observacoes e fotos.
 *
 * Montado em /api/fiscalizacao/servico-diario (antes do CRUD do servico).
 */
import { Router, json } from "express";
import { pool, query } from "../db.js";
import { autenticar, exigePermissao } from "../auth.js";
import { registrarAuditoria } from "../auditoria.js";

const router = Router();
const VER = "FISCALIZACAO_VISUALIZAR";
const GERENCIAR = "FISCALIZACAO_GERENCIAR_SERVICO";
const HORA_DO_TURNO = { DIURNO: "06:00", NOTURNO: "19:00" };
// Ocorrencias que podem ser designadas: todas menos as finalizadas.
// Intercorrencia volta para a lista: precisa de outra equipe.
const DESIGNAVEIS = ["PENDENTE", "ATRIBUIDA", "EM_ANDAMENTO", "INTERCORRENCIA"];
const MAX_FOTOS = 6;
const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"];

const hojeBr = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/** Valida o corpo do formulario. */
function lerCorpo(b) {
  const data = String(b?.data || "").slice(0, 10);
  const turno = String(b?.turno || "").toUpperCase();
  const idEquipe = Number(b?.id_equipe);
  const idVeiculo = Number(b?.id_veiculo);
  const apoio = b?.id_equipe_apoio ? Number(b.id_equipe_apoio) : null;
  const idCoordenador = Number(b?.id_coordenador);
  const ocorrencias = [...new Set((Array.isArray(b?.ocorrencias) ? b.ocorrencias : []).map(Number))]
    .filter((n) => Number.isInteger(n) && n > 0);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { erro: "Informe a data do serviço." };
  if (!HORA_DO_TURNO[turno]) return { erro: "Escolha o turno: Diurno ou Noturno." };
  if (!Number.isInteger(idEquipe) || idEquipe <= 0) return { erro: "Escolha a equipe." };
  if (!Number.isInteger(idVeiculo) || idVeiculo <= 0) return { erro: "Escolha a viatura." };
  if (!Number.isInteger(idCoordenador) || idCoordenador <= 0) return { erro: "Escolha o coordenador do serviço." };
  if (apoio && apoio === idEquipe) return { erro: "A equipe de apoio precisa ser outra equipe." };
  return {
    data, turno, idEquipe, idVeiculo, apoio, ocorrencias, idCoordenador,
    observacoes: String(b?.observacoes || "").trim().slice(0, 1000) || null,
  };
}

/** O servico do dia/turno ainda aberto, ou um novo (com o coordenador escolhido). */
async function servicoDoTurno(cliente, data, turno, idUsuario, idCoordenador) {
  // Ha um so servico por dia/turno (uq_servico_diario_data_turno). Se ele ja
  // foi encerrado (todas as equipes tinham terminado), volta a ficar aberto
  // para a equipe nova.
  const ja = await cliente.query(
    `SELECT id_servico_diario, id_coordenador, status FROM servico_diario
      WHERE data = $1 AND turno = $2 ORDER BY id_servico_diario LIMIT 1 FOR UPDATE`, [data, turno]);
  if (ja.rows[0]) {
    if (ja.rows[0].status === "ENCERRADO") {
      await cliente.query(
        "UPDATE servico_diario SET status = 'ABERTO', hora_encerramento = NULL, encerrado_por = NULL WHERE id_servico_diario = $1",
        [ja.rows[0].id_servico_diario]);
    }
    return ja.rows[0];
  }
  let coord = idCoordenador || (await cliente.query("SELECT id_servidor FROM usuario WHERE id_usuario = $1", [idUsuario])).rows[0]?.id_servidor;
  if (!coord) {
    coord = (await cliente.query("SELECT id_coordenador FROM servico_diario ORDER BY id_servico_diario DESC LIMIT 1")).rows[0]?.id_coordenador;
  }
  if (!coord) throw Object.assign(new Error("Seu usuário não está ligado a um servidor para coordenar o serviço."), { status: 400 });
  const novo = await cliente.query(
    `INSERT INTO servico_diario (data, turno, id_coordenador, criado_por, hora_inicio, status)
     VALUES ($1,$2,$3,$4,$5,'ABERTO') RETURNING id_servico_diario, id_coordenador`,
    [data, turno, coord, idUsuario, HORA_DO_TURNO[turno]]);
  return novo.rows[0];
}

/** Confere equipe, viatura e apoio; devolve a mensagem de erro ou null. */
async function conferir(cliente, c, idServicoDiario, idSe = 0) {
  const eq = (await cliente.query("SELECT numero, status FROM equipe WHERE id_equipe = $1", [c.idEquipe])).rows[0];
  if (!eq || !eq.status) return "Equipe não encontrada ou inativa.";
  const v = (await cliente.query("SELECT placa, viatura, status FROM veiculo WHERE id_veiculo = $1", [c.idVeiculo])).rows[0];
  if (!v || !v.viatura) return "Escolha uma viatura da Fiscalização.";
  if (v.status === "INATIVO") return `A viatura ${v.placa} está indisponível.`;
  const co = (await cliente.query("SELECT status FROM servidor WHERE id_servidor = $1", [c.idCoordenador])).rows[0];
  if (!co || !co.status) return "Coordenador não encontrado ou inativo.";
  if (c.apoio) {
    const ap = (await cliente.query("SELECT status FROM equipe WHERE id_equipe = $1", [c.apoio])).rows[0];
    if (!ap || !ap.status) return "Equipe de apoio não encontrada ou inativa.";
  }
  const dupla = await cliente.query(
    `SELECT se.numero FROM servico_equipe se
      WHERE se.id_servico_diario = $1 AND se.id_equipe = $2 AND se.status <> 'CANCELADA' AND se.id_servico_equipe <> $3`,
    [idServicoDiario, c.idEquipe, idSe]);
  if (dupla.rows[0]) return `A equipe ${eq.numero} já tem serviço neste dia e turno (${dupla.rows[0].numero}).`;
  const viaturaOcupada = await cliente.query(
    `SELECT se.numero, e.numero AS equipe FROM servico_equipe se JOIN equipe e ON e.id_equipe = se.id_equipe
      JOIN servico_diario sd ON sd.id_servico_diario = se.id_servico_diario
      WHERE sd.data = (SELECT data FROM servico_diario WHERE id_servico_diario = $1)
        AND sd.turno = (SELECT turno FROM servico_diario WHERE id_servico_diario = $1)
        AND se.id_veiculo = $2 AND se.status IN ('ATIVA', 'EM_SERVICO') AND se.id_servico_equipe <> $3`,
    [idServicoDiario, c.idVeiculo, idSe]);
  if (viaturaOcupada.rows[0]) {
    return `A viatura ${v.placa} já está no serviço ${viaturaOcupada.rows[0].numero} (${viaturaOcupada.rows[0].equipe}) neste dia e turno.`;
  }
  return null;
}

/**
 * Designa as ocorrencias marcadas para a equipe do servico e tira as
 * desmarcadas (que ainda nao foram finalizadas).
 */
async function designar(cliente, se, marcadas, idCoordenador, codigo) {
  const atuais = (await cliente.query(
    `SELECT d.id_distribuicao, d.id_ocorrencia, o.status FROM distribuicao_ocorrencia d
       JOIN ocorrencia o ON o.id_ocorrencia = d.id_ocorrencia
      WHERE d.id_servico_diario = $1 AND d.id_equipe = $2 AND d.status = 'ATIVA'`,
    [se.id_servico_diario, se.id_equipe])).rows;
  const { data, hora } = { data: hojeBr(), hora: new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }) };
  // Desmarcadas: a distribuicao e cancelada; sem outra, a ocorrencia volta a Pendente.
  for (const d of atuais) {
    if (marcadas.includes(Number(d.id_ocorrencia))) continue;
    await cliente.query("UPDATE distribuicao_ocorrencia SET status = 'CANCELADA' WHERE id_distribuicao = $1", [d.id_distribuicao]);
    if (["ATRIBUIDA", "EM_ANDAMENTO"].includes(d.status)) {
      await cliente.query("UPDATE ocorrencia SET status = 'PENDENTE' WHERE id_ocorrencia = $1", [d.id_ocorrencia]);
    }
  }
  const ja = atuais.map((d) => Number(d.id_ocorrencia));
  for (const idOc of marcadas) {
    if (ja.includes(idOc)) continue;
    const oc = (await cliente.query("SELECT protocolo, status FROM ocorrencia WHERE id_ocorrencia = $1 FOR UPDATE", [idOc])).rows[0];
    if (!oc || !DESIGNAVEIS.includes(oc.status)) continue;
    // Estava com outra equipe: aquela distribuicao e cancelada e esta vira reatribuicao.
    const outra = await cliente.query(
      "UPDATE distribuicao_ocorrencia SET status = 'CANCELADA' WHERE id_ocorrencia = $1 AND status = 'ATIVA' RETURNING id_distribuicao", [idOc]);
    const reatribuicao = outra.rowCount > 0;
    await cliente.query(
      `INSERT INTO distribuicao_ocorrencia (id_ocorrencia, id_servico_diario, id_equipe, id_veiculo, id_coordenador,
         data, hora, tipo, motivo_reatribuicao, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ATIVA')`,
      [idOc, se.id_servico_diario, se.id_equipe, se.id_veiculo, idCoordenador, data, hora,
       reatribuicao ? "REATRIBUICAO" : "ATRIBUICAO", reatribuicao ? `Designada no serviço ${codigo}.` : null]);
    if (["PENDENTE", "INTERCORRENCIA"].includes(oc.status)) {
      await cliente.query("UPDATE ocorrencia SET status = 'ATRIBUIDA' WHERE id_ocorrencia = $1", [idOc]);
    }
  }
}

// Coordenador do servico do dia/turno, se ja existe (o formulario sugere).
router.get("/coordenador-do-turno", autenticar, exigePermissao(VER), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT COALESCE(se.id_coordenador, sd.id_coordenador) AS id_coordenador
         FROM servico_diario sd LEFT JOIN servico_equipe se ON se.id_servico_diario = sd.id_servico_diario
        WHERE sd.data = $1 AND sd.turno = $2
        ORDER BY se.criado_em DESC NULLS LAST LIMIT 1`, [String(req.query.data || "").slice(0, 10), String(req.query.turno || "").toUpperCase()]);
    res.json({ id_coordenador: rows[0]?.id_coordenador ?? null });
  } catch (e) {
    next(e);
  }
});

// ------------------------------------------------- ocorrencias disponiveis
router.get("/ocorrencias-disponiveis", autenticar, exigePermissao(VER), async (req, res, next) => {
  try {
    const idSe = Number(req.query.servico) || 0;
    const { rows } = await query(
      `SELECT o.id_ocorrencia, o.protocolo, o.tipo, o.categoria, o.descricao, o.endereco, o.bairro,
              o.data, o.hora, o.status,
              d.id_equipe AS equipe_atual_id, eq.numero AS equipe_atual,
              se.id_servico_equipe AS servico_atual
         FROM ocorrencia o
         LEFT JOIN distribuicao_ocorrencia d ON d.id_ocorrencia = o.id_ocorrencia AND d.status = 'ATIVA'
         LEFT JOIN equipe eq ON eq.id_equipe = d.id_equipe
         LEFT JOIN servico_equipe se ON se.id_servico_diario = d.id_servico_diario AND se.id_equipe = d.id_equipe
        WHERE o.status = ANY($1::text[])
           OR (se.id_servico_equipe = $2 AND o.status <> 'FINALIZADA')
        ORDER BY (se.id_servico_equipe = $2) DESC NULLS LAST, o.data DESC, o.hora DESC
        LIMIT 300`, [DESIGNAVEIS, idSe]);
    res.json(rows.map((r) => ({ ...r, marcada: r.servico_atual === idSe && idSe > 0 })));
  } catch (e) {
    next(e);
  }
});

// -------------------------------------------- um servico para o formulario
router.get("/equipe/:id", autenticar, exigePermissao(VER), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT se.*, COALESCE(se.id_coordenador, sd.id_coordenador) AS id_coordenador, sd.data, sd.turno, sd.status AS status_servico,
              (SELECT COALESCE(json_agg(d.id_ocorrencia), '[]') FROM distribuicao_ocorrencia d
                WHERE d.id_servico_diario = se.id_servico_diario AND d.id_equipe = se.id_equipe AND d.status = 'ATIVA') AS ocorrencias,
              (SELECT COUNT(*)::int FROM checklist_fiscalizacao c
                WHERE c.id_servico_diario = se.id_servico_diario AND c.id_equipe = se.id_equipe) AS checklists,
              (SELECT COUNT(*)::int FROM servico_equipe_foto f WHERE f.id_servico_equipe = se.id_servico_equipe) AS fotos
         FROM servico_equipe se JOIN servico_diario sd ON sd.id_servico_diario = se.id_servico_diario
        WHERE se.id_servico_equipe = $1`, [Number(req.params.id)]);
    if (!rows[0]) return res.status(404).json({ erro: "Serviço não encontrado." });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// ------------------------------------------------------------ novo servico
router.post("/equipe", autenticar, exigePermissao(GERENCIAR), async (req, res, next) => {
  const c = lerCorpo(req.body);
  if (c.erro) return res.status(400).json({ erro: c.erro });
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    const sd = await servicoDoTurno(cliente, c.data, c.turno, req.usuario.id_usuario, c.idCoordenador);
    const problema = await conferir(cliente, c, sd.id_servico_diario);
    if (problema) { await cliente.query("ROLLBACK"); return res.status(409).json({ erro: problema }); }
    // Equipe que tinha sido cancelada neste servico volta (a chave e unica).
    const { rows } = await cliente.query(
      `INSERT INTO servico_equipe (id_servico_diario, id_equipe, status, id_veiculo, id_equipe_apoio, observacoes, criado_por, criado_em, id_coordenador)
       VALUES ($1,$2,'ATIVA',$3,$4,$5,$6,CURRENT_TIMESTAMP,$7)
       ON CONFLICT (id_servico_diario, id_equipe) DO UPDATE
         SET status = 'ATIVA', id_veiculo = EXCLUDED.id_veiculo, id_equipe_apoio = EXCLUDED.id_equipe_apoio,
             id_coordenador = EXCLUDED.id_coordenador,
             observacoes = EXCLUDED.observacoes, criado_por = EXCLUDED.criado_por, criado_em = CURRENT_TIMESTAMP,
             hora_inicio = NULL, hora_fim = NULL
       RETURNING *`,
      [sd.id_servico_diario, c.idEquipe, c.idVeiculo, c.apoio, c.observacoes, req.usuario.id_usuario, c.idCoordenador]);
    const se = rows[0];
    await designar(cliente, se, c.ocorrencias, c.idCoordenador, se.numero);
    await cliente.query("COMMIT");
    await registrarAuditoria({
      idUsuario: req.usuario.id_usuario, acao: "CRIAR", entidade: "servico_equipe", idRegistro: se.id_servico_equipe,
      dadosNovos: { ...se, ocorrencias: c.ocorrencias },
    });
    res.status(201).json({ id_servico_equipe: se.id_servico_equipe, numero: se.numero });
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    if (e.status) return res.status(e.status).json({ erro: e.message });
    next(e);
  } finally {
    cliente.release();
  }
});

// --------------------------------------------------------- editar servico
router.put("/equipe/:id", autenticar, exigePermissao(GERENCIAR), async (req, res, next) => {
  const c = lerCorpo(req.body);
  if (c.erro) return res.status(400).json({ erro: c.erro });
  const id = Number(req.params.id);
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    const antes = (await cliente.query(
      `SELECT se.*, sd.data, sd.turno, sd.id_coordenador FROM servico_equipe se
         JOIN servico_diario sd ON sd.id_servico_diario = se.id_servico_diario
        WHERE se.id_servico_equipe = $1 FOR UPDATE OF se`, [id])).rows[0];
    if (!antes) { await cliente.query("ROLLBACK"); return res.status(404).json({ erro: "Serviço não encontrado." }); }
    if (["FINALIZADA", "CANCELADA"].includes(antes.status)) {
      await cliente.query("ROLLBACK");
      return res.status(400).json({ erro: "Este serviço já foi encerrado ou cancelado; não muda mais." });
    }
    const usou = Number((await cliente.query(
      "SELECT COUNT(*) FROM checklist_fiscalizacao WHERE id_servico_diario = $1 AND id_equipe = $2",
      [antes.id_servico_diario, antes.id_equipe])).rows[0].count) > 0;
    const mudouDia = String(antes.data).slice(0, 10) !== c.data;
    const mudouBase = mudouDia || antes.turno !== c.turno || Number(antes.id_equipe) !== c.idEquipe;
    if (usou && mudouBase) {
      await cliente.query("ROLLBACK");
      return res.status(400).json({ erro: "A equipe já fez o checklist neste serviço: data, turno e equipe não mudam mais." });
    }
    let idSd = antes.id_servico_diario;
    const coord = c.idCoordenador;
    if (mudouDia || antes.turno !== c.turno) {
      const sd = await servicoDoTurno(cliente, c.data, c.turno, req.usuario.id_usuario, c.idCoordenador);
      idSd = sd.id_servico_diario;
    }
    const problema = await conferir(cliente, c, idSd, id);
    if (problema) { await cliente.query("ROLLBACK"); return res.status(409).json({ erro: problema }); }
    // Mudou o servico do turno ou a equipe: as distribuicoes ativas acompanham.
    if (idSd !== antes.id_servico_diario || Number(antes.id_equipe) !== c.idEquipe) {
      await cliente.query(
        `UPDATE distribuicao_ocorrencia SET id_servico_diario = $3, id_equipe = $4
          WHERE id_servico_diario = $1 AND id_equipe = $2 AND status = 'ATIVA'`,
        [antes.id_servico_diario, antes.id_equipe, idSd, c.idEquipe]);
    }
    const { rows } = await cliente.query(
      `UPDATE servico_equipe SET id_servico_diario = $2, id_equipe = $3, id_veiculo = $4, id_equipe_apoio = $5, observacoes = $6,
              id_coordenador = $7
        WHERE id_servico_equipe = $1 RETURNING *`,
      [id, idSd, c.idEquipe, c.idVeiculo, c.apoio, c.observacoes, c.idCoordenador]);
    const se = rows[0];
    if (Number(antes.id_veiculo) !== c.idVeiculo) {
      await cliente.query(
        "UPDATE distribuicao_ocorrencia SET id_veiculo = $3 WHERE id_servico_diario = $1 AND id_equipe = $2 AND status = 'ATIVA'",
        [idSd, c.idEquipe, c.idVeiculo]);
    }
    await designar(cliente, se, c.ocorrencias, coord, se.numero);
    await cliente.query("COMMIT");
    await registrarAuditoria({
      idUsuario: req.usuario.id_usuario, acao: "EDITAR", entidade: "servico_equipe", idRegistro: id,
      dadosAnteriores: antes, dadosNovos: { ...se, ocorrencias: c.ocorrencias },
    });
    res.json({ id_servico_equipe: id, numero: se.numero });
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    if (e.status) return res.status(e.status).json({ erro: e.message });
    next(e);
  } finally {
    cliente.release();
  }
});

// ------------------------------------- encerrar (em servico) ou cancelar
router.put("/equipe/:id/situacao", autenticar, exigePermissao(GERENCIAR), async (req, res, next) => {
  const id = Number(req.params.id);
  const acao = String(req.body?.acao || "").toUpperCase();
  if (!["ENCERRAR", "CANCELAR"].includes(acao)) return res.status(400).json({ erro: "Ação inválida." });
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    const se = (await cliente.query("SELECT * FROM servico_equipe WHERE id_servico_equipe = $1 FOR UPDATE", [id])).rows[0];
    if (!se) { await cliente.query("ROLLBACK"); return res.status(404).json({ erro: "Serviço não encontrado." }); }
    if (acao === "CANCELAR" && se.status !== "ATIVA") {
      await cliente.query("ROLLBACK"); return res.status(400).json({ erro: "Só um serviço que ainda não começou pode ser cancelado." });
    }
    if (acao === "ENCERRAR" && !["ATIVA", "EM_SERVICO"].includes(se.status)) {
      await cliente.query("ROLLBACK"); return res.status(400).json({ erro: "Este serviço já foi encerrado ou cancelado." });
    }
    const agora = new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
    if (acao === "CANCELAR") {
      await cliente.query("UPDATE servico_equipe SET status = 'CANCELADA' WHERE id_servico_equipe = $1", [id]);
      // As ocorrencias designadas voltam para Pendente.
      const ds = await cliente.query(
        `UPDATE distribuicao_ocorrencia SET status = 'CANCELADA'
          WHERE id_servico_diario = $1 AND id_equipe = $2 AND status = 'ATIVA' RETURNING id_ocorrencia`,
        [se.id_servico_diario, se.id_equipe]);
      for (const d of ds.rows) {
        await cliente.query("UPDATE ocorrencia SET status = 'PENDENTE' WHERE id_ocorrencia = $1 AND status IN ('ATRIBUIDA', 'EM_ANDAMENTO')", [d.id_ocorrencia]);
      }
    } else {
      await cliente.query("UPDATE servico_equipe SET status = 'FINALIZADA', hora_fim = $2::time WHERE id_servico_equipe = $1", [id, agora]);
    }
    await fecharTurnoSeAcabou(cliente, se.id_servico_diario, req.usuario.id_usuario);
    await cliente.query("COMMIT");
    await registrarAuditoria({
      idUsuario: req.usuario.id_usuario, acao: "EDITAR", entidade: "servico_equipe", idRegistro: id,
      dadosAnteriores: { status: se.status }, dadosNovos: { status: acao === "CANCELAR" ? "CANCELADA" : "FINALIZADA" },
      justificativa: acao === "CANCELAR" ? "Serviço cancelado." : "Serviço encerrado.",
    });
    res.json({ ok: true });
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    next(e);
  } finally {
    cliente.release();
  }
});

/** Sem equipe aberta ou em servico, o servico do dia/turno e encerrado. */
export async function fecharTurnoSeAcabou(cliente, idServicoDiario, idUsuario = null) {
  const aberta = await cliente.query(
    "SELECT 1 FROM servico_equipe WHERE id_servico_diario = $1 AND status IN ('ATIVA', 'EM_SERVICO') LIMIT 1", [idServicoDiario]);
  if (aberta.rows[0]) return;
  const agora = new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  await cliente.query(
    `UPDATE servico_diario SET status = 'ENCERRADO', hora_encerramento = $2::time, encerrado_por = COALESCE($3, encerrado_por)
      WHERE id_servico_diario = $1 AND status <> 'ENCERRADO'`, [idServicoDiario, agora, idUsuario]);
}

// ------------------------------------------------------------------ fotos
const corpoDeFotos = json({ limit: "12mb" });
router.post("/equipe/:id/fotos", corpoDeFotos, autenticar, exigePermissao(GERENCIAR), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const fotos = Array.isArray(req.body?.fotos) ? req.body.fotos : [];
    if (!fotos.length) return res.status(400).json({ erro: "Nenhuma foto recebida." });
    const se = (await query("SELECT 1 FROM servico_equipe WHERE id_servico_equipe = $1", [id])).rows[0];
    if (!se) return res.status(404).json({ erro: "Serviço não encontrado." });
    const ja = Number((await query("SELECT COUNT(*) FROM servico_equipe_foto WHERE id_servico_equipe = $1", [id])).rows[0].count);
    if (ja + fotos.length > MAX_FOTOS) return res.status(400).json({ erro: `No máximo ${MAX_FOTOS} fotos por serviço.` });
    for (const f of fotos) {
      const m = /^data:([a-z/+.-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(String(f?.dataUrl || "").trim());
      if (!m || !TIPOS_FOTO.includes(m[1].toLowerCase())) return res.status(400).json({ erro: "Envie fotos em JPG, PNG ou WebP." });
      const buffer = Buffer.from(m[2], "base64");
      if (!buffer.length || buffer.length > 3 * 1024 * 1024) return res.status(400).json({ erro: "Cada foto precisa ter até 3 MB." });
      await query(
        "INSERT INTO servico_equipe_foto (id_servico_equipe, nome, tipo, bytes, conteudo, enviado_por) VALUES ($1,$2,$3,$4,$5,$6)",
        [id, String(f.nome || "foto").slice(0, 255), m[1].toLowerCase(), buffer.length, buffer, req.usuario.id_usuario]);
    }
    res.status(201).json({ ok: true });
  } catch (e) {
    next(e);
  }
});
router.get("/equipe/:id/fotos", autenticar, exigePermissao(VER), async (req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT id_foto, nome, tipo, bytes, criado_em FROM servico_equipe_foto WHERE id_servico_equipe = $1 ORDER BY id_foto",
      [Number(req.params.id)]);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});
router.get("/fotos/:idFoto", autenticar, exigePermissao(VER), async (req, res, next) => {
  try {
    const { rows } = await query("SELECT tipo, conteudo FROM servico_equipe_foto WHERE id_foto = $1", [Number(req.params.idFoto)]);
    if (!rows[0]) return res.status(404).json({ erro: "Foto não encontrada." });
    res.setHeader("Content-Type", rows[0].tipo);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(rows[0].conteudo);
  } catch (e) {
    next(e);
  }
});
router.delete("/fotos/:idFoto", autenticar, exigePermissao(GERENCIAR), async (req, res, next) => {
  try {
    const r = await query("DELETE FROM servico_equipe_foto WHERE id_foto = $1 RETURNING id_servico_equipe", [Number(req.params.idFoto)]);
    if (!r.rowCount) return res.status(404).json({ erro: "Foto não encontrada." });
    await registrarAuditoria({ idUsuario: req.usuario.id_usuario, acao: "EXCLUIR", entidade: "servico_equipe_foto",
      idRegistro: Number(req.params.idFoto), dadosAnteriores: r.rows[0] });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

export default router;
