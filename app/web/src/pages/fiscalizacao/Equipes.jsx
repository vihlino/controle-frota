/**
 * Equipes.jsx - As equipes da fiscalização.
 */
import criarPagina from "../../components/criarPagina.jsx";
import Selo from "../../components/Selo.jsx";
import { numero } from "../../lib/formato.js";

// Estes sao os unicos valores que a tabela `equipe` aceita (chk_equipe_tipo).
// A tela oferecia Ostensiva / Apoio / Operacao, que descrevem outra coisa - o
// tipo de trabalho, e nao a permanencia da equipe - e o banco recusava toda
// equipe nova com "violates check constraint chk_equipe_tipo".
const TIPOS = [
  { valor: "FIXA", rotulo: "Fixa" },
  { valor: "TEMPORARIA", rotulo: "Temporária" },
];

export default criarPagina({
  recurso: "fiscalizacao/equipes",
  id: "id_equipe",
  singular: "equipe",
  titulo: "Equipes",
  descricao: "Equipes da fiscalização e seus integrantes.",
  trilha: [{ rotulo: "Fiscalização" }, { rotulo: "Equipes" }],
  unidade: "equipes",
  vazio: "Nenhuma equipe cadastrada.",
  rotuloAcao: "Nova equipe",
  iconeAcao: "fisc-servidores",
  permissaoGerenciar: "FISCALIZACAO_GERENCIAR_EQUIPES",
  permiteExcluir: true,
  confirmarExclusao: (e) => `Excluir a equipe ${e.numero}?`,
  mapaOpcoes: {},
  colunas: [
    { chave: "numero", rotulo: "Número", ordenavel: true },
    { chave: "tipo", rotulo: "Tipo", ordenavel: true },
    { chave: "integrantes", rotulo: "Integrantes", render: (e) => numero(e.integrantes) },
    { chave: "observacoes", rotulo: "Observações", render: (e) => e.observacoes || "-" },
    {
      chave: "status", rotulo: "Situação", ordenavel: true,
      render: (e) => (
        <Selo texto={e.status ? "Ativa" : "Inativa"} tom={e.status ? "verde" : "vermelho"} />
      ),
    },
  ],
  filtros: [
    { nome: "tipo", rotulo: "Tipo", tipo: "selecao", opcoes: TIPOS, vazio: "Todos" },
    {
      nome: "status", rotulo: "Situação", tipo: "selecao", vazio: "Todas",
      opcoes: [{ valor: "true", rotulo: "Ativa" }, { valor: "false", rotulo: "Inativa" }],
    },
  ],
  formulario: [
    { nome: "numero", rotulo: "Número da equipe *", obrigatorio: true, dica: "Ex.: EQ-04" },
    { nome: "tipo", rotulo: "Tipo *", tipo: "selecao", opcoes: TIPOS, obrigatorio: true, padrao: "FIXA" },
    { nome: "observacoes", rotulo: "Observações", tipo: "area", largo: true,
      dica: "Ex.: Equipe reforçada para o feriado" },
  ],
  aoSalvar: (f) => ({ ...f, status: true }),
});
