/**
 * Viaturas.jsx - Os veículos usados pela fiscalização.
 * Reusa o mesmo recurso de veículos das Frotas: viatura e veículo da frota
 * vinculado ao setor de Fiscalização, nao um cadastro separado.
 */
import criarPagina from "../../components/criarPagina.jsx";
import Selo from "../../components/Selo.jsx";
import { numero, opcoes } from "../../lib/formato.js";

// Mesmos valores do cadastro de Frotas: viatura e veiculo da frota, e um
// vocabulario diferente aqui criaria dois nomes para a mesma coisa no banco.
const SITUACOES = [
  { valor: "DISPONIVEL", rotulo: "Regular" },
  { valor: "EM_USO", rotulo: "Em uso" },
  { valor: "EM_MANUTENCAO", rotulo: "Em manutenção" },
  { valor: "INATIVO", rotulo: "Indisponível" },
];
const TIPOS = opcoes("tipoVeiculo");
const COMBUSTIVEIS = opcoes("combustivel");

// Viatura e o veículo vinculado ao setor de Fiscalização. A tela reusa o mesmo
// recurso de veículos, filtrado pela coluna `viatura`.
//
// Essa coluna nao e preenchida a mao: o banco a calcula a partir do setor
// (migracao 016). Filtrar por ela, e nao pelo nome do setor, deixa a consulta
// simples e direta - mas quem decide continua sendo o setor escolhido no
// cadastro do veiculo.
export default criarPagina({
  recurso: "frotas/veiculos",
  id: "id_veiculo",
  singular: "viatura",
  titulo: "Viaturas",
  descricao: "Veículos utilizados pela fiscalização.",
  trilha: [{ rotulo: "Fiscalização" }, { rotulo: "Viaturas" }],
  unidade: "viaturas",
  vazio: "Nenhuma viatura encontrada. Vincule o veículo ao setor de Fiscalização no cadastro de Frotas.",

  // O recorte da tela. Vai na consulta, e nao na barra de filtros, para que a
  // contagem e a paginacao tambem sejam das viaturas - e para que ninguem veja
  // a frota inteira tirando um filtro da tela.
  filtrosFixos: { viatura: "true" },
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
    { chave: "status", rotulo: "Situação", ordenavel: true, render: (v) => <Selo valor={v.status} /> },
  ],
  rotuloAcao: "Nova viatura",
  iconeAcao: "fisc-viatura",
  rotuloSalvar: "Salvar",
  // A permissao e da FISCALIZACAO: esta e a tela dela. A API aceita as duas.
  permissaoGerenciar: "FISCALIZACAO_GERENCIAR_VIATURAS",
  // A tela nao tinha coluna de Acoes: sem `formulario`, o gerador entende que
  // e somente leitura e nao desenha o menu. Quem via uma viatura com o dado
  // errado tinha que ir ate Frotas > Veiculos para corrigir.
  // Excluir fica de fora de proposito: apagar o veiculo daqui levaria junto
  // checklists, documentos e OS dele. Baixa de viatura se faz mudando a
  // Situacao para Indisponivel.
  permiteExcluir: false,
  formulario: [
    { nome: "placa", rotulo: "Placa *", obrigatorio: true, dica: "Ex.: ABC-1D23" },
    { nome: "marca", rotulo: "Marca *", obrigatorio: true, dica: "Ex.: Chevrolet" },
    { nome: "modelo", rotulo: "Modelo *", obrigatorio: true, dica: "Ex.: S10 LS 2.8" },
    { nome: "renavam", rotulo: "Renavam", dica: "Ex.: 01234567890" },
    { nome: "chassi", rotulo: "Chassi", dica: "Ex.: 9BG1489NK0JC123456" },
    { nome: "ano_fabricacao", rotulo: "Ano de fabricação *", html: "number",
      obrigatorio: true, dica: "Ex.: 2022" },
    { nome: "ano_modelo", rotulo: "Ano modelo *", html: "number",
      obrigatorio: true, dica: "Ex.: 2022" },
    { nome: "cor", rotulo: "Cor *", obrigatorio: true, dica: "Ex.: Branco" },
    { nome: "tipo_veiculo", rotulo: "Tipo de veículo *", tipo: "selecao",
      obrigatorio: true, padrao: "AUTOMOVEL", opcoes: TIPOS },
    { nome: "tipo_combustivel", rotulo: "Combustível *", tipo: "selecao",
      obrigatorio: true, padrao: "FLEX",
      opcoes: COMBUSTIVEIS },
    { nome: "capacidade", rotulo: "Capacidade", dica: "Ex.: 5 lugares" },
    { nome: "quilometragem_atual", rotulo: "Quilometragem atual", html: "number",
      dica: "Ex.: 45230" },
    { nome: "id_setor", rotulo: "Setor *", tipo: "selecao", opcoes: "setores",
      obrigatorio: true },
  ],
  aoSalvar: (f) => ({
    ...f,
    ano_fabricacao: Number(f.ano_fabricacao),
    ano_modelo: Number(f.ano_modelo),
    quilometragem_atual: Number(f.quilometragem_atual) || 0,
    id_setor: Number(f.id_setor),
  }),
  filtros: [
    { nome: "busca", rotulo: "Buscar", dica: "Placa, marca ou modelo" },
    { nome: "setor", rotulo: "Setor", tipo: "selecao", opcoes: "setores", vazio: "Todos" },
    {
      nome: "status", rotulo: "Situação", tipo: "selecao", vazio: "Todas",
      opcoes: SITUACOES,
    },
  ],
});
