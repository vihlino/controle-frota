/**
 * Dados de exemplo para navegar o sistema com as telas preenchidas.
 * Roda com: npm run seed:demo
 * Nao apaga nada: se ja houver veiculos, ele para.
 */
import "dotenv/config";
import { pool } from "./db.js";

const MARCAS = [
  ["Chevrolet", "S10 LS 2.8", "CAMINHONETE", "DIESEL"],
  ["Fiat", "Strada Endurance 1.4", "CAMINHONETE", "FLEX"],
  ["Volkswagen", "Gol 1.6 MSI", "AUTOMOVEL", "FLEX"],
  ["Toyota", "Hilux CD 4x4 SR", "CAMINHONETE", "DIESEL"],
  ["Ford", "Ranger XLS 2.2", "CAMINHONETE", "DIESEL"],
  ["Renault", "Duster Zen 1.6", "AUTOMOVEL", "FLEX"],
  ["Chevrolet", "Spin LT 1.8", "AUTOMOVEL", "FLEX"],
  ["Fiat", "Toro Freedom 1.8", "CAMINHONETE", "FLEX"],
  ["Nissan", "Frontier S 4x4", "CAMINHONETE", "DIESEL"],
  ["Peugeot", "Partner Furgao 1.6", "FURGAO", "FLEX"],
  ["Honda", "CG 160 Titan", "MOTOCICLETA", "FLEX"],
  ["Yamaha", "Factor 150", "MOTOCICLETA", "FLEX"],
];
const CORES = ["Branco", "Prata", "Preto", "Cinza", "Vermelho"];
const STATUS = ["DISPONIVEL", "DISPONIVEL", "DISPONIVEL", "EM_USO", "EM_MANUTENCAO", "INATIVO"];
const NOMES = [
  "Joao Carlos Ferreira", "Maria Oliveira Souza", "Pedro Santos Lima",
  "Ana Paula Rocha", "Carlos Lima Martins", "Fernanda Rocha Alves",
  "Rafael Souza Pinto", "Juliana Mendes Costa", "Bruno Martins Dias",
  "Lucas Alves Moreira", "Patricia Gomes Reis", "Marcos Vinicius Barbosa",
];
const DOCUMENTOS = ["CRLV", "Licenciamento", "Seguro Obrigatorio", "IPVA", "Laudo de Inspecao"];
const CATEGORIAS = { CRLV: "Licenciamento", Licenciamento: "Licenciamento",
  "Seguro Obrigatorio": "Seguro", IPVA: "Imposto", "Laudo de Inspecao": "Inspecao" };

const aleatorio = (lista) => lista[Math.floor(Math.random() * lista.length)];
const inteiro = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const placa = (i) => {
  const L = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return `${L[i % 26]}${L[(i * 3) % 26]}${L[(i * 7) % 26]}${inteiro(1, 9)}${L[(i * 5) % 26]}${inteiro(10, 99)}`;
};
const dataRelativa = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};

