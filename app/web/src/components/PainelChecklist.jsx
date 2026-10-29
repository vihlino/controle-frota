/**
 * PainelChecklist.jsx - "Detalhes do Checklist" aberto ao lado da lista, na
 * aba Checklists dos Detalhes do Motorista/Servidor (checklist do Frotas) e do
 * Fiscal (checklist de viatura). Desenho do Cesar de 29/10.
 *
 * Mostra o essencial: situacao, data e horarios, o veiculo (com a foto do
 * cadastro), percurso ou equipe, odometro, equipamentos, observacoes e fotos.
 * Tudo o mais fica nos Detalhes do Checklist, pela frase "Abrir conteúdo
 * completo".
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icone from "./Icone.jsx";
import Selo from "./Selo.jsx";
import { useFotoVeiculo } from "./FaixaVeiculo.jsx";
import { ORDEM_EQUIPAMENTOS } from "./CorrigirChecklist.jsx";
import { api, apiArquivo } from "../lib/api.js";
import { data, hora, numero, rotulo } from "../lib/formato.js";

const vazio = (v) => (v === null || v === undefined || v === "" ? "—" : v);

/** Duracao entre saida e chegada ("1h 12min"), quando as duas existem no mesmo dia. */
function duracao(saida, chegada) {
  if (!saida || !chegada) return null;
  const min = (t) => { const [h, m] = String(t).split(":").map(Number); return h * 60 + m; };
  let d = min(chegada) - min(saida);
  if (d < 0) d += 24 * 60;
  const h = Math.floor(d / 60);
  return h ? `${h}h ${String(d % 60).padStart(2, "0")}min` : `${d % 60}min`;
}

