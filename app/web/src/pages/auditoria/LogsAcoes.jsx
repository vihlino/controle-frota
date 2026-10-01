/**
 * LogsAções.jsx - Tudo que foi criado, editado ou excluido.
 */
import criarPagina from "../../components/criarPagina.jsx";
import Selo from "../../components/Selo.jsx";
import { dataHora } from "../../lib/formato.js";
import { ACOES_AUDITORIA } from "../../lib/rotulosAuditoria.js";

const ACOES = ACOES_AUDITORIA;
const TOM = {
  CRIAR: "verde", EDITAR: "azul", EXCLUIR: "vermelho",
  GERAR_RELATORIO: "amarelo", ATESTAR_RELATORIO: "verde",
  GERAR_QRCODE: "amarelo", EDITAR_PERMISSOES: "laranja", ALTERAR_SENHA: "laranja",
  FECHAR_OS: "verde", ATUALIZAR_DOCUMENTO: "azul",
};

export default criarPagina({
  recurso: "auditoria/acoes",
  exportarLogs: "acoes",
  id: "id_auditoria",
  titulo: "Logs de Ações",
  descricao: "Tudo o que foi criado, alterado ou excluido no sistema, e por quem.",
  trilha: [{ rotulo: "Auditoria" }, { rotulo: "Logs de Ações" }],
  unidade: "registros",
  vazio: "Nenhuma ação registrada no período.",
  mapaOpcoes: {},
  colunas: [
    { chave: "data_hora", rotulo: "Data e hora", ordenavel: true, render: (a) => dataHora(a.data_hora) },
    { chave: "usuario_nome", cortar: true, rotulo: "Usuário", ordenavel: true },
    {
      chave: "acao", rotulo: "Ação", ordenavel: true,
      render: (a) => (
        <Selo texto={ACOES.find((x) => x.valor === a.acao)?.rotulo || a.acao} tom={TOM[a.acao]} />
      ),
    },
    { chave: "entidade", rotulo: "Registro afetado", ordenavel: true },
    { chave: "id_registro", rotulo: "No do registro" },
    { chave: "justificativa", cortar: true, rotulo: "Justificativa", render: (a) => a.justificativa || "-" },
  ],
  filtros: [
    { nome: "busca", rotulo: "Buscar", dica: "Usuário, ação ou registro" },
    { nome: "acao", rotulo: "Ação", tipo: "selecao", opcoes: ACOES, vazio: "Todas" },
    { nome: "periodo", rotulo: "Período", tipo: "periodo", de: "dataDe", ate: "dataAte" },
  ],
});
