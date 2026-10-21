/**
 * ChecklistQrFiscal.jsx - Checklist da VIATURA da Fiscalizacao pelo QR Code
 * (desenho do Cesar, 21/10). Aberto pelo ChecklistQr quando o veiculo do QR
 * Code e uma viatura.
 *
 * Quatro passos, como no desenho:
 *   1. Checklist de Saida   - fiscais 1 e 2 (matricula), horario, KM e os
 *                             equipamentos. Ao continuar, o checklist abre.
 *   2. Ocorrencias e QRU    - durante o servico: ocorrencias e QRU da equipe,
 *                             OS, fotos e observacoes. Cada registro grava na
 *                             hora (o servico dura o dia todo).
 *   3. Checklist de Chegada - horario, KM e os equipamentos no retorno.
 *   4. Finalizar            - resumo e fechamento.
 *
 * Quem le o QR de novo com o checklist aberto cai no passo 2.
 *
 * Itens conferidos (Fiscalizacao > Equipamentos, 21/10): Radio e um por
 * fiscal; Cone, Pantografica, Cavalete e Barreira, a quantidade salva para
 * a viatura; Macaco, Estepe e Chave de roda, presentes ou ausentes.
 *
 * "Nova" e "Abrir QRU" abrem a tela Nova Ocorrencia do desenho de 21/10
 * (NovaOcorrenciaQr.jsx). Os icones das ocorrencias sao um padrao para todas
 * as equipes: o do tipo da ocorrencia, e o alerta vermelho para QRU.
 * Do desenho ficou de fora o que o sistema nao tem: foto da viatura, "tipo
 * de servico" e "area de atuacao".
 */
import { useEffect, useMemo, useState } from "react";
import Icone from "../components/Icone.jsx";
import Selo from "../components/Selo.jsx";
import { api } from "../lib/api.js";
import { numero, numeroOs, rotulo } from "../lib/formato.js";
import { reduzirImagem, pesoLegivel } from "../lib/imagem.js";
import { iconeDoItem, previstoDoItem } from "../lib/equipamentos.js";
import { iconeCategoria, rotuloCategoria } from "../lib/ocorrencias.js";
import NovaOcorrenciaQr from "./NovaOcorrenciaQr.jsx";

const obrigatorio = (e) => e.conferencia === "OBRIGATORIO";
const porFiscal = (e) => e.conferencia === "POR_FISCAL";
const PASSOS = ["Checklist de Saída", "Ocorrências e QRU", "Checklist de Chegada", "Finalizar"];
const TURNO = { DIURNO: "Diurno", NOTURNO: "Noturno" };
const MAX_FOTOS = 6;

const dataBr = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "—");
const hhmm = (t) => (t ? String(t).slice(0, 5) : "—");
// Radio: um para cada fiscal (Fiscal 1 e Fiscal 2). Os de quantidade: o que
// esta salvo para a viatura em Fiscalizacao > Equipamentos.
const previstoDe = (e) => previstoDoItem(e, 2);
function duracao(saida, chegada) {
  if (!saida || !chegada) return "—";
  const m = (t) => Number(String(t).slice(0, 2)) * 60 + Number(String(t).slice(3, 5));
  let d = m(chegada) - m(saida);
  if (d < 0) d += 24 * 60;
  return `${Math.floor(d / 60)}h ${String(d % 60).padStart(2, "0")}min`;
}

/** Estado inicial da conferencia: tudo presente, quantidades previstas. */
function conferenciaInicial(itens, registrados) {
  const r = {};
  for (const e of itens) {
    const ja = registrados?.find((x) => String(x.id_equipamento) === String(e.id_equipamento));
    const prev = previstoDe(e);
    if (obrigatorio(e)) {
      r[e.id_equipamento] = { conforme: ja ? ja.quantidade > 0 : true, observacao: "" };
    } else if (porFiscal(e)) {
      const q = ja ? ja.quantidade : prev;
      r[e.id_equipamento] = { f1: q >= 1, f2: q >= 2 };
    } else {
      r[e.id_equipamento] = { quantidade: ja ? ja.quantidade : prev };
    }
  }
  return r;
}
/** Conferencia -> o que vai para a API. */
function paraApi(itens, conf) {
  return itens.map((e) => {
    const c = conf[e.id_equipamento] || {};
    if (obrigatorio(e)) {
      return { id_equipamento: e.id_equipamento, quantidade: c.conforme ? 1 : 0,
        observacao: c.conforme ? null : (c.observacao || "Item ausente na conferência.") };
    }
    if (porFiscal(e)) {
      const q = (c.f1 ? 1 : 0) + (c.f2 ? 1 : 0);
      return { id_equipamento: e.id_equipamento, quantidade: q,
        observacao: q === 2 ? null : `Fiscal 1: ${c.f1 ? "Sim" : "Não"} · Fiscal 2: ${c.f2 ? "Sim" : "Não"}` };
    }
    return { id_equipamento: e.id_equipamento, quantidade: Number(c.quantidade) || 0, observacao: null };
  });
}

function Secao({ icone, titulo, nota, obrigatorio, acao, children }) {
  return (
    <section className="qr-cartao qf-secao">
      <div className="qf-secao__topo">
        <span className="qf-secao__icone"><Icone nome={icone} tamanho={22} /></span>
        <div className="qf-secao__textos">
          <h2 className="qr-cartao__titulo">{titulo}{obrigatorio && <span className="qf-obrig"> *</span>}</h2>
          {nota && <p className="qr-cartao__nota">{nota}</p>}
        </div>
        {acao}
      </div>
      {children}
    </section>
  );
}

