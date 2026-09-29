/**
 * travarRolagem.js - Trava a rolagem da pagina enquanto houver janela aberta.
 *
 * POR QUE ISTO NAO E UMA LINHA DENTRO DO MODAL
 * --------------------------------------------
 * Cada modal fazia por conta propria: guardava o valor anterior de
 * `body.style.overflow`, punha "hidden" e devolvia o valor guardado ao fechar.
 * Funciona com UMA janela. Com duas - e o SITRA abre duas: o formulario de
 * veiculo e, em cima dele, a confirmacao de senha - da errado:
 *
 *   1. o formulario abre e guarda ""        -> overflow: hidden
 *   2. a confirmacao abre e guarda "hidden" -> overflow: hidden
 *   3. o formulario fecha PRIMEIRO (o salvar fecha os dois) e devolve ""
 *   4. a confirmacao fecha e devolve "hidden"  <- a pagina fica travada
 *
 * E por isso que a tela parava de rolar depois de salvar e voltava ao normal
 * com F5: o F5 zera o estilo inline.
 *
 * A solucao e contar quantas janelas estao abertas. A rolagem volta quando a
 * ULTIMA fecha, nao quando qualquer uma fecha.
 */
let abertas = 0;

export function travar() {
  abertas += 1;
  if (abertas === 1) document.body.style.overflow = "hidden";
}

export function destravar() {
  abertas = Math.max(0, abertas - 1);
  // A propriedade e REMOVIDA, e nao reposta com um valor guardado: sem estilo
  // inline, o body volta a valer o que a folha de estilo manda - que e a
  // verdade, e nao um retrato tirado no instante em que a janela abriu.
  if (abertas === 0) document.body.style.removeProperty("overflow");
}
