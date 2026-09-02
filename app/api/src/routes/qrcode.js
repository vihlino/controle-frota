/**
 * qrcode.js - O fluxo do checklist pelo QR Code.
 *
 * COMO FUNCIONA
 * -------------
 *   1. A gestao gera o QR Code do veiculo e cola o adesivo nele.
 *   2. O condutor aponta a camera e cai na tela /checklist/<token>.
 *   3. Informa a matricula, o KM e o percurso, confere os equipamentos e
 *      registra a SAIDA. O veiculo passa para EM_USO.
 *   4. Ao voltar, le o MESMO QR Code, informa o KM de chegada e o checklist
 *      fecha. O veiculo volta para DISPONIVEL.
 *
 * POR QUE AS ROTAS SAO PUBLICAS
 * -----------------------------
 * O condutor preenche isso no celular, no patio, sem login. A credencial e o
 * token do QR Code (24 bytes aleatorios, impossivel de adivinhar) somado a
 * matricula, que identifica quem esta saindo. Por isso nao existe botao de
 * "novo checklist" nas telas administrativas: o registro sempre nasce do QR.
 *
 * SOBRE O ODOMETRO
 * ----------------
 * O banco tem um gatilho que exige odometro sempre crescente, comparando com o
 * MAIOR valor ja registrado do veiculo. A funcao ultimoOdometro() abaixo
 * reproduz esse calculo, para a tela mostrar exatamente o mesmo numero - senao
 * o condutor digitaria um KM que parece valido e levaria erro.
 */
import { Router, json } from "express";
import crypto from "node:crypto";
import QRCode from "qrcode";
import { query, pool } from "../db.js";
import { autenticar, exigePermissao } from "../auth.js";
import { registrarAuditoria } from "../auditoria.js";

// O banco valida a saida contra o MAIOR odometro ja registrado do veiculo
// (quilometragem_atual ou qualquer odometro de checklist). A tela precisa
// mostrar exatamente esse numero, senao o condutor digita um KM valido aos
// olhos dele e leva erro.
async function ultimoOdometro(idVeiculo) {
  const { rows } = await query(
    `SELECT GREATEST(
              COALESCE(v.quilometragem_atual, 0),
              COALESCE((
                SELECT MAX(o) FROM (
                  SELECT odometro_saida   AS o FROM checklist_frotas WHERE id_veiculo = v.id_veiculo
                  UNION ALL
                  SELECT odometro_chegada     FROM checklist_frotas WHERE id_veiculo = v.id_veiculo
                  UNION ALL
                  SELECT odometro_saida       FROM checklist_fiscalizacao WHERE id_veiculo = v.id_veiculo
                  UNION ALL
                  SELECT odometro_chegada     FROM checklist_fiscalizacao WHERE id_veiculo = v.id_veiculo
                ) x
              ), 0)
            ) AS km
       FROM veiculo v WHERE v.id_veiculo = $1`,
    [idVeiculo]
  );
  return rows[0]?.km ?? 0;
}

const router = Router();

// Gera (ou devolve) o QR Code do veiculo. O codigo e legivel e vai impresso
// no adesivo; o token e o segredo que abre o checklist sem login.
router.post("/veiculo/:id", autenticar, exigePermissao("FROTAS_GERENCIAR_VEICULOS"),
  async (req, res, next) => {
    try {
      const idVeiculo = Number(req.params.id);

      const existente = await query("SELECT * FROM qr_code WHERE id_veiculo = $1", [idVeiculo]);
      if (existente.rows[0]) return res.json(existente.rows[0]);

      const veiculo = await query("SELECT placa FROM veiculo WHERE id_veiculo = $1", [idVeiculo]);
      if (!veiculo.rows[0]) return res.status(404).json({ erro: "Veiculo nao encontrado" });

      const codigo = `SITRA-${veiculo.rows[0].placa.replace(/[^A-Z0-9]/gi, "").toUpperCase()}`;
      const token = crypto.randomBytes(24).toString("hex");

      const { rows } = await query(
        `INSERT INTO qr_code (id_veiculo, codigo, token) VALUES ($1, $2, $3) RETURNING *`,
        [idVeiculo, codigo, token]
      );

      await registrarAuditoria({
        idUsuario: req.usuario.id_usuario,
        acao: "GERAR_QRCODE",
        entidade: "veiculo",
        idRegistro: idVeiculo,
        dadosNovos: { codigo },
      });

      res.status(201).json(rows[0]);
    } catch (e) {
      next(e);
    }
  }
);

