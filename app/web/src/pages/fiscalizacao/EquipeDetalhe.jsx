/**
 * EquipeDetalhe.jsx - Detalhes da Equipe (09/10).
 *
 * Layout do Cesar (09/10), no mesmo modelo das fichas de Motorista e Fiscal:
 * faixa com a identificacao, abas (Visao Geral, Fiscais, Viaturas,
 * Ocorrencias, Pontuacao, Historico) e, na Visao Geral, as informacoes, o
 * resumo, as ultimas ocorrencias, os fiscais e as viaturas.
 *
 * Tudo vem de /fiscalizacao/equipes/:id/ficha. Do desenho saiu o que o SITRA
 * nao tem: "base operacional", prefixo e foto da viatura, coordenador fixo da
 * equipe (o coordenador e do servico diario - aparece o do ultimo servico) e
 * o fiscal de cada ocorrencia (a ocorrencia e da equipe, nao de um fiscal).
 *
 * Viaturas: a viatura nao fica presa a equipe; aparecem as que a equipe usou
 * (pelos checklists de viatura), com quantas vezes e o ultimo uso.
 */
import { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import Selo from "../../components/Selo.jsx";
import JanelaCadastro from "../../components/JanelaCadastro.jsx";
import { api } from "../../lib/api.js";
import { data, dataHora, hora, numero, rotulo } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";
import { iniciais, Item, Linhas } from "../ServidorDetalhe.jsx";
import { CONFIG_EQUIPE, TURNOS_EQUIPE } from "./Equipes.jsx";

const BASE = "/fiscalizacao/equipes";
const vazio = (v) => (v === null || v === undefined || v === "" ? "—" : v);
const capitalizar = (t) => (t ? t.charAt(0) + t.slice(1).toLowerCase() : "");
const TIPO_EQUIPE = { FIXA: "Fixa", TEMPORARIA: "Temporária" };
const SITUACAO_SERVICO = { ABERTO: "Aberto", EM_SERVICO: "Em serviço", ENCERRADO: "Encerrado", CANCELADO: "Cancelado" };
/** Tipo do veiculo pelo rotulo do sistema; tipo fora da lista sai so capitalizado. */
const tipoVeiculo = (t) => { const r = rotulo("tipoVeiculo", t); return r === t ? capitalizar(t) : r; };

const SITUACAO_OCORRENCIA = {
  PENDENTE: { texto: "Pendente", tom: "amarelo" },
  ATRIBUIDA: { texto: "Atribuída", tom: "azul" },
  EM_ATENDIMENTO: { texto: "Em atendimento", tom: "azul" },
  EM_ANDAMENTO: { texto: "Em andamento", tom: "azul" },
  FINALIZADA: { texto: "Finalizada", tom: "verde" },
  INTERCORRENCIA: { texto: "Intercorrência", tom: "vermelho" },
};
const TIPO_OCORRENCIA = {
  QRU: "QRU", PROGRAMADA: "Programada", ACIDENTE: "Acidente de trânsito",
  APOIO: "Apoio operacional", FISCALIZACAO: "Fiscalização de trânsito",
  ESTACIONAMENTO: "Estacionamento irregular", EVENTO: "Apoio a evento", OUTRO: "Outro",
};

function SeloOcorrencia({ status }) {
  const s = SITUACAO_OCORRENCIA[status] || { texto: capitalizar(status), tom: "cinza" };
  return <Selo texto={s.texto} tom={s.tom} />;
}

function Pontos({ valor }) {
  const n = Number(valor || 0);
  return <strong className="fd-pontos" data-sinal={n > 0 ? "mais" : n < 0 ? "menos" : "zero"}>
    {n > 0 ? "+" : ""}{numero(n, Number.isInteger(n) ? 0 : 1)}
  </strong>;
}

function Tabela({ linhas, colunas, aoAbrir, vazio: textoVazio }) {
  if (!linhas.length) return <p className="texto-corrido">{textoVazio}</p>;
  return (
    <div className="rolagem-x">
      <table className="tabela vd-tabela tabela-ficha">
        <thead><tr>{colunas.map((c) => <th key={c.rotulo}>{c.rotulo}</th>)}</tr></thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className={aoAbrir ? "vd-tabela__linha" : undefined}
                onClick={aoAbrir ? () => aoAbrir(l) : undefined}>
              {colunas.map((c) => <td key={c.rotulo} className={c.classe}>{c.render(l)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** "Juliana entrou; Bruno saiu" a partir do antes/depois da composicao. */
function textoComposicao(a, nomes) {
  const antes = (a.dados_anteriores?.fiscais || []).map(String);
  const depois = (a.dados_novos?.fiscais || []).map(String);
  const nome = (id) => nomes[id] || `servidor ${id}`;
  const entrou = depois.filter((x) => !antes.includes(x)).map(nome);
  const saiu = antes.filter((x) => !depois.includes(x)).map(nome);
  return [entrou.length && `Entrou: ${entrou.join(", ")}`, saiu.length && `Saiu: ${saiu.join(", ")}`]
    .filter(Boolean).join(" · ") || "Composição da equipe revisada";
}

export default function EquipeDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const { podeVer } = useSessao();
  const [e, setE] = useState(null);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [parametros, definirParametros] = useSearchParams();
  // "viaturas" (link antigo) abre a aba Serviço Diário, que a substituiu em 21/10.
  const aba = (parametros.get("aba") === "viaturas" ? "servicos" : parametros.get("aba")) || "geral";
  const setAba = (chave) => {
    const p = new URLSearchParams(parametros);
    if (chave === "geral") p.delete("aba"); else p.set("aba", chave);
    definirParametros(p, { replace: true });
    window.scrollTo({ top: 0 });
  };
  const podeEditar = podeVer("FISCALIZACAO_GERENCIAR_EQUIPES");

  useEffect(() => {
    definirCabecalho({ titulo: "", legenda: "" });
  }, [definirCabecalho]);

  useEffect(() => {
    api(`/fiscalizacao/equipes/${id}/ficha`).then(setE).catch((x) => setErro(x.message));
  }, [id, recarga]);

  if (erro) return <Cartao><div className="vazio">{erro}</div></Cartao>;
  if (!e) return <div className="carregando">Carregando...</div>;

  const r = e.resumo || {};
  const vePontos = Array.isArray(e.pontuacao);
  const atuais = (e.fiscais || []).filter((f) => f.atual);
  const ultimo = e.ultimo_servico;
  const abrirFiscal = (f) => navegar(`/fiscalizacao/fiscais/${f.id_servidor}`);
  const abrirOcorrencia = (o) => navegar(`/fiscalizacao/ocorrencias/${o.id_ocorrencia}`);
  const abrirViatura = (v) => navegar(`/fiscalizacao/viaturas/${v.id_veiculo}`);
  const situacao = <Selo texto={e.status ? "Ativa" : "Inativa"} tom={e.status ? "verde" : "vermelho"} />;
  const nomes = Object.fromEntries((e.fiscais || []).map((f) => [String(f.id_servidor), f.nome]));

  // Historico: cadastro, composicao e servicos diarios, numa linha do tempo.
  const atividades = [
    ...(e.historico || []).map((a) => ({
      quando: a.data_hora, tipo: a.entidade === "equipe_servidor" ? "Fiscais" : a.entidade === "equipe_turno" ? "Turno" : "Cadastro", tom: "roxo",
      descricao: (a.entidade === "equipe_servidor"
        ? textoComposicao(a, nomes)
        : a.entidade === "equipe_turno"
          ? `Turno alterado para ${TURNOS_EQUIPE.find((t) => t.valor === a.dados_novos?.turno)?.rotulo || a.dados_novos?.turno || "-"}`
        : a.acao === "CRIAR" ? "Equipe cadastrada" : a.acao === "EXCLUIR" ? "Equipe excluída" : "Dados da equipe alterados")
        + (a.justificativa ? ` - Motivo: ${a.justificativa}` : "") + (a.pessoa ? ` (por ${a.pessoa})` : ""),
      selo: null,
    })),
    ...(e.fiscais || []).map((f) => ({
      quando: f.data_inicio, tipo: "Fiscais", tom: "verde",
      descricao: `${f.nome} entrou na equipe${f.data_fim ? ` (saiu em ${data(f.data_fim)})` : ""}`,
      selo: f.atual ? <Selo texto="Atual" tom="verde" /> : <Selo texto="Saiu" tom="cinza" />,
    })),
    ...(e.servicos || []).map((s) => ({
      quando: s.data, tipo: "Serviço diário", tom: "azul",
      descricao: `Serviço ${capitalizar(s.turno)}${s.coordenador ? ` - coordenação de ${s.coordenador}` : ""}`,
      selo: <Selo texto={SITUACAO_SERVICO[s.status] || capitalizar(String(s.status || "").replace(/_/g, " "))} tom={s.status === "EM_SERVICO" ? "azul" : "cinza"} />,
    })),
  ].sort((a, b) => String(b.quando).localeCompare(String(a.quando)));

  const ABAS = [
    { chave: "geral", rotulo: "Visão Geral", icone: "equipe" },
    { chave: "fiscais", rotulo: "Fiscais", icone: "motorista", total: (e.fiscais || []).length },
    // 21/10: a aba Viaturas virou Serviço Diário (os servicos da equipe, com a viatura de cada um).
    { chave: "servicos", rotulo: "Serviço Diário", icone: "calendar", total: r.servicos },
    { chave: "ocorrencias", rotulo: "Ocorrências", icone: "fisc-ocorrencias", total: r.ocorrencias },
    ...(vePontos ? [{ chave: "pontuacao", rotulo: "Pontuação", icone: "fisc-bolt" }] : []),
    { chave: "historico", rotulo: "Histórico", icone: "historico" },
  ];

  const COL_FISCAL = [
    { rotulo: "Matrícula", render: (f) => (
      <span className="eq-fiscal"><span className="eq-fiscal__avatar">{iniciais(f.nome)}</span>{f.matricula}</span>
    ) },
    { rotulo: "Nome", classe: "coluna-flexivel", render: (f) => <strong>{f.nome}</strong> },
    { rotulo: "Cargo / Função", render: (f) => vazio(f.cargo) },
    { rotulo: "Desde", render: (f) => data(f.data_inicio) },
    { rotulo: "Até", render: (f) => (f.data_fim ? data(f.data_fim) : "—") },
    { rotulo: "Situação", render: (f) => (f.atual
      ? <Selo texto="Ativo" tom="verde" /> : <Selo texto="Saiu da equipe" tom="cinza" />) },
  ];
  const COL_VIATURA = [
    { rotulo: "Placa", render: (v) => <strong>{v.placa}</strong> },
    { rotulo: "Modelo", classe: "coluna-flexivel", render: (v) => `${v.marca} ${v.modelo}` },
    { rotulo: "Tipo", render: (v) => tipoVeiculo(v.tipo_veiculo) },
    { rotulo: "Usos", render: (v) => numero(v.usos) },
    { rotulo: "KM rodado", render: (v) => (v.km ? `${numero(v.km)} km` : "—") },
    { rotulo: "Último uso", render: (v) => data(v.ultimo_uso) },
    { rotulo: "Situação", render: (v) => <Selo valor={v.status} /> },
  ];
  const COL_SERVICO = [
    { rotulo: "Nº", render: (x) => (x.codigo ? <strong>{x.codigo}</strong> : "—") },
    { rotulo: "Data", render: (x) => data(x.data) },
    { rotulo: "Turno", render: (x) => capitalizar(x.turno) },
    { rotulo: "Viatura", classe: "coluna-flexivel", render: (x) => (x.placa
      ? <span className="celula-dupla"><strong>{x.placa}</strong><span>{x.marca} {x.modelo}</span></span> : "—") },
    { rotulo: "Coordenador", render: (x) => vazio(x.coordenador) },
    { rotulo: "Ocorrências", render: (x) => numero(x.ocorrencias || 0) },
    { rotulo: "Situação", render: (x) => <Selo valor={x.situacao} /> },
  ];
  const abrirServico = (x) => x.id_servico_equipe && navegar(`/fiscalizacao/servico-diario/${x.id_servico_equipe}`);
  const COL_OCORRENCIA = [
    { rotulo: "Nº", render: (o) => vazio(o.protocolo) },
    { rotulo: "Data / Hora", render: (o) => `${data(o.data)} ${hora(o.hora)}` },
    { rotulo: "Local", classe: "coluna-flexivel", render: (o) => (
      <span className="celula-cortada" title={o.endereco || ""}>{vazio(o.endereco)}</span>
    ) },
    { rotulo: "Tipo", render: (o) => TIPO_OCORRENCIA[o.tipo] || o.tipo },
    { rotulo: "Viatura", render: (o) => vazio(o.viatura) },
    { rotulo: "Situação", render: (o) => <SeloOcorrencia status={o.status} /> },
  ];
  const COL_PONTOS = [
    { rotulo: "Data", render: (p) => data(p.data_registro) },
    { rotulo: "Item", classe: "coluna-flexivel", render: (p) => (
      <span className="celula-cortada" title={p.observacao || p.item}>{p.codigo} - {p.item}</span>
    ) },
    { rotulo: "Lançado para", render: (p) => (p.servidor ? p.servidor : "Equipe") },
    { rotulo: "Qtd.", render: (p) => numero(p.quantidade) },
    { rotulo: "Pontos", render: (p) => <Pontos valor={p.pontos_aplicados} /> },
  ];
  const COL_ATIVIDADE = [
    { rotulo: "Data / Hora", render: (a) => (String(a.quando).length > 10 ? dataHora(a.quando) : data(a.quando)) },
    { rotulo: "Tipo", render: (a) => <span className="vd-tipo" data-tom={a.tom}>{a.tipo}</span> },
    { rotulo: "Descrição", classe: "coluna-flexivel", render: (a) => (
      <span className="celula-cortada" title={a.descricao}>{a.descricao}</span>
    ) },
    { rotulo: "Situação", render: (a) => a.selo || "—" },
  ];

  const verTodos = (chave, total) => (
    <button className="botao botao--pequeno vd-cartao-acao" onClick={() => setAba(chave)}>
      Ver todos ({numero(total || 0)})
    </button>
  );

  const cards = [
    { chave: "fiscais", rotulo: "Fiscais", valor: numero(r.fiscais_ativos || 0), icone: "motorista", tom: "verde", rodape: "Ativos na equipe" },
    { chave: "servicos", rotulo: "Viaturas", valor: numero(r.viaturas_6m || 0), icone: "fisc-viatura", tom: "azul", rodape: "Utilizadas nos últimos 6 meses" },
    { chave: "ocorrencias", rotulo: "Ocorrências", valor: numero(r.ocorrencias_6m || 0), icone: "fisc-ocorrencias", tom: "amarelo", rodape: "Últimos 6 meses" },
    vePontos
      ? { chave: "pontuacao", rotulo: "Pontuação", valor: <Pontos valor={r.pontos_6m} />, icone: "fisc-bolt", tom: "vermelho", rodape: "Últimos 6 meses" }
      : { chave: "servicos", rotulo: "Serviços", valor: numero(r.servicos_6m || 0), icone: "calendar", tom: "vermelho", rodape: "Últimos 6 meses" },
  ];

  const totalPositivo = vePontos ? e.pontuacao.filter((p) => Number(p.pontos_aplicados) > 0).reduce((t, p) => t + Number(p.pontos_aplicados), 0) : 0;
  const totalNegativo = vePontos ? e.pontuacao.filter((p) => Number(p.pontos_aplicados) < 0).reduce((t, p) => t + Number(p.pontos_aplicados), 0) : 0;

  return (
    <div className="ficha">
      <div className="cabecalho-pagina vd-cabecalho">
        <div>
          <Trilha itens={[{ rotulo: "Fiscalização" }, { rotulo: "Equipes", para: BASE }, { rotulo: "Detalhes da Equipe" }]} />
          <div className="vd-titulo">
            <span className="vd-titulo__icone"><Icone nome="equipe" tamanho={26} /></span>
            <div>
              <h1>Detalhes da Equipe</h1>
              <p>Visualize todas as informações da equipe, incluindo fiscais, viaturas, ocorrências, pontuação e histórico.</p>
            </div>
          </div>
        </div>
        <div className="cabecalho-pagina__acoes">
          <button className="botao" onClick={() => navegar(BASE)}>
            <Icone nome="seta-esquerda" tamanho={15} /> Voltar
          </button>
          {podeEditar && (
            <button className="botao" onClick={() => setEditando(true)}>
              <Icone nome="editar" tamanho={15} /> Editar
            </button>
          )}
        </div>
      </div>

      <section className="vd-resumo sd-resumo">
        <div className="sd-pessoa">
          <span className="sd-avatar eq-avatar" aria-hidden="true"><Icone nome="equipe" tamanho={40} /></span>
          <div className="sd-pessoa__dados">
            <span className="vd-resumo__rotulo">Equipe</span>
            <span className="sd-pessoa__nome"><strong>{e.numero}</strong>{situacao}</span>
            <span className="sd-pessoa__linha">
              Tipo: <strong>{TIPO_EQUIPE[e.tipo] || capitalizar(e.tipo)}</strong>
              <span className="sd-sep">|</span>
              Setor: <strong>Fiscalização</strong>
            </span>
          </div>
        </div>
        <div className="vd-resumo__grade vd-resumo__grade--4">
          <div className="vd-resumo__coluna">
            <Item rotulo="Último coordenador">
              {ultimo?.coordenador
                ? <span className="celula-dupla sd-esquerda"><strong>{ultimo.coordenador}</strong><span>Matrícula: {ultimo.coordenador_matricula}</span></span>
                : "—"}
            </Item>
          </div>
          <div className="vd-resumo__coluna">
            <Item rotulo="Turno">
              {e.turno
                ? <span className="celula-dupla sd-esquerda"><strong>{capitalizar(e.turno)}</strong><span>{TURNOS_EQUIPE.find((t) => t.valor === e.turno)?.horario || "Turno atual da equipe"}</span></span>
                : "—"}
            </Item>
          </div>
          <div className="vd-resumo__coluna">
            <Item rotulo="Último serviço">
              {ultimo
                ? <span className="celula-dupla sd-esquerda"><strong>{data(ultimo.data)}</strong><span>{capitalizar(ultimo.turno)}</span></span>
                : "—"}
            </Item>
          </div>
          <div className="vd-resumo__coluna">
            <Item rotulo="Última atualização">
              {e.atualizada_em
                ? <span className="celula-dupla sd-esquerda"><strong>{dataHora(e.atualizada_em)}</strong>
                    {e.criada_em && <span>Criada em {data(e.criada_em)}</span>}</span>
                : "—"}
            </Item>
          </div>
        </div>
      </section>

      <div className="abas vd-abas" role="tablist">
        {ABAS.map((a) => (
          <button key={a.chave} type="button" role="tab" className="aba"
                  data-ativa={aba === a.chave} aria-selected={aba === a.chave}
                  onClick={() => setAba(a.chave)}>
            <Icone nome={a.icone} tamanho={16} />
            {a.rotulo}
            {a.total ? <span className="vd-abas__total">{a.total}</span> : null}
          </button>
        ))}
      </div>

      {aba === "geral" && (
        <>
          <div className="eq-linha1 ficha-bloco">
            <div className="ficha-col">
            <Cartao titulo={<><Icone nome="informacao" tamanho={18} /> Informações da Equipe</>}>
              <Linhas linhas={[
                ["Equipe", e.numero],
                ["Tipo", TIPO_EQUIPE[e.tipo] || capitalizar(e.tipo)],
                e.apoio && ["Equipe de apoio", e.policial ? `Sim · Policial: ${e.policial}` : "Sim"],
                ["Setor", "Fiscalização"],
                ["Turno", e.turno ? (TURNOS_EQUIPE.find((t) => t.valor === e.turno)?.rotulo || capitalizar(e.turno)) : null],
                ["Último coordenador", ultimo?.coordenador ? `${ultimo.coordenador} (Matrícula: ${ultimo.coordenador_matricula})` : null],
                ["Fiscais ativos", atuais.length ? atuais.map((f) => f.nome).join(", ") : "Nenhum"],
                ["Situação", situacao],
                ["Data de criação", e.criada_em ? data(e.criada_em) : null],
                ["Última atualização", e.atualizada_em ? dataHora(e.atualizada_em) : null],
                ["Observações", e.observacoes],
              ].filter(Boolean)} />
            </Cartao>
            {/* 21/10: Fiscais logo abaixo das Informações (antes ficava um vão). */}
            <Cartao titulo={<><Icone nome="motorista" tamanho={18} /> Fiscais da Equipe</>}
                    acao={verTodos("fiscais", (e.fiscais || []).length)}>
              <Tabela linhas={atuais.slice(0, 6)}
                      colunas={COL_FISCAL.filter((c) => !["Desde", "Até"].includes(c.rotulo))}
                      aoAbrir={abrirFiscal} vazio="Nenhum fiscal na equipe." />
            </Cartao>
            </div>

            <div className="ficha-col">
              <Cartao titulo={<><Icone nome="chart-line" tamanho={18} /> Resumo</>}>
                <div className="sd-resumo-cards eq-cards">
                  {cards.map((c) => (
                    <button type="button" key={c.chave} className="sd-card" data-tom={c.tom} onClick={() => setAba(c.chave)}>
                      <Icone nome={c.icone} tamanho={24} />
                      <span>
                        <span className="sd-card__rotulo">{c.rotulo}</span>
                        <strong>{c.valor}</strong>
                        <small>{c.rodape}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </Cartao>
              <Cartao titulo={<><Icone nome="alert-triangle" tamanho={18} /> Últimas Ocorrências da Equipe</>}
                      acao={verTodos("ocorrencias", r.ocorrencias)}>
                <Tabela linhas={(e.ocorrencias || []).slice(0, 5)} colunas={COL_OCORRENCIA}
                        aoAbrir={abrirOcorrencia} vazio="Nenhuma ocorrência atribuída para a equipe." />
              </Cartao>
              <Cartao titulo={<><Icone nome="fisc-viatura" tamanho={18} /> Viaturas utilizadas</>}
                      acao={verTodos("servicos", r.viaturas)}>
                <Tabela linhas={(e.viaturas || []).slice(0, 5)}
                        colunas={COL_VIATURA.filter((c) => !["KM rodado", "Usos"].includes(c.rotulo))}
                        aoAbrir={abrirViatura} vazio="A equipe ainda não usou nenhuma viatura." />
              </Cartao>
            </div>
          </div>

        </>
      )}

      {aba === "fiscais" && (
        <Cartao titulo={<><Icone nome="motorista" tamanho={18} /> Fiscais da equipe</>}>
          <Tabela linhas={e.fiscais || []} colunas={COL_FISCAL} aoAbrir={abrirFiscal} vazio="Nenhum fiscal na equipe." />
          <p className="vd2-nota" style={{ marginTop: 10 }}>
            Quem saiu da equipe continua aqui, com a data de saída. Clique no fiscal para abrir a ficha dele.
          </p>
        </Cartao>
      )}

      {aba === "servicos" && (
        <>
          <Cartao titulo={<><Icone nome="calendar" tamanho={18} /> Serviço Diário</>}>
            <Tabela linhas={e.servicos || []} colunas={COL_SERVICO} aoAbrir={abrirServico} vazio="A equipe ainda não teve serviço diário." />
          </Cartao>
          <Cartao titulo={<><Icone nome="fisc-viatura" tamanho={18} /> Viaturas utilizadas</>}>
            <Tabela linhas={e.viaturas || []} colunas={COL_VIATURA} aoAbrir={abrirViatura} vazio="A equipe ainda não usou nenhuma viatura." />
            <p className="vd2-nota" style={{ marginTop: 10 }}>
              A viatura não fica presa à equipe: aqui aparecem as que a equipe usou, pelos checklists de viatura.
            </p>
          </Cartao>
        </>
      )}

      {aba === "ocorrencias" && (
        <Cartao titulo={<><Icone nome="fisc-ocorrencias" tamanho={18} /> Ocorrências atribuídas</>}>
          <Tabela linhas={e.ocorrencias || []} colunas={COL_OCORRENCIA} aoAbrir={abrirOcorrencia}
                  vazio="Nenhuma ocorrência atribuída para a equipe." />
        </Cartao>
      )}

      {aba === "pontuacao" && vePontos && (
        <Cartao titulo={<><Icone nome="fisc-bolt" tamanho={18} /> Pontuação da equipe</>}>
          <div className="fd-pontos-resumo">
            <div><span>Total</span><Pontos valor={r.pontos} /></div>
            <div><span>Últimos 6 meses</span><Pontos valor={r.pontos_6m} /></div>
            <div><span>Positivos</span><Pontos valor={totalPositivo} /></div>
            <div><span>Negativos</span><Pontos valor={totalNegativo} /></div>
          </div>
          <Tabela linhas={e.pontuacao} colunas={COL_PONTOS} vazio="Nenhum registro de pontuação." />
        </Cartao>
      )}

      {aba === "historico" && (
        <Cartao titulo={<><Icone nome="historico" tamanho={18} /> Histórico da equipe</>}>
          <Tabela linhas={atividades} colunas={COL_ATIVIDADE} vazio="Nenhuma atividade registrada." />
        </Cartao>
      )}

      {editando && (
        <JanelaCadastro config={CONFIG_EQUIPE} id={id}
                        aoFechar={() => setEditando(false)}
                        aoSalvar={() => setRecarga((n) => n + 1)} />
      )}
    </div>
  );
}
