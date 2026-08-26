/**
 * Viaturas.jsx - Os veiculos usados pela fiscalizacao.
 * Reusa o mesmo recurso de veiculos das Frotas: viatura e veiculo da frota
 * vinculado ao setor de Fiscalizacao, nao um cadastro separado.
 */
import criarPagina from "../../components/criarPagina.jsx";
import Selo from "../../components/Selo.jsx";
import { numero } from "../../lib/formato.js";

// Viaturas da fiscalizacao sao os veiculos da frota vinculados ao setor de
// Fiscalizacao. A tela reusa o mesmo recurso de veiculos.
export default criarPagina({
  recurso: "frotas/veiculos",
  id: "id_veiculo",
  singular: "viatura",
  titulo: "Viaturas",
  descricao: "Veiculos utilizados pela fiscalizacao.",
  trilha: [{ rotulo: "Fiscalizacao" }, { rotulo: "Viaturas" }],
  unidade: "viaturas",
  vazio: "Nenhuma viatura encontrada.",
  mapaOpcoes: {
    setores: (s) => ({ valor: s.id_setor, rotulo: s.nome }),
  },
  opcoes: { setores: "/setores" },
  colunas: [
    { chave: "placa", rotulo: "Placa", ordenavel: true },
    { chave: "marca", rotulo: "Marca", ordenavel: true },
    { chave: "modelo", rotulo: "Modelo", ordenavel: true },
    { chave: "ano_modelo", rotulo: "Ano modelo", ordenavel: true },
    { chave: "setor", rotulo: "Setor", ordenavel: true },
    {
      chave: "quilometragem_atual", rotulo: "KM atual",
      render: (v) => `${numero(v.quilometragem_atual)} km`,
    },
    { chave: "status", rotulo: "Situacao", ordenavel: true, render: (v) => <Selo valor={v.status} /> },
  ],
  filtros: [
    { nome: "busca", rotulo: "Buscar", dica: "Placa, marca ou modelo" },
    { nome: "setor", rotulo: "Setor", tipo: "selecao", opcoes: "setores", vazio: "Todos" },
    {
      nome: "status", rotulo: "Situacao", tipo: "selecao", vazio: "Todas",
      opcoes: [
        { valor: "DISPONIVEL", rotulo: "Regular" },
        { valor: "EM_USO", rotulo: "Em uso" },
        { valor: "EM_MANUTENCAO", rotulo: "Em manutencao" },
        { valor: "INATIVO", rotulo: "Indisponivel" },
      ],
    },
  ],
});
