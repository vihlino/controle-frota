/**
 * ChecklistsFiscalização.jsx - Checklists das viaturas em serviço.
 */
import criarPagina from "../../components/criarPagina.jsx";
import Selo from "../../components/Selo.jsx";
import { data, hora, numero } from "../../lib/formato.js";

export default criarPagina({
  recurso: "fiscalizacao/checklists",
  id: "id_checklist",
  singular: "checklist",
  titulo: "Checklists da Fiscalização",
  descricao: "Checklists das viaturas usadas em serviço.",
  trilha: [{ rotulo: "Fiscalização" }, { rotulo: "Checklists" }],
  unidade: "checklists",
  vazio: "Nenhum checklist de viatura registrado.",
  mapaOpcoes: {
    veículos: (v) => ({ valor: v.id_veículo, rotulo: `${v.placa} - ${v.modelo}` }),
  },
  opcoes: { veículos: "/frotas/veiculos/opcoes" },
  colunas: [
    { chave: "data_abertura", rotulo: "Data", ordenavel: true, render: (c) => data(c.data_abertura) },
    { chave: "placa", rotulo: "Placa", ordenavel: true },
    { chave: "veículo", rotulo: "Viatura", render: (c) => `${c.marca} ${c.modelo}` },
    { chave: "equipe", rotulo: "Equipe", ordenavel: true, render: (c) => c.equipe || "-" },
    { chave: "hora_saida", rotulo: "Saida", render: (c) => hora(c.hora_saida) },
    { chave: "hora_chegada", rotulo: "Chegada", render: (c) => hora(c.hora_chegada) },
    {
      chave: "km_rodado", rotulo: "KM rodado",
      render: (c) => (c.km_rodado === null ? "-" : `${numero(c.km_rodado)} km`),
    },
    { chave: "status", rotulo: "Situação", render: (c) => <Selo valor={c.status} /> },
  ],
  filtros: [
    { nome: "busca", rotulo: "Buscar", dica: "Placa ou equipe" },
    { nome: "veículo", rotulo: "Viatura", tipo: "selecao", opcoes: "veículos", vazio: "Todas" },
    {
      nome: "status", rotulo: "Situação", tipo: "selecao", vazio: "Todas",
      opcoes: [
        { valor: "ABERTO", rotulo: "Em aberto" },
        { valor: "FINALIZADO", rotulo: "Finalizado" },
      ],
    },
    { nome: "dataDe", rotulo: "De", tipo: "data" },
    { nome: "dataAte", rotulo: "Ate", tipo: "data" },
  ],
});
