/**
 * tema.js - Alterna entre o tema claro e o escuro.
 *
 * A escolha fica gravada no navegador e e aplicada como um atributo no
 * elemento raiz (data-tema="escuro"). O CSS em styles/tokens.css redefine as
 * cores a partir desse atributo - nenhum componente precisa saber do tema.
 */
const CHAVE = "sitra.tema";

export function temaAtual() {
  return localStorage.getItem(CHAVE) || "claro";
}

export function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  localStorage.setItem(CHAVE, tema);
}
