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
      if (!veiculo.rows[0]) return res.status(404).json({ erro: "Veículo não encontrado" });

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
    if (!veiculo) return res.status(404).json({ erro: "QR Code inválido." });
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
// Busca do condutor pela matricula, no patio, pelo celular.
//
// POR QUE A COMPARACAO NAO E `matricula = $1`
// -------------------------------------------
// Era, e por isso a tela "nao puxava" ninguem. A igualdade exata exige que o
// que a pessoa digita seja caractere por caractere o que esta gravado, e no
// cadastro real isso quase nunca acontece:
//
//   gravado "012548"  -> a pessoa digita "12548"   (zero a esquerda)
//   gravado "12548 "  -> sobrou um espaco na importacao
//   gravado "12.548"  -> alguem cadastrou com ponto
//   gravado "A-1234"  -> a pessoa digita "a1234"
//
// Nenhum desses e erro de quem esta segurando o celular, mas todos davam
// "Matricula nao encontrada" - e a saida do veiculo parava ali.
//
// A normalizacao joga os dois lados no mesmo formato: so letras e numeros,
// maiusculas, sem zero a esquerda. Continua sendo comparacao exata DEPOIS de
// normalizar, entao nao ha risco de trazer o servidor errado por semelhanca.
const NORMALIZAR = `NULLIF(regexp_replace(upper(regexp_replace($1, '[^a-zA-Z0-9]', '', 'g')), '^0+', ''), '')`;
const NORMALIZAR_COLUNA = `NULLIF(regexp_replace(upper(regexp_replace(matricula, '[^a-zA-Z0-9]', '', 'g')), '^0+', ''), '')`;

