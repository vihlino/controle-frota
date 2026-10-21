/**
 * equipamentos.js - O que a tela de Equipamentos e o checklist da viatura
 * (QR Code) tem em comum: o icone de cada item e como ele e conferido.
 *
 * Conferencia (migracao 044, pedido do Cesar em 21/10):
 *   QUANTIDADE  - a quantidade salva para a viatura em Fiscalizacao >
 *                 Equipamentos (Cone, Pantografica, Cavalete, Barreira);
 *   POR_FISCAL  - fixo, um para cada fiscal (Radio);
 *   OBRIGATORIO - presente ou ausente (Macaco, Estepe, Chave de roda).
 */
export const ICONE_ITEM = {
  "Rádio": "eq-radio", Cone: "eq-cone", "Pantográfica": "eq-pantografica",
  Cavalete: "eq-cavalete", Barreira: "eq-barreira",
  Macaco: "eq-macaco", Estepe: "eq-estepe", "Chave de roda": "eq-chave-roda",
};
export const iconeDoItem = (nome) => ICONE_ITEM[nome] || "checklist";

export const CONFERENCIAS = [
  { valor: "QUANTIDADE", rotulo: "Quantidade da viatura", ajuda: "Confere a quantidade salva para cada viatura." },
  { valor: "POR_FISCAL", rotulo: "Um por fiscal", ajuda: "Fixo: um para cada fiscal da equipe (ex.: Rádio)." },
  { valor: "OBRIGATORIO", rotulo: "Obrigatório", ajuda: "Presente ou ausente na viatura (ex.: Macaco, Estepe)." },
];
export const rotuloConferencia = (v) => CONFERENCIAS.find((c) => c.valor === v)?.rotulo || v;

/** Quanto a viatura deve levar do item. */
export function previstoDoItem(item, fiscais = 2) {
  if (item.conferencia === "POR_FISCAL") return fiscais;
  if (item.conferencia === "OBRIGATORIO") return 1;
  return Number(item.quantidade_salva ?? item.quantidade) || 0;
}
