/**
 * ViaturaDetalhe.jsx - Detalhes da Viatura (Fiscalizacao).
 *
 * 29/10 (desenho do Cesar): a mesma tela dos Detalhes do Veiculo do Frotas.
 *   Topo          TopoVeiculo (foto, placa, dados e Informacoes rapidas)
 *   Visao Geral   Informacoes da Viatura, Situacao e Controle, Equipamentos
 *                 da Viatura (os cadastrados nela), Observacoes e, a direita,
 *                 Ultimo Checklist, Ultima Manutencao, Ultima Ocorrencia e
 *                 Documentos
 *   Abas de lista Manutencoes, Ocorrencias, Sinistros e Documentos no
 *                 desenho das abas do veiculo (AbasVeiculo.jsx): busca,
 *                 situacao, Acoes, detalhes ao lado e fotos/documentos
 *                 embaixo. Checklists com o Detalhes do Checklist ao lado,
 *                 como nos Detalhes do Fiscal.
 *
 * Tudo vem de /fiscalizacao/viaturas/:id/ficha. Sinistros e documentos sao do
 * Frotas: o link para a tela deles so aparece para quem ve o Frotas.
 */
import { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import Selo from "../../components/Selo.jsx";
import QrCodeVeiculo from "../../components/QrCodeVeiculo.jsx";
import FormularioVeiculo from "../../components/FormularioVeiculo.jsx";
import TopoVeiculo from "../../components/TopoVeiculo.jsx";
import ListaResumo from "../../components/ListaResumo.jsx";
import PainelChecklist from "../../components/PainelChecklist.jsx";
import FiltroPeriodo, { dentroDoPeriodo } from "../../components/FiltroPeriodo.jsx";
import AbaSinistros from "../../components/AbaSinistros.jsx";
import { AbaManutencoesVeiculo, AbaDocumentosVeiculo, AbaOcorrenciasViatura } from "../../components/AbasVeiculo.jsx";
import { Tabela, Abas } from "../../components/FichaTabela.jsx";
import { api, apiArquivo } from "../../lib/api.js";
import { data, dinheiro, hora, numero, numeroOs, rotulo } from "../../lib/formato.js";
import { vinculo } from "../../lib/vinculos.js";
import { useSessao } from "../../lib/sessao.jsx";

const BASE = "/fiscalizacao/viaturas";
const vazio = (v) => (v === null || v === undefined || v === "" ? "—" : v);
const TIPO_OCORRENCIA = { QRU: "QRU", PROGRAMADA: "Programada" };
/** Tipo do veiculo pelo rotulo do sistema; fora da lista, so a primeira maiuscula. */
const tipoVeiculo = (t) => { const r = rotulo("tipoVeiculo", t); return r === t && t ? t.charAt(0) + t.slice(1).toLowerCase() : r; };
const kmTexto = (n) => (n === null || n === undefined ? "—" : `${numero(n)} km`);


/** Icone de cada equipamento da viatura, pelo nome cadastrado. */
const ICONES_EQUIPAMENTO = [
  [/macaco/, "eq-macaco"], [/estepe/, "eq-estepe"], [/tri[aâ]ngulo/, "eq-triangulo"],
  [/chave/, "eq-chave-roda"], [/cone/, "eq-cone"], [/pantogr/, "eq-pantografica"],
  [/cavalete/, "eq-cavalete"], [/barreira/, "eq-barreira"], [/r[aá]dio/, "eq-radio"], [/extintor/, "eq-extintor"],
];
const iconeEquipamento = (nome) => {
  const n = String(nome || "").toLowerCase();
  return (ICONES_EQUIPAMENTO.find(([re]) => re.test(n)) || [null, "camadas"])[1];
};

export default function ViaturaDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const { podeVer } = useSessao();
  const [v, setV] = useState(null);
  const [erro, setErro] = useState("");
  const [recarga, setRecarga] = useState(0);
  const [editando, setEditando] = useState(false);
  const [periodoCk, setPeriodoCk] = useState({ de: "", ate: "" });
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
  const veFrotas = podeVer("FROTAS_VISUALIZAR");
  const recarregar = () => setRecarga((n) => n + 1);
  const ck = r.ultimo_checklist;
  const os = v.manutencoes[0] || null;
  const oc = v.ocorrencias[0] || null;

  const abrirChecklist = (c) => navegar(`/fiscalizacao/checklists/${c.id_checklist}`);
  const abrirOs = (o) => navegar(`/fiscalizacao/manutencoes/${o.id_os}`);
  const abrirOcorrencia = (o) => navegar(`/fiscalizacao/ocorrencias/${o.id_ocorrencia}`);
  const abrirSinistro = veFrotas ? (x) => navegar(`/frotas/sinistros/${x.id_sinistro}`) : undefined;

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

  // ----- Visao Geral -----
  const docsAtivos = v.documentos.filter((d) => d.status !== "INATIVO");
  const docDa = (categoria) => docsAtivos.find((d) => d.categoria === categoria) || null;
  const licenciamento = docDa("Licenciamento");
  const seguro = docDa("Seguro");
  const ipva = docDa("Imposto") || docsAtivos.find((d) => /ipva/i.test(d.tipo_documento || "")) || null;
  const seloPrazo = (d) => {
    if (!d || d.dias_para_vencer == null) return null;
    if (d.dias_para_vencer < 0) return <Selo texto="Vencido" tom="vermelho" />;
    if (d.dias_para_vencer <= 30) return <Selo texto={`Em ${d.dias_para_vencer} dias`} tom="laranja" />;
    if (d.dias_para_vencer <= 90) return <Selo texto={`Em ${d.dias_para_vencer} dias`} tom="amarelo" />;
    return <Selo texto="Em dia" tom="verde" />;
  };
  const emUso = ck && ck.status === "ABERTO";
  const situacaoTexto = {
    DISPONIVEL: emUso && ck.equipe ? `Em uso pela ${ck.equipe}` : "Em operação",
    EM_USO: ck?.equipe ? `Em uso pela ${ck.equipe}` : "Em uso",
    EM_MANUTENCAO: "Na oficina",
    INATIVO: "Fora de operação",
  }[v.status] || "—";
  const equipamentos = v.equipamentos || [];

  // ----- Colunas das abas -----
  const COL_CHECKLIST = [
    { rotulo: "Data / Hora", render: (c) => <strong>{data(c.data_abertura)} {c.hora_saida ? hora(c.hora_saida) : ""}</strong> },
    { rotulo: "Equipe", render: (c) => vazio(c.equipe) },
    { rotulo: "Fiscais", render: (c) => <span className="sd-local" title={c.fiscais || ""}>{vazio(c.fiscais)}</span> },
    { rotulo: "Saída (hora / KM)", render: (c) => (
      <span className="celula-dupla"><strong>{hora(c.hora_saida)}</strong><span>{numero(c.odometro_saida)} km</span></span>
    ) },
    { rotulo: "Chegada (hora / KM)", render: (c) => (c.odometro_chegada == null ? "—" : (
      <span className="celula-dupla"><strong>{hora(c.hora_chegada)}</strong><span>{numero(c.odometro_chegada)} km</span></span>
    )) },
    { rotulo: "KM rodado", render: (c) => (c.km_rodado != null ? kmTexto(c.km_rodado) : "—") },
    { rotulo: "Situação", render: (c) => <Selo valor={c.status} /> },
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

  const checklistsNoPeriodo = v.checklists.filter((c) => dentroDoPeriodo(c.data_abertura, periodoCk.de, periodoCk.ate));
  const verDetalhes = (aoClicar) => (
    <button className="botao botao--pequeno vd-cartao-acao" onClick={aoClicar}>Ver detalhes</button>
  );

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

      <TopoVeiculo v={v} proximaInspecao={r.proxima_inspecao} proximaManutencao={r.proxima_manutencao}
                   podeEditar={podeEditar} aoEditar={() => setEditando(true)} />

      <Abas abas={ABAS} ativa={aba} aoMudar={setAba} />

      {aba === "geral" && (
        <div className="vd2-corpo">
          <div className="vd2-corpo__principal">
            <div className="vd2-linha">
              <Cartao titulo={<><Icone nome="informacao" tamanho={18} /> Informações da Viatura</>}>
                <dl className="vd2-campos">
                  {[
                    ["Placa", v.placa], ["Marca", v.marca], ["Modelo", v.modelo],
                    ["Ano de fabricação", v.ano_fabricacao], ["Ano modelo", v.ano_modelo],
                    ["Tipo", tipoVeiculo(v.tipo_veiculo)],
                    ["Cor", v.cor], ["Combustível", v.tipo_combustivel ? rotulo("combustivel", v.tipo_combustivel) : null],
                    ["Renavam", v.renavam], ["Chassi", v.chassi], ["Capacidade", v.capacidade], ["Setor", v.setor],
                    ["Vínculo", v.vinculo ? vinculo(v.vinculo) : null], ["Quilometragem atual", kmTexto(v.quilometragem_atual)],
                    ["Equipe (último checklist)", r.equipe_atual?.numero],
                  ].map(([rot, val]) => (
                    <div key={rot}><dt>{rot}</dt><dd>{vazio(val)}</dd></div>
                  ))}
                </dl>
              </Cartao>

              <Cartao titulo={<><Icone nome="calendario-check" tamanho={18} /> Situação e Controle</>}>
                <dl className="vd2-controle">
                  <div><dt>Status</dt><dd><Selo valor={v.status} /></dd></div>
                  <div><dt>Situação</dt><dd>{situacaoTexto}</dd></div>
                  <div><dt>Último checklist</dt><dd>{ck ? `${data(ck.data_abertura)} ${ck.hora_saida ? hora(ck.hora_saida) : ""}` : "—"}</dd></div>
                  <div><dt>Próxima inspeção</dt><dd>{r.proxima_inspecao ? data(r.proxima_inspecao) : "—"}</dd></div>
                  <div><dt>Próxima manutenção</dt><dd>{r.proxima_manutencao ? data(r.proxima_manutencao) : "—"}</dd></div>
                  <div>
                    <dt>Próximo licenciamento</dt>
                    <dd>{licenciamento?.data_validade ? <>{data(licenciamento.data_validade)} {seloPrazo(licenciamento)}</> : "—"}</dd>
                  </div>
                  <div>
                    <dt>Seguro</dt>
                    <dd>{seguro?.data_validade ? <>Válido até {data(seguro.data_validade)} {seloPrazo(seguro)}</> : "—"}</dd>
                  </div>
                  <div>
                    <dt>IPVA</dt>
                    <dd>{ipva?.data_validade ? <>{data(ipva.data_validade)} {seloPrazo(ipva)}</> : ipva ? "Em dia" : "—"}</dd>
                  </div>
                  <div><dt>Custo manutenção (12 meses)</dt><dd>{dinheiro(r.custo_manutencao_12m || 0)}</dd></div>
                </dl>
              </Cartao>
            </div>

            <Cartao titulo={<><Icone nome="camadas" tamanho={18} /> Equipamentos da Viatura</>}
                    acao={<span className="vd2-nota vd-cartao-acao">Cadastrados na viatura</span>}>
              {equipamentos.length === 0 ? <p className="texto-corrido">Nenhum equipamento cadastrado.</p> : (
                <div className="vd2-equipamentos vd4-equip">
                  {equipamentos.map((e) => (
                    <div className="vd2-equipamento" key={e.id_equipamento}>
                      <Icone nome={iconeEquipamento(e.nome)} tamanho={34} />
                      <div>
                        <strong>{e.nome}</strong>
                        {e.conferencia === "POR_FISCAL" ? <Selo texto="Por fiscal" tom="azul" />
                          : e.conferencia === "OBRIGATORIO" && !(e.quantidade > 0) ? <Selo texto="Obrigatório" tom="azul" />
                          : e.quantidade > 0
                            ? <Selo texto={e.conferencia === "OBRIGATORIO" ? "Presente" : `${numero(e.quantidade)} un.`} tom="verde" />
                            : <Selo texto="Não cadastrado" tom="cinza" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Cartao>

            <Cartao titulo={<><Icone nome="arquivo-texto" tamanho={18} /> Observações</>}>
              <div className="vd2-observacoes">
                <Icone nome="documento" tamanho={20} />
                <p className="texto-quebra">{v.observacoes || "Nenhuma observação registrada."}</p>
                {podeEditar && (
                  <button className="botao botao--pequeno" onClick={() => setEditando(true)}>
                    <Icone nome="editar" tamanho={13} /> Editar
                  </button>
                )}
              </div>
            </Cartao>
          </div>

          <div className="vd2-corpo__lado">
            <Cartao titulo={<><Icone nome="checklist" tamanho={18} /> Último Checklist</>}
                    acao={ck && verDetalhes(() => abrirChecklist(ck))}>
              {!ck ? <p className="texto-corrido">Nenhum checklist registrado.</p> : (
                <div className="vd4-ultck">
                  <div className="vd4-ultck__topo">
                    <strong>{data(ck.data_abertura)} {hora(ck.hora_saida)}{ck.hora_chegada ? ` – ${hora(ck.hora_chegada)}` : ""}</strong>
                    <Selo valor={ck.status} />
                  </div>
                  <dl className="vd-dados__coluna">
                    {[
                      ["Equipe", vazio(ck.equipe)],
                      ["Fiscais", vazio(ck.fiscais)],
                      ["KM saída", kmTexto(ck.odometro_saida)],
                      ["KM chegada", kmTexto(ck.odometro_chegada)],
                      ["KM rodado", kmTexto(ck.km_rodado)],
                    ].map(([rot, valor]) => (
                      <div className="vd-dados__linha" key={rot}><dt>{rot}</dt><dd>{valor}</dd></div>
                    ))}
                  </dl>
                </div>
              )}
            </Cartao>

            <Cartao titulo={<><Icone nome="kpi-wrench" tamanho={18} /> Última Manutenção</>}
                    acao={os && verDetalhes(() => abrirOs(os))}>
              {!os ? <p className="texto-corrido">Nenhuma OS registrada.</p> : (
                <button type="button" className="vd2-ultimo" onClick={() => abrirOs(os)}>
                  <Icone nome="kpi-wrench" tamanho={24} />
                  <div className="vd2-ultimo__info">
                    <strong>{data(os.data_fechamento || os.data_abertura)}</strong>
                    <span>Manutenção {rotulo("tipoOs", os.tipo).toLowerCase()} · {numeroOs(os.numero)}</span>
                    <span className="vd2-ultimo__rotulo">Oficina</span>
                    <span>{vazio(os.oficina)}</span>
                  </div>
                  <div className="vd2-ultimo__lado">
                    <Selo valor={os.status} />
                    <span className="vd2-ultimo__rotulo">Quilometragem</span>
                    <span>{kmTexto(os.quilometragem)}</span>
                  </div>
                  <Icone nome="chevron-right" tamanho={14} />
                </button>
              )}
            </Cartao>

            <Cartao titulo={<><Icone nome="fisc-ocorrencias" tamanho={18} /> Última Ocorrência</>}
                    acao={oc && verDetalhes(() => abrirOcorrencia(oc))}>
              {!oc ? <p className="texto-corrido">Nenhuma ocorrência atendida com esta viatura.</p> : (
                <button type="button" className="vd2-ultimo" onClick={() => abrirOcorrencia(oc)}>
                  <Icone nome="oc-local" tamanho={24} />
                  <div className="vd2-ultimo__info">
                    <strong>{data(oc.data)} {oc.hora ? hora(oc.hora) : ""}</strong>
                    <span>{TIPO_OCORRENCIA[oc.tipo] || oc.tipo} · {vazio(oc.protocolo)}</span>
                    <span className="vd2-ultimo__rotulo">Local</span>
                    <span>{vazio(oc.endereco)}</span>
                  </div>
                  <div className="vd2-ultimo__lado">
                    <Selo valor={oc.status} />
                    <span className="vd2-ultimo__rotulo">Equipe</span>
                    <span>{vazio(oc.equipe)}</span>
                  </div>
                  <Icone nome="chevron-right" tamanho={14} />
                </button>
              )}
            </Cartao>

            <Cartao titulo={<><Icone nome="documentos" tamanho={18} /> Documentos da Viatura</>}
                    acao={<button className="botao botao--pequeno vd-cartao-acao" onClick={() => setAba("documentos")}>Ver todos</button>}>
              {docsAtivos.length === 0 ? <p className="texto-corrido">Nenhum documento cadastrado.</p> : (
                <ul className="vd2-docs">
                  {docsAtivos.slice(0, 3).map((d) => (
                    <li key={d.id_documento}>
                      <Icone nome="documento" tamanho={18} />
                      <button type="button" className="vd2-docs__info" onClick={() => setAba("documentos")}>
                        <strong>{d.tipo_documento}</strong>
                        <span>{d.data_validade
                          ? `${d.dias_para_vencer < 0 ? "Venceu em" : "Válido até"} ${data(d.data_validade)}`
                          : "Não vence"}</span>
                      </button>
                      <Selo valor={d.status} />
                      {d.arquivos > 0 && (
                        <button type="button" className="botao botao--pequeno botao--icone" title="Baixar arquivo"
                                aria-label={`Baixar ${d.tipo_documento}`} onClick={() => baixarDoc(d)}>
                          <Icone nome="baixar" tamanho={13} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
          </div>
        </div>
      )}

      {aba === "qrcode" && <QrCodeVeiculo veiculo={v} aoGerar={recarregar} />}

      {/* Abas de lista (29/10): lista de 10 em 10 e o resumo ao lado, como
          nos Detalhes do Veiculo e do Motorista. */}
      {aba === "checklists" && (
        <ListaResumo classe="sd-checklists"
          titulo={<><Icone nome="checklist" tamanho={18} /> Checklists
            <FiltroPeriodo id="periodo-checklists-viatura" de={periodoCk.de} ate={periodoCk.ate} aoMudar={setPeriodoCk} /></>}
          linhas={checklistsNoPeriodo} colunas={COL_CHECKLIST} chave={(c) => c.id_checklist} unidade="checklists"
          vazio="Nenhum checklist registrado para esta viatura."
          painel={(c, fechar) => <PainelChecklist linha={c} tipo="fiscal" aoFechar={fechar} />} />
      )}

      {aba === "manutencoes" && (
        <AbaManutencoesVeiculo veiculo={v} fiscalizacao podeGerenciar={podeVer("FROTAS_GERENCIAR_OS")} aoMudar={recarregar} />
      )}
      {aba === "ocorrencias" && <AbaOcorrenciasViatura veiculo={v} linhas={v.ocorrencias} />}
      {aba === "sinistros" && (
        <AbaSinistros key={`sin-${recarga}`} idVeiculo={v.id_veiculo} linhas={v.sinistros} podeFrotas={veFrotas}
                      podeGerenciar={veFrotas && podeVer("FROTAS_GERENCIAR_SINISTROS")} />
      )}
      {aba === "documentos" && (
        <AbaDocumentosVeiculo veiculo={v} podeAbrir={veFrotas} podeGerenciar={podeVer("FROTAS_GERENCIAR_DOCUMENTOS")} aoMudar={recarregar} />
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