/** Miniaturas das fotos (as rotas exigem o token: viram blob). */
function Fotos({ fotos, prefixo }) {
  const [urls, setUrls] = useState({});
  useEffect(() => {
    let vivo = true;
    const criadas = [];
    fotos.forEach(async (f) => {
      try {
        const u = await apiArquivo(`${prefixo}${f.id_foto}`);
        criadas.push(u);
        if (vivo) setUrls((x) => ({ ...x, [f.id_foto]: u }));
      } catch { /* fica o quadrinho vazio */ }
    });
    return () => { vivo = false; criadas.forEach((u) => URL.revokeObjectURL(u)); };
  }, [fotos, prefixo]);
  if (!fotos.length) return <p className="pck-vazio">Nenhuma foto anexada.</p>;
  return (
    <div className="pck-fotos">
      {fotos.slice(0, 6).map((f) => (
        <a key={f.id_foto} className="pck-foto" href={urls[f.id_foto] || undefined} target="_blank" rel="noreferrer">
          {urls[f.id_foto] ? <img src={urls[f.id_foto]} alt="" /> : null}
        </a>
      ))}
    </div>
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

/**
 * tipo: "frotas" (linha da lista /frotas/checklists, ja com equipamentos e
 * percurso) ou "fiscal" (linha da ficha do fiscal; o resto vem da ficha do
 * checklist da Fiscalizacao).
 */
export default function PainelChecklist({ linha, tipo = "frotas", aoFechar }) {
  const navegar = useNavigate();
  const fiscal = tipo === "fiscal";
  const [ck, setCk] = useState(fiscal ? null : linha);
  const [veiculo, setVeiculo] = useState(null);
  const [fotos, setFotos] = useState([]);

  useEffect(() => {
    setVeiculo(null); setFotos([]);
    if (fiscal) {
      setCk(null);
      api(`/fiscalizacao/checklists/${linha.id_checklist}/ficha`)
        .then((r) => { setCk(r); setFotos(r.fotos || []); })
        .catch(() => setCk({ ...linha, erro: true }));
    } else {
      setCk(linha);
      if (Number(linha.total_fotos) > 0) {
        api(`/qrcode/fotos/checklist/${linha.id_checklist}`).then((r) => setFotos(Array.isArray(r) ? r : [])).catch(() => {});
      }
    }
  }, [linha, fiscal]);

  // Foto e setor do veiculo vem do cadastro do veiculo.
  const idVeiculo = ck?.id_veiculo;
  useEffect(() => {
    if (!idVeiculo) return;
    api(`/frotas/veiculos/${idVeiculo}`).then(setVeiculo).catch(() => {});
  }, [idVeiculo]);
  const foto = useFotoVeiculo(veiculo?.id_veiculo, veiculo?.foto_em);

  const destino = fiscal ? `/fiscalizacao/checklists/${linha.id_checklist}` : `/frotas/checklists/${linha.id_checklist}`;
  const c = ck || linha;
  const dur = duracao(c.hora_saida, c.hora_chegada);

  // Equipamentos do Frotas: a conferencia da chegada vale mais que a da saida.
  const eqFrotas = !fiscal ? ORDEM_EQUIPAMENTOS.map((cod) => {
    const lista = (c.equipamentos || []).filter((e) => e.equipamento === cod);
    const item = lista.find((e) => e.momento === "CHEGADA") || lista.find((e) => e.momento === "SAIDA");
    return { nome: rotulo("equipamento", cod), ok: item ? item.conforme : null };
  }) : [];
  // Equipamentos da viatura: saida e chegada; faltou = voltou menos do que saiu.
  const eqFiscal = fiscal ? (c.equipamentos || []).filter((e) => e.saida !== null && e.saida !== undefined).map((e) => ({
    nome: e.nome,
    texto: e.conferencia === "OBRIGATORIO" ? null : `${numero(e.saida)}${e.chegada !== null && e.chegada !== undefined ? ` → ${numero(e.chegada)}` : ""}`,
    ok: e.chegada === null || e.chegada === undefined ? true : Number(e.chegada) >= Number(e.saida),
  })) : [];
  const observacoes = [c.observacoes, c.observacoes_equipe, c.observacoes_chegada].filter(Boolean);

  return (
    <div className="pck">
      <header className="pck-topo">
        <h3><Icone nome="checklist" tamanho={18} /> Detalhes do Checklist</h3>
        <button type="button" className="sd-sinistro-resumo__fechar" aria-label="Fechar" onClick={aoFechar}>×</button>
      </header>

      <div className="pck-linha">
        <Selo valor={c.status} />
        <span className="pck-codigo">#CK-{c.id_checklist}</span>
      </div>
      <div className="pck-tempo">
        <span><Icone nome="calendar" tamanho={15} /> {data(c.data_abertura)}</span>
        <span><Icone nome="historico" tamanho={15} /> {hora(c.hora_saida)}{c.hora_chegada ? ` – ${hora(c.hora_chegada)}` : ""}</span>
        {dur && <span><Icone nome="atrasados" tamanho={15} /> {dur}</span>}
      </div>

      <Bloco icone="kpi-car" titulo={fiscal ? "Viatura" : "Veículo"}>
        <div className="pck-veiculo">
          <span className="pck-veiculo__foto">{foto ? <img src={foto} alt="" /> : <Icone nome="kpi-car" tamanho={26} />}</span>
          <span className="pck-veiculo__textos">
            <strong>{c.placa}</strong>
            <span>{c.marca} {c.modelo}</span>
            {(veiculo?.setor || c.setor) && <span>Setor: {veiculo?.setor || c.setor}</span>}
          </span>
        </div>
      </Bloco>

      {fiscal ? (
        <Bloco icone="equipe" titulo="Equipe">
          {!ck ? <p className="pck-vazio">Carregando...</p> : (
            <div className="pck-texto">
              <span><strong>{vazio(c.equipe)}</strong>{c.servico_codigo ? ` · ${c.servico_codigo}` : ""}</span>
              {(c.fiscais || []).map((f) => (
                <span key={f.id_servidor} className="pck-sub">{f.tipo === "FISCAL_1" ? "Fiscal 1" : "Fiscal 2"}: {f.nome}</span>
              ))}
            </div>
          )}
        </Bloco>
      ) : (
        <Bloco icone="oc-local" titulo="Percurso">
          <p className="pck-texto">{vazio(c.percurso)}</p>
        </Bloco>
      )}

      <Bloco icone="odometro" titulo="Odômetro">
        <div className="pck-km">
          <span><small>KM saída</small><strong>{c.odometro_saida != null ? numero(c.odometro_saida) : "—"}</strong></span>
          <span><small>KM chegada</small><strong>{c.odometro_chegada != null ? numero(c.odometro_chegada) : "—"}</strong></span>
        </div>
      </Bloco>

      <Bloco icone="checklist" titulo="Equipamentos verificados">
        {fiscal && !ck ? <p className="pck-vazio">Carregando...</p> : (
          (fiscal ? eqFiscal : eqFrotas).length === 0 ? <p className="pck-vazio">Nenhum equipamento conferido.</p> : (
            <ul className="pck-equip">
              {(fiscal ? eqFiscal : eqFrotas).map((e) => (
                <li key={e.nome} data-ok={e.ok === null ? "nd" : e.ok ? "sim" : "nao"}>
                  <span className="pck-equip__marca">{e.ok === null ? "–" : e.ok ? "✓" : "✕"}</span>
                  {e.nome}{e.texto ? <small> {e.texto}</small> : null}
                </li>
              ))}
            </ul>
          )
        )}
      </Bloco>

      <Bloco icone="arquivo-texto" titulo="Observações">
        {observacoes.length ? observacoes.map((o, i) => <p key={i} className="pck-obs">{o}</p>)
          : <p className="pck-obs pck-obs--vazia">Nenhuma observação registrada.</p>}
      </Bloco>

      <Bloco icone="oc-camera" titulo="Fotos">
        <Fotos fotos={fotos} prefixo={fiscal ? "/qrcode/fiscal/fotos/arquivo/" : "/qrcode/foto/arquivo/"} />
      </Bloco>

      <button type="button" className="lr-abrir" onClick={() => navegar(destino)}>
        Abrir conteúdo completo <Icone nome="seta-direita" tamanho={13} monocromatico />
      </button>
    </div>
  );
}
