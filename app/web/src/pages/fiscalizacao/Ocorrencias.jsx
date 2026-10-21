/**
 * Ocorrências.jsx - As ocorrências atendidas em serviço.
 *
 * Correção de 17/10: a tela oferecia tipos e situações que o banco não aceita
 * (chk_ocorrencia_tipo só aceita QRU e PROGRAMADA; a situação é PENDENTE,
 * ATRIBUIDA, EM_ANDAMENTO, FINALIZADA ou INTERCORRENCIA) e não pedia o
 * serviço diário, que é obrigatório - nenhuma ocorrência nova era gravada e
 * editar uma antiga dava erro. Editar também voltava a situação para
 * Pendente; agora a situação só é posta no cadastro novo.
 */
import criarPagina from "../../components/criarPagina.jsx";
import Selo from "../../components/Selo.jsx";
import { data, hora } from "../../lib/formato.js";
import { CATEGORIAS_OCORRENCIA, SENTIDOS_VIA, rotuloCategoria } from "../../lib/ocorrencias.js";

// Os valores que a tabela `ocorrencia` aceita.
export const TIPOS_OCORRENCIA = [
  { valor: "QRU", rotulo: "QRU (chamado)" },
  { valor: "PROGRAMADA", rotulo: "Programada" },
];
export const SITUACOES_OCORRENCIA = [
  { valor: "PENDENTE", rotulo: "Pendente" },
  { valor: "ATRIBUIDA", rotulo: "Atribuída" },
  { valor: "EM_ANDAMENTO", rotulo: "Em andamento" },
  { valor: "FINALIZADA", rotulo: "Finalizada" },
  { valor: "INTERCORRENCIA", rotulo: "Intercorrência" },
];
const TURNO = { DIURNO: "Diurno", NOTURNO: "Noturno" };
const SITUACAO_SERVICO = { ABERTO: "Aberto", EM_SERVICO: "Em serviço", ENCERRADO: "Encerrado" };

export const CONFIG_OCORRENCIA = {
  recurso: "fiscalizacao/ocorrencias",
  id: "id_ocorrencia",
  singular: "ocorrência",
  artigo: "a",
  titulo: "Ocorrências",
  descricao: "Ocorrências registradas pela fiscalização.",
  trilha: [{ rotulo: "Fiscalização" }, { rotulo: "Ocorrências" }],
  unidade: "ocorrências",
  vazio: "Nenhuma ocorrência encontrada.",
  rotuloAcao: "Nova ocorrência",
  iconeAcao: "fisc-ocorrencias",
  permissaoGerenciar: "FISCALIZACAO_GERENCIAR_OCORRENCIAS",
  // Serviço diário: a ocorrência nasce dentro de um serviço (obrigatório no banco).
  opcoes: { servicos: "/fiscalizacao/servico-diario?porPagina=60" },
  mapaOpcoes: {
    servicos: (s) => ({
      valor: s.id_servico_diario,
      rotulo: `${data(s.data)} · ${TURNO[s.turno] || s.turno} · ${s.coordenador || ""}${s.status !== "ENCERRADO" ? ` (${SITUACAO_SERVICO[s.status] || s.status})` : ""}`,
    }),
  },
  colunas: [
    { chave: "protocolo", rotulo: "No da ocorrência", ordenavel: true, render: (o) => o.protocolo || "-" },
    { chave: "tipo", rotulo: "Tipo", ordenavel: true,
      render: (o) => TIPOS_OCORRENCIA.find((t) => t.valor === o.tipo)?.rotulo || o.tipo },
    { chave: "categoria", rotulo: "Tipo de ocorrência", render: (o) => (o.categoria ? rotuloCategoria(o.categoria) : "—") },
    { chave: "endereco", cortar: true, rotulo: "Local" },
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
    { nome: "tipo", rotulo: "Tipo", tipo: "selecao", opcoes: TIPOS_OCORRENCIA, vazio: "Todos" },
    { nome: "categoria", rotulo: "Tipo de ocorrência", tipo: "selecao", opcoes: CATEGORIAS_OCORRENCIA, vazio: "Todos" },
    { nome: "status", rotulo: "Situação", tipo: "selecao", opcoes: SITUACOES_OCORRENCIA, vazio: "Todas" },
    { nome: "periodo", rotulo: "Período", tipo: "periodo", de: "dataDe", ate: "dataAte" },
  ],
  formulario: [
    { nome: "id_servico_diario", rotulo: "Serviço diário *", tipo: "selecao", opcoes: "servicos",
      obrigatorio: true, largo: true, ajuda: "O serviço (dia e turno) em que a ocorrência foi atendida." },
    { nome: "tipo", rotulo: "Tipo *", tipo: "selecao", opcoes: TIPOS_OCORRENCIA, obrigatorio: true, padrao: "QRU" },
    { nome: "categoria", rotulo: "Tipo de ocorrência", tipo: "selecao", opcoes: CATEGORIAS_OCORRENCIA, vazio: "Selecione" },
    { nome: "protocolo", rotulo: "Protocolo", dica: "Ex.: 2026-00125" },
    { nome: "data", rotulo: "Data *", tipo: "data", obrigatorio: true },
    { nome: "hora", rotulo: "Hora *", html: "time", obrigatorio: true, dica: "Ex.: 14:30" },
    { nome: "endereco", rotulo: "Local *", obrigatorio: true, largo: true,
      dica: "Ex.: Av. Brasil, 1250 — Centro" },
    { nome: "bairro", rotulo: "Bairro", dica: "Ex.: Centro" },
    { nome: "referencia", rotulo: "Referência", dica: "Ex.: Próximo ao posto" },
    { nome: "sentido_via", rotulo: "Sentido da via", tipo: "selecao", opcoes: SENTIDOS_VIA, vazio: "Selecione" },
    { nome: "descricao", rotulo: "Descrição *", tipo: "area", obrigatorio: true, largo: true,
      dica: "Ex.: Veículo estacionado em vaga de idoso sem credencial" },
    { nome: "observacoes", rotulo: "Observações", tipo: "area", largo: true,
      dica: "Ex.: Condutor não estava no local" },
    // Situação e atendimento: só na edição (a ocorrência nova entra Pendente).
    { nome: "status", rotulo: "Situação *", tipo: "selecao", opcoes: SITUACOES_OCORRENCIA, obrigatorio: true,
      mostrarSe: (f) => !!f.id_ocorrencia },
    { nome: "descricao_atendimento", rotulo: "Descrição do atendimento *", tipo: "area", largo: true,
      obrigatorio: true, mostrarSe: (f) => f.status === "FINALIZADA",
      dica: "Ex.: Veículo removido e condutor orientado" },
    { nome: "data_finalizacao", rotulo: "Data da finalização *", tipo: "data", obrigatorio: true,
      mostrarSe: (f) => f.status === "FINALIZADA" },
  ],
  // Cadastro novo: quem registrou e situação Pendente. Na edição, nada muda
  // sozinho (antes a edição voltava a ocorrência para Pendente).
  aoSalvar: (f, usuario) => (f.id_ocorrencia
    ? f
    : { ...f, criado_por: usuario.id_usuario, status: "PENDENTE" }),
};

// 18/10: "Visualizar" abre os Detalhes da Ocorrência (/fiscalizacao/ocorrencias/:id).
export default criarPagina({ ...CONFIG_OCORRENCIA, detalhe: true });
