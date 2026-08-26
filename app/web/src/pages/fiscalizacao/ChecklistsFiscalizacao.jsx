/**
 * ChecklistsFiscalizacao.jsx - Checklists das viaturas em servico.
 */
import criarPagina from "../../components/criarPagina.jsx";
import Selo from "../../components/Selo.jsx";
import { data, hora, numero } from "../../lib/formato.js";

export default criarPagina({
  recurso: "fiscalizacao/checklists",
  id: "id_checklist",
  singular: "checklist",
  titulo: "Checklists da Fiscalizacao",
  descricao: "Checklists das viaturas usadas em servico.",
  trilha: [{ rotulo: "Fiscalizacao" }, { rotulo: "Checklists" }],
  unidade: "checklists",
  vazio: "Nenhum checklist de viatura registrado.",
  mapaOpcoes: {
    veiculos: (v) => ({ valor: v.id_veiculo, rotulo: `${v.placa} - ${v.modelo}` }),
  },
  opcoes: { veiculos: "/frotas/veiculos/opcoes" },
  colunas: [
    { chave: "data_abertura", rotulo: "Data", ordenavel: true, render: (c) => data(c.data_abertura) },
    { chave: "placa", rotulo: "Placa", ordenavel: true },
    { chave: "veiculo", rotulo: "Viatura", render: (c) => `${c.marca} ${c.modelo}` },
    { chave: "equipe", rotulo: "Equipe", ordenavel: true, render: (c) => c.equipe || "-" },
    { chave: "hora_saida", rotulo: "Saida", render: (c) => hora(c.hora_saida) },
    { chave: "hora_chegada", rotulo: "Chegada", render: (c) => hora(c.hora_chegada) },
    {
      chave: "km_rodado", rotulo: "KM rodado",
      render: (c) => (c.km_rodado === null ? "-" : `${numero(c.km_rodado)} km`),
    },
    { chave: "status", rotulo: "Situacao", render: (c) => <Selo valor={c.status} /> },
  ],
  filtros: [
    { nome: "busca", rotulo: "Buscar", dica: "Placa ou equipe" },
    { nome: "veiculo", rotulo: "Viatura", tipo: "selecao", opcoes: "veiculos", vazio: "Todas" },
    {
      nome: "status", rotulo: "Situacao", tipo: "selecao", vazio: "Todas",
      opcoes: [
        { valor: "ABERTO", rotulo: "Em aberto" },
        { valor: "FINALIZADO", rotulo: "Finalizado" },
      ],
    },
    { nome: "dataDe", rotulo: "De", tipo: "data" },
    { nome: "dataAte", rotulo: "Ate", tipo: "data" },
  ],
});
