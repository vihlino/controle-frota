/**
 * frotas.js - Recursos do modulo de Frotas.
 *
 * Este arquivo nao tem logica: ele so DECLARA como cada recurso funciona, e a
 * fabrica em crud.js transforma isso em rotas. Leia crud.js antes, para
 * entender o que cada campo da configuracao faz.
 *
 * Recursos declarados aqui:
 *   /api/frotas/veiculos      cadastro da frota
 *   /api/frotas/checklists    registros de saida e chegada (criados via QR Code)
 *   /api/frotas/inspecoes     inspecoes periodicas
 *   /api/frotas/manutencoes   ordens de servico
 *   /api/frotas/documentos    documentos dos veiculos e vencimentos
 *   /api/frotas/sinistros     ocorrencias com veiculos
 *
 * ATENCAO AOS JOINs: algumas colunas do banco (id_gestor, id_solicitante,
 * id_responsavel) apontam para USUARIO, nao para SERVIDOR. Para chegar ao nome
 * da pessoa e preciso passar por usuario -> servidor. Ja foi motivo de bug.
 */
import { Router } from "express";
import { criarCrud } from "../crud.js";
import { pool } from "../db.js";
import { autenticar, exigePermissao } from "../auth.js";
import { registrarAuditoria } from "../auditoria.js";

const VER = "FROTAS_VISUALIZAR";

// ---------- Veiculos ----------
export const veiculos = criarCrud({
  tabela: "veiculo",
  id: "id_veiculo",
  entidade: "veiculo",
  select: `veiculo.*, setor.nome AS setor,
           (SELECT codigo FROM qr_code q WHERE q.id_veiculo = veiculo.id_veiculo) AS qr_codigo`,
  from: "veiculo JOIN setor ON setor.id_setor = veiculo.id_setor",
  busca: ["veiculo.placa", "veiculo.marca", "veiculo.modelo", "veiculo.renavam", "veiculo.chassi"],
  filtros: {
    setor: "veiculo.id_setor", status: "veiculo.status", tipo: "veiculo.tipo_veiculo",
    vinculo: "veiculo.vinculo",
    // A tela de Viaturas da Fiscalizacao usa este filtro.
    viatura: "veiculo.viatura",
  },
  ordenaveis: {
    placa: "veiculo.placa", marca: "veiculo.marca", modelo: "veiculo.modelo",
    ano_modelo: "veiculo.ano_modelo", setor: "setor.nome", status: "veiculo.status",
  },
  ordemPadrao: "veiculo.placa",
  campos: [
    "placa", "marca", "modelo", "ano_fabricacao", "ano_modelo", "cor", "tipo_veiculo",
    "renavam", "chassi", "tipo_combustivel", "capacidade", "quilometragem_atual",
    "id_setor", "vinculo", "observacoes", "status",
    // "viatura" NAO entra: a coluna e calculada pelo banco a partir do setor
    // (migracao 016). Aceita-la aqui deixaria a tela gravar um valor que o
    // gatilho sobrescreve no mesmo instante - o pior tipo de campo, o que
    // parece funcionar e nao funciona.
  ],
  // Cor e combustivel NAO entram aqui: a tela sempre ofereceu os dois como
  // opcionais. A cor ja tinha sido tirada; o combustivel continuava exigido, e
  // era a razao de "Preencha: tipo_combustivel" ao cadastrar um veiculo sem
  // informar o combustivel - uma mensagem sobre um campo que a propria tela
  // diz ser opcional. A migracao 014 tirou o NOT NULL das duas colunas.
  obrigatorios: [
    "placa", "marca", "modelo", "ano_fabricacao", "ano_modelo",
    "tipo_veiculo", "id_setor",
  ],
  // Placa e codigo: sempre em caixa alta. Marca e cor sao nomes, e ficam com a
  // primeira letra maiuscula - assim a lista ordena certo e o mesmo veiculo
  // nao aparece escrito de tres jeitos.
  //
  // MODELO fica de fora de proposito: nome de versao e cheio de sigla
  // ("S10 LS 2.8", "ONIX 10TMT LT1"), e forcar a primeira letra maiuscula
  // estragava justamente essas ("S10 ls 2.8"). Aqui o certo e respeitar o que
  // a pessoa digitou, que e quem esta lendo o documento do veiculo.
  normalizacoes: {
    placa: "maiusculas",
    marca: "primeiraMaiuscula",
    cor: "primeiraMaiuscula",
  },
  // A tela de Viaturas, na Fiscalizacao, e ESTE mesmo cadastro filtrado - uma
  // viatura e um veiculo da frota vinculado ao setor de Fiscalizacao, nao um
  // cadastro a parte. Exigindo so FROTAS_VISUALIZAR, o gestor de fiscalizacao
  // abria "Viaturas" e recebia 403 numa tela do proprio modulo dele.
  // Gerenciar continua exigindo a permissao de Frotas: quem manda no cadastro
  // do veiculo e a frota, mesmo quando o veiculo esta na fiscalizacao.
  permissoes: {
    ver: [VER, "FISCALIZACAO_VISUALIZAR"],
    gerenciar: ["FROTAS_GERENCIAR_VEICULOS", "FISCALIZACAO_GERENCIAR_VIATURAS"],
  },
});