// Leitura do QR Code: devolve o veiculo e o checklist em aberto, se houver.
// Rota publica de proposito - o condutor abre pelo celular, sem login. O token
// do QR Code e a credencial.
router.get("/ler/:token", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT v.id_veiculo, v.placa, v.marca, v.modelo, v.cor, v.renavam, v.chassi,
              v.ano_fabricacao, v.ano_modelo, v.quilometragem_atual, v.status,
              s.nome AS setor, q.status AS qr_ativo
         FROM qr_code q
         JOIN veiculo v ON v.id_veiculo = q.id_veiculo
         JOIN setor   s ON s.id_setor   = v.id_setor
        WHERE q.token = $1`,
      [req.params.token]
    );
    const veiculo = rows[0];
    if (!veiculo) return res.status(404).json({ erro: "QR Code invalido." });
    if (!veiculo.qr_ativo) return res.status(410).json({ erro: "QR Code desativado." });

    const aberto = await query(
      `SELECT c.*, s.nome AS condutor, s.matricula, s.data_nascimento
         FROM checklist_frotas c
         JOIN servidor s ON s.id_servidor = c.id_servidor
        WHERE c.id_veiculo = $1 AND c.status = 'ABERTO'
        ORDER BY c.data_abertura DESC, c.hora_saida DESC
        LIMIT 1`,
      [veiculo.id_veiculo]
    );

    const equipamentos = await query(
      "SELECT nome FROM equipamento WHERE status = TRUE ORDER BY id_equipamento"
    );

    res.json({
      veiculo: { ...veiculo, quilometragem_atual: await ultimoOdometro(veiculo.id_veiculo) },
      checklistAberto: aberto.rows[0] || null,
      equipamentos: equipamentos.rows.map((e) => e.nome),
    });
  } catch (e) {
    next(e);
  }
});

// Confere a matricula do condutor antes de abrir o checklist.
router.get("/condutor/:matricula", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id_servidor, nome, matricula, cnh, categoria_cnh, data_nascimento
         FROM servidor WHERE matricula = $1 AND status = TRUE`,
      [String(req.params.matricula).trim()]
    );
    if (!rows[0]) return res.status(404).json({ erro: "Matricula nao encontrada." });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// Saida do veiculo: abre o checklist e marca o veiculo como em uso.
