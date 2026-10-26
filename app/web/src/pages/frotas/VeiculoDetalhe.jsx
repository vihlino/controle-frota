/**
 * VeiculoDetalhe.jsx - Detalhes do Veiculo.
 *
 * Modelo do Cesar de 06/10: no topo, o cartao do veiculo (placa, situacao,
 * ano/tipo/setor/uso) e "Informacoes rapidas"; abas Visao geral,
 * QR Code, Checklists, Inspecoes, Manutencoes, Sinistros, Documentos e
 * Historico. A Visao geral tem Informacoes do veiculo, Situacao e controle
 * (licenciamento e seguro vem dos documentos cadastrados), Equipamentos (da
 * conferencia do ultimo checklist), Observacoes e, a direita, o ultimo
 * checklist, a ultima manutencao, a ultima inspecao e os documentos.
 *
 * Fica de fora o que o SITRA nao tem: abastecimento, ocorrencias (so na
 * Fiscalizacao), data de aquisicao, proxima revisao por KM.
 *
 * 26/10 (desenho do Cesar): o cartao do topo ganhou a FOTO do veiculo
 * (cadastrada no Editar, migracao 050), o tipo num selo a direita e um icone
 * em cada dado; "Informacoes Rapidas" com o icone num quadrinho.
 */
import { useEffect, useState } from "react";
import { useOutletContext, useParams, useNavigate, useSearchParams } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import Selo from "../../components/Selo.jsx";
import RegistrarOs from "../../components/RegistrarOs.jsx";
import RegistrarSinistro from "../../components/RegistrarSinistro.jsx";
import FormularioDocumento from "../../components/FormularioDocumento.jsx";
import QrCodeVeiculo from "../../components/QrCodeVeiculo.jsx";
import FormularioVeiculo from "../../components/FormularioVeiculo.jsx";
import FiltroPeriodo from "../../components/FiltroPeriodo.jsx";
import { Lista } from "../ServidorDetalhe.jsx";
import { Equipamentos } from "./Checklists.jsx";
import ListaResumo from "../../components/ListaResumo.jsx";
import { resumoSinistro, resumoInspecao, resumoOs, resumoDocumento, SeloInspecao, FREQUENCIA_INSPECAO } from "../../components/ResumosLista.jsx";
import { api, apiArquivo } from "../../lib/api.js";
import { data, dataHora, dinheiro, hora, numero, rotulo, numeroOs, ROTULOS } from "../../lib/formato.js";
import { vinculo } from "../../lib/vinculos.js";
import { useSessao } from "../../lib/sessao.jsx";

const ORIGEM = {
  CHECKLIST: { texto: "Checklist", tom: "azul", rota: "checklists" },
  INSPECAO: { texto: "Inspeção", tom: "roxo", rota: "inspecoes" },
  MANUTENCAO: { texto: "Manutenção", tom: "amarelo", rota: "manutencoes" },
  SINISTRO: { texto: "Sinistro", tom: "vermelho", rota: "sinistros" },
};


const FREQUENCIA = {
  SEMANAL: "Semanal", QUINZENAL: "Quinzenal", MENSAL: "Mensal",
  PERSONALIZADA: "Personalizada", SEM_PERIODICIDADE: "Sem periodicidade",
};

const vazio = (v) => (v === null || v === undefined || v === "" ? "—" : v);
const primeiraLinha = (t) => String(t || "").split("\n")[0];

function prazo(dias) {
  if (dias === null || dias === undefined) return null;
  if (dias < 0) return { texto: `Vencido há ${Math.abs(dias)} dias`, tom: "vermelho" };
  if (dias === 0) return { texto: "Vence hoje", tom: "vermelho" };
  if (dias <= 30) return { texto: `Em ${dias} dias`, tom: "laranja" };
  return { texto: `Em ${dias} dias`, tom: "verde" };
}

/** Situacao de uma linha do historico (inspecao tem nomes proprios). */
function SeloAtividade({ h }) {
  if (h.origem === "INSPECAO") {
    return h.status === "ABERTA" ? <Selo texto="Pendente" tom="amarelo" /> : <Selo texto="Concluída" tom="verde" />;
  }
  return <Selo valor={h.status} />;
}

/** Rotulo + valor da faixa do topo, com icone (desenho de 26/10). */
function Item({ rotulo: r, icone, children }) {
  return (
    <div className="vd3-dado">
      {icone && <Icone nome={icone} tamanho={16} />}
      <div>
        <span className="vd3-dado__rotulo" title={r}>{r}</span>
        <span className="vd3-dado__valor">{children}</span>
      </div>
    </div>
  );
}

