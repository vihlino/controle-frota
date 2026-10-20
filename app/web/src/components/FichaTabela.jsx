/**
 * FichaTabela.jsx - Pecas das telas de detalhes da Fiscalizacao (18/10):
 * a tabela compacta dos cartoes e a barra de abas.
 *
 * Sao as mesmas das fichas de Fiscal e Equipe (que tem as suas copias
 * locais); as telas novas - Viatura, Ocorrencia e Checklist - usam estas.
 */
import Icone from "./Icone.jsx";

/** Tabela simples: colunas {rotulo, render, classe}; linhas clicaveis se aoAbrir. */
export function Tabela({ linhas, colunas, aoAbrir, vazio: textoVazio }) {
  if (!linhas || !linhas.length) return <p className="texto-corrido">{textoVazio}</p>;
  return (
    <div className="rolagem-x">
      <table className="tabela vd-tabela tabela-ficha">
        <thead><tr>{colunas.map((c) => <th key={c.rotulo}>{c.rotulo}</th>)}</tr></thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className={aoAbrir ? "vd-tabela__linha" : undefined}
                onClick={aoAbrir ? () => aoAbrir(l) : undefined}>
              {colunas.map((c) => <td key={c.rotulo} className={c.classe}>{c.render(l)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Barra de abas: abas [{chave, rotulo, icone, total}]. */
export function Abas({ abas, ativa, aoMudar }) {
  return (
    <div className="abas vd-abas" role="tablist">
      {abas.map((a) => (
        <button key={a.chave} type="button" role="tab" className="aba"
                data-ativa={ativa === a.chave} aria-selected={ativa === a.chave}
                onClick={() => aoMudar(a.chave)}>
          <Icone nome={a.icone} tamanho={16} />
          {a.rotulo}
          {a.total ? <span className="vd-abas__total">{a.total}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Botao "Ver todos (N)" do canto do cartao, que leva para a aba. */
export function VerTodos({ total, aoClicar, texto = "Ver todos" }) {
  return (
    <button type="button" className="botao botao--pequeno vd-cartao-acao" onClick={aoClicar}>
      {texto}{total ? ` (${total})` : ""}
    </button>
  );
}
