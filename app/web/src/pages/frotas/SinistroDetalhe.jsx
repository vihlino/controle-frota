/**
 * SinistroDetalhe.jsx - Detalhes do Sinistro.
 *
 * Desenho do Cesar (06/10), o mais parecido possivel, no padrao das telas de
 * detalhes: faixa do veiculo, abas (Visao geral, Fotos, Documentos,
 * Envolvidos, Veiculo, Providencias, Historico) e cartoes. "Envolvidos" e os
 * "Custos estimados" (orcamento) vem da migracao 035.
 *
 * Fica de fora o que o SITRA nao tem: condicoes climaticas. "Ver no mapa"
 * abre o endereco no Google Maps.
 *
 * 29/10 (desenho do Cesar): faixa do veiculo com a foto; Fotos em cartoes com
 * a caixa de arrastar; Documentos, Envolvidos, Veiculo e Providencias como
 * lista com o detalhe ao lado (AbaRegistros). O SITRA nao guarda tipo,
 * responsavel e situacao de cada providencia: cada linha do texto
 * "Providencias tomadas" vira um item. Os envolvidos e as providencias se
 * editam no Editar do sinistro.
 */
import { useEffect, useRef, useState } from "react";
import { useOutletContext, useParams, useNavigate, useSearchParams } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import Selo from "../../components/Selo.jsx";
import RegistrarSinistro, { TIPOS_ENVOLVIDO, SITUACOES_ENVOLVIDO } from "../../components/RegistrarSinistro.jsx";
import ArquivosAnexados from "../../components/ArquivosAnexados.jsx";
import FaixaVeiculo, { useFotoVeiculo } from "../../components/FaixaVeiculo.jsx";
import AbaRegistros from "../../components/AbaRegistros.jsx";
import HistoricoAuditoria from "../../components/HistoricoAuditoria.jsx";
import { useArquivos } from "../../components/useArquivos.js";
import { api } from "../../lib/api.js";
import { data, dataHora, dinheiro, hora, numero, rotulo } from "../../lib/formato.js";
import { tamanhoArquivo } from "../../lib/arquivos.js";
import { useSessao } from "../../lib/sessao.jsx";
import { TOM_TIPO_SINISTRO } from "./Sinistros.jsx";

const vazio = (v) => (v === null || v === undefined || v === "" ? "—" : v);
const ORDEM = { ABERTO: 0, EM_ANALISE: 1, RESOLVIDO: 2, ENCERRADO: 3 };
const nomeTipo = (t) => TIPOS_ENVOLVIDO.find((x) => x.valor === t)?.rotulo || t;
function SeloSituacao({ valor }) {
  const s = SITUACOES_ENVOLVIDO.find((x) => x.valor === valor);
  return s ? <Selo texto={s.rotulo} tom={s.tom} /> : <span>—</span>;
}

function Item({ rotulo: r, children }) {
  return (
    <div className="vd-resumo__item">
      <span className="vd-resumo__rotulo">{r}</span>
      <span className="vd-resumo__valor">{children}</span>
    </div>
  );
}

function Linhas({ linhas }) {
  return (
    <dl className="vd-dados__coluna">
      {linhas.map(([r, v]) => (
        <div className="vd-dados__linha" key={r}><dt>{r}</dt><dd>{vazio(v)}</dd></div>
      ))}
    </dl>
  );
}