const cliente = await pool.connect();
try {
  const existente = await cliente.query("SELECT COUNT(*)::int AS total FROM veiculo");
  if (existente.rows[0].total > 0) {
    console.log(`Ja existem ${existente.rows[0].total} veiculos. Nada a fazer.`);
    process.exit(0);
  }

  await cliente.query("BEGIN");

  const setores = (await cliente.query("SELECT id_setor FROM setor ORDER BY id_setor LIMIT 12")).rows;
  const idSetor = () => aleatorio(setores).id_setor;

  // --- servidores ---
  const servidores = [];
  for (let i = 0; i < NOMES.length; i++) {
    const { rows } = await cliente.query(
      `INSERT INTO servidor
         (nome, cpf, data_nascimento, telefone, email, matricula, cnh, categoria_cnh,
          cargo_funcao, id_setor)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id_servidor`,
      [
        NOMES[i],
        `${String(100 + i).padStart(3, "0")}.${inteiro(100, 999)}.${inteiro(100, 999)}-${inteiro(10, 99)}`,
        `19${inteiro(70, 99)}-${String(inteiro(1, 12)).padStart(2, "0")}-${String(inteiro(1, 28)).padStart(2, "0")}`,
        `(64) 9${inteiro(1000, 9999)}-${inteiro(1000, 9999)}`,
        NOMES[i].toLowerCase().split(" ")[0] + i + "@cmtt.local",
        String(12500 + i),
        String(inteiro(10000000000, 99999999999)),
        aleatorio(["AB", "B", "AD", "D"]),
        aleatorio(["Motorista", "Fiscal de Transito", "Gestor de Frotas", "Agente Administrativo"]),
        idSetor(),
      ]
    );
    servidores.push(rows[0].id_servidor);
  }

  // --- usuarios para os servidores que assinam registros ---
  const bcrypt = (await import("bcryptjs")).default;
  const perfilGestor = (
    await cliente.query("SELECT id_perfil FROM perfil WHERE nome = 'Gestor'")
  ).rows[0];
  const senhaPadrao = await bcrypt.hash("sitra@2026", 10);

  const usuarios = [];
  for (let i = 0; i < 6; i++) {
    const { rows } = await cliente.query(
      `INSERT INTO usuario (id_servidor, id_perfil, login, senha_hash)
       VALUES ($1, $2, $3, $4) RETURNING id_usuario`,
      [servidores[i], perfilGestor.id_perfil, "gestor" + (i + 1), senhaPadrao]
    );
    usuarios.push(rows[0].id_usuario);
  }

  // --- veiculos ---
  const veiculos = [];
  const kmDoVeiculo = new Map();
  for (let i = 0; i < 42; i++) {
    const [marca, modelo, tipo, combustivel] = MARCAS[i % MARCAS.length];
    const ano = inteiro(2016, 2025);
    const { rows } = await cliente.query(
      `INSERT INTO veiculo
         (placa, marca, modelo, ano_fabricacao, ano_modelo, cor, tipo_veiculo,
          renavam, chassi, tipo_combustivel, quilometragem_atual, id_setor, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id_veiculo`,
      [
        placa(i), marca, modelo, ano, ano, aleatorio(CORES), tipo,
        String(inteiro(10000000000, 99999999999)),
        `9B${String(i).padStart(2, "0")}${Math.random().toString(36).slice(2, 15).toUpperCase()}`,
        combustivel, 0, idSetor(), 'DISPONIVEL',
      ]
    );
    veiculos.push(rows[0].id_veiculo);
    kmDoVeiculo.set(rows[0].id_veiculo, 0);
  }

  // --- QR Code para todos ---
  for (const id of veiculos) {
    const p = (await cliente.query("SELECT placa FROM veiculo WHERE id_veiculo = $1", [id])).rows[0];
    await cliente.query(
      `INSERT INTO qr_code (id_veiculo, codigo, token) VALUES ($1, $2, $3)`,
      [id, `SITRA-${p.placa}`, Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)]
    );
  }

  console.log(`${servidores.length} servidores e ${veiculos.length} veiculos criados.`);

  // --- checklists (ultimos 45 dias) ---
  const PERCURSOS = [
    "Sede -> Bairro Industrial", "Sede -> Distrito Leste", "Centro -> Zona Rural",
    "Sede -> Manutencao", "Sede -> Escola Municipal", "Centro -> Setor Norte",
    "Setor Sul -> Centro", "Sede -> Almoxarifado",
  ];
  const EQUIPAMENTOS = ["MACACO", "ESTEPE", "TRIANGULO", "CHAVE_RODA"];
  let checklists = 0;

  for (let dia = 45; dia >= 0; dia--) {
    for (let n = 0; n < inteiro(2, 6); n++) {
      const idVeiculo = aleatorio(veiculos);
      const kmSaida = kmDoVeiculo.get(idVeiculo);
      const rodou = inteiro(15, 250);
      const finalizado = dia > 0 || Math.random() > 0.4;

      const { rows } = await cliente.query(
        `INSERT INTO checklist_frotas
           (id_veiculo, id_servidor, data_abertura, hora_saida, odometro_saida,
            percurso, local_saida, data_devolucao, hora_chegada, odometro_chegada,
            status, data_finalizacao)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id_checklist`,
        [
          idVeiculo, aleatorio(servidores), dataRelativa(-dia),
          `0${inteiro(6, 9)}:${String(inteiro(0, 59)).padStart(2, "0")}`,
          kmSaida, aleatorio(PERCURSOS), "Sede da CMTT",
          finalizado ? dataRelativa(-dia) : null,
          finalizado ? `1${inteiro(0, 8)}:${String(inteiro(0, 59)).padStart(2, "0")}` : null,
          finalizado ? kmSaida + rodou : null,
          finalizado ? "FINALIZADO" : "ABERTO",
          finalizado ? `${dataRelativa(-dia)} 18:00:00` : null,
        ]
      );

      if (finalizado) kmDoVeiculo.set(idVeiculo, kmSaida + rodou);

      for (const equipamento of EQUIPAMENTOS) {
        const conforme = Math.random() > 0.08;
        await cliente.query(
          `INSERT INTO checklist_frotas_equipamento
             (id_checklist, equipamento, conforme, observacao)
           VALUES ($1,$2,$3,$4)`,
          [rows[0].id_checklist, equipamento, conforme, conforme ? null : "Item ausente na conferencia."]
        );
      }
      checklists++;
    }
  }

  // --- documentos, com vencimentos espalhados nas faixas 30/90/120 ---
  let documentos = 0;
  for (const idVeiculo of veiculos) {
    for (const tipo of DOCUMENTOS.slice(0, inteiro(2, 5))) {
      const dias = aleatorio([-40, -12, 8, 21, 45, 70, 88, 100, 115, 200, 320]);
      const status = dias < 0 ? "VENCIDO" : dias <= 30 ? "VENCENDO" : "VALIDO";
      await cliente.query(
        `INSERT INTO documento_veiculo
           (id_veiculo, tipo_documento, numero_documento, data_emissao, data_validade,
            status, categoria, id_responsavel, bloqueia_veiculo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          idVeiculo, tipo, String(inteiro(100000000, 999999999)),
          dataRelativa(dias - 365), dataRelativa(dias), status,
          CATEGORIAS[tipo], aleatorio(servidores), tipo === "CRLV",
        ]
      );
      documentos++;
    }
  }

  // --- inspecoes ---
  const ITENS = [
    "Pneus", "Freios", "Luzes e sinalizacao", "Nivel de oleo", "Fluido de freio",
    "Direcao", "Suspensao", "Cintos de seguranca", "Extintor de incendio",
    "Documentacao do veiculo", "Limpeza do veiculo",
  ];
  let inspecoes = 0;
  for (let i = 0; i < 60; i++) {
    const dia = inteiro(0, 60);
    const finalizada = dia > 3;
    const tipo = aleatorio(["SEMANAL", "QUINZENAL", "MENSAL", "PERSONALIZADA"]);
    const proximo = { SEMANAL: 7, QUINZENAL: 15, MENSAL: 30, PERSONALIZADA: 20 }[tipo];
    const comAvaria = Math.random() > 0.75;

    const { rows } = await cliente.query(
      `INSERT INTO inspecao
         (id_veiculo, id_gestor, tipo, data_realizacao, hora_inicio, hora_finalizacao,
          status, resultado, data_finalizacao, local, numero, proxima_inspecao, quilometragem)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id_inspecao`,
      [
        aleatorio(veiculos), aleatorio(usuarios), tipo, dataRelativa(-dia),
        `0${inteiro(7, 9)}:${String(inteiro(0, 59)).padStart(2, "0")}`,
        finalizada ? `1${inteiro(0, 1)}:${String(inteiro(0, 59)).padStart(2, "0")}` : null,
        finalizada ? "FINALIZADA" : "ABERTA",
        finalizada ? (comAvaria ? "COM_AVARIAS" : "CONFORME") : null,
        finalizada ? `${dataRelativa(-dia)} 10:00:00` : null,
        aleatorio(["Garagem Central", "Patio da Sede", "Oficina credenciada"]),
        `INS-2026-${String(i + 1).padStart(5, "0")}`,
        dataRelativa(-dia + proximo), null,
      ]
    );

    for (const item of ITENS) {
      const sorte = Math.random();
      const resultado = !comAvaria || sorte > 0.25 ? "NORMAL" : sorte > 0.12 ? "ATENCAO" : "AVARIA";
      await cliente.query(
        `INSERT INTO inspecao_item (id_inspecao, item, resultado, observacao)
         VALUES ($1,$2,$3,$4)`,
        [
          rows[0].id_inspecao, item, resultado,
          resultado === "NORMAL" ? null
            : resultado === "ATENCAO" ? "Requer acompanhamento na proxima inspecao."
            : "Item reprovado, encaminhado para manutencao.",
        ]
      );
    }
    inspecoes++;
  }

  console.log(`${checklists} checklists, ${documentos} documentos e ${inspecoes} inspecoes criados.`);

  // --- manutencoes / ordens de servico ---
  const SERVICOS = [
    ["PREVENTIVA", "Revisao periodica 20.000 km", "Auto Center Silva"],
    ["CORRETIVA", "Troca de pastilhas de freio", "Freios & Cia"],
    ["PREVENTIVA", "Troca de oleo e filtros", "LubriMais"],
    ["CORRETIVA", "Alinhamento e balanceamento", "Auto Center Silva"],
    ["CORRETIVA", "Substituicao de bateria", "Baterias Forte"],
    ["PREVENTIVA", "Revisao periodica 30.000 km", "Auto Center Silva"],
    ["CORRETIVA", "Troca de amortecedores", "Suspensoes Brasil"],
  ];
  let manutencoes = 0;
  for (let i = 0; i < 48; i++) {
    const [tipo, descricao, oficina] = aleatorio(SERVICOS);
    const dia = inteiro(0, 90);
    const status = aleatorio(["EM_ANALISE", "EM_MANUTENCAO", "RESOLVIDA", "RESOLVIDA", "RESOLVIDA"]);
    const resolvida = status === "RESOLVIDA";

    await cliente.query(
      `INSERT INTO ordem_servico
         (id_veiculo, origem, gravidade, id_solicitante, id_responsavel, data_abertura,
          data_inicio, data_conclusao, status, servico_realizado, oficina, custo,
          observacoes, tipo, data_agendada, proxima_manutencao, quilometragem,
          descricao, numero)
       VALUES ($1,'FROTAS',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [
        aleatorio(veiculos), aleatorio(["BAIXA", "MEDIA", "ALTA"]),
        aleatorio(usuarios), aleatorio(usuarios),
        `${dataRelativa(-dia)} 08:00:00`,
        status !== "EM_ANALISE" ? `${dataRelativa(-dia + 1)} 09:00:00` : null,
        resolvida ? `${dataRelativa(-dia + 3)} 17:00:00` : null,
        status, resolvida ? descricao + " concluido." : null,
        oficina, resolvida ? (inteiro(15000, 250000) / 100).toFixed(2) : null,
        null, tipo, dataRelativa(-dia + 2),
        resolvida ? dataRelativa(-dia + 180) : null,
        null, descricao,
        `OS-2026-${String(i + 1).padStart(5, "0")}`,
      ]
    );
    manutencoes++;
  }

  // --- sinistros ---
  const TIPOS_SINISTRO = ["COLISAO", "DANO_MATERIAL", "ROUBO_FURTO", "INCENDIO", "OUTRO"];
  const LOCAIS = [
    "Av. Brasil, 1250 - Centro", "Rua das Flores, 340 - Bairro Jardim",
    "BR-050, Km 102", "Av. das Nacoes, 880", "Estacionamento da sede",
  ];
  for (let i = 0; i < 22; i++) {
    const dia = inteiro(0, 120);
    await cliente.query(
      `INSERT INTO sinistro
         (id_veiculo, id_servidor, data, hora, local, descricao, bo, status,
          id_responsavel, tipo, houve_terceiros, numero)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        aleatorio(veiculos), aleatorio(servidores), dataRelativa(-dia),
        `${String(inteiro(6, 20)).padStart(2, "0")}:${String(inteiro(0, 59)).padStart(2, "0")}`,
        aleatorio(LOCAIS),
        "Registro de sinistro envolvendo veiculo da frota durante servico.",
        Math.random() > 0.5 ? `BO-${inteiro(100000, 999999)}` : null,
        aleatorio(["ABERTO", "EM_ANALISE", "RESOLVIDO", "ENCERRADO"]),
        aleatorio(usuarios), aleatorio(TIPOS_SINISTRO),
        Math.random() > 0.6, `SIN-2026-${String(i + 1).padStart(5, "0")}`,
      ]
    );
  }

  // --- alinha a quilometragem do veiculo com os checklists ---
  // O banco valida odometro contra o maior valor ja registrado; deixar o
  // cadastro do veiculo para tras cria um veiculo que nao aceita nova saida.
  await cliente.query(
      );

  // --- situacoes finais da frota ---
  // Aplicadas so agora, e apenas nos veiculos sem checklist aberto, porque o
  // banco exige veiculo liberado para abrir checklist.
  await cliente.query(
    `UPDATE veiculo SET status = CASE
        WHEN id_veiculo % 9 = 0 THEN 'EM_MANUTENCAO'
        WHEN id_veiculo % 14 = 0 THEN 'INATIVO'
        ELSE status END
      WHERE id_veiculo NOT IN (
        SELECT id_veiculo FROM checklist_frotas WHERE status = 'ABERTO')`
  );

  // --- alertas do sino ---
  await cliente.query(
    `INSERT INTO alerta (modulo, tipo, prioridade, titulo, mensagem)
     VALUES
       ('FROTAS','DOCUMENTO_VENCIDO','CRITICA','Documentos vencidos',
        'Existem documentos de veiculos com validade expirada.'),
       ('FROTAS','DOCUMENTO_VENCENDO','ALTA','Documentos vencendo em 30 dias',
        'Documentos da frota vencem nos proximos 30 dias.'),
       ('FROTAS','MANUTENCAO','MEDIA','Ordens de servico em aberto',
        'Ha ordens de servico aguardando conclusao.')`
  );

  await cliente.query("COMMIT");
  console.log(`${manutencoes} manutencoes, 22 sinistros e 3 alertas criados.`);
  console.log("Dados de exemplo prontos.");
} catch (e) {
  await cliente.query("ROLLBACK").catch(() => {});
  console.error("Falha no seed de exemplo:", e.message);
  process.exitCode = 1;
} finally {
  cliente.release();
  await pool.end();
}
