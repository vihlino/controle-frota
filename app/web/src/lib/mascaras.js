/**
 * mascaras.js - CPF e telefone com a pontuacao na hora certa.
 *
 * O BANCO GUARDA SO OS DIGITOS (ver a migracao 018). A pontuacao e desenhada
 * aqui, em dois momentos:
 *
 *   - enquanto a pessoa digita, para ela conferir o que escreveu;
 *   - na hora de mostrar numa lista ou ficha.
 *
 * As duas coisas usam a MESMA funcao, de proposito: se a mascara do formulario
 * e a da tabela fossem escritas em lugares diferentes, um dia uma mostraria
 * "(62) 99274-7830" e a outra "62 9927-47830".
 *
 * A mascara e PROGRESSIVA: ela pontua o que ja foi digitado e nao inventa o
 * que falta. "6299" mostra "(62) 99", e nao "(62) 99___-____" - campo cheio de
 * tracinho faz a pessoa achar que ja preencheu.
 */

/** Sobra so o numero. E o que vai para o banco. */
export function digitos(valor) {
  return String(valor ?? "").replace(/\D/g, "");
}

/**
 * 000.000.000-00 - para de aceitar no 11o digito.
 */
export function cpf(valor) {
  const d = digitos(valor).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/**
 * (62) 99274-7830, ou (62) 3224-7830 no telefone fixo.
 *
 * O celular brasileiro tem 9 digitos e o fixo 8. Decidir pelo TOTAL digitado,
 * e nao por regra de operadora, e o que faz o hifen cair no lugar certo nos
 * dois casos sem a pessoa precisar dizer qual e qual.
 */
export function telefone(valor) {
  const d = digitos(valor).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  const ddd = `(${d.slice(0, 2)}) `;
  const resto = d.slice(2);
  if (resto.length <= 4) return ddd + resto;
  const corte = resto.length > 8 ? 5 : 4;
  return `${ddd}${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

/** Usada pelo formulario: qual funcao aplicar a cada tipo de mascara. */
export const MASCARAS = { cpf, telefone };
