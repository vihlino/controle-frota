/**
 * NovaOcorrenciaQr.jsx - "Nova Ocorrencia" no checklist da viatura pelo QR
 * Code (desenho do Cesar, 21/10). Aberta no passo 2 (Ocorrencias e QRU).
 *
 * Como no desenho: dados da viatura e da equipe, tipo da ocorrencia (icones
 * padrao para todas as equipes), local (com a localizacao do aparelho),
 * descricao, envolvidos, fotos, documentos e "Abrir QRU relacionado" - que
 * cria um QRU ligado a esta ocorrencia, no mesmo local e com a mesma equipe.
 * Ao lado, as informacoes da ocorrencia: data, hora (ajustavel), local, KM
 * atual da viatura e a situacao.
 *
 * Grava a ocorrencia primeiro (dados e envolvidos) e depois sobe cada foto e
 * cada documento. Se um arquivo falhar, a ocorrencia continua gravada e a
 * tela avisa o que nao subiu.
 */
import { useRef, useState } from "react";
import Icone from "../components/Icone.jsx";
import Selo from "../components/Selo.jsx";
import { api } from "../lib/api.js";
import { numero, rotulo } from "../lib/formato.js";
import { reduzirImagem, pesoLegivel } from "../lib/imagem.js";
import { ACEITAR, conferirArquivo, lerComoDataUrl, tamanhoArquivo } from "../lib/arquivos.js";
import { CATEGORIAS_OCORRENCIA, SENTIDOS_VIA, TIPOS_ENVOLVIDO, rotuloEnvolvido } from "../lib/ocorrencias.js";

const MAX_FOTOS = 6;
const MAX_DOCS = 5;
const MAX_DESCRICAO = 1000;

function Cartao({ icone, titulo, nota, obrigatorio, acao, children, className = "" }) {
  return (
    <section className={`qr-cartao no-cartao ${className}`}>
      <header className="no-cartao__topo">
        <span className="no-cartao__icone"><Icone nome={icone} tamanho={24} /></span>
        <div className="no-cartao__textos">
          <h2>{titulo}{obrigatorio && <span className="qf-obrig"> *</span>}</h2>
          {nota && <p>{nota}</p>}
        </div>
        {acao}
      </header>
      {children}
    </section>
  );
}

