/**
 * ListaResumo.jsx - Lista de uma aba de detalhes com o RESUMO ao lado
 * (pedido do Cesar, 26/10).
 *
 * Nasceu na aba Sinistros dos Detalhes do Motorista e agora e o padrao das
 * abas de lista (Sinistros, Inspecoes, Manutencoes, Documentos do veiculo;
 * Sinistros do Fiscal): a lista de 10 em 10 com o rodape de contagem e, ao
 * clicar numa linha, um resumo no lado direito com o botao "Abrir em <tela>",
 * que leva aos detalhes completos do registro.
 *
 * Props:
 *   titulo, acao        - titulo do cartao e o botao a direita dele
 *   caminho             - rota da API (sem pagina/porPagina), OU
 *   linhas              - a lista pronta (a ficha ja trouxe; pagina aqui mesmo)
 *   colunas             - [{ rotulo, render(l), classe? }]
 *   chave(l)            - identificador da linha
 *   resumo(l)           - { rotulo, titulo, selo, linhas: [[rotulo, valor]], texto: { rotulo, valor } }
 *   abrir               - { rotulo: "Abrir em Sinistros", destino: (l) => "/frotas/..." } ou null
 *   unidade, vazio      - "sinistros"; texto da lista vazia
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Cartao from "./Cartao.jsx";
import Icone from "./Icone.jsx";
import { Paginacao } from "./Tabela.jsx";
import { api } from "../lib/api.js";

export default function ListaResumo({
  titulo, acao, caminho, linhas: linhasProntas, colunas, chave, resumo, abrir,
  unidade = "registros", vazio = "Nenhum registro.",
}) {
  const navegar = useNavigate();
  const [linhas, setLinhas] = useState(null);
  const [erro, setErro] = useState("");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const [info, setInfo] = useState({ total: 0, paginas: 1 });
  const [aberto, setAberto] = useState(null);

  useEffect(() => { setPagina(1); }, [caminho, linhasProntas]);

  // Da API: pagina no servidor. Lista pronta: pagina aqui.
  useEffect(() => {
    if (linhasProntas) {
      const total = linhasProntas.length;
      setInfo({ total, paginas: Math.max(1, Math.ceil(total / porPagina)) });
      setLinhas(linhasProntas.slice((pagina - 1) * porPagina, pagina * porPagina));
      return;
    }
    setLinhas(null);
    const sep = caminho.includes("?") ? "&" : "?";
    api(`${caminho}${sep}pagina=${pagina}&porPagina=${porPagina}`)
      .then((r) => {
        setLinhas(Array.isArray(r) ? r : r.itens || []);
        if (!Array.isArray(r)) setInfo({ total: r.total || 0, paginas: r.paginas || 1 });
      })
      .catch((e) => setErro(e.message));
  }, [caminho, linhasProntas, pagina, porPagina]);

  const r = aberto ? resumo(aberto) : null;

  return (
    <div className={`sd-sinistros${r ? " sd-sinistros--aberto" : ""}`}>
      <Cartao titulo={titulo} acao={acao}>
        {erro ? <div className="vazio">{erro}</div>
          : !linhas ? <div className="carregando">Carregando...</div>
            : !linhas.length ? <p className="texto-corrido">{vazio}</p> : (
              <>
                <div className="rolagem-x">
                  <table className="tabela vd-tabela tabela-ficha">
                    <thead><tr>{colunas.map((c) => <th key={c.rotulo}>{c.rotulo}</th>)}</tr></thead>
                    <tbody>
                      {linhas.map((l) => {
                        const ativo = aberto && chave(aberto) === chave(l);
                        return (
                          <tr key={chave(l)} className="vd-tabela__linha" data-ativo={ativo ? "sim" : undefined}
                              onClick={() => setAberto(ativo ? null : l)}>
                            {colunas.map((c) => <td key={c.rotulo} className={c.classe}>{c.render(l)}</td>)}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Paginacao pagina={pagina} setPagina={setPagina} porPagina={porPagina} setPorPagina={setPorPagina}
                           total={info.total} paginas={info.paginas} unidade={unidade} />
                {!r && <p className="vd2-nota" style={{ marginTop: 10 }}>Clique numa linha para ver o resumo ao lado.</p>}
              </>
            )}
      </Cartao>

      {r && (
        <aside className="cartao sd-sinistro-resumo" aria-label={`Resumo: ${r.titulo}`}>
          <header className="sd-sinistro-resumo__topo">
            <div>
              <span className="sd-sinistro-resumo__rotulo">{r.rotulo}</span>
              <strong>{r.titulo}</strong>
            </div>
            {r.selo}
            <button type="button" className="sd-sinistro-resumo__fechar" aria-label="Fechar resumo"
                    onClick={() => setAberto(null)}>×</button>
          </header>
          <dl className="vd-dados__coluna">
            {r.linhas.map(([rot, valor]) => (
              <div className="vd-dados__linha" key={rot}><dt>{rot}</dt><dd>{valor ?? "—"}</dd></div>
            ))}
          </dl>
          {r.texto?.valor && (
            <div className="sd-sinistro-resumo__texto">
              <span>{r.texto.rotulo}</span>
              <p>{r.texto.valor}</p>
            </div>
          )}
          {abrir && (
            <button type="button" className="botao botao--primario sd-sinistro-resumo__mais"
                    onClick={() => navegar(abrir.destino(aberto))}>
              {abrir.rotulo} <Icone nome="seta-direita" tamanho={14} monocromatico />
            </button>
          )}
        </aside>
      )}
    </div>
  );
}
