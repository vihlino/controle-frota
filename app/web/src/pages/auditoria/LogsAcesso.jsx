/**
 * LogsAcesso.jsx - Entradas, saidas e tentativas de acesso.
 * Inclui as falhas de login, que aparecem em vermelho.
 */
import criarPagina from "../../components/criarPagina.jsx";
import Selo from "../../components/Selo.jsx";
import { dataHora } from "../../lib/formato.js";

const EVENTOS = [
  { valor: "LOGIN", rotulo: "Entrada" },
  { valor: "LOGOUT", rotulo: "Saida" },
  { valor: "FALHA_LOGIN", rotulo: "Falha de login" },
  { valor: "ALTERACAO_SENHA", rotulo: "Troca de senha" },
  { valor: "SESSAO_EXPIRADA", rotulo: "Sessao expirada" },
  { valor: "RECUPERACAO_SENHA", rotulo: "Recuperacao de senha" },
];
const TOM = {
  LOGIN: "verde", LOGOUT: "azul", FALHA_LOGIN: "vermelho",
  ALTERACAO_SENHA: "amarelo", SESSAO_EXPIRADA: "laranja", RECUPERACAO_SENHA: "amarelo",
};

export default criarPagina({
  recurso: "auditoria/acessos",
  id: "id_log_acesso",
  titulo: "Logs de Acesso",
  descricao: "Entradas, saidas e tentativas de acesso ao sistema.",
  trilha: [{ rotulo: "Auditoria" }, { rotulo: "Logs de Acesso" }],
  unidade: "registros",
  vazio: "Nenhum acesso registrado no periodo.",
  mapaOpcoes: {},
  colunas: [
    { chave: "data_hora", rotulo: "Data e hora", ordenavel: true, render: (l) => dataHora(l.data_hora) },
    {
      chave: "usuário_nome", rotulo: "Usuário", ordenavel: true,
      render: (l) => l.usuário_nome || l.login_informado || "-",
    },
    { chave: "login_informado", rotulo: "Login informado", render: (l) => l.login_informado || "-" },
    {
      chave: "tipo_evento", rotulo: "Evento", ordenavel: true,
      render: (l) => (
        <Selo
          texto={EVENTOS.find((e) => e.valor === l.tipo_evento)?.rotulo || l.tipo_evento}
          tom={TOM[l.tipo_evento]}
        />
      ),
    },
    { chave: "endereco_ip", rotulo: "IP", render: (l) => l.endereco_ip || "-" },
    {
      chave: "sucesso", rotulo: "Resultado",
      render: (l) => (
        <Selo texto={l.sucesso ? "Sucesso" : "Falha"} tom={l.sucesso ? "verde" : "vermelho"} />
      ),
    },
  ],
  filtros: [
    { nome: "busca", rotulo: "Buscar", dica: "Usuário, login ou IP" },
    { nome: "tipo", rotulo: "Evento", tipo: "selecao", opcoes: EVENTOS, vazio: "Todos" },
    {
      nome: "sucesso", rotulo: "Resultado", tipo: "selecao", vazio: "Todos",
      opcoes: [{ valor: "true", rotulo: "Sucesso" }, { valor: "false", rotulo: "Falha" }],
    },
    { nome: "dataDe", rotulo: "De", tipo: "data" },
    { nome: "dataAte", rotulo: "Ate", tipo: "data" },
  ],
});