export default function NovaOcorrenciaQr({ token, tipo, veiculo, checklist, aoCancelar, aoSalvar }) {
  const qru = tipo === "QRU";
  const agora = new Date();
  const [form, setForm] = useState({
    categoria: "", endereco: "", bairro: "", referencia: "", sentido_via: "",
    descricao: "", hora: agora.toTimeString().slice(0, 5), latitude: null, longitude: null, abrir_qru: false,
  });
  const [envolvidos, setEnvolvidos] = useState([]);
  const [novoEnvolvido, setNovoEnvolvido] = useState(null);
  const [fotos, setFotos] = useState([]);
  const [docs, setDocs] = useState([]);
  const [preparando, setPreparando] = useState(false);
  const [localizando, setLocalizando] = useState(false);
  const [salvando, setSalvando] = useState("");
  const [erro, setErro] = useState("");
  const topo = useRef(null);
  const mudar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  const f1 = checklist.fiscais.find((f) => f.tipo === "FISCAL_1");
  const f2 = checklist.fiscais.find((f) => f.tipo === "FISCAL_2");
  const servico = checklist.servico || {};

  function usarLocalizacao() {
    setErro("");
    if (!navigator.geolocation) { setErro("Este aparelho não informa a localização."); return; }
    setLocalizando(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const lat = Number(p.coords.latitude.toFixed(6));
        const lon = Number(p.coords.longitude.toFixed(6));
        setForm((f) => ({
          ...f, latitude: lat, longitude: lon,
          endereco: f.endereco.trim() ? f.endereco : `Localização do aparelho: ${lat}, ${lon}`,
        }));
        setLocalizando(false);
      },
      () => { setErro("Não foi possível pegar a localização. Verifique se o aparelho permite e digite o endereço."); setLocalizando(false); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  async function escolherFotos(ev) {
    const arquivos = Array.from(ev.target.files || []);
    ev.target.value = "";
    const cabem = MAX_FOTOS - fotos.length;
    if (!arquivos.length || cabem <= 0) return;
    setPreparando(true); setErro("");
    try {
      const novas = [];
      for (const a of arquivos.slice(0, cabem)) novas.push({ ...(await reduzirImagem(a)), nome: a.name || "foto.jpg" });
      setFotos((l) => [...l, ...novas]);
    } catch (e) { setErro(e.message); } finally { setPreparando(false); }
  }
  function escolherDocs(ev) {
    const arquivos = Array.from(ev.target.files || []);
    ev.target.value = "";
    setErro("");
    const erros = arquivos.map(conferirArquivo).filter(Boolean);
    if (erros.length) setErro(erros.join(" "));
    const bons = arquivos.filter((a) => !conferirArquivo(a));
    setDocs((l) => [...l, ...bons].slice(0, MAX_DOCS));
  }

  function adicionarEnvolvido() {
    if (!novoEnvolvido.identificacao.trim()) { setErro("Informe o nome ou a identificação do envolvido."); return; }
    setErro("");
    setEnvolvidos((l) => [...l, novoEnvolvido]);
    setNovoEnvolvido(null);
  }

  async function salvar() {
    setErro("");
    const faltando = [];
    if (!qru && !form.categoria) faltando.push("o tipo de ocorrência");
    if (!form.endereco.trim()) faltando.push("o local");
    if (form.descricao.trim().length < 5) faltando.push("a descrição");
    if (!/^\d{2}:\d{2}$/.test(form.hora)) faltando.push("a hora");
    if (faltando.length) {
      setErro(`Informe ${faltando.join(", ")}.`);
      topo.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const lista = novoEnvolvido?.identificacao?.trim() ? [...envolvidos, novoEnvolvido] : envolvidos;
    setSalvando("Salvando a ocorrência...");
    let criada;
    try {
      criada = await api(`/qrcode/fiscal/${encodeURIComponent(token)}/ocorrencia`, {
        method: "POST",
        body: { ...form, categoria: form.categoria || (qru ? null : "OUTRO"), tipo, envolvidos: lista, abrir_qru: !qru && form.abrir_qru },
      });
    } catch (e) {
      setErro(e.message); setSalvando("");
      topo.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    // Arquivos: um por vez (o documento pode ter ate 10 MB).
    const falhas = [];
    const caminho = `/qrcode/fiscal/${encodeURIComponent(token)}/ocorrencia/${criada.id_ocorrencia}/arquivos`;
    for (let i = 0; i < fotos.length; i++) {
      setSalvando(`Enviando foto ${i + 1} de ${fotos.length}...`);
      try { await api(caminho, { method: "POST", body: { categoria: "FOTO", nome: fotos[i].nome, dataUrl: fotos[i].dataUrl } }); }
      catch { falhas.push(`foto ${i + 1}`); }
    }
    for (let i = 0; i < docs.length; i++) {
      setSalvando(`Enviando documento ${i + 1} de ${docs.length}...`);
      try { await api(caminho, { method: "POST", body: { categoria: "DOCUMENTO", nome: docs[i].name, dataUrl: await lerComoDataUrl(docs[i]) } }); }
      catch { falhas.push(docs[i].name); }
    }
    setSalvando("");
    aoSalvar({ ...criada, falhas });
  }

  const local = form.endereco.trim();
  return (
    <div className="no-tela" ref={topo}>
      <div className="no-cabecalho">
        <button type="button" className="botao no-voltar" onClick={aoCancelar}><Icone nome="seta-esquerda" /> Voltar</button>
        <div>
          <h1>{qru ? "Novo QRU" : "Nova Ocorrência"}</h1>
          <p>{qru ? "Registre o chamado (QRU) atendido pela equipe." : "Registre a ocorrência identificada durante o serviço."}</p>
        </div>
      </div>

      {erro && <div className="qr-tela__aviso qr-tela__aviso--erro">{erro}</div>}

      <div className="no-grade">
        <div className="no-principal">
          <Cartao icone="kpi-car" titulo="Dados da viatura e equipe">
            <div className="no-viatura">
              <span className="qf-viatura__icone"><Icone nome="fisc-viatura" tamanho={34} /></span>
              <div className="qf-viatura__dados">
                <span className="qf-viatura__placa"><strong>{veiculo.placa}</strong><Selo valor={veiculo.status} /></span>
                <span>{veiculo.marca} {veiculo.modelo}</span>
                <small>{[veiculo.ano_modelo, veiculo.tipo_combustivel ? rotulo("combustivel", veiculo.tipo_combustivel) : null, veiculo.cor].filter(Boolean).join(" · ")}</small>
                <span className="qf-viatura__setor">Fiscalização</span>
              </div>
              <div className="no-viatura__equipe">
                <strong>{servico.equipe || "—"}</strong>
                <small>{servico.codigo || ""}</small>
              </div>
            </div>
            <div className="no-fiscais">
              <div><label>Fiscal 1</label><span>{f1 ? `${f1.matricula} - ${f1.nome}` : "—"}</span></div>
              <div><label>Fiscal 2</label><span>{f2 ? `${f2.matricula} - ${f2.nome}` : "—"}</span></div>
            </div>
          </Cartao>

          <Cartao icone="alert-triangle" titulo="Tipo de ocorrência" obrigatorio={!qru}>
            <div className="no-tipos" role="radiogroup" aria-label="Tipo de ocorrência">
              {CATEGORIAS_OCORRENCIA.map((c) => (
                <button type="button" key={c.valor} role="radio" aria-checked={form.categoria === c.valor}
                        className="no-tipo" data-ativo={form.categoria === c.valor}
                        onClick={() => setForm((f) => ({ ...f, categoria: c.valor }))}>
                  <Icone nome={c.icone} tamanho={22} /> <span>{c.rotulo.replace("/", "/\u200b")}</span>
                </button>
              ))}
            </div>
          </Cartao>
        </div>

        <aside className="qr-cartao no-info">
          <h2>Informações da ocorrência</h2>
          <dl>
            <div><dt><Icone nome="calendar" tamanho={22} /></dt><dd><strong>Data</strong><span>{agora.toLocaleDateString("pt-BR")}</span></dd></div>
            <div>
              <dt><Icone nome="historico" tamanho={22} /></dt>
              <dd>
                <label htmlFor="no-hora"><strong>Hora</strong></label>
                <input id="no-hora" type="time" className="no-hora" value={form.hora} onChange={mudar("hora")} />
                <small>Pode ser ajustada se necessário.</small>
              </dd>
            </div>
            <div><dt><Icone nome="oc-local" tamanho={22} /></dt><dd><strong>Local da ocorrência</strong><span>{local || "—"}</span>{!local && <small>Será preenchido abaixo.</small>}</dd></div>
            <div><dt><Icone nome="odometro" tamanho={22} /></dt><dd><strong>KM atual da viatura</strong><span>{numero(veiculo.quilometragem_atual)} km</span></dd></div>
            <div><dt><Icone nome="documento" tamanho={22} /></dt><dd><strong>Status</strong><span className="no-status">Em registro</span></dd></div>
          </dl>
        </aside>
      </div>

      <Cartao icone="oc-local" titulo="Local da ocorrência" obrigatorio>
        <div className="no-local">
          <input aria-label="Endereço da ocorrência" placeholder="Ex.: Av. Brasil, nº 3200, Centro" maxLength={200}
                 value={form.endereco} onChange={mudar("endereco")} />
          <button type="button" className="botao no-gps" onClick={usarLocalizacao} disabled={localizando}>
            <Icone nome="oc-mira" tamanho={20} /> {localizando ? "Localizando..." : "Usar localização atual"}
          </button>
        </div>
        {form.latitude !== null && (
          <p className="qf-ok"><Icone nome="check" tamanho={16} /> Localização do aparelho registrada ({form.latitude}, {form.longitude}).</p>
        )}
        <div className="no-local__linha">
          <div className="no-campo"><label htmlFor="no-bairro">Bairro</label>
            <input id="no-bairro" placeholder="Ex.: Centro" maxLength={120} value={form.bairro} onChange={mudar("bairro")} /></div>
          <div className="no-campo"><label htmlFor="no-ref">Referência (opcional)</label>
            <input id="no-ref" placeholder="Ex.: Próximo ao posto" maxLength={255} value={form.referencia} onChange={mudar("referencia")} /></div>
          <div className="no-campo"><label htmlFor="no-sentido">Sentido da via (opcional)</label>
            <select id="no-sentido" value={form.sentido_via} onChange={mudar("sentido_via")}>
              <option value="">Selecione</option>
              {SENTIDOS_VIA.map((s) => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
            </select></div>
        </div>
      </Cartao>

      <Cartao icone="documento" titulo="Descrição da ocorrência" obrigatorio>
        <textarea aria-label="Descrição da ocorrência" rows={4} maxLength={MAX_DESCRICAO} value={form.descricao} onChange={mudar("descricao")}
                  placeholder="Descreva o que aconteceu, incluindo, se possível, pessoas envolvidas, placas, atitudes e outras informações relevantes..." />
        <span className="campo__ajuda qf-contagem">{form.descricao.length}/{MAX_DESCRICAO}</span>
      </Cartao>

      <Cartao icone="equipe" titulo="Envolvidos (opcional)" nota="Adicione informações de outros veículos, condutores, passageiros ou terceiros."
              acao={!novoEnvolvido && (
                <button type="button" className="botao no-acao" onClick={() => setNovoEnvolvido({ tipo: "CONDUTOR", identificacao: "", placa_documento: "" })}>
                  <Icone nome="mais" /> Adicionar envolvido
                </button>
              )}>
        {novoEnvolvido && (
          <div className="no-envolvido-form">
            <div className="no-campo"><label htmlFor="no-env-tipo">Tipo</label>
              <select id="no-env-tipo" value={novoEnvolvido.tipo} onChange={(e) => setNovoEnvolvido((n) => ({ ...n, tipo: e.target.value }))}>
                {TIPOS_ENVOLVIDO.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
              </select></div>
            <div className="no-campo"><label htmlFor="no-env-nome">Nome / Identificação *</label>
              <input id="no-env-nome" maxLength={150} placeholder="Ex.: João da Silva" value={novoEnvolvido.identificacao}
                     onChange={(e) => setNovoEnvolvido((n) => ({ ...n, identificacao: e.target.value }))} /></div>
            <div className="no-campo"><label htmlFor="no-env-doc">Placa / Documento</label>
              <input id="no-env-doc" maxLength={60} placeholder="Ex.: ABC1D23 ou CPF" value={novoEnvolvido.placa_documento}
                     onChange={(e) => setNovoEnvolvido((n) => ({ ...n, placa_documento: e.target.value }))} /></div>
            <div className="qr-chamado-form__botoes no-envolvido-form__botoes">
              <button type="button" className="botao" onClick={() => setNovoEnvolvido(null)}>Cancelar</button>
              <button type="button" className="botao botao--primario" onClick={adicionarEnvolvido}><Icone nome="mais" /> Adicionar</button>
            </div>
          </div>
        )}
        <div className="no-tabela" role="table" aria-label="Envolvidos">
          <div className="no-tabela__cab" role="row"><span>Tipo</span><span>Nome / Identificação</span><span>Placa / Documento</span><span>Ações</span></div>
          {envolvidos.length === 0 ? <div className="no-tabela__vazio">Nenhum envolvido adicionado.</div> : envolvidos.map((e, i) => (
            <div className="no-tabela__linha" role="row" key={i}>
              <span>{rotuloEnvolvido(e.tipo)}</span><span>{e.identificacao}</span><span>{e.placa_documento || "—"}</span>
              <span><button type="button" className="qr-chamado__remover" aria-label={`Remover ${e.identificacao}`}
                            onClick={() => setEnvolvidos((l) => l.filter((_, j) => j !== i))}><Icone nome="lixo" tamanho={16} /></button></span>
            </div>
          ))}
        </div>
      </Cartao>

      <Cartao icone="oc-camera" titulo="Fotos (opcional)" nota={`Registre fotos da ocorrência. Até ${MAX_FOTOS} fotos.`}>
        {fotos.length > 0 && (
          <div className="qr-fotos">
            {fotos.map((f, i) => (
              <figure className="qr-foto-item" key={i}>
                <img src={f.dataUrl} alt={`Foto ${i + 1}`} />
                <button type="button" className="qr-foto-item__remover" aria-label={`Remover foto ${i + 1}`}
                        onClick={() => setFotos((l) => l.filter((_, j) => j !== i))}><Icone nome="fechar" tamanho={15} /></button>
                <figcaption>{pesoLegivel(f.bytes)}</figcaption>
              </figure>
            ))}
          </div>
        )}
        {fotos.length < MAX_FOTOS && (
          <label className="qr-foto no-soltar" data-ocupado={preparando}>
            <input type="file" accept="image/*" capture="environment" multiple onChange={escolherFotos} disabled={preparando} />
            <Icone nome={preparando ? "ajuda" : "mais"} tamanho={26} />
            <span>{preparando ? "Preparando a imagem..." : "Tirar foto ou escolher do aparelho"}</span>
          </label>
        )}
        <small className="no-dica">Até {MAX_FOTOS} fotos. A foto é reduzida no próprio aparelho antes de subir.</small>
      </Cartao>

      <Cartao icone="documento" titulo="Documentos (opcional)" nota="Anexe documentos relacionados (ex.: auto de infração, notificação, etc.).">
        {docs.length > 0 && (
          <ul className="no-docs">
            {docs.map((d, i) => (
              <li key={i}>
                <Icone nome="documento" tamanho={18} />
                <span><strong>{d.name}</strong><small>{tamanhoArquivo(d.size)}</small></span>
                <button type="button" className="qr-chamado__remover" aria-label={`Remover ${d.name}`}
                        onClick={() => setDocs((l) => l.filter((_, j) => j !== i))}><Icone nome="lixo" tamanho={16} /></button>
              </li>
            ))}
          </ul>
        )}
        {docs.length < MAX_DOCS && (
          <label className="qr-foto no-soltar">
            <input type="file" accept={ACEITAR} multiple onChange={escolherDocs} />
            <Icone nome="mais" tamanho={26} />
            <span>Escolher arquivo</span>
          </label>
        )}
        <small className="no-dica">PDF, JPG ou PNG. Tamanho máximo: 10 MB por arquivo.</small>
      </Cartao>

      {!qru && (
        <label className="qr-cartao no-qru">
          <input type="checkbox" checked={form.abrir_qru} onChange={(e) => setForm((f) => ({ ...f, abrir_qru: e.target.checked }))} />
          <span><strong>Abrir QRU relacionado</strong><small>Deseja abrir um QRU para esta ocorrência?</small></span>
        </label>
      )}

      <div className="qr-rodape__botoes no-rodape">
        <button type="button" className="botao qr-botao" onClick={aoCancelar} disabled={!!salvando}>Cancelar</button>
        <button type="button" className="botao botao--primario qr-botao" onClick={salvar} disabled={!!salvando}>
          <Icone nome="check" /> {salvando || (qru ? "Salvar QRU" : "Salvar Ocorrência")}
        </button>
      </div>
    </div>
  );
}
