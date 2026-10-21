/**
 * qrcodeFiscal.js - Checklist da VIATURA da Fiscalizacao pelo QR Code (21/10).
 *
 * Desenho do Cesar, em quatro passos no celular:
 *   1. Checklist de saida: os dois fiscais (matricula), horario, KM e os
 *      equipamentos. Abre o checklist (checklist_fiscalizacao) no servico do
 *      dia da equipe do Fiscal 1, e a viatura passa para EM_USO.
 *   2. Ocorrencias e QRU: durante o servico a equipe registra o que atendeu
 *      (ocorrencia + distribuicao para a equipe, com a viatura), abre OS,
 *      tira fotos e escreve as observacoes.
 *   3. Checklist de chegada: horario, KM e os equipamentos no retorno.
 *   4. Finalizar: resumo e fechamento. A viatura volta para DISPONIVEL.
 *
 * Rotas PUBLICAS, como as do checklist da frota (qrcode.js): a credencial e o
 * token do QR Code (24 bytes aleatorios) e as matriculas identificam quem
 * esta com a viatura. Tudo grava em tabelas da FISCALIZACAO; nada cai no
 * checklist da frota.
 *
 * Os itens conferidos sao os do cadastro de equipamentos (Fiscalizacao >
 * Equipamentos, migracao 044): Radio (um por fiscal), Cone, Pantografica,
 * Cavalete e Barreira (a quantidade salva para a viatura) e Macaco, Estepe e
 * Chave de roda (presente/ausente).
 *
 * Ocorrencia (desenho "Nova Ocorrencia", 21/10): tipo, local (bairro,
 * referencia, sentido, localizacao do aparelho), descricao, envolvidos,
 * fotos, documentos e "Abrir QRU relacionado" (um QRU ligado a ela).
 */
import { Router, json } from "express";
import { query, pool } from "../db.js";
import { autenticar } from "../auth.js";
import { fecharTurnoSeAcabou } from "./servicoEquipe.js";
import { ultimoOdometro, NORMALIZAR, NORMALIZAR_COLUNA, lerDataUrl, corpoDeFoto } from "./qrcode.js";

const router = Router();
const MAX_FOTOS = 6;
const GRAVIDADES = ["BAIXA", "MEDIA", "ALTA"];

/** Data e hora de agora no fuso da CMTT. */
function agoraBr() {
  const d = new Date();
  return {
    data: d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }),
    hora: d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
  };
}

/** A viatura do token (ou null). */
async function viaturaDoToken(token, cliente = { query }) {
  const { rows } = await cliente.query(
    `SELECT v.id_veiculo, v.placa, v.marca, v.modelo, v.cor, v.ano_fabricacao, v.ano_modelo,
            v.tipo_veiculo, v.tipo_combustivel, v.quilometragem_atual, v.status, v.viatura,
            s.nome AS setor
       FROM qr_code q
       JOIN veiculo v ON v.id_veiculo = q.id_veiculo
       JOIN setor s ON s.id_setor = v.id_setor
      WHERE q.token = $1 AND q.status = TRUE`, [token]);
  return rows[0] || null;
}

/** O checklist da Fiscalizacao ABERTO da viatura (ou null). */
async function abertoDa(idVeiculo, cliente = { query }, travar = false) {
  const { rows } = await cliente.query(
    `SELECT * FROM checklist_fiscalizacao WHERE id_veiculo = $1 AND status = 'ABERTO'
      ORDER BY id_checklist DESC LIMIT 1 ${travar ? "FOR UPDATE" : ""}`, [idVeiculo]);
  return rows[0] || null;
}

/** Servidor pela matricula (mesma normalizacao do checklist da frota). */
async function servidorPela(matricula, cliente = { query }) {
  const digitada = String(matricula || "").trim();
  if (!digitada) return { erro: "Informe a matrícula." };
  const { rows } = await cliente.query(
    `SELECT s.id_servidor, s.nome, s.matricula, s.status, c.nome AS cargo
       FROM servidor s LEFT JOIN cargo c ON c.id_cargo = s.id_cargo
      WHERE s.matricula = $1 OR ${NORMALIZAR_COLUNA.replace(/matricula/g, "s.matricula")} = ${NORMALIZAR}
      ORDER BY (s.matricula = $1) DESC`, [digitada]);
  if (!rows.length) return { erro: `Matrícula ${digitada} não encontrada.` };
  const exata = rows.find((r) => r.matricula === digitada);
  if (!exata && rows.length > 1) {
    return { erro: `Mais de um servidor com matrícula parecida (${rows.map((r) => r.matricula).join(", ")}). Digite exatamente como está no crachá.` };
  }
  const s = exata || rows[0];
  if (!s.status) return { erro: `A matrícula ${s.matricula} está inativa no cadastro.` };
  return { servidor: s };
}

