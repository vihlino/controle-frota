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
import { urlPublica } from "../urlPublica.js";

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
      if (!veiculo.rows[0]) return res.status(404).json({ erro: "Veículo não encontrado." });

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
      return res.status(400).json({ erro: "Informe a matrícula e o KM de saída." });
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

    // Em desenvolvimento isto devolve o IP desta maquina na rede local, e nao
    // "localhost": localhost no celular aponta para o proprio celular, e o QR
    // Code abriria uma tela de erro. Em producao vem de URL_PUBLICA.
    const base = urlPublica();
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
      return res.status(400).json({ erro: "Escolha a urgência do chamado." });
    }
    const quando = momento === "CHEGADA" ? "CHEGADA" : "SAIDA";

    const checklist = await checklistDoToken(req.params.token, id_checklist);
    if (!checklist) {
      return res.status(404).json({ erro: "Checklist não encontrado para este QR Code." });
    }

    // O numero da OS e do ANO, sequencial: OS-2026-00001, pelo maior numero ja
    // usado (migracao 030) - contando, apagar uma OS repetia o numero.
    const { rows: seq } = await query("SELECT proximo_numero_os() AS numero");
    const numeroOs = seq[0].numero;

    const { rows } = await query(
      `INSERT INTO ordem_servico
         (id_veiculo, origem, id_registro_origem, gravidade, id_servidor_solicitante,
          parte_veiculo, momento, tipo, status, descricao, numero, quilometragem)
       VALUES ($1, 'CHECKLIST_FROTAS', $2, $3, $4, $5, $6, 'CORRETIVA', 'EM_ANALISE', $7, $8,
               (SELECT CASE WHEN $6 = 'CHEGADA' THEN COALESCE(c.odometro_chegada, c.odometro_saida)
                            ELSE c.odometro_saida END
                  FROM checklist_frotas c WHERE c.id_checklist = $2))
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

/*
 * ===========================================================================
 * INSPECAO PERIODICA PELO CELULAR
 * ===========================================================================
 *
 * O PROBLEMA QUE ISTO RESOLVE
 * ---------------------------
 * A inspecao periodica era agendada no sistema e lembrada... por ninguem. Quem
 * tem o veiculo na mao e o condutor, no patio; quem precisa lembrar da
 * inspecao e o gestor, na frente do computador. Os dois momentos nunca se
 * encontravam, e a inspecao vencia.
 *
 * Aqui eles se encontram: no dia agendado, quando a matricula digitada no
 * checklist for a do RESPONSAVEL pela inspecao, a tela oferece faze-la ali
 * mesmo, pelo celular, com o veiculo na frente.
 *
 * TRES DECISOES QUE VALE EXPLICAR
 *
 * 1. So para o responsavel. A inspecao tem um gestor escolhido no
 *    agendamento; e ele quem responde por ela. Oferecer a qualquer condutor
 *    faria o aviso virar ruido para quem nao pode resolve-lo.
 *
 * 2. `data_programada <= hoje`, e nao `= hoje`. Inspecao atrasada nao some -
 *    ela continua aparecendo todo dia ate ser feita. Era esse o pedido, e e o
 *    comportamento certo: o aviso que desaparece sozinho e o aviso que nao
 *    serve para nada.
 *
 * 3. Responder "nao" nao grava nada. Nao ha o que gravar: a inspecao continua
 *    aberta, e amanha ela aparece de novo. Guardar a recusa so criaria uma
 *    forma de fazer o lembrete calar sem a inspecao ter acontecido.
 */

// A inspecao pendente deste veiculo para quem digitou a matricula.
// Sem pendencia, devolve null - e a tela nao mostra nada.
router.get("/inspecao/:token/:matricula", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT i.id_inspecao, i.numero, i.tipo, i.data_programada, i.local,
              i.observacoes, v.placa, v.marca, v.modelo,
              g.nome AS responsavel
         FROM inspecao i
         JOIN qr_code q   ON q.id_veiculo = i.id_veiculo
         JOIN veiculo v   ON v.id_veiculo = i.id_veiculo
         JOIN usuario u   ON u.id_usuario = i.id_gestor
         JOIN servidor g  ON g.id_servidor = u.id_servidor
        WHERE q.token = $1
          AND q.status = TRUE
          AND i.status = 'ABERTA'
          AND i.data_programada IS NOT NULL
          AND i.data_programada <= CURRENT_DATE
          -- A matricula digitada tem de ser a do responsavel pela inspecao.
          -- A comparacao usa a mesma normalizacao do resto do fluxo, senao
          -- "012548" e "12.548" seriam pessoas diferentes.
          AND (g.matricula = $2 OR ${NORMALIZAR_COLUNA.replace("matricula", "g.matricula")} = ${NORMALIZAR.replace("$1", "$2")})
        ORDER BY i.data_programada
        LIMIT 1`,
      [req.params.token, String(req.params.matricula || "").trim()]
    );
    res.json(rows[0] || null);
  } catch (e) {
    next(e);
  }
});

