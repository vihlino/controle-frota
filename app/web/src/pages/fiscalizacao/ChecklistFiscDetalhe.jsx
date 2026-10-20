/**
 * ChecklistFiscDetalhe.jsx - Detalhes do Checklist da Fiscalizacao (desenho
 * do Cesar, 18/10).
 *
 * Saida e chegada lado a lado (hora, odometro e os equipamentos conferidos),
 * os fiscais, as ocorrencias que a equipe atendeu naquele servico e a
 * pontuacao (so quem gerencia a pontuacao ve).
 *
 * Do desenho saiu o que o checklist da Fiscalizacao nao tem: itens "conforme
 * / nao conforme", fotos, area de atuacao, pontos fiscalizados e percurso.
 * Editar abre a correcao do checklist (senha e justificativa), aqui mesmo.
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
import { CONFIG_CHECKLIST_FISC } from "./ChecklistsFiscalizacao.jsx";

const BASE = "/fiscalizacao/checklists";
const TURNO = { DIURNO: "Diurno", NOTURNO: "Noturno" };
const PAPEL = { FISCAL_1: "Fiscal 1", FISCAL_2: "Fiscal 2" };
const TIPO_OCORRENCIA = { QRU: "QRU", PROGRAMADA: "Programada" };
const ACAO = { CRIAR: "Checklist registrado", EDITAR: "Checklist corrigido", EXCLUIR: "Checklist excluído" };
const qtd = (n) => (n === null || n === undefined ? "—" : numero(n));

function Pontos({ valor }) {
  const n = Number(valor || 0);
  return <strong className="fd-pontos" data-sinal={n > 0 ? "mais" : n < 0 ? "menos" : "zero"}>
    {n > 0 ? "+" : ""}{numero(n, Number.isInteger(n) ? 0 : 1)}
  </strong>;
}

/** Um lado do checklist (saida ou chegada): equipamentos e os numeros. */
function Etapa({ titulo, feito, quando, equipamentos, chave, rodape }) {
  return (
    <Cartao titulo={<><Icone nome="checklist" tamanho={18} /> {titulo}</>}
            acao={feito ? <Selo texto={`Realizado ${quando}`} tom="verde" /> : <Selo texto="Não realizado" tom="cinza" />}>
      <Tabela linhas={equipamentos} vazio="Nenhum equipamento cadastrado."
              colunas={[
                { rotulo: "Item", classe: "coluna-flexivel", render: (e) => <strong>{e.nome}</strong> },
                { rotulo: "Previsto", render: (e) => qtd(e.previsto) },
                { rotulo: "Conferido", render: (e) => (e[chave] === null || e[chave] === undefined
                  ? <span className="texto-apagado">Não conferido</span> : numero(e[chave])) },
                { rotulo: "Observação", render: (e) => e[`obs_${chave}`] || "—" },
              ]} />
      <div className="ck-numeros">
        {rodape.map((r) => (
          <div key={r.rotulo}>
            <Icone nome={r.icone} tamanho={20} />
            <span><small>{r.rotulo}</small><strong>{r.valor}</strong></span>
          </div>
        ))}
      </div>
    </Cartao>
  );
}

