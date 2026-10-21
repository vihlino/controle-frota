/**
 * equipamentosFisc.js - Fiscalizacao > Equipamentos (pedido do Cesar, 21/10).
 *
 * "Faz uma aba no menu Equipamentos e e la que sera salvo tudo, com historico
 * e informacoes dos checklist." Quatro partes:
 *   - Viaturas:      a quantidade de cada item em cada viatura
 *                    (veiculo_equipamento). E ela que o checklist do QR Code
 *                    confere na saida e na chegada.
 *   - Conferencias:  o que saiu e o que voltou em cada checklist, com as
 *                    pendencias (voltou menos do que saiu, saiu menos do que
 *                    a viatura tem, item obrigatorio ausente).
 *   - Itens:         o cadastro dos itens e como cada um e conferido:
 *                    QUANTIDADE (salva por viatura), POR_FISCAL (Radio, um
 *                    para cada fiscal) ou OBRIGATORIO (presente/ausente).
 *   - Historico:     toda mudanca de quantidade ou de item, com quem e quando.
 *
 * 21/10 (2a parte) - CONTROLE DE ESTOQUE ("anda sumindo muito cone"): a tela
 * principal e por item. Cada item tem entradas e baixas (equipamento_movimento,
 * migracao 046) e as retiradas/devolucoes dos checklists da viatura: saiu 50,
 * voltou 45 = faltam 5, com os fiscais daquele checklist como responsaveis.
 *   cadastrado = entradas - baixas
 *   em uso     = o que saiu nos checklists ainda abertos
 *   faltando   = soma de (saiu - voltou) nos checklists finalizados
 *   disponivel = cadastrado - em uso - faltando
 *
 * Montado em /api/fiscalizacao/equipamentos (routes/fiscalizacao.js).
 */
import { Router } from "express";
import { pool, query } from "../db.js";
import { autenticar, exigePermissao } from "../auth.js";
import { registrarAuditoria } from "../auditoria.js";

const router = Router();
const VER = "FISCALIZACAO_VISUALIZAR";
const GERENCIAR = "FISCALIZACAO_GERENCIAR_VIATURAS";
const CONFERENCIAS = ["QUANTIDADE", "POR_FISCAL", "OBRIGATORIO"];
const ROTULO_CONF = { QUANTIDADE: "Quantidade da viatura", POR_FISCAL: "Um por fiscal", OBRIGATORIO: "Obrigatório (presente/ausente)" };

function paginacao(q) {
  const pagina = Math.max(Number(q.pagina) || 1, 1);
  const porPagina = Math.min(Math.max(Number(q.porPagina) || 10, 1), 100);
  return { pagina, porPagina, limite: `LIMIT ${porPagina} OFFSET ${(pagina - 1) * porPagina}` };
}
const resposta = (itens, total, p) =>
  ({ itens, total, pagina: p.pagina, porPagina: p.porPagina, paginas: Math.max(Math.ceil(total / p.porPagina), 1) });

/** Previsto de um item numa viatura, pela forma de conferencia. */
export function previstoDoItem(item, quantidadeSalva, fiscais = 2) {
  if (item.conferencia === "POR_FISCAL") return fiscais;
  if (item.conferencia === "OBRIGATORIO") return 1;
  return Number(quantidadeSalva) || 0;
}

/**
 * Pendencias de um checklist: compara o que saiu com o que a viatura tem e
 * o que voltou com o que saiu.
 */
function pendenciasDe(itens, linhas, fiscais, finalizado) {
  const p = [];
  for (const it of itens) {
    const saida = linhas.find((l) => String(l.id_equipamento) === String(it.id_equipamento) && l.etapa === "SAIDA");
    const chegada = linhas.find((l) => String(l.id_equipamento) === String(it.id_equipamento) && l.etapa === "CHEGADA");
    if (!saida) continue;
    const previsto = previstoDoItem(it, it.quantidade, fiscais);
    if (it.conferencia === "OBRIGATORIO") {
      if (saida.quantidade < 1) p.push(`${it.nome}: ausente na saída`);
      else if (finalizado && chegada && chegada.quantidade < 1) p.push(`${it.nome}: ausente na chegada`);
      continue;
    }
    if (saida.quantidade < previsto) p.push(`${it.nome}: saiu ${saida.quantidade} de ${previsto}`);
    if (finalizado && chegada && chegada.quantidade < saida.quantidade) {
      p.push(`${it.nome}: saiu ${saida.quantidade}, voltou ${chegada.quantidade}`);
    }
  }
  return p;
}

