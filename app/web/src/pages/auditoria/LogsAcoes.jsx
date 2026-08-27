/**
 * LogsAções.jsx - Tudo que foi criado, editado ou excluido.
 */
import criarPagina from "../../components/criarPagina.jsx";
import Selo from "../../components/Selo.jsx";
import { dataHora } from "../../lib/formato.js";

const ACOES = [
  { valor: "CRIAR", rotulo: "Criacao" },
  { valor: "EDITAR", rotulo: "Edicao" },
  { valor: "EXCLUIR", rotulo: "Exclusao" },
  { valor: "GERAR_RELATORIO", rotulo: "Geracao de relatório" },
  { valor: "ATESTAR_RELATORIO", rotulo: "Ateste de relatório" },
  { valor: "GERAR_QRCODE", rotulo: "Geracao de QR Code" },
  { valor: "EDITAR_PERMISSOES", rotulo: "Alteracao de permissões" },
  { valor: "ALTERAR_SENHA", rotulo: "Troca de senha" },
];
const TOM = {
  CRIAR: "verde", EDITAR: "azul", EXCLUIR: "vermelho",
  GERAR_RELATORIO: "amarelo", ATESTAR_RELATORIO: "verde",
  GERAR_QRCODE: "amarelo", EDITAR_PERMISSOES: "laranja", ALTERAR_SENHA: "laranja",
};

export default criarPagina({
  recurso: "auditoria/ações",
  id: "id_auditoria",
  titulo: "Logs de Ações",
  descricao: "Tudo o que foi criado, alterado ou excluido no sistema, e por quem.",
  trilha: [{ rotulo: "Auditoria" }, { rotulo: "Logs de Ações" }],
  unidade: "registros",
  vazio: "Nenhuma acao registrada no periodo.",
  mapaOpcoes: {},
  colunas: [
    { chave: "data_hora", rotulo: "Data e hora", ordenavel: true, render: (a) => dataHora(a.data_hora) },
    { chave: "usuário_nome", rotulo: "Usuário", ordenavel: true },
    {
      chave: "acao", rotulo: "Acao", ordenavel: true,
      render: (a) => (
        <Selo texto={ACOES.find((x) => x.valor === a.acao)?.rotulo || a.acao} tom={TOM[a.acao]} />
      ),
    },
    { chave: "entidade", rotulo: "Registro afetado", ordenavel: true },
    { chave: "id_registro", rotulo: "No do registro" },
    { chave: "justificativa", rotulo: "Justificativa", render: (a) => a.justificativa || "-" },
  ],
  filtros: [
    { nome: "busca", rotulo: "Buscar", dica: "Usuário, acao ou registro" },
    { nome: "acao", rotulo: "Acao", tipo: "selecao", opcoes: ACOES, vazio: "Todas" },
    { nome: "dataDe", rotulo: "De", tipo: "data" },
    { nome: "dataAte", rotulo: "Ate", tipo: "data" },
  ],
});