export default function ChecklistFiscDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const { podeVer } = useSessao();
  const [c, setC] = useState(null);
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
    api(`/fiscalizacao/checklists/${id}/ficha`).then(setC).catch((e) => setErro(e.message));
  }, [id, recarga]);

  if (erro) return <Cartao><div className="vazio">{erro}</div></Cartao>;
  if (!c) return <div className="carregando">Carregando o checklist...</div>;

  const vePontos = Array.isArray(c.pontuacao);
  const positivos = vePontos ? c.pontuacao.filter((r) => Number(r.pontos_aplicados) > 0).reduce((t, r) => t + Number(r.pontos_aplicados), 0) : 0;
  const negativos = vePontos ? c.pontuacao.filter((r) => Number(r.pontos_aplicados) < 0).reduce((t, r) => t + Number(r.pontos_aplicados), 0) : 0;
  const podeEditar = podeVer("FISCALIZACAO_EDITAR_CHECKLIST");
  const finalizado = c.status === "FINALIZADO";
  const horario = `${c.hora_saida ? hora(c.hora_saida) : "—"} às ${c.hora_chegada ? hora(c.hora_chegada) : "—"}`;

  const ABAS = [
    { chave: "geral", rotulo: "Visão Geral", icone: "checklist" },
    { chave: "ocorrencias", rotulo: "Ocorrências", icone: "fisc-ocorrencias", total: c.ocorrencias.length },
    vePontos && { chave: "pontuacao", rotulo: "Pontuação", icone: "fisc-bolt", total: c.pontuacao.length },
    { chave: "historico", rotulo: "Histórico", icone: "historico" },
  ].filter(Boolean);

  const COL_OCORRENCIA = [
    { rotulo: "Protocolo", render: (o) => o.protocolo || "—" },
    { rotulo: "Horário", render: (o) => (o.hora ? hora(o.hora) : "—") },
    { rotulo: "Tipo", render: (o) => TIPO_OCORRENCIA[o.tipo] || o.tipo },
    { rotulo: "Descrição", classe: "coluna-flexivel", render: (o) => <span className="celula-cortada" title={o.descricao || ""}>{o.descricao || "—"}</span> },
    { rotulo: "Situação", render: (o) => <Selo valor={o.status} /> },
  ];
  const COL_PONTOS = [
    { rotulo: "Data", render: (r) => data(r.data_registro) },
    { rotulo: "Item", classe: "coluna-flexivel", render: (r) => `${r.codigo} - ${r.item}` },
    { rotulo: "Para", render: (r) => r.servidor || (c.equipe ? `Equipe ${c.equipe}` : "—") },
    { rotulo: "Qtd.", render: (r) => numero(r.quantidade) },
    { rotulo: "Pontos", render: (r) => <Pontos valor={r.pontos_aplicados} /> },
  ];
  const abrirOcorrencia = (o) => navegar(`/fiscalizacao/ocorrencias/${o.id_ocorrencia}`);

  return (
    <div className="ficha">
      <div className="cabecalho-pagina vd-cabecalho">
        <div>
          <Trilha itens={[{ rotulo: "Fiscalização" }, { rotulo: "Checklists", para: BASE }, { rotulo: "Detalhes do Checklist" }]} />
          <div className="vd-titulo">
            <span className="vd-titulo__icone"><Icone nome="checklist" tamanho={26} /></span>
            <div>
              <h1>Detalhes do Checklist da Fiscalização</h1>
              <p>Visualize todas as informações do checklist da viatura feito pela equipe de fiscalização.</p>
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
          <span className="sd-avatar eq-avatar" aria-hidden="true"><Icone nome="checklist" tamanho={40} /></span>
          <div className="sd-pessoa__dados">
            <span className="vd-resumo__rotulo">Checklist</span>
            <span className="sd-pessoa__nome"><strong>{data(c.data_abertura)}</strong><Selo valor={c.status} /></span>
            <span className="sd-pessoa__linha">
              {c.equipe ? <>Equipe <strong>{c.equipe}</strong></> : "Sem equipe"}
              {c.servico_data && <>
                <span className="sd-sep">|</span>
                Serviço: <strong>{c.servico_codigo ? `${c.servico_codigo} · ` : ""}{data(c.servico_data)} · {TURNO[c.servico_turno] || c.servico_turno}</strong>
              </>}
            </span>
          </div>
        </div>
        <div className="vd-resumo__grade vd-resumo__grade--4">
          <div className="vd-resumo__coluna">
            <Item rotulo="Viatura">
              <span className="celula-dupla sd-esquerda"><strong>{c.placa}</strong><span>{c.marca} {c.modelo}</span></span>
            </Item>
          </div>
          <div className="vd-resumo__coluna">
            <Item rotulo="Fiscais">
              {c.fiscais.length
                ? <span className="celula-lista sd-esquerda">{c.fiscais.map((f) => <span key={f.id_servidor}>{f.nome}</span>)}</span>
                : "—"}
            </Item>
          </div>
          <div className="vd-resumo__coluna">
            <Item rotulo="Data do checklist">
              <span className="celula-dupla sd-esquerda"><strong>{data(c.data_abertura)}</strong><span>{horario}</span></span>
            </Item>
          </div>
          <div className="vd-resumo__coluna">
            <Item rotulo="KM rodado">{c.km_rodado !== null && c.km_rodado !== undefined ? `${numero(c.km_rodado)} km` : "—"}</Item>
          </div>
        </div>
      </section>

      <Abas abas={ABAS} ativa={aba} aoMudar={setAba} />

      {aba === "geral" && (
        <>
          <div className="ficha-2 ficha-bloco">
            <Etapa titulo="Checklist de Saída" feito chave="saida" equipamentos={c.equipamentos}
                   quando={`em ${data(c.data_abertura)} ${c.hora_saida ? hora(c.hora_saida) : ""}`}
                   rodape={[
                     { icone: "odometro", rotulo: "Hodômetro de saída", valor: `${numero(c.odometro_saida)} km` },
                     { icone: "calendar", rotulo: "Hora da saída", valor: c.hora_saida ? hora(c.hora_saida) : "—" },
                   ]} />
            <Etapa titulo="Checklist de Chegada" feito={finalizado} chave="chegada" equipamentos={c.equipamentos}
                   quando={c.data_finalizacao ? `em ${dataHora(c.data_finalizacao)}` : ""}
                   rodape={[
                     { icone: "odometro", rotulo: "Hodômetro de chegada", valor: c.odometro_chegada != null ? `${numero(c.odometro_chegada)} km` : "—" },
                     { icone: "calendar", rotulo: "Hora da chegada", valor: c.hora_chegada ? hora(c.hora_chegada) : "—" },
                     { icone: "kpi-steering", rotulo: "KM rodado", valor: c.km_rodado != null ? `${numero(c.km_rodado)} km` : "—" },
                   ]} />
          </div>

          <div className="ficha-2 ficha-bloco">
            <div className="ficha-col">
              <Cartao titulo={<><Icone nome="motorista" tamanho={18} /> Fiscais e Serviço</>}>
                <Linhas linhas={[
                  ...c.fiscais.map((f) => [PAPEL[f.tipo] || f.tipo, `${f.nome} (Matrícula: ${f.matricula})`]),
                  ["Equipe", c.equipe],
                  ["Serviço diário", c.servico_data ? (c.id_servico_equipe
                    ? <button type="button" className="pt-nome sd-codigo" onClick={() => navegar(`/fiscalizacao/servico-diario/${c.id_servico_equipe}`)}>
                        {c.servico_codigo} · {data(c.servico_data)} · {TURNO[c.servico_turno] || c.servico_turno}
                      </button>
                    : `${data(c.servico_data)} · ${TURNO[c.servico_turno] || c.servico_turno}`) : null],
                  ["Coordenador", c.coordenador ? `${c.coordenador} (Matrícula: ${c.coordenador_matricula})` : null],
                  ["Observações", c.observacoes],
                ]} />
              </Cartao>
            </div>
            <div className="ficha-col">
              <Cartao titulo={<><Icone nome="fisc-ocorrencias" tamanho={18} /> Ocorrências Registradas</>}
                      acao={c.ocorrencias.length > 5 && (
                        <button type="button" className="botao botao--pequeno vd-cartao-acao" onClick={() => setAba("ocorrencias")}>
                          Ver todas ({c.ocorrencias.length})
                        </button>
                      )}>
                <Tabela linhas={c.ocorrencias.slice(0, 5)} aoAbrir={abrirOcorrencia}
                        colunas={COL_OCORRENCIA.filter((x) => x.rotulo !== "Descrição")}
                        vazio="A equipe não atendeu ocorrência neste serviço." />
              </Cartao>
              {vePontos && (
                <Cartao titulo={<><Icone nome="fisc-bolt" tamanho={18} /> Pontuação da Equipe</>}
                        acao={c.pontuacao.length > 0 && (
                          <button type="button" className="botao botao--pequeno vd-cartao-acao" onClick={() => setAba("pontuacao")}>
                            Ver detalhes
                          </button>
                        )}>
                  <Linhas linhas={[
                    ["Pontos positivos", <Pontos valor={positivos} />],
                    ["Pontos de penalidade", <Pontos valor={negativos} />],
                    ["Pontuação final", <Pontos valor={positivos + negativos} />],
                  ]} />
                </Cartao>
              )}
            </div>
          </div>
        </>
      )}

      {aba === "ocorrencias" && (
        <Cartao titulo={<><Icone nome="fisc-ocorrencias" tamanho={18} /> Ocorrências atendidas pela equipe no serviço</>}>
          <Tabela linhas={c.ocorrencias} colunas={COL_OCORRENCIA} aoAbrir={abrirOcorrencia}
                  vazio="A equipe não atendeu ocorrência neste serviço." />
        </Cartao>
      )}

      {aba === "pontuacao" && vePontos && (
        <Cartao titulo={<><Icone nome="fisc-bolt" tamanho={18} /> Pontuação</>}>
          <Tabela linhas={c.pontuacao} colunas={COL_PONTOS} vazio="Nenhum ponto lançado." />
        </Cartao>
      )}

      {aba === "historico" && (
        <Cartao titulo={<><Icone nome="historico" tamanho={18} /> Histórico do checklist</>}>
          <Tabela linhas={[
            { quando: `${String(c.data_abertura).slice(0, 10)} ${c.hora_saida || ""}`, titulo: "Saída da viatura", texto: `${c.placa} · ${numero(c.odometro_saida)} km` },
            c.data_finalizacao && { quando: String(c.data_finalizacao), titulo: "Chegada da viatura", texto: c.odometro_chegada != null ? `${numero(c.odometro_chegada)} km` : "" },
            ...c.historico.map((h) => ({ quando: String(h.data_hora), titulo: ACAO[h.acao] || h.acao,
              texto: [h.pessoa, h.justificativa].filter(Boolean).join(" · ") })),
          ].filter(Boolean).sort((a, b) => b.quando.localeCompare(a.quando))}
                  vazio="Nenhuma movimentação registrada."
                  colunas={[
                    { rotulo: "Data", render: (e) => (e.quando.slice(11, 16).trim() ? `${data(e.quando.slice(0, 10))} ${e.quando.slice(11, 16)}` : data(e.quando.slice(0, 10))) },
                    { rotulo: "O que aconteceu", render: (e) => <strong>{e.titulo}</strong> },
                    { rotulo: "Detalhes", classe: "coluna-flexivel", render: (e) => <span className="celula-cortada" title={e.texto}>{e.texto || "—"}</span> },
                  ]} />
        </Cartao>
      )}

      {editando && (
        <JanelaCadastro config={CONFIG_CHECKLIST_FISC} id={c.id_checklist}
                        aoFechar={() => setEditando(false)}
                        aoSalvar={() => setRecarga((n) => n + 1)} />
      )}
    </div>
  );
}
