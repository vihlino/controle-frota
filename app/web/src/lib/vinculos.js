/**
 * vinculos.js - Como o veiculo pertence a CMTT.
 *
 * Tres situacoes possiveis:
 *   PROPRIO    - da CMTT, sem numero de patrimonio (doado, cedido, antigo)
 *   PATRIMONIO - da CMTT e tombado, com numero de patrimonio
 *   LOCADO     - alugado de terceiro
 *
 * A diferenca nao e decorativa: manutencao de locado vai para a locadora, e o
 * relatorio de custos separa os dois.
 *
 * A lista vive aqui, e nao dentro de uma tela, porque tres lugares precisam
 * dela: o formulario (as opcoes), a listagem e a ficha do veiculo (o texto
 * bonito). Duplicar isso e como o banco acaba com "LOCADO" numa tela e
 * "Locado" na outra.
 */
export const VINCULOS = [
  { valor: "PROPRIO", rotulo: "Próprio" },
  { valor: "PATRIMONIO", rotulo: "Patrimônio" },
  { valor: "LOCADO", rotulo: "Locado" },
];

/**
 * O texto que a pessoa le. O banco guarda PATRIMONIO em caixa alta porque e um
 * codigo; a tela nao deve mostrar codigo.
 *
 * Sem vinculo informado devolve "-", e nao um chute: os veiculos cadastrados
 * antes deste campo existir estao todos em branco, e escrever "Próprio" neles
 * seria inventar uma informacao que ninguem conferiu.
 */
export function vinculo(valor) {
  return VINCULOS.find((v) => v.valor === valor)?.rotulo || "-";
}
