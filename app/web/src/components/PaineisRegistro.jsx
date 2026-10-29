/**
 * PaineisRegistro.jsx - Os paineis "Detalhes da ..." que abrem ao lado da
 * lista nas abas dos Detalhes do Veiculo e da Viatura (desenho do Cesar,
 * 29/10): Inspecao, Manutencao (OS), Documento e Ocorrencia.
 *
 * Todos com o mesmo esqueleto do Detalhes do Sinistro: titulo, "Editar" e o
 * X; situacao e codigo; data, hora, local e KM com icones; os blocos do
 * registro; o veiculo com a foto do cadastro; e a frase "Abrir em <tela>".
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icone from "./Icone.jsx";
import Selo from "./Selo.jsx";
import { SeloInspecao, FREQUENCIA_INSPECAO } from "./ResumosLista.jsx";
import { useFotoVeiculo } from "./FaixaVeiculo.jsx";
import { api, apiArquivo } from "../lib/api.js";
import { data, dataHora, dinheiro, hora, numero, numeroOs, rotulo } from "../lib/formato.js";

const vazio = (v) => (v === null || v === undefined || v === "" ? "—" : v);
const linhasDe = (t) => String(t || "").split(/\r?\n|;/).map((x) => x.replace(/^[-•*\d.)\s]+/, "").trim()).filter(Boolean);
const tamanho = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round((b || 0) / 1024))} KB`);
const tipoCurto = (t) => (t === "application/pdf" ? "PDF" : t === "image/png" ? "PNG" : t === "image/jpeg" ? "JPG" : "Arquivo");

/** Topo do painel: titulo, Editar (opcional) e fechar. */
function Topo({ icone, titulo, aoEditar, aoFechar }) {
  return (
    <header className="pck-topo">
      <h3><Icone nome={icone} tamanho={18} /> {titulo}</h3>
      <span className="as-topo-acoes">
        {aoEditar && (
          <button type="button" className="botao botao--pequeno" onClick={aoEditar}>
            <Icone nome="editar" tamanho={13} /> Editar
          </button>
        )}
        <button type="button" className="sd-sinistro-resumo__fechar" aria-label="Fechar" onClick={aoFechar}>×</button>
      </span>
    </header>
  );
}

function Bloco({ icone, titulo, children }) {
  return (
    <section className="pck-bloco">
      <h4><Icone nome={icone} tamanho={16} /> {titulo}</h4>
      {children}
    </section>
  );
}

/** O veiculo do registro, com a foto do cadastro (o da tela, sem buscar). */
export function BlocoVeiculo({ veiculo: v, titulo = "Veículo" }) {
  const foto = useFotoVeiculo(v?.id_veiculo, v?.foto_em);
  if (!v) return null;
  return (
    <Bloco icone="kpi-car" titulo={titulo}>
      <div className="pck-veiculo">
        <span className="pck-veiculo__foto">{foto ? <img src={foto} alt="" /> : <Icone nome="kpi-car" tamanho={26} />}</span>
        <span className="pck-veiculo__textos">
          <strong>{v.placa}</strong>
          <span>{v.marca} {v.modelo}</span>
          {v.setor && <span>Setor: {v.setor}</span>}
        </span>
      </div>
    </Bloco>
  );
}

function Abrir({ rotulo: r, destino }) {
  const navegar = useNavigate();
  if (!destino) return null;
  return (
    <button type="button" className="lr-abrir" onClick={() => navegar(destino)}>
      {r} <Icone nome="seta-direita" tamanho={13} monocromatico />
    </button>
  );
}

function Observacoes({ texto }) {
  return (
    <Bloco icone="arquivo-texto" titulo="Observações">
      <p className={`pck-obs${texto ? "" : " pck-obs--vazia"}`}>{texto || "Nenhuma observação registrada."}</p>
    </Bloco>
  );
}

