/**
 * Tabela.jsx - A tabela e a paginacao.
 *
 * Tabela: recebe a lista de colunas e as linhas. Cada coluna pode ter uma
 * função render(linha) para desenhar o conteudo do jeito que quiser - e assim
 * que nascem os selos coloridos, as celulas de duas linhas e os menus de acao.
 *
 * Paginacao: mostra a primeira pagina, a ultima e as vizinhas da atual,
 * trocando o resto por reticencias - com 50 paginas, listar todas nao caberia.
 */
import Icone from "./Icone.jsx";
import { numero } from "../lib/formato.js";

// colunas: [{ chave, rotulo, ordenavel, largura, render(linha) }]
/*
 * Classe de cada coluna: a que a tela declarar (`classe`) e, na coluna de
 * Acoes, "coluna-acoes" - que fica PRESA na borda direita. Assim o menu de
 * acoes aparece sempre, mesmo quando a tabela e mais larga que a tela e rola
 * na horizontal (notebook, tela estreita).
 */
const classeDa = (c) =>
  [c.classe, c.chave === "ações" || c.chave === "acoes" ? "coluna-acoes" : null]
    .filter(Boolean).join(" ") || undefined;

/*
 * Coluna com `cortar: true` (texto que pode ser longo: local, e-mail,
 * observacao...): o conteudo fica numa linha so e corta com "...", numa
 * largura proporcional a tela (ver .celula-cortada--coluna no CSS). O texto
 * inteiro aparece ao passar o mouse. E o que impede uma coluna de empurrar
 * as outras - e o menu de Acoes - para fora da tela.
 */
function celula(c, linha) {
  const conteudo = c.render ? c.render(linha) : linha[c.chave] ?? "-";
  if (!c.cortar) return conteudo;
  const bruto = typeof conteudo === "string" ? conteudo
    : typeof linha[c.chave] === "string" ? linha[c.chave] : undefined;
  return <div className="celula-cortada celula-cortada--coluna" title={bruto}>{conteudo}</div>;
}

export function Tabela({ colunas, linhas, chaveDe, ordem, ordenarPor, vazio, carregando }) {
  if (carregando && !linhas) return <div className="carregando">Carregando...</div>;

  return (
    <div className="rolagem-x">
      <table className="tabela">
        <thead>
          <tr>
            {colunas.map((c) => (
              <th key={c.chave} className={classeDa(c)} style={c.largura ? { width: c.largura } : undefined}>
                {c.ordenavel && ordenarPor ? (
                  <button className="tabela__ordenar" onClick={() => ordenarPor(c.chave)}>
                    {c.rotulo}
                    <span
                      className="tabela__seta"
                      data-ativa={ordem?.campo === c.chave}
                      data-direcao={ordem?.direcao}
                    >
                      <Icone nome="chevron-down" tamanho={13} />
                    </span>
                  </button>
                ) : (
                  c.rotulo
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(linhas || []).map((linha) => (
            <tr key={chaveDe(linha)}>
              {colunas.map((c) => (
                <td key={c.chave} className={classeDa(c)}>{celula(c, linha)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {linhas && linhas.length === 0 && (
        <div className="vazio">{vazio || "Nenhum registro encontrado."}</div>
      )}
    </div>
  );
}

export function Paginacao({ pagina, setPagina, porPagina, setPorPagina, total, paginas, unidade }) {
  const primeiro = total ? (pagina - 1) * porPagina + 1 : 0;
  const ultimo = Math.min(pagina * porPagina, total);

  // Mostra a primeira, a ultima e as vizinhas da atual; o resto vira reticencia.
  const visiveis = Array.from({ length: paginas }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === paginas || Math.abs(n - pagina) <= 2
  );

  return (
    <div className="rodape-tabela">
      <span>
        Mostrando {primeiro} a {ultimo} de {numero(total)} {unidade}
      </span>
      <label className="rodape-tabela__exibir">
        Exibir{" "}
        <select
          value={porPagina}
          onChange={(e) => {
            setPorPagina(Number(e.target.value));
            setPagina(1);
          }}
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>{" "}
        por página
      </label>
      <div className="paginacao">
        <button onClick={() => setPagina(1)} disabled={pagina === 1}>&laquo;</button>
        <button onClick={() => setPagina(pagina - 1)} disabled={pagina === 1}>&lsaquo;</button>
        {visiveis.map((n, i) => (
          <span key={n} className="paginacao__grupo">
            {i > 0 && visiveis[i - 1] !== n - 1 && <span className="paginacao__reticencia">...</span>}
            <button data-ativo={n === pagina} onClick={() => setPagina(n)}>{n}</button>
          </span>
        ))}
        <button onClick={() => setPagina(pagina + 1)} disabled={pagina >= paginas}>&rsaquo;</button>
        <button onClick={() => setPagina(paginas)} disabled={pagina >= paginas}>&raquo;</button>
      </div>
    </div>
  );
}
