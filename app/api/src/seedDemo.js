/**
 * Dados de exemplo para navegar o sistema com as telas preenchidas.
 * Roda com: npm run seed:demo
 * Nao apaga nada: se ja houver veiculos, ele para.
 */
import "dotenv/config";
import { pool } from "./db.js";
/*
 * A lista de itens da inspecao vem do FRONT, que e quem a mostra na tela.
 *
 * Duplicar aqui faria os dados de exemplo conferirem itens que a tela nao
 * confere - e foi o que acontecia: este arquivo ainda gerava "Extintor de
 * incendio" e "Documentacao do veiculo", tirados da inspecao semanas atras.
 *
 * O caminho sai da pasta da API de proposito. Este script e ferramenta de
 * desenvolvimento (npm run seed:demo), roda sempre do repositorio, e o
 * Dockerfile copia so api/ e db/ - no container ele nao existe, e nem deveria.
 */
import { itensDaInspecao } from "../../web/src/lib/itensInspecao.js";

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

/**
 * Os dados de exemplo da FISCALIZACAO.
 *
 * Funcao separada, e nao trecho do fluxo principal, porque roda em dois casos:
 *
 *   - banco vazio: junto com a Frotas, usando os fiscais e veiculos recem
 *     criados;
 *   - banco que ja tem a Frotas mas nenhuma equipe: SO esta parte, sobre os
 *     veiculos que ja existem. E o caso de quem rodou o seed antes de ele
 *     conhecer a Fiscalizacao - sem isso, a unica saida seria apagar o banco.
 *
 * @param {import("pg").PoolClient} cliente  Conexao dentro da transacao.
 * @param {object} ctx
 * @param {number[]} ctx.fiscais        Servidores com cargo de Fiscal de Transito (2+).
 * @param {number[]} ctx.coordenadores  Servidores que podem coordenar um turno.
 * @param {number[]} ctx.usuarios       Usuarios que assinam os registros.
 * @param {Map<number, number>} ctx.kmDoVeiculo  Ultimo odometro de cada veiculo.
 */
