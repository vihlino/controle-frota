/**
 * ServicoDiario.jsx - Servico Diario da Fiscalizacao (desenho do Cesar, 18/10
 * e 20/10).
 *
 * Uma linha por EQUIPE no servico, com o codigo dela (SD-AAAA-NNNNN). O
 * servico e o dia + turno, com o coordenador. Fiscais, viatura, saida e
 * retorno vem do checklist da viatura que a equipe fez naquele servico; sem
 * checklist, os fiscais sao os da equipe no dia e a viatura fica "-".
 * "Visualizar" abre os Detalhes do Servico Diario.
 *
 * 21/10: o servico e aberto para UMA equipe (com viatura, ocorrencias,
 * apoio, observacoes e fotos). Sem "Iniciar servico": a equipe entra em
 * servico no "Continuar" do checklist da viatura e sai ao finalizar.
 *
 * Do desenho ficaram de fora o que o SITRA nao tem (roteiro/local de atuacao,
 * previsao de retorno, abas Mapa e Escala de Fiscais) e todos os cartoes do
 * topo (pedido do Cesar, 20/10).
 */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PaginaLista from "../../components/PaginaLista.jsx";
import Icone from "../../components/Icone.jsx";
import Selo from "../../components/Selo.jsx";
import Acoes from "../../components/Acoes.jsx";
import { useConfirmacaoSenha } from "../../components/ConfirmarSenha.jsx";
import { Selecao, Periodo } from "../../components/Campos.jsx";
import { useLista } from "../../components/useLista.js";
import { api } from "../../lib/api.js";
import { data, hora, numero } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";
import JanelaServico, { TURNOS_SERVICO, ROTULO_TURNO, mudarSituacaoServico } from "./JanelaServico.jsx";

// Situacao da LINHA (equipe no servico), calculada pela API.
const SITUACOES = [
  { valor: "ABERTO", rotulo: "Em aberto" },
  { valor: "EM_SERVICO", rotulo: "Em serviço" },
  { valor: "ENCERRADO", rotulo: "Encerrado" },
  { valor: "CANCELADA", rotulo: "Cancelada" },
];

