/**
 * seedFiscalizacao.js - Dados de exemplo da FISCALIZACAO (20/10).
 *
 * Roda com:  node src/seedFiscalizacao.js     (ou npm run seed:fisc)
 *
 * Enche o modulo inteiro para navegar com as telas preenchidas:
 *   fiscais, coordenadores, viaturas (com QR Code, equipamentos e documentos),
 *   equipes com turno, itens de pontuacao, 30 dias de servico diario (e os
 *   3 proximos programados), checklists de viatura com os 6 itens,
 *   ocorrencias com distribuicao, pontuacao, OS das viaturas (inclusive
 *   solicitacoes pendentes), multas e um sinistro.
 *
 * So ACRESCENTA: nao altera nem apaga nada do que ja existe. Servico diario
 * que ja existe no dia e turno e aproveitado (as equipes novas entram nele).
 * Roda uma vez: se a equipe EQ-CENTRO ja existe, ele para.
 *
 * Precisa das migracoes 040 a 042: suba a API uma vez antes de rodar.
 * NUNCA no sistema principal (producao): os dados sao inventados.
 */
import "dotenv/config";
import { pool } from "./db.js";

if (process.env.NODE_ENV === "production" || /quiet-darkness/i.test(process.env.PGHOST || "")) {
  console.error("Recusado: este banco e o do sistema principal (producao). Dados de exemplo nao entram la.");
  process.exit(1);
}

