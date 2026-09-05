/**
 * fiscalizacao.js - Recursos do modulo de Fiscalizacao.
 *
 * Mesma ideia de frotas.js: so configuracoes para a fabrica em crud.js.
 *
 *   /api/fiscalizacao/servico-diario  escala do dia, por turno
 *   /api/fiscalizacao/equipes         equipes e seus integrantes
 *   /api/fiscalizacao/apoios          apoios extras acionados no turno
 *   /api/fiscalizacao/ocorrencias     ocorrencias atendidas
 *   /api/fiscalizacao/checklists      checklists das viaturas
 *   /api/fiscalizacao/pontuacao       itens de pontuacao (so o gestor ve)
 *
 * A Pontuacao usa a MESMA permissao para ver e para gerenciar, de proposito:
 * e a tela restrita ao gestor da Fiscalizacao.
 */
import { Router } from "express";
import { criarCrud } from "../crud.js";

const VER = "FISCALIZACAO_VISUALIZAR";

export const servicoDiario = criarCrud({
  tabela: "servico_diario",
  id: "id_servico_diario",
  entidade: "servico_diario",
  select: `servico_diario.*,
           coordenador.nome AS coordenador,
           (SELECT COUNT(*)::int FROM servico_equipe se
             WHERE se.id_servico_diario = servico_diario.id_servico_diario) AS equipes,
           (SELECT COUNT(*)::int FROM ocorrencia o
             WHERE o.id_servico_diario = servico_diario.id_servico_diario) AS ocorrencias`,
  from: `servico_diario
         JOIN servidor coordenador ON coordenador.id_servidor = servico_diario.id_coordenador`,
  busca: ["coordenador.nome", "servico_diario.turno"],
  filtros: {
    status: "servico_diario.status", turno: "servico_diario.turno",
    coordenador: "servico_diario.id_coordenador",
    dataDe: "servico_diario.data", dataAte: "servico_diario.data",
  },
  ordenaveis: {
    data: "servico_diario.data", turno: "servico_diario.turno",
    status: "servico_diario.status", coordenador: "coordenador.nome",
  },
  ordemPadrao: "servico_diario.data DESC",
  campos: [
    "data", "turno", "id_coordenador", "criado_por", "hora_inicio",
    "hora_encerramento", "status", "encerrado_por",
  ],
  obrigatorios: ["data", "turno", "id_coordenador", "criado_por"],
  permissoes: { ver: VER, gerenciar: "FISCALIZACAO_GERENCIAR_SERVICO" },
});

export const equipes = criarCrud({
  tabela: "equipe",
  id: "id_equipe",
  entidade: "equipe",
  select: `equipe.*,
           (SELECT COUNT(*)::int FROM equipe_servidor es
             WHERE es.id_equipe = equipe.id_equipe) AS integrantes`,
  from: "equipe",
  busca: ["equipe.numero", "equipe.tipo", "equipe.observacoes"],
  filtros: { status: "equipe.status", tipo: "equipe.tipo" },
  ordenaveis: { numero: "equipe.numero", tipo: "equipe.tipo", status: "equipe.status" },
  ordemPadrao: "equipe.numero",
  campos: ["numero", "tipo", "status", "observacoes"],
  obrigatorios: ["numero", "tipo"],
  permissoes: { ver: VER, gerenciar: "FISCALIZACAO_GERENCIAR_EQUIPES" },
});

export const apoios = criarCrud({
  tabela: "apoio_extra",
  id: "id_apoio",
  entidade: "apoio_extra",
  select: `apoio_extra.*, equipe.numero AS equipe, veiculo.placa, servidor.nome AS servidor`,
  from: `apoio_extra
         LEFT JOIN equipe   ON equipe.id_equipe     = apoio_extra.id_equipe
         LEFT JOIN veiculo  ON veiculo.id_veiculo   = apoio_extra.id_veiculo
         LEFT JOIN servidor ON servidor.id_servidor = apoio_extra.id_servidor`,
  busca: ["apoio_extra.motivo", "equipe.numero", "servidor.nome"],
  filtros: { servico: "apoio_extra.id_servico_diario", equipe: "apoio_extra.id_equipe" },
  ordenaveis: { hora_inicio: "apoio_extra.hora_inicio", equipe: "equipe.numero" },
  ordemPadrao: "apoio_extra.hora_inicio DESC",
  campos: [
    "id_servico_diario", "id_equipe", "id_veiculo", "id_servidor",
    "motivo", "hora_inicio", "hora_fim", "observacoes",
  ],
  obrigatorios: ["id_servico_diario", "motivo"],
  permissoes: { ver: VER, gerenciar: "FISCALIZACAO_GERENCIAR_EQUIPES" },
});

