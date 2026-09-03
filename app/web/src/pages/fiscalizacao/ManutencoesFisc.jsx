/**
 * ManutençõesFisc.jsx - As ordens de serviço das viaturas.
 * Mesma base das manutenções de Frotas, vista pelo lado da Fiscalização.
 */
import criarPagina from "../../components/criarPagina.jsx";
import Selo from "../../components/Selo.jsx";
import { data, dinheiro, rotulo } from "../../lib/formato.js";

// Mesma base de ordens de serviço das Frotas, vista pelo lado da Fiscalização.
export default criarPagina({
  recurso: "frotas/manutencoes",
  id: "id_os",
  titulo: "Manutenções da Fiscalização",
  descricao: "Ordens de serviço das viaturas usadas em fiscalização.",
  trilha: [{ rotulo: "Fiscalização" }, { rotulo: "Manutenções" }],
  unidade: "manutenções",
  vazio: "Nenhuma manutenção encontrada.",
  mapaOpcoes: {
    veículos: (v) => ({ valor: v.id_veiculo, rotulo: `${v.placa} - ${v.modelo}` }),
  },
  opcoes: { veículos: "/frotas/veiculos/opcoes" },
  colunas: [
    { chave: "numero", rotulo: "No da OS", render: (o) => o.numero || "-" },
    {
      chave: "data_abertura", rotulo: "Abertura", ordenavel: true,
      render: (o) => data(o.data_abertura),
    },
    { chave: "placa", rotulo: "Viatura", ordenavel: true },
    { chave: "tipo", rotulo: "Tipo", render: (o) => rotulo("tipoOs", o.tipo) },
    { chave: "descricao", rotulo: "Serviço", render: (o) => o.descricao || o.serviço_realizado || "-" },
    { chave: "oficina", rotulo: "Oficina", render: (o) => o.oficina || "-" },
    { chave: "custo", rotulo: "Custo", ordenavel: true, render: (o) => dinheiro(o.custo) },
    { chave: "status", rotulo: "Situação", ordenavel: true, render: (o) => <Selo valor={o.status} /> },
  ],
  filtros: [
    { nome: "busca", rotulo: "Buscar", dica: "Placa, serviço ou oficina" },
    { nome: "veiculo", rotulo: "Viatura", tipo: "selecao", opcoes: "veículos", vazio: "Todas" },
    {
      nome: "status", rotulo: "Situação", tipo: "selecao", vazio: "Todas",
      opcoes: [
        { valor: "EM_ANALISE", rotulo: "Em analise" },
        { valor: "EM_MANUTENCAO", rotulo: "Em manutenção" },
        { valor: "RESOLVIDA", rotulo: "Resolvida" },
        { valor: "CANCELADA", rotulo: "Cancelada" },
      ],
    },
    { nome: "dataDe", rotulo: "De", tipo: "data" },
    { nome: "dataAte", rotulo: "Até", tipo: "data" },
  ],
});