/**
 * Em que servico de HOJE o fiscal esta escalado: a equipe dele no dia, no
 * servico do turno. Com dois turnos no dia (diurno e noturno), vale o do
 * horario de agora.
 */
async function escalaDeHoje(idServidor, cliente = { query }) {
  const { data, hora } = agoraBr();
  const { rows } = await cliente.query(
    `SELECT se.id_servico_equipe, se.numero AS codigo, se.id_equipe, eq.numero AS equipe,
            sd.id_servico_diario, sd.data, sd.turno, sd.status AS status_servico, sd.id_coordenador
       FROM servico_equipe se
       JOIN servico_diario sd ON sd.id_servico_diario = se.id_servico_diario
       JOIN equipe eq ON eq.id_equipe = se.id_equipe
       JOIN equipe_servidor es ON es.id_equipe = se.id_equipe AND es.id_servidor = $1
            AND es.data_inicio <= sd.data AND (es.data_fim IS NULL OR es.data_fim >= sd.data)
      WHERE sd.data = $2 AND se.status IN ('ATIVA', 'EM_SERVICO') AND sd.status <> 'ENCERRADO'`, [idServidor, data]);
  if (!rows.length) return null;
  const turnoAgora = hora >= "06:00" && hora < "19:00" ? "DIURNO" : "NOTURNO";
  return rows.find((r) => r.turno === turnoAgora) || rows[0];
}

/**
 * Itens de equipamento do cadastro (Fiscalizacao > Equipamentos), com a
 * quantidade salva para a viatura. Como cada um e conferido (21/10):
 * QUANTIDADE = a quantidade salva; POR_FISCAL = um por fiscal (Radio);
 * OBRIGATORIO = presente/ausente (Macaco, Estepe, Chave de roda).
 */
async function equipamentosDa(idVeiculo, cliente = { query }) {
  const { rows } = await cliente.query(
    `SELECT e.id_equipamento, e.nome, e.conferencia, COALESCE(ve.quantidade, 0) AS quantidade_salva
       FROM equipamento e
       LEFT JOIN veiculo_equipamento ve ON ve.id_equipamento = e.id_equipamento AND ve.id_veiculo = $1
      WHERE e.status ORDER BY e.ordem NULLS LAST, e.id_equipamento`, [idVeiculo]);
  return rows;
}

/** Usuario que assina o que a equipe registra pelo celular (sem login). */
async function usuarioDaEquipe(idServidor, idCoordenador, cliente = { query }) {
  const { rows } = await cliente.query(
    `SELECT id_usuario FROM usuario
      WHERE status AND id_servidor = ANY($1::bigint[])
      ORDER BY array_position($1::bigint[], id_servidor) LIMIT 1`,
    [[idServidor, idCoordenador].filter(Boolean)]);
  if (rows[0]) return rows[0].id_usuario;
  const adm = await cliente.query(
    `SELECT u.id_usuario FROM usuario u JOIN perfil p ON p.id_perfil = u.id_perfil
      WHERE u.status ORDER BY (unaccent_simples(p.nome) LIKE '%ADMIN%') DESC, u.id_usuario LIMIT 1`);
  return adm.rows[0]?.id_usuario || null;
}