router.post("/saida/:token", async (req, res, next) => {
  const cliente = await pool.connect();
  try {
    const { matricula, odometro_saida, percurso, local_saida, observacoes, equipamentos } = req.body;

    if (!matricula || odometro_saida === undefined) {
      return res.status(400).json({ erro: "Informe a matricula e o KM de saida." });
    }

    await cliente.query("BEGIN");

    const qr = await cliente.query(
      `SELECT v.id_veiculo, v.quilometragem_atual, v.status
         FROM qr_code q JOIN veiculo v ON v.id_veiculo = q.id_veiculo
        WHERE q.token = $1 AND q.status = TRUE
        FOR UPDATE OF v`,
      [req.params.token]
    );
    if (!qr.rows[0]) {
      await cliente.query("ROLLBACK");
      return res.status(404).json({ erro: "QR Code invalido." });
    }
    const veiculo = qr.rows[0];

    if (veiculo.status === "EM_MANUTENCAO" || veiculo.status === "INATIVO") {
      await cliente.query("ROLLBACK");
      return res.status(409).json({
        erro: "Este veiculo nao esta liberado para uso. Procure a gestao da frota.",
      });
    }

    const servidor = await cliente.query(
      "SELECT id_servidor FROM servidor WHERE matricula = $1 AND status = TRUE",
      [String(matricula).trim()]
    );
    if (!servidor.rows[0]) {
      await cliente.query("ROLLBACK");
      return res.status(404).json({ erro: "Matricula nao encontrada." });
    }

    // Um veiculo nao pode ter dois checklists abertos ao mesmo tempo.
    const jaAberto = await cliente.query(
      "SELECT id_checklist FROM checklist_frotas WHERE id_veiculo = $1 AND status = 'ABERTO'",
      [veiculo.id_veiculo]
    );
    if (jaAberto.rows[0]) {
      await cliente.query("ROLLBACK");
      return res.status(409).json({
        erro: "Ja existe um checklist aberto para este veiculo. Registre a chegada primeiro.",
      });
    }

    const checklist = await cliente.query(
      `INSERT INTO checklist_frotas
         (id_veiculo, id_servidor, odometro_saida, percurso, local_saida, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        veiculo.id_veiculo, servidor.rows[0].id_servidor, Number(odometro_saida),
        percurso, local_saida || null, observacoes || null,
      ]
    );

    // Equipamentos obrigatorios: macaco, estepe, triangulo e chave de roda.
    for (const item of equipamentos || []) {
      await cliente.query(
        `INSERT INTO checklist_frotas_equipamento
           (id_checklist, equipamento, conforme, observacao, momento)
         VALUES ($1, $2, $3, $4, 'SAIDA')`,
        [checklist.rows[0].id_checklist, item.equipamento, !!item.conforme, item.observacao || null]
      );
    }

    await cliente.query(
      "UPDATE veiculo SET status = 'EM_USO', quilometragem_atual = $2 WHERE id_veiculo = $1",
      [veiculo.id_veiculo, Number(odometro_saida)]
    );

    await cliente.query("COMMIT");
    res.status(201).json(checklist.rows[0]);
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    next(e);
  } finally {
    cliente.release();
  }
});

// Chegada do veiculo: fecha o checklist e devolve o veiculo para disponivel.
router.post("/chegada/:token", async (req, res, next) => {
  const cliente = await pool.connect();
  try {
    const {
      odometro_chegada, observacoes, percurso,
      data_chegada, hora_chegada, equipamentos,
    } = req.body;
    if (odometro_chegada === undefined) {
      return res.status(400).json({ erro: "Informe o KM de chegada." });
    }

    await cliente.query("BEGIN");

    const aberto = await cliente.query(
      `SELECT c.id_checklist, c.odometro_saida, c.id_veiculo
         FROM qr_code q
         JOIN checklist_frotas c ON c.id_veiculo = q.id_veiculo AND c.status = 'ABERTO'
        WHERE q.token = $1
        FOR UPDATE OF c`,
      [req.params.token]
    );
    if (!aberto.rows[0]) {
      await cliente.query("ROLLBACK");
      return res.status(404).json({ erro: "Nenhum checklist aberto para este veiculo." });
    }
    const checklist = aberto.rows[0];

    if (Number(odometro_chegada) < checklist.odometro_saida) {
      await cliente.query("ROLLBACK");
      return res.status(400).json({
        erro: `O KM de chegada nao pode ser menor que o de saida (${checklist.odometro_saida} km).`,
      });
    }

    const { rows } = await cliente.query(
      `UPDATE checklist_frotas
          SET odometro_chegada = $2,
              data_devolucao = COALESCE($3::date, CURRENT_DATE),
              hora_chegada   = COALESCE($4::time, CURRENT_TIME),
              data_finalizacao = CURRENT_TIMESTAMP,
              status = 'FINALIZADO',
              percurso = COALESCE($5, percurso),
              observacoes_chegada = $6
        WHERE id_checklist = $1
        RETURNING *`,
      [
        checklist.id_checklist,
        Number(odometro_chegada),
        data_chegada || null,
        hora_chegada || null,
        percurso || null,
        observacoes || null,
      ]
    );

    // Conferencia dos equipamentos na volta. E o que permite saber se um item
    // sumiu durante o uso: a mesma lista foi gravada na saida com momento
    // 'SAIDA'.
    for (const item of equipamentos || []) {
      await cliente.query(
        `INSERT INTO checklist_frotas_equipamento
           (id_checklist, equipamento, conforme, observacao, momento)
         VALUES ($1, $2, $3, $4, 'CHEGADA')
         ON CONFLICT (id_checklist, equipamento, momento) DO UPDATE
           SET conforme = EXCLUDED.conforme, observacao = EXCLUDED.observacao`,
        [checklist.id_checklist, item.equipamento, !!item.conforme, item.observacao || null]
      );
    }

    await cliente.query(
      "UPDATE veiculo SET status = 'DISPONIVEL', quilometragem_atual = $2 WHERE id_veiculo = $1",
      [checklist.id_veiculo, Number(odometro_chegada)]
    );

    await cliente.query("COMMIT");
    res.json(rows[0]);
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    next(e);
  } finally {
    cliente.release();
  }
});

// Imagem do QR Code do veiculo, em PNG base64, pronta para exibir e imprimir.
// O conteudo do codigo e a URL do checklist, para a camera do celular abrir
// direto no formulario.
router.get("/imagem/:idVeiculo", autenticar, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT q.codigo, q.token, v.placa, v.marca, v.modelo
         FROM qr_code q JOIN veiculo v ON v.id_veiculo = q.id_veiculo
        WHERE q.id_veiculo = $1`,
      [Number(req.params.idVeiculo)]
    );
    if (!rows[0]) return res.status(404).json({ erro: "Este veiculo ainda nao tem QR Code." });

    const base = process.env.URL_PUBLICA || "http://localhost:5173";
    const url = `${base}/checklist/${rows[0].token}`;

    const imagem = await QRCode.toDataURL(url, {
      width: 480,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0d0d0d", light: "#ffffff" },
    });

    res.json({ ...rows[0], url, imagem });
  } catch (e) {
    next(e);
  }
});