// O TOKEN DO QR CODE E EXIGIDO AQUI, e nao so a matricula.
//
// Antes bastava a matricula, e a rota e publica por necessidade - quem
// consulta e o motorista no patio, sem login. So que a matricula e um numero
// curto: dava para varrer de 00000 a 99999 e colher NOME, NUMERO DA CNH e
// DATA DE NASCIMENTO de toda a folha da CMTT. E o conjunto exato usado em
// fraude de identidade, e um vazamento desses e comunicavel a ANPD pela LGPD.
//
// O token do QR Code sao 24 bytes aleatorios, impossiveis de adivinhar. Quem
// esta com o veiculo na mao tem o adesivo; quem esta varrendo a internet nao
// tem. A consulta continua funcionando para quem precisa dela e deixa de
// funcionar para quem nao precisa.
router.get("/condutor/:token/:matricula", async (req, res, next) => {
  try {
    const qr = await query(
      "SELECT 1 FROM qr_code WHERE token = $1 AND status = TRUE",
      [req.params.token]
    );
    if (!qr.rows[0]) return res.status(404).json({ erro: "QR Code inválido." });

    const digitada = String(req.params.matricula || "").trim();
    if (!digitada) return res.status(400).json({ erro: "Informe a matrícula." });

    // O status NAO entra no WHERE de proposito. Um servidor inativo tem que
    // ser ENCONTRADO para poder ser recusado com o motivo certo: dizer
    // "matricula nao encontrada" a quem esta com a chave na mao manda a pessoa
    // conferir o numero que ja esta certo, quando o que houve foi uma baixa no
    // cadastro. Sao problemas diferentes e levam a acoes diferentes.
    const { rows } = await query(
      `SELECT id_servidor, nome, matricula, cnh, categoria_cnh,
              data_nascimento, status, condutor
         FROM servidor
        WHERE matricula = $1 OR ${NORMALIZAR_COLUNA} = ${NORMALIZAR}
        ORDER BY (matricula = $1) DESC`,
      [digitada]
    );

    if (rows.length === 0) {
      return res.status(404).json({ erro: "Matrícula não encontrada." });
    }

    // Duas matriculas diferentes podem virar a mesma coisa depois de
    // normalizadas ("012548" e "12.548"). Escolher uma calada seria atribuir a
    // saida do veiculo a pessoa errada, e este registro e o que responde
    // "quem estava com o carro" depois de um sinistro ou de uma multa.
    // Quando ha duvida, quem decide e quem esta ali - nao o servidor.
    const exata = rows.find((r) => r.matricula === digitada);
    if (!exata && rows.length > 1) {
      return res.status(409).json({
        erro:
          "Mais de um servidor com matricula parecida: " +
          rows.map((r) => r.matricula).join(", ") +
          ". Digite a matricula exatamente como esta no cracha.",
      });
    }

    const s = exata || rows[0];

    if (!s.status) {
      return res.status(409).json({
        erro: `A matricula ${s.matricula} esta inativa no cadastro. Procure a administracao.`,
      });
    }

    res.json(s);
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
      return res.status(400).json({ erro: "Informe a matrícula e o KM de saida." });
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
      return res.status(404).json({ erro: "QR Code inválido." });
    }
    const veiculo = qr.rows[0];

    if (veiculo.status === "EM_MANUTENCAO" || veiculo.status === "INATIVO") {
      await cliente.query("ROLLBACK");
      return res.status(409).json({
        erro: "Este veículo não esta liberado para uso. Procure a gestão da frota.",
      });
    }

    const servidor = await cliente.query(
      "SELECT id_servidor FROM servidor WHERE matricula = $1 AND status = TRUE",
      [String(matricula).trim()]
    );
    if (!servidor.rows[0]) {
      await cliente.query("ROLLBACK");
      return res.status(404).json({ erro: "Matrícula não encontrada." });
    }

    // Um veiculo nao pode ter dois checklists abertos ao mesmo tempo.
    const jaAberto = await cliente.query(
      "SELECT id_checklist FROM checklist_frotas WHERE id_veiculo = $1 AND status = 'ABERTO'",
      [veiculo.id_veiculo]
    );
    if (jaAberto.rows[0]) {
      await cliente.query("ROLLBACK");
      return res.status(409).json({
        erro: "Ja existe um checklist aberto para este veículo. Registre a chegada primeiro.",
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
      return res.status(404).json({ erro: "Nenhum checklist aberto para este veículo." });
    }
    const checklist = aberto.rows[0];

    // MAIOR, nao "maior ou igual": um veiculo que saiu e voltou rodou alguma
    // coisa. KM identico ao da saida e quase sempre erro de digitacao ou uma
    // retirada desfeita - e nesse caso o certo e cancelar o checklist, nao
    // fecha-lo com zero.
    if (Number(odometro_chegada) <= checklist.odometro_saida) {
      await cliente.query("ROLLBACK");
      return res.status(400).json({
        erro: `O KM de chegada precisa ser maior que o de saida (${checklist.odometro_saida} km).`,
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
    if (!rows[0]) return res.status(404).json({ erro: "Este veículo ainda não tem QR Code." });

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
      return res.status(400).json({ erro: "Momento inválido." });
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
      return res.status(404).json({ erro: "Nenhum checklist para este veículo." });
    }
    const idChecklist = rows[0].id_checklist;

    const gravadas = [];
    for (const dataUrl of fotos) {
      const arquivo = lerDataUrl(dataUrl);
      if (!arquivo) {
        await cliente.query("ROLLBACK");
        return res.status(400).json({
          erro: "Formato de imagem não aceito. Use JPEG, PNG ou WebP até 3 MB.",
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
    if (!rows[0]) return res.status(404).json({ erro: "Foto não encontrada." });
    res.setHeader("Content-Type", rows[0].tipo);
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    res.send(rows[0].conteudo);
  } catch (e) {
    next(e);
  }
});

/* ============================================================
 * CHAMADO DE MANUTENCAO ABERTO PELO CONDUTOR
 * ============================================================
 * E MECANICA, nao equipamento: pneu furado, farol queimado, freio falhando,
 * barulho no motor. A falta de um macaco nao vira chamado - vira item ausente
 * no proprio checklist.
 *
 * A OS nasce com origem 'CHECKLIST_FROTAS' e id_registro_origem = id_checklist,
 * que e o vinculo que a tela de detalhes usa para listar os chamados daquele
 * checklist. Quem abriu e um SERVIDOR (o condutor), nao um usuario logado -
 * por isso id_servidor_solicitante.
 *
 * A rota e publica pelo mesmo motivo do resto do fluxo: a credencial e o token
 * do QR Code. Mesmo assim o checklist informado tem de ser DAQUELE veiculo -
 * senao um token valido abriria chamado no registro de outro carro.
 */
const PARTES_VEICULO = [
  "PNEUS", "FREIOS", "ILUMINACAO", "MOTOR", "SUSPENSAO",
  "ELETRICA", "AR_CONDICIONADO", "OUTRO",
];
const GRAVIDADES_CHAMADO = ["BAIXA", "MEDIA", "ALTA"];

async function checklistDoToken(token, idChecklist) {
  const { rows } = await query(
    `SELECT c.id_checklist, c.id_veiculo, c.id_servidor, c.status
       FROM qr_code q
       JOIN checklist_frotas c ON c.id_veiculo = q.id_veiculo
      WHERE q.token = $1 AND q.status = TRUE AND c.id_checklist = $2`,
    [token, Number(idChecklist)]
  );
  return rows[0] || null;
}

// Lista os chamados de um checklist. Serve a tela do condutor, que mostra
// "Chamados deste checklist" logo abaixo do botao de abrir.
router.get("/chamados/:token/:idChecklist", async (req, res, next) => {
  try {
    const checklist = await checklistDoToken(req.params.token, req.params.idChecklist);
    if (!checklist) {
      return res.status(404).json({ erro: "Checklist não encontrado para este QR Code." });
    }

    const { rows } = await query(
      `SELECT id_os, numero, parte_veiculo, gravidade, descricao, status,
              momento, data_abertura
         FROM ordem_servico
        WHERE origem = 'CHECKLIST_FROTAS' AND id_registro_origem = $1
        ORDER BY data_abertura`,
      [checklist.id_checklist]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post("/chamado/:token", async (req, res, next) => {
  try {
    const { id_checklist, parte_veiculo, gravidade, descricao, momento } = req.body || {};

    if (!id_checklist || !descricao || !String(descricao).trim()) {
      return res.status(400).json({ erro: "Descreva o problema para abrir o chamado." });
    }
    if (!PARTES_VEICULO.includes(parte_veiculo)) {
      return res.status(400).json({ erro: "Escolha a parte do veículo." });
    }
    if (!GRAVIDADES_CHAMADO.includes(gravidade)) {
      return res.status(400).json({ erro: "Escolha a urgencia do chamado." });
    }
    const quando = momento === "CHEGADA" ? "CHEGADA" : "SAIDA";

    const checklist = await checklistDoToken(req.params.token, id_checklist);
    if (!checklist) {
      return res.status(404).json({ erro: "Checklist não encontrado para este QR Code." });
    }

    // O numero da OS e do ANO, sequencial: 2026-0001. Contamos as do ano
    // corrente e somamos um. Duas aberturas no mesmo segundo podem disputar o
    // mesmo numero; e um rotulo de leitura, nao a chave do registro, entao
    // repetir e menos grave que travar a abertura do chamado no patio.
    const { rows: seq } = await query(
      `SELECT COUNT(*)::int + 1 AS proximo
         FROM ordem_servico
        WHERE EXTRACT(YEAR FROM data_abertura) = EXTRACT(YEAR FROM CURRENT_DATE)`
    );
    const numeroOs = `${new Date().getFullYear()}-${String(seq[0].proximo).padStart(4, "0")}`;

    const { rows } = await query(
      `INSERT INTO ordem_servico
         (id_veiculo, origem, id_registro_origem, gravidade, id_servidor_solicitante,
          parte_veiculo, momento, tipo, status, descricao, numero)
       VALUES ($1, 'CHECKLIST_FROTAS', $2, $3, $4, $5, $6, 'CORRETIVA', 'EM_ANALISE', $7, $8)
       RETURNING id_os, numero, parte_veiculo, gravidade, descricao, status,
                 momento, data_abertura`,
      [
        checklist.id_veiculo, checklist.id_checklist, gravidade, checklist.id_servidor,
        parte_veiculo, quando, String(descricao).trim(), numeroOs,
      ]
    );

    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

export default router;
