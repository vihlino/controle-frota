/**
 * formato.js - Formatacao e traducao para a tela.
 *
 * Concentra tudo que transforma dado do banco em texto para o usuario: datas,
 * horas, numeros, dinheiro e os rotulos dos codigos (EM_USO -> "Em uso").
 *
 * CUIDADO COM DATAS: nunca use new Date("2026-08-26") para formatar. O
 * JavaScript trata isso como UTC e, no fuso do Brasil, o dia volta um. Por isso
 * a funcao data() fatia o texto em vez de converter.
 */
// Datas do Postgres chegam como "2026-08-21" ou ISO completo. Nao use
// new Date("2026-08-21") direto: o JS trata como UTC e o dia volta um.
export function data(valor) {
  if (!valor) return "-";
  const [ano, mes, dia] = String(valor).slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

export function hora(valor) {
  if (!valor) return "-";
  return String(valor).slice(0, 5);
}

export function dataHora(valor) {
  if (!valor) return "-";
  const texto = String(valor);
  return `${data(texto)} ${texto.slice(11, 16)}`;
}

export function numero(valor, casas = 0) {
  if (valor === null || valor === undefined) return "-";
  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

export function porcentagem(valor) {
  return `${numero(valor, 1)}% da frota`;
}

const ROTULOS_STATUS = {
  DISPONIVEL: { texto: "Disponivel", tom: "verde" },
  EM_USO: { texto: "Em uso", tom: "azul" },
  EM_MANUTENCAO: { texto: "Em manutencao", tom: "amarelo" },
  INATIVO: { texto: "Indisponivel", tom: "vermelho" },
  ABERTO: { texto: "Em aberto", tom: "azul" },
  FINALIZADO: { texto: "Finalizado", tom: "verde" },
  EM_ANALISE: { texto: "Em analise", tom: "amarelo" },
  RESOLVIDA: { texto: "Resolvida", tom: "verde" },
  CANCELADA: { texto: "Cancelada", tom: "vermelho" },
  VALIDO: { texto: "Valido", tom: "verde" },
  VENCENDO: { texto: "Vencendo", tom: "laranja" },
  VENCIDO: { texto: "Vencido", tom: "vermelho" },
};

export function status(valor) {
  return ROTULOS_STATUS[valor] || { texto: valor || "-", tom: "cinza" };
}

const DIAS = [
  "Domingo", "Segunda-feira", "Terca-feira", "Quarta-feira",
  "Quinta-feira", "Sexta-feira", "Sabado",
];
const MESES = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function saudacao(agora = new Date()) {
  const h = agora.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function dataPorExtenso(agora = new Date()) {
  return `${DIAS[agora.getDay()]}, ${agora.getDate()} de ${MESES[agora.getMonth()]} de ${agora.getFullYear()}`;
}

export function dinheiro(valor) {
  if (valor === null || valor === undefined) return "-";
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function simNao(valor) {
  if (valor === null || valor === undefined) return "-";
  return valor ? "Sim" : "Nao";
}

// Rotulos legiveis para os codigos gravados no banco.
export const ROTULOS = {
  tipoInspecao: {
    SEMANAL: "Semanal", QUINZENAL: "Quinzenal", MENSAL: "Mensal",
    PERSONALIZADA: "Personalizada", SEM_PERIODICIDADE: "Sem periodicidade",
  },
  resultadoItem: {
    NORMAL: { texto: "Conforme", tom: "verde" },
    ATENCAO: { texto: "Atencao", tom: "amarelo" },
    AVARIA: { texto: "Nao conforme", tom: "vermelho" },
  },
  tipoOs: { PREVENTIVA: "Preventiva", CORRETIVA: "Corretiva" },
  gravidade: {
    BAIXA: { texto: "Baixa", tom: "verde" },
    MEDIA: { texto: "Media", tom: "amarelo" },
    ALTA: { texto: "Alta", tom: "vermelho" },
  },
  tipoSinistro: {
    COLISAO: "Colisao", DANO_MATERIAL: "Dano material",
    ROUBO_FURTO: "Roubo / Furto", INCENDIO: "Incendio", OUTRO: "Outro",
  },
  equipamento: {
    MACACO: "Macaco", ESTEPE: "Estepe",
    TRIANGULO: "Triangulo", CHAVE_RODA: "Chave de roda",
  },
};

export function rotulo(grupo, valor) {
  const item = ROTULOS[grupo]?.[valor];
  if (!item) return valor || "-";
  return typeof item === "string" ? item : item.texto;
}