// ============================================================================
// FOTOS DO CHECKLIST
// ============================================================================
// O binario fica no Postgres, nao em disco: o servico da API no Render usa
// disco efemero, entao arquivo gravado ali some no proximo deploy.
//
// O navegador ja envia a imagem REDUZIDA (lado maior 1600px, JPEG). Aqui so
// conferimos o formato, o tipo e o tamanho antes de gravar.

const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"];
const LIMITE_FOTO = 3 * 1024 * 1024; // 3 MB, o mesmo do CHECK no banco
const MAX_FOTOS = 6;

// O corpo destas rotas carrega uma imagem em base64, que passa do limite de
// 1mb aplicado ao resto da API. O limite maior vale SO aqui.
const corpoDeFoto = json({ limit: "8mb" });

/**
 * Converte a data URL que o navegador manda em { tipo, buffer }.
 * Devolve null se o formato nao for o esperado.
 */
function lerDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") return null;
  const m = /^data:([a-z/+.-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  const tipo = m[1].toLowerCase();
  if (!TIPOS_ACEITOS.includes(tipo)) return null;
  const buffer = Buffer.from(m[2], "base64");
  if (!buffer.length || buffer.length > LIMITE_FOTO) return null;
  return { tipo, buffer };
}

/**
 * Anexa fotos ao checklist ABERTO do veiculo. Publica, como o resto do fluxo
 * do QR Code: a credencial e o token.
 *
 * Corpo: { momento: "SAIDA" | "CHEGADA", fotos: [dataUrl, ...] }
 */
router.post("/foto/:token", corpoDeFoto, async (req, res, next) => {
  const cliente = await pool.connect();
  try {
    const momento = String(req.body?.momento || "").toUpperCase();
    const fotos = Array.isArray(req.body?.fotos) ? req.body.fotos : [];

    if (!["SAIDA", "CHEGADA"].includes(momento)) {
      return res.status(400).json({ erro: "Momento invalido." });
    }
    if (!fotos.length) return res.status(400).json({ erro: "Nenhuma foto recebida." });
    if (fotos.length > MAX_FOTOS) {
      return res.status(400).json({ erro: `No maximo ${MAX_FOTOS} fotos por envio.` });
    }

    await cliente.query("BEGIN");

    // Na SAIDA o checklist esta ABERTO. Na CHEGADA ele acabou de ser fechado,
    // entao pegamos o mais recente do veiculo.
    const { rows } = await cliente.query(
      `SELECT c.id_checklist
         FROM qr_code q
         JOIN checklist_frotas c ON c.id_veiculo = q.id_veiculo
        WHERE q.token = $1
          AND ($2 = 'CHEGADA' OR c.status = 'ABERTO')
        ORDER BY c.id_checklist DESC
        LIMIT 1`,
      [req.params.token, momento]
    );
    if (!rows[0]) {
      await cliente.query("ROLLBACK");
      return res.status(404).json({ erro: "Nenhum checklist para este veiculo." });
    }
    const idChecklist = rows[0].id_checklist;

    const gravadas = [];
    for (const dataUrl of fotos) {
      const arquivo = lerDataUrl(dataUrl);
      if (!arquivo) {
        await cliente.query("ROLLBACK");
        return res.status(400).json({
          erro: "Formato de imagem nao aceito. Use JPEG, PNG ou WebP ate 3 MB.",
        });
      }
      const r = await cliente.query(
        `INSERT INTO checklist_frotas_foto (id_checklist, momento, tipo, bytes, conteudo)
         VALUES ($1, $2, $3, $4, $5) RETURNING id_foto`,
        [idChecklist, momento, arquivo.tipo, arquivo.buffer.length, arquivo.buffer]
      );
      gravadas.push(r.rows[0].id_foto);
    }

    await cliente.query("COMMIT");
    res.status(201).json({ id_checklist: idChecklist, fotos: gravadas });
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    next(e);
  } finally {
    cliente.release();
  }
});

/**
 * Lista as fotos de um checklist (so os metadados - o binario vem na rota
 * abaixo, uma por vez, para o navegador poder cachear cada imagem).
 */
router.get("/fotos/checklist/:idChecklist", autenticar, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id_foto, momento, tipo, bytes, criado_em
         FROM checklist_frotas_foto
        WHERE id_checklist = $1
        ORDER BY momento DESC, id_foto`,
      [Number(req.params.idChecklist)]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

/**
 * Serve o binario de uma foto.
 */
router.get("/foto/arquivo/:idFoto", autenticar, async (req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT tipo, conteudo FROM checklist_frotas_foto WHERE id_foto = $1",
      [Number(req.params.idFoto)]
    );
    if (!rows[0]) return res.status(404).json({ erro: "Foto nao encontrada." });
    res.setHeader("Content-Type", rows[0].tipo);
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    res.send(rows[0].conteudo);
  } catch (e) {
    next(e);
  }
});

export default router;
