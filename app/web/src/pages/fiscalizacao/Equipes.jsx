/**
 * Equipes.jsx - As equipes da fiscalizacao.
 */
import criarPagina from "../../components/criarPagina.jsx";
import Selo from "../../components/Selo.jsx";
import { numero } from "../../lib/formato.js";

const TIPOS = [
  { valor: "OSTENSIVA", rotulo: "Ostensiva" },
  { valor: "APOIO", rotulo: "Apoio" },
  { valor: "OPERACAO", rotulo: "Operacao" },
];

export default criarPagina({
  recurso: "fiscalizacao/equipes",
  id: "id_equipe",
  singular: "equipe",
  titulo: "Equipes",
  descricao: "Equipes da fiscalizacao e seus integrantes.",
  trilha: [{ rotulo: "Fiscalizacao" }, { rotulo: "Equipes" }],
  unidade: "equipes",
  vazio: "Nenhuma equipe cadastrada.",
  rotuloAcao: "Nova equipe",
  iconeAcao: "fisc-servidores",
  permissaoGerenciar: "FISCALIZACAO_GERENCIAR_EQUIPES",
  permiteExcluir: true,
  confirmarExclusao: (e) => `Excluir a equipe ${e.numero}?`,
  mapaOpcoes: {},
  colunas: [
    { chave: "numero", rotulo: "Numero", ordenavel: true },
    { chave: "tipo", rotulo: "Tipo", ordenavel: true },
    { chave: "integrantes", rotulo: "Integrantes", render: (e) => numero(e.integrantes) },
    { chave: "observacoes", rotulo: "Observacoes", render: (e) => e.observacoes || "-" },
    {
      chave: "status", rotulo: "Situacao", ordenavel: true,
      render: (e) => (
        <Selo texto={e.status ? "Ativa" : "Inativa"} tom={e.status ? "verde" : "vermelho"} />
      ),
    },
  ],
  filtros: [
    { nome: "tipo", rotulo: "Tipo", tipo: "selecao", opcoes: TIPOS, vazio: "Todos" },
    {
      nome: "status", rotulo: "Situacao", tipo: "selecao", vazio: "Todas",
      opcoes: [{ valor: "true", rotulo: "Ativa" }, { valor: "false", rotulo: "Inativa" }],
    },
  ],
  formulario: [
    { nome: "numero", rotulo: "Numero da equipe *", obrigatorio: true },
    { nome: "tipo", rotulo: "Tipo *", tipo: "selecao", opcoes: TIPOS, obrigatorio: true, padrao: "OSTENSIVA" },
    { nome: "observacoes", rotulo: "Observacoes", tipo: "area", largo: true },
  ],
  aoSalvar: (f) => ({ ...f, status: true }),
});
