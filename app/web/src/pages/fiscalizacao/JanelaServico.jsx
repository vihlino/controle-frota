/**
 * JanelaServico.jsx - Janela de Novo / Editar servico diario.
 *
 * 21/10 (pedido do Cesar): o servico e aberto para UMA equipe por vez, com a
 * viatura, as ocorrencias designadas para ela, a equipe de apoio, observacoes
 * e fotos. Nao ha mais "Iniciar servico": a equipe entra em servico quando
 * toca em "Continuar" no checklist da viatura (QR Code) e sai ao finalizar.
 *
 * Campos: Informacoes do Servico (data, turno, horario do turno, viatura,
 * equipe, coordenador - muda todo dia, 21/10), Ocorrencias (todas menos as finalizadas; as com intercorrencia
 * voltam para a lista), Equipe de Apoio, Observacoes e Fotos (opcionais).
 */
import { useEffect, useMemo, useState } from "react";
import Modal from "../../components/Modal.jsx";
import Icone from "../../components/Icone.jsx";
import Selo from "../../components/Selo.jsx";
import { useConfirmacaoSenha } from "../../components/ConfirmarSenha.jsx";
import { Selecao, Data, Texto, Area } from "../../components/Campos.jsx";
import { api, apiArquivo } from "../../lib/api.js";
import { data, hora } from "../../lib/formato.js";
import { reduzirImagem, pesoLegivel } from "../../lib/imagem.js";
import { rotuloCategoria } from "../../lib/ocorrencias.js";
import { TURNOS_EQUIPE } from "./Equipes.jsx";

// Os valores que a tabela `servico_diario` aceita (chk_servico_turno).
export const TURNOS_SERVICO = [
  { valor: "DIURNO", rotulo: "Diurno" },
  { valor: "NOTURNO", rotulo: "Noturno" },
];
export const ROTULO_TURNO = Object.fromEntries(TURNOS_SERVICO.map((t) => [t.valor, t.rotulo]));
export const HORARIO_TURNO = { DIURNO: "06:00 às 19:00", NOTURNO: "19:00 às 23:59" };
const MAX_FOTOS = 6;

/**
 * Encerrar (servico em andamento sem o checklist finalizado) ou cancelar
 * (servico que ainda nao comecou) o servico de UMA equipe. Pede a senha.
 * @returns {Promise<boolean>} true se mudou.
 */
export async function mudarSituacaoServico(pedirSenha, linha, acao) {
  const cancelar = acao === "CANCELAR";
  const ok = await pedirSenha({
    titulo: cancelar ? "Cancelar serviço" : "Encerrar serviço",
    aviso: cancelar
      ? `Cancelar o serviço ${linha.codigo} (${linha.equipe})? As ocorrências designadas voltam para Pendente.`
      : `Encerrar o serviço ${linha.codigo} (${linha.equipe})? O horário fica registrado.`,
  });
  if (!ok) return false;
  try {
    await api(`/fiscalizacao/servico-diario/equipe/${linha.id_servico_equipe}/situacao`, { method: "PUT", body: { acao } });
    return true;
  } catch (e) {
    alert(e.message);
    return false;
  }
}

