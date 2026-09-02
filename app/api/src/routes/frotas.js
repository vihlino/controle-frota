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
  filtros: { setor: "veiculo.id_setor", status: "veiculo.status", tipo: "veiculo.tipo_veiculo" },
  ordenaveis: {
    placa: "veiculo.placa", marca: "veiculo.marca", modelo: "veiculo.modelo",
    ano_modelo: "veiculo.ano_modelo", setor: "setor.nome", status: "veiculo.status",
  },
  ordemPadrao: "veiculo.placa",
  campos: [
    "placa", "marca", "modelo", "ano_fabricacao", "ano_modelo", "cor", "tipo_veiculo",
    "renavam", "chassi", "tipo_combustivel", "capacidade", "quilometragem_atual",
    "id_setor", "observacoes", "status",
  ],
  obrigatorios: [
    "placa", "marca", "modelo", "ano_fabricacao", "ano_modelo", "cor",
    "tipo_veiculo", "tipo_combustivel", "id_setor",
  ],
  permissoes: { ver: VER, gerenciar: "FROTAS_GERENCIAR_VEICULOS" },
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
           (checklist_frotas.odometro_chegada - checklist_frotas.odometro_saida) AS km_rodado,
           (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                     'equipamento', e.equipamento, 'conforme', e.conforme,
                     'momento', e.momento, 'observacao', e.observacao)), '[]'::jsonb)
              FROM checklist_frotas_equipamento e
             WHERE e.id_checklist = checklist_frotas.id_checklist) AS equipamentos,
           (SELECT COUNT(*) FROM checklist_frotas_foto f
             WHERE f.id_checklist = checklist_frotas.id_checklist) AS total_fotos`,
  from: `checklist_frotas
         JOIN servidor ON servidor.id_servidor = checklist_frotas.id_servidor
         JOIN veiculo  ON veiculo.id_veiculo   = checklist_frotas.id_veiculo`,
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
  permissoes: { ver: VER, gerenciar: "FROTAS_GERENCIAR_VEICULOS" },
});

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
});

// ---------- Manutencoes / Ordens de servico ----------
export const manutencoes = criarCrud({
  tabela: "ordem_servico",
  id: "id_os",
  entidade: "ordem_servico",
  select: `ordem_servico.*,
           veiculo.placa, veiculo.marca, veiculo.modelo,
           solicitante.nome AS solicitante,
           responsavel.nome AS responsavel`,
  from: `ordem_servico
         JOIN veiculo ON veiculo.id_veiculo = ordem_servico.id_veiculo
         JOIN usuario  u_sol ON u_sol.id_usuario = ordem_servico.id_solicitante
         JOIN servidor solicitante ON solicitante.id_servidor = u_sol.id_servidor
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
  ],
  obrigatorios: ["id_veiculo", "origem", "gravidade", "id_solicitante", "tipo"],
  permissoes: { ver: VER, gerenciar: "FROTAS_GERENCIAR_OS" },
});

// ---------- Documentos ----------
export const documentos = criarCrud({
  tabela: "documento_veiculo",
  id: "id_documento",
  entidade: "documento",
  select: `documento_veiculo.*,
           veiculo.placa, veiculo.marca, veiculo.modelo,
           servidor.nome AS responsavel,
           (documento_veiculo.data_validade - CURRENT_DATE) AS dias_para_vencer`,
  from: `documento_veiculo
         JOIN veiculo ON veiculo.id_veiculo = documento_veiculo.id_veiculo
         LEFT JOIN servidor ON servidor.id_servidor = documento_veiculo.id_responsavel`,
  busca: ["veiculo.placa", "documento_veiculo.tipo_documento", "documento_veiculo.numero_documento"],
  filtros: {
    veiculo: "documento_veiculo.id_veiculo", status: "documento_veiculo.status",
    categoria: "documento_veiculo.categoria", responsavel: "documento_veiculo.id_responsavel",
    validadeDe: "documento_veiculo.data_validade", validadeAte: "documento_veiculo.data_validade",
  },
  ordenaveis: {
    tipo_documento: "documento_veiculo.tipo_documento", placa: "veiculo.placa",
    data_validade: "documento_veiculo.data_validade", status: "documento_veiculo.status",
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
