/**
 * Equipes.jsx - As equipes da fiscalização.
 *
 * 21/10 (pedido do Cesar): a lista mostra Fiscal 1 e Fiscal 2 com a
 * matricula, e o cadastro pede os dois (o Fiscal 1 e quem abre o checklist da
 * viatura). Equipe temporaria pode ser de APOIO, com o nome do policial.
 */
import criarPagina from "../../components/criarPagina.jsx";
import Selo from "../../components/Selo.jsx";
import { numero } from "../../lib/formato.js";
import { api } from "../../lib/api.js";

// Estes sao os unicos valores que a tabela `equipe` aceita (chk_equipe_tipo).
// A tela oferecia Ostensiva / Apoio / Operacao, que descrevem outra coisa - o
// tipo de trabalho, e nao a permanencia da equipe - e o banco recusava toda
// equipe nova com "violates check constraint chk_equipe_tipo".
const TIPOS = [
  { valor: "FIXA", rotulo: "Fixa" },
  { valor: "TEMPORARIA", rotulo: "Temporária" },
];
// Turno da equipe (18/10), escolhido no cadastro.
export const TURNOS_EQUIPE = [
  { valor: "DIURNO", rotulo: "Diurno (06:00 às 19:00)", curto: "Diurno", horario: "06:00 às 19:00" },
  { valor: "NOTURNO", rotulo: "Noturno (19:00 às 23:59)", curto: "Noturno", horario: "19:00 às 23:59" },
];

/*
 * A configuracao fica exportada: a tela de Detalhes da Equipe (09/10) usa a
 * mesma para o Editar, com os mesmos campos e os fiscais para marcar.
 */