// ------------------------------------------------------------------ apoio
const aleatorio = (l) => l[Math.floor(Math.random() * l.length)];
const inteiro = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const chance = (p) => Math.random() < p;
const dois = (n) => String(n).padStart(2, "0");
const hojeBr = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const dataRelativa = (dias) => {
  const d = new Date(`${hojeBr()}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};
const horaEntre = (h1, m1, h2, m2) => {
  const t = inteiro(h1 * 60 + m1, h2 * 60 + m2);
  return `${dois(Math.floor(t / 60))}:${dois(t % 60)}`;
};

const FISCAIS = [
  "Ana Paula Rocha Lima", "Marcos Silva Souza", "Renata Oliveira Lima", "Carlos Eduardo Martins",
  "Fernanda Alves Pereira", "Lucas Ferreira Gomes", "Beatriz Santos Moura", "Pedro Henrique Souza",
  "Juliana Castro Mendes", "Rodrigo Teixeira Nunes", "Camila Ribeiro Duarte", "Thiago Pereira Campos",
];
const COORDENADORES = ["João Carlos Ferreira Neto", "Mariana Costa Albuquerque"];
const VIATURAS = [
  ["Renault", "Duster 1.6", "AUTOMOVEL", "FLEX", "Branco"],
  ["Fiat", "Strada Endurance 1.4", "CAMINHONETE", "FLEX", "Branco"],
  ["Chevrolet", "Spin LT 1.8", "AUTOMOVEL", "FLEX", "Prata"],
  ["Volkswagen", "Gol 1.6 MSI", "AUTOMOVEL", "FLEX", "Branco"],
  ["Toyota", "Hilux CD 4x4 SR", "CAMINHONETE", "DIESEL", "Branco"],
  ["Ford", "Ranger XLS 2.2", "CAMINHONETE", "DIESEL", "Prata"],
  ["Nissan", "Frontier S 4x4", "CAMINHONETE", "DIESEL", "Branco"],
  ["Honda", "CG 160 Titan", "MOTOCICLETA", "FLEX", "Vermelho"],
];
// Equipes: numero, turno, tipo, observacao, quantos fiscais.
const EQUIPES = [
  ["EQ-CENTRO", "DIURNO", "FIXA", "Equipe responsável pela fiscalização da região central e das áreas comerciais."],
  ["EQ-NORTE", "DIURNO", "FIXA", "Equipe da região norte e da BR-060."],
  ["EQ-SUL", "DIURNO", "FIXA", "Equipe do setor industrial e da região sul."],
  ["EQ-LESTE", "NOTURNO", "FIXA", "Equipe noturna da região leste."],
  ["EQ-OESTE", "NOTURNO", "FIXA", "Equipe noturna de bares, eventos e transporte."],
  ["EQ-APOIO", "DIURNO", "TEMPORARIA", "Equipe de apoio para eventos e operações integradas."],
];
const ITENS_EQUIP = { "Rádio": 2, "Cone": 4, "Pantográfica": 2, "Cavalete": 2, "Barreira": 2, "Macaco": 1, "Estepe": 1, "Chave de roda": 1 };
const PONTUACAO = [
  ["PT-01", "Ocorrência atendida no prazo", 10],
  ["PT-02", "Checklist de viatura completo", 5],
  ["PT-03", "Apoio a outra equipe", 8],
  ["PT-04", "Atraso na chegada ao serviço", -5],
  ["PT-05", "Viatura devolvida sem conferência", -10],
  ["PT-06", "Autuação registrada corretamente", 3],
  ["PT-07", "Equipamento devolvido danificado", -8],
  ["PT-08", "Elogio formal da população", 15],
];
const LOCAIS = [
  "Av. Brasil Sul, 1250 - Centro", "Av. Goiás, 820 - Centro", "Rua Engenheiro Portela, 410 - Centro",
  "Av. Fernando Costa, 1500 - Vila Jaiara", "Rua Barão do Rio Branco, 233 - Centro",
  "Av. Universitária, 3100 - Cidade Universitária", "Av. JK, 980 - Jundiaí", "Praça Bom Jesus - Centro",
  "Terminal Urbano - Centro", "BR-060, km 102", "Av. Pedro Ludovico, 700 - Vila Góis",
  "Rua 14 de Julho, 55 - Centro", "Av. Brasil Norte, 2100 - Setor Norte", "Distrito Agroindustrial (DAIA), Via Primária",
];
const OCORRENCIAS = [
  ["QRU", "Veículo estacionado em vaga de idoso sem credencial."],
  ["QRU", "Veículo estacionado sobre a faixa de pedestres."],
  ["QRU", "Semáforo com defeito no cruzamento, trânsito travado."],
  ["QRU", "Acidente sem vítimas, faixa da direita interditada."],
  ["QRU", "Carga e descarga fora do horário permitido."],
  ["QRU", "Veículo abandonado em via pública há mais de uma semana."],
  ["QRU", "Transporte irregular de passageiros no terminal."],
  ["QRU", "Estacionamento em fila dupla em frente à escola."],
  ["PROGRAMADA", "Fiscalização do estacionamento rotativo no quadrilátero central."],
  ["PROGRAMADA", "Apoio ao trânsito na saída da escola municipal."],
  ["PROGRAMADA", "Vistoria de ponto de táxi e de parada de ônibus."],
  ["PROGRAMADA", "Operação integrada de fiscalização do transporte por aplicativo."],
  ["PROGRAMADA", "Ordenamento do trânsito no evento da praça."],
];
const ATENDIMENTOS = [
  "Condutor orientado e veículo retirado do local.",
  "Auto de infração lavrado; veículo removido para o pátio.",
  "Trânsito desviado até a chegada da equipe de manutenção.",
  "Área sinalizada com cones e via liberada.",
  "Fiscalização realizada sem irregularidades.",
  "Condutor notificado; situação regularizada no local.",
];

// -------------------------------------------------------------------- main
const cliente = await pool.connect();
try {
  console.log(`Banco: ${process.env.PGHOST || "localhost"} / ${process.env.PGDATABASE || "sitra"}`);

  // Precisa das migracoes 040-042 (rodam ao subir a API).
  const prontas = await cliente.query(
    `SELECT
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'servico_equipe' AND column_name = 'numero') AS codigo_sd,
       EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_name = 'ordem_servico' AND column_name = 'data_ocorrido') AS os_solicitacao,
       (SELECT prosrc LIKE '%06:00%' FROM pg_proc WHERE proname = 'validar_horario_servico_diario' LIMIT 1) AS turno_0600`
  );
  const p = prontas.rows[0];
  if (!p.codigo_sd || !p.os_solicitacao || !p.turno_0600) {
    console.error("As migrações 040 a 042 ainda não rodaram neste banco. Suba a API uma vez (npm run dev) e rode de novo.");
    process.exit(1);
  }
  const ja = await cliente.query("SELECT 1 FROM equipe WHERE numero = 'EQ-CENTRO'");
  if (ja.rowCount) {
    console.log("A Fiscalização já foi populada por este script (a equipe EQ-CENTRO existe). Nada a fazer.");
    process.exit(0);
  }

  await cliente.query("BEGIN");

  // --- setor, cargos, usuario que assina ---------------------------------
  const setor = (await cliente.query(
    "SELECT id_setor FROM setor WHERE unaccent_simples(nome) LIKE '%FISCALIZACAO%' ORDER BY id_setor LIMIT 1"
  )).rows[0];
  if (!setor) throw new Error("Não existe o setor de Fiscalização. Suba a API uma vez para a instalação criar os setores.");
  async function cargo(nome, idSetor) {
    const achado = await cliente.query(
      `SELECT id_cargo FROM cargo WHERE unaccent_simples(nome) = unaccent_simples($1)
        ORDER BY (id_setor IS NOT DISTINCT FROM $2) DESC LIMIT 1`, [nome, idSetor]);
    if (achado.rows[0]) return achado.rows[0].id_cargo;
    return (await cliente.query("INSERT INTO cargo (nome, id_setor) VALUES ($1, $2) RETURNING id_cargo", [nome, idSetor])).rows[0].id_cargo;
  }
  const cargoFiscal = await cargo("Fiscal de Trânsito", setor.id_setor);
  const cargoCoord = await cargo("Coordenador de Fiscalização", setor.id_setor);

  // Quem "registra": um gestor da Fiscalizacao, se houver; senao o primeiro usuario ativo.
  const usuario = (await cliente.query(
    `SELECT u.id_usuario FROM usuario u JOIN perfil p ON p.id_perfil = u.id_perfil
      WHERE u.status ORDER BY (unaccent_simples(p.nome) LIKE '%FISCALIZACAO%') DESC, u.id_usuario LIMIT 1`
  )).rows[0]?.id_usuario;
  if (!usuario) throw new Error("Nenhum usuário ativo no banco.");

  // --- servidores (fiscais e coordenadores) ------------------------------
  async function livre(sql, valor, proximo) {
    let v = valor;
    while ((await cliente.query(sql, [v])).rowCount) v = proximo(v);
    return v;
  }
  let matricula = 14000;
  async function novoServidor(nome, idCargo, i) {
    const m = await livre("SELECT 1 FROM servidor WHERE matricula = $1", String(matricula + i), (x) => String(Number(x) + 37));
    const cpf = await livre("SELECT 1 FROM servidor WHERE cpf = $1", String(inteiro(10000000000, 99999999999)),
      () => String(inteiro(10000000000, 99999999999)));
    const login = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(" ");
    const { rows } = await cliente.query(
      `INSERT INTO servidor
         (nome, cpf, data_nascimento, telefone, email, matricula, cnh, categoria_cnh, cnh_data_validade,
          id_cargo, id_setor, condutor)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, TRUE) RETURNING id_servidor`,
      [
        nome, cpf, `19${inteiro(75, 99)}-${dois(inteiro(1, 12))}-${dois(inteiro(1, 28))}`,
        `629${inteiro(1000, 9999)}${inteiro(1000, 9999)}`, `${login[0]}.${login[login.length - 1]}@cmtt.local`,
        m, String(inteiro(10000000000, 99999999999)), aleatorio(["AB", "B", "AD"]),
        // Uma CNH vence em 20 dias: aparece no sino.
        i === 3 ? dataRelativa(20) : dataRelativa(inteiro(200, 1500)),
        idCargo, setor.id_setor,
      ]
    );
    return rows[0].id_servidor;
  }
  const fiscais = [];
  for (let i = 0; i < FISCAIS.length; i++) fiscais.push(await novoServidor(FISCAIS[i], cargoFiscal, i));
  const coordenadores = [];
  for (let i = 0; i < COORDENADORES.length; i++) coordenadores.push(await novoServidor(COORDENADORES[i], cargoCoord, 50 + i));

  // --- viaturas -----------------------------------------------------------
  const equipamentos = (await cliente.query(
    "SELECT id_equipamento, nome FROM equipamento WHERE status ORDER BY id_equipamento"
  )).rows.filter((e) => ITENS_EQUIP[e.nome] !== undefined);
  // Estoque inicial (migracao 046, se ja rodou): a entrada de 45 dias atras.
  const ESTOQUE = { Cone: 60, "Pantográfica": 20, Cavalete: 20, Barreira: 20 };
  if ((await cliente.query("SELECT to_regclass('equipamento_movimento') AS t")).rows[0].t) {
    for (const e of equipamentos.filter((x) => ESTOQUE[x.nome])) {
      await cliente.query(
        `INSERT INTO equipamento_movimento (id_equipamento, tipo, quantidade, data, observacao)
         VALUES ($1, 'ENTRADA', $2, CURRENT_DATE - 45, 'Estoque inicial (dados de exemplo)')`, [e.id_equipamento, ESTOQUE[e.nome]]);
    }
  }
  const viaturas = [];
  for (let i = 0; i < VIATURAS.length; i++) {
    const [marca, modelo, tipo, combustivel, cor] = VIATURAS[i];
    const placa = await livre("SELECT 1 FROM veiculo WHERE placa = $1",
      `FSC${inteiro(1, 9)}${"ABCDEFGHJ"[inteiro(0, 8)]}${inteiro(10, 99)}`,
      () => `FSC${inteiro(1, 9)}${"ABCDEFGHJ"[inteiro(0, 8)]}${inteiro(10, 99)}`);
    const ano = inteiro(2019, 2025);
    const km = inteiro(8000, 60000);
    const { rows } = await cliente.query(
      `INSERT INTO veiculo
         (placa, marca, modelo, ano_fabricacao, ano_modelo, cor, tipo_veiculo, renavam, chassi,
          tipo_combustivel, capacidade, quilometragem_atual, id_setor, status, vinculo, observacoes)
       VALUES ($1,$2,$3,$4,$4,$5,$6,$7,$8,$9,$10,$11,$12,'DISPONIVEL',$13,$14) RETURNING id_veiculo`,
      [
        placa, marca, modelo, ano, cor, tipo, String(inteiro(10000000000, 99999999999)),
        `93Y${Math.random().toString(36).slice(2, 16).toUpperCase()}`, combustivel,
        tipo === "MOTOCICLETA" ? 2 : 5, km, setor.id_setor, aleatorio(["PATRIMONIO", "PATRIMONIO", "LOCADO"]),
        "Viatura utilizada nas operações de fiscalização.",
      ]
    );
    const id = rows[0].id_veiculo;
    await cliente.query("INSERT INTO qr_code (id_veiculo, codigo, token) VALUES ($1, $2, $3)",
      [id, `SITRA-${placa}`, Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)]);
    for (const e of equipamentos) {
      await cliente.query("INSERT INTO veiculo_equipamento (id_veiculo, id_equipamento, quantidade) VALUES ($1,$2,$3)",
        [id, e.id_equipamento, tipo === "MOTOCICLETA" ? (e.nome === "Rádio" ? 1 : 0) : ITENS_EQUIP[e.nome]]);
    }
    // Documentos: CRLV em dia, seguro (um vence em 12 dias, para o sino).
    for (const [tipoDoc, categoria, dias] of [
      ["CRLV", "Licenciamento", inteiro(120, 300)],
      ["Seguro Obrigatório", "Seguro", i === 2 ? 12 : inteiro(60, 330)],
    ]) {
      await cliente.query(
        `INSERT INTO documento_veiculo (id_veiculo, tipo_documento, numero_documento, data_emissao,
           data_validade, status, categoria, id_responsavel)
         VALUES ($1,$2,$3,$4,$5,'VALIDO',$6,$7)`,
        [id, tipoDoc, String(inteiro(100000000, 999999999)), dataRelativa(dias - 365), dataRelativa(dias),
         categoria, coordenadores[0]]);
    }
    viaturas.push({ id, placa, km, moto: tipo === "MOTOCICLETA" });
  }
  // A moto nao faz checklist de equipe (nao leva cone nem estepe): fica de reserva.
  const viaturasCarro = viaturas.filter((v) => !v.moto);

  // --- equipes ------------------------------------------------------------
  const equipes = [];
  for (let e = 0; e < EQUIPES.length; e++) {
    const [numero, turno, tipo, obs] = EQUIPES[e];
    const { rows } = await cliente.query(
      "INSERT INTO equipe (numero, tipo, observacoes) VALUES ($1,$2,$3) RETURNING id_equipe", [numero, tipo, obs]);
    const id = rows[0].id_equipe;
    // Dois fiscais por equipe; a de apoio tem os dois ultimos fiscais.
    const membros = e < 5 ? [fiscais[e * 2], fiscais[e * 2 + 1]] : [fiscais[10], fiscais[11]];
    for (const s of membros) {
      await cliente.query("INSERT INTO equipe_servidor (id_equipe, id_servidor, data_inicio) VALUES ($1,$2,$3)",
        [id, s, dataRelativa(-90)]);
    }
    await cliente.query(
      "INSERT INTO equipe_turno (id_equipe, turno, data_inicio, motivo, alterado_por) VALUES ($1,$2,$3,$4,$5)",
      [id, turno, dataRelativa(-90), "Definido no cadastro da equipe.", usuario]);
    await cliente.query(
      `INSERT INTO auditoria (id_usuario, acao, entidade, id_registro, dados_novos, data_hora)
       VALUES ($1, 'CRIAR', 'equipe', $2, $3, $4)`,
      [usuario, id, JSON.stringify({ numero, tipo }), `${dataRelativa(-90)} 09:00:00`]);
    equipes.push({ id, numero, turno, membros, apoio: tipo === "TEMPORARIA" });
  }

  // --- itens de pontuacao (os que faltarem) ------------------------------
  const itens = {};
  for (const [codigo, nome, pontos] of PONTUACAO) {
    const achado = await cliente.query("SELECT id_item, valor_pontos FROM pontuacao_item WHERE codigo = $1", [codigo]);
    if (achado.rows[0]) { itens[codigo] = { id: achado.rows[0].id_item, pontos: Number(achado.rows[0].valor_pontos) }; continue; }
    const { rows } = await cliente.query(
      "INSERT INTO pontuacao_item (codigo, nome, valor_pontos, criado_por) VALUES ($1,$2,$3,$4) RETURNING id_item",
      [codigo, nome, pontos, usuario]);
    itens[codigo] = { id: rows[0].id_item, pontos };
  }
  async function pontuar(codigo, { equipe = null, servidor = null, origem = null, idOrigem = null, quando, qtd = 1, obs = null }) {
    const it = itens[codigo];
    await cliente.query(
      `INSERT INTO pontuacao_registro (id_item, id_servidor, id_equipe, entidade_origem, id_registro_origem,
         quantidade, pontos_aplicados, data_registro, registrado_por, observacao)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [it.id, servidor, equipe, origem, idOrigem, qtd, it.pontos * qtd, quando, usuario, obs]);
    contagem.pontos++;
  }

  // Protocolo das ocorrencias: continua depois do maior numero ja usado.
  let protocolo = Number((await cliente.query(
    "SELECT COALESCE(MAX(NULLIF(regexp_replace(protocolo, '^.*-', ''), '')::int), 0) AS n FROM ocorrencia WHERE protocolo ~ '-[0-9]+$'"
  )).rows[0].n) + 1;

  const contagem = { servicos: 0, linhas: 0, checklists: 0, ocorrencias: 0, pontos: 0 };
  const km = new Map(viaturas.map((v) => [v.id, v.km]));
  const naRua = new Set();
  // A viatura que vai para a oficina hoje nao sai mais a partir de ontem.
  const naOficina = viaturasCarro[viaturasCarro.length - 1].id;

  // --- servicos diarios: 30 dias atras ate 3 dias a frente ---------------
  for (let dia = -30; dia <= 3; dia++) {
    const data = dataRelativa(dia);
    for (const turno of ["DIURNO", "NOTURNO"]) {
      const passado = dia < 0;
      const hoje = dia === 0;
      // Hoje: o diurno esta rodando, o noturno ainda vai comecar.
      const rodando = hoje && turno === "DIURNO";
      const encerrado = passado;
      const status = encerrado ? "ENCERRADO" : rodando ? "EM_SERVICO" : "ABERTO";

      // Servico do dia e turno: aproveita o que ja existe (e unico por dia e turno).
      let sd = (await cliente.query(
        "SELECT id_servico_diario, id_coordenador FROM servico_diario WHERE data = $1 AND turno = $2", [data, turno])).rows[0];
      if (!sd) {
        sd = (await cliente.query(
          `INSERT INTO servico_diario (data, turno, id_coordenador, criado_por, hora_criacao, hora_inicio,
             hora_encerramento, status, encerrado_por)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id_servico_diario, id_coordenador`,
          [
            data, turno, aleatorio(coordenadores), usuario, `${dataRelativa(dia - 1)} 16:${dois(inteiro(0, 59))}:00`,
            turno === "DIURNO" ? "06:00" : "19:00",
            encerrado ? (turno === "DIURNO" ? "19:00" : "23:59") : null,
            status, encerrado ? usuario : null,
          ])).rows[0];
        contagem.servicos++;
      }
      const idServico = sd.id_servico_diario;

      // Equipes do turno; a de apoio entra em alguns dias.
      const doTurno = equipes.filter((e) => e.turno === turno && (!e.apoio || dia % 4 === 0));
      for (const eq of doTurno) {
        await cliente.query(
          "INSERT INTO servico_equipe (id_servico_diario, id_equipe, status) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
          [idServico, eq.id, encerrado ? "FINALIZADA" : "ATIVA"]);
        contagem.linhas++;
      }

      // Dia futuro: so a escala e uma ocorrencia programada pendente.
      if (dia > 0 || (hoje && turno === "NOTURNO")) {
        if (chance(0.7)) {
          const [tipo, descricao] = aleatorio(OCORRENCIAS.filter((o) => o[0] === "PROGRAMADA"));
          await cliente.query(
            `INSERT INTO ocorrencia (protocolo, tipo, descricao, data, hora, endereco, id_servico_diario, criado_por, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PENDENTE')`,
            [`OC-${data.replace(/-/g, "")}-${String(protocolo++).padStart(4, "0")}`, tipo, descricao, data,
             turno === "DIURNO" ? "08:00" : "20:00", aleatorio(LOCAIS), idServico, usuario]);
          contagem.ocorrencias++;
        }
        continue;
      }

      const usadasNoTurno = new Set();
      for (const eq of doTurno) {
        // --- checklist da viatura da equipe (uma viatura por equipe no turno) ---
        const livres = viaturasCarro.filter((v) => !naRua.has(v.id) && !usadasNoTurno.has(v.id)
          && !(dia >= -1 && v.id === naOficina));
        if (!livres.length) continue;
        const v = aleatorio(livres);
        usadasNoTurno.add(v.id);
        const saida = turno === "DIURNO" ? horaEntre(6, 10, 6, 45) : horaEntre(19, 10, 19, 40);
        const chegada = turno === "DIURNO" ? horaEntre(18, 20, 18, 55) : horaEntre(23, 20, 23, 50);
        const kmSaida = km.get(v.id);
        const rodou = inteiro(35, 170);
        const { rows: ck } = await cliente.query(
          `INSERT INTO checklist_fiscalizacao (id_veiculo, id_servico_diario, id_equipe, data_abertura, hora_saida,
             odometro_saida, observacoes, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'ABERTO') RETURNING id_checklist`,
          [v.id, idServico, eq.id, data, saida, kmSaida,
           aleatorio(["Viatura conferida na saída da sede.", "Viatura limpa e em condições.", null, null])]);
        const idCk = ck[0].id_checklist;
        contagem.checklists++;
        await cliente.query(
          "INSERT INTO checklist_fiscal_servidor (id_checklist, id_servidor, tipo) VALUES ($1,$2,'FISCAL_1'), ($1,$3,'FISCAL_2')",
          [idCk, eq.membros[0], eq.membros[1]]);
        for (const e of equipamentos) {
          await cliente.query(
            "INSERT INTO checklist_fiscal_equipamento (id_checklist, id_equipamento, etapa, quantidade, observacao) VALUES ($1,$2,'SAIDA',$3,NULL)",
            [idCk, e.id_equipamento, ITENS_EQUIP[e.nome]]);
        }
        let faltou = false;
        if (encerrado) {
          for (const e of equipamentos) {
            let q = ITENS_EQUIP[e.nome];
            let obs = null;
            if (e.nome === "Cone" && chance(0.12)) { q = 3; obs = "Um cone danificado durante a ocorrência."; faltou = true; }
            await cliente.query(
              "INSERT INTO checklist_fiscal_equipamento (id_checklist, id_equipamento, etapa, quantidade, observacao) VALUES ($1,$2,'CHEGADA',$3,$4)",
              [idCk, e.id_equipamento, q, obs]);
          }
          await cliente.query(
            `UPDATE checklist_fiscalizacao SET hora_chegada = $2, odometro_chegada = $3, data_finalizacao = $4, status = 'FINALIZADO'
              WHERE id_checklist = $1`,
            [idCk, chegada, kmSaida + rodou, `${data} ${chegada}:00`]);
          km.set(v.id, kmSaida + rodou);
        } else {
          naRua.add(v.id);
        }

        // --- ocorrencias atendidas pela equipe ---
        const qtd = rodando ? inteiro(1, 3) : inteiro(1, 4);
        for (let o = 0; o < qtd; o++) {
          const [tipo, descricao] = aleatorio(OCORRENCIAS);
          const hora = turno === "DIURNO" ? horaEntre(7, 0, 18, 0) : horaEntre(19, 50, 23, 10);
          const situacao = encerrado
            ? aleatorio(["FINALIZADA", "FINALIZADA", "FINALIZADA", "FINALIZADA", "INTERCORRENCIA"])
            : aleatorio(["PENDENTE", "ATRIBUIDA", "EM_ANDAMENTO", "FINALIZADA"]);
          const finalizada = situacao === "FINALIZADA";
          const fim = finalizada ? `${data} ${hora.slice(0, 3)}${dois(Math.min(Number(hora.slice(3)) + 40, 59))}:00` : null;
          const { rows: oc } = await cliente.query(
            `INSERT INTO ocorrencia (protocolo, tipo, descricao, data, hora, endereco, observacoes, id_servico_diario,
               criado_por, data_criacao, status, descricao_atendimento, data_finalizacao)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id_ocorrencia`,
            [
              `OC-${data.replace(/-/g, "")}-${String(protocolo++).padStart(4, "0")}`, tipo, descricao, data, hora,
              aleatorio(LOCAIS), chance(0.3) ? aleatorio(["Trânsito intenso no local.", "Condutor não estava presente.", "Solicitado pela central."]) : null,
              idServico, usuario, `${data} ${hora}:00`, situacao,
              finalizada ? aleatorio(ATENDIMENTOS) : situacao === "INTERCORRENCIA" ? null : null, fim,
            ]);
          contagem.ocorrencias++;
          if (situacao === "PENDENTE") continue;
          const idOc = oc[0].id_ocorrencia;
          // Uma em cada dez foi passada de outra equipe (reatribuicao).
          const outra = equipes.find((x) => x.turno === turno && x.id !== eq.id && !x.apoio);
          if (outra && chance(0.1)) {
            await cliente.query(
              `INSERT INTO distribuicao_ocorrencia (id_ocorrencia, id_servico_diario, id_equipe, id_veiculo, id_coordenador,
                 data, hora, tipo, status) VALUES ($1,$2,$3,$4,$5,$6,$7,'ATRIBUICAO','CANCELADA')`,
              [idOc, idServico, outra.id, aleatorio(viaturasCarro.filter((x) => x.id !== v.id)).id, sd.id_coordenador, data, hora]);
            await cliente.query(
              `INSERT INTO distribuicao_ocorrencia (id_ocorrencia, id_servico_diario, id_equipe, id_veiculo, id_coordenador,
                 data, hora, tipo, motivo_reatribuicao, status) VALUES ($1,$2,$3,$4,$5,$6,$7,'REATRIBUICAO',$8,$9)`,
              [idOc, idServico, eq.id, v.id, sd.id_coordenador, data, hora,
               "A equipe anterior estava em outra ocorrência.", finalizada ? "FINALIZADA" : "ATIVA"]);
          } else {
            await cliente.query(
              `INSERT INTO distribuicao_ocorrencia (id_ocorrencia, id_servico_diario, id_equipe, id_veiculo, id_coordenador,
                 data, hora, tipo, status) VALUES ($1,$2,$3,$4,$5,$6,$7,'ATRIBUICAO',$8)`,
              [idOc, idServico, eq.id, v.id, sd.id_coordenador, data, hora, finalizada ? "FINALIZADA" : "ATIVA"]);
          }
          if (finalizada && chance(0.6)) {
            await pontuar("PT-01", { equipe: eq.id, origem: "ocorrencia", idOrigem: idOc, quando: fim });
          }
          if (finalizada && chance(0.15)) {
            await pontuar("PT-06", { servidor: aleatorio(eq.membros), origem: "ocorrencia", idOrigem: idOc, quando: fim });
          }
        }

        // --- pontuacao do turno ---
        if (encerrado) {
          const fimTurno = `${data} ${turno === "DIURNO" ? "19:10" : "23:58"}:00`;
          if (!faltou && chance(0.8)) await pontuar("PT-02", { equipe: eq.id, origem: "checklist_fiscalizacao", idOrigem: idCk, quando: fimTurno });
          if (faltou) await pontuar("PT-07", { equipe: eq.id, origem: "checklist_fiscalizacao", idOrigem: idCk, quando: fimTurno, obs: "Cone danificado." });
          if (eq.apoio) await pontuar("PT-03", { equipe: eq.id, quando: fimTurno, obs: "Apoio à equipe do centro." });
          if (chance(0.06)) await pontuar("PT-04", { servidor: aleatorio(eq.membros), quando: fimTurno, obs: "Chegou 25 minutos depois do início do turno." });
          if (chance(0.04)) await pontuar("PT-08", { servidor: aleatorio(eq.membros), quando: fimTurno, obs: "Elogio registrado na ouvidoria." });
          if (chance(0.03)) await pontuar("PT-05", { equipe: eq.id, quando: fimTurno, obs: "Viatura entregue sem a conferência de chegada." });
        }
      }
    }
  }

  // --- OS das viaturas ----------------------------------------------------
  const ordem = async (v, campos) => {
    const base = {
      id_veiculo: v.id, origem: "FISCALIZACAO", gravidade: "MEDIA", id_solicitante: usuario,
      data_abertura: `${dataRelativa(-1)} 08:00:00`, status: "EM_ANALISE", tipo: "CORRETIVA",
      quilometragem: km.get(v.id), descricao: "Manutenção da viatura.", ...campos,
    };
    const cols = Object.keys(base);
    const { rows } = await cliente.query(
      `INSERT INTO ordem_servico (${cols.join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING id_os`,
      cols.map((c) => base[c]));
    return rows[0].id_os;
  };
  const [v1, v2, v3, v4] = viaturasCarro;
  await ordem(v1, {
    tipo: "PREVENTIVA", gravidade: "BAIXA", data_abertura: `${dataRelativa(-22)} 08:10:00`, data_agendada: dataRelativa(-21),
    data_inicio: `${dataRelativa(-21)} 08:00:00`, data_conclusao: `${dataRelativa(-21)} 16:00:00`, status: "RESOLVIDA",
    descricao: "Troca de óleo e filtros.", oficina: "Auto Center Anápolis", responsavel_oficina: "Sérgio Lima",
    servico_realizado: "Troca de óleo, filtro de óleo e filtro de ar.", custo: 420.5, custo_estimado: 450,
    data_fechamento: dataRelativa(-21), km_fechamento: km.get(v1.id), proxima_manutencao: dataRelativa(40),
  });
  await ordem(v2, {
    tipo: "CORRETIVA", gravidade: "MEDIA", data_abertura: `${dataRelativa(-9)} 07:40:00`, data_agendada: dataRelativa(-8),
    data_inicio: `${dataRelativa(-8)} 08:00:00`, data_conclusao: `${dataRelativa(-7)} 15:00:00`, status: "RESOLVIDA",
    descricao: "Troca das pastilhas de freio dianteiras.", oficina: "Freios Goiás", responsavel_oficina: "Paulo Henrique",
    servico_realizado: "Pastilhas e discos dianteiros substituídos.", custo: 680, custo_estimado: 600,
    data_fechamento: dataRelativa(-7), km_fechamento: km.get(v2.id), proxima_manutencao: dataRelativa(75),
  });
  await ordem(v3, {
    descricao: "Barulho na suspensão dianteira ao passar em lombadas.", oficina: "Auto Center Anápolis",
    data_abertura: `${dataRelativa(-2)} 09:15:00`, data_agendada: dataRelativa(2), custo_estimado: 900,
    data_ocorrido: dataRelativa(-3), observacoes: "Solicitada pela Fiscalização e completada pelo Frotas.",
  });
  await ordem(viaturasCarro[viaturasCarro.length - 1], {
    status: "EM_MANUTENCAO", gravidade: "ALTA", descricao: "Ar-condicionado sem funcionar e ruído no motor.",
    oficina: "Mecânica São José", data_abertura: `${dataRelativa(-1)} 10:00:00`, data_agendada: dataRelativa(0),
    data_inicio: `${dataRelativa(0)} 08:00:00`, custo_estimado: 1500, data_ocorrido: dataRelativa(-2),
  });
  await cliente.query("UPDATE veiculo SET status = 'EM_MANUTENCAO' WHERE id_veiculo = $1", [naOficina]);
  // Duas solicitacoes da Fiscalizacao esperando o Frotas completar (aparecem no sino do Frotas).
  await ordem(v4, {
    status: "PENDENTE", gravidade: "ALTA", descricao: "Pneu traseiro com desgaste irregular.",
    data_abertura: `${dataRelativa(0)} 07:30:00`, data_ocorrido: dataRelativa(-1),
  });
  await ordem(v1, {
    status: "PENDENTE", gravidade: "BAIXA", tipo: "PREVENTIVA", descricao: "Lâmpada do farol esquerdo queimada.",
    data_abertura: `${dataRelativa(-1)} 18:50:00`, data_ocorrido: dataRelativa(-1),
  });

  // --- multas e sinistro --------------------------------------------------
  const MULTAS = [
    [fiscais[0], v1, -25, "GRAVE", 5, 195.23, "PAGA", "Avançar o sinal vermelho do semáforo.", "605-03", dataRelativa(-5)],
    [fiscais[2], v2, -12, "MEDIA", 4, 130.16, "PENDENTE", "Transitar em velocidade superior à máxima em até 20%.", "745-50", dataRelativa(14)],
    [fiscais[5], v3, -40, "GRAVISSIMA", 7, 293.47, "EM_RECURSO", "Dirigir utilizando-se de telefone celular.", "763-31", dataRelativa(25)],
    [fiscais[7], v4, -3, "LEVE", 3, 88.38, "PENDENTE", "Estacionar em desacordo com a regulamentação.", "554-11", dataRelativa(45)],
  ];
  for (const [servidor, v, dia, gravidade, pontos, valor, status, descricao, codigo, vencimento] of MULTAS) {
    await cliente.query(
      `INSERT INTO multa (id_servidor, id_veiculo, numero_auto, orgao_autuador, codigo_infracao, data, hora, local, descricao,
         gravidade, pontos, valor, vencimento, status, data_pagamento, criado_por)
       VALUES ($1,$2,$3,'DETRAN-GO',$4,$5,'10:20',$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [servidor, v.id, `E${inteiro(100000000, 999999999)}`, codigo, dataRelativa(dia), aleatorio(LOCAIS), descricao,
       gravidade, pontos, valor, vencimento, status, status === "PAGA" ? dataRelativa(-8) : null, usuario]);
  }
  await cliente.query(
    `INSERT INTO sinistro (id_veiculo, id_servidor, data, hora, local, descricao, status, id_responsavel, tipo,
       houve_terceiros, gravidade_danos, parte_danificada)
     VALUES ($1,$2,$3,'15:40',$4,$5,'EM_ANALISE',$6,'COLISAO',TRUE,'LEVE','Para-choque traseiro')`,
    [v2.id, fiscais[3], dataRelativa(-6), "Av. Brasil Sul, 1250 - Centro",
     "Colisão traseira leve em semáforo durante o deslocamento para ocorrência, sem vítimas.", usuario]);

  await cliente.query("COMMIT");
  console.log(
    `Pronto: ${fiscais.length} fiscais, ${coordenadores.length} coordenadores, ${viaturas.length} viaturas, ` +
    `${equipes.length} equipes, ${contagem.servicos} serviços diários novos (${contagem.linhas} equipes em serviço), ` +
    `${contagem.checklists} checklists, ${contagem.ocorrencias} ocorrências, ${contagem.pontos} pontuações, ` +
    "6 OS, 4 multas e 1 sinistro."
  );
} catch (e) {
  await cliente.query("ROLLBACK").catch(() => {});
  console.error("Erro - nada foi gravado:", e.message);
  process.exitCode = 1;
} finally {
  cliente.release();
  await pool.end();
}
