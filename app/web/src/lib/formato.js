/**
 * formato.js - Formatacao e traducao para a tela.
 *
 * Concentra tudo que transforma dado do banco em texto para o usuario: datas,
 * horas, numeros, dinheiro e os rotulos dos códigos (EM_USO -> "Em uso").
 *
 * CUIDADO COM DATAS: nunca use new Date("2026-08-26") para formatar. O
 * JavaScript trata isso como UTC e, no fuso do Brasil, o dia volta um. Por isso
 * a função data() fatia o texto em vez de converter.
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

/**
 * Quantos dias faltam ate a data. Negativo se ja passou.
 * Compara so a parte da data - hora nao interessa para validade.
 */
export function diasAte(valor) {
  if (!valor) return null;
  const [ano, mes, dia] = String(valor).slice(0, 10).split("-").map(Number);
  const alvo = new Date(ano, mes - 1, dia);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((alvo - hoje) / 86400000);
}

export function numero(valor, casas = 0) {
  if (valor === null || valor === undefined) return "-";
  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

// So formata o numero. O contexto ("da frota", "do total") e de quem chama:
// embutir isso aqui ja causou o texto duplicado "74,4% da frota da frota".
export function porcentagem(valor) {
  return `${numero(valor, 1)}%`;
}

const ROTULOS_STATUS = {
  DISPONIVEL: { texto: "Disponível", tom: "verde" },
  EM_USO: { texto: "Em uso", tom: "azul" },
  EM_MANUTENCAO: { texto: "Em manutenção", tom: "amarelo" },
  INATIVO: { texto: "Indisponível", tom: "vermelho" },
  ABERTO: { texto: "Em aberto", tom: "azul" },
  FINALIZADO: { texto: "Finalizado", tom: "verde" },
  EM_ANALISE: { texto: "Em análise", tom: "amarelo" },
  RESOLVIDA: { texto: "Resolvida", tom: "verde" },
  CANCELADA: { texto: "Cancelada", tom: "vermelho" },
  VALIDO: { texto: "Válido", tom: "verde" },
  VENCENDO: { texto: "Vencendo", tom: "laranja" },
  VENCIDO: { texto: "Vencido", tom: "vermelho" },
};

export function status(valor) {
  return ROTULOS_STATUS[valor] || { texto: valor || "-", tom: "cinza" };
}

const DIAS = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
  "Quinta-feira", "Sexta-feira", "Sábado",
];
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
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

// Rotulos legiveis para os códigos gravados no banco.
export const ROTULOS = {
  tipoInspeção: {
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
