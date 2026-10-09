/**
 * Equipes.jsx - As equipes da fiscalização.
 */
import criarPagina from "../../components/criarPagina.jsx";
import Selo from "../../components/Selo.jsx";
import { numero } from "../../lib/formato.js";
import { api } from "../../lib/api.js";

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
  descreverExclusao: (e) => `a equipe ${e.numero}`,
  // Fiscais (cargo Fiscal de Transito, ativos) para marcar no cadastro (09/10).
  opcoes: { fiscais: "/admin/servidores/opcoes?cargo_nome=FISCAL%20DE%20TRANSITO&status=true" },
  mapaOpcoes: {
    fiscais: (s) => ({ valor: String(s.id_servidor), rotulo: s.nome, apoio: `Matrícula ${s.matricula}` }),
  },
  colunas: [
    { chave: "numero", rotulo: "Número", ordenavel: true },
    { chave: "tipo", rotulo: "Tipo", ordenavel: true },
    { chave: "integrantes", cortar: true, rotulo: "Fiscais",
      render: (e) => (e.nomes_integrantes
        ? <span className="celula-cortada" title={e.nomes_integrantes}>{e.nomes_integrantes}</span>
        : <span className="texto-fraco">Nenhum</span>) },
    { chave: "observacoes", cortar: true, rotulo: "Observações", render: (e) => e.observacoes || "-" },
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
    { secao: "Fiscais da equipe" },
    { nome: "fiscais", rotulo: "Marque os fiscais que fazem parte da equipe", tipo: "marcar",
      opcoes: "fiscais", padrao: [], vazio: "Nenhum fiscal de trânsito cadastrado.",
      ajuda: "Quem sai da equipe continua no histórico até hoje; quem entra começa a contar a partir de hoje." },
  ],
  // Os fiscais vao em rota propria, depois de gravar a equipe.
  aposSalvar: (id, f) => api(`/fiscalizacao/equipes/${id}/integrantes`, {
    method: "PUT", body: { servidores: (f.fiscais || []).map(Number) },
  }),
  // "fiscais" nao e coluna da equipe: vai so pelo aposSalvar.
  aoSalvar: ({ fiscais, ...f }) => ({ ...f, status: true }),
});
