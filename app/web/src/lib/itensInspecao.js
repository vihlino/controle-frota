/**
 * itensInspecao.js - O que se confere em cada inspeção periódica.
 *
 * A lista não é a mesma para toda frequência, e isso é decisão da operação, não
 * do sistema: a inspeção semanal olha o que muda de um dia para o outro (nível
 * de fluido, pneu, luz, limpeza) e leva poucos minutos; a mensal olha também o
 * que muda devagar (palheta, dreno, freio de mão, ar-condicionado) e pede o
 * veículo parado por mais tempo.
 *
 * Uma lista só para as duas frequências torna uma delas errada: ou a semanal
 * fica longa e as pessoas passam a marcar "conforme" sem olhar, ou a mensal
 * fica curta e deixa de conferir o que só ela conferiria.
 *
 * Os grupos não são enfeite - eles dizem em que estado o veículo tem de estar
 * ("com o motor frio") e em que ordem a volta no veículo acontece.
 */

const FLUIDOS = "Níveis de fluidos (com o motor frio)";
const PNEUS = "Pneus e rodas";
const ELETRICO = "Sistema elétrico e iluminação";
const VISIBILIDADE = "Visibilidade e itens de emergência";
const CONSERVACAO = "Conservação e higiene";
const TESTES = "Testes dinâmicos e interior";

// Os seis itens de luz são os mesmos nas duas listas. Escritos uma vez só:
// duplicados, um dia alguém acrescentaria "Luz de neblina" em uma e esqueceria
// da outra, e as duas inspeções passariam a conferir coisas diferentes sem que
// ninguém tivesse decidido isso.
const ITENS_ELETRICO = [
  "Faróis (altos e baixos)",
  "Lanternas traseiras",
  "Luzes de freio (luz de stop)",
  "Piscas (setas)",
  "Luz de ré",
  "Painel de instrumentos",
];

const ITENS_PNEUS = ["Calibragem", "Desgaste e danos", "Avarias visuais"];

/** A inspeção curta, do dia a dia. */
export const INSPECAO_SEMANAL = [
  { grupo: FLUIDOS, itens: [
      "Óleo do motor",
      "Água do radiador",
      "Água do limpador de para-brisa",
  ] },
  { grupo: PNEUS, itens: ITENS_PNEUS },
  { grupo: ELETRICO, itens: ITENS_ELETRICO },
  { grupo: CONSERVACAO, itens: ["Limpeza interna", "Limpeza externa"] },
];

/** A inspeção completa: mensal, quinzenal, personalizada e sem periodicidade. */
export const INSPECAO_COMPLETA = [
  { grupo: FLUIDOS, itens: [
      "Óleo do motor",
      "Água do radiador",
      "Fluido de freio",
      "Água do limpador de para-brisa",
  ] },
  { grupo: PNEUS, itens: ITENS_PNEUS },
  { grupo: ELETRICO, itens: ITENS_ELETRICO },
  { grupo: VISIBILIDADE, itens: [
      "Palhetas do limpador",
      "Equipamentos obrigatórios",
  ] },
  { grupo: CONSERVACAO, itens: [
      "Limpeza interna",
      "Limpeza externa",
      "Drenos do para-brisa",
  ] },
  { grupo: TESTES, itens: [
      "Freio de estacionamento (freio de mão)",
      "Cintos de segurança",
      "Ar-condicionado",
  ] },
];

/**
 * Os grupos de itens de uma inspeção, pela frequência dela.
 *
 * Só a SEMANAL usa a lista curta. Quinzenal, personalizada e sem periodicidade
 * caem na completa DE PROPÓSITO: quando não se sabe quanto tempo faz que o
 * veículo foi olhado, conferir mais é o lado seguro para errar.
 *
 * Frequência desconhecida (uma que venha a ser criada no banco e ainda não
 * esteja aqui) também cai na completa, pela mesma razão.
 *
 * @param {string} tipo SEMANAL, QUINZENAL, MENSAL, PERSONALIZADA, SEM_PERIODICIDADE
 * @returns {Array<{grupo: string, itens: string[]}>}
 */
export function gruposDaInspecao(tipo) {
  return tipo === "SEMANAL" ? INSPECAO_SEMANAL : INSPECAO_COMPLETA;
}

/**
 * A mesma lista achatada, no formato que a API recebe.
 *
 * O grupo vai junto de cada item: gravado na inspeção, ele deixa a ficha
 * legível anos depois, mesmo que a lista mude no meio do caminho.
 *
 * @returns {Array<{item: string, grupo: string, resultado: string, observacao: string}>}
 */
export function itensDaInspecao(tipo) {
  return gruposDaInspecao(tipo).flatMap((g) =>
    g.itens.map((item) => ({
      item, grupo: g.grupo, resultado: "NORMAL", observacao: "",
    })),
  );
}