export default function ServicoDiario() {
  const navegar = useNavigate();
  const { podeVer } = useSessao();
  const lista = useLista("fiscalizacao/servico-diario/painel", {
    busca: "", dataDe: "", dataAte: "", turno: "", equipe: "", fiscal: "", veiculo: "", status: "",
  });
  const [equipes, setEquipes] = useState([]);
  const [fiscais, setFiscais] = useState([]);
  const [viaturas, setViaturas] = useState([]);
  // Janela de cadastro: null | { id?: id_servico_equipe }
  const [janela, setJanela] = useState(null);
  const { pedirSenha, elemento: modalSenha } = useConfirmacaoSenha();

  const podeGerenciar = podeVer("FISCALIZACAO_GERENCIAR_SERVICO");
  const [parametros, definirParametros] = useSearchParams();

  useEffect(() => {
    const comoLista = (r) => (Array.isArray(r) ? r : []);
    api("/fiscalizacao/equipes/opcoes?status=true").then((r) => setEquipes(comoLista(r))).catch(() => {});
    api("/admin/servidores/opcoes?cargo_nome=FISCAL%20DE%20TRANSITO&status=true").then((r) => setFiscais(comoLista(r))).catch(() => {});
    api("/frotas/veiculos/opcoes?viatura=true").then((r) => setViaturas(comoLista(r))).catch(() => {});
  }, []);

  // ?novo=1: o atalho "+ Servico Diario" do painel abre a janela direto.
  useEffect(() => {
    if (!parametros.get("novo") || !podeGerenciar) return;
    setJanela({});
    const limpo = new URLSearchParams(parametros);
    limpo.delete("novo");
    definirParametros(limpo, { replace: true });
  }, [parametros, definirParametros, podeGerenciar]);

  const abrir = (l) => navegar(`/fiscalizacao/servico-diario/${l.id_servico_equipe}`);
  async function mudarSituacao(l, acao) {
    if (await mudarSituacaoServico(pedirSenha, l, acao)) lista.recarregar();
  }

  const colunas = [
    {
      chave: "codigo", rotulo: "Nº",
      render: (l) => (l.codigo
        ? <button type="button" className="pt-nome sd-codigo" onClick={() => abrir(l)}>{l.codigo}</button>
        : <span className="texto-apagado">—</span>),
    },
    { chave: "data", rotulo: "Data", render: (l) => data(l.data) },
    {
      chave: "turno", rotulo: "Turno",
      render: (l) => (
        <span className="celula-dupla">
          <strong>{ROTULO_TURNO[l.turno] || l.turno}</strong>
          <span title="Coordenador do serviço">{l.coordenador}</span>
        </span>
      ),
    },
    {
      chave: "equipe", rotulo: "Equipe",
      render: (l) => (l.equipe_apoio
        ? <span className="celula-dupla" title={`Equipe de apoio: ${l.equipe_apoio}`}><strong>{l.equipe}</strong><span>+ apoio</span></span>
        : l.equipe || <span className="texto-apagado">Sem equipe</span>),
    },
    {
      chave: "fiscais", rotulo: "Fiscais", classe: "coluna-flexivel",
      render: (l) => (l.fiscais?.length ? (
        <span className="celula-lista">{l.fiscais.map((n) => <span key={n}>{n}</span>)}</span>
      ) : "—"),
    },
    {
      chave: "viatura", rotulo: "Viatura",
      render: (l) => (l.placa ? (
        <span className="celula-dupla"><strong>{l.placa}</strong><span>{l.marca} {l.modelo}</span></span>
      ) : "—"),
    },
    { chave: "hora_saida", rotulo: "Saída", render: (l) => (l.hora_saida ? hora(l.hora_saida) : "—") },
    { chave: "hora_chegada", rotulo: "Retorno", render: (l) => (l.hora_chegada ? hora(l.hora_chegada) : "—") },
    { chave: "situacao", rotulo: "Situação", render: (l) => <Selo valor={l.situacao} /> },
    { chave: "ocorrencias", rotulo: "Ocorrências", render: (l) => numero(l.ocorrencias) },
    {
      chave: "acoes", rotulo: "Ações",
      render: (l) => (
        <Acoes acoes={[
          l.id_servico_equipe && { rotulo: "Visualizar", icone: "visualizar", aoClicar: () => abrir(l) },
          l.id_equipe && { rotulo: "Ver equipe", icone: "equipe", aoClicar: () => navegar(`/fiscalizacao/equipes/${l.id_equipe}`) },
          l.id_checklist && { rotulo: "Ver checklist", icone: "checklist", aoClicar: () => navegar(`/fiscalizacao/checklists/${l.id_checklist}`) },
          l.id_veiculo && { rotulo: "Ver viatura", icone: "fisc-viatura", aoClicar: () => navegar(`/fiscalizacao/viaturas/${l.id_veiculo}`) },
          podeGerenciar && ["ABERTO", "EM_SERVICO"].includes(l.situacao) && { rotulo: "Editar serviço", icone: "editar", aoClicar: () => setJanela({ id: l.id_servico_equipe }) },
          podeGerenciar && l.situacao === "EM_SERVICO" && { rotulo: "Encerrar serviço", icone: "historico", aoClicar: () => mudarSituacao(l, "ENCERRAR") },
          podeGerenciar && l.situacao === "ABERTO" && { rotulo: "Cancelar serviço", icone: "fechar", perigo: true, aoClicar: () => mudarSituacao(l, "CANCELAR") },
        ].filter(Boolean)} />
      ),
    },
  ];

  const opc = (l, v, r) => l.map((x) => ({ valor: x[v], rotulo: r(x) }));

  return (
    <PaginaLista
      trilha={[{ rotulo: "Fiscalização" }, { rotulo: "Serviço Diário" }]}
      titulo="Serviço Diário"
      descricao="Cada linha é o serviço de uma equipe, com o código, os fiscais, a viatura, a saída e o retorno. A equipe entra em serviço ao tocar em “Continuar” no checklist da viatura."
      acao={
        podeGerenciar && (
          <button className="botao botao--primario" onClick={() => setJanela({})}>
            <Icone nome="mais" tamanho={15} /> Novo serviço diário
          </button>
        )
      }
      lista={lista}
      colunas={colunas}
      chaveDe={(l) => l.id_servico_equipe}
      unidade="serviços"
      vazio="Nenhum serviço diário com esses filtros."
      filtros={
        <>
          <Periodo id="periodo" de={lista.filtros.dataDe} ate={lista.filtros.dataAte}
                   aoMudarDe={(v) => lista.alterarFiltro("dataDe", v)}
                   aoMudarAte={(v) => lista.alterarFiltro("dataAte", v)} />
          <Selecao rotulo="Turno" id="turno" vazio="Todos" opcoes={TURNOS_SERVICO}
                   value={lista.filtros.turno} onChange={(e) => lista.alterarFiltro("turno", e.target.value)} />
          <Selecao rotulo="Equipe" id="equipe" vazio="Todas"
                   opcoes={opc(equipes, "id_equipe", (e) => e.numero)}
                   value={lista.filtros.equipe} onChange={(e) => lista.alterarFiltro("equipe", e.target.value)} />
          <Selecao rotulo="Fiscal" id="fiscal" vazio="Todos"
                   opcoes={opc(fiscais, "id_servidor", (s) => s.nome)}
                   value={lista.filtros.fiscal} onChange={(e) => lista.alterarFiltro("fiscal", e.target.value)} />
          <Selecao rotulo="Viatura" id="veiculo" vazio="Todas"
                   opcoes={opc(viaturas, "id_veiculo", (v) => `${v.placa} - ${v.modelo}`)}
                   value={lista.filtros.veiculo} onChange={(e) => lista.alterarFiltro("veiculo", e.target.value)} />
          <Selecao rotulo="Situação" id="status" vazio="Todas" opcoes={SITUACOES}
                   value={lista.filtros.status} onChange={(e) => lista.alterarFiltro("status", e.target.value)} />
        </>
      }
    >
      {janela && (
        <JanelaServico idServicoEquipe={janela.id} aoFechar={() => setJanela(null)} aoSalvar={() => lista.recarregar()} />
      )}
      {modalSenha}
    </PaginaLista>
  );
}