/** Tudo o que a tela precisa do checklist aberto. */
async function detalheDoChecklist(ck) {
  const fiscais = await query(
    `SELECT cs.tipo, s.id_servidor, s.nome, s.matricula, c.nome AS cargo
       FROM checklist_fiscal_servidor cs JOIN servidor s ON s.id_servidor = cs.id_servidor
       LEFT JOIN cargo c ON c.id_cargo = s.id_cargo
      WHERE cs.id_checklist = $1 ORDER BY cs.tipo`, [ck.id_checklist]);
  const servico = await query(
    `SELECT se.numero AS codigo, eq.numero AS equipe, sd.data, sd.turno
       FROM servico_diario sd
       LEFT JOIN servico_equipe se ON se.id_servico_diario = sd.id_servico_diario AND se.id_equipe = $2
       LEFT JOIN equipe eq ON eq.id_equipe = $2
      WHERE sd.id_servico_diario = $1`, [ck.id_servico_diario, ck.id_equipe]);
  const equipamentos = await query(
    `SELECT id_equipamento, etapa, quantidade, observacao FROM checklist_fiscal_equipamento
      WHERE id_checklist = $1`, [ck.id_checklist]);
  const ocorrencias = (ck.id_servico_diario && ck.id_equipe) ? await query(
    `SELECT DISTINCT ON (o.id_ocorrencia) o.id_ocorrencia, o.protocolo, o.tipo, o.descricao, o.endereco,
            o.hora, o.status, o.descricao_atendimento, o.categoria, o.bairro, o.id_ocorrencia_origem,
            (SELECT protocolo FROM ocorrencia x WHERE x.id_ocorrencia = o.id_ocorrencia_origem) AS origem_protocolo,
            (SELECT COUNT(*) FROM ocorrencia_arquivo a WHERE a.id_ocorrencia = o.id_ocorrencia)::int AS arquivos,
            (SELECT COUNT(*) FROM ocorrencia_envolvido en WHERE en.id_ocorrencia = o.id_ocorrencia)::int AS envolvidos
       FROM distribuicao_ocorrencia d JOIN ocorrencia o ON o.id_ocorrencia = d.id_ocorrencia
      WHERE d.id_servico_diario = $1 AND d.id_equipe = $2 AND d.status <> 'CANCELADA'
      ORDER BY o.id_ocorrencia`, [ck.id_servico_diario, ck.id_equipe]) : { rows: [] };
  ocorrencias.rows.sort((a, b) => String(a.hora).localeCompare(String(b.hora)));
  const os = await query(
    `SELECT id_os, numero, descricao, gravidade, momento, status, data_abertura
       FROM ordem_servico WHERE origem = 'CHECKLIST_FISCALIZACAO' AND id_registro_origem = $1
      ORDER BY data_abertura`, [ck.id_checklist]);
  const fotos = await query(
    "SELECT momento, COUNT(*)::int AS n FROM checklist_fiscal_foto WHERE id_checklist = $1 GROUP BY momento",
    [ck.id_checklist]);
  return {
    ...ck,
    fiscais: fiscais.rows,
    servico: servico.rows[0] || null,
    equipamentos: equipamentos.rows,
    ocorrencias: ocorrencias.rows,
    os: os.rows,
    fotos: Object.fromEntries(fotos.rows.map((f) => [f.momento, f.n])),
  };
}

// --------------------------------------------------------------- leitura
router.get("/:token", async (req, res, next) => {
  try {
    const v = await viaturaDoToken(req.params.token);
    if (!v) return res.status(404).json({ erro: "QR Code inválido." });
    if (!v.viatura) return res.status(409).json({ erro: "Este veículo não é uma viatura da Fiscalização." });
    const aberto = await abertoDa(v.id_veiculo);
    res.json({
      veiculo: { ...v, quilometragem_atual: await ultimoOdometro(v.id_veiculo) },
      equipamentos: await equipamentosDa(v.id_veiculo),
      checklist: aberto ? await detalheDoChecklist(aberto) : null,
      agora: agoraBr(),
    });
  } catch (e) {
    next(e);
  }
});

// Fiscal pela matricula, com a equipe em que esta escalado hoje.
router.get("/:token/fiscal/:matricula", async (req, res, next) => {
  try {
    const v = await viaturaDoToken(req.params.token);
    if (!v) return res.status(404).json({ erro: "QR Code inválido." });
    const r = await servidorPela(req.params.matricula);
    if (r.erro) return res.status(404).json({ erro: r.erro });
    res.json({ ...r.servidor, escala: await escalaDeHoje(r.servidor.id_servidor) });
  } catch (e) {
    next(e);
  }
});

