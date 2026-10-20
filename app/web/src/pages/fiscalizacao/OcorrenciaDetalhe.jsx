/**
 * OcorrenciaDetalhe.jsx - Detalhes da Ocorrencia (desenho do Cesar, 18/10).
 *
 * Faixa com o protocolo e a situacao, a equipe, os fiscais e a viatura que
 * atenderam; abas Visao Geral, Distribuicao, Pontuacao (so quem gerencia a
 * pontuacao) e Historico.
 *
 * Do desenho saiu o que o SITRA nao tem na ocorrencia: envolvidos (condutor
 * e veiculo abordados), fotos, documentos e infracoes. Editar abre a janela
 * de cadastro da lista de Ocorrencias, aqui mesmo.
 */
import { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import Selo from "../../components/Selo.jsx";
import JanelaCadastro from "../../components/JanelaCadastro.jsx";
import { Tabela, Abas } from "../../components/FichaTabela.jsx";
import { api } from "../../lib/api.js";
import { data, dataHora, hora, numero } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";
import { Item, Linhas } from "../ServidorDetalhe.jsx";
import { CONFIG_OCORRENCIA, TIPOS_OCORRENCIA } from "./Ocorrencias.jsx";

const BASE = "/fiscalizacao/ocorrencias";
const TURNO = { DIURNO: "Diurno", NOTURNO: "Noturno" };
const TIPO_DISTRIBUICAO = { ATRIBUICAO: "Atribuição", REATRIBUICAO: "Reatribuição" };
const ACAO = { CRIAR: "Ocorrência registrada", EDITAR: "Ocorrência alterada", EXCLUIR: "Ocorrência excluída" };
const tipoTexto = (t) => (t === "QRU" ? "QRU" : TIPOS_OCORRENCIA.find((x) => x.valor === t)?.rotulo || t);

function Pontos({ valor }) {
  const n = Number(valor || 0);
  return <strong className="fd-pontos" data-sinal={n > 0 ? "mais" : n < 0 ? "menos" : "zero"}>
    {n > 0 ? "+" : ""}{numero(n, Number.isInteger(n) ? 0 : 1)}
  </strong>;
}

export default function OcorrenciaDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const { podeVer } = useSessao();
  const [o, setO] = useState(null);
  const [erro, setErro] = useState("");
  const [recarga, setRecarga] = useState(0);
  const [editando, setEditando] = useState(false);
  const [parametros, definirParametros] = useSearchParams();
  const aba = parametros.get("aba") || "geral";
  const setAba = (chave) => {
    const p = new URLSearchParams(parametros);
    if (chave === "geral") p.delete("aba"); else p.set("aba", chave);
    definirParametros(p, { replace: true });
  };

  useEffect(() => { definirCabecalho({ titulo: "", legenda: "" }); }, [definirCabecalho]);
  useEffect(() => {
    api(`/fiscalizacao/ocorrencias/${id}/ficha`).then(setO).catch((e) => setErro(e.message));
  }, [id, recarga]);

  if (erro) return <Cartao><div className="vazio">{erro}</div></Cartao>;
  if (!o) return <div className="carregando">Carregando a ocorrência...</div>;

  const d = o.distribuicao;
  const vePontos = Array.isArray(o.pontuacao);
  const totalPontos = vePontos ? o.pontuacao.reduce((t, r) => t + Number(r.pontos_aplicados || 0), 0) : 0;
  const podeEditar = podeVer("FISCALIZACAO_GERENCIAR_OCORRENCIAS");
  const registrada = o.data_criacao ? dataHora(o.data_criacao) : `${data(o.data)} ${hora(o.hora)}`;

  const ABAS = [
    { chave: "geral", rotulo: "Visão Geral", icone: "fisc-ocorrencias" },
    { chave: "distribuicao", rotulo: "Distribuição", icone: "equipe", total: o.distribuicoes.length },
    vePontos && { chave: "pontuacao", rotulo: "Pontuação", icone: "fisc-bolt", total: o.pontuacao.length },
    { chave: "historico", rotulo: "Histórico", icone: "historico" },
  ].filter(Boolean);

  // Linha do tempo: registro, distribuicoes, alteracoes e a finalizacao.
  const eventos = [
    { quando: String(o.data_criacao || `${o.data} ${o.hora}`), titulo: "Ocorrência registrada", quem: o.criado_por_nome, estado: "feito" },
    ...o.distribuicoes.map((x) => ({
      quando: `${String(x.data).slice(0, 10)} ${x.hora || ""}`,
      titulo: `${TIPO_DISTRIBUICAO[x.tipo] || x.tipo} para a ${x.equipe || "equipe"}${x.placa ? ` (${x.placa})` : ""}`,
      quem: x.motivo_reatribuicao ? `Motivo: ${x.motivo_reatribuicao}` : x.coordenador ? `Coordenador: ${x.coordenador}` : "",
      estado: x.status === "CANCELADA" ? "cancelado" : "feito",
    })),
    ...o.historico.filter((h) => h.acao !== "CRIAR").map((h) => ({
      quando: String(h.data_hora), titulo: ACAO[h.acao] || h.acao,
      quem: [h.pessoa, h.justificativa].filter(Boolean).join(" · "), estado: "feito",
    })),
    o.data_finalizacao && { quando: String(o.data_finalizacao), titulo: "Ocorrência finalizada", quem: "", estado: "feito" },
  ].filter(Boolean).sort((a, b) => a.quando.localeCompare(b.quando));
  const quandoTexto = (q) => (q.length > 10 && q.slice(11, 16).trim() ? `${data(q.slice(0, 10))} ${q.slice(11, 16)}` : data(q.slice(0, 10)));

  const COL_DIST = [
    { rotulo: "Data / Hora", render: (x) => `${data(x.data)} ${x.hora ? hora(x.hora) : ""}` },
    { rotulo: "Tipo", render: (x) => TIPO_DISTRIBUICAO[x.tipo] || x.tipo },
    { rotulo: "Equipe", render: (x) => x.equipe || "—" },
    { rotulo: "Viatura", render: (x) => (x.placa ? <span className="celula-dupla"><strong>{x.placa}</strong><span>{x.marca} {x.modelo}</span></span> : "—") },
    { rotulo: "Coordenador", render: (x) => x.coordenador || "—" },
    { rotulo: "Motivo", classe: "coluna-flexivel", render: (x) => <span className="celula-cortada" title={x.motivo_reatribuicao || ""}>{x.motivo_reatribuicao || "—"}</span> },
    { rotulo: "Situação", render: (x) => <Selo valor={x.status} /> },
  ];
  const COL_FISCAL = [
    { rotulo: "Matrícula", render: (f) => f.matricula || "—" },
    { rotulo: "Nome", render: (f) => <strong>{f.nome}</strong> },
    { rotulo: "Cargo / Função", render: (f) => f.cargo || "—" },
  ];
  const COL_PONTOS = [
    { rotulo: "Data", render: (r) => data(r.data_registro) },
    { rotulo: "Item", classe: "coluna-flexivel", render: (r) => `${r.codigo} - ${r.item}` },
    { rotulo: "Para", render: (r) => r.servidor || (r.equipe ? `Equipe ${r.equipe}` : "—") },
    { rotulo: "Qtd.", render: (r) => numero(r.quantidade) },
    { rotulo: "Pontos", render: (r) => <Pontos valor={r.pontos_aplicados} /> },
  ];

  return (
    <div className="ficha">
      <div className="cabecalho-pagina vd-cabecalho">
        <div>
          <Trilha itens={[{ rotulo: "Fiscalização" }, { rotulo: "Ocorrências", para: BASE }, { rotulo: "Detalhes da Ocorrência" }]} />
          <div className="vd-titulo">
            <span className="vd-titulo__icone"><Icone nome="fisc-ocorrencias" tamanho={26} /></span>
            <div>
              <h1>Detalhes da Ocorrência</h1>
              <p>Visualize todas as informações da ocorrência, incluindo equipe, viatura, local, atendimento e histórico.</p>
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
          <span className="sd-avatar eq-avatar" aria-hidden="true"><Icone nome="fisc-ocorrencias" tamanho={40} /></span>
          <div className="sd-pessoa__dados">
            <span className="vd-resumo__rotulo">Ocorrência</span>
            <span className="sd-pessoa__nome"><strong>{o.protocolo || `Nº ${o.id_ocorrencia}`}</strong><Selo valor={o.status} /></span>
            <span className="sd-pessoa__linha">
              {tipoTexto(o.tipo)}
              <span className="sd-sep">|</span>
              Registrada em {registrada}
            </span>
          </div>
        </div>
        <div className={`vd-resumo__grade vd-resumo__grade--${vePontos ? 5 : 4}`}>
          <div className="vd-resumo__coluna">
            <Item rotulo="Equipe">{d?.equipe || "—"}</Item>
          </div>
          <div className="vd-resumo__coluna">
            <Item rotulo="Fiscais">
              {o.fiscais.length
                ? <span className="celula-lista sd-esquerda">{o.fiscais.map((f) => <span key={f.id_servidor}>{f.nome}</span>)}</span>
                : "—"}
            </Item>
          </div>
          <div className="vd-resumo__coluna">
            <Item rotulo="Viatura">
              {d?.placa ? <span className="celula-dupla sd-esquerda"><strong>{d.placa}</strong><span>{d.marca} {d.modelo}</span></span> : "—"}
            </Item>
          </div>
          <div className="vd-resumo__coluna">
            <Item rotulo="Local">{o.endereco || "—"}</Item>
          </div>
          {vePontos && (
            <div className="vd-resumo__coluna">
              <Item rotulo="Pontuação">{o.pontuacao.length ? <Pontos valor={totalPontos} /> : "—"}</Item>
            </div>
          )}
        </div>
      </section>

      <Abas abas={ABAS} ativa={aba} aoMudar={setAba} />

      {aba === "geral" && (
        <div className="oc-corpo ficha-bloco">
          <div className="ficha-col">
            <Cartao titulo={<><Icone nome="documento" tamanho={18} /> Descrição da Ocorrência</>}>
              <Linhas linhas={[
                ["Tipo", tipoTexto(o.tipo)],
                ["Descrição", o.descricao],
                ["Data e hora", `${data(o.data)} às ${hora(o.hora)}`],
                ["Local", o.endereco],
                ["Observações", o.observacoes],
                ["Serviço diário", o.servico_data ? (o.id_servico_equipe
                  ? <button type="button" className="pt-nome sd-codigo" onClick={() => navegar(`/fiscalizacao/servico-diario/${o.id_servico_equipe}`)}>
                      {o.servico_codigo} · {data(o.servico_data)} · {TURNO[o.servico_turno] || o.servico_turno}
                    </button>
                  : `${data(o.servico_data)} · ${TURNO[o.servico_turno] || o.servico_turno}`) : null],
                ["Coordenador", o.coordenador ? `${o.coordenador} (Matrícula: ${o.coordenador_matricula})` : null],
              ]} />
            </Cartao>
            <Cartao titulo={<><Icone nome="equipe" tamanho={18} /> Atendimento</>}>
              <Linhas linhas={[
                ["Equipe", d?.equipe],
                ["Viatura", d?.placa ? `${d.placa} - ${d.marca} ${d.modelo}` : null],
                ["Situação", <Selo valor={o.status} />],
                ["Descrição do atendimento", o.descricao_atendimento],
                ["Finalizada em", o.data_finalizacao ? dataHora(o.data_finalizacao) : null],
              ]} />
              <h3 className="formulario__secao" style={{ marginTop: 16 }}>Fiscais da equipe no dia</h3>
              <Tabela linhas={o.fiscais} colunas={COL_FISCAL}
                      aoAbrir={(f) => navegar(`/fiscalizacao/fiscais/${f.id_servidor}`)}
                      vazio={d ? "Nenhum fiscal na equipe nesse dia." : "A ocorrência ainda não foi distribuída para uma equipe."} />
            </Cartao>
          </div>

          <div className="ficha-col">
            <Cartao titulo={<><Icone nome="check" tamanho={18} /> Situação{vePontos ? " e Pontuação" : ""}</>}>
              <Linhas linhas={[
                ["Situação atual", <Selo valor={o.status} />],
                vePontos && ["Pontuação", o.pontuacao.length ? <Pontos valor={totalPontos} /> : "Nenhum ponto lançado"],
                ["Data de registro", registrada],
                ["Registrado por", o.criado_por_nome ? `${o.criado_por_nome}${o.criado_por_matricula ? ` (Matrícula: ${o.criado_por_matricula})` : ""}` : null],
              ].filter(Boolean)} />
            </Cartao>
            <Cartao titulo={<><Icone nome="historico" tamanho={18} /> Histórico da Ocorrência</>}>
              <ol className="etapas">
                {eventos.map((e, i) => (
                  <li key={i} data-estado={e.estado}>
                    <span className="etapas__ponto">{e.estado === "feito" ? "✓" : e.estado === "cancelado" ? "×" : ""}</span>
                    <div className="etapas__texto">
                      <strong>{e.titulo}</strong>
                      <span>{quandoTexto(e.quando)}{e.quem ? ` · ${e.quem}` : ""}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </Cartao>
          </div>
        </div>
      )}

      {aba === "distribuicao" && (
        <Cartao titulo={<><Icone nome="equipe" tamanho={18} /> Distribuição para equipes</>}>
          <Tabela linhas={o.distribuicoes} colunas={COL_DIST}
                  aoAbrir={(x) => x.id_equipe && navegar(`/fiscalizacao/equipes/${x.id_equipe}`)}
                  vazio="A ocorrência ainda não foi distribuída para uma equipe." />
        </Cartao>
      )}

      {aba === "pontuacao" && vePontos && (
        <Cartao titulo={<><Icone nome="fisc-bolt" tamanho={18} /> Pontuação da ocorrência</>}>
          <Tabela linhas={o.pontuacao} colunas={COL_PONTOS} vazio="Nenhum ponto lançado por esta ocorrência." />
        </Cartao>
      )}

      {aba === "historico" && (
        <Cartao titulo={<><Icone nome="historico" tamanho={18} /> Histórico</>}>
          <Tabela linhas={[...eventos].reverse()} vazio="Nenhuma movimentação registrada."
                  colunas={[
                    { rotulo: "Data", render: (e) => quandoTexto(e.quando) },
                    { rotulo: "O que aconteceu", render: (e) => <strong>{e.titulo}</strong> },
                    { rotulo: "Detalhes", classe: "coluna-flexivel", render: (e) => <span className="celula-cortada" title={e.quem}>{e.quem || "—"}</span> },
                  ]} />
        </Cartao>
      )}

      {editando && (
        <JanelaCadastro config={CONFIG_OCORRENCIA} id={o.id_ocorrencia}
                        aoFechar={() => setEditando(false)}
                        aoSalvar={() => setRecarga((n) => n + 1)} />
      )}
    </div>
  );
}