/** Foto do veiculo (ou o quadro vazio). A rota exige o token, por isso blob. */
function FotoVeiculo({ veiculo: v, podeEditar, aoEditar }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    setUrl(null);
    if (!v.foto_em) return undefined;
    let criada = null;
    apiArquivo(`/frotas/veiculos/${v.id_veiculo}/foto?v=${encodeURIComponent(v.foto_em)}`)
      .then((u) => { criada = u; setUrl(u); })
      .catch(() => {});
    return () => { if (criada) URL.revokeObjectURL(criada); };
  }, [v.id_veiculo, v.foto_em]);
  return (
    <div className="vd3-foto">
      {url ? <img src={url} alt={`Foto do veículo ${v.placa}`} /> : (
        <div className="vd3-foto__vazia">
          <Icone nome="kpi-car" tamanho={24} />
          <span>Sem foto</span>
          {podeEditar && (
            <button type="button" className="botao botao--pequeno" onClick={aoEditar}>
              <Icone nome="oc-camera" tamanho={14} /> Adicionar foto
            </button>
          )}
        </div>
      )}
    </div>
  );
}


export default function VeiculoDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const { podeVer } = useSessao();
  const [veiculo, setVeiculo] = useState(null);
  const [resumo, setResumo] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [erro, setErro] = useState("");
  // ?aba=qrcode abre direto numa aba (o endereco antigo da tela de QR Code
  // e o botao "QR Code" da lista de veiculos caem aqui).
  const [parametros, definirParametros] = useSearchParams();
  const aba = parametros.get("aba") || "geral";
  const setAba = (chave) => {
    const p = new URLSearchParams(parametros);
    if (chave === "geral") p.delete("aba"); else p.set("aba", chave);
    definirParametros(p, { replace: true });
  };
  // Editar abre a janela aqui mesmo (08/10), sem ir para a lista de Veiculos.
  const [janela, setJanela] = useState(null); // "os" | "sinistro" | "documento" | "veiculo"
  const [recarga, setRecarga] = useState(0);
  // Cartoes da Visao Geral: o ultimo de cada coisa e os documentos.
  const [ultimos, setUltimos] = useState({});
  const [docs, setDocs] = useState(null);
  // Periodo da aba Checklists (26/10), como na ficha do Motorista.
  const [periodoCk, setPeriodoCk] = useState({ de: "", ate: "" });

  useEffect(() => {
    definirCabecalho({ titulo: "", legenda: "" });
  }, [definirCabecalho]);

  useEffect(() => {
    const primeiro = (r) => (r?.itens || [])[0] || null;
    Promise.all([
      api(`/frotas/checklists?veiculo=${id}&porPagina=5`).then(primeiro).catch(() => null),
      api(`/frotas/manutencoes?veiculo=${id}&porPagina=5`).then(primeiro).catch(() => null),
      api(`/frotas/inspecoes?veiculo=${id}&status=FINALIZADA&porPagina=5`).then(primeiro).catch(() => null),
    ]).then(([checklist, os, inspecao]) => setUltimos({ checklist, os, inspecao }));
    api(`/frotas/documentos?veiculo=${id}&porPagina=50`)
      .then((r) => setDocs(r?.itens || []))
      .catch(() => setDocs([]));
  }, [id, recarga]);

  useEffect(() => {
    api(`/frotas/veiculos/${id}`).then(setVeiculo).catch((e) => setErro(e.message));
    api(`/frotas/veiculos/${id}/resumo`).then(setResumo).catch(() => {});
    api(`/frotas/veiculos/${id}/historico`)
      .then((r) => setHistorico(Array.isArray(r) ? r : []))
      .catch(() => {});
  }, [id, recarga]);

  if (erro) return <Cartao><div className="vazio">{erro}</div></Cartao>;
  if (!veiculo) return <div className="carregando">Carregando o veículo...</div>;

  const v = veiculo;
  const r = resumo || {};
  const podeOs = podeVer("FROTAS_GERENCIAR_OS");
  const podeSinistro = podeVer("FROTAS_GERENCIAR_SINISTROS");
  const podeDoc = podeVer("FROTAS_GERENCIAR_DOCUMENTOS");
  const podeVeiculo = podeVer("FROTAS_GERENCIAR_VEICULOS");
  const podeInspecao = podeVer("FROTAS_REALIZAR_INSPECAO");
  const recarregar = () => setRecarga((n) => n + 1);
  const abrirOrigem = (h) => {
    const o = ORIGEM[h.origem];
    if (o) navegar(`/frotas/${o.rota}/${h.id_registro}`);
  };

  const ABAS = [
    { chave: "geral", rotulo: "Visão Geral", icone: "kpi-car" },
    { chave: "qrcode", rotulo: "QR Code", icone: "codigo-qr" },
    { chave: "checklists", rotulo: "Checklists", icone: "checklist", total: r.checklists },
    { chave: "inspecoes", rotulo: "Inspeções", icone: "inspecao", total: r.inspecoes },
    { chave: "manutencoes", rotulo: "Manutenções", icone: "kpi-wrench", total: r.os_abertas || undefined, totalRotulo: "abertas" },
    { chave: "sinistros", rotulo: "Sinistros", icone: "sinistro", total: r.sinistros },
    { chave: "documentos", rotulo: "Documentos", icone: "documentos", total: r.documentos },
    { chave: "historico", rotulo: "Histórico", icone: "historico" },
  ];


  // ----- Visao Geral (modelo de 06/10) -----
  const EQUIPAMENTOS = [
    { chave: "MACACO", nome: "Macaco", icone: "eq-macaco" },
    { chave: "ESTEPE", nome: "Estepe", icone: "eq-estepe" },
    { chave: "TRIANGULO", nome: "Triângulo", icone: "eq-triangulo" },
    { chave: "CHAVE_RODA", nome: "Chave de roda", icone: "eq-chave-roda" },
  ];
  const ck = ultimos.checklist;
  // A conferencia mais recente de cada equipamento: a da chegada vale mais
  // que a da saida, porque e o estado em que o veiculo ficou.
  const conferencia = (chave) => {
    const lista = (ck?.equipamentos || []).filter((e) => e.equipamento === chave);
    return lista.find((e) => e.momento === "CHEGADA") || lista.find((e) => e.momento === "SAIDA") || null;
  };
  const docsAtivos = (docs || []).filter((d) => d.status !== "INATIVO");
  const docDa = (categoria) => docsAtivos.find((d) => d.categoria === categoria) || null;
  const licenciamento = docDa("Licenciamento");
  const seguro = docDa("Seguro");
  const seloPrazo = (d) => {
    if (!d || d.dias_para_vencer == null) return null;
    if (d.dias_para_vencer < 0) return <Selo texto="Vencido" tom="vermelho" />;
    if (d.dias_para_vencer <= 30) return <Selo texto={`Em ${d.dias_para_vencer} dias`} tom="laranja" />;
    if (d.dias_para_vencer <= 90) return <Selo texto={`Em ${d.dias_para_vencer} dias`} tom="amarelo" />;
    return <Selo texto="Em dia" tom="verde" />;
  };
  const situacaoTexto = {
    DISPONIVEL: "Em operação",
    EM_USO: r.condutor_atual ? `Em uso por ${r.condutor_atual}` : "Em uso",
    EM_MANUTENCAO: "Na oficina",
    INATIVO: "Fora de operação",
  }[v.status] || "—";

  async function baixarDoc(d) {
    try {
      const arquivos = await api(`/frotas/documentos/${d.id_documento}/arquivos`);
      const a = (arquivos || [])[arquivos.length - 1];
      if (!a) {
        navegar(`/frotas/documentos/${d.id_documento}`);
        return;
      }
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

  // Informacoes Rapidas (desenho de 26/10): o icone num quadrinho; a placa
  // em amarelo e o ultimo checklist em verde, como no desenho.
  const rapidas = [
    { icone: "placa", rotulo: "Placa", valor: v.placa, tom: "amarelo" },
    { icone: "arquivo-texto", rotulo: "Renavam", valor: v.renavam },
    { icone: "kpi-steering", rotulo: "Chassi", valor: v.chassi },
    { icone: "paleta", rotulo: "Cor", valor: v.cor },
    { icone: "combustivel", rotulo: "Combustível", valor: v.tipo_combustivel ? rotulo("combustivel", v.tipo_combustivel) : null },
    { icone: "odometro", rotulo: "Quilometragem atual", valor: `${numero(v.quilometragem_atual)} km` },
    { icone: "concluidas", rotulo: "Último checklist", valor: r.ultimo_checklist ? dataHora(r.ultimo_checklist) : null, tom: "verde" },
    { icone: "kpi-wrench", rotulo: "Última manutenção", valor: r.ultima_manutencao ? data(r.ultima_manutencao) : null },
  ];

  return (
    <div className="ficha">
      <div className="cabecalho-pagina vd-cabecalho">
        <div>
          <Trilha
            itens={[
              { rotulo: "Frotas" },
              { rotulo: "Veículos", para: "/frotas/veiculos" },
              { rotulo: "Detalhes do Veículo" },
            ]}
          />
          <div className="vd-titulo">
            <span className="vd-titulo__icone"><Icone nome="kpi-car" tamanho={26} /></span>
            <div>
              <h1>Detalhes do Veículo</h1>
              <p>Visualize todas as informações, histórico e documentos do veículo.</p>
            </div>
          </div>
        </div>
        <div className="cabecalho-pagina__acoes">
          <button className="botao" onClick={() => navegar("/frotas/veiculos")}>
            <Icone nome="seta-esquerda" tamanho={15} /> Voltar
          </button>
          {podeVeiculo && (
            <button className="botao" onClick={() => setJanela("veiculo")}>
              <Icone nome="editar" tamanho={15} /> Editar
            </button>
          )}
        </div>
      </div>

      <div className="vd3-topo">
        <section className="cartao vd3-veiculo">
          <FotoVeiculo veiculo={v} podeEditar={podeVeiculo} aoEditar={() => setJanela("veiculo")} />
          <div className="vd3-veiculo__corpo">
            <div className="vd3-veiculo__linha">
              <div className="vd3-veiculo__placa">
                <strong>{v.placa}</strong>
                <Selo valor={v.status} />
              </div>
              <span className="vd3-tipo">
                <Icone nome="kpi-car" tamanho={13} /> {rotulo("tipoVeiculo", v.tipo_veiculo)}
              </span>
            </div>
            <span className="vd3-veiculo__modelo">{v.marca} {v.modelo}</span>
            <div className="vd3-veiculo__dados">
              <Item icone="calendar" rotulo="Ano de fabricação">{vazio(v.ano_fabricacao)}</Item>
              <Item icone="calendar" rotulo="Ano modelo">{vazio(v.ano_modelo)}</Item>
              <Item icone="organograma" rotulo="Setor">{vazio(v.setor)}</Item>
              <Item icone="camadas" rotulo="Uso">{v.vinculo ? vinculo(v.vinculo) : "—"}</Item>
            </div>
            <div className="vd3-veiculo__dados">
              <Item icone="odometro" rotulo="Odômetro atual">{`${numero(v.quilometragem_atual)} km`}</Item>
              <Item icone="user" rotulo="Condutor atual">{vazio(r.condutor_atual)}</Item>
              <Item icone="calendario-check" rotulo="Próxima inspeção">{r.proxima_inspecao ? data(r.proxima_inspecao) : "—"}</Item>
              <Item icone="kpi-wrench" rotulo="Viatura da fiscalização">{v.viatura ? "Sim" : "Não"}</Item>
            </div>
          </div>
        </section>

        <section className="cartao vd3-rapidas">
          <h2 className="vd3-rapidas__titulo"><Icone nome="arquivo-texto" tamanho={16} /> Informações Rápidas</h2>
          <div className="vd3-rapidas__grade">
            {rapidas.map((x) => (
              <div className="vd3-rapidas__item" key={x.rotulo}>
                <span className="vd3-rapidas__icone" data-tom={x.tom}><Icone nome={x.icone} tamanho={14} /></span>
                <div>
                  <span>{x.rotulo}</span>
                  <strong>{vazio(x.valor)}</strong>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

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
        <div className="vd2-corpo">
          <div className="vd2-corpo__principal">
            <div className="vd2-linha">
              <Cartao titulo="Informações do Veículo">
                <dl className="vd2-campos">
                  {[
                    ["Placa", v.placa], ["Marca", v.marca], ["Modelo", v.modelo],
                    ["Ano de fabricação", v.ano_fabricacao], ["Ano modelo", v.ano_modelo],
                    ["Tipo", rotulo("tipoVeiculo", v.tipo_veiculo)],
                    ["Cor", v.cor], ["Combustível", v.tipo_combustivel ? rotulo("combustivel", v.tipo_combustivel) : null],
                    ["Renavam", v.renavam], ["Chassi", v.chassi], ["Capacidade", v.capacidade], ["Setor", v.setor],
                  ].map(([rot, val]) => (
                    <div key={rot}><dt>{rot}</dt><dd>{vazio(val)}</dd></div>
                  ))}
                </dl>
              </Cartao>

              <Cartao titulo="Situação e Controle">
                <dl className="vd2-controle">
                  <div><dt>Status</dt><dd><Selo valor={v.status} /></dd></div>
                  <div><dt>Situação</dt><dd>{situacaoTexto}</dd></div>
                  <div><dt>Quilometragem atual</dt><dd>{`${numero(v.quilometragem_atual)} km`}</dd></div>
                  <div><dt>Próxima inspeção</dt><dd>{r.proxima_inspecao ? data(r.proxima_inspecao) : "—"}</dd></div>
                  <div>
                    <dt>Próximo licenciamento</dt>
                    <dd>{licenciamento?.data_validade ? <>{data(licenciamento.data_validade)} {seloPrazo(licenciamento)}</> : "—"}</dd>
                  </div>
                  <div>
                    <dt>Seguro</dt>
                    <dd>{seguro?.data_validade ? <>Válido até {data(seguro.data_validade)} {seloPrazo(seguro)}</> : "—"}</dd>
                  </div>
                  <div><dt>OS em aberto</dt><dd>{resumo ? r.os_abertas : "—"}</dd></div>
                  <div><dt>Custo com manutenção</dt><dd>{resumo ? dinheiro(r.custo_manutencao) : "—"}</dd></div>
                </dl>
              </Cartao>
            </div>

            <Cartao
              titulo="Equipamentos do Veículo"
              acao={ck && <span className="vd2-nota vd-cartao-acao">Conferidos no checklist de {data(ck.data_abertura)}</span>}
            >
              <div className="vd2-equipamentos">
                {EQUIPAMENTOS.map((e) => {
                  const c = conferencia(e.chave);
                  return (
                    <div className="vd2-equipamento" key={e.chave}>
                      <Icone nome={e.icone} tamanho={40} />
                      <div>
                        <strong>{e.nome}</strong>
                        {!c ? <Selo texto="Não conferido" tom="cinza" />
                          : c.conforme ? <Selo texto="Presente" tom="verde" />
                            : <Selo texto="Ausente / com problema" tom="vermelho" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Cartao>

            <Cartao titulo="Observações">
              <div className="vd2-observacoes">
                <Icone nome="documento" tamanho={20} />
                <p className="texto-quebra">{v.observacoes || "Nenhuma observação registrada."}</p>
                {podeVeiculo && (
                  <button className="botao botao--pequeno" onClick={() => setJanela("veiculo")}>
                    <Icone nome="editar" tamanho={13} /> Editar
                  </button>
                )}
              </div>
            </Cartao>
          </div>

          <div className="vd2-corpo__lado">
            <Cartao
              titulo="Último Checklist"
              acao={ck && (
                <button className="botao botao--pequeno vd-cartao-acao" onClick={() => navegar(`/frotas/checklists/${ck.id_checklist}`)}>
                  Ver detalhes
                </button>
              )}
            >
              {!ck ? <p className="texto-corrido">Nenhum checklist registrado.</p> : (
                <button type="button" className="vd2-ultimo" onClick={() => navegar(`/frotas/checklists/${ck.id_checklist}`)}>
                  <Icone nome="calendar" tamanho={24} />
                  <div className="vd2-ultimo__info">
                    <strong>{data(ck.data_abertura)} {hora(ck.hora_saida)}</strong>
                    <span>{ck.percurso || "Checklist de saída e chegada"}</span>
                    <span className="vd2-ultimo__rotulo">Responsável</span>
                    <span>{vazio(ck.condutor)}</span>
                  </div>
                  <div className="vd2-ultimo__lado">
                    <Selo valor={ck.status} />
                    <span className="vd2-ultimo__rotulo">KM rodado</span>
                    <span>{ck.km_rodado ? `${numero(ck.km_rodado)} km` : "—"}</span>
                  </div>
                  <Icone nome="chevron-right" tamanho={14} />
                </button>
              )}
            </Cartao>

            <Cartao
              titulo="Última Manutenção"
              acao={ultimos.os && (
                <button className="botao botao--pequeno vd-cartao-acao" onClick={() => navegar(`/frotas/manutencoes/${ultimos.os.id_os}`)}>
                  Ver detalhes
                </button>
              )}
            >
              {!ultimos.os ? <p className="texto-corrido">Nenhuma OS registrada.</p> : (
                <button type="button" className="vd2-ultimo" onClick={() => navegar(`/frotas/manutencoes/${ultimos.os.id_os}`)}>
                  <Icone nome="kpi-wrench" tamanho={24} />
                  <div className="vd2-ultimo__info">
                    <strong>{data(ultimos.os.data_fechamento || ultimos.os.data_abertura)}</strong>
                    <span>Manutenção {rotulo("tipoOs", ultimos.os.tipo).toLowerCase()} · {numeroOs(ultimos.os.numero)}</span>
                    <span className="vd2-ultimo__rotulo">Oficina</span>
                    <span>{vazio(ultimos.os.oficina)}</span>
                  </div>
                  <div className="vd2-ultimo__lado">
                    <Selo valor={ultimos.os.status} />
                    <span className="vd2-ultimo__rotulo">Quilometragem</span>
                    <span>{ultimos.os.quilometragem != null ? `${numero(ultimos.os.quilometragem)} km` : "—"}</span>
                  </div>
                  <Icone nome="chevron-right" tamanho={14} />
                </button>
              )}
            </Cartao>

            <Cartao
              titulo="Última Inspeção"
              acao={ultimos.inspecao && (
                <button className="botao botao--pequeno vd-cartao-acao" onClick={() => navegar(`/frotas/inspecoes/${ultimos.inspecao.id_inspecao}`)}>
                  Ver detalhes
                </button>
              )}
            >
              {!ultimos.inspecao ? <p className="texto-corrido">Nenhuma inspeção realizada.</p> : (
                <button type="button" className="vd2-ultimo" onClick={() => navegar(`/frotas/inspecoes/${ultimos.inspecao.id_inspecao}`)}>
                  <Icone nome="inspecao" tamanho={24} />
                  <div className="vd2-ultimo__info">
                    <strong>{data(ultimos.inspecao.data_realizacao)} {hora(ultimos.inspecao.hora_inicio)}</strong>
                    <span>Inspeção {(FREQUENCIA[ultimos.inspecao.tipo] || "").toLowerCase()} · {ultimos.inspecao.numero}</span>
                    <span className="vd2-ultimo__rotulo">Responsável</span>
                    <span>{vazio(ultimos.inspecao.responsavel)}</span>
                  </div>
                  <div className="vd2-ultimo__lado">
                    {(() => {
                      const a = ROTULOS.analiseInspecao[ultimos.inspecao.analise];
                      return a ? <Selo texto={a.texto} tom={a.tom} /> : null;
                    })()}
                    <span className="vd2-ultimo__rotulo">Itens com ressalva</span>
                    <span>{ultimos.inspecao.itens_com_ressalva || 0}</span>
                  </div>
                  <Icone nome="chevron-right" tamanho={14} />
                </button>
              )}
            </Cartao>

            <Cartao
              titulo="Documentos do Veículo"
              acao={<button className="botao botao--pequeno vd-cartao-acao" onClick={() => setAba("documentos")}>Ver todos</button>}
            >
              {!docs ? <p className="texto-corrido">Carregando...</p>
                : docsAtivos.length === 0 ? <p className="texto-corrido">Nenhum documento cadastrado.</p> : (
                  <ul className="vd2-docs">
                    {docsAtivos.slice(0, 3).map((d) => (
                      <li key={d.id_documento}>
                        <Icone nome="documento" tamanho={18} />
                        <button type="button" className="vd2-docs__info" onClick={() => navegar(`/frotas/documentos/${d.id_documento}`)}>
                          <strong>{d.tipo_documento}</strong>
                          <span>{d.data_validade
                            ? `${d.dias_para_vencer < 0 ? "Venceu em" : "Válido até"} ${data(d.data_validade)}`
                            : "Não vence"}</span>
                        </button>
                        <Selo valor={d.status} />
                        <button type="button" className="botao botao--pequeno botao--icone"
                                title={d.arquivos ? "Baixar arquivo" : "Abrir documento"}
                                aria-label={d.arquivos ? `Baixar ${d.tipo_documento}` : `Abrir ${d.tipo_documento}`}
                                onClick={() => baixarDoc(d)}>
                          <Icone nome={d.arquivos ? "baixar" : "visualizar"} tamanho={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
            </Cartao>
          </div>
        </div>
      )}

      {aba === "qrcode" && <QrCodeVeiculo veiculo={v} aoGerar={recarregar} />}

      {/* Abas de lista com o resumo ao lado e "Abrir em <tela>" (26/10), como
          a aba Sinistros dos Detalhes do Motorista. */}
      {aba === "documentos" && (
        <ListaResumo key={`doc-${recarga}`}
          titulo={<><Icone nome="documentos" tamanho={18} /> Documentos do veículo</>}
          acao={podeDoc && (
            <button className="botao botao--pequeno vd-cartao-acao" onClick={() => setJanela("documento")}>
              <Icone nome="mais" tamanho={13} /> Novo documento
            </button>
          )}
          caminho={`/frotas/documentos?veiculo=${id}`} chave={(d) => d.id_documento} unidade="documentos"
          vazio="Nenhum documento cadastrado para este veículo."
          colunas={[
            { rotulo: "Documento", render: (d) => <strong>{d.tipo_documento}</strong> },
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
            { rotulo: "Situação", render: (d) => <Selo valor={d.status} /> },
          ]}
          resumo={resumoDocumento}
          abrir={{ rotulo: "Abrir em Documentos", destino: (d) => `/frotas/documentos/${d.id_documento}` }} />
      )}

      {/* Igual a aba Checklists dos Detalhes do Motorista (26/10): filtro de
          periodo no titulo, as colunas da tela Checklists (com o Condutor no
          lugar do veiculo) e 10 por pagina com o rodape de contagem. */}
      {aba === "checklists" && (
        <Cartao className="sd-checklists" titulo={<><Icone nome="checklist" tamanho={18} /> Checklists
          <FiltroPeriodo id="periodo-checklists-veiculo" de={periodoCk.de} ate={periodoCk.ate} aoMudar={setPeriodoCk} /></>}>
          <Lista
            caminho={`/frotas/checklists?veiculo=${id}${periodoCk.de ? `&dataDe=${periodoCk.de}` : ""}${periodoCk.ate ? `&dataAte=${periodoCk.ate}` : ""}`}
            unidade="checklists"
            vazio="Nenhum checklist registrado para este veículo."
            aoAbrir={(c) => navegar(`/frotas/checklists/${c.id_checklist}`)}
            colunas={[
              { rotulo: "Enviado em", render: (c) => <strong>{dataHora(c.criado_em)}</strong> },
              { rotulo: "Condutor", render: (c) => vazio(c.condutor) },
              { rotulo: "Saída (hora / KM)", render: (c) => (
                <span className="celula-dupla"><strong>{hora(c.hora_saida)}</strong><span>{numero(c.odometro_saida)} km</span></span>
              ) },
              { rotulo: "Chegada (hora / KM)", render: (c) => (c.odometro_chegada === null || c.odometro_chegada === undefined ? "—" : (
                <span className="celula-dupla"><strong>{hora(c.hora_chegada)}</strong><span>{numero(c.odometro_chegada)} km</span></span>
              )) },
              { rotulo: "Fechado em", render: (c) => (!c.data_finalizacao
                ? <span className="texto-fraco">Em aberto</span>
                : <strong>{dataHora(c.data_finalizacao)}</strong>) },
              { rotulo: "KM rodado", render: (c) => (c.km_rodado === null || c.km_rodado === undefined ? "—" : `${numero(c.km_rodado)} km`) },
              { rotulo: "Equipamentos", render: (c) => <Equipamentos itens={c.equipamentos} /> },
              { rotulo: "Situação", render: (c) => <Selo valor={c.status} /> },
            ]}
          />
        </Cartao>
      )}

      {aba === "inspecoes" && (
        <ListaResumo
          titulo={<><Icone nome="inspecao" tamanho={18} /> Inspeções do veículo</>}
          acao={podeInspecao && (
            <button className="botao botao--pequeno vd-cartao-acao"
                    onClick={() => navegar(`/frotas/inspecoes?agendar=1&veiculo=${id}`)}>
              <Icone nome="mais" tamanho={13} /> Agendar inspeção
            </button>
          )}
          caminho={`/frotas/inspecoes?veiculo=${id}`} chave={(i) => i.id_inspecao} unidade="inspeções"
          vazio="Nenhuma inspeção registrada para este veículo."
          colunas={[
            { rotulo: "Nº", render: (i) => <strong>{vazio(i.numero)}</strong> },
            { rotulo: "Data", render: (i) => data(i.data_realizacao || i.data_programada) },
            { rotulo: "Frequência", render: (i) => FREQUENCIA_INSPECAO[i.tipo] || i.tipo },
            { rotulo: "Responsável", render: (i) => vazio(i.responsavel) },
            { rotulo: "Itens com ressalva", render: (i) => (i.status === "FINALIZADA" ? i.itens_com_ressalva || 0 : "—") },
            { rotulo: "Situação", render: (i) => <SeloInspecao i={i} /> },
          ]}
          resumo={resumoInspecao}
          abrir={{ rotulo: "Abrir em Inspeções", destino: (i) => `/frotas/inspecoes/${i.id_inspecao}` }} />
      )}

      {aba === "manutencoes" && (
        <ListaResumo key={`os-${recarga}`}
          titulo={<><Icone nome="kpi-wrench" tamanho={18} /> Manutenções do veículo</>}
          acao={podeOs && (
            <button className="botao botao--pequeno vd-cartao-acao" onClick={() => setJanela("os")}>
              <Icone nome="mais" tamanho={13} /> Registrar OS
            </button>
          )}
          caminho={`/frotas/manutencoes?veiculo=${id}`} chave={(o) => o.id_os} unidade="ordens de serviço"
          vazio="Nenhuma OS registrada para este veículo."
          colunas={[
            { rotulo: "Nº da OS", render: (o) => <strong>{numeroOs(o.numero)}</strong> },
            { rotulo: "Data", render: (o) => data(o.data_agendada || o.data_abertura) },
            { rotulo: "Tipo", render: (o) => rotulo("tipoOs", o.tipo) },
            { rotulo: "Descrição", render: (o) => (
              <span className="sd-local" title={o.descricao || ""}>{primeiraLinha(o.descricao) || "—"}</span>
            ) },
            { rotulo: "Oficina", render: (o) => vazio(o.oficina) },
            { rotulo: "Custo", render: (o) => (o.custo !== null && o.custo !== undefined ? dinheiro(o.custo) : "—") },
            { rotulo: "Situação", render: (o) => <Selo valor={o.status} /> },
          ]}
          resumo={resumoOs}
          abrir={{ rotulo: "Abrir em Manutenções", destino: (o) => `/frotas/manutencoes/${o.id_os}` }} />
      )}

      {aba === "sinistros" && (
        <ListaResumo key={`sin-${recarga}`}
          titulo={<><Icone nome="sinistro" tamanho={18} /> Sinistros do veículo</>}
          acao={podeSinistro && (
            <button className="botao botao--pequeno vd-cartao-acao" onClick={() => setJanela("sinistro")}>
              <Icone nome="mais" tamanho={13} /> Registrar sinistro
            </button>
          )}
          caminho={`/frotas/sinistros?veiculo=${id}`} chave={(x) => x.id_sinistro} unidade="sinistros"
          vazio="Nenhum sinistro registrado para este veículo."
          colunas={[
            { rotulo: "Nº do Sinistro", render: (x) => <strong>{vazio(x.numero)}</strong> },
            { rotulo: "Data", render: (x) => `${data(x.data)} ${hora(x.hora)}` },
            { rotulo: "Tipo", render: (x) => rotulo("tipoSinistro", x.tipo) },
            { rotulo: "Local", render: (x) => <span className="sd-local" title={x.local || ""}>{vazio(x.local)}</span> },
            { rotulo: "Condutor", render: (x) => vazio(x.condutor) },
            { rotulo: "Situação", render: (x) => <Selo valor={x.status} /> },
          ]}
          resumo={(x) => resumoSinistro(x, { veiculo: false })}
          abrir={{ rotulo: "Abrir em Sinistros", destino: (x) => `/frotas/sinistros/${x.id_sinistro}` }} />
      )}

      {aba === "historico" && (
        <Cartao titulo="Histórico do veículo">
          {historico.length === 0 ? (
            <div className="vazio">Este veículo ainda não tem movimentação registrada.</div>
          ) : (
            <div className="rolagem-x">
              <table className="tabela vd-tabela">
                <thead>
                  <tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Responsável</th><th>Situação</th></tr>
                </thead>
                <tbody>
                  {historico.map((h, i) => {
                    const o = ORIGEM[h.origem] || { texto: h.origem, tom: "azul" };
                    return (
                      <tr key={i} className="vd-tabela__linha" onClick={() => abrirOrigem(h)}>
                        <td>{data(h.data)}</td>
                        <td><span className="vd-tipo" data-tom={o.tom}>{o.texto}</span></td>
                        <td className="coluna-flexivel">
                          <span className="celula-cortada" title={h.titulo}>{primeiraLinha(h.titulo)}</span>
                        </td>
                        <td>{vazio(h.pessoa)}</td>
                        <td><SeloAtividade h={h} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Cartao>
      )}

      {janela === "os" && (
        <RegistrarOs idVeiculo={String(id)} aoFechar={() => setJanela(null)} aoSalvar={recarregar} />
      )}
      {janela === "sinistro" && (
        <RegistrarSinistro idVeiculo={String(id)} aoFechar={() => setJanela(null)} aoSalvar={recarregar} />
      )}
      {janela === "veiculo" && (
        <FormularioVeiculo veiculo={veiculo} aoFechar={() => setJanela(null)} aoSalvar={recarregar} />
      )}
      {janela === "documento" && (
        <FormularioDocumento modo="novo" idVeiculo={String(id)} aoFechar={() => setJanela(null)}
                             aoSalvar={recarregar} />
      )}
    </div>
  );
}
