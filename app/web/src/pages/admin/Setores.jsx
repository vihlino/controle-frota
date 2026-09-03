/**
 * Setores.jsx - A estrutura organizacional.
 * Setor com vinculos nao pode ser excluido - a API devolve mensagem propria.
 */
import criarPagina from "../../components/criarPagina.jsx";
import Selo from "../../components/Selo.jsx";
import { numero } from "../../lib/formato.js";

export default criarPagina({
  recurso: "admin/setores",
  id: "id_setor",
  singular: "setor",
  titulo: "Setores",
  descricao: "Estrutura organizacional que vincula servidores e veículos.",
  trilha: [{ rotulo: "Administração" }, { rotulo: "Setores" }],
  unidade: "setores",
  vazio: "Nenhum setor cadastrado.",
  rotuloAcao: "Novo setor",
  iconeAcao: "nav-gestao",
  permissaoGerenciar: "ADMIN_GERENCIAR_SETORES",
  permiteExcluir: true,
  confirmarExclusao: (s) => `Excluir o setor ${s.nome}?`,
  mapaOpcoes: {},
  colunas: [
    { chave: "nome", rotulo: "Setor", ordenavel: true },
    { chave: "descricao", rotulo: "Descrição", render: (s) => s.descricao || "-" },
    { chave: "servidores", rotulo: "Servidores", render: (s) => numero(s.servidores) },
    { chave: "veiculos", rotulo: "Veículos", render: (s) => numero(s.veiculos) },
    {
      chave: "status", rotulo: "Situação", ordenavel: true,
      render: (s) => (
        <Selo texto={s.status ? "Ativo" : "Inativo"} tom={s.status ? "verde" : "vermelho"} />
      ),
    },
  ],
  filtros: [
    { nome: "busca", rotulo: "Buscar", dica: "Nome ou descrição" },
    {
      nome: "status", rotulo: "Situação", tipo: "selecao", vazio: "Todos",
      opcoes: [{ valor: "true", rotulo: "Ativo" }, { valor: "false", rotulo: "Inativo" }],
    },
  ],
  formulario: [
    { nome: "nome", rotulo: "Nome do setor *", obrigatorio: true, largo: true,
      dica: "Ex.: Transporte" },
    { nome: "descricao", rotulo: "Descrição", tipo: "area", largo: true,
      dica: "Ex.: Setor responsável pela frota administrativa" },
  ],
  aoSalvar: (f) => ({ ...f, status: true }),
});