export default function JanelaServico({ idServicoEquipe, aoFechar, aoSalvar }) {
  const { pedirSenha, elemento: modalSenha } = useConfirmacaoSenha();
  const [equipes, setEquipes] = useState(null);
  const [viaturas, setViaturas] = useState([]);
  const [servidores, setServidores] = useState([]);
  const [ocorrencias, setOcorrencias] = useState(null);
  const [form, setForm] = useState(null);
  const [travado, setTravado] = useState(false);     // ja teve checklist: data/turno/equipe nao mudam
  const [busca, setBusca] = useState("");
  const [fotos, setFotos] = useState([]);            // novas, ainda nao enviadas
  const [fotosSalvas, setFotosSalvas] = useState([]);
  const [miniaturas, setMiniaturas] = useState({});
  const [preparando, setPreparando] = useState(false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const comoLista = (r) => (Array.isArray(r) ? r : []);
    api("/frotas/veiculos/opcoes?viatura=true").then((r) => setViaturas(comoLista(r))).catch(() => {});
    api("/admin/servidores/opcoes?status=true").then((r) => setServidores(comoLista(r))).catch(() => {});
    api(`/fiscalizacao/servico-diario/ocorrencias-disponiveis${idServicoEquipe ? `?servico=${idServicoEquipe}` : ""}`)
      .then((r) => setOcorrencias(comoLista(r))).catch(() => setOcorrencias([]));
    api("/fiscalizacao/equipes/opcoes?status=true")
      .then(async (r) => {
        setEquipes(comoLista(r));
        if (idServicoEquipe) {
          const s = await api(`/fiscalizacao/servico-diario/equipe/${idServicoEquipe}`);
          setTravado(s.checklists > 0);
          setForm({
            data: String(s.data).slice(0, 10), turno: s.turno, id_veiculo: s.id_veiculo ? String(s.id_veiculo) : "",
            id_equipe: String(s.id_equipe), id_equipe_apoio: s.id_equipe_apoio ? String(s.id_equipe_apoio) : "",
            id_coordenador: s.id_coordenador ? String(s.id_coordenador) : "",
            observacoes: s.observacoes || "", ocorrencias: (s.ocorrencias || []).map(Number), numero: s.numero,
          });
          const fs = await api(`/fiscalizacao/servico-diario/equipe/${idServicoEquipe}/fotos`).catch(() => []);
          setFotosSalvas(comoLista(fs));
        } else {
          setForm({
            data: new Date().toLocaleDateString("sv-SE"), turno: "", id_veiculo: "", id_equipe: "", id_coordenador: "",
            id_equipe_apoio: "", observacoes: "", ocorrencias: [],
          });
        }
      })
      .catch((e) => setErro(e.message));
  }, [idServicoEquipe]);

  // Miniaturas das fotos ja salvas (a rota exige o token: baixa como blob).
  useEffect(() => {
    let vivo = true;
    const criadas = [];
    (async () => {
      for (const f of fotosSalvas) {
        try {
          const u = await apiArquivo(`/fiscalizacao/servico-diario/fotos/${f.id_foto}`);
          criadas.push(u);
          if (vivo) setMiniaturas((m) => ({ ...m, [f.id_foto]: u }));
        } catch { /* sem miniatura */ }
      }
    })();
    return () => { vivo = false; criadas.forEach((u) => URL.revokeObjectURL(u)); };
  }, [fotosSalvas]);

  // Servico novo: escolhidos a data e o turno, sugere o coordenador que ja
  // esta no servico daquele dia/turno (pode trocar).
  useEffect(() => {
    if (idServicoEquipe || !form?.data || !form?.turno || form.id_coordenador) return;
    api(`/fiscalizacao/servico-diario/coordenador-do-turno?data=${form.data}&turno=${form.turno}`)
      .then((r) => r?.id_coordenador && setForm((f) => (f.id_coordenador ? f : { ...f, id_coordenador: String(r.id_coordenador) })))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.data, form?.turno]);

  const mudar = (nome, valor) => setForm((f) => ({ ...f, [nome]: valor }));
  const campo = (nome) => ({ value: form?.[nome] ?? "", onChange: (e) => mudar(nome, e.target.value) });
  const marcar = (id) => mudar("ocorrencias", form.ocorrencias.includes(id) ? form.ocorrencias.filter((x) => x !== id) : [...form.ocorrencias, id]);

  const opcoesEquipe = useMemo(() => (equipes || []).map((e) => {
    const t = TURNOS_EQUIPE.find((x) => x.valor === e.turno);
    const fiscais = [e.fiscal1_nome, e.fiscal2_nome].filter(Boolean).join(" e ");
    return { valor: String(e.id_equipe), rotulo: `${e.numero}${t ? ` · ${t.curto}` : ""}${fiscais ? ` · ${fiscais}` : ""}` };
  }), [equipes]);
  const opcoesApoio = useMemo(() => (equipes || [])
    .filter((e) => String(e.id_equipe) !== form?.id_equipe)
    .sort((a, b) => Number(b.apoio) - Number(a.apoio))
    .map((e) => ({ valor: String(e.id_equipe), rotulo: `${e.numero}${e.apoio ? ` · Apoio${e.policial ? ` (${e.policial})` : ""}` : ""}` })),
  [equipes, form?.id_equipe]);
  const opcoesViatura = viaturas
    .filter((v) => v.status !== "INATIVO" || String(v.id_veiculo) === form?.id_veiculo)
    .map((v) => ({ valor: String(v.id_veiculo), rotulo: `${v.placa} - ${v.marca || ""} ${v.modelo}${v.status === "EM_MANUTENCAO" ? " (em manutenção)" : ""}` }));

  const listaOc = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return (ocorrencias || []).filter((o) => !b || [o.protocolo, o.descricao, o.endereco, o.bairro, o.equipe_atual]
      .some((x) => String(x || "").toLowerCase().includes(b)));
  }, [ocorrencias, busca]);

  async function escolherFotos(ev) {
    const arquivos = Array.from(ev.target.files || []);
    ev.target.value = "";
    const cabem = MAX_FOTOS - fotos.length - fotosSalvas.length;
    if (!arquivos.length || cabem <= 0) return;
    setPreparando(true);
    try {
      const novas = [];
      for (const a of arquivos.slice(0, cabem)) novas.push({ ...(await reduzirImagem(a)), nome: a.name });
      setFotos((l) => [...l, ...novas]);
    } catch (e) { setErro(e.message); } finally { setPreparando(false); }
  }
  async function removerSalva(f) {
    if (!(await pedirSenha({ titulo: "Remover foto", aviso: "Confirme sua senha para remover a foto do serviço." }))) return;
    try {
      await api(`/fiscalizacao/servico-diario/fotos/${f.id_foto}`, { method: "DELETE" });
      setFotosSalvas((l) => l.filter((x) => x.id_foto !== f.id_foto));
    } catch (e) { setErro(e.message); }
  }

  async function salvar(e) {
    e.preventDefault();
    const falta = [];
    if (!form.data) falta.push("a data");
    if (!form.turno) falta.push("o turno");
    if (!form.id_veiculo) falta.push("a viatura");
    if (!form.id_equipe) falta.push("a equipe");
    if (!form.id_coordenador) falta.push("o coordenador");
    if (falta.length) { setErro(`Informe ${falta.join(", ")}.`); return; }
    const ok = await pedirSenha({
      titulo: idServicoEquipe ? "Salvar alterações" : "Abrir serviço diário",
      aviso: "Confirme sua senha para salvar o serviço diário.",
    });
    if (!ok) return;
    setSalvando(true);
    setErro("");
    try {
      const corpo = {
        data: form.data, turno: form.turno, id_veiculo: Number(form.id_veiculo), id_equipe: Number(form.id_equipe),
        id_equipe_apoio: form.id_equipe_apoio ? Number(form.id_equipe_apoio) : null,
        id_coordenador: Number(form.id_coordenador),
        observacoes: form.observacoes, ocorrencias: form.ocorrencias,
      };
      const r = idServicoEquipe
        ? await api(`/fiscalizacao/servico-diario/equipe/${idServicoEquipe}`, { method: "PUT", body: corpo })
        : await api("/fiscalizacao/servico-diario/equipe", { method: "POST", body: corpo });
      if (fotos.length) {
        try {
          await api(`/fiscalizacao/servico-diario/equipe/${r.id_servico_equipe}/fotos`, {
            method: "POST", body: { fotos: fotos.map((f) => ({ nome: f.nome, dataUrl: f.dataUrl })) },
          });
        } catch (x) {
          alert(`O serviço foi salvo, mas as fotos não subiram: ${x.message}`);
        }
      }
      aoSalvar?.(r);
      aoFechar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  const carregando = !form || !equipes || ocorrencias === null;
  return (
    <>
      <Modal
        titulo={idServicoEquipe ? `Editar serviço diário${form?.numero ? ` ${form.numero}` : ""}` : "Novo serviço diário"}
        legenda="O serviço é aberto para uma equipe. Ela entra em serviço quando toca em “Continuar” no checklist da viatura."
        aoFechar={aoFechar}
        rodape={
          <>
            <button className="botao" onClick={aoFechar}>Cancelar</button>
            <button className="botao botao--primario" form="form-servico" disabled={salvando || carregando}>
              <Icone nome="salvar" tamanho={15} monocromatico /> {salvando ? "Salvando..." : "Salvar"}
            </button>
          </>
        }
      >
        {erro && <div className="login__erro">{erro}</div>}
        {carregando ? <div className="carregando">Carregando...</div> : (
          <form id="form-servico" className="formulario-grade" onSubmit={salvar}>
            <h3 className="formulario__secao">Informações do Serviço</h3>
            <Data rotulo="Data *" id="sd-data" required disabled={travado} {...campo("data")} />
            <Selecao rotulo="Turno *" id="sd-turno" required vazio="Selecione" disabled={travado}
                     opcoes={TURNOS_SERVICO} {...campo("turno")} />
            {form.turno && (
              <Texto rotulo="Horário do turno" id="sd-hora" disabled readOnly value={HORARIO_TURNO[form.turno] || ""} />
            )}
            <Selecao rotulo="Viatura *" id="sd-viatura" required vazio="Selecione" opcoes={opcoesViatura} {...campo("id_veiculo")} />
            <Selecao rotulo="Equipe *" id="sd-equipe" required vazio="Selecione" largo disabled={travado}
                     opcoes={opcoesEquipe} {...campo("id_equipe")}
                     ajuda={travado ? "A equipe já fez o checklist neste serviço: data, turno e equipe não mudam mais." : "Uma equipe por serviço."} />
            <Selecao rotulo="Coordenador *" id="sd-coordenador" required vazio="Selecione" largo
                     opcoes={servidores.map((x) => ({ valor: String(x.id_servidor), rotulo: `${x.nome}${x.matricula ? ` (${x.matricula})` : ""}` }))}
                     {...campo("id_coordenador")} ajuda="O coordenador do serviço muda todo dia." />

            <h3 className="formulario__secao">
              Ocorrências <small className="sd-oc-conta">{form.ocorrencias.length} selecionada{form.ocorrencias.length === 1 ? "" : "s"}</small>
            </h3>
            <div className="campo" data-largo="sim">
              <input className="campo__input" placeholder="Buscar por protocolo, descrição, local ou equipe" value={busca}
                     onChange={(e) => setBusca(e.target.value)} aria-label="Buscar ocorrência" />
              {listaOc.length === 0 ? <p className="campo__leitura">Nenhuma ocorrência aberta para designar.</p> : (
                <div className="sd-ocs">
                  {listaOc.map((o) => {
                    const marcada = form.ocorrencias.includes(Number(o.id_ocorrencia));
                    const comOutra = o.equipe_atual && !o.marcada;
                    return (
                      <label key={o.id_ocorrencia} className="sd-oc" data-marcado={marcada}>
                        <input type="checkbox" checked={marcada} onChange={() => marcar(Number(o.id_ocorrencia))} />
                        <span className="sd-oc__texto">
                          <strong>{o.protocolo || `Nº ${o.id_ocorrencia}`} · {o.tipo === "QRU" ? "QRU" : o.categoria ? rotuloCategoria(o.categoria) : "Programada"}</strong>
                          <span>{o.descricao}</span>
                          <small>{o.endereco}{o.bairro ? ` · ${o.bairro}` : ""} · {data(o.data)} {hora(o.hora)}</small>
                        </span>
                        <span className="sd-oc__selos">
                          <Selo valor={o.status} />
                          {comOutra && <small className="sd-oc__com">Com {o.equipe_atual}</small>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              <small className="campo__ajuda">Aparecem todas as ocorrências que não foram finalizadas. A que estiver com outra equipe passa para esta.</small>
            </div>

            <h3 className="formulario__secao">Equipe de Apoio <small>(opcional)</small></h3>
            <Selecao rotulo="Equipe de apoio" id="sd-apoio" vazio="Sem apoio" largo opcoes={opcoesApoio} {...campo("id_equipe_apoio")} />

            <h3 className="formulario__secao">Observações <small>(opcional)</small></h3>
            <Area rotulo="Observações" id="sd-obs" largo rows={3} maxLength={1000} placeholder="Ex.: operação no centro com reforço"
                  {...campo("observacoes")} />

            <h3 className="formulario__secao">Fotos <small>(opcional)</small></h3>
            <div className="campo" data-largo="sim">
              {(fotosSalvas.length > 0 || fotos.length > 0) && (
                <div className="qr-fotos">
                  {fotosSalvas.map((f) => (
                    <figure className="qr-foto-item" key={`s${f.id_foto}`}>
                      {miniaturas[f.id_foto] ? <img src={miniaturas[f.id_foto]} alt={f.nome || "Foto"} /> : <span className="sd-foto-vazia">...</span>}
                      <button type="button" className="qr-foto-item__remover" aria-label="Remover foto" onClick={() => removerSalva(f)}>
                        <Icone nome="fechar" tamanho={15} />
                      </button>
                      <figcaption>Salva</figcaption>
                    </figure>
                  ))}
                  {fotos.map((f, i) => (
                    <figure className="qr-foto-item" key={`n${i}`}>
                      <img src={f.dataUrl} alt={`Foto ${i + 1}`} />
                      <button type="button" className="qr-foto-item__remover" aria-label={`Remover foto ${i + 1}`}
                              onClick={() => setFotos((l) => l.filter((_, j) => j !== i))}><Icone nome="fechar" tamanho={15} /></button>
                      <figcaption>{pesoLegivel(f.bytes)}</figcaption>
                    </figure>
                  ))}
                </div>
              )}
              {fotos.length + fotosSalvas.length < MAX_FOTOS && (
                <label className="qr-foto sd-foto" data-ocupado={preparando}>
                  <input type="file" accept="image/*" multiple onChange={escolherFotos} disabled={preparando} />
                  <Icone nome={preparando ? "ajuda" : "mais"} tamanho={22} />
                  <span>{preparando ? "Preparando a imagem..." : `Escolher fotos (até ${MAX_FOTOS})`}</span>
                </label>
              )}
            </div>
          </form>
        )}
      </Modal>
      {modalSenha}
    </>
  );
}
