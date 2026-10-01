/**
 * rotulosAuditoria.js - Nomes legiveis dos eventos de acesso e das acoes da
 * auditoria. Usado pelas telas de log e pela exportacao (CSV e PDF), para o
 * arquivo dizer "Entrada" e "Exclusao", e nao LOGIN e EXCLUIR.
 */
export const EVENTOS_ACESSO = [
  { valor: "LOGIN", rotulo: "Entrada" },
  { valor: "LOGOUT", rotulo: "Saída" },
  { valor: "FALHA_LOGIN", rotulo: "Falha de login" },
  { valor: "ALTERACAO_SENHA", rotulo: "Troca de senha" },
  { valor: "SESSAO_EXPIRADA", rotulo: "Sessão expirada" },
  { valor: "RECUPERACAO_SENHA", rotulo: "Recuperação de senha" },
];

export const ACOES_AUDITORIA = [
  { valor: "CRIAR", rotulo: "Criação" },
  { valor: "EDITAR", rotulo: "Edição" },
  { valor: "EXCLUIR", rotulo: "Exclusão" },
  { valor: "GERAR_RELATORIO", rotulo: "Geração de relatório" },
  { valor: "ATESTAR_RELATORIO", rotulo: "Ateste de relatório" },
  { valor: "GERAR_QRCODE", rotulo: "Geração de QR Code" },
  { valor: "EDITAR_PERMISSOES", rotulo: "Alteração de permissões" },
  { valor: "ALTERAR_SENHA", rotulo: "Troca de senha" },
  { valor: "FECHAR_OS", rotulo: "Fechamento de OS" },
  { valor: "ATUALIZAR_DOCUMENTO", rotulo: "Atualização de documento" },
];

export const nomeEvento = (v) => EVENTOS_ACESSO.find((e) => e.valor === v)?.rotulo || v || "";
export const nomeAcao = (v) => ACOES_AUDITORIA.find((a) => a.valor === v)?.rotulo || v || "";