// ------------------------------------------------------------------ saida
router.post("/:token/saida", async (req, res, next) => {
  const cliente = await pool.connect();
  try {
    const { fiscal1, fiscal2, hora_saida, odometro_saida, equipamentos, observacoes } = req.body || {};
    if (!fiscal1 || !fiscal2) return res.status(400).json({ erro: "Informe a matrícula dos dois fiscais." });
    if (odometro_saida === undefined || odometro_saida === "" || Number(odometro_saida) < 0) {
      return res.status(400).json({ erro: "Informe o KM de saída." });
    }
    await cliente.query("BEGIN");
    const v = await viaturaDoToken(req.params.token, cliente);
    if (!v) { await cliente.query("ROLLBACK"); return res.status(404).json({ erro: "QR Code inválido." }); }
    if (!v.viatura) { await cliente.query("ROLLBACK"); return res.status(409).json({ erro: "Este veículo não é uma viatura da Fiscalização." }); }
    if (["EM_MANUTENCAO", "INATIVO"].includes(v.status)) {
      await cliente.query("ROLLBACK");
      return res.status(409).json({ erro: "Esta viatura não está liberada para uso. Procure a gestão." });
    }
    await cliente.query("SELECT 1 FROM veiculo WHERE id_veiculo = $1 FOR UPDATE", [v.id_veiculo]);
    if (await abertoDa(v.id_veiculo, cliente)) {
      await cliente.query("ROLLBACK");
      return res.status(409).json({ erro: "Esta viatura já tem um checklist aberto. Leia o QR Code de novo para continuar." });
    }
    const f1 = await servidorPela(fiscal1, cliente);
    if (f1.erro) { await cliente.query("ROLLBACK"); return res.status(404).json({ erro: `Fiscal 1: ${f1.erro}` }); }
    const f2 = await servidorPela(fiscal2, cliente);
    if (f2.erro) { await cliente.query("ROLLBACK"); return res.status(404).json({ erro: `Fiscal 2: ${f2.erro}` }); }
    if (f1.servidor.id_servidor === f2.servidor.id_servidor) {
      await cliente.query("ROLLBACK");
      return res.status(400).json({ erro: "Fiscal 1 e Fiscal 2 precisam ser pessoas diferentes." });
    }
    const escala = await escalaDeHoje(f1.servidor.id_servidor, cliente);
    if (!escala) {
      await cliente.query("ROLLBACK");
      return res.status(409).json({ erro: `${f1.servidor.nome} não está escalado(a) em nenhum serviço diário de hoje. Procure o coordenador.` });
    }
    const km = await ultimoOdometro(v.id_veiculo);
    if (Number(odometro_saida) < km) {
      await cliente.query("ROLLBACK");
      return res.status(400).json({ erro: `O KM de saída não pode ser menor que o último registrado (${km} km).` });
    }
    const { data, hora } = agoraBr();
    const { rows } = await cliente.query(
      `INSERT INTO checklist_fiscalizacao (id_veiculo, id_servico_diario, id_equipe, data_abertura, hora_saida,
         odometro_saida, observacoes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'ABERTO') RETURNING id_checklist`,
      [v.id_veiculo, escala.id_servico_diario, escala.id_equipe, data, hora_saida || hora,
       Number(odometro_saida), observacoes ? String(observacoes).slice(0, 500) : null]);
    const idCk = rows[0].id_checklist;
    await cliente.query(
      "INSERT INTO checklist_fiscal_servidor (id_checklist, id_servidor, tipo) VALUES ($1,$2,'FISCAL_1'), ($1,$3,'FISCAL_2')",
      [idCk, f1.servidor.id_servidor, f2.servidor.id_servidor]);
    for (const e of Array.isArray(equipamentos) ? equipamentos : []) {
      if (!e?.id_equipamento) continue;
      await cliente.query(
        `INSERT INTO checklist_fiscal_equipamento (id_checklist, id_equipamento, etapa, quantidade, observacao)
         VALUES ($1,$2,'SAIDA',$3,$4)`,
        [idCk, Number(e.id_equipamento), Math.max(0, Number(e.quantidade) || 0), e.observacao || null]);
    }
    // "Continuar" no checklist inicia o servico da equipe (21/10: nao ha mais
    // o "Iniciar servico" na tela) e coloca o servico do turno em andamento.
    await cliente.query(
      "UPDATE servico_equipe SET status = 'EM_SERVICO', hora_inicio = COALESCE(hora_inicio, $2::time) WHERE id_servico_equipe = $1 AND status = 'ATIVA'",
      [escala.id_servico_equipe, hora]);
    if (escala.status_servico === "ABERTO") {
      await cliente.query("UPDATE servico_diario SET status = 'EM_SERVICO' WHERE id_servico_diario = $1 AND status = 'ABERTO'",
        [escala.id_servico_diario]);
    }
    await cliente.query("COMMIT");
    res.status(201).json({ id_checklist: idCk });
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    next(e);
  } finally {
    cliente.release();
  }
});

// ------------------------------------------------- ocorrencia e QRU (servico)
export const CATEGORIAS_OCORRENCIA = ["INFRACAO_TRANSITO", "VEICULO_IRREGULAR", "TRANSPORTE_IRREGULAR",
  "CONDUTOR_PASSAGEIRO", "VIA_SINALIZACAO", "TERCEIROS", "APOIO", "OUTRO"];
export const TIPOS_ENVOLVIDO = ["VEICULO", "CONDUTOR", "PASSAGEIRO", "PEDESTRE", "TESTEMUNHA", "TERCEIRO", "OUTRO"];
const MAX_FOTOS_OC = 6;
const MAX_DOCS_OC = 5;
const texto = (v, max) => (String(v ?? "").trim().slice(0, max) || null);
const coordenada = (v, lim) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= lim ? Math.round(n * 1e6) / 1e6 : null;
};