// ---------- Checklists ----------
// Nao existe POST pela tela administrativa: o checklist nasce da leitura do
// QR Code do veiculo, na rota /api/checklist-qr.
export const checklists = criarCrud({
  tabela: "checklist_frotas",
  id: "id_checklist",
  entidade: "checklist",
  select: `checklist_frotas.*,
           servidor.nome AS condutor, servidor.matricula,
           veiculo.placa, veiculo.marca, veiculo.modelo,
           veiculo.ano_fabricacao, veiculo.ano_modelo, veiculo.cor,
           veiculo.tipo_veiculo, setor.nome AS setor,
           (checklist_frotas.odometro_chegada - checklist_frotas.odometro_saida) AS km_rodado,
           (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                     'equipamento', e.equipamento, 'conforme', e.conforme,
                     'momento', e.momento, 'observacao', e.observacao)), '[]'::jsonb)
              FROM checklist_frotas_equipamento e
             WHERE e.id_checklist = checklist_frotas.id_checklist) AS equipamentos,
           (SELECT COUNT(*) FROM checklist_frotas_foto f
             WHERE f.id_checklist = checklist_frotas.id_checklist) AS total_fotos,
           (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                     'id_os', os.id_os, 'numero', os.numero,
                     'parte_veiculo', os.parte_veiculo, 'gravidade', os.gravidade,
                     'descricao', os.descricao, 'status', os.status,
                     'momento', os.momento, 'data_abertura', os.data_abertura)
                     ORDER BY os.data_abertura), '[]'::jsonb)
              FROM ordem_servico os
             WHERE os.origem = 'CHECKLIST_FROTAS'
               AND os.id_registro_origem = checklist_frotas.id_checklist) AS chamados`,
  from: `checklist_frotas
         JOIN servidor ON servidor.id_servidor = checklist_frotas.id_servidor
         JOIN veiculo  ON veiculo.id_veiculo   = checklist_frotas.id_veiculo
         JOIN setor    ON setor.id_setor       = veiculo.id_setor`,
  busca: ["veiculo.placa", "servidor.nome", "checklist_frotas.percurso"],
  filtros: {
    veiculo: "checklist_frotas.id_veiculo",
    status: "checklist_frotas.status",
    dataDe: "checklist_frotas.data_abertura",
    dataAte: "checklist_frotas.data_abertura",
  },
  ordenaveis: {
    data_abertura: "checklist_frotas.data_abertura",
    criado_em: "checklist_frotas.criado_em",
    data_finalizacao: "checklist_frotas.data_finalizacao",
    placa: "veiculo.placa",
    condutor: "servidor.nome",
    km_rodado: "(checklist_frotas.odometro_chegada - checklist_frotas.odometro_saida)",
  },
  ordemPadrao: "checklist_frotas.criado_em DESC",
  campos: [
    "id_veiculo", "id_servidor", "data_abertura", "hora_saida", "data_devolucao",
    "hora_chegada", "odometro_saida", "odometro_chegada", "observacoes", "status",
    "percurso", "local_saida", "data_finalizacao", "observacoes_chegada",
  ],
  obrigatorios: ["id_veiculo", "id_servidor", "odometro_saida"],
  // Corrigir checklist tem permissao PROPRIA (migracao 019). Quem cadastra
  // veiculo nao ganha de brinde o poder de reescrever o historico de saidas.
  permissoes: { ver: VER, gerenciar: "FROTAS_EDITAR_CHECKLIST" },
  // O checklist e prova de um fato. Alterar um numero dele exige dizer por
  // que, e o motivo fica na auditoria junto do antes e do depois.
  exigeJustificativa: true,
});