/*
 * Registra a inspecao feita no patio.
 *
 * A inspecao ja EXISTE (foi agendada); aqui ela e preenchida e fechada. Por
 * isso e PUT de um registro conhecido, e nao a criacao de um novo - duas
 * inspecoes para o mesmo agendamento seria o comeco de um historico que nao
 * fecha.
 *
 * Tudo em transacao: os itens e o fechamento sao a mesma coisa. Metade
 * gravada seria uma inspecao "finalizada" sem os itens que a sustentam.
 */
router.put("/inspecao/:token/:idInspecao", async (req, res, next) => {
  const cliente = await pool.connect();
  try {
    const { matricula, itens, observacoes, quilometragem } = req.body || {};
    if (!matricula) return res.status(400).json({ erro: "Informe a matrícula." });
    if (!Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ erro: "Nenhum item conferido." });
    }

    // Item fora do padrao exige observacao - a mesma regra do banco, conferida
    // aqui para a mensagem ser em portugues e nao o texto cru da restricao.
    const semMotivo = itens.find(
      (i) => i.resultado !== "NORMAL" && !String(i.observacao || "").trim()
    );
    if (semMotivo) {
      return res.status(400).json({
        erro: `Escreva o que foi observado em "${semMotivo.item}".`,
      });
    }

    await cliente.query("BEGIN");

    // A pendencia e conferida de novo aqui, e nao so na tela: quem chega por
    // esta rota pode nao ter passado por ela.
    const { rows } = await cliente.query(
      `SELECT i.id_inspecao
         FROM inspecao i
         JOIN qr_code q  ON q.id_veiculo = i.id_veiculo
         JOIN usuario u  ON u.id_usuario = i.id_gestor
         JOIN servidor g ON g.id_servidor = u.id_servidor
        WHERE q.token = $1 AND q.status = TRUE
          AND i.id_inspecao = $2
          AND i.status = 'ABERTA'
          AND (g.matricula = $3 OR ${NORMALIZAR_COLUNA.replace("matricula", "g.matricula")} = ${NORMALIZAR.replace("$1", "$3")})
        FOR UPDATE`,
      [req.params.token, Number(req.params.idInspecao), String(matricula).trim()]
    );
    if (!rows[0]) {
      await cliente.query("ROLLBACK");
      return res.status(404).json({
        erro: "Esta inspeção não está pendente para você, ou já foi concluída.",
      });
    }
    const idInspecao = rows[0].id_inspecao;

    // Refazer os itens, e nao acrescentar: se a pessoa enviar duas vezes, a
    // inspecao nao pode terminar com a lista duplicada.
    await cliente.query("DELETE FROM inspecao_item WHERE id_inspecao = $1", [idInspecao]);
    for (const item of itens) {
      await cliente.query(
        `INSERT INTO inspecao_item (id_inspecao, item, grupo, resultado, observacao)
         VALUES ($1, $2, $3, $4, $5)`,
        // O grupo vem da tela junto do item e e GRAVADO, nao deduzido: a lista
        // de itens muda com o tempo, e a ficha de uma inspecao antiga precisa
        // continuar mostrando como ela foi feita. Nulo quando a tela nao mandar.
        [idInspecao, item.item, item.grupo || null, item.resultado, item.observacao || null]
      );
    }

    // O resultado da inspecao vem dos ITENS, nao de uma escolha a parte: quem
    // marcou uma ressalva nao deveria poder declarar a inspecao conforme.
    // "Atenção" conta como ressalva: o item nao esta com defeito, mas tambem
    // nao esta igual a um que ninguem precisa olhar de novo.
    const conforme = itens.every((i) => i.resultado === "NORMAL");

    await cliente.query(
      `UPDATE inspecao
          SET status = 'FINALIZADA',
              resultado = $2,
              data_realizacao = COALESCE(data_realizacao, CURRENT_DATE),
              hora_finalizacao = CURRENT_TIME,
              data_finalizacao = CURRENT_TIMESTAMP,
              -- Os tipos vao ESCRITOS nos marcadores. Quando o valor chega
              -- nulo (a inspecao sem KM informado), o Postgres nao tem como
              -- adivinhar o tipo do parametro sozinho dentro de um COALESCE e
              -- recusa a consulta inteira - um erro que so aparece no caso
              -- nulo, que e justamente o que ninguem testa.
              quilometragem = COALESCE($3::int, quilometragem),
              observacoes = COALESCE(NULLIF($4::text, ''), observacoes)
        WHERE id_inspecao = $1`,
      [
        idInspecao,
        conforme ? "CONFORME" : "COM_AVARIAS",
        quilometragem ? Number(quilometragem) : null,
        String(observacoes || "").trim(),
      ]
    );

    await cliente.query("COMMIT");
    res.json({ ok: true, resultado: conforme ? "CONFORME" : "COM_AVARIAS" });
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    next(e);
  } finally {
    cliente.release();
  }
});

export default router;