async function semearFiscalizacao(cliente, { fiscais, coordenadores, usuarios, kmDoVeiculo }) {
  /*
   * ===========================================================================
   * FISCALIZACAO
   * ===========================================================================
   * Este bloco nao existia: o seed enchia a Frotas e deixava o modulo da
   * Fiscalizacao inteiro vazio - Servico Diario, Equipes, Viaturas,
   * Ocorrencias, Checklists e Pontuacao todos sem uma linha.
   *
   * A ordem aqui segue a dependencia real do modulo, e nao ha como encurtar:
   *
   *   equipe -> servico diario -> equipe no servico -> ocorrencia
   *                            -> checklist da viatura
   *
   * Um checklist de fiscalizacao precisa de um servico diario E de uma equipe;
   * uma ocorrencia so existe dentro de um servico diario. E assim que a
   * Fiscalizacao trabalha: o turno abre, as equipes entram, e tudo que acontece
   * no turno fica pendurado nele.
   */

  // --- equipes ---
  /*
   * Quatro equipes de dois fiscais. Dois e o minimo do sistema, nao escolha
   * nossa: o gatilho validar_dois_fiscais_checklist recusa finalizar um
   * checklist de viatura que nao tenha exatamente Fiscal 1 e Fiscal 2.
   */
  const equipes = [];
  for (let e = 0; e < 4; e++) {
    const turno = e % 2 === 0 ? "DIURNO" : "NOTURNO";
    const { rows } = await cliente.query(
      `INSERT INTO equipe (numero, tipo, observacoes)
       VALUES ($1,$2,$3) RETURNING id_equipe`,
      [
        `EQ-${String(e + 1).padStart(2, "0")}`,
        e < 3 ? "FIXA" : "TEMPORARIA",
        e < 3 ? null : "Equipe montada para o mutirao de fiscalizacao.",
      ]
    );
    const idEquipe = rows[0].id_equipe;

    // Os dois fiscais da equipe. A divisao em pares vem dos seis fiscais
    // criados acima, e as equipes 1 e 4 dividem gente de proposito: na pratica
    // um fiscal cobre mais de uma escala.
    const membros = [fiscais[(e * 2) % 6], fiscais[(e * 2 + 1) % 6]];
    for (const idServidor of membros) {
      await cliente.query(
        `INSERT INTO equipe_servidor (id_equipe, id_servidor, data_inicio)
         VALUES ($1,$2,$3)`,
        [idEquipe, idServidor, dataRelativa(-60)]
      );
    }

    await cliente.query(
      `INSERT INTO equipe_turno (id_equipe, turno, data_inicio, alterado_por, motivo)
       VALUES ($1,$2,$3,$4,$5)`,
      [idEquipe, turno, dataRelativa(-60), usuarios[0], "Escala inicial da equipe."]
    );

    equipes.push({ id: idEquipe, turno, membros });
  }

  // --- itens de pontuacao ---
  const PONTUACAO = [
    ["PT-01", "Ocorrencia atendida no prazo", 10],
    ["PT-02", "Checklist de viatura completo", 5],
    ["PT-03", "Apoio a outra equipe", 8],
    ["PT-04", "Atraso na chegada ao servico", -5],
    ["PT-05", "Viatura devolvida sem conferencia", -10],
  ];
  const itensPontuacao = [];
  for (const [codigo, nome, pontos] of PONTUACAO) {
    const { rows } = await cliente.query(
      `INSERT INTO pontuacao_item (codigo, nome, valor_pontos, criado_por)
       VALUES ($1,$2,$3,$4) RETURNING id_item`,
      [codigo, nome, pontos, usuarios[0]]
    );
    itensPontuacao.push({ id: rows[0].id_item, pontos });
  }

  // --- servico diario, ocorrencias e checklists de viatura ---
  /*
   * Vinte dias de turno diurno e noturno. Os horarios sao fixos porque o banco
   * exige: validar_horario_servico_diario recusa diurno que nao comece 07:00 e
   * noturno que nao comece 19:00.
   */
  const VIA = [
    "Av. Goias, 1200 - Centro", "Rua 15 de Novembro, 340 - Centro",
    "Av. Brasil Norte, 2100 - Setor Norte", "Rua das Acacias, 88 - Jardim Sul",
    "Av. Contorno, 4500 - Distrito Industrial", "Praca da Matriz - Centro",
    "Rua Projetada A, 12 - Setor Leste", "Rodovia GO-070, km 12",
  ];
  const OCORRENCIAS = [
    ["QRU", "Veiculo estacionado em vaga de idoso sem credencial."],
    ["QRU", "Semaforo com defeito no cruzamento, transito travado."],
    ["QRU", "Acidente sem vitimas, faixa da direita interditada."],
    ["PROGRAMADA", "Fiscalizacao de estacionamento rotativo no quadrilatero central."],
    ["PROGRAMADA", "Apoio ao transito na saida da escola municipal."],
    ["PROGRAMADA", "Vistoria de ponto de taxi e parada de onibus."],
    ["QRU", "Carga e descarga fora do horario permitido."],
    ["QRU", "Motocicleta com escapamento irregular em via publica."],
  ];

  // As viaturas: o gatilho ja marcou viatura = TRUE para os veiculos lotados
  // na Fiscalizacao.
  //
  // Em manutencao ou inativa ficam de fora: o gatilho
  // validar_veiculo_para_checklist recusa checklist para elas, e o seed inteiro
  // voltaria atras por causa de uma viatura parada na oficina.
  const viaturas = (
    await cliente.query(
      `SELECT id_veiculo FROM veiculo
        WHERE viatura = TRUE AND status NOT IN ('EM_MANUTENCAO', 'INATIVO')
        ORDER BY id_veiculo`
    )
  ).rows.map((v) => v.id_veiculo);

  let servicos = 0;
  let ocorrencias = 0;
  let checklistsFisc = 0;
  let pontos = 0;

  /*
   * Viaturas que ja estao na rua - com checklist aberto na Frotas OU na
   * Fiscalizacao. O banco recusa o segundo checklist aberto do mesmo veiculo
   * (uq_checklist_fiscal_ativo), e com poucas viaturas o sorteio cairia nisso
   * logo no turno de hoje. Lido do banco, e nao passado de fora, porque no
   * complemento ja pode haver checklist aberto cadastrado a mao.
   */
  const naRua = new Set(
    (
      await cliente.query(
        `SELECT id_veiculo FROM checklist_frotas WHERE status = 'ABERTO'
         UNION
         SELECT id_veiculo FROM checklist_fiscalizacao WHERE status = 'ABERTO'`
      )
    ).rows.map((r) => r.id_veiculo)
  );

  for (let dia = 20; dia >= 0; dia--) {
    for (const turno of ["DIURNO", "NOTURNO"]) {
      // O turno de hoje ainda esta rodando; os de antes ja fecharam.
      const encerrado = dia > 0;
      const coordenador = aleatorio(coordenadores);

      const { rows: sd } = await cliente.query(
        `INSERT INTO servico_diario
           (data, turno, id_coordenador, criado_por, hora_inicio,
            hora_encerramento, status, encerrado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id_servico_diario`,
        [
          dataRelativa(-dia), turno, coordenador, usuarios[0],
          turno === "DIURNO" ? "07:00" : "19:00",
          encerrado ? (turno === "DIURNO" ? "19:00" : "07:00") : null,
          encerrado ? "ENCERRADO" : "EM_SERVICO",
          encerrado ? usuarios[0] : null,
        ]
      );
      const idServico = sd[0].id_servico_diario;
      servicos++;

      // As equipes daquele turno entram no servico.
      const equipesDoTurno = equipes.filter((e) => e.turno === turno);
      for (const equipe of equipesDoTurno) {
        await cliente.query(
          `INSERT INTO servico_equipe (id_servico_diario, id_equipe, status)
           VALUES ($1,$2,$3)`,
          [idServico, equipe.id, encerrado ? "FINALIZADA" : "ATIVA"]
        );
      }

      // --- ocorrencias do turno ---
      for (let o = 0; o < inteiro(2, 5); o++) {
        const [tipo, descricao] = aleatorio(OCORRENCIAS);
        /*
         * Situacao sorteada, mas nao de qualquer jeito: num turno encerrado
         * ninguem deixa ocorrencia "em andamento", e num turno que ainda roda
         * nem tudo esta finalizado. Sem essa distincao as telas mostrariam
         * ocorrencia em andamento de um turno que fechou ha duas semanas.
         */
        const situacao = encerrado
          ? aleatorio(["FINALIZADA", "FINALIZADA", "FINALIZADA", "INTERCORRENCIA"])
          : aleatorio(["PENDENTE", "ATRIBUIDA", "EM_ANDAMENTO", "FINALIZADA"]);
        const hora = turno === "DIURNO"
          ? `${String(inteiro(7, 18)).padStart(2, "0")}:${String(inteiro(0, 59)).padStart(2, "0")}`
          : `${String(inteiro(19, 23)).padStart(2, "0")}:${String(inteiro(0, 59)).padStart(2, "0")}`;

        const { rows: oc } = await cliente.query(
          `INSERT INTO ocorrencia
             (protocolo, tipo, descricao, data, hora, endereco, id_servico_diario,
              criado_por, status, descricao_atendimento, data_finalizacao)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id_ocorrencia`,
          [
            `OC-${dataRelativa(-dia).replace(/-/g, "")}-${String(ocorrencias + 1).padStart(4, "0")}`,
            tipo, descricao, dataRelativa(-dia), hora, aleatorio(VIA), idServico,
            usuarios[0], situacao,
            // O banco exige as duas colunas juntas quando a ocorrencia esta
            // FINALIZADA (chk_ocorrencia_finalizacao).
            situacao === "FINALIZADA" ? "Equipe atendeu no local e liberou a via." : null,
            situacao === "FINALIZADA" ? `${dataRelativa(-dia)} ${hora}:00` : null,
          ]
        );
        ocorrencias++;

        // Quem foi atender. Ocorrencia PENDENTE, por definicao, nao tem equipe.
        if (situacao !== "PENDENTE" && equipesDoTurno.length && viaturas.length) {
          const equipe = aleatorio(equipesDoTurno);
          await cliente.query(
            `INSERT INTO distribuicao_ocorrencia
               (id_ocorrencia, id_servico_diario, id_equipe, id_veiculo,
                id_coordenador, data, hora, tipo, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'ATRIBUICAO',$8)`,
            [
              oc[0].id_ocorrencia, idServico, equipe.id, aleatorio(viaturas),
              coordenador, dataRelativa(-dia), hora,
              situacao === "FINALIZADA" ? "FINALIZADA" : "ATIVA",
            ]
          );
        }
      }

      // --- checklist da viatura, um por equipe do turno ---
      for (const equipe of equipesDoTurno) {
        // Viatura que esta na rua agora fica de fora ate dos turnos passados:
        // fechar um checklist devolve o veiculo para DISPONIVEL (gatilho), e
        // isso "devolveria" um carro que continua fora com outro checklist.
        const livres = viaturas.filter((v) => !naRua.has(v));
        if (!livres.length) continue;
        const idVeiculo = aleatorio(livres);
        if (!encerrado) naRua.add(idVeiculo);
        const kmSaida = kmDoVeiculo.get(idVeiculo);
        const rodou = inteiro(20, 180);

        const { rows: ck } = await cliente.query(
          `INSERT INTO checklist_fiscalizacao
             (id_veiculo, id_servico_diario, id_equipe, data_abertura, hora_saida,
              odometro_saida, observacoes, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'ABERTO') RETURNING id_checklist`,
          [
            idVeiculo, idServico, equipe.id, dataRelativa(-dia),
            turno === "DIURNO" ? "07:20" : "19:20",
            kmSaida, "Viatura conferida na saida da garagem.",
          ]
        );
        const idChecklist = ck[0].id_checklist;

        // Os dois fiscais assinam. Sem isso o UPDATE para FINALIZADO abaixo
        // seria recusado pelo gatilho.
        await cliente.query(
          `INSERT INTO checklist_fiscal_servidor (id_checklist, id_servidor, tipo)
           VALUES ($1,$2,'FISCAL_1'), ($1,$3,'FISCAL_2')`,
          [idChecklist, equipe.membros[0], equipe.membros[1]]
        );

        /*
         * Fecha em DOIS passos, e nao num INSERT so, porque o gatilho que
         * confere os dois fiscais roda no UPDATE OF status - um checklist
         * inserido ja FINALIZADO passaria sem ninguem ter assinado.
         */
        if (encerrado) {
          await cliente.query(
            `UPDATE checklist_fiscalizacao
                SET hora_chegada = $2, odometro_chegada = $3,
                    data_finalizacao = $4, status = 'FINALIZADO'
              WHERE id_checklist = $1`,
            [
              idChecklist, turno === "DIURNO" ? "18:40" : "06:40",
              kmSaida + rodou, `${dataRelativa(-dia)} ${turno === "DIURNO" ? "18:45" : "06:45"}:00`,
            ]
          );
          kmDoVeiculo.set(idVeiculo, kmSaida + rodou);
        }
        checklistsFisc++;

        // --- pontuacao da equipe naquele turno ---
        if (encerrado && Math.random() > 0.5) {
          const item = aleatorio(itensPontuacao);
          const quantidade = inteiro(1, 3);
          await cliente.query(
            `INSERT INTO pontuacao_registro
               (id_item, id_equipe, entidade_origem, id_registro_origem,
                quantidade, pontos_aplicados, data_registro, registrado_por, observacao)
             VALUES ($1,$2,'checklist_fiscalizacao',$3,$4,$5,$6,$7,$8)`,
            [
              item.id, equipe.id, idChecklist, quantidade,
              item.pontos * quantidade,
              `${dataRelativa(-dia)} 20:00:00`, usuarios[0],
              item.pontos < 0 ? "Registrado pelo coordenador do turno." : null,
            ]
          );
          pontos++;
        }
      }
    }
  }

  console.log(
    `${equipes.length} equipes, ${servicos} servicos diarios, ${ocorrencias} ocorrencias, ` +
    `${checklistsFisc} checklists de viatura e ${pontos} pontuacoes criados.`
  );
}