/** Grava uma ocorrencia e a distribuicao para a equipe, com a viatura. */
async function gravarOcorrencia(cliente, o) {
  const seq = await cliente.query(
    `SELECT COALESCE(MAX(NULLIF(regexp_replace(protocolo, '^.*-', ''), '')::int), 0) + 1 AS n
       FROM ocorrencia WHERE protocolo ~ '-[0-9]+$'`);
  const protocolo = `OC-${o.data.replace(/-/g, "")}-${String(seq.rows[0].n).padStart(4, "0")}`;
  const { rows } = await cliente.query(
    `INSERT INTO ocorrencia (protocolo, tipo, descricao, data, hora, endereco, id_servico_diario, criado_por,
       status, descricao_atendimento, data_finalizacao, categoria, bairro, referencia, sentido_via,
       latitude, longitude, id_ocorrencia_origem)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id_ocorrencia`,
    [protocolo, o.tipo, o.descricao, o.data, o.hora, o.endereco, o.ck.id_servico_diario, o.usuario, o.status,
     o.status === "FINALIZADA" ? o.atendimento : null, o.status === "FINALIZADA" ? `${o.data} ${o.agora}:00` : null,
     o.categoria, o.bairro, o.referencia, o.sentido, o.latitude, o.longitude, o.origem ?? null]);
  await cliente.query(
    `INSERT INTO distribuicao_ocorrencia (id_ocorrencia, id_servico_diario, id_equipe, id_veiculo, id_coordenador,
       data, hora, tipo, status) VALUES ($1,$2,$3,$4,$5,$6,$7,'ATRIBUICAO',$8)`,
    [rows[0].id_ocorrencia, o.ck.id_servico_diario, o.ck.id_equipe, o.idVeiculo, o.coordenador ?? null,
     o.data, o.hora, o.status === "FINALIZADA" ? "FINALIZADA" : "ATIVA"]);
  return { id_ocorrencia: rows[0].id_ocorrencia, protocolo };
}

router.post("/:token/ocorrencia", async (req, res, next) => {
  const cliente = await pool.connect();
  try {
    const b = req.body || {};
    const { tipo, descricao, endereco, hora, situacao, descricao_atendimento } = b;
    if (!["QRU", "PROGRAMADA"].includes(tipo)) return res.status(400).json({ erro: "Tipo inválido." });
    const categoria = b.categoria ? String(b.categoria) : null;
    if (categoria && !CATEGORIAS_OCORRENCIA.includes(categoria)) return res.status(400).json({ erro: "Tipo de ocorrência inválido." });
    if (!descricao || String(descricao).trim().length < 5) return res.status(400).json({ erro: "Descreva a ocorrência." });
    if (!endereco || !String(endereco).trim()) return res.status(400).json({ erro: "Informe o local." });
    const status = situacao === "FINALIZADA" ? "FINALIZADA" : "EM_ANDAMENTO";
    if (status === "FINALIZADA" && !String(descricao_atendimento || "").trim()) {
      return res.status(400).json({ erro: "Descreva o atendimento para finalizar a ocorrência." });
    }
    const envolvidos = (Array.isArray(b.envolvidos) ? b.envolvidos : []).slice(0, 20).map((e) => ({
      tipo: TIPOS_ENVOLVIDO.includes(e?.tipo) ? e.tipo : "OUTRO",
      identificacao: texto(e?.identificacao, 150),
      placa_documento: texto(e?.placa_documento, 60),
    }));
    if (envolvidos.some((e) => !e.identificacao)) return res.status(400).json({ erro: "Informe o nome ou a identificação de cada envolvido." });
    await cliente.query("BEGIN");
    const v = await viaturaDoToken(req.params.token, cliente);
    if (!v) { await cliente.query("ROLLBACK"); return res.status(404).json({ erro: "QR Code inválido." }); }
    const ck = await abertoDa(v.id_veiculo, cliente);
    if (!ck) { await cliente.query("ROLLBACK"); return res.status(409).json({ erro: "Registre a saída da viatura primeiro." }); }
    const sd = (await cliente.query("SELECT id_coordenador FROM servico_diario WHERE id_servico_diario = $1",
      [ck.id_servico_diario])).rows[0];
    const f1 = (await cliente.query(
      "SELECT id_servidor FROM checklist_fiscal_servidor WHERE id_checklist = $1 AND tipo = 'FISCAL_1'", [ck.id_checklist])).rows[0];
    const usuario = await usuarioDaEquipe(f1?.id_servidor, sd?.id_coordenador, cliente);
    if (!usuario) throw new Error("Nenhum usuário ativo para registrar a ocorrência.");
    const { data, hora: agora } = agoraBr();
    const quando = /^\d{2}:\d{2}/.test(hora || "") ? String(hora).slice(0, 5) : agora;
    const comum = {
      data, agora, hora: quando, ck, usuario, idVeiculo: v.id_veiculo, coordenador: sd?.id_coordenador,
      endereco: String(endereco).trim().slice(0, 200), categoria,
      bairro: texto(b.bairro, 120), referencia: texto(b.referencia, 255), sentido: texto(b.sentido_via, 60),
      latitude: coordenada(b.latitude, 90), longitude: coordenada(b.longitude, 180),
    };
    const criada = await gravarOcorrencia(cliente, {
      ...comum, tipo, status, descricao: String(descricao).trim().slice(0, 1000),
      atendimento: String(descricao_atendimento || "").trim(),
    });
    for (const e of envolvidos) {
      await cliente.query(
        "INSERT INTO ocorrencia_envolvido (id_ocorrencia, tipo, identificacao, placa_documento) VALUES ($1,$2,$3,$4)",
        [criada.id_ocorrencia, e.tipo, e.identificacao, e.placa_documento]);
    }
    // "Abrir QRU relacionado": um QRU ligado a esta ocorrencia, no mesmo local
    // e com a mesma equipe (pedido do Cesar, 21/10).
    let qru = null;
    if (b.abrir_qru && tipo !== "QRU") {
      qru = await gravarOcorrencia(cliente, {
        ...comum, tipo: "QRU", status: "EM_ANDAMENTO", origem: criada.id_ocorrencia,
        descricao: `QRU relacionado à ocorrência ${criada.protocolo}: ${String(descricao).trim()}`.slice(0, 1000),
      });
    }
    await cliente.query("COMMIT");
    res.status(201).json({ ...criada, qru });
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    next(e);
  } finally {
    cliente.release();
  }
});