/*
 * PUT /checklists/:id/equipamentos  -  corrige a conferencia de equipamentos.
 *
 * POR QUE UMA ROTA SEPARADA
 * -------------------------
 * Os equipamentos nao sao colunas do checklist: sao linhas de outra tabela,
 * uma por item e por momento (saida e chegada conferem os mesmos quatro
 * itens). O CRUD generico sabe gravar colunas, nao filhos - e ensina-lo a
 * fazer isso deixaria toda tela do sistema carregando um caso que so o
 * checklist tem.
 *
 * A gravacao SUBSTITUI as linhas daquele momento, em transacao. Atualizar uma
 * por uma deixaria o registro pela metade se a segunda falhasse, e o checklist
 * mostraria macaco conferido e estepe nao - sem ninguem ter escolhido isso.
 */
checklists.put(
  "/:id/equipamentos",
  autenticar,
  exigePermissao("FROTAS_EDITAR_CHECKLIST"),
  async (req, res, next) => {
    const cliente = await pool.connect();
    try {
      const idChecklist = Number(req.params.id);
      const { momento, itens } = req.body || {};
      const justificativa = String(req.body?.justificativa || "").trim();
      if (momento !== "SAIDA" && momento !== "CHEGADA") {
        return res.status(400).json({ erro: "Momento inválido." });
      }
      if (!Array.isArray(itens)) {
        return res.status(400).json({ erro: "Informe os itens conferidos." });
      }

      await cliente.query("BEGIN");

      const existe = await cliente.query(
        "SELECT id_checklist FROM checklist_frotas WHERE id_checklist = $1",
        [idChecklist]
      );
      if (!existe.rows[0]) {
        await cliente.query("ROLLBACK");
        return res.status(404).json({ erro: "Checklist não encontrado." });
      }

      const antes = await cliente.query(
        `SELECT equipamento, conforme, observacao FROM checklist_frotas_equipamento
          WHERE id_checklist = $1 AND COALESCE(momento, 'SAIDA') = $2`,
        [idChecklist, momento]
      );

      await cliente.query(
        `DELETE FROM checklist_frotas_equipamento
          WHERE id_checklist = $1 AND COALESCE(momento, 'SAIDA') = $2`,
        [idChecklist, momento]
      );

      for (const item of itens) {
        await cliente.query(
          `INSERT INTO checklist_frotas_equipamento
             (id_checklist, equipamento, conforme, observacao, momento)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            idChecklist,
            item.equipamento,
            item.conforme === true || item.conforme === "true",
            item.observacao || null,
            momento,
          ]
        );
      }

      await cliente.query("COMMIT");

      await registrarAuditoria({
        idUsuario: req.usuario.id_usuario,
        acao: "EDITAR",
        entidade: "checklist_equipamento",
        idRegistro: idChecklist,
        justificativa: justificativa || null,
        dadosAnteriores: { momento, itens: antes.rows },
        dadosNovos: { momento, itens },
      });

      res.json({ ok: true });
    } catch (e) {
      await cliente.query("ROLLBACK").catch(() => {});
      next(e);
    } finally {
      cliente.release();
    }
  }
);

// ---------- Inspecoes ----------
export const inspecoes = criarCrud({
  tabela: "inspecao",
  id: "id_inspecao",
  entidade: "inspecao",
  select: `inspecao.*,
           veiculo.placa, veiculo.marca, veiculo.modelo,
           servidor.nome AS responsavel,
           (SELECT COUNT(*)::int FROM inspecao_item i
             WHERE i.id_inspecao = inspecao.id_inspecao
               AND i.resultado <> 'NORMAL') AS itens_com_ressalva`,
  from: `inspecao
         JOIN veiculo ON veiculo.id_veiculo = inspecao.id_veiculo
         JOIN usuario  u_gestor ON u_gestor.id_usuario  = inspecao.id_gestor
         JOIN servidor          ON servidor.id_servidor = u_gestor.id_servidor`,
  busca: ["veiculo.placa", "servidor.nome", "inspecao.numero"],
  filtros: {
    veiculo: "inspecao.id_veiculo", tipo: "inspecao.tipo", status: "inspecao.status",
    resultado: "inspecao.resultado",
    dataDe: "inspecao.data_realizacao", dataAte: "inspecao.data_realizacao",
  },
  ordenaveis: {
    data_realizacao: "inspecao.data_realizacao", placa: "veiculo.placa",
    tipo: "inspecao.tipo", status: "inspecao.status",
    proxima_inspecao: "inspecao.proxima_inspecao", responsavel: "servidor.nome",
  },
  ordemPadrao: "inspecao.data_realizacao DESC",
  campos: [
    "id_veiculo", "id_gestor", "tipo", "data_programada", "data_realizacao",
    "hora_inicio", "hora_finalizacao", "status", "resultado", "observacoes",
    "data_finalizacao", "local", "numero", "proxima_inspecao", "quilometragem",
  ],
  obrigatorios: ["id_veiculo", "id_gestor", "tipo"],
  permissoes: { ver: VER, gerenciar: "FROTAS_REALIZAR_INSPECAO" },
  // Inspecao tambem e prova de um fato: alterar ou apagar exige dizer por que,
  // e o motivo fica na auditoria junto do antes e do depois.
  exigeJustificativa: true,
});

// ---------- Manutencoes / Ordens de servico ----------
export const manutencoes = criarCrud({
  tabela: "ordem_servico",
  id: "id_os",
  entidade: "ordem_servico",
  // O solicitante pode vir de dois lugares: um USUARIO logado, quando a OS
  // nasce nas telas administrativas, ou um SERVIDOR, quando o condutor abre o
  // chamado pelo checklist do QR Code - ali nao existe login. Os JOINs sao
  // LEFT por isso: com INNER, todo chamado aberto no patio sumia da lista.
  select: `ordem_servico.*,
           veiculo.placa, veiculo.marca, veiculo.modelo,
           COALESCE(solicitante.nome, condutor.nome) AS solicitante,
           responsavel.nome AS responsavel`,
  from: `ordem_servico
         JOIN veiculo ON veiculo.id_veiculo = ordem_servico.id_veiculo
         LEFT JOIN usuario  u_sol ON u_sol.id_usuario = ordem_servico.id_solicitante
         LEFT JOIN servidor solicitante ON solicitante.id_servidor = u_sol.id_servidor
         LEFT JOIN servidor condutor ON condutor.id_servidor = ordem_servico.id_servidor_solicitante
         LEFT JOIN usuario  u_resp ON u_resp.id_usuario = ordem_servico.id_responsavel
         LEFT JOIN servidor responsavel ON responsavel.id_servidor = u_resp.id_servidor`,
  busca: ["veiculo.placa", "ordem_servico.descricao", "ordem_servico.oficina", "ordem_servico.numero"],
  filtros: {
    veiculo: "ordem_servico.id_veiculo", status: "ordem_servico.status",
    tipo: "ordem_servico.tipo", gravidade: "ordem_servico.gravidade",
    origem: "ordem_servico.origem",
    dataDe: "ordem_servico.data_abertura", dataAte: "ordem_servico.data_abertura",
  },
  ordenaveis: {
    data_abertura: "ordem_servico.data_abertura", placa: "veiculo.placa",
    status: "ordem_servico.status", gravidade: "ordem_servico.gravidade",
    custo: "ordem_servico.custo", data_agendada: "ordem_servico.data_agendada",
  },
  ordemPadrao: "ordem_servico.data_abertura DESC",
  campos: [
    "id_veiculo", "origem", "id_registro_origem", "gravidade", "id_solicitante",
    "id_responsavel", "data_inicio", "data_conclusao", "status", "servico_realizado",
    "oficina", "custo", "houve_troca", "observacoes", "tipo", "data_agendada",
    "proxima_manutencao", "quilometragem", "descricao", "numero",
    "id_servidor_solicitante", "parte_veiculo", "momento",
  ],
  obrigatorios: ["id_veiculo", "origem", "gravidade", "id_solicitante", "tipo"],
  permissoes: { ver: VER, gerenciar: "FROTAS_GERENCIAR_OS" },
});

// ---------- Documentos ----------
export const documentos = criarCrud({
  tabela: "documento_veiculo",
  id: "id_documento",
  entidade: "documento",
  /*
   * A situacao vem CALCULADA da data, nao da coluna gravada.
   *
   * documento_veiculo.status e escrito por gatilho, que so dispara quando a
   * linha muda - entao ele congela a situacao do dia do cadastro. Um CRLV
   * gravado como VENCENDO continuava VENCENDO meses depois de vencer, e a tela
   * mostrava "Vencido ha 10 dias" ao lado de um selo amarelo "Vencendo".
   *
   * Por isso as colunas estao listadas uma a uma em vez de
   * "documento_veiculo.*": e a unica forma de a situacao calculada OCUPAR o
   * lugar de status, sem duas colunas com o mesmo nome na resposta. Coluna
   * nova na tabela precisa ser acrescentada aqui tambem.
   *
   * A regra mora em situacao_documento() (migracao 023), usada tambem no
   * filtro e na ordenacao abaixo - as tres precisam concordar, senao a tela
   * filtra por uma situacao e mostra outra.
   */
  select: `documento_veiculo.id_documento, documento_veiculo.id_veiculo,
           documento_veiculo.tipo_documento, documento_veiculo.numero_documento,
           documento_veiculo.data_emissao, documento_veiculo.data_validade,
           documento_veiculo.observacoes, documento_veiculo.categoria,
           documento_veiculo.id_responsavel, documento_veiculo.arquivo_url,
           situacao_documento(documento_veiculo.status,
                              documento_veiculo.data_validade) AS status,
           veiculo.placa, veiculo.marca, veiculo.modelo,
           servidor.nome AS responsavel,
           (documento_veiculo.data_validade - CURRENT_DATE) AS dias_para_vencer`,
  from: `documento_veiculo
         JOIN veiculo ON veiculo.id_veiculo = documento_veiculo.id_veiculo
         LEFT JOIN servidor ON servidor.id_servidor = documento_veiculo.id_responsavel`,
  busca: ["veiculo.placa", "documento_veiculo.tipo_documento", "documento_veiculo.numero_documento"],
  filtros: {
    veiculo: "documento_veiculo.id_veiculo",
    status: "situacao_documento(documento_veiculo.status, documento_veiculo.data_validade)",
    categoria: "documento_veiculo.categoria", responsavel: "documento_veiculo.id_responsavel",
    validadeDe: "documento_veiculo.data_validade", validadeAte: "documento_veiculo.data_validade",
  },
  ordenaveis: {
    tipo_documento: "documento_veiculo.tipo_documento", placa: "veiculo.placa",
    data_validade: "documento_veiculo.data_validade",
    status: "situacao_documento(documento_veiculo.status, documento_veiculo.data_validade)",
    data_emissao: "documento_veiculo.data_emissao",
  },
  ordemPadrao: "documento_veiculo.data_validade",
  campos: [
    "id_veiculo", "tipo_documento", "numero_documento", "data_emissao",
    "data_validade", "status", "observacoes",
    "categoria", "id_responsavel", "arquivo_url",
  ],
  obrigatorios: ["id_veiculo", "tipo_documento"],
  permissoes: { ver: VER, gerenciar: "FROTAS_GERENCIAR_DOCUMENTOS" },
});

// ---------- Sinistros ----------
export const sinistros = criarCrud({
  tabela: "sinistro",
  id: "id_sinistro",
  entidade: "sinistro",
  select: `sinistro.*,
           veiculo.placa, veiculo.marca, veiculo.modelo,
           condutor.nome AS condutor,
           responsavel.nome AS responsavel`,
  from: `sinistro
         JOIN veiculo ON veiculo.id_veiculo = sinistro.id_veiculo
         JOIN servidor condutor ON condutor.id_servidor = sinistro.id_servidor
         JOIN usuario  u_resp ON u_resp.id_usuario = sinistro.id_responsavel
         JOIN servidor responsavel ON responsavel.id_servidor = u_resp.id_servidor`,
  busca: ["veiculo.placa", "sinistro.local", "sinistro.descricao", "sinistro.numero", "sinistro.bo"],
  filtros: {
    veiculo: "sinistro.id_veiculo", status: "sinistro.status", tipo: "sinistro.tipo",
    responsavel: "sinistro.id_responsavel",
    dataDe: "sinistro.data", dataAte: "sinistro.data",
  },
  ordenaveis: {
    data: "sinistro.data", placa: "veiculo.placa", status: "sinistro.status",
    tipo: "sinistro.tipo", numero: "sinistro.numero",
  },
  ordemPadrao: "sinistro.data DESC",
  campos: [
    "id_veiculo", "id_servidor", "data", "hora", "local", "descricao", "bo",
    "observacoes", "status", "id_responsavel", "id_os", "tipo",
    "houve_terceiros", "numero",
  ],
  obrigatorios: ["id_veiculo", "id_servidor", "data", "hora", "local", "descricao", "id_responsavel"],
  permissoes: { ver: VER, gerenciar: "FROTAS_GERENCIAR_SINISTROS" },
});

const router = Router();
router.use("/veiculos", veiculos);
router.use("/checklists", checklists);
router.use("/inspecoes", inspecoes);
router.use("/manutencoes", manutencoes);
router.use("/documentos", documentos);
router.use("/sinistros", sinistros);

export default router;