/**
 * Complementa com a Fiscalizacao um banco que JA TEM a Frotas.
 *
 * So acrescenta, nunca altera nem apaga: os fiscais, as viaturas e os
 * usuarios que faltarem sao CRIADOS, e o que ja existe e usado como esta.
 * Isso importa porque este caminho roda sobre um banco em uso - o de testes de
 * quem ja rodou o seed antes, com o que a pessoa cadastrou depois por cima.
 */
async function complementarFiscalizacao(cliente, { setorFisc, cargoFiscal }) {
  // --- fiscais: os que existem, ou seis novos ---
  let fiscais = (
    await cliente.query(
      `SELECT s.id_servidor FROM servidor s
         JOIN cargo c ON c.id_cargo = s.id_cargo
        WHERE unaccent_simples(c.nome) = 'FISCAL DE TRANSITO' AND s.status
        ORDER BY s.id_servidor`
    )
  ).rows.map((r) => r.id_servidor);

  if (fiscais.length < 2) {
    const NOVOS = [
      "Rodrigo Teixeira Nunes", "Camila Ribeiro Duarte", "Thiago Pereira Campos",
      "Larissa Monteiro Freitas", "Diego Carvalho Ramos", "Beatriz Nogueira Lopes",
    ];
    for (let i = 0; i < NOVOS.length; i++) {
      // Matricula livre: o banco pode ja ter servidor cadastrado a mao com o
      // numero que o seed escolheria, e a matricula e unica.
      let matricula = 13500 + i;
      while ((await cliente.query(
        "SELECT 1 FROM servidor WHERE matricula = $1", [String(matricula)]
      )).rowCount) matricula += 100;

      const { rows } = await cliente.query(
        `INSERT INTO servidor
           (nome, cpf, data_nascimento, telefone, email, matricula, cnh, categoria_cnh,
            id_cargo, id_setor, condutor)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, TRUE) RETURNING id_servidor`,
        [
          NOVOS[i],
          String(inteiro(10000000000, 99999999999)),
          `19${inteiro(75, 99)}-${String(inteiro(1, 12)).padStart(2, "0")}-${String(inteiro(1, 28)).padStart(2, "0")}`,
          `629${inteiro(1000, 9999)}${inteiro(1000, 9999)}`,
          NOVOS[i].toLowerCase().split(" ")[0] + ".fiscal" + i + "@cmtt.local",
          String(matricula),
          String(inteiro(10000000000, 99999999999)),
          aleatorio(["AB", "B", "D"]),
          cargoFiscal,
          setorFisc.id_setor,
        ]
      );
      fiscais.push(rows[0].id_servidor);
    }
    console.log(`${NOVOS.length} fiscais de transito criados.`);
  }

  // --- quem assina: os usuarios que ja existem (o admin sempre existe) ---
  const usuarios = (
    await cliente.query("SELECT id_usuario FROM usuario WHERE status ORDER BY id_usuario")
  ).rows.map((r) => r.id_usuario);
  if (!usuarios.length) throw new Error("Nenhum usuario ativo no banco para assinar os registros.");

  const coordenadores = (
    await cliente.query(
      `SELECT DISTINCT s.id_servidor FROM usuario u
         JOIN servidor s ON s.id_servidor = u.id_servidor
        WHERE u.status AND s.status`
    )
  ).rows.map((r) => r.id_servidor);

  // --- viaturas: as que existem, ou quatro novas na Fiscalizacao ---
  const livres = (
    await cliente.query(
      `SELECT COUNT(*)::int AS n FROM veiculo
        WHERE viatura = TRUE AND status NOT IN ('EM_MANUTENCAO', 'INATIVO')`
    )
  ).rows[0].n;

  if (livres === 0) {
    const MODELOS = [
      ["Chevrolet", "Spin LT 1.8", "AUTOMOVEL"], ["Volkswagen", "Gol 1.6 MSI", "AUTOMOVEL"],
      ["Fiat", "Strada Endurance 1.4", "CAMINHONETE"], ["Honda", "CG 160 Titan", "MOTOCICLETA"],
    ];
    for (let i = 0; i < MODELOS.length; i++) {
      const [marca, modelo, tipo] = MODELOS[i];
      // Placa livre, no padrao Mercosul (LLLNLNN).
      let placaNova;
      do {
        placaNova = `FSC${inteiro(1, 9)}${"ABCDEFGHJ"[inteiro(0, 8)]}${inteiro(10, 99)}`;
      } while ((await cliente.query("SELECT 1 FROM veiculo WHERE placa = $1", [placaNova])).rowCount);

      const ano = inteiro(2019, 2025);
      const { rows } = await cliente.query(
        `INSERT INTO veiculo
           (placa, marca, modelo, ano_fabricacao, ano_modelo, cor, tipo_veiculo,
            renavam, chassi, tipo_combustivel, quilometragem_atual, id_setor,
            status, vinculo)
         VALUES ($1,$2,$3,$4,$4,'Branco',$5,$6,$7,'FLEX',$8,$9,'DISPONIVEL','PROPRIO')
         RETURNING id_veiculo`,
        [
          placaNova, marca, modelo, ano, tipo,
          String(inteiro(10000000000, 99999999999)),
          `9BF${Math.random().toString(36).slice(2, 16).toUpperCase()}`,
          inteiro(5000, 40000), setorFisc.id_setor,
        ]
      );
      await cliente.query(
        "INSERT INTO qr_code (id_veiculo, codigo, token) VALUES ($1, $2, $3)",
        [rows[0].id_veiculo, `SITRA-${placaNova}`,
         Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)]
      );
    }
    console.log(`${MODELOS.length} viaturas criadas.`);
  }

  /*
   * O ultimo odometro de cada veiculo, pela MESMA conta que o gatilho
   * validar_odometro_checklist faz: o km do cadastro ou o maior odometro ja
   * registrado em qualquer checklist, o que for maior. Partir so do km do
   * cadastro faria o primeiro checklist novo ser recusado por "odometro menor
   * que o ultimo registrado" - e o seed inteiro voltaria atras.
   */
  const km = await cliente.query(
    `SELECT v.id_veiculo, GREATEST(v.quilometragem_atual, COALESCE((
        SELECT MAX(x.o) FROM (
          SELECT odometro_saida AS o FROM checklist_frotas WHERE id_veiculo = v.id_veiculo
          UNION ALL SELECT odometro_chegada FROM checklist_frotas WHERE id_veiculo = v.id_veiculo
          UNION ALL SELECT odometro_saida FROM checklist_fiscalizacao WHERE id_veiculo = v.id_veiculo
          UNION ALL SELECT odometro_chegada FROM checklist_fiscalizacao WHERE id_veiculo = v.id_veiculo
        ) x), 0))::int AS km
       FROM veiculo v`
  );
  const kmDoVeiculo = new Map(km.rows.map((r) => [r.id_veiculo, r.km]));

  await semearFiscalizacao(cliente, {
    fiscais,
    coordenadores: coordenadores.length ? coordenadores : fiscais,
    usuarios,
    kmDoVeiculo,
  });
}