// ---------------------------------------------------------------- Inspecao
export function PainelInspecao({ linha: i, veiculo, aoEditar, aoFechar, destino }) {
  const [itens, setItens] = useState(null);
  useEffect(() => {
    setItens(null);
    if (i.status !== "FINALIZADA") return;
    api(`/frotas/inspecoes/${i.id_inspecao}/itens`).then((r) => setItens(Array.isArray(r) ? r : [])).catch(() => setItens([]));
  }, [i.id_inspecao, i.status]);
  const feita = i.status === "FINALIZADA";
  return (
    <div className="pck">
      <Topo icone="inspecao" titulo="Detalhes da Inspeção" aoEditar={aoEditar} aoFechar={aoFechar} />
      <div className="pck-linha"><SeloInspecao i={i} /><span className="pck-codigo">{vazio(i.numero)}</span></div>
      <div className="as-info">
        <span><Icone nome="calendar" tamanho={15} /> {data(i.data_realizacao || i.data_programada)}</span>
        <span><Icone nome="historico" tamanho={15} /> {i.hora_inicio ? `${hora(i.hora_inicio)}${i.hora_finalizacao ? ` – ${hora(i.hora_finalizacao)}` : ""}` : "—"}</span>
        <span><Icone nome="oc-local" tamanho={15} /> {vazio(i.local)}</span>
        <span><Icone nome="odometro" tamanho={15} /> {i.quilometragem ? `${numero(i.quilometragem)} km` : "—"}</span>
      </div>
      <Bloco icone="calendario-check" titulo="Tipo">
        <p className="pck-texto">Inspeção {(FREQUENCIA_INSPECAO[i.tipo] || i.tipo || "").toLowerCase()}</p>
      </Bloco>
      <BlocoVeiculo veiculo={veiculo} />
      <Bloco icone="concluidas" titulo="Resultado">
        {!feita ? <p className="pck-vazio">Inspeção ainda não realizada{i.data_programada ? ` (programada para ${data(i.data_programada)})` : ""}.</p> : (
          <dl className="pd-grade">
            <div><dt>Situação</dt><dd><SeloInspecao i={i} /></dd></div>
            <div><dt>Itens verificados</dt><dd>{itens ? numero(itens.length) : "..."}</dd></div>
            <div><dt>Itens com ressalva</dt><dd>{numero(i.itens_com_ressalva || 0)}</dd></div>
            <div><dt>Próxima inspeção</dt><dd>{i.proxima_inspecao ? data(i.proxima_inspecao) : "—"}</dd></div>
          </dl>
        )}
      </Bloco>
      <Bloco icone="user" titulo="Responsável"><p className="pck-texto">{vazio(i.responsavel)}</p></Bloco>
      <Observacoes texto={i.observacoes} />
      <Abrir rotulo="Abrir em Inspeções" destino={destino} />
    </div>
  );
}