export const CONFIG_EQUIPE = {
  recurso: "fiscalizacao/equipes",
  id: "id_equipe",
  singular: "equipe",
  titulo: "Equipes",
  descricao: "Equipes da fiscalização e seus integrantes.",
  trilha: [{ rotulo: "Fiscalização" }, { rotulo: "Equipes" }],
  unidade: "equipes",
  vazio: "Nenhuma equipe cadastrada.",
  rotuloAcao: "Nova equipe",
  iconeAcao: "fisc-servidores",
  permissaoGerenciar: "FISCALIZACAO_GERENCIAR_EQUIPES",
  permiteExcluir: true,
  // "Visualizar" abre a tela de Detalhes da Equipe (09/10).
  detalhe: true,
  descreverExclusao: (e) => `a equipe ${e.numero}`,
  // Fiscais (cargo Fiscal de Transito, ativos) para marcar no cadastro (09/10).
  opcoes: { fiscais: "/admin/servidores/opcoes?cargo_nome=FISCAL%20DE%20TRANSITO&status=true" },
  mapaOpcoes: {
    fiscais: (s) => ({ valor: String(s.id_servidor), rotulo: `${s.nome} (${s.matricula})`, apoio: `Matrícula ${s.matricula}` }),
  },
  colunas: [
    { chave: "numero", rotulo: "Número", ordenavel: true },
    { chave: "tipo", rotulo: "Tipo", ordenavel: true,
      render: (e) => {
        const t = TIPOS.find((x) => x.valor === e.tipo)?.rotulo || e.tipo;
        return e.apoio
          ? <span className="celula-dupla"><strong>{t} · Apoio</strong><span title="Policial">{e.policial || "Policial não informado"}</span></span>
          : t;
      } },
    { chave: "turno", rotulo: "Turno",
      render: (e) => {
        const t = TURNOS_EQUIPE.find((x) => x.valor === e.turno);
        return t ? <span className="celula-dupla"><strong>{t.curto}</strong><span>{t.horario}</span></span> : "-";
      } },
    { chave: "fiscal1", cortar: true, rotulo: "Fiscal 1",
      render: (e) => (e.fiscal1_nome ? <span className="celula-cortada" title={e.fiscal1_nome}>{e.fiscal1_nome}</span> : <span className="texto-fraco">-</span>) },
    { chave: "fiscal1_matricula", rotulo: "Matrícula", render: (e) => e.fiscal1_matricula || "-" },
    { chave: "fiscal2", cortar: true, rotulo: "Fiscal 2",
      render: (e) => (e.fiscal2_nome ? <span className="celula-cortada" title={e.fiscal2_nome}>{e.fiscal2_nome}</span> : <span className="texto-fraco">-</span>) },
    { chave: "fiscal2_matricula", rotulo: "Matrícula", render: (e) => e.fiscal2_matricula || "-" },
    { chave: "observacoes", cortar: true, rotulo: "Observações", render: (e) => e.observacoes || "-" },
    {
      chave: "status", rotulo: "Situação", ordenavel: true,
      render: (e) => (
        <Selo texto={e.status ? "Ativa" : "Inativa"} tom={e.status ? "verde" : "vermelho"} />
      ),
    },
  ],
  filtros: [
    { nome: "tipo", rotulo: "Tipo", tipo: "selecao", opcoes: TIPOS, vazio: "Todos" },
    {
      nome: "status", rotulo: "Situação", tipo: "selecao", vazio: "Todas",
      opcoes: [{ valor: "true", rotulo: "Ativa" }, { valor: "false", rotulo: "Inativa" }],
    },
  ],
  formulario: [
    { nome: "numero", rotulo: "Número da equipe *", obrigatorio: true, dica: "Ex.: EQ-04" },
    { nome: "tipo", rotulo: "Tipo *", tipo: "selecao", opcoes: TIPOS, obrigatorio: true, padrao: "FIXA" },
    { nome: "turno", rotulo: "Turno *", tipo: "selecao", obrigatorio: true, padrao: "DIURNO",
      opcoes: TURNOS_EQUIPE.map(({ valor, rotulo }) => ({ valor, rotulo })) },
    { nome: "observacoes", rotulo: "Observações", tipo: "area", largo: true,
      dica: "Ex.: Equipe reforçada para o feriado" },
    { secao: "Fiscais da equipe" },
    { nome: "fiscal1", rotulo: "Fiscal 1 *", tipo: "selecao", opcoes: "fiscais", vazio: "Selecione",
      ajuda: "É quem abre o checklist da viatura pelo QR Code." },
    { nome: "fiscal2", rotulo: "Fiscal 2", tipo: "selecao", opcoes: "fiscais", vazio: "Selecione",
      ajuda: "Quem sai da equipe continua no histórico até hoje; quem entra começa a contar a partir de hoje." },
    // Apoio (21/10): no fim, opcional e so na equipe temporaria.
    { secao: "Equipe de apoio (opcional)" },
    { nome: "modalidade", rotulo: "Equipe de apoio", tipo: "selecao", padrao: "NORMAL",
      opcoes: [{ valor: "NORMAL", rotulo: "Não" }, { valor: "APOIO", rotulo: "Sim, equipe de apoio" }],
      mostrarSe: (f) => f.tipo === "TEMPORARIA" },
    { nome: "policial", rotulo: "Nome do policial (opcional)", dica: "Ex.: Sd. João Pereira",
      mostrarSe: (f) => f.tipo === "TEMPORARIA" && f.modalidade === "APOIO" },
  ],
  // Os fiscais vao em rota propria, depois de gravar a equipe.
  aposSalvar: async (id, f) => {
    await api(`/fiscalizacao/equipes/${id}/integrantes`, {
      method: "PUT", body: { servidores: [f.fiscal1, f.fiscal2].filter(Boolean).map(Number) },
    });
    if (f.turno) await api(`/fiscalizacao/equipes/${id}/turno`, { method: "PUT", body: { turno: f.turno } });
  },
  // "fiscal1", "fiscal2" e "turno" nao sao colunas da equipe: vao so pelo aposSalvar.
  aoSalvar: ({ fiscais, fiscal1, fiscal2, turno, modalidade, fiscal1_nome, fiscal1_matricula, fiscal2_nome, fiscal2_matricula, ...f }) => {
    if (!fiscal1) throw new Error("Escolha o Fiscal 1 da equipe.");
    if (fiscal2 && String(fiscal1) === String(fiscal2)) throw new Error("Fiscal 1 e Fiscal 2 precisam ser pessoas diferentes.");
    const apoio = f.tipo === "TEMPORARIA" && modalidade === "APOIO";
    return { ...f, apoio, policial: apoio ? (String(f.policial || "").trim() || null) : null, status: f.status ?? true };
  },
};

export default criarPagina(CONFIG_EQUIPE);
