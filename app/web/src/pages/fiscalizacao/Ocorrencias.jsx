/**
 * Ocorrências.jsx - As ocorrências atendidas em serviço.
 */
import criarPagina from "../../components/criarPagina.jsx";
import Selo from "../../components/Selo.jsx";
import { data, hora } from "../../lib/formato.js";

const TIPOS = [
  { valor: "ACIDENTE", rotulo: "Acidente de transito" },
  { valor: "APOIO", rotulo: "Apoio operacional" },
  { valor: "FISCALIZACAO", rotulo: "Fiscalização de transito" },
  { valor: "ESTACIONAMENTO", rotulo: "Irregularidade de estacionamento" },
  { valor: "EVENTO", rotulo: "Apoio a evento" },
  { valor: "OUTRO", rotulo: "Outro" },
];
const SITUACOES = [
  { valor: "PENDENTE", rotulo: "Pendente" },
  { valor: "EM_ATENDIMENTO", rotulo: "Em atendimento" },
  { valor: "FINALIZADA", rotulo: "Finalizada" },
];

export default criarPagina({
  recurso: "fiscalizacao/ocorrencias",
  id: "id_ocorrência",
  singular: "ocorrência",
  titulo: "Ocorrências",
  descricao: "Ocorrências registradas pela fiscalização.",
  trilha: [{ rotulo: "Fiscalização" }, { rotulo: "Ocorrências" }],
  unidade: "ocorrências",
  vazio: "Nenhuma ocorrência encontrada.",
  rotuloAcao: "Nova ocorrência",
  iconeAcao: "fisc-ocorrencias",
  permissaoGerenciar: "FISCALIZACAO_GERENCIAR_OCORRENCIAS",
  larguraFormulario: 720,
  mapaOpcoes: {},
  colunas: [
    { chave: "protocolo", rotulo: "No da ocorrência", ordenavel: true, render: (o) => o.protocolo || "-" },
    { chave: "tipo", rotulo: "Tipo", ordenavel: true },
    { chave: "endereco", rotulo: "Local" },
    {
      chave: "data", rotulo: "Data / Hora", ordenavel: true,
      render: (o) => (
        <span className="celula-dupla">
          <strong>{data(o.data)}</strong>
          <span>{hora(o.hora)}</span>
        </span>
      ),
    },
    { chave: "criado_por_nome", rotulo: "Registrada por" },
    { chave: "status", rotulo: "Situação", ordenavel: true, render: (o) => <Selo valor={o.status} /> },
  ],
  filtros: [
    { nome: "busca", rotulo: "Buscar", dica: "Protocolo, tipo ou local" },
    { nome: "tipo", rotulo: "Tipo", tipo: "selecao", opcoes: TIPOS, vazio: "Todos" },
    { nome: "status", rotulo: "Situação", tipo: "selecao", opcoes: SITUACOES, vazio: "Todas" },
    { nome: "dataDe", rotulo: "De", tipo: "data" },
    { nome: "dataAte", rotulo: "Ate", tipo: "data" },
  ],
  formulario: [
    { nome: "tipo", rotulo: "Tipo *", tipo: "selecao", opcoes: TIPOS, obrigatorio: true, padrao: "FISCALIZACAO" },
    { nome: "protocolo", rotulo: "Protocolo", dica: "Ex.: 2026-00125" },
    { nome: "data", rotulo: "Data *", tipo: "data", obrigatorio: true },
    { nome: "hora", rotulo: "Hora *", html: "time", obrigatorio: true },
    { nome: "endereco", rotulo: "Local *", obrigatorio: true, largo: true },
    { nome: "descricao", rotulo: "Descricao *", tipo: "area", obrigatorio: true, largo: true },
    { nome: "observações", rotulo: "Observações", tipo: "area", largo: true },
  ],
  aoSalvar: (f, usuario) => ({ ...f, criado_por: usuario.id_usuario, status: "PENDENTE" }),
});
