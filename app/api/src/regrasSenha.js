/**
 * regrasSenha.js - O que o SITRA aceita como senha.
 *
 * Usado em todo lugar onde uma senha e definida: o administrador criando um
 * usuario, o administrador trocando a senha de alguem, e a propria pessoa
 * trocando a sua no primeiro acesso. Um lugar so, para as tres portas
 * exigirem a mesma coisa.
 *
 * A tela mostra estas mesmas regras enquanto a pessoa digita
 * (web/src/lib/regrasSenha.js). Mudou aqui, muda la - senao a tela mostra tudo
 * verde e o servidor recusa.
 */

/** Tamanho minimo. */
export const TAMANHO_MINIMO = 8;

/*
 * Palavras que a senha nao pode CONTER, em qualquer posicao e com maiuscula ou
 * minuscula. Sao as primeiras tentativas de quem tenta adivinhar a senha de um
 * sistema chamado SITRA, de um orgao chamado CMTT.
 */
export const PALAVRAS_PROIBIDAS = ["sitra", "senha", "123456", "admin", "cmtt", "mudar123", "trocar123"];

/**
 * Confere a senha. Devolve a mensagem do problema, ou null se estiver boa.
 *
 * Cada mensagem diz QUAL regra falhou e o que fazer. A anterior dizia so "a
 * senha e facil demais de adivinhar", e a pessoa ficava tentando variacoes sem
 * saber o que estava errado.
 *
 * @param {string} senha
 * @param {string} [login] Login do dono da senha, quando se sabe.
 * @returns {string|null}
 */
export function problemaNaSenha(senha, login) {
  const s = String(senha ?? "");
  if (s.length < TAMANHO_MINIMO) {
    return `A senha tem ${s.length} caractere${s.length === 1 ? "" : "s"}. O mínimo é ${TAMANHO_MINIMO}.`;
  }
  if (/^\d+$/.test(s)) return "A senha não pode ter só números. Misture letras e números.";
  if (login && s.toLowerCase() === String(login).toLowerCase()) {
    return `A senha não pode ser igual ao login (${login}).`;
  }
  const achada = PALAVRAS_PROIBIDAS.find((o) => s.toLowerCase().includes(o));
  if (achada) {
    return `A senha não pode conter "${achada}": é uma das primeiras tentativas de quem ` +
           "tenta adivinhar uma senha do sistema. Troque essa parte da senha.";
  }
  return null;
}