async function historico(cliente, h) {
  await cliente.query(
    `INSERT INTO equipamento_historico (id_equipamento, id_veiculo, tipo, quantidade_anterior, quantidade_nova,
       descricao, motivo, alterado_por) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [h.id_equipamento, h.id_veiculo ?? null, h.tipo, h.anterior ?? null, h.nova ?? null,
     h.descricao ?? null, h.motivo ?? null, h.usuario ?? null]);
}

// ------------------------------------------------------------------ itens
router.get("/itens", autenticar, exigePermissao(VER), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT e.id_equipamento, e.nome, e.descricao, e.status, e.conferencia, e.ordem,
              COALESCE((SELECT SUM(ve.quantidade) FROM veiculo_equipamento ve
                          JOIN veiculo v ON v.id_veiculo = ve.id_veiculo AND v.viatura
                         WHERE ve.id_equipamento = e.id_equipamento), 0)::int AS total_viaturas,
              (SELECT COUNT(*) FROM veiculo_equipamento ve
                 JOIN veiculo v ON v.id_veiculo = ve.id_veiculo AND v.viatura
                WHERE ve.id_equipamento = e.id_equipamento AND ve.quantidade > 0)::int AS viaturas_com
         FROM equipamento e
        ORDER BY e.status DESC, e.ordem NULLS LAST, e.nome`);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

function lerItem(body) {
  const nome = String(body?.nome || "").trim().slice(0, 100);
  const descricao = String(body?.descricao || "").trim().slice(0, 500) || null;
  const conferencia = String(body?.conferencia || "QUANTIDADE").toUpperCase();
  if (nome.length < 2) return { erro: "Informe o nome do item." };
  if (!CONFERENCIAS.includes(conferencia)) return { erro: "Escolha como o item é conferido." };
  return { nome, descricao, conferencia };
}

router.post("/itens", autenticar, exigePermissao(GERENCIAR), async (req, res, next) => {
  const cliente = await pool.connect();
  try {
    const item = lerItem(req.body);
    if (item.erro) return res.status(400).json({ erro: item.erro });
    await cliente.query("BEGIN");
    const ja = await cliente.query("SELECT 1 FROM equipamento WHERE lower(nome) = lower($1)", [item.nome]);
    if (ja.rows[0]) { await cliente.query("ROLLBACK"); return res.status(409).json({ erro: `Já existe um item chamado "${item.nome}".` }); }
    const { rows } = await cliente.query(
      `INSERT INTO equipamento (nome, descricao, status, conferencia, ordem)
       VALUES ($1,$2,TRUE,$3,(SELECT COALESCE(MAX(ordem) FILTER (WHERE ordem < 99), 0) + 1 FROM equipamento))
       RETURNING *`, [item.nome, item.descricao, item.conferencia]);
    await historico(cliente, { id_equipamento: rows[0].id_equipamento, tipo: "ITEM_CRIADO",
      descricao: `Item criado (${ROTULO_CONF[item.conferencia]}).`, usuario: req.usuario.id_usuario });
    await cliente.query("COMMIT");
    await registrarAuditoria({ idUsuario: req.usuario.id_usuario, acao: "CRIAR", entidade: "equipamento",
      idRegistro: rows[0].id_equipamento, dadosNovos: rows[0] });
    res.status(201).json(rows[0]);
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    next(e);
  } finally {
    cliente.release();
  }
});

router.put("/itens/:id", autenticar, exigePermissao(GERENCIAR), async (req, res, next) => {
  const cliente = await pool.connect();
  try {
    const id = Number(req.params.id);
    await cliente.query("BEGIN");
    const antes = (await cliente.query("SELECT * FROM equipamento WHERE id_equipamento = $1 FOR UPDATE", [id])).rows[0];
    if (!antes) { await cliente.query("ROLLBACK"); return res.status(404).json({ erro: "Item não encontrado." }); }
    // Ativar / inativar sozinho, ou editar nome, descricao e conferencia.
    if (req.body && Object.keys(req.body).length === 1 && "status" in req.body) {
      const status = Boolean(req.body.status);
      if (status !== antes.status) {
        await cliente.query("UPDATE equipamento SET status = $2 WHERE id_equipamento = $1", [id, status]);
        await historico(cliente, { id_equipamento: id, tipo: status ? "ITEM_ATIVADO" : "ITEM_INATIVADO",
          descricao: status ? "Item ativado: volta a aparecer no checklist." : "Item inativado: sai do checklist.",
          usuario: req.usuario.id_usuario });
      }
    } else {
      const item = lerItem(req.body);
      if (item.erro) { await cliente.query("ROLLBACK"); return res.status(400).json({ erro: item.erro }); }
      const ja = await cliente.query("SELECT 1 FROM equipamento WHERE lower(nome) = lower($1) AND id_equipamento <> $2", [item.nome, id]);
      if (ja.rows[0]) { await cliente.query("ROLLBACK"); return res.status(409).json({ erro: `Já existe um item chamado "${item.nome}".` }); }
      await cliente.query("UPDATE equipamento SET nome = $2, descricao = $3, conferencia = $4 WHERE id_equipamento = $1",
        [id, item.nome, item.descricao, item.conferencia]);
      const mudou = [];
      if (item.nome !== antes.nome) mudou.push(`nome "${antes.nome}" → "${item.nome}"`);
      if (item.conferencia !== antes.conferencia) mudou.push(`conferência ${ROTULO_CONF[antes.conferencia]} → ${ROTULO_CONF[item.conferencia]}`);
      if ((item.descricao || "") !== (antes.descricao || "")) mudou.push("descrição");
      if (mudou.length) {
        await historico(cliente, { id_equipamento: id, tipo: "ITEM_ALTERADO",
          descricao: `Alterado: ${mudou.join("; ")}.`, usuario: req.usuario.id_usuario });
      }
    }
    const depois = (await cliente.query("SELECT * FROM equipamento WHERE id_equipamento = $1", [id])).rows[0];
    await cliente.query("COMMIT");
    await registrarAuditoria({ idUsuario: req.usuario.id_usuario, acao: "EDITAR", entidade: "equipamento",
      idRegistro: id, dadosAnteriores: antes, dadosNovos: depois });
    res.json(depois);
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    next(e);
  } finally {
    cliente.release();
  }
});

// --------------------------------------------------------------- viaturas
router.get("/viaturas", autenticar, exigePermissao(VER), async (req, res, next) => {
  try {
    const q = req.query;
    const p = paginacao(q);
    const where = ["v.viatura"];
    const valores = [];
    if (q.busca) {
      valores.push(`%${String(q.busca).trim()}%`);
      where.push(`(v.placa ILIKE $${valores.length} OR v.modelo ILIKE $${valores.length} OR v.marca ILIKE $${valores.length})`);
    }
    if (q.status) { valores.push(q.status); where.push(`v.status = $${valores.length}`); }
    if (q.viatura) { valores.push(Number(q.viatura)); where.push(`v.id_veiculo = $${valores.length}`); }
    const w = where.join(" AND ");
    const total = Number((await query(`SELECT COUNT(*) FROM veiculo v WHERE ${w}`, valores)).rows[0].count);
    const { rows } = await query(
      `SELECT v.id_veiculo, v.placa, v.marca, v.modelo, v.status, v.tipo_veiculo,
              COALESCE((SELECT json_object_agg(ve.id_equipamento, ve.quantidade)
                          FROM veiculo_equipamento ve WHERE ve.id_veiculo = v.id_veiculo), '{}') AS quantidades,
              (SELECT MAX(h.alterado_em) FROM equipamento_historico h WHERE h.id_veiculo = v.id_veiculo) AS atualizado_em,
              ck.id_checklist, ck.data_abertura AS ultimo_checklist, ck.status AS ultimo_status, eq.numero AS ultima_equipe
         FROM veiculo v
         LEFT JOIN LATERAL (SELECT c.* FROM checklist_fiscalizacao c WHERE c.id_veiculo = v.id_veiculo
                             ORDER BY c.data_abertura DESC, c.id_checklist DESC LIMIT 1) ck ON TRUE
         LEFT JOIN equipe eq ON eq.id_equipe = ck.id_equipe
        WHERE ${w}
        ORDER BY v.placa ${p.limite}`, valores);
    // Pendencia do ultimo checklist de cada viatura.
    const itens = (await query("SELECT id_equipamento, nome, conferencia FROM equipamento WHERE status")).rows;
    for (const r of rows) {
      if (!r.id_checklist) { r.pendencias = []; continue; }
      const linhas = (await query("SELECT id_equipamento, etapa, quantidade FROM checklist_fiscal_equipamento WHERE id_checklist = $1",
        [r.id_checklist])).rows;
      const fiscais = Number((await query("SELECT COUNT(*) FROM checklist_fiscal_servidor WHERE id_checklist = $1", [r.id_checklist])).rows[0].count) || 2;
      r.pendencias = pendenciasDe(itens.map((i) => ({ ...i, quantidade: r.quantidades[i.id_equipamento] })),
        linhas, fiscais, r.ultimo_status === "FINALIZADO");
    }
    res.json(resposta(rows, total, p));
  } catch (e) {
    next(e);
  }
});

/** Salva as quantidades de uma viatura: { quantidades: {id_equipamento: n}, motivo }. */
router.put("/viaturas/:id", autenticar, exigePermissao(GERENCIAR), async (req, res, next) => {
  const cliente = await pool.connect();
  try {
    const idVeiculo = Number(req.params.id);
    const quantidades = req.body?.quantidades && typeof req.body.quantidades === "object" ? req.body.quantidades : {};
    const motivo = String(req.body?.motivo || "").trim().slice(0, 500) || null;
    for (const v of Object.values(quantidades)) {
      if (!Number.isInteger(Number(v)) || Number(v) < 0 || Number(v) > 999) {
        return res.status(400).json({ erro: "As quantidades precisam ser números inteiros de 0 a 999." });
      }
    }
    await cliente.query("BEGIN");
    const v = (await cliente.query("SELECT id_veiculo, placa, viatura FROM veiculo WHERE id_veiculo = $1 FOR UPDATE", [idVeiculo])).rows[0];
    if (!v) { await cliente.query("ROLLBACK"); return res.status(404).json({ erro: "Viatura não encontrada." }); }
    if (!v.viatura) { await cliente.query("ROLLBACK"); return res.status(409).json({ erro: "Este veículo não é uma viatura da Fiscalização." }); }
    const itens = (await cliente.query("SELECT id_equipamento, nome, conferencia FROM equipamento")).rows;
    const atuais = Object.fromEntries((await cliente.query(
      "SELECT id_equipamento, quantidade FROM veiculo_equipamento WHERE id_veiculo = $1", [idVeiculo])).rows
      .map((r) => [String(r.id_equipamento), r.quantidade]));
    const mudancas = [];
    for (const [idItem, valor] of Object.entries(quantidades)) {
      const item = itens.find((i) => String(i.id_equipamento) === String(idItem));
      if (!item || item.conferencia !== "QUANTIDADE") continue;
      const nova = Number(valor);
      const anterior = atuais[String(idItem)];
      if (anterior === nova || (anterior === undefined && nova === 0)) continue;
      await cliente.query(
        `INSERT INTO veiculo_equipamento (id_veiculo, id_equipamento, quantidade) VALUES ($1,$2,$3)
         ON CONFLICT (id_veiculo, id_equipamento) DO UPDATE SET quantidade = EXCLUDED.quantidade`,
        [idVeiculo, item.id_equipamento, nova]);
      await historico(cliente, { id_equipamento: item.id_equipamento, id_veiculo: idVeiculo, tipo: "QUANTIDADE",
        anterior: anterior ?? 0, nova, motivo, usuario: req.usuario.id_usuario });
      mudancas.push({ item: item.nome, anterior: anterior ?? 0, nova });
    }
    await cliente.query("COMMIT");
    if (mudancas.length) {
      await registrarAuditoria({ idUsuario: req.usuario.id_usuario, acao: "EDITAR", entidade: "veiculo_equipamento",
        idRegistro: idVeiculo, dadosAnteriores: atuais, dadosNovos: { mudancas, motivo }, justificativa: motivo });
    }
    res.json({ ok: true, mudancas });
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    next(e);
  } finally {
    cliente.release();
  }
});

// ----------------------------------------------------------- conferencias
router.get("/conferencias", autenticar, exigePermissao(VER), async (req, res, next) => {
  try {
    const q = req.query;
    const p = paginacao(q);
    const where = ["TRUE"];
    const valores = [];
    if (q.viatura) { valores.push(Number(q.viatura)); where.push(`c.id_veiculo = $${valores.length}`); }
    if (q.equipe) { valores.push(Number(q.equipe)); where.push(`c.id_equipe = $${valores.length}`); }
    if (q.dataDe) { valores.push(q.dataDe); where.push(`c.data_abertura >= $${valores.length}`); }
    if (q.dataAte) { valores.push(q.dataAte); where.push(`c.data_abertura <= $${valores.length}`); }
    if (q.status) { valores.push(q.status); where.push(`c.status = $${valores.length}`); }
    const base = `FROM checklist_fiscalizacao c
                  JOIN veiculo v ON v.id_veiculo = c.id_veiculo
                  LEFT JOIN equipe eq ON eq.id_equipe = c.id_equipe
                  LEFT JOIN servico_equipe se ON se.id_servico_diario = c.id_servico_diario AND se.id_equipe = c.id_equipe
                 WHERE ${where.join(" AND ")}`;
    const sel = `SELECT c.id_checklist, c.data_abertura, c.hora_saida, c.hora_chegada, c.status,
                        v.id_veiculo, v.placa, v.marca, v.modelo, eq.numero AS equipe, se.numero AS servico_codigo,
                        (SELECT string_agg(s.nome, ' / ' ORDER BY cs.tipo) FROM checklist_fiscal_servidor cs
                           JOIN servidor s ON s.id_servidor = cs.id_servidor WHERE cs.id_checklist = c.id_checklist) AS fiscais,
                        (SELECT COUNT(*) FROM checklist_fiscal_servidor cs WHERE cs.id_checklist = c.id_checklist)::int AS n_fiscais
                   ${base}
                  ORDER BY c.data_abertura DESC, c.hora_saida DESC, c.id_checklist DESC`;
    const itens = (await query("SELECT id_equipamento, nome, conferencia FROM equipamento ORDER BY ordem NULLS LAST")).rows;
    const montar = async (r) => {
      const linhas = (await query(
        "SELECT id_equipamento, etapa, quantidade, observacao FROM checklist_fiscal_equipamento WHERE id_checklist = $1",
        [r.id_checklist])).rows;
      const qtd = Object.fromEntries((await query(
        "SELECT id_equipamento, quantidade FROM veiculo_equipamento WHERE id_veiculo = $1", [r.id_veiculo])).rows
        .map((x) => [String(x.id_equipamento), x.quantidade]));
      const comQtd = itens.map((i) => ({ ...i, quantidade: qtd[String(i.id_equipamento)] }));
      r.itens = comQtd.filter((i) => linhas.some((l) => String(l.id_equipamento) === String(i.id_equipamento))).map((i) => {
        const s = linhas.find((l) => String(l.id_equipamento) === String(i.id_equipamento) && l.etapa === "SAIDA");
        const c = linhas.find((l) => String(l.id_equipamento) === String(i.id_equipamento) && l.etapa === "CHEGADA");
        return { id_equipamento: i.id_equipamento, nome: i.nome, conferencia: i.conferencia,
          previsto: previstoDoItem(i, i.quantidade, r.n_fiscais || 2),
          saida: s ? s.quantidade : null, chegada: c ? c.quantidade : null,
          observacao: [s?.observacao, c?.observacao].filter(Boolean).join(" · ") || null };
      });
      r.pendencias = pendenciasDe(comQtd, linhas, r.n_fiscais || 2, r.status === "FINALIZADO");
      return r;
    };
    // "So com pendencia" depende de uma conta feita aqui: filtra tudo e pagina depois.
    if (q.pendencia === "1") {
      const todos = (await query(sel, valores)).rows;
      const comPend = [];
      for (const r of todos) { const m = await montar(r); if (m.pendencias.length) comPend.push(m); }
      const fatia = comPend.slice((p.pagina - 1) * p.porPagina, p.pagina * p.porPagina);
      return res.json(resposta(fatia, comPend.length, p));
    }
    const total = Number((await query(`SELECT COUNT(*) ${base}`, valores)).rows[0].count);
    const rows = (await query(`${sel} ${p.limite}`, valores)).rows;
    for (const r of rows) await montar(r);
    res.json(resposta(rows, total, p));
  } catch (e) {
    next(e);
  }
});

// -------------------------------------------------------------- historico
router.get("/historico", autenticar, exigePermissao(VER), async (req, res, next) => {
  try {
    const q = req.query;
    const p = paginacao(q);
    const where = ["TRUE"];
    const valores = [];
    if (q.viatura) { valores.push(Number(q.viatura)); where.push(`h.id_veiculo = $${valores.length}`); }
    if (q.item) { valores.push(Number(q.item)); where.push(`h.id_equipamento = $${valores.length}`); }
    if (q.dataDe) { valores.push(q.dataDe); where.push(`h.alterado_em >= $${valores.length}::date`); }
    if (q.dataAte) { valores.push(q.dataAte); where.push(`h.alterado_em < $${valores.length}::date + 1`); }
    const base = `FROM equipamento_historico h
                  JOIN equipamento e ON e.id_equipamento = h.id_equipamento
                  LEFT JOIN veiculo v ON v.id_veiculo = h.id_veiculo
                  LEFT JOIN usuario u ON u.id_usuario = h.alterado_por
                  LEFT JOIN servidor s ON s.id_servidor = u.id_servidor
                 WHERE ${where.join(" AND ")}`;
    const total = Number((await query(`SELECT COUNT(*) ${base}`, valores)).rows[0].count);
    const { rows } = await query(
      `SELECT h.*, e.nome AS item, v.placa, v.modelo, COALESCE(s.nome, u.login) AS usuario
         ${base} ORDER BY h.alterado_em DESC, h.id_historico DESC ${p.limite}`, valores);
    res.json(resposta(rows, total, p));
  } catch (e) {
    next(e);
  }
});

// ------------------------------------------------------ controle de estoque
const SQL_ESTOQUE = `
  WITH ent AS (
    SELECT id_equipamento,
           COALESCE(SUM(CASE tipo WHEN 'ENTRADA' THEN quantidade ELSE 0 END), 0)::int AS entradas,
           COALESCE(SUM(CASE tipo WHEN 'BAIXA' THEN quantidade ELSE 0 END), 0)::int AS baixas,
           MAX(data) FILTER (WHERE tipo = 'ENTRADA') AS ultima_entrada
      FROM equipamento_movimento GROUP BY id_equipamento),
  mov AS (
    SELECT s.id_equipamento,
           COALESCE(SUM(s.quantidade) FILTER (WHERE c.status = 'ABERTO'), 0)::int AS em_uso,
           COALESCE(SUM(GREATEST(s.quantidade - ch.quantidade, 0)) FILTER (WHERE c.status = 'FINALIZADO'), 0)::int AS faltando,
           COUNT(*) FILTER (WHERE c.status = 'FINALIZADO' AND ch.quantidade < s.quantidade)::int AS checklists_com_falta,
           COALESCE(SUM(s.quantidade), 0)::int AS retirados
      FROM checklist_fiscal_equipamento s
      JOIN checklist_fiscalizacao c ON c.id_checklist = s.id_checklist
      LEFT JOIN checklist_fiscal_equipamento ch
             ON ch.id_checklist = s.id_checklist AND ch.id_equipamento = s.id_equipamento AND ch.etapa = 'CHEGADA'
     WHERE s.etapa = 'SAIDA'
     GROUP BY s.id_equipamento),
  via AS (
    SELECT ve.id_equipamento, COALESCE(SUM(ve.quantidade), 0)::int AS nas_viaturas
      FROM veiculo_equipamento ve JOIN veiculo v ON v.id_veiculo = ve.id_veiculo AND v.viatura
     GROUP BY ve.id_equipamento)
  SELECT e.id_equipamento, e.nome, e.descricao, e.status, e.conferencia, e.ordem,
         COALESCE(ent.entradas, 0) AS entradas, COALESCE(ent.baixas, 0) AS baixas,
         COALESCE(ent.entradas, 0) - COALESCE(ent.baixas, 0) AS cadastrado, ent.ultima_entrada,
         COALESCE(mov.em_uso, 0) AS em_uso, COALESCE(mov.faltando, 0) AS faltando,
         COALESCE(mov.checklists_com_falta, 0) AS checklists_com_falta, COALESCE(mov.retirados, 0) AS retirados,
         COALESCE(ent.entradas, 0) - COALESCE(ent.baixas, 0) - COALESCE(mov.em_uso, 0) - COALESCE(mov.faltando, 0) AS disponivel,
         COALESCE(via.nas_viaturas, 0) AS nas_viaturas
    FROM equipamento e
    LEFT JOIN ent ON ent.id_equipamento = e.id_equipamento
    LEFT JOIN mov ON mov.id_equipamento = e.id_equipamento
    LEFT JOIN via ON via.id_equipamento = e.id_equipamento`;

router.get("/estoque", autenticar, exigePermissao(VER), async (req, res, next) => {
  try {
    const { rows } = await query(`${SQL_ESTOQUE} ORDER BY e.status DESC, e.ordem NULLS LAST, e.nome`);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

/** Um item: os numeros do estoque e quanto falta por fiscal. */
router.get("/itens/:id/resumo", autenticar, exigePermissao(VER), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const item = (await query(`${SQL_ESTOQUE} WHERE e.id_equipamento = $1`, [id])).rows[0];
    if (!item) return res.status(404).json({ erro: "Item não encontrado." });
    // Responsaveis: os fiscais (Fiscal 1 e Fiscal 2) do checklist em que faltou.
    const faltas = await query(
      `SELECT sv.id_servidor, sv.nome, sv.matricula,
              COUNT(DISTINCT c.id_checklist)::int AS checklists,
              SUM(s.quantidade - ch.quantidade)::int AS faltando,
              MAX(c.data_abertura) AS ultima
         FROM checklist_fiscal_equipamento s
         JOIN checklist_fiscal_equipamento ch ON ch.id_checklist = s.id_checklist AND ch.id_equipamento = s.id_equipamento AND ch.etapa = 'CHEGADA'
         JOIN checklist_fiscalizacao c ON c.id_checklist = s.id_checklist AND c.status = 'FINALIZADO'
         JOIN checklist_fiscal_servidor cs ON cs.id_checklist = c.id_checklist
         JOIN servidor sv ON sv.id_servidor = cs.id_servidor
        WHERE s.etapa = 'SAIDA' AND s.id_equipamento = $1 AND ch.quantidade < s.quantidade
        GROUP BY sv.id_servidor, sv.nome, sv.matricula
        ORDER BY faltando DESC, sv.nome`, [id]);
    res.json({ ...item, faltas_por_fiscal: faltas.rows });
  } catch (e) {
    next(e);
  }
});

/** Retiradas (saida) e devolucoes (chegada) do item nos checklists. */
router.get("/itens/:id/checklists", autenticar, exigePermissao(VER), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const q = req.query;
    const p = paginacao(q);
    const where = ["s.etapa = 'SAIDA'", "s.id_equipamento = $1"];
    const valores = [id];
    if (q.dataDe) { valores.push(q.dataDe); where.push(`c.data_abertura >= $${valores.length}`); }
    if (q.dataAte) { valores.push(q.dataAte); where.push(`c.data_abertura <= $${valores.length}`); }
    if (q.viatura) { valores.push(Number(q.viatura)); where.push(`c.id_veiculo = $${valores.length}`); }
    if (q.fiscal) { valores.push(Number(q.fiscal)); where.push(`EXISTS (SELECT 1 FROM checklist_fiscal_servidor x WHERE x.id_checklist = c.id_checklist AND x.id_servidor = $${valores.length})`); }
    if (q.falta === "1") where.push("c.status = 'FINALIZADO' AND ch.quantidade < s.quantidade");
    const base = `FROM checklist_fiscal_equipamento s
                  JOIN checklist_fiscalizacao c ON c.id_checklist = s.id_checklist
                  LEFT JOIN checklist_fiscal_equipamento ch
                         ON ch.id_checklist = s.id_checklist AND ch.id_equipamento = s.id_equipamento AND ch.etapa = 'CHEGADA'
                  JOIN veiculo v ON v.id_veiculo = c.id_veiculo
                  LEFT JOIN equipe eq ON eq.id_equipe = c.id_equipe
                  LEFT JOIN servico_equipe se ON se.id_servico_diario = c.id_servico_diario AND se.id_equipe = c.id_equipe
                 WHERE ${where.join(" AND ")}`;
    const total = Number((await query(`SELECT COUNT(*) ${base}`, valores)).rows[0].count);
    const { rows } = await query(
      `SELECT c.id_checklist, c.data_abertura, c.hora_saida, c.hora_chegada, c.status,
              v.id_veiculo, v.placa, v.modelo, eq.numero AS equipe, se.numero AS servico_codigo, se.id_servico_equipe,
              s.quantidade AS saida, ch.quantidade AS chegada,
              CASE WHEN c.status = 'FINALIZADO' AND ch.quantidade IS NOT NULL THEN GREATEST(s.quantidade - ch.quantidade, 0) ELSE 0 END AS falta,
              NULLIF(concat_ws(' · ', s.observacao, ch.observacao), '') AS observacao,
              (SELECT json_agg(json_build_object('id_servidor', sv.id_servidor, 'nome', sv.nome, 'matricula', sv.matricula, 'tipo', x.tipo) ORDER BY x.tipo)
                 FROM checklist_fiscal_servidor x JOIN servidor sv ON sv.id_servidor = x.id_servidor
                WHERE x.id_checklist = c.id_checklist) AS fiscais
         ${base}
        ORDER BY c.data_abertura DESC, c.hora_saida DESC NULLS LAST, c.id_checklist DESC ${p.limite}`, valores);
    res.json(resposta(rows, total, p));
  } catch (e) {
    next(e);
  }
});