// ---------------------------------------------------------------- OS
export function PainelOs({ linha: o, veiculo, aoEditar, aoFechar, destino }) {
  const trocadas = linhasDe(o.pecas_trocadas);
  const pecas = trocadas.length ? trocadas : linhasDe(o.pecas_necessarias);
  const servicos = [...(o.itens_fechamento || []), ...(o.itens || [])].map((x) => x.descricao).filter(Boolean);
  const custo = o.custo != null ? dinheiro(o.custo) : o.custo_estimado != null ? `${dinheiro(o.custo_estimado)} (estimado)` : "—";
  return (
    <div className="pck">
      <Topo icone="kpi-wrench" titulo="Detalhes da Manutenção" aoEditar={aoEditar} aoFechar={aoFechar} />
      <div className="pck-linha"><Selo valor={o.status} /><span className="pck-codigo">{numeroOs(o.numero)}</span></div>
      <div className="as-info">
        <span><Icone nome="calendar" tamanho={15} /> {data(o.data_fechamento || o.data_agendada || o.data_abertura)}</span>
        <span><Icone nome="historico" tamanho={15} /> {o.data_abertura ? dataHora(o.data_abertura).slice(-5) : "—"}</span>
        <span><Icone nome="oc-local" tamanho={15} /> {vazio(o.oficina)}</span>
        <span><Icone nome="odometro" tamanho={15} /> {o.quilometragem ? `${numero(o.quilometragem)} km` : "—"}</span>
        <span><Icone nome="dinheiro" tamanho={15} /> {custo}</span>
      </div>
      <Bloco icone="documento" titulo="Descrição"><p className="pck-texto">{vazio(o.servico_realizado || o.descricao)}</p></Bloco>
      <Bloco icone="kpi-wrench" titulo="Tipo de manutenção"><p className="pck-texto">Manutenção {o.tipo ? rotulo("tipoOs", o.tipo).toLowerCase() : "—"}</p></Bloco>
      <BlocoVeiculo veiculo={veiculo} />
      <Bloco icone="user" titulo="Responsável"><p className="pck-texto">{vazio(o.responsavel || o.solicitante)}</p></Bloco>
      <Bloco icone="predio" titulo="Oficina"><p className="pck-texto">{vazio(o.oficina)}</p></Bloco>
      <Bloco icone="camadas" titulo={trocadas.length ? "Peças utilizadas" : "Peças necessárias"}>
        {pecas.length ? <ul className="as-lista">{pecas.map((p, n) => <li key={n}>{p}</li>)}</ul>
          : servicos.length ? <ul className="as-lista">{servicos.slice(0, 6).map((p, n) => <li key={n}>{p}</li>)}</ul>
            : <p className="pck-vazio">Nenhuma peça informada.</p>}
      </Bloco>
      <Observacoes texto={o.observacoes_fechamento || o.observacoes} />
      <Abrir rotulo="Abrir em Manutenções" destino={destino} />
    </div>
  );
}