export const ocorrencias = criarCrud({
  tabela: "ocorrencia",
  id: "id_ocorrencia",
  entidade: "ocorrencia",
  select: `ocorrencia.*,
           criador.nome AS criado_por_nome,
           servico_diario.data AS data_servico, servico_diario.turno`,
  from: `ocorrencia
         JOIN usuario  u_cri ON u_cri.id_usuario = ocorrencia.criado_por
         JOIN servidor criador ON criador.id_servidor = u_cri.id_servidor
         LEFT JOIN servico_diario ON servico_diario.id_servico_diario = ocorrencia.id_servico_diario`,
  busca: ["ocorrencia.protocolo", "ocorrencia.tipo", "ocorrencia.endereco", "ocorrencia.descricao"],
  filtros: {
    status: "ocorrencia.status", tipo: "ocorrencia.tipo",
    servico: "ocorrencia.id_servico_diario",
    dataDe: "ocorrencia.data", dataAte: "ocorrencia.data",
  },
  ordenaveis: {
    data: "ocorrencia.data", protocolo: "ocorrencia.protocolo",
    tipo: "ocorrencia.tipo", status: "ocorrencia.status",
  },
  ordemPadrao: "ocorrencia.data DESC, ocorrencia.hora DESC",
  campos: [
    "protocolo", "tipo", "descricao", "data", "hora", "endereco", "observacoes",
    "id_servico_diario", "criado_por", "status", "descricao_atendimento",
    "data_finalizacao",
  ],
  obrigatorios: ["tipo", "descricao", "data", "hora", "endereco", "criado_por"],
  permissoes: { ver: VER, gerenciar: "FISCALIZACAO_GERENCIAR_OCORRENCIAS" },
});

export const checklistsFiscalizacao = criarCrud({
  tabela: "checklist_fiscalizacao",
  id: "id_checklist",
  entidade: "checklist_fiscalizacao",
  select: `checklist_fiscalizacao.*,
           veiculo.placa, veiculo.marca, veiculo.modelo,
           equipe.numero AS equipe,
           (checklist_fiscalizacao.odometro_chegada - checklist_fiscalizacao.odometro_saida) AS km_rodado`,
  from: `checklist_fiscalizacao
         JOIN veiculo ON veiculo.id_veiculo = checklist_fiscalizacao.id_veiculo
         LEFT JOIN equipe ON equipe.id_equipe = checklist_fiscalizacao.id_equipe`,
  busca: ["veiculo.placa", "equipe.numero"],
  filtros: {
    veiculo: "checklist_fiscalizacao.id_veiculo",
    equipe: "checklist_fiscalizacao.id_equipe",
    status: "checklist_fiscalizacao.status",
    dataDe: "checklist_fiscalizacao.data_abertura",
    dataAte: "checklist_fiscalizacao.data_abertura",
  },
  ordenaveis: {
    data_abertura: "checklist_fiscalizacao.data_abertura",
    placa: "veiculo.placa", equipe: "equipe.numero",
  },
  ordemPadrao: "checklist_fiscalizacao.data_abertura DESC",
  campos: [
    "id_veiculo", "id_servico_diario", "id_equipe", "data_abertura", "hora_saida",
    "hora_chegada", "odometro_saida", "odometro_chegada", "observacoes",
    "status", "data_finalizacao",
  ],
  obrigatorios: ["id_veiculo", "odometro_saida"],
  permissoes: { ver: VER, gerenciar: "FISCALIZACAO_GERENCIAR_VIATURAS" },
});

// Pontuacao: tela restrita ao gestor da Fiscalizacao. A permissao de leitura
// aqui e a mesma de gerenciar, de proposito.
export const pontuacaoItens = criarCrud({
  tabela: "pontuacao_item",
  id: "id_item",
  entidade: "pontuacao_item",
  select: `pontuacao_item.*,
           (SELECT COUNT(*)::int FROM pontuacao_registro r
             WHERE r.id_item = pontuacao_item.id_item) AS registros`,
  from: "pontuacao_item",
  busca: ["pontuacao_item.codigo", "pontuacao_item.nome", "pontuacao_item.descricao"],
  filtros: { ativo: "pontuacao_item.ativo" },
  ordenaveis: {
    codigo: "pontuacao_item.codigo", nome: "pontuacao_item.nome",
    valor_pontos: "pontuacao_item.valor_pontos",
  },
  ordemPadrao: "pontuacao_item.codigo",
  campos: ["codigo", "nome", "descricao", "valor_pontos", "ativo", "criado_por"],
  obrigatorios: ["codigo", "nome", "valor_pontos"],
  permissoes: {
    ver: "FISCALIZACAO_GERENCIAR_PONTUACAO",
    gerenciar: "FISCALIZACAO_GERENCIAR_PONTUACAO",
  },
});

const router = Router();
router.use("/servico-diario", servicoDiario);
router.use("/equipes", equipes);
router.use("/apoios", apoios);
router.use("/ocorrencias", ocorrencias);
router.use("/checklists", checklistsFiscalizacao);
router.use("/pontuacao", pontuacaoItens);

export default router;
