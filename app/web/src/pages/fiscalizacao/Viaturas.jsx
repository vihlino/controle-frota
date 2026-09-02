/**
 * Viaturas.jsx - Os veículos usados pela fiscalização.
 * Reusa o mesmo recurso de veículos das Frotas: viatura e veículo da frota
 * vinculado ao setor de Fiscalização, nao um cadastro separado.
 */
import criarPagina from "../../components/criarPagina.jsx";
import Selo from "../../components/Selo.jsx";
import { numero } from "../../lib/formato.js";

// Mesmos valores do cadastro de Frotas: viatura e veiculo da frota, e um
// vocabulario diferente aqui criaria dois nomes para a mesma coisa no banco.
const SITUACOES = [
  { valor: "DISPONIVEL", rotulo: "Regular" },
  { valor: "EM_USO", rotulo: "Em uso" },
  { valor: "EM_MANUTENCAO", rotulo: "Em manutenção" },
  { valor: "INATIVO", rotulo: "Indisponivel" },
];
const TIPOS = [
  { valor: "AUTOMOVEL", rotulo: "Carro" },
  { valor: "MOTOCICLETA", rotulo: "Motocicleta" },
  { valor: "CAMINHONETE", rotulo: "Caminhonete" },
  { valor: "CAMINHAO", rotulo: "Caminhão" },
];
const COMBUSTIVEIS = ["FLEX", "GASOLINA", "ETANOL", "DIESEL", "GNV", "ELETRICO", "HIBRIDO"];

// Viaturas da fiscalização sao os veículos da frota vinculados ao setor de
// Fiscalização. A tela reusa o mesmo recurso de veículos.
export default criarPagina({
  recurso: "frotas/veiculos",
  id: "id_veiculo",
  singular: "viatura",
  titulo: "Viaturas",
  descricao: "Veículos utilizados pela fiscalização.",
  trilha: [{ rotulo: "Fiscalização" }, { rotulo: "Viaturas" }],
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
    { chave: "status", rotulo: "Situação", ordenavel: true, render: (v) => <Selo valor={v.status} /> },
  ],
  rotuloAcao: "Nova viatura",
  iconeAcao: "fisc-viatura",
  rotuloSalvar: "Salvar viatura",
  permissaoGerenciar: "FROTAS_GERENCIAR_VEICULOS",
  // A tela nao tinha coluna de Acoes: sem `formulario`, o gerador entende que
  // e somente leitura e nao desenha o menu. Quem via uma viatura com o dado
  // errado tinha que ir ate Frotas > Veiculos para corrigir.
  // Excluir fica de fora de proposito: apagar o veiculo daqui levaria junto
  // checklists, documentos e OS dele. Baixa de viatura se faz mudando a
  // Situacao para Indisponivel.
  permiteExcluir: false,
  larguraFormulario: 760,
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
      opcoes: COMBUSTIVEIS.map((c) => ({ valor: c, rotulo: c })) },
    { nome: "capacidade", rotulo: "Capacidade", dica: "Ex.: 5 lugares" },
    { nome: "quilometragem_atual", rotulo: "Quilometragem atual", html: "number",
      dica: "Ex.: 45230" },
    { nome: "id_setor", rotulo: "Setor *", tipo: "selecao", opcoes: "setores",
      obrigatorio: true },
    { nome: "status", rotulo: "Situação", tipo: "selecao", padrao: "DISPONIVEL",
      opcoes: SITUACOES },
    { nome: "observacoes", rotulo: "Observações", tipo: "area", largo: true,
      dica: "Ex.: Viatura com adesivagem da fiscalização" },
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
