/**
 * ServicoDiarioDetalhe.jsx - Detalhes do Servico Diario (desenho do Cesar,
 * 20/10). Uma EQUIPE num servico, pelo codigo SD-AAAA-NNNNN.
 *
 * Faixa com o codigo e a situacao, abas (Visao Geral, Equipe, Ocorrencias,
 * Checklists, Historico) e, na Visao Geral: informacoes do servico, os
 * fiscais, a viatura, o resumo, os horarios e as ocorrencias atendidas.
 *
 * Do desenho saiu o que o SITRA nao tem: tipo de servico, area de atuacao,
 * percurso e pontos fiscalizados, documentos, autos de infracao e
 * advertencias, "presente" do fiscal e observacoes finais do servico. A
 * viatura, a saida e a chegada sao as do checklist da viatura da equipe.
 */
import { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import Selo from "../../components/Selo.jsx";
import { useConfirmacaoSenha } from "../../components/ConfirmarSenha.jsx";
import { Tabela, Abas, VerTodos } from "../../components/FichaTabela.jsx";
import { api } from "../../lib/api.js";
import { data, dataHora, hora, numero, rotulo } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";
import { Item, Linhas } from "../ServidorDetalhe.jsx";
import JanelaServico, { ROTULO_TURNO, HORARIO_TURNO, mudarSituacaoServico } from "./JanelaServico.jsx";

const BASE = "/fiscalizacao/servico-diario";
const TIPO_EQUIPE = { FIXA: "Fixa", TEMPORARIA: "Temporária" };
const TIPO_OCORRENCIA = { QRU: "QRU", PROGRAMADA: "Programada" };
const PAPEL = { FISCAL_1: "Fiscal 1", FISCAL_2: "Fiscal 2" };
const ACAO = { CRIAR: "Serviço criado", EDITAR: "Serviço alterado", EXCLUIR: "Serviço excluído" };
/** Tipo do veiculo pelo rotulo do sistema; fora da lista, so a primeira maiuscula. */
const tipoVeiculo = (t) => { const r = rotulo("tipoVeiculo", t); return r === t && t ? t.charAt(0) + t.slice(1).toLowerCase() : r; };
const km = (n) => (n === null || n === undefined ? "—" : `${numero(n)} km`);

/** Minutos entre a saida e a chegada (a chegada pode ser no dia seguinte). */
function duracao(saida, chegada) {
  if (!saida || !chegada) return null;
  const m = (t) => Number(String(t).slice(0, 2)) * 60 + Number(String(t).slice(3, 5));
  let d = m(chegada) - m(saida);
  if (d < 0) d += 24 * 60;
  return `${Math.floor(d / 60)}h ${String(d % 60).padStart(2, "0")}min`;
}

export default function ServicoDiarioDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const { podeVer } = useSessao();
  const { pedirSenha, elemento: modalSenha } = useConfirmacaoSenha();
  const [s, setS] = useState(null);
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
    api(`/fiscalizacao/servico-diario/linha/${id}/ficha`).then(setS).catch((e) => setErro(e.message));
  }, [id, recarga]);

  if (erro) return <Cartao><div className="vazio">{erro}</div></Cartao>;
  if (!s) return <div className="carregando">Carregando o serviço...</div>;

  const r = s.resumo || {};
  const v = s.viatura;
  const recarregar = () => setRecarga((n) => n + 1);
  const podeGerenciar = podeVer("FISCALIZACAO_GERENCIAR_SERVICO");
  const turnoTexto = ROTULO_TURNO[s.turno] || s.turno;
  async function mudarSituacao(acao) {
    if (await mudarSituacaoServico(pedirSenha, s, acao)) recarregar();
  }

  const abrirFiscal = (f) => navegar(`/fiscalizacao/fiscais/${f.id_servidor}`);
  const abrirOcorrencia = (o) => navegar(`/fiscalizacao/ocorrencias/${o.id_ocorrencia}`);
  const abrirChecklist = (c) => navegar(`/fiscalizacao/checklists/${c.id_checklist}`);

  const ABAS = [
    { chave: "geral", rotulo: "Visão Geral", icone: "calendar" },
    { chave: "equipe", rotulo: "Equipe", icone: "equipe", total: s.fiscais.length },
    { chave: "ocorrencias", rotulo: "Ocorrências", icone: "fisc-ocorrencias", total: s.ocorrencias.length },
    { chave: "checklists", rotulo: "Checklists", icone: "checklist", total: s.checklists.length },
    { chave: "historico", rotulo: "Histórico", icone: "historico" },
  ];

  const COL_FISCAL = [
    { rotulo: "Nome", classe: "coluna-flexivel", render: (f) => <strong>{f.nome}</strong> },
    { rotulo: "Matrícula", render: (f) => f.matricula || "—" },
    { rotulo: "Função", render: (f) => (f.papel ? PAPEL[f.papel] : f.cargo || "Fiscal") },
    { rotulo: "Checklist", render: (f) => (f.papel
      ? <Selo texto="Assinou" tom="verde" /> : <Selo texto="Não assinou" tom="cinza" />) },
  ];
  const COL_OCORRENCIA = [
    { rotulo: "Protocolo", render: (o) => o.protocolo || "—" },
    { rotulo: "Horário", render: (o) => (o.hora ? hora(o.hora) : "—") },
    { rotulo: "Tipo", render: (o) => TIPO_OCORRENCIA[o.tipo] || o.tipo },
    { rotulo: "Local", classe: "coluna-flexivel", render: (o) => <span className="celula-cortada" title={o.endereco || ""}>{o.endereco || "—"}</span> },
    { rotulo: "Situação", render: (o) => <Selo valor={o.status} /> },
  ];
  const COL_CHECKLIST = [
    { rotulo: "Data", render: (c) => data(c.data_abertura) },
    { rotulo: "Viatura", render: (c) => <span className="celula-dupla"><strong>{c.placa}</strong><span>{c.marca} {c.modelo}</span></span> },
    { rotulo: "Fiscais", classe: "coluna-flexivel", render: (c) => <span className="celula-cortada" title={c.fiscais || ""}>{c.fiscais || "—"}</span> },
    { rotulo: "Saída", render: (c) => <span className="celula-dupla"><strong>{c.hora_saida ? hora(c.hora_saida) : "—"}</strong><span>{km(c.odometro_saida)}</span></span> },
    { rotulo: "Chegada", render: (c) => (c.hora_chegada
      ? <span className="celula-dupla"><strong>{hora(c.hora_chegada)}</strong><span>{km(c.odometro_chegada)}</span></span> : "—") },
    { rotulo: "KM rodado", render: (c) => (c.km_rodado != null ? km(c.km_rodado) : "—") },
    { rotulo: "Situação", render: (c) => <Selo valor={c.status} /> },
  ];

  // Historico: criacao, inicio, encerramento e alteracoes (auditoria).
  const historico = [
    s.hora_criacao && { quando: String(s.hora_criacao), titulo: "Serviço criado", texto: s.criado_por_nome || "" },
    ...s.checklists.map((c) => ({ quando: `${String(c.data_abertura).slice(0, 10)} ${c.hora_saida || ""}`,
      titulo: "Saída da viatura", texto: `${c.placa} · ${km(c.odometro_saida)}` })),
    ...s.checklists.filter((c) => c.hora_chegada).map((c) => ({ quando: `${String(c.data_abertura).slice(0, 10)} ${c.hora_chegada}`,
      titulo: "Chegada da viatura", texto: `${c.placa} · ${km(c.odometro_chegada)}` })),
    ...s.historico.filter((h) => h.acao !== "CRIAR").map((h) => ({ quando: String(h.data_hora),
      titulo: h.justificativa || ACAO[h.acao] || h.acao,
      texto: [h.pessoa, h.entidade === "servico_equipe" ? "Equipes do serviço alteradas" : ""].filter(Boolean).join(" · ") })),
  ].filter(Boolean).sort((a, b) => b.quando.localeCompare(a.quando));
  const quandoTexto = (q) => (q.slice(11, 16).trim() ? `${data(q.slice(0, 10))} ${q.slice(11, 16)}` : data(q.slice(0, 10)));

  return (
    <div className="ficha">
      <div className="cabecalho-pagina vd-cabecalho">
        <div>
          <Trilha itens={[{ rotulo: "Fiscalização" }, { rotulo: "Serviço Diário", para: BASE }, { rotulo: "Detalhes do Serviço Diário" }]} />
          <div className="vd-titulo">
            <span className="vd-titulo__icone"><Icone nome="calendar" tamanho={26} /></span>
            <div>
              <h1>Detalhes do Serviço Diário</h1>
              <p>Visualize todas as informações do serviço diário, incluindo equipe, viatura, ocorrências e checklists.</p>
            </div>
          </div>
        </div>
        <div className="cabecalho-pagina__acoes">
          <button className="botao" onClick={() => navegar(BASE)}>
            <Icone nome="seta-esquerda" tamanho={15} /> Voltar
          </button>
          {podeGerenciar && s.status_servico === "ABERTO" && (
            <button className="botao" onClick={() => mudarSituacao("INICIAR")}>
              <Icone nome="concluidas" tamanho={15} /> Iniciar serviço
            </button>
          )}
          {podeGerenciar && s.status_servico === "EM_SERVICO" && (
            <button className="botao" onClick={() => mudarSituacao("ENCERRAR")}>
              <Icone nome="historico" tamanho={15} /> Encerrar serviço
            </button>
          )}
          {podeGerenciar && s.status_servico !== "ENCERRADO" && (
            <button className="botao" onClick={() => setEditando(true)}>
              <Icone nome="editar" tamanho={15} /> Editar
            </button>
          )}
        </div>
      </div>

      <section className="vd-resumo sd-resumo">
        <div className="sd-pessoa">
          <span className="sd-avatar eq-avatar" aria-hidden="true"><Icone nome="calendar" tamanho={40} /></span>
          <div className="sd-pessoa__dados">
            <span className="vd-resumo__rotulo">Serviço diário</span>
            <span className="sd-pessoa__nome"><strong>{s.codigo}</strong><Selo valor={s.situacao} /></span>
            <span className="sd-pessoa__linha">
              Serviço {turnoTexto.toLowerCase()}
              {s.hora_criacao && <><span className="sd-sep">|</span>Registrado em {dataHora(s.hora_criacao)}</>}
            </span>
          </div>
        </div>
        <div className="vd-resumo__grade vd-resumo__grade--4">
          <div className="vd-resumo__coluna">
            <Item rotulo="Data do serviço">
              <span className="celula-dupla sd-esquerda"><strong>{data(s.data)}</strong><span>{HORARIO_TURNO[s.turno]}</span></span>
            </Item>
          </div>
          <div className="vd-resumo__coluna">
            <Item rotulo="Equipe">
              <span className="celula-dupla sd-esquerda"><strong>{s.equipe}</strong><span>{TIPO_EQUIPE[s.tipo_equipe] || ""}</span></span>
            </Item>
          </div>
          <div className="vd-resumo__coluna">
            <Item rotulo="Viatura">
              {v ? <span className="celula-dupla sd-esquerda"><strong>{v.placa}</strong><span>{v.marca} {v.modelo}</span></span> : "—"}
            </Item>
          </div>
          <div className="vd-resumo__coluna">
            <Item rotulo="Coordenador">
              {s.coordenador
                ? <span className="celula-dupla sd-esquerda"><strong>{s.coordenador}</strong><span>Matrícula: {s.coordenador_matricula}</span></span>
                : "—"}
            </Item>
          </div>
        </div>
      </section>

      <Abas abas={ABAS} ativa={aba} aoMudar={setAba} />

      {aba === "geral" && (
        <>
          <div className="vt-corpo ficha-bloco">
            <Cartao titulo={<><Icone nome="informacao" tamanho={18} /> Informações do Serviço</>}>
              <Linhas linhas={[
                ["Número do serviço", s.codigo],
                ["Data e horário", `${data(s.data)} · ${HORARIO_TURNO[s.turno]}`],
                ["Turno", turnoTexto],
                ["Equipe", s.equipe],
                ["Coordenador", s.coordenador ? `${s.coordenador} (Matrícula: ${s.coordenador_matricula})` : null],
                ["Situação", <Selo valor={s.situacao} />],
                ["Registrado por", s.criado_por_nome ? `${s.criado_por_nome}${s.criado_por_matricula ? ` (Matrícula: ${s.criado_por_matricula})` : ""}` : null],
                ["Encerrado por", s.encerrado_por_nome],
              ]} />
            </Cartao>

            <Cartao titulo={<><Icone nome="equipe" tamanho={18} /> Equipe de Fiscalização</>}
                    acao={<VerTodos texto="Ver equipe" aoClicar={() => navegar(`/fiscalizacao/equipes/${s.id_equipe}`)} />}>
              <Tabela linhas={s.fiscais} colunas={COL_FISCAL.filter((c) => c.rotulo !== "Checklist")}
                      aoAbrir={abrirFiscal} vazio="Nenhum fiscal na equipe nesse dia." />
            </Cartao>

            <Cartao titulo={<><Icone nome="fisc-viatura" tamanho={18} /> Viatura</>}
                    acao={v && <VerTodos texto="Ver detalhes" aoClicar={() => navegar(`/fiscalizacao/viaturas/${v.id_veiculo}`)} />}>
              {!v ? <p className="texto-corrido">A equipe ainda não fez o checklist da viatura neste serviço.</p> : (
                <>
                  <div className="sd-viatura">
                    <span className="sd-viatura__icone"><Icone nome="fisc-viatura" tamanho={30} /></span>
                    <div>
                      <span className="sd-pessoa__nome"><strong>{v.placa}</strong><Selo valor={v.status_veiculo} /></span>
                      <span>{v.marca} {v.modelo}</span>
                      <span>Equipe {s.equipe}</span>
                    </div>
                  </div>
                  <Linhas linhas={[
                    ["Ano", `${v.ano_fabricacao} / ${v.ano_modelo}`],
                    ["Tipo", tipoVeiculo(v.tipo_veiculo)],
                    ["Cor", v.cor],
                    ["Combustível", v.tipo_combustivel ? rotulo("combustivel", v.tipo_combustivel) : null],
                    ["KM na saída", km(v.odometro_saida)],
                    ["KM na chegada", km(v.odometro_chegada)],
                    ["KM rodado (serviço)", r.km_rodado ? km(r.km_rodado) : "—"],
                  ]} />
                </>
              )}
            </Cartao>
          </div>

          <div className="sd-linha2 ficha-bloco">
            <Cartao titulo={<><Icone nome="fisc-ocorrencias" tamanho={18} /> Ocorrências Atendidas</>}
                    acao={s.ocorrencias.length > 5 && <VerTodos total={s.ocorrencias.length} texto="Ver todas" aoClicar={() => setAba("ocorrencias")} />}>
              <Tabela linhas={s.ocorrencias.slice(0, 5)} colunas={COL_OCORRENCIA} aoAbrir={abrirOcorrencia}
                      vazio="A equipe não atendeu ocorrência neste serviço." />
            </Cartao>

            <Cartao titulo={<><Icone nome="chart-line" tamanho={18} /> Resumo do Serviço</>}>
              <dl className="pt-numeros sd-numeros">
                <div><dt><Icone nome="fisc-ocorrencias" tamanho={18} /> Ocorrências atendidas</dt><dd>{numero(r.ocorrencias)}</dd></div>
                <div><dt><Icone nome="concluidas" tamanho={18} /> Ocorrências finalizadas</dt><dd>{numero(r.finalizadas)}</dd></div>
                <div><dt><Icone nome="alert-triangle" tamanho={18} /> Intercorrências</dt><dd>{numero(r.intercorrencias)}</dd></div>
                <div><dt><Icone nome="checklist" tamanho={18} /> Checklists realizados</dt><dd>{numero(r.checklists)}</dd></div>
                <div><dt><Icone nome="odometro" tamanho={18} /> KM rodado</dt><dd>{r.km_rodado ? km(r.km_rodado) : "—"}</dd></div>
              </dl>
            </Cartao>

            <Cartao titulo={<><Icone nome="historico" tamanho={18} /> Horários</>}>
              <dl className="pt-numeros sd-numeros">
                <div><dt>Início do serviço</dt><dd>{s.hora_inicio ? hora(s.hora_inicio) : "—"}</dd></div>
                <div><dt>Saída da viatura</dt><dd>{r.saida ? hora(r.saida) : "—"}</dd></div>
                <div><dt>Chegada da viatura</dt><dd>{r.chegada ? hora(r.chegada) : "—"}</dd></div>
                <div><dt>Encerramento do serviço</dt><dd>{s.hora_encerramento ? hora(s.hora_encerramento) : "—"}</dd></div>
                <div><dt>Tempo com a viatura</dt><dd>{duracao(r.saida, r.chegada) || "—"}</dd></div>
              </dl>
            </Cartao>
          </div>

          {s.checklists.some((c) => c.observacoes) && (
            <Cartao titulo={<><Icone nome="documento" tamanho={18} /> Observações do checklist</>}>
              {s.checklists.filter((c) => c.observacoes).map((c) => (
                <p key={c.id_checklist} className="texto-corrido">{c.observacoes}</p>
              ))}
            </Cartao>
          )}
        </>
      )}

      {aba === "equipe" && (
        <Cartao titulo={<><Icone nome="equipe" tamanho={18} /> Fiscais da equipe {s.equipe} no dia</>}
                acao={<VerTodos texto="Ver equipe" aoClicar={() => navegar(`/fiscalizacao/equipes/${s.id_equipe}`)} />}>
          <Tabela linhas={s.fiscais} colunas={COL_FISCAL} aoAbrir={abrirFiscal} vazio="Nenhum fiscal na equipe nesse dia." />
        </Cartao>
      )}
      {aba === "ocorrencias" && (
        <Cartao titulo={<><Icone nome="fisc-ocorrencias" tamanho={18} /> Ocorrências atendidas no serviço</>}>
          <Tabela linhas={s.ocorrencias} colunas={COL_OCORRENCIA} aoAbrir={abrirOcorrencia}
                  vazio="A equipe não atendeu ocorrência neste serviço." />
        </Cartao>
      )}
      {aba === "checklists" && (
        <Cartao titulo={<><Icone nome="checklist" tamanho={18} /> Checklists da viatura no serviço</>}>
          <Tabela linhas={s.checklists} colunas={COL_CHECKLIST} aoAbrir={abrirChecklist}
                  vazio="A equipe ainda não fez o checklist da viatura neste serviço." />
        </Cartao>
      )}
      {aba === "historico" && (
        <Cartao titulo={<><Icone nome="historico" tamanho={18} /> Histórico do serviço</>}>
          <Tabela linhas={historico} vazio="Nenhuma movimentação registrada."
                  colunas={[
                    { rotulo: "Data", render: (e) => quandoTexto(e.quando) },
                    { rotulo: "O que aconteceu", render: (e) => <strong>{e.titulo}</strong> },
                    { rotulo: "Detalhes", classe: "coluna-flexivel", render: (e) => <span className="celula-cortada" title={e.texto}>{e.texto || "—"}</span> },
                  ]} />
        </Cartao>
      )}

      {editando && (
        <JanelaServico idServico={s.id_servico_diario} aoFechar={() => setEditando(false)} aoSalvar={recarregar} />
      )}
      {modalSenha}
    </div>
  );
}