/** Tabela de envolvidos: o condutor da frota primeiro, depois os demais. */
function TabelaEnvolvidos({ s }) {
  const linhas = [
    { envolvido: "Condutor (veículo SITRA)", pessoa: s.condutor, extra: s.condutor_matricula ? `Matrícula ${s.condutor_matricula}` : null,
      situacao: s.situacao_condutor, contato: s.condutor_telefone },
    ...(s.envolvidos || []).map((e) => ({
      envolvido: nomeTipo(e.tipo),
      pessoa: e.tipo === "OUTRO_VEICULO" && (e.placa || e.modelo) ? [e.placa, e.modelo].filter(Boolean).join(" · ") : e.nome,
      extra: e.tipo === "OUTRO_VEICULO" && (e.placa || e.modelo) ? e.nome : null,
      situacao: e.situacao, contato: e.contato,
    })),
  ];
  return (
    <div className="rolagem-x">
      <table className="tabela vd-tabela tabela-ficha tabela-envolvidos">
        <thead><tr><th>Envolvido</th><th>Pessoa / Veículo</th><th>Situação</th><th>Contato</th></tr></thead>
        <tbody>
          {linhas.map((l, n) => (
            <tr key={n}>
              <td>{l.envolvido}</td>
              <td>
                <span className="celula-dupla">
                  <strong>{vazio(l.pessoa)}</strong>
                  {l.extra && <span>{l.extra}</span>}
                </span>
              </td>
              <td><SeloSituacao valor={l.situacao} /></td>
              <td>{vazio(l.contato)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Detalhes do veiculo envolvido (o da frota, com a foto, ou o de terceiro). */
function PainelVeiculoSinistro({ v, s, veiculo, fechar, podeEditar, aoEditar, aoAbrir }) {
  const foto = useFotoVeiculo(v.sitra ? s.id_veiculo : null, v.sitra ? veiculo?.foto_em : null);
  return (
    <div className="pck">
      <header className="pck-topo">
        <h3><Icone nome="kpi-car" tamanho={18} /> Detalhes do Veículo</h3>
        <span className="as-topo-acoes">
          {podeEditar && <button type="button" className="botao botao--pequeno" onClick={aoEditar}><Icone nome="editar" tamanho={13} /> Editar</button>}
          <button type="button" className="sd-sinistro-resumo__fechar" aria-label="Fechar" onClick={fechar}>×</button>
        </span>
      </header>
      <div className="pck-linha"><strong className="sv-placa">{vazio(v.placa)}</strong><Selo texto={v.sitra ? "Veículo SITRA" : "Terceiro"} tom={v.sitra ? "azul" : "cinza"} /></div>
      {v.sitra && (
        <div className="pck-veiculo">
          <span className="pck-veiculo__foto">{foto ? <img src={foto} alt="" /> : <Icone nome="kpi-car" tamanho={26} />}</span>
          <span className="pck-veiculo__textos"><strong>{v.modelo}</strong>
            <span>{[v.tipo, s.tipo_combustivel && rotulo("combustivel", s.tipo_combustivel), s.ano_fabricacao && `${s.ano_fabricacao} / ${s.ano_modelo}`].filter(Boolean).join(" • ")}</span></span>
        </div>
      )}
      <dl className="pd-grade pd-grade--icones">
        <div><dt><Icone nome="placa" tamanho={14} /> Placa</dt><dd>{vazio(v.placa)}</dd></div>
        <div><dt><Icone nome="kpi-car" tamanho={14} /> Modelo</dt><dd>{vazio(v.modelo)}</dd></div>
        {v.sitra ? (
          <>
            <div><dt><Icone nome="camadas" tamanho={14} /> Tipo</dt><dd>{vazio(v.tipo)}</dd></div>
            <div><dt><Icone nome="paleta" tamanho={14} /> Cor</dt><dd>{vazio(veiculo?.cor)}</dd></div>
            <div><dt><Icone nome="predio" tamanho={14} /> Proprietário</dt><dd>{vazio(v.proprietario)}</dd></div>
            <div><dt><Icone nome="arquivo-texto" tamanho={14} /> Renavam</dt><dd>{vazio(veiculo?.renavam)}</dd></div>
            <div><dt><Icone nome="kpi-steering" tamanho={14} /> Chassi</dt><dd>{vazio(veiculo?.chassi)}</dd></div>
            <div><dt><Icone nome="odometro" tamanho={14} /> Odômetro</dt><dd>{s.quilometragem_atual != null ? `${numero(s.quilometragem_atual)} km` : "—"}</dd></div>
          </>
        ) : (
          <>
            <div><dt><Icone nome="user" tamanho={14} /> Condutor</dt><dd>{vazio(v.proprietario)}</dd></div>
            <div><dt><Icone nome="telefone" tamanho={14} /> Contato</dt><dd>{vazio(v.contato)}</dd></div>
          </>
        )}
      </dl>
      <section className="pck-bloco">
        <h4><Icone nome="arquivo-texto" tamanho={16} /> Observações</h4>
        <p className={`pck-obs${v.observacao || v.sitra ? "" : " pck-obs--vazia"}`}>{v.sitra ? "Veículo oficial da frota SITRA." : (v.observacao || "Nenhuma observação registrada.")}</p>
      </section>
      {v.sitra && (
        <button type="button" className="lr-abrir" onClick={aoAbrir}>Abrir em Veículos <Icone nome="seta-direita" tamanho={13} monocromatico /></button>
      )}
    </div>
  );
}

export default function SinistroDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const { podeVer } = useSessao();
  const [sinistro, setSinistro] = useState(null);
  const [erro, setErro] = useState("");
  const [recarga, setRecarga] = useState(0);
  const [editando, setEditando] = useState(false);
  const [veiculo, setVeiculo] = useState(null);
  const [parametros, definirParametros] = useSearchParams();
  const aba = parametros.get("aba") || "geral";
  const setAba = (chave) => {
    const p = new URLSearchParams(parametros);
    if (chave === "geral") p.delete("aba"); else p.set("aba", chave);
    definirParametros(p, { replace: true });
  };
  const entradaFoto = useRef(null);
  const entradaDoc = useRef(null);
  const anexos = useArquivos(`/frotas/sinistros/${id}/arquivos`, "/frotas/sinistros/arquivos", recarga);

  useEffect(() => {
    definirCabecalho({ titulo: "", legenda: "" });
  }, [definirCabecalho]);

  useEffect(() => {
    api(`/frotas/sinistros/${id}`).then(setSinistro).catch((e) => setErro(e.message));
  }, [id, recarga]);

  const idVeiculo = sinistro?.id_veiculo;
  useEffect(() => {
    if (!idVeiculo) return;
    api(`/frotas/veiculos/${idVeiculo}`).then(setVeiculo).catch(() => {});
  }, [idVeiculo]);

  if (erro) return <Cartao><div className="vazio">{erro}</div></Cartao>;
  if (!sinistro) return <div className="carregando">Carregando o sinistro...</div>;

  const s = sinistro;
  const podeGerenciar = podeVer("FROTAS_GERENCIAR_SINISTROS");
  const fotos = (anexos.arquivos || []).filter((a) => a.tipo.startsWith("image/"));
  const docs = (anexos.arquivos || []).filter((a) => !a.tipo.startsWith("image/"));
  const recarregar = () => setRecarga((n) => n + 1);
  const enviarDe = (e) => { anexos.enviar(e.target.files); e.target.value = ""; };
  const envolvidosTotal = 1 + (s.envolvidos || []).length;

  const ordem = ORDEM[s.status] ?? 0;
  const etapa = (n) => (n < ordem || s.status === "ENCERRADO" ? "feito" : n === ordem ? "atual" : "pendente");
  const etapas = [
    { titulo: "Registro do sinistro", quando: `${data(s.data)} ${hora(s.hora)}`, quem: s.responsavel ? `por ${s.responsavel}` : null, estado: ordem === 0 ? "atual" : "feito" },
    { titulo: "Em análise", estado: etapa(1) },
    { titulo: "Resolvido", quando: s.id_os ? "Com OS de manutenção vinculada" : null, estado: etapa(2) },
    { titulo: "Sinistro encerrado", estado: etapa(3) },
  ];

  const orcamento = ["orcamento_pecas", "orcamento_mao_obra", "orcamento_outros"].map((k) => s[k]);
  const temOrcamento = orcamento.some((v) => v != null) || s.orcamento_oficina;
  const totalOrcamento = orcamento.reduce((t, v) => t + (Number(v) || 0), 0);

  const tipoCurto = (t) => (t === "application/pdf" ? "PDF" : t === "image/png" ? "PNG" : t === "image/jpeg" ? "JPG" : "DOC");
  // Envolvidos: o motorista do veiculo SITRA primeiro.
  const envolvidosLista = [
    { chave: "condutor", sitra: true, nome: s.condutor, extra: s.condutor_matricula ? `Matrícula: ${s.condutor_matricula}` : null,
      tipoTexto: "Motorista", contato: s.condutor_telefone, situacao: s.situacao_condutor, placa: s.placa, modelo: `${s.marca || ""} ${s.modelo || ""}`.trim() },
    ...(s.envolvidos || []).map((e, n) => ({
      chave: `e${n}`, sitra: false, nome: e.nome || (e.tipo === "OUTRO_VEICULO" ? "Condutor do outro veículo" : null),
      extra: null, tipoTexto: nomeTipo(e.tipo), contato: e.contato, situacao: e.situacao,
      placa: e.placa, modelo: e.modelo, observacao: e.observacao,
    })),
  ];
  const veiculosLista = [
    { chave: "sitra", sitra: true, placa: s.placa, modelo: `${s.marca || ""} ${s.modelo || ""}`.trim(),
      tipo: s.tipo_veiculo ? rotulo("tipoVeiculo", s.tipo_veiculo) : null, proprietario: `Frota (${s.setor || "SITRA"})` },
    ...(s.envolvidos || []).filter((e) => e.tipo === "OUTRO_VEICULO" && (e.placa || e.modelo)).map((e, n) => ({
      chave: `t${n}`, sitra: false, placa: e.placa, modelo: e.modelo, tipo: null, proprietario: e.nome, contato: e.contato, observacao: e.observacao,
    })),
  ];
  // Providencias: cada linha (ou ";") do texto vira um item; a OS vinculada tambem.
  const TIPOS_PROVIDENCIA = [[/guincho/i, "Guincho", "laranja"], [/b\.?o\.?|boletim|pol[ií]cia/i, "Registro policial", "azul"],
    [/segur/i, "Acionamento do seguro", "roxo"], [/vistoria|per[ií]cia|laudo/i, "Vistoria", "amarelo"],
    [/oficina|reparo|conserto|or[cç]amento/i, "Reparo", "cinza"], [/comunica|avis|coordena/i, "Comunicação interna", "azul"]];
  const providencias = [
    ...String(s.providencias || "").split(/\r?\n|;/).map((x) => x.trim()).filter(Boolean).map((texto, n) => {
      const t = TIPOS_PROVIDENCIA.find(([re]) => re.test(texto)) || [null, "Providência", "cinza"];
      return { chave: `p${n}`, n: n + 1, texto, tipo: t[1], tom: t[2] };
    }),
  ];
  if (s.id_os) providencias.push({ chave: "os", n: providencias.length + 1, texto: "OS de manutenção aberta para o reparo do veículo.", tipo: "Manutenção", tom: "amarelo", os: true });

  const ABAS = [
    { chave: "geral", rotulo: "Visão Geral", icone: "sinistro" },
    { chave: "fotos", rotulo: "Fotos", icone: "oc-camera", total: fotos.length || undefined },
    { chave: "documentos", rotulo: "Documentos", icone: "documentos", total: docs.length || undefined },
    { chave: "envolvidos", rotulo: "Envolvidos", icone: "usuarios", total: envolvidosTotal },
    { chave: "veiculo", rotulo: "Veículo", icone: "kpi-car", total: veiculosLista.length },
    { chave: "providencias", rotulo: "Providências", icone: "alert-triangle", total: providencias.length || undefined },
    { chave: "historico", rotulo: "Histórico", icone: "historico" },
  ];
  const inicioHistorico = { quando: `${String(s.data).slice(0, 10)}T${s.hora || "00:00"}`, usuario: s.responsavel,
    acao: "Registro", descricao: "Sinistro registrado no sistema" };
  const mapa = s.local ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.local)}` : null;

  const cartaoDocumentos = (
    <Cartao
      titulo={<><Icone nome="documentos" tamanho={18} /> Documentos</>}
      acao={podeGerenciar && (
        <button className="botao botao--pequeno vd-cartao-acao" onClick={() => entradaDoc.current?.click()}
                disabled={anexos.enviando}>
          <Icone nome="mais" tamanho={13} /> Adicionar
        </button>
      )}
    >
      {docs.length === 0 ? (
        <p className="texto-corrido">Nenhum documento anexado (B.O., orçamento, laudo...).</p>
      ) : (
        <ul className="lista-arquivos">
          {docs.map((d) => (
            <li key={d.id_arquivo}>
              <Icone nome="documento" tamanho={20} />
              <div className="lista-arquivos__info">
                <strong title={d.nome}>{d.nome}</strong>
                <span>PDF · {tamanhoArquivo(d.bytes)}</span>
              </div>
              <div className="lista-arquivos__botoes">
                <button type="button" className="botao botao--pequeno botao--icone" title="Abrir"
                        aria-label={`Abrir ${d.nome}`} onClick={() => anexos.abrir(d)}>
                  <Icone nome="visualizar" tamanho={13} />
                </button>
                <button type="button" className="botao botao--pequeno botao--icone" title="Baixar"
                        aria-label={`Baixar ${d.nome}`} onClick={() => anexos.baixar(d)}>
                  <Icone nome="baixar" tamanho={13} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );

  return (
    <div className="ficha">
      <div className="cabecalho-pagina vd-cabecalho">
        <div>
          <Trilha
            itens={[
              { rotulo: "Frotas" },
              { rotulo: "Sinistros", para: "/frotas/sinistros" },
              { rotulo: "Detalhes do Sinistro" },
            ]}
          />
          <div className="vd-titulo">
            <span className="vd-titulo__icone"><Icone nome="alert-triangle" tamanho={26} /></span>
            <div>
              <h1>Detalhes do Sinistro</h1>
              <p>Visualize todas as informações do sinistro, incluindo envolvidos, documentação, fotos e histórico.</p>
            </div>
          </div>
        </div>
        <div className="cabecalho-pagina__acoes esconder-impressao">
          <button className="botao" onClick={() => navegar("/frotas/sinistros")}>
            <Icone nome="seta-esquerda" tamanho={15} /> Voltar
          </button>
          <button className="botao" onClick={() => window.print()}>
            <Icone nome="imprimir" tamanho={15} /> Imprimir
          </button>
          {podeGerenciar && (
            <button className="botao botao--primario" onClick={() => setEditando(true)}>
              <Icone nome="editar" tamanho={15} monocromatico /> Editar
            </button>
          )}
        </div>
      </div>

      <FaixaVeiculo
        v={veiculo ? { ...veiculo, veiculo_status: veiculo.status } : s}
        dados={[
          { icone: "predio", rotulo: "Setor", valor: vazio(s.setor) },
          { icone: "user", rotulo: "Motorista", valor: vazio(s.condutor), apoio: s.condutor_matricula ? `Matrícula: ${s.condutor_matricula}` : null },
          { icone: "calendar", rotulo: "Data do sinistro", valor: data(s.data), apoio: hora(s.hora) },
          { icone: "kpi-car", rotulo: "Tipo", valor: <Selo texto={rotulo("tipoSinistro", s.tipo)} tom={TOM_TIPO_SINISTRO[s.tipo]} /> },
          { icone: "checklist", rotulo: "Status", valor: <Selo valor={s.status} /> },
        ]} />

      <div className="abas vd-abas esconder-impressao" role="tablist">
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

      <input ref={entradaFoto} type="file" multiple hidden accept=".jpg,.jpeg,.png,image/jpeg,image/png" onChange={enviarDe} />
      <input ref={entradaDoc} type="file" multiple hidden accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={enviarDe} />

      {aba === "geral" && (
        <>
          <div className="ficha-3 ficha-bloco">
            <Cartao titulo={<><Icone nome="informacao" tamanho={18} /> Informações do Sinistro</>}>
              <dl className="vd-dados__coluna">
                <div className="vd-dados__linha"><dt>Número do sinistro</dt><dd>{vazio(s.numero)}</dd></div>
                <div className="vd-dados__linha"><dt>Data e hora</dt><dd>{`${data(s.data)} ${hora(s.hora)}`}</dd></div>
                <div className="vd-dados__linha">
                  <dt>Local</dt>
                  <dd className="campo-com-acao">
                    <span>{vazio(s.local)}</span>
                    {mapa && (
                      <a className="mapa-link esconder-impressao" href={mapa} target="_blank" rel="noreferrer">
                        <Icone nome="seta-direita" tamanho={12} /> Ver no mapa
                      </a>
                    )}
                  </dd>
                </div>
                <div className="vd-dados__linha"><dt>Tipo de sinistro</dt><dd>{rotulo("tipoSinistro", s.tipo)}</dd></div>
                <div className="vd-dados__linha"><dt>Natureza</dt><dd>{s.houve_terceiros ? "Com terceiros" : "Sem terceiros"}</dd></div>
                <div className="vd-dados__linha"><dt>Registro policial (B.O.)</dt><dd>{s.bo ? `Sim · nº ${s.bo}` : "Não"}</dd></div>
                <div className="vd-dados__linha"><dt>Parte danificada</dt><dd>{s.parte_danificada ? rotulo("parteSinistro", s.parte_danificada) : "—"}</dd></div>
                <div className="vd-dados__linha"><dt>Gravidade dos danos</dt><dd>{s.gravidade_danos ? rotulo("gravidadeDanos", s.gravidade_danos) : "—"}</dd></div>
                <div className="vd-dados__linha"><dt>Descrição</dt><dd><span className="ficha-texto ficha-texto--celula">{s.descricao || "Sem descrição."}</span></dd></div>
              </dl>
            </Cartao>

            <Cartao
              titulo={<><Icone nome="visualizar" tamanho={18} /> Fotos do Sinistro</>}
              acao={fotos.length > 0 && (
                <button className="botao botao--pequeno vd-cartao-acao" onClick={() => setAba("fotos")}>
                  Ver todas ({fotos.length}) <Icone nome="chevron-right" tamanho={12} />
                </button>
              )}
            >
              {fotos.length === 0 ? (
                podeGerenciar ? (
                  <button type="button" className="galeria__mais galeria__mais--vazia"
                          onClick={() => entradaFoto.current?.click()} disabled={anexos.enviando}>
                    <Icone nome="mais" tamanho={18} />
                    {anexos.enviando ? "Enviando..." : "Adicionar fotos"}
                  </button>
                ) : <p className="texto-corrido">Nenhuma foto anexada.</p>
              ) : (
                <div className="galeria">
                  <button type="button" className="galeria__principal" onClick={() => anexos.abrir(fotos[0])} title={fotos[0].nome}>
                    {anexos.miniaturas[fotos[0].id_arquivo] && <img src={anexos.miniaturas[fotos[0].id_arquivo]} alt={fotos[0].nome} />}
                  </button>
                  <div className="galeria__lado">
                    {fotos.slice(1, podeGerenciar ? 3 : 4).map((f, n, lista) => (
                      <button type="button" key={f.id_arquivo} className="galeria__mini" onClick={() => anexos.abrir(f)} title={f.nome}>
                        {anexos.miniaturas[f.id_arquivo] && <img src={anexos.miniaturas[f.id_arquivo]} alt={f.nome} />}
                        {n === lista.length - 1 && fotos.length > lista.length + 1 && (
                          <span className="galeria__resto">+{fotos.length - lista.length - 1}</span>
                        )}
                      </button>
                    ))}
                    {podeGerenciar && (
                      <button type="button" className="galeria__mais" onClick={() => entradaFoto.current?.click()} disabled={anexos.enviando}>
                        <Icone nome="mais" tamanho={16} />
                        {anexos.enviando ? "Enviando..." : "Adicionar fotos"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </Cartao>

            <Cartao titulo={<><Icone nome="check" tamanho={18} /> Status e Providências</>}>
              <ol className="etapas">
                {etapas.map((e) => (
                  <li key={e.titulo} data-estado={e.estado}>
                    <span className="etapas__ponto">{e.estado === "feito" ? "✓" : ""}</span>
                    <div className="etapas__texto">
                      <strong>{e.titulo}</strong>
                      {e.quando && <span>{e.quando}</span>}
                      {e.quem && <span>{e.quem}</span>}
                    </div>
                  </li>
                ))}
              </ol>
              {s.status !== "ENCERRADO" && (
                <div className="sin-nota"><span>!</span>O status é atualizado conforme o andamento da análise e das providências.</div>
              )}
            </Cartao>
          </div>

          <div className="ficha-3b ficha-bloco">
            <Cartao
              titulo={<><Icone nome="usuarios" tamanho={18} /> Envolvidos</>}
              acao={<button className="botao botao--pequeno vd-cartao-acao" onClick={() => setAba("envolvidos")}>Ver todos</button>}
            >
              <TabelaEnvolvidos s={s} />
            </Cartao>

            {cartaoDocumentos}

            <Cartao titulo={<><Icone nome="chart-line" tamanho={18} /> Custos Estimados</>}>
              {!temOrcamento ? (
                <p className="texto-corrido">Nenhum orçamento informado. Use Editar para incluir.</p>
              ) : (
                <>
                  <dl className="custos">
                    <div className="custos__linha"><dt>Orçamento da oficina</dt><dd>{vazio(s.orcamento_oficina)}</dd></div>
                    <div className="custos__linha"><dt>Peças</dt><dd>{s.orcamento_pecas != null ? dinheiro(s.orcamento_pecas) : "—"}</dd></div>
                    <div className="custos__linha"><dt>Mão de obra</dt><dd>{s.orcamento_mao_obra != null ? dinheiro(s.orcamento_mao_obra) : "—"}</dd></div>
                    <div className="custos__linha"><dt>Outros custos</dt><dd>{s.orcamento_outros != null ? dinheiro(s.orcamento_outros) : "—"}</dd></div>
                  </dl>
                  <div className="custos__total"><span>Total estimado</span><strong>{dinheiro(totalOrcamento)}</strong></div>
                </>
              )}
            </Cartao>
          </div>

          <Cartao titulo={<><Icone nome="historico" tamanho={18} /> Histórico do Sinistro</>}
                  acao={<button className="botao botao--pequeno vd-cartao-acao" onClick={() => setAba("historico")}>Ver todo</button>}>
            <HistoricoAuditoria tipo="sinistro" id={s.id_sinistro} recarga={recarga + (anexos.arquivos?.length || 0)} limite={5}
                                inicio={inicioHistorico} />
          </Cartao>
        </>
      )}

      {aba === "fotos" && (
        <section className="cartao sf">
          <header className="dd-titulo">
            <Icone nome="oc-camera" tamanho={24} />
            <div><h2>Fotos do Sinistro</h2><p>Visualize, adicione e gerencie as fotos relacionadas ao sinistro.</p></div>
            {podeGerenciar && (
              <button className="botao botao--primario" onClick={() => entradaFoto.current?.click()} disabled={anexos.enviando}>
                <Icone nome="mais" tamanho={15} monocromatico /> {anexos.enviando ? "Enviando..." : "Adicionar fotos"}
              </button>
            )}
          </header>
          {fotos.length === 0 && !podeGerenciar && <p className="texto-corrido">Nenhuma foto anexada.</p>}
          <div className="sf-grade">
            {fotos.map((f) => (
              <figure key={f.id_arquivo} className="sf-foto">
                <button type="button" className="sf-foto__img" onClick={() => anexos.abrir(f)} title="Abrir a foto">
                  {anexos.miniaturas[f.id_arquivo] ? <img src={anexos.miniaturas[f.id_arquivo]} alt={f.nome} /> : <Icone nome="oc-camera" tamanho={26} />}
                </button>
                <figcaption>
                  <strong title={f.nome}>{f.nome}</strong>
                  <span><Icone nome="historico" tamanho={13} /> {dataHora(f.criado_em)}</span>
                  {f.enviado_por_nome && <span><Icone nome="user" tamanho={13} /> {f.enviado_por_nome}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
          {podeGerenciar && (
            <button type="button" className="sf-arraste" onClick={() => entradaFoto.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); anexos.enviar(e.dataTransfer.files); }}>
              <Icone nome="exportar" tamanho={30} monocromatico />
              <strong>Arraste e solte as fotos aqui</strong>
              <span>ou clique para selecionar arquivos</span>
              <small>Formatos permitidos: JPG e PNG • Tamanho máximo: 10 MB por arquivo</small>
            </button>
          )}
        </section>
      )}

      {aba === "documentos" && (
        <AbaRegistros
          titulo="Lista de Documentos" icone="documentos" placeholder="Buscar por nome..."
          novo={podeGerenciar && { rotulo: "Novo Documento", aoClicar: () => entradaDoc.current?.click() }}
          linhas={docs} textoBusca={(d) => d.nome} chave={(d) => d.id_arquivo} unidade="documentos"
          vazio="Nenhum documento anexado (B.O., orçamento, laudo...)."
          colunas={[
            { rotulo: "Nome do Documento", classe: "ad-nome-celula", render: (d) => (
              <span className="ad-nome">
                <span className="ad-tipo" data-tipo={tipoCurto(d.tipo)}>{tipoCurto(d.tipo)}</span>
                <span className="ad-nome__textos"><strong title={d.nome}>{d.nome}</strong><small>{tamanhoArquivo(d.bytes)}</small></span>
              </span>
            ) },
            { rotulo: "Tipo", render: (d) => tipoCurto(d.tipo) },
            { rotulo: "Enviado em", render: (d) => dataHora(d.criado_em) },
            { rotulo: "Enviado por", render: (d) => vazio(d.enviado_por_nome) },
          ]}
          acoes={(d) => [
            { rotulo: "Visualizar", icone: "visualizar", aoClicar: () => anexos.abrir(d) },
            { rotulo: "Baixar", icone: "baixar", aoClicar: () => anexos.baixar(d) },
          ]}
          painel={(d, { fechar }) => (
            <div className="pck">
              <header className="pck-topo">
                <h3><Icone nome="documentos" tamanho={18} /> Detalhes do Documento</h3>
                <button type="button" className="sd-sinistro-resumo__fechar" aria-label="Fechar" onClick={fechar}>×</button>
              </header>
              <div className="pd-doc">
                <span className="ad-tipo ad-tipo--grande" data-tipo={tipoCurto(d.tipo)}>{tipoCurto(d.tipo)}</span>
                <span><strong title={d.nome}>{d.nome}</strong><small>{tipoCurto(d.tipo)} • {tamanhoArquivo(d.bytes)}</small></span>
              </div>
              <dl className="pd-grade pd-grade--icones">
                <div><dt><Icone nome="calendar" tamanho={14} /> Enviado em</dt><dd>{dataHora(d.criado_em)}</dd></div>
                <div><dt><Icone nome="user" tamanho={14} /> Enviado por</dt><dd>{vazio(d.enviado_por_nome)}</dd></div>
              </dl>
              <section className="pck-bloco">
                <h4><Icone nome="documentos" tamanho={16} /> Arquivo</h4>
                <div className="pd-arquivo">
                  <div className="pd-arquivo__botoes">
                    <button type="button" className="botao botao--pequeno" onClick={() => anexos.abrir(d)}><Icone nome="visualizar" tamanho={14} /> Visualizar</button>
                    <button type="button" className="botao botao--pequeno" onClick={() => anexos.baixar(d)}><Icone nome="baixar" tamanho={14} /> Baixar</button>
                  </div>
                </div>
              </section>
            </div>
          )} />
      )}

      {aba === "envolvidos" && (
        <AbaRegistros
          titulo="Lista de Envolvidos" icone="usuarios" placeholder="Buscar por nome, tipo, contato..."
          situacoes={SITUACOES_ENVOLVIDO.map((x) => ({ valor: x.valor, rotulo: x.rotulo, campo: "situacao" }))}
          novo={podeGerenciar && { rotulo: "Novo Envolvido", aoClicar: () => setEditando(true) }}
          linhas={envolvidosLista} textoBusca={(e) => [e.nome, e.tipoTexto, e.contato, e.placa, e.modelo].join(" ")}
          chave={(e) => e.chave} unidade="envolvidos" vazio="Nenhum envolvido."
          colunas={[
            { rotulo: "Nome / Identificação", classe: "ad-nome-celula", render: (e) => (
              <span className="ad-nome">
                <span className="se-avatar"><Icone nome="user" tamanho={16} /></span>
                <span className="ad-nome__textos"><strong>{vazio(e.nome)}</strong>{e.extra && <small>{e.extra}</small>}</span>
              </span>
            ) },
            { rotulo: "Tipo", render: (e) => <Selo texto={e.tipoTexto} tom={e.sitra ? "azul" : "roxo"} /> },
            { rotulo: "Contato", render: (e) => vazio(e.contato) },
            { rotulo: "Veículo", render: (e) => (e.placa ? <span className="celula-dupla"><strong>{e.placa}</strong><span>{e.modelo}</span></span> : "—") },
            { rotulo: "Situação", render: (e) => <SeloSituacao valor={e.situacao} /> },
          ]}
          acoes={(e) => (e.sitra ? [{ rotulo: "Abrir o motorista", icone: "user", aoClicar: () => navegar(`/frotas/motoristas/${s.id_servidor}`) }]
            : podeGerenciar ? [{ rotulo: "Editar envolvidos", icone: "editar", aoClicar: () => setEditando(true) }] : [])}
          painel={(e, { fechar }) => (
            <div className="pck">
              <header className="pck-topo">
                <h3><Icone nome="user" tamanho={18} /> Detalhes do Envolvido</h3>
                <span className="as-topo-acoes">
                  {podeGerenciar && <button type="button" className="botao botao--pequeno" onClick={() => setEditando(true)}><Icone nome="editar" tamanho={13} /> Editar</button>}
                  <button type="button" className="sd-sinistro-resumo__fechar" aria-label="Fechar" onClick={fechar}>×</button>
                </span>
              </header>
              <div className="se-pessoa">
                <span className="se-avatar se-avatar--grande"><Icone nome="user" tamanho={26} /></span>
                <span><strong>{vazio(e.nome)}</strong><Selo texto={e.tipoTexto} tom={e.sitra ? "azul" : "roxo"} /></span>
                <SeloSituacao valor={e.situacao} />
              </div>
              <dl className="pd-grade pd-grade--icones">
                {e.sitra && <div><dt><Icone nome="cnh" tamanho={14} /> Matrícula</dt><dd>{vazio(s.condutor_matricula)}</dd></div>}
                <div><dt><Icone nome="telefone" tamanho={14} /> Contato</dt><dd>{vazio(e.contato)}</dd></div>
              </dl>
              {(e.placa || e.sitra) && (
                <section className="pck-bloco">
                  <h4><Icone nome="kpi-car" tamanho={16} /> Veículo envolvido</h4>
                  <button type="button" className="se-veiculo" onClick={() => e.sitra && navegar(`/frotas/veiculos/${s.id_veiculo}`)}>
                    <strong>{e.sitra ? s.placa : e.placa}</strong>
                    <span>{e.sitra ? `${s.marca} ${s.modelo}` : vazio(e.modelo)}</span>
                  </button>
                </section>
              )}
              <section className="pck-bloco">
                <h4><Icone nome="arquivo-texto" tamanho={16} /> Observações</h4>
                <p className={`pck-obs${e.observacao ? "" : " pck-obs--vazia"}`}>{e.observacao || (e.sitra ? "Motorista do veículo SITRA no momento do sinistro." : "Nenhuma observação registrada.")}</p>
              </section>
            </div>
          )} />
      )}

      {aba === "veiculo" && (
        <AbaRegistros
          titulo="Veículos Envolvidos" icone="kpi-car" placeholder="Buscar por placa, modelo..."
          novo={podeGerenciar && { rotulo: "Adicionar Veículo", aoClicar: () => setEditando(true) }}
          linhas={veiculosLista} textoBusca={(v) => [v.placa, v.modelo, v.proprietario].join(" ")}
          chave={(v) => v.chave} unidade="veículos" vazio="Nenhum veículo."
          colunas={[
            { rotulo: "Placa", render: (v) => <span className="celula-dupla"><strong>{vazio(v.placa)}</strong><Selo texto={v.sitra ? "Veículo SITRA" : "Terceiro"} tom={v.sitra ? "azul" : "cinza"} /></span> },
            { rotulo: "Modelo", render: (v) => vazio(v.modelo) },
            { rotulo: "Tipo", render: (v) => vazio(v.tipo) },
            { rotulo: "Proprietário / condutor", render: (v) => vazio(v.proprietario) },
            { rotulo: "Situação", render: () => <Selo texto="Envolvido" tom="verde" /> },
          ]}
          acoes={(v) => (v.sitra ? [{ rotulo: "Ver detalhes do veículo", icone: "kpi-car", aoClicar: () => navegar(`/frotas/veiculos/${s.id_veiculo}`) }] : [])}
          painel={(v, { fechar }) => <PainelVeiculoSinistro v={v} s={s} veiculo={veiculo} fechar={fechar}
            podeEditar={podeGerenciar} aoEditar={() => setEditando(true)} aoAbrir={() => navegar(`/frotas/veiculos/${s.id_veiculo}`)} />} />
      )}

      {aba === "providencias" && (
        <AbaRegistros
          titulo="Providências Tomadas" icone="alert-triangle" placeholder="Buscar providência..."
          novo={podeGerenciar && { rotulo: "Nova Providência", aoClicar: () => setEditando(true) }}
          linhas={providencias} textoBusca={(p) => p.texto} chave={(p) => p.chave} unidade="providências"
          vazio="Nenhuma providência registrada. Use Nova Providência (Editar do sinistro) para registrar."
          colunas={[
            { rotulo: "#", render: (p) => p.n },
            { rotulo: "Tipo de providência", render: (p) => <Selo texto={p.tipo} tom={p.tom} /> },
            { rotulo: "Descrição", classe: "as-quebra as-descricao", render: (p) => <span className="as-clamp" title={p.texto}>{p.texto}</span> },
            { rotulo: "Status", render: (p) => <Selo texto={p.os ? (p.osStatus || "OS aberta") : "Registrada"} tom={p.os ? "azul" : "verde"} /> },
          ]}
          acoes={(p) => (p.os ? [{ rotulo: "Abrir a OS", icone: "kpi-wrench", aoClicar: () => navegar(`/frotas/manutencoes/${s.id_os}`) }] : [])}
          painel={(p, { fechar }) => (
            <div className="pck">
              <header className="pck-topo">
                <h3><Icone nome="alert-triangle" tamanho={18} /> Detalhes da Providência</h3>
                <span className="as-topo-acoes">
                  {podeGerenciar && !p.os && <button type="button" className="botao botao--pequeno" onClick={() => setEditando(true)}><Icone nome="editar" tamanho={13} /> Editar</button>}
                  <button type="button" className="sd-sinistro-resumo__fechar" aria-label="Fechar" onClick={fechar}>×</button>
                </span>
              </header>
              <div className="pck-linha"><Selo texto={p.tipo} tom={p.tom} /></div>
              <dl className="pd-grade pd-grade--icones">
                <div><dt><Icone nome="calendar" tamanho={14} /> Sinistro de</dt><dd>{`${data(s.data)} ${hora(s.hora)}`}</dd></div>
                <div><dt><Icone nome="user" tamanho={14} /> Responsável</dt><dd>{vazio(s.responsavel)}</dd></div>
              </dl>
              <section className="pck-bloco">
                <h4><Icone nome="arquivo-texto" tamanho={16} /> Descrição</h4>
                <p className="pck-obs">{p.texto}</p>
              </section>
              {p.os && (
                <button type="button" className="lr-abrir" onClick={() => navegar(`/frotas/manutencoes/${s.id_os}`)}>
                  Abrir em Manutenções <Icone nome="seta-direita" tamanho={13} monocromatico />
                </button>
              )}
            </div>
          )} />
      )}

      {aba === "historico" && (
        <Cartao titulo={<><Icone nome="historico" tamanho={18} /> Histórico do sinistro</>}>
          <HistoricoAuditoria tipo="sinistro" id={s.id_sinistro} recarga={recarga + (anexos.arquivos?.length || 0)} inicio={inicioHistorico} />
        </Cartao>
      )}

      {editando && (
        <RegistrarSinistro sinistro={s} aoFechar={() => setEditando(false)} aoSalvar={recarregar} />
      )}
    </div>
  );
}