/*
 * Nunca em producao.
 *
 * Os dados de exemplo sao inventados: servidores com CPF sorteado, ocorrencias
 * que nao aconteceram, pontuacao de equipe que nao existe. Misturados ao banco
 * de verdade da CMTT, contaminariam relatorio, auditoria e pontuacao - e nao ha
 * como separar depois o que e real do que foi gerado aqui.
 */
if (process.env.NODE_ENV === "production") {
  console.error("seed:demo recusado: NODE_ENV=production. Dados de exemplo nao entram em producao.");
  process.exit(1);
}

const cliente = await pool.connect();
try {
  // Onde vai escrever, ANTES de escrever. Com duas branches no Neon (dev e
  // production), o .env apontado para a errada e um engano facil - e ver o
  // endereco aqui e a ultima chance de perceber.
  console.log(`Banco: ${process.env.PGHOST || "localhost"} / ${process.env.PGDATABASE || "sitra"}`);

  const { rows: [ja] } = await cliente.query(
    `SELECT (SELECT COUNT(*)::int FROM veiculo) AS veiculos,
            (SELECT COUNT(*)::int FROM equipe)  AS equipes`
  );

  if (ja.veiculos > 0 && ja.equipes > 0) {
    console.log(
      `Ja existem ${ja.veiculos} veiculos e ${ja.equipes} equipes. Nada a fazer.`
    );
    process.exit(0);
  }

  await cliente.query("BEGIN");

  const setores = (await cliente.query("SELECT id_setor FROM setor ORDER BY id_setor LIMIT 12")).rows;
  const idSetor = () => aleatorio(setores).id_setor;

  /*
   * O setor da Fiscalizacao, pelo nome ignorando acento.
   *
   * Ele decide duas coisas que as telas da Fiscalizacao dependem: quem e
   * fiscal (o cargo "Fiscal de Transito" e exclusivo deste setor) e o que e
   * viatura (um gatilho marca viatura = TRUE para todo veiculo lotado aqui).
   * Sem viatura e sem fiscal, metade do modulo abre vazia.
   */
  const setorFisc = (
    await cliente.query(
      "SELECT id_setor FROM setor WHERE unaccent_simples(nome) LIKE '%FISCALIZACAO%' LIMIT 1"
    )
  ).rows[0];
  if (!setorFisc) {
    throw new Error(
      "Nao existe setor de Fiscalizacao. Rode a API uma vez para a instalacao criar os setores."
    );
  }

  /*
   * ---------------------------------------------------------------------------
   * Cargos
   * ---------------------------------------------------------------------------
   * Cargo virou CADASTRO na migracao 014: a coluna cargo_funcao do servidor e
   * so um espelho, preenchido por gatilho a partir de id_cargo.
   *
   * Este seed gravava o cargo como texto e deixava id_cargo nulo. O resultado
   * era silencioso e confuso: a coluna "Cargo" aparecia preenchida na tela de
   * Servidores, mas nenhuma regra que depende do cargo funcionava - a tela de
   * Fiscais, que lista quem tem cargo de Fiscal de Transito, abria vazia com
   * seis fiscais cadastrados no banco.
   *
   * "Fiscal de Transito" nasce preso ao setor da Fiscalizacao; os outros sao
   * globais (existem em vario setor ao mesmo tempo). O SELECT antes do INSERT
   * e porque a instalacao ja cria alguns deles - e o indice unico e sobre
   * unaccent_simples(nome), entao "Gestor de Frotas" ja existente colidiria.
   */
  async function cargo(nome, idSetorDoCargo = null) {
    const achado = await cliente.query(
      `SELECT id_cargo FROM cargo
        WHERE unaccent_simples(nome) = unaccent_simples($1)
          AND id_setor IS NOT DISTINCT FROM $2`,
      [nome, idSetorDoCargo]
    );
    if (achado.rows[0]) return achado.rows[0].id_cargo;
    const { rows } = await cliente.query(
      "INSERT INTO cargo (nome, id_setor) VALUES ($1, $2) RETURNING id_cargo",
      [nome, idSetorDoCargo]
    );
    return rows[0].id_cargo;
  }

  const cargoFiscal = await cargo("Fiscal de Trânsito", setorFisc.id_setor);
  const cargoMotorista = await cargo("Motorista");
  const cargoGestor = await cargo("Gestor de Frotas");
  const cargoAgente = await cargo("Agente Administrativo");

  /*
   * A Frotas ja tem dados, a Fiscalizacao nao: complementa so ela.
   *
   * E o banco de quem rodou o seed antes de ele conhecer a Fiscalizacao. Sem
   * este caminho, a regra "banco com veiculo -> nada a fazer" deixava o modulo
   * vazio para sempre, e a unica saida era apagar tudo e comecar de novo.
   */
  if (ja.veiculos > 0) {
    console.log(`Ja existem ${ja.veiculos} veiculos: complementando so a Fiscalizacao.`);
    await complementarFiscalizacao(cliente, { setorFisc, cargoFiscal });
    await cliente.query("COMMIT");
    console.log("Dados de exemplo prontos.");
    cliente.release();
    await pool.end();
    process.exit(0);
  }

  // --- servidores ---
  /*
   * Os seis primeiros sao da frota (e viram usuarios logo abaixo); os seis
   * ultimos sao fiscais de transito, lotados na Fiscalizacao.
   *
   * A divisao e fixa, e nao sorteada, porque as equipes de fiscalizacao
   * precisam de dois fiscais cada: com cargo sorteado, uma rodada do seed podia
   * gerar um fiscal so e as equipes saiam incompletas.
   */
  const servidores = [];
  const fiscais = [];
  for (let i = 0; i < NOMES.length; i++) {
    const ehFiscal = i >= 6;
    const { rows } = await cliente.query(
      `INSERT INTO servidor
         (nome, cpf, data_nascimento, telefone, email, matricula, cnh, categoria_cnh,
          id_cargo, id_setor, condutor)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, TRUE) RETURNING id_servidor`,
      [
        NOMES[i],
        `${String(100 + i).padStart(3, "0")}${inteiro(100, 999)}${inteiro(100, 999)}${inteiro(10, 99)}`,
        `19${inteiro(70, 99)}-${String(inteiro(1, 12)).padStart(2, "0")}-${String(inteiro(1, 28)).padStart(2, "0")}`,
        `649${inteiro(1000, 9999)}${inteiro(1000, 9999)}`,
        NOMES[i].toLowerCase().split(" ")[0] + i + "@cmtt.local",
        String(12500 + i),
        String(inteiro(10000000000, 99999999999)),
        aleatorio(["AB", "B", "AD", "D"]),
        // cargo_funcao NAO vai aqui: o gatilho sitra_espelhar_cargo copia o
        // nome do cargo escolhido. Mandar os dois deixaria os dois discordando.
        ehFiscal ? cargoFiscal : aleatorio([cargoMotorista, cargoGestor, cargoAgente]),
        ehFiscal ? setorFisc.id_setor : idSetor(),
      ]
    );
    servidores.push(rows[0].id_servidor);
    if (ehFiscal) fiscais.push(rows[0].id_servidor);
  }

  // --- usuarios para os servidores que assinam registros ---
  const bcrypt = (await import("bcryptjs")).default;
  const perfilGestor = (
    await cliente.query(
      // Ignorando acento, como em todo lugar que procura perfil pelo nome: a
      // migracao 024 acentua esses cadastros.
      "SELECT id_perfil FROM perfil WHERE unaccent_simples(nome) = 'GESTOR'"
    )
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
          renavam, chassi, tipo_combustivel, quilometragem_atual, id_setor, status,
          vinculo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id_veiculo`,
      [
        placa(i), marca, modelo, ano, ano, aleatorio(CORES), tipo,
        String(inteiro(10000000000, 99999999999)),
        `9B${String(i).padStart(2, "0")}${Math.random().toString(36).slice(2, 15).toUpperCase()}`,
        /*
         * Um de cada tres veiculos fica lotado na Fiscalizacao, e por isso
         * nasce marcado como viatura (gatilho sitra_viatura_pelo_setor).
         *
         * Antes o setor era sorteado entre todos, e havia rodada do seed em que
         * a Fiscalizacao ficava com nenhuma viatura - a tela de Viaturas abria
         * vazia e nao era possivel nem criar um checklist de fiscalizacao.
         */
        combustivel, 0, i % 3 === 0 ? setorFisc.id_setor : idSetor(), 'DISPONIVEL',
        aleatorio(["PROPRIO", "PATRIMONIO", "LOCADO"]),
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

  /*
   * Veiculos que ja estao na rua (checklist ABERTO).
   *
   * O banco nao deixa um veiculo ter dois checklists abertos ao mesmo tempo
   * (indice uq_checklist_frotas_ativo) - faz sentido, o carro nao sai duas
   * vezes. So que o sorteio abaixo ignorava isso: no dia de hoje, quando dois
   * checklists abertos caiam no mesmo veiculo, o seed INTEIRO voltava atras.
   * Era raro o bastante para parecer que funcionava.
   */
  const naRua = new Set();

  for (let dia = 45; dia >= 0; dia--) {
    for (let n = 0; n < inteiro(2, 6); n++) {
      const finalizado = dia > 0 || Math.random() > 0.4;
      const livres = finalizado ? veiculos : veiculos.filter((v) => !naRua.has(v));
      if (!livres.length) continue;
      const idVeiculo = aleatorio(livres);
      if (!finalizado) naRua.add(idVeiculo);
      const kmSaida = kmDoVeiculo.get(idVeiculo);
      const rodou = inteiro(15, 250);

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

  await semearFiscalizacao(cliente, {
    fiscais,
    coordenadores: servidores.slice(0, 6),
    usuarios,
    kmDoVeiculo,
  });


  // --- documentos, com vencimentos espalhados nas faixas 30/90/120 ---
  let documentos = 0;
  for (const idVeiculo of veiculos) {
    for (const tipo of DOCUMENTOS.slice(0, inteiro(2, 5))) {
      const dias = aleatorio([-40, -12, 8, 21, 45, 70, 88, 100, 115, 200, 320]);
      const status = dias < 0 ? "VENCIDO" : dias <= 30 ? "VENCENDO" : "VALIDO";
      await cliente.query(
        `INSERT INTO documento_veiculo
           (id_veiculo, tipo_documento, numero_documento, data_emissao, data_validade,
            status, categoria, id_responsavel)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          idVeiculo, tipo, String(inteiro(100000000, 999999999)),
          dataRelativa(dias - 365), dataRelativa(dias), status,
          CATEGORIAS[tipo], aleatorio(servidores),
        ]
      );
      documentos++;
    }
  }

  // --- inspecoes ---
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
        null, // local: a inspecao e sempre feita na CMTT, o campo saiu da tela
        `INS-2026-${String(i + 1).padStart(5, "0")}`,
        dataRelativa(-dia + proximo), null,
      ]
    );

    // A semanal confere 14 itens; as outras, 21. Os dados de exemplo precisam
    // mostrar essa diferenca, senao a tela de detalhes parece sempre igual.
    for (const { item, grupo } of itensDaInspecao(tipo)) {
      const sorte = Math.random();
      const resultado = !comAvaria || sorte > 0.25 ? "NORMAL" : sorte > 0.12 ? "ATENCAO" : "AVARIA";
      await cliente.query(
        `INSERT INTO inspecao_item (id_inspecao, item, grupo, resultado, observacao)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          rows[0].id_inspecao, item, grupo, resultado,
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
  // cadastro do veiculo para tras cria um veiculo que nao aceita nova saida:
  // o proximo condutor digitaria o KM correto do painel e levaria "odometro
  // invalido", sem ter feito nada errado.
  await cliente.query(
    `UPDATE veiculo v
        SET quilometragem_atual = GREATEST(v.quilometragem_atual, COALESCE((
            SELECT MAX(x.odometro) FROM (
                SELECT c.odometro_saida AS odometro FROM checklist_frotas c
                 WHERE c.id_veiculo = v.id_veiculo
                UNION ALL
                SELECT c.odometro_chegada FROM checklist_frotas c
                 WHERE c.id_veiculo = v.id_veiculo AND c.odometro_chegada IS NOT NULL
                UNION ALL
                SELECT c.odometro_saida FROM checklist_fiscalizacao c
                 WHERE c.id_veiculo = v.id_veiculo
                UNION ALL
                SELECT c.odometro_chegada FROM checklist_fiscalizacao c
                 WHERE c.id_veiculo = v.id_veiculo AND c.odometro_chegada IS NOT NULL
            ) x
        ), 0))`
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
        SELECT id_veiculo FROM checklist_frotas WHERE status = 'ABERTO'
        UNION
        -- a viatura que saiu no turno de hoje tambem esta na rua: por em
        -- manutencao uma viatura com checklist aberto seria incoerente
        SELECT id_veiculo FROM checklist_fiscalizacao WHERE status = 'ABERTO')`
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