/** Macaco, Estepe, Chave de roda: toque para marcar ausente. */
function Obrigatorios({ itens, conf, setConf, travado }) {
  const lista = itens.filter(obrigatorio);
  const ausentes = lista.filter((e) => !conf[e.id_equipamento]?.conforme);
  return (
    <>
      <div className="qr-equipamentos">
        {lista.map((e) => {
          const c = conf[e.id_equipamento] || {};
          return (
            <button type="button" key={e.id_equipamento} className="qr-equipamento" data-ausente={!c.conforme}
                    aria-pressed={c.conforme} disabled={travado}
                    onClick={() => setConf((x) => ({ ...x, [e.id_equipamento]: { ...c, conforme: !c.conforme } }))}>
              <span className="qr-equipamento__figura"><Icone nome={iconeDoItem(e.nome)} tamanho={22} /></span>
              <span className="qr-equipamento__nome">{e.nome}</span>
              <span className="qr-equipamento__marca"><Icone nome={c.conforme ? "check" : "fechar"} tamanho={18} /></span>
            </button>
          );
        })}
      </div>
      {!travado && ausentes.length > 0 && (
        <div className="qr-ausentes">
          {ausentes.map((e) => (
            <div className="campo" key={e.id_equipamento}>
              <label htmlFor={`aus-${e.id_equipamento}`}>{e.nome} — o que houve?</label>
              <input id={`aus-${e.id_equipamento}`} placeholder="Ex.: item não estava na viatura"
                     value={conf[e.id_equipamento]?.observacao || ""}
                     onChange={(ev) => setConf((x) => ({ ...x, [e.id_equipamento]: { ...x[e.id_equipamento], observacao: ev.target.value } }))} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** Radio (Sim/Nao por fiscal) e os de quantidade (Cone, Pantografica, Cavalete, Barreira). */
function Utilizados({ itens, conf, setConf, travado }) {
  const lista = itens.filter((e) => !obrigatorio(e));
  const mudar = (id, v) => setConf((x) => ({ ...x, [id]: { ...x[id], ...v } }));
  return (
    <div className="qf-usados">
      <div className="qf-usados__cab"><span /><span>Fiscal 1</span><span>Fiscal 2</span></div>
      {lista.map((e) => {
        const c = conf[e.id_equipamento] || {};
        const radio = porFiscal(e);
        return (
          <div className="qf-usado" key={e.id_equipamento}>
            <div className="qf-usado__item">
              <Icone nome={iconeDoItem(e.nome)} tamanho={22} />
              <span><strong>{e.nome}</strong><small>{radio ? "(1 por fiscal)" : `(viatura: ${Number(e.quantidade_salva) || 0})`}</small></span>
            </div>
            {radio ? (
              ["f1", "f2"].map((f) => (
                <div className="qr-km__confirma qf-simnao" key={f} role="group" aria-label={`${e.nome} ${f === "f1" ? "Fiscal 1" : "Fiscal 2"}`}>
                  <button type="button" disabled={travado} data-ativo={c[f] === true} onClick={() => mudar(e.id_equipamento, { [f]: true })}>Sim</button>
                  <button type="button" disabled={travado} data-ativo={c[f] === false} onClick={() => mudar(e.id_equipamento, { [f]: false })}>Não</button>
                </div>
              ))
            ) : (
              <div className="qf-contador">
                <button type="button" disabled={travado || !(c.quantidade > 0)} aria-label={`Menos ${e.nome}`}
                        onClick={() => mudar(e.id_equipamento, { quantidade: Math.max(0, (Number(c.quantidade) || 0) - 1) })}>
                  <Icone nome="minus" tamanho={16} />
                </button>
                <span>{Number(c.quantidade) || 0}</span>
                <button type="button" disabled={travado} aria-label={`Mais ${e.nome}`}
                        onClick={() => mudar(e.id_equipamento, { quantidade: (Number(c.quantidade) || 0) + 1 })}>
                  <Icone nome="mais" tamanho={16} />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Abrir OS: imediato com o checklist aberto; na saida, fica na fila. */
function AbrirOs({ fila, setFila, abertas, aoAbrir }) {
  const [form, setForm] = useState(null);
  const [erro, setErro] = useState("");
  async function confirmar() {
    if (!form.descricao.trim() || form.descricao.trim().length < 5) { setErro("Descreva o problema da viatura."); return; }
    setErro("");
    if (aoAbrir) {
      try { await aoAbrir(form); setForm(null); } catch (e) { setErro(e.message); }
    } else {
      setFila((l) => [...l, form]);
      setForm(null);
    }
  }
  return (
    <Secao icone="kpi-wrench" titulo="Abrir OS" nota="Pneu furado, farol queimado, freio falhando, barulho no motor. Pode abrir mais de uma.">
      {erro && <div className="qr-tela__aviso qr-tela__aviso--erro">{erro}</div>}
      {form ? (
        <div className="qr-chamado-form">
          <div className="campo">
            <label htmlFor="qf-os-urg">Urgência *</label>
            <select id="qf-os-urg" value={form.gravidade} onChange={(e) => setForm((f) => ({ ...f, gravidade: e.target.value }))}>
              <option value="BAIXA">Baixa</option><option value="MEDIA">Média</option><option value="ALTA">Alta</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="qf-os-desc">Descrição do problema *</label>
            <textarea id="qf-os-desc" rows={3} value={form.descricao} placeholder="Ex.: farol esquerdo queimado"
                      onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} />
          </div>
          <p className="qr-cartao__nota qr-cartao__nota--alerta">A OS vai para o Frotas completar com a oficina e o custo.</p>
          <div className="qr-chamado-form__botoes">
            <button type="button" className="botao" onClick={() => setForm(null)}>Cancelar</button>
            <button type="button" className="botao botao--primario" onClick={confirmar}><Icone nome="mais" /> Abrir OS</button>
          </div>
        </div>
      ) : (
        <button type="button" className="botao qr-chamado-abrir" onClick={() => setForm({ gravidade: "MEDIA", descricao: "" })}>
          <Icone nome="mais" /> Abrir OS
        </button>
      )}
      {(abertas?.length > 0 || fila?.length > 0) && (
        <div className="qr-chamados">
          <span className="qr-chamados__rotulo">OS deste checklist</span>
          {(abertas || []).map((o) => (
            <div className="qr-chamado" key={o.id_os}>
              <div><strong>{numeroOs(o.numero)}</strong><p>{o.descricao}</p>
                <span className="qr-chamado__meta">{rotulo("momentoChecklist", o.momento)}</span></div>
              <Selo valor={o.status} />
            </div>
          ))}
          {(fila || []).map((o, i) => (
            <div className="qr-chamado" key={`f${i}`}>
              <div><strong>Nova OS</strong><p>{o.descricao}</p><span className="qr-chamado__meta">Será aberta ao continuar</span></div>
              <button type="button" className="qr-chamado__remover" aria-label="Remover OS"
                      onClick={() => setFila((l) => l.filter((_, j) => j !== i))}><Icone nome="fechar" tamanho={15} /></button>
            </div>
          ))}
        </div>
      )}
    </Secao>
  );
}

/** Fotos: na saida ficam na fila; depois sobem na hora. */
function Fotos({ fila, setFila, enviadas = 0, aoEnviar }) {
  const [preparando, setPreparando] = useState(false);
  const [erro, setErro] = useState("");
  const total = enviadas + (fila?.length || 0);
  async function escolher(ev) {
    const arquivos = Array.from(ev.target.files || []);
    ev.target.value = "";
    const cabem = MAX_FOTOS - total;
    if (!arquivos.length || cabem <= 0) return;
    setPreparando(true); setErro("");
    try {
      const novas = [];
      for (const a of arquivos.slice(0, cabem)) novas.push(await reduzirImagem(a));
      if (aoEnviar) await aoEnviar(novas); else setFila((f) => [...f, ...novas]);
    } catch (e) { setErro(e.message); } finally { setPreparando(false); }
  }
  return (
    <Secao icone="documento" titulo="Fotos (opcional)" nota={`Registre avarias, o estado da viatura ou o local. Até ${MAX_FOTOS} fotos.`}>
      {erro && <div className="qr-tela__aviso qr-tela__aviso--erro">{erro}</div>}
      {enviadas > 0 && <p className="qf-ok"><Icone nome="check" tamanho={16} /> {enviadas} foto{enviadas > 1 ? "s" : ""} já enviada{enviadas > 1 ? "s" : ""}.</p>}
      {fila?.length > 0 && (
        <div className="qr-fotos">
          {fila.map((f, i) => (
            <figure className="qr-foto-item" key={i}>
              <img src={f.dataUrl} alt={`Foto ${i + 1}`} />
              <button type="button" className="qr-foto-item__remover" aria-label={`Remover foto ${i + 1}`}
                      onClick={() => setFila((l) => l.filter((_, j) => j !== i))}><Icone nome="fechar" tamanho={15} /></button>
              <figcaption>{pesoLegivel(f.bytes)}</figcaption>
            </figure>
          ))}
        </div>
      )}
      {total < MAX_FOTOS && (
        <label className="qr-foto" data-ocupado={preparando}>
          <input type="file" accept="image/*" capture="environment" multiple onChange={escolher} disabled={preparando} />
          <Icone nome={preparando ? "ajuda" : "mais"} tamanho={26} />
          <span>{preparando ? "Preparando a imagem..." : "Tirar foto ou escolher do aparelho"}</span>
        </label>
      )}
    </Secao>
  );
}

/** Um fiscal pela matricula, com a equipe em que esta escalado hoje. */
function Fiscal({ rotulo: r, id, valor, setValor, achado, setAchado, token }) {
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState("");
  async function buscar() {
    const m = valor.trim();
    if (!m) return;
    setBuscando(true); setErro("");
    try {
      setAchado(await api(`/qrcode/fiscal/${encodeURIComponent(token)}/fiscal/${encodeURIComponent(m)}`));
    } catch (e) { setAchado(null); setErro(e.message); } finally { setBuscando(false); }
  }
  return (
    <div className="qf-fiscal">
      <label htmlFor={id}>{r} *</label>
      <div className="qr-matricula">
        <input id={id} value={valor} inputMode="numeric" enterKeyHint="search" autoComplete="off" placeholder="Matrícula"
               onChange={(e) => { setValor(e.target.value); setAchado(null); }} onBlur={buscar}
               onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscar(); } }} />
        <button type="button" className="botao botao--primario qf-lupa" onClick={buscar} disabled={buscando || !valor.trim()}
                aria-label={`Buscar ${r}`}>
          <Icone nome="search" tamanho={18} monocromatico />
        </button>
      </div>
      {erro && <small className="qf-erro">{erro}</small>}
      {achado && (
        <div className="qf-fiscal__achado">
          <strong>{achado.nome}</strong>
          <span>{achado.cargo || "Servidor"}{achado.escala ? ` · ${achado.escala.equipe}` : ""}</span>
        </div>
      )}
    </div>
  );
}

/** As ocorrencias e o QRU da equipe. "Nova" e "Abrir QRU" abrem a tela Nova Ocorrencia. */
function Ocorrencias({ token, lista, aoMudar, aoNova, aviso }) {
  const [finalizando, setFinalizando] = useState(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  async function finalizar() {
    setSalvando(true); setErro("");
    try {
      await api(`/qrcode/fiscal/${encodeURIComponent(token)}/ocorrencia/${finalizando.id}/finalizar`,
        { method: "PUT", body: { descricao_atendimento: finalizando.texto } });
      setFinalizando(null);
      aoMudar();
    } catch (e) { setErro(e.message); } finally { setSalvando(false); }
  }
  const qrus = lista.filter((o) => o.tipo === "QRU");
  const outras = lista.filter((o) => o.tipo !== "QRU");
  const item = (o) => (
    <div className="qf-oc" key={o.id_ocorrencia} data-tipo={o.tipo}>
      <span className="qf-oc__icone"><Icone nome={o.tipo === "QRU" ? "alert-triangle" : iconeCategoria(o.categoria)} tamanho={18} /></span>
      <div className="qf-oc__texto">
        {o.categoria && <span className="qf-oc__categoria">{rotuloCategoria(o.categoria)}</span>}
        <strong>{o.descricao}</strong>
        <span>{o.endereco}{o.bairro ? ` · ${o.bairro}` : ""}</span>
        <span className="qf-oc__meta">
          {o.protocolo} · <Selo valor={o.status} />
          {o.origem_protocolo && <> · Ligado a {o.origem_protocolo}</>}
          {o.arquivos > 0 && <> · {o.arquivos} arquivo{o.arquivos > 1 ? "s" : ""}</>}
          {o.envolvidos > 0 && <> · {o.envolvidos} envolvido{o.envolvidos > 1 ? "s" : ""}</>}
        </span>
        {o.status !== "FINALIZADA" && finalizando?.id !== o.id_ocorrencia && (
          <button type="button" className="qf-link" onClick={() => setFinalizando({ id: o.id_ocorrencia, texto: "" })}>Finalizar</button>
        )}
        {finalizando?.id === o.id_ocorrencia && (
          <div className="qf-oc__finalizar">
            <textarea rows={2} placeholder="Como foi o atendimento?" value={finalizando.texto}
                      onChange={(e) => setFinalizando((f) => ({ ...f, texto: e.target.value }))} />
            <div className="qr-chamado-form__botoes">
              <button type="button" className="botao" onClick={() => setFinalizando(null)}>Cancelar</button>
              <button type="button" className="botao botao--primario" disabled={salvando || !finalizando.texto.trim()} onClick={finalizar}>Finalizar</button>
            </div>
          </div>
        )}
      </div>
      <span className="qf-oc__hora">{hhmm(o.hora)}</span>
    </div>
  );
  return (
    <>
      {aviso && <div className="qr-tela__aviso qf-aviso-ok"><Icone nome="check" tamanho={18} /><p>{aviso}</p></div>}
      <Secao icone="alert-triangle" titulo="Ocorrências da Equipe"
             nota="Registre aqui as ocorrências atendidas durante o serviço."
             acao={<button type="button" className="botao botao--primario qf-mini" onClick={() => aoNova("PROGRAMADA")}><Icone nome="mais" /> Nova</button>}>
        {erro && <div className="qr-tela__aviso qr-tela__aviso--erro">{erro}</div>}
        {outras.length === 0 ? <p className="qr-cartao__nota">Nenhuma ocorrência registrada ainda.</p> : outras.map(item)}
      </Secao>
      <Secao icone="fisc-ocorrencias" titulo="QRU da Equipe"
             nota="Os chamados (QRU) que a equipe atendeu."
             acao={<button type="button" className="botao botao--primario qf-mini" onClick={() => aoNova("QRU")}><Icone nome="mais" /> Abrir QRU</button>}>
        {qrus.length === 0 ? <p className="qr-cartao__nota">Nenhum QRU registrado ainda.</p> : qrus.map(item)}
      </Secao>
    </>
  );
}

export default function ChecklistQrFiscal({ token }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [passo, setPasso] = useState(1);
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [novaOc, setNovaOc] = useState(null);       // "PROGRAMADA" | "QRU" com a tela aberta
  const [avisoOc, setAvisoOc] = useState("");
  const relogio = () => new Date().toTimeString().slice(0, 5);

  // Saida
  const [mat1, setMat1] = useState("");
  const [mat2, setMat2] = useState("");
  const [fiscal1, setFiscal1] = useState(null);
  const [fiscal2, setFiscal2] = useState(null);
  const [horaSaida, setHoraSaida] = useState(relogio());
  const [kmSaida, setKmSaida] = useState("");
  const [kmConfere, setKmConfere] = useState(null);
  const [confSaida, setConfSaida] = useState({});
  const [osFila, setOsFila] = useState([]);
  const [fotosFila, setFotosFila] = useState([]);
  const [obsSaida, setObsSaida] = useState("");
  // Servico
  const [obsEquipe, setObsEquipe] = useState("");
  // Chegada
  const [horaChegada, setHoraChegada] = useState(relogio());
  const [kmChegada, setKmChegada] = useState("");
  const [kmChegadaConfere, setKmChegadaConfere] = useState(null);
  const [confChegada, setConfChegada] = useState({});
  const [obsChegada, setObsChegada] = useState("");

  async function carregar(primeira = false) {
    try {
      const r = await api(`/qrcode/fiscal/${encodeURIComponent(token)}`);
      setDados(r);
      if (primeira) {
        setKmSaida(String(r.veiculo.quilometragem_atual ?? ""));
        setConfSaida(conferenciaInicial(r.equipamentos));
        if (r.checklist) {
          setPasso(2);
          setObsEquipe(r.checklist.observacoes_equipe || "");
          const saidaReg = r.checklist.equipamentos.filter((e) => e.etapa === "SAIDA");
          setConfSaida(conferenciaInicial(r.equipamentos, saidaReg));
          setConfChegada(conferenciaInicial(r.equipamentos, saidaReg));
        }
      }
    } catch (e) {
      setErro(e.message);
    }
  }
  useEffect(() => { carregar(true); /* eslint-disable-next-line */ }, [token]);

  const ck = dados?.checklist;
  const equipe = ck?.servico || fiscal1?.escala || null;

  async function registrarSaida() {
    setErro("");
    if (!fiscal1 || !fiscal2) { setErro("Busque a matrícula dos dois fiscais."); return; }
    if (!fiscal1.escala) { setErro(`${fiscal1.nome} não está escalado(a) em nenhum serviço diário de hoje. Procure o coordenador.`); return; }
    if (kmConfere === null) { setErro("Confirme se o KM de saída está correto (Sim ou Não)."); return; }
    setEnviando(true);
    try {
      await api(`/qrcode/fiscal/${encodeURIComponent(token)}/saida`, {
        method: "POST",
        body: { fiscal1: fiscal1.matricula, fiscal2: fiscal2.matricula, hora_saida: horaSaida,
          odometro_saida: Number(kmSaida), equipamentos: paraApi(dados.equipamentos, confSaida), observacoes: obsSaida },
      });
      // OS e fotos da fila sobem agora que o checklist existe. Falha aqui nao
      // desfaz a saida, que ja esta gravada.
      const falhas = [];
      for (const o of osFila) {
        try { await api(`/qrcode/fiscal/${encodeURIComponent(token)}/os`, { method: "POST", body: { ...o, momento: "SAIDA" } }); }
        catch { falhas.push("OS"); }
      }
      if (fotosFila.length) {
        try { await api(`/qrcode/fiscal/${encodeURIComponent(token)}/fotos`, { method: "POST", body: { momento: "SAIDA", fotos: fotosFila.map((f) => f.dataUrl) } }); }
        catch { falhas.push("fotos"); }
      }
      setOsFila([]); setFotosFila([]);
      if (falhas.length) setErro(`A saída foi registrada, mas ${falhas.join(" e ")} não subiram. Tente de novo no passo 2.`);
      const r = await api(`/qrcode/fiscal/${encodeURIComponent(token)}`);
      setDados(r);
      const saidaReg = r.checklist.equipamentos.filter((e) => e.etapa === "SAIDA");
      setConfChegada(conferenciaInicial(r.equipamentos, saidaReg));
      setPasso(2);
      window.scrollTo(0, 0);
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  }

  async function irParaChegada() {
    setErro("");
    try {
      await api(`/qrcode/fiscal/${encodeURIComponent(token)}/observacoes`, { method: "PUT", body: { observacoes_equipe: obsEquipe } });
    } catch (e) { setErro(e.message); return; }
    setPasso(3);
    window.scrollTo(0, 0);
  }
  function irParaFinalizar() {
    setErro("");
    if (!kmChegada || Number(kmChegada) <= ck.odometro_saida) {
      setErro(`Informe o KM de chegada, maior que o de saída (${numero(ck.odometro_saida)} km).`);
      return;
    }
    if (kmChegadaConfere !== true) { setErro("Confirme o KM de chegada (Sim)."); return; }
    setPasso(4);
    window.scrollTo(0, 0);
  }
  async function finalizar() {
    setErro("");
    setEnviando(true);
    try {
      await api(`/qrcode/fiscal/${encodeURIComponent(token)}/finalizar`, {
        method: "POST",
        body: { hora_chegada: horaChegada, odometro_chegada: Number(kmChegada),
          equipamentos: paraApi(dados.equipamentos, confChegada), observacoes_chegada: obsChegada },
      });
      setConcluido(true);
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  }
  const abrirOs = (momento) => async (o) => {
    await api(`/qrcode/fiscal/${encodeURIComponent(token)}/os`, { method: "POST", body: { ...o, momento } });
    await carregar();
  };
  const enviarFotos = (momento) => async (fotos) => {
    await api(`/qrcode/fiscal/${encodeURIComponent(token)}/fotos`, { method: "POST", body: { momento, fotos: fotos.map((f) => f.dataUrl) } });
    await carregar();
  };

  // Resumo do passo 4: saida x chegada de cada item.
  const resumoItens = useMemo(() => {
    if (!dados || !ck) return [];
    const saida = paraApi(dados.equipamentos, confSaida);
    const chegada = paraApi(dados.equipamentos, confChegada);
    return dados.equipamentos.map((e, i) => ({
      nome: e.nome, previsto: previstoDe(e),
      saida: saida[i].quantidade, chegada: chegada[i].quantidade,
    }));
  }, [dados, ck, confSaida, confChegada]);

  if (erro && !dados) {
    return <div className="qr-tela"><div className="qr-tela__aviso qr-tela__aviso--erro">{erro}</div></div>;
  }
  if (!dados) return <div className="carregando">Carregando a viatura...</div>;
  const v = dados.veiculo;

  if (concluido) {
    return (
      <div className="qr-tela">
        <div className="qr-tela__sucesso">
          <Icone nome="check" tamanho={44} />
          <h1>Checklist finalizado</h1>
          <p>A viatura voltou para Disponível. Obrigado, equipe!</p>
          <p className="qr-tela__veiculo">{v.marca} {v.modelo} · {v.placa}</p>
        </div>
      </div>
    );
  }

  const topo = (
    <header className="qf-topo">
      <img src="/icons/logo-sitra.png" alt="SITRA" />
      <span className="qf-topo__hora">
        <Icone nome="calendar" tamanho={18} monocromatico />
        <span>{new Date().toLocaleDateString("pt-BR")}<br />{new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
      </span>
    </header>
  );

  if (novaOc && ck) {
    return (
      <div className="qr-tela qf-tela qf-tela--larga">
        {topo}
        <NovaOcorrenciaQr token={token} tipo={novaOc} veiculo={v} checklist={ck}
                          aoCancelar={() => { setNovaOc(null); window.scrollTo(0, 0); }}
                          aoSalvar={async (r) => {
                            const partes = [`${novaOc === "QRU" ? "QRU" : "Ocorrência"} ${r.protocolo} registrad${novaOc === "QRU" ? "o" : "a"}.`];
                            if (r.qru) partes.push(`QRU relacionado ${r.qru.protocolo} aberto.`);
                            if (r.falhas?.length) partes.push(`Não subiram: ${r.falhas.join(", ")}.`);
                            setAvisoOc(partes.join(" "));
                            setNovaOc(null);
                            await carregar();
                            window.scrollTo(0, 0);
                          }} />
      </div>
    );
  }

  const feito = (n) => (ck ? n === 1 || (n === 2 && passo > 2) || (n === 3 && passo > 3) : false);
  const podeIr = (n) => (ck ? n !== 4 || passo >= 4 : n === 1);
  const travadoSaida = Boolean(ck);
  // Saida conforme: tudo o previsto saiu. Chegada conforme: voltou o que saiu.
  const conformeSaida = resumoItens.every((i) => i.saida >= i.previsto);
  const conformeChegada = resumoItens.every((i) => i.chegada >= i.saida);
  const kmRodado = kmChegada && ck ? Number(kmChegada) - ck.odometro_saida : null;

  return (
    <div className="qr-tela qf-tela">
      {topo}

      <nav className="qf-passos" aria-label="Passos do checklist">
        {PASSOS.map((p, i) => {
          const n = i + 1;
          return (
            <button type="button" key={p} className="qf-passo" data-ativo={passo === n} data-feito={feito(n)}
                    disabled={!podeIr(n)} onClick={() => setPasso(n)}>
              <span className="qf-passo__num">{feito(n) && passo !== n ? <Icone nome="check" tamanho={14} monocromatico /> : n}</span>
              <span className="qf-passo__nome">{p}</span>
            </button>
          );
        })}
      </nav>

      <section className="qr-cartao qf-viatura">
        <span className="qf-viatura__icone"><Icone nome="fisc-viatura" tamanho={34} /></span>
        <div className="qf-viatura__dados">
          <span className="qf-viatura__placa"><strong>{v.placa}</strong><Selo valor={v.status} /></span>
          <span>{v.marca} {v.modelo}</span>
          <small>{[v.ano_modelo, v.tipo_combustivel ? rotulo("combustivel", v.tipo_combustivel) : null, v.cor].filter(Boolean).join(" · ")}</small>
          <span className="qf-viatura__setor">Fiscalização</span>
        </div>
        <div className="qf-viatura__equipe">
          <strong>{equipe ? equipe.equipe : "—"}</strong>
          <small>{equipe ? `${equipe.codigo || ""}${equipe.turno ? ` · ${TURNO[equipe.turno]}` : ""}` : "Equipe"}</small>
        </div>
      </section>

      {erro && <div className="qr-tela__aviso qr-tela__aviso--erro">{erro}</div>}

      {/* ------------------------------------------------ 1. SAIDA */}
      {passo === 1 && (
        <>
          {travadoSaida && <div className="qr-tela__aviso"><Icone nome="informacao" tamanho={18} /><p>Saída registrada às {hhmm(ck.hora_saida)}. Os dados abaixo não mudam mais por aqui.</p></div>}
          <Secao icone="user" titulo="Matrícula da equipe" obrigatorio nota="Informe a matrícula dos dois fiscais da equipe.">
            {travadoSaida ? (
              <div className="qf-fiscais">
                {ck.fiscais.map((f) => (
                  <div className="qf-fiscal__achado" key={f.tipo}><small>{f.tipo === "FISCAL_1" ? "Fiscal 1" : "Fiscal 2"}</small>
                    <strong>{f.nome}</strong><span>Matrícula {f.matricula}</span></div>
                ))}
              </div>
            ) : (
              <div className="qf-fiscais">
                <Fiscal rotulo="Fiscal 1" id="qf-f1" valor={mat1} setValor={setMat1} achado={fiscal1} setAchado={setFiscal1} token={token} />
                <Fiscal rotulo="Fiscal 2" id="qf-f2" valor={mat2} setValor={setMat2} achado={fiscal2} setAchado={setFiscal2} token={token} />
              </div>
            )}
            {!travadoSaida && fiscal1 && !fiscal1.escala && (
              <p className="qr-cartao__nota qr-cartao__nota--alerta">{fiscal1.nome} não está escalado(a) em nenhum serviço diário de hoje.</p>
            )}
          </Secao>

          <Secao icone="historico" titulo="Horário de saída" obrigatorio>
            <input type="time" className="qf-hora" value={travadoSaida ? hhmm(ck.hora_saida) : horaSaida} disabled={travadoSaida}
                   onChange={(e) => setHoraSaida(e.target.value)} aria-label="Horário de saída" />
          </Secao>

          <Secao icone="odometro" titulo="Hodômetro na saída" obrigatorio
                 nota="Informe o KM atual da viatura e confirme se o hodômetro está correto.">
            <div className="qr-km">
              <input type="number" inputMode="numeric" aria-label="KM de saída" readOnly={travadoSaida || kmConfere !== false}
                     value={travadoSaida ? ck.odometro_saida : kmSaida} onChange={(e) => setKmSaida(e.target.value)} />
              <span className="qf-km__unidade">km</span>
              {!travadoSaida && (
                <div className="qr-km__confirma" role="group" aria-label="O KM está correto?">
                  <button type="button" data-ativo={kmConfere === true}
                          onClick={() => { setKmConfere(true); setKmSaida(String(v.quilometragem_atual ?? "")); }}>Sim</button>
                  <button type="button" data-ativo={kmConfere === false} onClick={() => setKmConfere(false)}>Não</button>
                </div>
              )}
            </div>
            {!travadoSaida && <span className="campo__ajuda">Último KM registrado: {numero(v.quilometragem_atual)} km. Marque "Não" para corrigir.</span>}
          </Secao>

          <Secao icone="checklist" titulo="Equipamentos obrigatórios da viatura" obrigatorio nota="Toque no item para marcar como ausente.">
            <Obrigatorios itens={dados.equipamentos} conf={confSaida} setConf={setConfSaida} travado={travadoSaida} />
          </Secao>

          <Secao icone="documento" titulo="Equipamentos utilizados pelos fiscais" obrigatorio nota="Confirme os equipamentos que estão sendo levados na operação.">
            <Utilizados itens={dados.equipamentos} conf={confSaida} setConf={setConfSaida} travado={travadoSaida} />
          </Secao>

          {!travadoSaida && (
            <>
              <AbrirOs fila={osFila} setFila={setOsFila} />
              <Fotos fila={fotosFila} setFila={setFotosFila} />
              <Secao icone="documento" titulo="Observações (opcional)">
                <textarea rows={3} aria-label="Observações da saída" value={obsSaida} maxLength={500}
                          placeholder="Algo fora do normal na viatura?" onChange={(e) => setObsSaida(e.target.value)} />
              </Secao>
            </>
          )}

          <div className="qr-rodape__botoes">
            {travadoSaida ? (
              <button type="button" className="botao botao--primario qr-botao" onClick={() => setPasso(2)}>
                Ir para Ocorrências e QRU <Icone nome="seta-direita" />
              </button>
            ) : (
              <>
                <button type="button" className="botao qr-botao" onClick={() => window.history.back()}>Cancelar</button>
                <button type="button" className="botao botao--primario qr-botao" disabled={enviando} onClick={registrarSaida}>
                  {enviando ? "Registrando..." : "Continuar"} {!enviando && <Icone nome="seta-direita" />}
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* ------------------------------------- 2. OCORRENCIAS E QRU */}
      {passo === 2 && ck && (
        <>
          <Ocorrencias token={token} lista={ck.ocorrencias} aoMudar={() => carregar()} aviso={avisoOc}
                       aoNova={(t) => { setAvisoOc(""); setNovaOc(t); window.scrollTo(0, 0); }} />
          <AbrirOs abertas={ck.os} aoAbrir={abrirOs("SAIDA")} />
          <Fotos enviadas={ck.fotos.SERVICO || 0} aoEnviar={enviarFotos("SERVICO")} />
          <Secao icone="documento" titulo="Observações da equipe (opcional)">
            <textarea rows={3} aria-label="Observações da equipe" value={obsEquipe} maxLength={500}
                      placeholder="Observações da equipe durante o serviço..." onChange={(e) => setObsEquipe(e.target.value)} />
            <span className="campo__ajuda qf-contagem">{obsEquipe.length}/500</span>
          </Secao>
          <div className="qr-rodape__botoes">
            <button type="button" className="botao qr-botao" onClick={() => setPasso(1)}><Icone nome="seta-esquerda" /> Voltar</button>
            <button type="button" className="botao botao--primario qr-botao" onClick={irParaChegada}>
              Continuar para o Checklist de Chegada <Icone nome="seta-direita" />
            </button>
          </div>
        </>
      )}

      {/* ------------------------------------------- 3. CHEGADA */}
      {passo === 3 && ck && (
        <>
          <Secao icone="historico" titulo="Horário de chegada" obrigatorio nota="O horário vem do relógio, mas pode ser ajustado.">
            <input type="time" className="qf-hora" value={horaChegada} onChange={(e) => setHoraChegada(e.target.value)} aria-label="Horário de chegada" />
          </Secao>
          <Secao icone="odometro" titulo="Hodômetro na chegada" obrigatorio
                 nota="Informe o KM atual da viatura e confirme se o hodômetro está correto.">
            <div className="qr-km">
              <input type="number" inputMode="numeric" aria-label="KM de chegada" value={kmChegada}
                     min={ck.odometro_saida + 1} placeholder={`Maior que ${numero(ck.odometro_saida)}`}
                     onChange={(e) => { setKmChegada(e.target.value); setKmChegadaConfere(null); }} />
              <span className="qf-km__unidade">km</span>
              <div className="qr-km__confirma" role="group" aria-label="O KM está correto?">
                <button type="button" data-ativo={kmChegadaConfere === true} onClick={() => setKmChegadaConfere(true)}>Sim</button>
                <button type="button" data-ativo={kmChegadaConfere === false} onClick={() => setKmChegadaConfere(false)}>Não</button>
              </div>
            </div>
            <div className="qf-distancia">
              Distância percorrida: <strong>{kmRodado !== null && kmRodado > 0 ? `${numero(kmRodado)} km` : "—"}</strong>
            </div>
          </Secao>
          <Secao icone="checklist" titulo="Equipamentos obrigatórios da viatura (retorno)" obrigatorio nota="Toque no item para marcar como ausente.">
            <Obrigatorios itens={dados.equipamentos} conf={confChegada} setConf={setConfChegada} />
          </Secao>
          <Secao icone="documento" titulo="Equipamentos utilizados pelos fiscais (retorno)" obrigatorio nota="Confirme os equipamentos que estão retornando com a equipe.">
            <Utilizados itens={dados.equipamentos} conf={confChegada} setConf={setConfChegada} />
          </Secao>
          <AbrirOs abertas={ck.os.filter((o) => o.momento === "CHEGADA")} aoAbrir={abrirOs("CHEGADA")} />
          <Fotos enviadas={ck.fotos.CHEGADA || 0} aoEnviar={enviarFotos("CHEGADA")} />
          <Secao icone="documento" titulo="Observações (opcional)">
            <textarea rows={3} aria-label="Observações da chegada" value={obsChegada} maxLength={500}
                      placeholder="Algo relevante na chegada?" onChange={(e) => setObsChegada(e.target.value)} />
            <span className="campo__ajuda qf-contagem">{obsChegada.length}/500</span>
          </Secao>
          <div className="qr-rodape__botoes">
            <button type="button" className="botao qr-botao" onClick={() => setPasso(2)}><Icone nome="seta-esquerda" /> Voltar</button>
            <button type="button" className="botao botao--primario qr-botao" onClick={irParaFinalizar}>
              Continuar para Finalizar <Icone nome="seta-direita" />
            </button>
          </div>
        </>
      )}

      {/* ------------------------------------------- 4. FINALIZAR */}
      {passo === 4 && ck && (
        <>
          <Secao icone="checklist" titulo="Resumo do Serviço">
            <dl className="qf-resumo">
              <div><dt>Serviço</dt><dd>{ck.servico?.codigo || "—"}</dd></div>
              <div><dt>Equipe</dt><dd>{ck.servico?.equipe || "—"}</dd></div>
              <div><dt>Fiscais</dt><dd>{ck.fiscais.map((f) => `${f.nome} (${f.matricula})`).join(", ")}</dd></div>
              <div><dt>Data</dt><dd>{dataBr(ck.data_abertura)}</dd></div>
              <div><dt>Turno</dt><dd>{TURNO[ck.servico?.turno] || "—"}</dd></div>
              <div><dt>Horário de saída</dt><dd>{hhmm(ck.hora_saida)}</dd></div>
              <div><dt>Horário de chegada</dt><dd>{horaChegada}</dd></div>
              <div><dt>Tempo de serviço</dt><dd>{duracao(ck.hora_saida, horaChegada)}</dd></div>
            </dl>
          </Secao>
          <Secao icone="odometro" titulo="Hodômetro">
            <dl className="qf-linhas">
              <div><dt>KM de saída</dt><dd>{numero(ck.odometro_saida)} km</dd></div>
              <div><dt>KM de chegada</dt><dd>{numero(Number(kmChegada))} km</dd></div>
              <div><dt>Distância percorrida</dt><dd>{numero(kmRodado)} km</dd></div>
            </dl>
          </Secao>
          <Secao icone="documento" titulo="Equipamentos">
            <div className="qf-itens-resumo">
              <div className="qf-itens-resumo__cab"><span>Item</span><span>Saída</span><span>Chegada</span></div>
              {resumoItens.map((i) => (
                <div key={i.nome} data-diferente={i.chegada < i.saida}>
                  <span><Icone nome={iconeDoItem(i.nome)} tamanho={18} /> {i.nome}</span>
                  <span>{i.saida} un</span><span>{i.chegada} un</span>
                </div>
              ))}
            </div>
          </Secao>
          <Secao icone="checklist" titulo="Checklists">
            <dl className="qf-linhas">
              <div><dt>Checklist de Saída</dt><dd><Selo texto={conformeSaida ? "Conforme" : "Com pendência"} tom={conformeSaida ? "verde" : "amarelo"} /></dd></div>
              <div><dt>Checklist de Chegada</dt><dd><Selo texto={conformeChegada ? "Conforme" : "Com pendência"} tom={conformeChegada ? "verde" : "amarelo"} /></dd></div>
            </dl>
          </Secao>
          <section className="qr-cartao qf-totais">
            <button type="button" onClick={() => setPasso(2)}><Icone nome="alert-triangle" tamanho={20} /><span>Ocorrências<small>Total de ocorrências</small></span><strong>{ck.ocorrencias.filter((o) => o.tipo !== "QRU").length}</strong><Icone nome="chevron-right" tamanho={14} /></button>
            <button type="button" onClick={() => setPasso(2)}><Icone nome="fisc-ocorrencias" tamanho={20} /><span>QRU<small>Total de QRUs</small></span><strong>{ck.ocorrencias.filter((o) => o.tipo === "QRU").length}</strong><Icone nome="chevron-right" tamanho={14} /></button>
            <button type="button" onClick={() => setPasso(2)}><Icone nome="kpi-wrench" tamanho={20} /><span>OS<small>Total de OS</small></span><strong>{ck.os.length}</strong><Icone nome="chevron-right" tamanho={14} /></button>
            <div><Icone nome="documento" tamanho={20} /><span>Fotos<small>Total de fotos</small></span><strong>{(ck.fotos.SAIDA || 0) + (ck.fotos.SERVICO || 0) + (ck.fotos.CHEGADA || 0)}</strong></div>
          </section>
          {(ck.observacoes_equipe || obsEquipe || obsChegada) && (
            <Secao icone="documento" titulo="Observações finais">
              {(obsEquipe || ck.observacoes_equipe) && <p className="qf-obs">{obsEquipe || ck.observacoes_equipe}</p>}
              {obsChegada && <p className="qf-obs">{obsChegada}</p>}
            </Secao>
          )}
          <div className="qr-rodape__botoes">
            <button type="button" className="botao qr-botao" onClick={() => setPasso(3)}><Icone nome="seta-esquerda" /> Voltar</button>
            <button type="button" className="botao botao--primario qr-botao" disabled={enviando} onClick={finalizar}>
              <Icone nome="check" /> {enviando ? "Finalizando..." : "Finalizar Checklist"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
