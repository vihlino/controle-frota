/**
 * FiltroPeriodo.jsx - O campo "Período" pequeno, ao lado do título do cartão
 * (18/10). Usado só nas abas Checklists, Ocorrências e Pontuação das fichas
 * de Motorista, Servidor e Fiscal: filtra a lista pela data.
 *
 * Mesma caixa do filtro "Período" das listas (de / até, um ícone de
 * calendário), só que sem rótulo em cima e com um "x" para limpar.
 */
import Icone from "./Icone.jsx";

/** A data (aaaa-mm-dd...) está dentro do período? Período vazio = tudo. */
export function dentroDoPeriodo(valor, de, ate) {
  const d = String(valor || "").slice(0, 10);
  if (!d) return !de && !ate;
  if (de && d < de) return false;
  if (ate && d > ate) return false;
  return true;
}

export default function FiltroPeriodo({ id, de, ate, aoMudar }) {
  const abrir = (e) => {
    const campo = e.currentTarget.parentElement?.querySelector("input");
    if (!campo) return;
    campo.focus();
    try { campo.showPicker?.(); } catch { /* sem suporte: continua digitável */ }
  };
  return (
    <span className="ficha-periodo">
      <span className="campo-periodo">
        <input id={`${id}-de`} type="date" value={de} aria-label="Período - data inicial"
               onChange={(e) => aoMudar({ de: e.target.value, ate })} />
        <span className="campo-periodo__sep" aria-hidden="true">até</span>
        <input id={`${id}-ate`} type="date" value={ate} aria-label="Período - data final"
               onChange={(e) => aoMudar({ de, ate: e.target.value })} />
        <button type="button" className="campo-periodo__icone" tabIndex={-1}
                aria-label="Abrir calendário" onClick={abrir}>
          <Icone nome="calendar" tamanho={15} />
        </button>
      </span>
      {(de || ate) && (
        <button type="button" className="ficha-periodo__limpar" title="Limpar período"
                onClick={() => aoMudar({ de: "", ate: "" })}>
          <Icone nome="fechar" tamanho={12} />
        </button>
      )}
    </span>
  );
}