// ---------------------------------------------------------------- Documento
export function PainelDocumento({ linha: d, aoEditar, aoFechar, destino }) {
  const a = d.ultimo_arquivo;
  async function arquivo(baixar) {
    if (!a) return;
    const janela = baixar ? null : window.open("", "_blank");
    try {
      const url = await apiArquivo(`/frotas/documentos/arquivos/${a.id_arquivo}`);
      if (baixar) {
        const link = document.createElement("a");
        link.href = url; link.download = a.nome; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else if (janela) {
        janela.location.href = url;
        setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
      }
    } catch (e) {
      janela?.close();
      alert(e.message);
    }
  }
  return (
    <div className="pck">
      <Topo icone="documentos" titulo="Detalhes do Documento" aoEditar={aoEditar} aoFechar={aoFechar} />
      <div className="pd-doc">
        <span className="ad-tipo ad-tipo--grande" data-tipo={a ? tipoCurto(a.tipo) : "SEM"}>{a ? tipoCurto(a.tipo) : "DOC"}</span>
        <span><strong>{d.tipo_documento}</strong><small>{a ? a.nome : "Sem arquivo anexado"}</small></span>
      </div>
      <div className="pck-linha"><Selo valor={d.status} /><span className="pck-codigo">{vazio(d.numero_documento)}</span></div>
      <dl className="pd-grade pd-grade--icones">
        <div><dt><Icone nome="documento" tamanho={14} /> Tipo</dt><dd>{vazio(d.categoria)}</dd></div>
        <div><dt><Icone nome="calendar" tamanho={14} /> Data de emissão</dt><dd>{d.data_emissao ? data(d.data_emissao) : "—"}</dd></div>
        <div><dt><Icone nome="calendario-check" tamanho={14} /> Data de validade</dt><dd>{d.data_validade ? data(d.data_validade) : "Não vence"}</dd></div>
        <div><dt><Icone nome="predio" tamanho={14} /> Emitido por</dt><dd>{vazio(d.orgao_emissor)}</dd></div>
      </dl>
      <Bloco icone="user" titulo="Responsável"><p className="pck-texto">{vazio(d.responsavel)}</p></Bloco>
      <Bloco icone="documentos" titulo="Arquivo">
        {!a ? <p className="pck-vazio">Nenhum arquivo anexado.</p> : (
          <div className="pd-arquivo">
            <div className="pd-arquivo__nome">
              <span className="ad-tipo" data-tipo={tipoCurto(a.tipo)}>{tipoCurto(a.tipo)}</span>
              <span><strong title={a.nome}>{a.nome}</strong><small>{tipoCurto(a.tipo)} • {tamanho(a.bytes)}</small></span>
            </div>
            <div className="pd-arquivo__botoes">
              <button type="button" className="botao botao--pequeno" onClick={() => arquivo(false)}><Icone nome="visualizar" tamanho={14} /> Visualizar</button>
              <button type="button" className="botao botao--pequeno" onClick={() => arquivo(true)}><Icone nome="baixar" tamanho={14} /> Baixar</button>
            </div>
          </div>
        )}
      </Bloco>
      <Observacoes texto={d.observacoes} />
      <Abrir rotulo="Abrir em Documentos" destino={destino} />
    </div>
  );
}

// ---------------------------------------------------------------- Ocorrencia
export function PainelOcorrencia({ linha: o, veiculo, aoFechar, destino }) {
  const [f, setF] = useState(null);
  useEffect(() => {
    setF(null);
    api(`/fiscalizacao/ocorrencias/${o.id_ocorrencia}/ficha`).then(setF).catch(() => setF({}));
  }, [o.id_ocorrencia]);
  const x = { ...o, ...(f || {}) };
  const envolvidos = f?.envolvidos || [];
  const fiscais = f?.fiscais || [];
  return (
    <div className="pck">
      <Topo icone="fisc-ocorrencias" titulo="Detalhes da Ocorrência" aoFechar={aoFechar} />
      <div className="pck-linha"><Selo valor={x.status} /><span className="pck-codigo">{vazio(x.protocolo)}</span></div>
      <div className="as-info">
        <span><Icone nome="calendar" tamanho={15} /> {data(x.data)}</span>
        <span><Icone nome="historico" tamanho={15} /> {x.hora ? hora(x.hora) : "—"}</span>
        <span><Icone nome="oc-local" tamanho={15} /> {vazio(x.endereco)}</span>
        <span><Icone nome="equipe" tamanho={15} /> {vazio(o.equipe)}</span>
      </div>
      <Bloco icone="documento" titulo="Descrição"><p className="pck-texto">{vazio(x.descricao)}</p></Bloco>
      <Bloco icone="fisc-ocorrencias" titulo="Tipo"><p className="pck-texto">{x.tipo === "QRU" ? "QRU (chamado)" : x.tipo === "PROGRAMADA" ? "Programada" : vazio(x.tipo)}</p></Bloco>
      <BlocoVeiculo veiculo={veiculo} titulo="Viatura" />
      <Bloco icone="usuarios" titulo="Envolvidos">
        {!f ? <p className="pck-vazio">Carregando...</p> : envolvidos.length === 0 ? <p className="pck-vazio">Nenhum envolvido registrado.</p> : (
          <ul className="as-lista">{envolvidos.map((e) => <li key={e.id_envolvido}>{[e.identificacao, e.placa_documento].filter(Boolean).join(" · ") || vazio(e.tipo)}</li>)}</ul>
        )}
      </Bloco>
      {fiscais.length > 0 && (
        <Bloco icone="user" titulo="Fiscais">
          <ul className="as-lista">{fiscais.map((s, n) => <li key={n}>{s.nome}</li>)}</ul>
        </Bloco>
      )}
      <Observacoes texto={x.observacoes} />
      <Abrir rotulo="Abrir em Ocorrências" destino={destino} />
    </div>
  );
}
