/**
 * auditoria.js - Registro de quem fez o que no sistema.
 *
 * Toda criacao, edicao e exclusao passa por aqui. A tabela `auditoria` guarda
 * o usuario, a acao, qual registro foi afetado e o conteudo ANTES e DEPOIS em
 * JSON - e isso que alimenta a tela "Alteracoes de Registros", que mostra
 * campo a campo o que mudou.
 */
import { query } from "./db.js";

/**
 * Grava uma linha na auditoria.
 *
 * @param {object} p
 * @param {number} p.idUsuario        Quem fez a acao (id_usuario do token).
 * @param {string} p.acao             "CRIAR", "EDITAR", "EXCLUIR",
 *                                    "GERAR_RELATORIO", "ATESTAR_RELATORIO",
 *                                    "GERAR_QRCODE", "EDITAR_PERMISSOES"...
 * @param {string} p.entidade         O que foi afetado: "veiculo", "sinistro"...
 * @param {number} p.idRegistro       Id do registro afetado.
 * @param {object} [p.dadosAnteriores] Como o registro estava antes.
 * @param {object} [p.dadosNovos]      Como ficou depois.
 * @param {string} [p.justificativa]   Texto livre, quando a acao pede um motivo.
 *
 * IMPORTANTE: nunca passe senha aqui, nem o hash dela. Em routes/usuarios.js a
 * chamada monta o objeto de auditoria a mao, justamente para deixar a senha de
 * fora.
 *
 * A funcao NAO lanca excecao. Se a gravacao do log falhar, o erro vai para o
 * console e a operacao original segue normalmente - perder um cadastro de
 * veiculo porque o log falhou seria pior do que perder o log.
 */
export async function registrarAuditoria({
  idUsuario, acao, entidade, idRegistro,
  dadosAnteriores = null, dadosNovos = null, justificativa = null,
}) {
  try {
    await query(
      `INSERT INTO auditoria
         (id_usuario, acao, entidade, id_registro, justificativa,
          dados_anteriores, dados_novos)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        idUsuario, acao, entidade, idRegistro, justificativa,
        // As colunas sao JSONB: o objeto precisa virar texto JSON antes de ir.
        dadosAnteriores ? JSON.stringify(dadosAnteriores) : null,
        dadosNovos ? JSON.stringify(dadosNovos) : null,
      ]
    );
  } catch (e) {
    console.error("Falha ao gravar auditoria:", e.message);
  }
}
