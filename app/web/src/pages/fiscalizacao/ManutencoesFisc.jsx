/**
 * ManutencoesFisc.jsx - As ordens de servico das viaturas.
 * Mesma base das manutencoes de Frotas, vista pelo lado da Fiscalizacao.
 */
import criarPagina from "../../components/criarPagina.jsx";
import Selo from "../../components/Selo.jsx";
import { data, dinheiro, rotulo } from "../../lib/formato.js";

// Mesma base de ordens de servico das Frotas, vista pelo lado da Fiscalizacao.
export default criarPagina({
  recurso: "frotas/manutencoes",
  id: "id_os",
  titulo: "Manutencoes da Fiscalizacao",
  descricao: "Ordens de servico das viaturas usadas em fiscalizacao.",
  trilha: [{ rotulo: "Fiscalizacao" }, { rotulo: "Manutencoes" }],
  unidade: "manutencoes",
  vazio: "Nenhuma manutencao encontrada.",
  mapaOpcoes: {
    veiculos: (v) => ({ valor: v.id_veiculo, rotulo: `${v.placa} - ${v.modelo}` }),
  },
  opcoes: { veiculos: "/frotas/veiculos/opcoes" },
  colunas: [
    { chave: "numero", rotulo: "No da OS", render: (o) => o.numero || "-" },
    {
      chave: "data_abertura", rotulo: "Abertura", ordenavel: true,
      render: (o) => data(o.data_abertura),
    },
    { chave: "placa", rotulo: "Viatura", ordenavel: true },
    { chave: "tipo", rotulo: "Tipo", render: (o) => rotulo("tipoOs", o.tipo) },
    { chave: "descricao", rotulo: "Servico", render: (o) => o.descricao || o.servico_realizado || "-" },
    { chave: "oficina", rotulo: "Oficina", render: (o) => o.oficina || "-" },
    { chave: "custo", rotulo: "Custo", ordenavel: true, render: (o) => dinheiro(o.custo) },
    { chave: "status", rotulo: "Situacao", ordenavel: true, render: (o) => <Selo valor={o.status} /> },
  ],
  filtros: [
    { nome: "busca", rotulo: "Buscar", dica: "Placa, servico ou oficina" },
    { nome: "veiculo", rotulo: "Viatura", tipo: "selecao", opcoes: "veiculos", vazio: "Todas" },
    {
      nome: "status", rotulo: "Situacao", tipo: "selecao", vazio: "Todas",
      opcoes: [
        { valor: "EM_ANALISE", rotulo: "Em analise" },
        { valor: "EM_MANUTENCAO", rotulo: "Em manutencao" },
        { valor: "RESOLVIDA", rotulo: "Resolvida" },
        { valor: "CANCELADA", rotulo: "Cancelada" },
      ],
    },
    { nome: "dataDe", rotulo: "De", tipo: "data" },
    { nome: "dataAte", rotulo: "Ate", tipo: "data" },
  ],
});