/** Entradas e baixas do item. */
router.get("/itens/:id/movimentos", autenticar, exigePermissao(VER), async (req, res, next) => {
  try {
    const p = paginacao(req.query);
    const id = Number(req.params.id);
    const total = Number((await query("SELECT COUNT(*) FROM equipamento_movimento WHERE id_equipamento = $1", [id])).rows[0].count);
    const { rows } = await query(
      `SELECT m.*, COALESCE(s.nome, u.login) AS usuario
         FROM equipamento_movimento m
         LEFT JOIN usuario u ON u.id_usuario = m.registrado_por
         LEFT JOIN servidor s ON s.id_servidor = u.id_servidor
        WHERE m.id_equipamento = $1
        ORDER BY m.data DESC, m.id_movimento DESC ${p.limite}`, [id]);
    res.json(resposta(rows, total, p));
  } catch (e) {
    next(e);
  }
});

router.post("/itens/:id/movimentos", autenticar, exigePermissao(GERENCIAR), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const tipo = String(req.body?.tipo || "").toUpperCase();
    const quantidade = Number(req.body?.quantidade);
    const data = String(req.body?.data || "").slice(0, 10);
    const observacao = String(req.body?.observacao || "").trim().slice(0, 500) || null;
    if (!["ENTRADA", "BAIXA"].includes(tipo)) return res.status(400).json({ erro: "Escolha Entrada ou Baixa." });
    if (!Number.isInteger(quantidade) || quantidade <= 0 || quantidade > 100000) return res.status(400).json({ erro: "Informe a quantidade (número inteiro maior que zero)." });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return res.status(400).json({ erro: "Informe a data." });
    if (tipo === "BAIXA" && !observacao) return res.status(400).json({ erro: "Escreva o motivo da baixa (ex.: danificado, perdido)." });
    const it = (await query("SELECT nome FROM equipamento WHERE id_equipamento = $1", [id])).rows[0];
    if (!it) return res.status(404).json({ erro: "Item não encontrado." });
    const { rows } = await query(
      `INSERT INTO equipamento_movimento (id_equipamento, tipo, quantidade, data, observacao, registrado_por)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [id, tipo, quantidade, data, observacao, req.usuario.id_usuario]);
    await registrarAuditoria({ idUsuario: req.usuario.id_usuario, acao: "CRIAR", entidade: "equipamento_movimento",
      idRegistro: rows[0].id_movimento, dadosNovos: { ...rows[0], item: it.nome } });
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

export default router;