// Fotos e documentos da ocorrencia (um por chamada; o documento chega a 10 MB).
export const corpoDeArquivoOc = json({ limit: "15mb" });
router.post("/:token/ocorrencia/:id/arquivos", corpoDeArquivoOc, async (req, res, next) => {
  try {
    const categoria = String(req.body?.categoria || "").toUpperCase();
    if (!["FOTO", "DOCUMENTO"].includes(categoria)) return res.status(400).json({ erro: "Categoria inválida." });
    const nome = texto(req.body?.nome, 255) || (categoria === "FOTO" ? "foto.jpg" : "documento");
    const m = /^data:([a-z/+.-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(String(req.body?.dataUrl || "").trim());
    if (!m) return res.status(400).json({ erro: "Arquivo inválido." });
    const tipoArq = m[1].toLowerCase();
    const aceitos = categoria === "FOTO" ? ["image/jpeg", "image/png", "image/webp"] : ["application/pdf", "image/jpeg", "image/png"];
    if (!aceitos.includes(tipoArq)) {
      return res.status(400).json({ erro: categoria === "FOTO" ? "A foto precisa ser JPG, PNG ou WebP." : "Envie o documento em PDF, JPG ou PNG." });
    }
    const buffer = Buffer.from(m[2], "base64");
    if (!buffer.length || buffer.length > 10 * 1024 * 1024) return res.status(400).json({ erro: "Cada arquivo precisa ter até 10 MB." });
    const v = await viaturaDoToken(req.params.token);
    if (!v) return res.status(404).json({ erro: "QR Code inválido." });
    const ck = await abertoDa(v.id_veiculo);
    if (!ck) return res.status(409).json({ erro: "Nenhum checklist aberto para esta viatura." });
    const idOc = Number(req.params.id);
    const daEquipe = await query(
      `SELECT 1 FROM distribuicao_ocorrencia WHERE id_ocorrencia = $1 AND id_servico_diario = $2 AND id_equipe = $3 LIMIT 1`,
      [idOc, ck.id_servico_diario, ck.id_equipe]);
    if (!daEquipe.rows[0]) return res.status(404).json({ erro: "Ocorrência não encontrada para esta equipe." });
    const ja = Number((await query("SELECT COUNT(*) FROM ocorrencia_arquivo WHERE id_ocorrencia = $1 AND categoria = $2",
      [idOc, categoria])).rows[0].count);
    const max = categoria === "FOTO" ? MAX_FOTOS_OC : MAX_DOCS_OC;
    if (ja >= max) return res.status(400).json({ erro: categoria === "FOTO" ? `No máximo ${max} fotos por ocorrência.` : `No máximo ${max} documentos por ocorrência.` });
    const { rows } = await query(
      `INSERT INTO ocorrencia_arquivo (id_ocorrencia, categoria, nome, tipo, bytes, conteudo)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id_arquivo, categoria, nome, tipo, bytes`,
      [idOc, categoria, nome, tipoArq, buffer.length, buffer]);
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// Finalizar uma ocorrencia que ficou em andamento.
router.put("/:token/ocorrencia/:id/finalizar", async (req, res, next) => {
  try {
    const atendimento = String(req.body?.descricao_atendimento || "").trim();
    if (!atendimento) return res.status(400).json({ erro: "Descreva o atendimento." });
    const v = await viaturaDoToken(req.params.token);
    if (!v) return res.status(404).json({ erro: "QR Code inválido." });
    const ck = await abertoDa(v.id_veiculo);
    if (!ck) return res.status(409).json({ erro: "Nenhum checklist aberto para esta viatura." });
    const { data, hora } = agoraBr();
    const r = await query(
      `UPDATE ocorrencia o SET status = 'FINALIZADA', descricao_atendimento = $3, data_finalizacao = $4
        WHERE o.id_ocorrencia = $1 AND o.status <> 'FINALIZADA'
          AND EXISTS (SELECT 1 FROM distribuicao_ocorrencia d WHERE d.id_ocorrencia = o.id_ocorrencia
                       AND d.id_servico_diario = $2 AND d.id_equipe = $5)`,
      [Number(req.params.id), ck.id_servico_diario, atendimento, `${data} ${hora}:00`, ck.id_equipe]);
    if (!r.rowCount) return res.status(404).json({ erro: "Ocorrência não encontrada para esta equipe." });
    await query("UPDATE distribuicao_ocorrencia SET status = 'FINALIZADA' WHERE id_ocorrencia = $1 AND status = 'ATIVA'",
      [Number(req.params.id)]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ------------------------------------------------------------- OS (chamado)
router.post("/:token/os", async (req, res, next) => {
  try {
    const { descricao, gravidade, momento } = req.body || {};
    if (!descricao || String(descricao).trim().length < 5) return res.status(400).json({ erro: "Descreva o problema da viatura." });
    if (!GRAVIDADES.includes(gravidade)) return res.status(400).json({ erro: "Escolha a urgência." });
    const v = await viaturaDoToken(req.params.token);
    if (!v) return res.status(404).json({ erro: "QR Code inválido." });
    const ck = await abertoDa(v.id_veiculo);
    if (!ck) return res.status(409).json({ erro: "Registre a saída da viatura primeiro." });
    const f1 = (await query(
      "SELECT id_servidor FROM checklist_fiscal_servidor WHERE id_checklist = $1 AND tipo = 'FISCAL_1'", [ck.id_checklist])).rows[0];
    const { data } = agoraBr();
    // A OS nasce PENDENTE: a Fiscalizacao pede, o Frotas completa (18/10).
    const { rows } = await query(
      `INSERT INTO ordem_servico (id_veiculo, origem, id_registro_origem, gravidade, id_servidor_solicitante,
         momento, tipo, status, descricao, quilometragem, data_ocorrido)
       VALUES ($1,'CHECKLIST_FISCALIZACAO',$2,$3,$4,$5,'CORRETIVA','PENDENTE',$6,$7,$8)
       RETURNING id_os, numero, descricao, gravidade, momento, status, data_abertura`,
      [v.id_veiculo, ck.id_checklist, gravidade, f1?.id_servidor ?? null, momento === "CHEGADA" ? "CHEGADA" : "SAIDA",
       String(descricao).trim().slice(0, 1000), ck.odometro_saida, data]);
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// ------------------------------------------------------------------- fotos
router.post("/:token/fotos", corpoDeFoto, async (req, res, next) => {
  const cliente = await pool.connect();
  try {
    const momento = String(req.body?.momento || "").toUpperCase();
    const fotos = Array.isArray(req.body?.fotos) ? req.body.fotos : [];
    if (!["SAIDA", "SERVICO", "CHEGADA"].includes(momento)) return res.status(400).json({ erro: "Momento inválido." });
    if (!fotos.length) return res.status(400).json({ erro: "Nenhuma foto recebida." });
    const v = await viaturaDoToken(req.params.token, cliente);
    if (!v) return res.status(404).json({ erro: "QR Code inválido." });
    const ck = await abertoDa(v.id_veiculo, cliente);
    if (!ck) return res.status(409).json({ erro: "Nenhum checklist aberto para esta viatura." });
    const ja = (await cliente.query(
      "SELECT COUNT(*)::int AS n FROM checklist_fiscal_foto WHERE id_checklist = $1 AND momento = $2",
      [ck.id_checklist, momento])).rows[0].n;
    if (ja + fotos.length > MAX_FOTOS) return res.status(400).json({ erro: `No máximo ${MAX_FOTOS} fotos por etapa.` });
    await cliente.query("BEGIN");
    for (const dataUrl of fotos) {
      const arq = lerDataUrl(dataUrl);
      if (!arq) {
        await cliente.query("ROLLBACK");
        return res.status(400).json({ erro: "Formato de imagem não aceito. Use JPEG, PNG ou WebP até 3 MB." });
      }
      await cliente.query(
        "INSERT INTO checklist_fiscal_foto (id_checklist, momento, tipo, bytes, conteudo) VALUES ($1,$2,$3,$4,$5)",
        [ck.id_checklist, momento, arq.tipo, arq.buffer.length, arq.buffer]);
    }
    await cliente.query("COMMIT");
    res.status(201).json({ ok: true });
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    next(e);
  } finally {
    cliente.release();
  }
});

// ---------------------------------------------------- observacoes da equipe
router.put("/:token/observacoes", async (req, res, next) => {
  try {
    const v = await viaturaDoToken(req.params.token);
    if (!v) return res.status(404).json({ erro: "QR Code inválido." });
    const ck = await abertoDa(v.id_veiculo);
    if (!ck) return res.status(409).json({ erro: "Nenhum checklist aberto para esta viatura." });
    await query("UPDATE checklist_fiscalizacao SET observacoes_equipe = $2 WHERE id_checklist = $1",
      [ck.id_checklist, String(req.body?.observacoes_equipe || "").slice(0, 500) || null]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ----------------------------------------------------- chegada e finalizar
router.post("/:token/finalizar", async (req, res, next) => {
  const cliente = await pool.connect();
  try {
    const { hora_chegada, odometro_chegada, equipamentos, observacoes_chegada } = req.body || {};
    if (odometro_chegada === undefined || odometro_chegada === "") return res.status(400).json({ erro: "Informe o KM de chegada." });
    await cliente.query("BEGIN");
    const v = await viaturaDoToken(req.params.token, cliente);
    if (!v) { await cliente.query("ROLLBACK"); return res.status(404).json({ erro: "QR Code inválido." }); }
    const ck = await abertoDa(v.id_veiculo, cliente, true);
    if (!ck) { await cliente.query("ROLLBACK"); return res.status(409).json({ erro: "Nenhum checklist aberto para esta viatura." }); }
    if (Number(odometro_chegada) <= ck.odometro_saida) {
      await cliente.query("ROLLBACK");
      return res.status(400).json({ erro: `O KM de chegada precisa ser maior que o de saída (${ck.odometro_saida} km).` });
    }
    for (const e of Array.isArray(equipamentos) ? equipamentos : []) {
      if (!e?.id_equipamento) continue;
      await cliente.query(
        `INSERT INTO checklist_fiscal_equipamento (id_checklist, id_equipamento, etapa, quantidade, observacao)
         VALUES ($1,$2,'CHEGADA',$3,$4)
         ON CONFLICT DO NOTHING`,
        [ck.id_checklist, Number(e.id_equipamento), Math.max(0, Number(e.quantidade) || 0), e.observacao || null]);
    }
    const { data, hora } = agoraBr();
    const chegada = /^\d{2}:\d{2}/.test(hora_chegada || "") ? String(hora_chegada).slice(0, 5) : hora;
    await cliente.query(
      `UPDATE checklist_fiscalizacao
          SET hora_chegada = $2, odometro_chegada = $3, observacoes_chegada = $4,
              data_finalizacao = $5, status = 'FINALIZADO'
        WHERE id_checklist = $1`,
      [ck.id_checklist, chegada, Number(odometro_chegada),
       observacoes_chegada ? String(observacoes_chegada).slice(0, 500) : null, `${data} ${hora}:00`]);
    // Finalizar o checklist encerra o servico da equipe; sem outra equipe em
    // servico, o servico do turno tambem e encerrado.
    await cliente.query(
      `UPDATE servico_equipe SET status = 'FINALIZADA', hora_fim = $3::time
        WHERE id_servico_diario = $1 AND id_equipe = $2 AND status IN ('ATIVA', 'EM_SERVICO')`,
      [ck.id_servico_diario, ck.id_equipe, chegada]);
    await fecharTurnoSeAcabou(cliente, ck.id_servico_diario);
    await cliente.query("COMMIT");
    res.json({ ok: true, id_checklist: ck.id_checklist });
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    next(e);
  } finally {
    cliente.release();
  }
});

// ------------------------------------- fotos na tela de detalhes (com login)
router.get("/fotos/checklist/:id", autenticar, async (req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT id_foto, momento, tipo, bytes, criado_em FROM checklist_fiscal_foto WHERE id_checklist = $1 ORDER BY momento, id_foto",
      [Number(req.params.id)]);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});
router.get("/fotos/arquivo/:id", autenticar, async (req, res, next) => {
  try {
    const { rows } = await query("SELECT tipo, conteudo FROM checklist_fiscal_foto WHERE id_foto = $1", [Number(req.params.id)]);
    if (!rows[0]) return res.status(404).json({ erro: "Foto não encontrada." });
    res.setHeader("Content-Type", rows[0].tipo);
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    res.send(rows[0].conteudo);
  } catch (e) {
    next(e);
  }
});

export default router;
