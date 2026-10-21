/**
 * ViaturaDetalhe.jsx - Detalhes da Viatura (desenho do Cesar, 18/10).
 *
 * Faixa com a identificacao, abas e, na Visao Geral: os cartoes (KM atual,
 * ultimo checklist, proxima manutencao), as informacoes da viatura e os
 * ultimos checklists, manutencoes, ocorrencias e sinistros.
 *
 * Tudo vem de /fiscalizacao/viaturas/:id/ficha. Do desenho saiu o que o SITRA
 * nao tem: foto, prefixo, codigo interno, base operacional, nivel de
 * combustivel e plano de manutencao. Ficaram as abas QR Code e Documentos,
 * que o sistema ja tinha para a viatura.
 */
import { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import Selo from "../../components/Selo.jsx";
import Kpi from "../../components/Kpi.jsx";
import QrCodeVeiculo from "../../components/QrCodeVeiculo.jsx";
import FormularioVeiculo from "../../components/FormularioVeiculo.jsx";
import { Tabela, Abas, VerTodos } from "../../components/FichaTabela.jsx";
import { api, apiArquivo } from "../../lib/api.js";
import { data, dinheiro, diasAte, hora, numero, numeroOs, rotulo } from "../../lib/formato.js";
import { vinculo } from "../../lib/vinculos.js";
import { useSessao } from "../../lib/sessao.jsx";
import { Item, Linhas } from "../ServidorDetalhe.jsx";

const BASE = "/fiscalizacao/viaturas";
const vazio = (v) => (v === null || v === undefined || v === "" ? "—" : v);
const TIPO_OCORRENCIA = { QRU: "QRU", PROGRAMADA: "Programada" };
/** Tipo do veiculo pelo rotulo do sistema; fora da lista, so a primeira maiuscula. */
const tipoVeiculo = (t) => { const r = rotulo("tipoVeiculo", t); return r === t && t ? t.charAt(0) + t.slice(1).toLowerCase() : r; };
const kmTexto = (n) => (n === null || n === undefined ? "—" : `${numero(n)} km`);

/** "Vence em 12 dias" / "Vencido" para a coluna de vencimento. */
function prazo(d) {
  if (d === null || d === undefined) return null;
  if (d < 0) return { texto: "Vencido", tom: "vermelho" };
  if (d <= 30) return { texto: `Em ${d} dias`, tom: "laranja" };
  return null;
}

export default function ViaturaDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const { podeVer } = useSessao();
  const [v, setV] = useState(null);
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
    api(`/fiscalizacao/viaturas/${id}/ficha`).then(setV).catch((e) => setErro(e.message));
  }, [id, recarga]);

  if (erro) return <Cartao><div className="vazio">{erro}</div></Cartao>;
  if (!v) return <div className="carregando">Carregando a viatura...</div>;

  const r = v.resumo || {};
  // 21/10: so o Frotas edita veiculos (viatura tambem); a Fiscalizacao so ve.
  const podeEditar = podeVer("FROTAS_GERENCIAR_VEICULOS");
  const recarregar = () => setRecarga((n) => n + 1);
  const ck = r.ultimo_checklist;

  const abrirChecklist = (c) => navegar(`/fiscalizacao/checklists/${c.id_checklist}`);
  const abrirOs = (o) => navegar(`/fiscalizacao/manutencoes/${o.id_os}`);
  const abrirOcorrencia = (o) => navegar(`/fiscalizacao/ocorrencias/${o.id_ocorrencia}`);
  const abrirSinistro = podeVer("FROTAS_VISUALIZAR") ? (x) => navegar(`/frotas/sinistros/${x.id_sinistro}`) : undefined;

  async function baixarDoc(d) {
    try {
      const arquivos = await api(`/frotas/documentos/${d.id_documento}/arquivos`);
      const a = (arquivos || [])[arquivos.length - 1];
      if (!a) { alert("Este documento não tem arquivo anexado."); return; }
      const url = await apiArquivo(`/frotas/documentos/arquivos/${a.id_arquivo}`);
      const link = document.createElement("a");
      link.href = url;
      link.download = a.nome;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      alert(e.message);
    }
  }

  const ABAS = [
    { chave: "geral", rotulo: "Visão Geral", icone: "fisc-viatura" },
    { chave: "qrcode", rotulo: "QR Code", icone: "codigo-qr" },
    { chave: "checklists", rotulo: "Checklists", icone: "checklist", total: v.checklists.length },
    { chave: "manutencoes", rotulo: "Manutenções", icone: "kpi-wrench", total: v.manutencoes.length },
    { chave: "ocorrencias", rotulo: "Ocorrências", icone: "fisc-ocorrencias", total: v.ocorrencias.length },
    { chave: "sinistros", rotulo: "Sinistros", icone: "sinistro", total: v.sinistros.length },
    { chave: "documentos", rotulo: "Documentos", icone: "documentos", total: v.documentos.length },
    { chave: "historico", rotulo: "Histórico", icone: "historico" },
  ];

  const COL_CHECKLIST = [
    { rotulo: "Data / Hora", render: (c) => `${data(c.data_abertura)} ${c.hora_saida ? hora(c.hora_saida) : ""}` },
    { rotulo: "Equipe", render: (c) => vazio(c.equipe) },
    { rotulo: "Fiscais", classe: "coluna-flexivel", render: (c) => <span className="celula-cortada" title={c.fiscais || ""}>{vazio(c.fiscais)}</span> },
    { rotulo: "KM saída", render: (c) => numero(c.odometro_saida) },
    { rotulo: "KM chegada", render: (c) => (c.odometro_chegada != null ? numero(c.odometro_chegada) : "—") },
    { rotulo: "KM rodado", render: (c) => (c.km_rodado != null ? kmTexto(c.km_rodado) : "—") },
    { rotulo: "Situação", render: (c) => <Selo valor={c.status} /> },
  ];
  const COL_OS = [
    { rotulo: "Nº da OS", render: (o) => numeroOs(o.numero) },
    { rotulo: "Data", render: (o) => data(o.data_fechamento || o.data_agendada || o.data_abertura) },
    { rotulo: "Tipo", render: (o) => rotulo("tipoOs", o.tipo) },
    { rotulo: "Descrição", classe: "coluna-flexivel", render: (o) => <span className="celula-cortada" title={o.descricao || ""}>{vazio(o.descricao)}</span> },
    { rotulo: "KM", render: (o) => (o.quilometragem != null ? numero(o.quilometragem) : "—") },
    { rotulo: "Custo", render: (o) => (o.custo != null ? dinheiro(o.custo) : "—") },
    { rotulo: "Situação", render: (o) => <Selo valor={o.status} /> },
  ];
  const COL_OCORRENCIA = [
    { rotulo: "Data / Hora", render: (o) => `${data(o.data)} ${o.hora ? hora(o.hora) : ""}` },
    { rotulo: "Protocolo", render: (o) => vazio(o.protocolo) },
    { rotulo: "Tipo", render: (o) => TIPO_OCORRENCIA[o.tipo] || o.tipo },
    { rotulo: "Local", classe: "coluna-flexivel", render: (o) => <span className="celula-cortada" title={o.endereco || ""}>{vazio(o.endereco)}</span> },
    { rotulo: "Equipe", render: (o) => vazio(o.equipe) },
    { rotulo: "Situação", render: (o) => <Selo valor={o.status} /> },
  ];
  const COL_SINISTRO = [
    { rotulo: "Nº", render: (x) => vazio(x.numero) },
    { rotulo: "Data", render: (x) => data(x.data) },
    { rotulo: "Tipo", render: (x) => rotulo("tipoSinistro", x.tipo) },
    { rotulo: "Descrição", classe: "coluna-flexivel", render: (x) => <span className="celula-cortada" title={x.descricao || ""}>{vazio(x.descricao)}</span> },
    { rotulo: "Condutor", render: (x) => vazio(x.condutor) },
    { rotulo: "Situação", render: (x) => <Selo valor={x.status} /> },
  ];
  const COL_DOC = [
    { rotulo: "Documento", render: (d) => d.tipo_documento },
    { rotulo: "Categoria", render: (d) => (d.categoria ? <Selo texto={d.categoria} tom="azul" /> : "—") },
    { rotulo: "Nº / Referência", render: (d) => vazio(d.numero_documento) },
    { rotulo: "Vencimento", render: (d) => {
      const p = prazo(d.dias_para_vencer);
      return (
        <span className="celula-dupla">
          <strong>{d.data_validade ? data(d.data_validade) : "Não vence"}</strong>
          {p && <span className={`prazo prazo--${p.tom}`}>{p.texto}</span>}
        </span>
      );
    } },
    { rotulo: "Arquivos", render: (d) => d.arquivos || "—" },
  ];

  // Historico: o que aconteceu com a viatura, do mais novo para o mais antigo.
  const historico = [
    ...v.checklists.map((c) => ({ quando: `${String(c.data_abertura).slice(0, 10)} ${c.hora_saida || ""}`,
      tipo: "Checklist", tom: "azul", texto: `Saída${c.equipe ? ` da ${c.equipe}` : ""}${c.km_rodado != null ? ` · ${numero(c.km_rodado)} km` : ""}`,
      status: c.status, abrir: () => abrirChecklist(c) })),
    ...v.manutencoes.map((o) => ({ quando: String(o.data_abertura), tipo: "Manutenção", tom: "amarelo",
      texto: `${numeroOs(o.numero)} · ${o.descricao || rotulo("tipoOs", o.tipo)}`, status: o.status, abrir: () => abrirOs(o) })),
    ...v.ocorrencias.map((o) => ({ quando: `${String(o.data).slice(0, 10)} ${o.hora || ""}`, tipo: "Ocorrência", tom: "roxo",
      texto: `${o.protocolo || ""} · ${o.endereco || ""}`, status: o.status, abrir: () => abrirOcorrencia(o) })),
    ...v.sinistros.map((x) => ({ quando: `${String(x.data).slice(0, 10)} ${x.hora || ""}`, tipo: "Sinistro", tom: "vermelho",
      texto: x.descricao || rotulo("tipoSinistro", x.tipo), status: x.status, abrir: abrirSinistro && (() => abrirSinistro(x)) })),
    ...v.cadastro.map((a) => ({ quando: String(a.data_hora), tipo: "Cadastro", tom: "cinza",
      texto: `${{ CRIAR: "Cadastro", EDITAR: "Alteração", EXCLUIR: "Exclusão" }[a.acao] || a.acao}${a.pessoa ? ` por ${a.pessoa}` : ""}${a.justificativa ? ` · ${a.justificativa}` : ""}` })),
  ].sort((a, b) => b.quando.localeCompare(a.quando));

  const COL_HISTORICO = [
    { rotulo: "Data", render: (h) => (h.quando.length > 10 && h.quando.slice(11, 16).trim()
      ? `${data(h.quando.slice(0, 10))} ${h.quando.slice(11, 16)}` : data(h.quando.slice(0, 10))) },
    { rotulo: "Tipo", render: (h) => <span className="vd-tipo" data-tom={h.tom}>{h.tipo}</span> },
    { rotulo: "Descrição", classe: "coluna-flexivel", render: (h) => <span className="celula-cortada" title={h.texto}>{h.texto}</span> },
    { rotulo: "Situação", render: (h) => (h.status ? <Selo valor={h.status} /> : "—") },
  ];

  const proxDias = r.proxima_manutencao ? diasAte(r.proxima_manutencao) : null;

  return (
    <div className="ficha">
      <div className="cabecalho-pagina vd-cabecalho">
        <div>
          <Trilha itens={[{ rotulo: "Fiscalização" }, { rotulo: "Viaturas", para: BASE }, { rotulo: "Detalhes da Viatura" }]} />
          <div className="vd-titulo">
            <span className="vd-titulo__icone"><Icone nome="fisc-viatura" tamanho={26} /></span>
            <div>
              <h1>Detalhes da Viatura</h1>
              <p>Visualize todas as informações da viatura, incluindo situação, checklists, manutenções e ocorrências.</p>
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
          <span className="sd-avatar eq-avatar" aria-hidden="true"><Icone nome="fisc-viatura" tamanho={40} /></span>
          <div className="sd-pessoa__dados">
            <span className="vd-resumo__rotulo">Viatura</span>
            <span className="sd-pessoa__nome"><strong>{v.placa}</strong><Selo valor={v.status} /></span>
            <span className="sd-pessoa__linha">
              {v.marca} {v.modelo}
              <span className="sd-sep">|</span>
              {tipoVeiculo(v.tipo_veiculo)}
            </span>
          </div>
        </div>
        <div className="vd-resumo__grade vd-resumo__grade--5">
          <div className="vd-resumo__coluna">
            <Item rotulo="Equipe">
              {r.equipe_atual
                ? <span className="celula-dupla sd-esquerda"><strong>{r.equipe_atual.numero}</strong><span>No último checklist</span></span>
                : "—"}
            </Item>
          </div>
          <div className="vd-resumo__coluna">
            <Item rotulo="Combustível">{v.tipo_combustivel ? rotulo("combustivel", v.tipo_combustivel) : "—"}</Item>
          </div>
          <div className="vd-resumo__coluna">
            <Item rotulo="Quilometragem">{kmTexto(v.quilometragem_atual)}</Item>
          </div>
          <div className="vd-resumo__coluna">
            <Item rotulo="Ano / Modelo">{`${v.ano_fabricacao} / ${v.ano_modelo}`}</Item>
          </div>
          <div className="vd-resumo__coluna">
            <Item rotulo="Uso">{v.vinculo ? vinculo(v.vinculo) : "—"}</Item>
          </div>
        </div>
      </section>

      <Abas abas={ABAS} ativa={aba} aoMudar={setAba} />

      {aba === "geral" && (
        <>
          <div className="kpis vt-kpis">
            <Kpi icone="odometro" rotulo="Quilometragem atual" valor={kmTexto(v.quilometragem_atual)}
                 nota={ck?.data_abertura ? `Último checklist em ${data(ck.data_abertura)}` : "Sem checklist"} />
            <Kpi icone="calendar" rotulo="Último checklist" tom="azul"
                 valor={ck ? `${data(ck.data_abertura)} ${ck.hora_saida ? hora(ck.hora_saida) : ""}` : "—"}
                 nota={ck ? [ck.equipe, ck.fiscais].filter(Boolean).join(" · ") : "Nenhum checklist registrado"} />
            <Kpi icone="kpi-wrench" rotulo="Próxima manutenção" tom={proxDias !== null && proxDias <= 15 ? "ambar" : "neutro"}
                 valor={r.proxima_manutencao ? data(r.proxima_manutencao) : "—"}
                 nota={r.proxima_manutencao ? (proxDias === 0 ? "Hoje" : `Em ${proxDias} dia${proxDias === 1 ? "" : "s"}`) : "Não agendada"} />
          </div>

          <div className="vt-corpo ficha-bloco">
            <Cartao titulo={<><Icone nome="informacao" tamanho={18} /> Informações da Viatura</>}>
              <Linhas linhas={[
                ["Placa", v.placa],
                ["Marca", v.marca],
                ["Modelo", v.modelo],
                ["Ano de fabricação", v.ano_fabricacao],
                ["Ano do modelo", v.ano_modelo],
                ["Tipo", tipoVeiculo(v.tipo_veiculo)],
                ["Cor", v.cor],
                ["Chassi", v.chassi],
                ["Renavam", v.renavam],
                ["Combustível", v.tipo_combustivel ? rotulo("combustivel", v.tipo_combustivel) : null],
                ["Capacidade", v.capacidade],
                ["Setor", v.setor],
                ["Uso", v.vinculo ? vinculo(v.vinculo) : null],
                ["Situação", <Selo valor={v.status} />],
                ["OS em aberto", numero(r.os_abertas)],
                ["Documentos vencidos", numero(r.documentos_vencidos)],
                ["Observações", v.observacoes],
              ]} />
            </Cartao>

            <div className="ficha-col">
              <Cartao titulo={<><Icone nome="checklist" tamanho={18} /> Últimos Checklists</>}
                      acao={<VerTodos total={v.checklists.length} aoClicar={() => setAba("checklists")} />}>
                <Tabela linhas={v.checklists.slice(0, 5)} aoAbrir={abrirChecklist}
                        colunas={COL_CHECKLIST.filter((c) => !["Fiscais", "KM rodado"].includes(c.rotulo))}
                        vazio="Nenhum checklist registrado." />
              </Cartao>
              <Cartao titulo={<><Icone nome="kpi-wrench" tamanho={18} /> Últimas Manutenções</>}
                      acao={<VerTodos total={v.manutencoes.length} texto="Ver todas" aoClicar={() => setAba("manutencoes")} />}>
                <Tabela linhas={v.manutencoes.slice(0, 5)} aoAbrir={abrirOs}
                        colunas={COL_OS.filter((c) => !["Nº da OS", "Custo"].includes(c.rotulo))}
                        vazio="Nenhuma manutenção registrada." />
              </Cartao>
            </div>

            <div className="ficha-col">
              <Cartao titulo={<><Icone nome="alert-triangle" tamanho={18} /> Últimas Ocorrências</>}
                      acao={<VerTodos total={v.ocorrencias.length} texto="Ver todas" aoClicar={() => setAba("ocorrencias")} />}>
                <Tabela linhas={v.ocorrencias.slice(0, 5)} aoAbrir={abrirOcorrencia}
                        colunas={COL_OCORRENCIA.filter((c) => !["Protocolo", "Equipe"].includes(c.rotulo))}
                        vazio="Nenhuma ocorrência atendida com esta viatura." />
              </Cartao>
              <Cartao titulo={<><Icone nome="sinistro" tamanho={18} /> Últimos Sinistros</>}
                      acao={<VerTodos total={v.sinistros.length} aoClicar={() => setAba("sinistros")} />}>
                <Tabela linhas={v.sinistros.slice(0, 5)} aoAbrir={abrirSinistro}
                        colunas={COL_SINISTRO.filter((c) => !["Nº", "Condutor"].includes(c.rotulo))}
                        vazio="Nenhum sinistro registrado." />
              </Cartao>
            </div>
          </div>
        </>
      )}

      {aba === "qrcode" && <QrCodeVeiculo veiculo={v} aoGerar={recarregar} />}

      {aba === "checklists" && (
        <Cartao titulo={<><Icone nome="checklist" tamanho={18} /> Checklists da viatura</>}>
          <Tabela linhas={v.checklists} colunas={COL_CHECKLIST} aoAbrir={abrirChecklist} vazio="Nenhum checklist registrado." />
        </Cartao>
      )}
      {aba === "manutencoes" && (
        <Cartao titulo={<><Icone nome="kpi-wrench" tamanho={18} /> Manutenções da viatura</>}>
          <Tabela linhas={v.manutencoes} colunas={COL_OS} aoAbrir={abrirOs} vazio="Nenhuma manutenção registrada." />
        </Cartao>
      )}
      {aba === "ocorrencias" && (
        <Cartao titulo={<><Icone nome="fisc-ocorrencias" tamanho={18} /> Ocorrências atendidas</>}>
          <Tabela linhas={v.ocorrencias} colunas={COL_OCORRENCIA} aoAbrir={abrirOcorrencia} vazio="Nenhuma ocorrência atendida com esta viatura." />
        </Cartao>
      )}
      {aba === "sinistros" && (
        <Cartao titulo={<><Icone nome="sinistro" tamanho={18} /> Sinistros da viatura</>}>
          <Tabela linhas={v.sinistros} colunas={COL_SINISTRO} aoAbrir={abrirSinistro} vazio="Nenhum sinistro registrado." />
        </Cartao>
      )}
      {aba === "documentos" && (
        <Cartao titulo={<><Icone nome="documentos" tamanho={18} /> Documentos da viatura</>}>
          <Tabela linhas={v.documentos} colunas={COL_DOC} aoAbrir={baixarDoc} vazio="Nenhum documento cadastrado." />
          <p className="vd2-nota" style={{ marginTop: 10 }}>Clique no documento para baixar o arquivo. Cadastrar e renovar documentos é com o Frotas.</p>
        </Cartao>
      )}
      {aba === "historico" && (
        <Cartao titulo={<><Icone nome="historico" tamanho={18} /> Histórico da viatura</>}>
          <Tabela linhas={historico} colunas={COL_HISTORICO} aoAbrir={(h) => h.abrir?.()}
                  vazio="Esta viatura ainda não tem movimentação registrada." />
        </Cartao>
      )}

      {editando && (
        <FormularioVeiculo veiculo={v} soViatura aoFechar={() => setEditando(false)} aoSalvar={recarregar} />
      )}
    </div>
  );
}
