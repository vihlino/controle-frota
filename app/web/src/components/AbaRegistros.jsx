/**
 * AbaRegistros.jsx - Aba de lista dos Detalhes do Veiculo e da Viatura no
 * desenho do Cesar de 29/10 (o mesmo da aba Sinistros do Motorista):
 *
 *   Lista de <registros>  busca, filtro de situacao, botao "Nova ...", tabela
 *                         com a coluna Acoes (olho + menu) e paginacao 10/pag.
 *   Detalhes ao lado      painel(linha, { fechar, recarregar })
 *   Embaixo da lista      baixo(linha) - fotos e documentos do registro aberto
 *
 * A lista vem da API (`caminho`, com busca/status/pagina) ou pronta (`linhas`,
 * filtrada e paginada aqui, com `textoBusca(l)`). Abre o primeiro registro,
 * como no desenho.
 *
 * situacoes: [{ valor, rotulo, campo? }] - `campo` e o parametro da API (ou
 * da linha) que o filtro usa; o padrao e "status".
 */
import { useEffect, useMemo, useState } from "react";
import Cartao from "./Cartao.jsx";
import Icone from "./Icone.jsx";
import Acoes from "./Acoes.jsx";
import { Paginacao } from "./Tabela.jsx";
import { api } from "../lib/api.js";

export default function AbaRegistros({
  titulo, icone, placeholder = "Buscar...", situacoes = [], novo,
  caminho, linhas: prontas, textoBusca, colunas, chave, acoes,
  painel, baixo, unidade = "registros", vazio = "Nenhum registro.", recarga = 0,
}) {
  const [busca, setBusca] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState("");
  const [situacao, setSituacao] = useState("");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const [linhas, setLinhas] = useState(null);
  const [info, setInfo] = useState({ total: 0, paginas: 1 });
  const [aberto, setAberto] = useState(null);
  const [versao, setVersao] = useState(0);
  const recarregar = () => setVersao((n) => n + 1);

  useEffect(() => {
    const t = setTimeout(() => setBuscaAtiva(busca.trim()), 400);
    return () => clearTimeout(t);
  }, [busca]);
  useEffect(() => { setPagina(1); }, [buscaAtiva, situacao]);

  const filtro = situacoes.find((s) => s.valor === situacao) || null;

  // Lista pronta: o que importa e QUAIS linhas sao (pode chegar um array novo
  // a cada desenho da tela).
  const chaveProntas = prontas ? prontas.map(chave).join(",") : null;
  const filtradas = useMemo(() => {
    if (!prontas) return null;
    const q = buscaAtiva.toLowerCase();
    return prontas.filter((l) => (!filtro || String(l[filtro.campo || "status"]) === filtro.valor)
      && (!q || String(textoBusca ? textoBusca(l) : "").toLowerCase().includes(q)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveProntas, buscaAtiva, situacao]);

  useEffect(() => {
    if (filtradas) {
      setInfo({ total: filtradas.length, paginas: Math.max(1, Math.ceil(filtradas.length / porPagina)) });
      setLinhas(filtradas.slice((pagina - 1) * porPagina, pagina * porPagina));
      return;
    }
    if (!caminho) return;
    setLinhas(null);
    const sep = caminho.includes("?") ? "&" : "?";
    const q = new URLSearchParams({ pagina, porPagina });
    if (buscaAtiva) q.set("busca", buscaAtiva);
    if (filtro) q.set(filtro.campo || "status", filtro.valor);
    api(`${caminho}${sep}${q}`)
      .then((r) => { setLinhas(Array.isArray(r) ? r : r.itens || []); if (!Array.isArray(r)) setInfo({ total: r.total || 0, paginas: r.paginas || 1 }); })
      .catch(() => setLinhas([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtradas, caminho, buscaAtiva, situacao, pagina, porPagina, recarga, versao]);

  // Abre o primeiro; ao recarregar, mantem (atualizado) o que estava aberto.
  useEffect(() => {
    if (!linhas) return;
    if (!linhas.length) { setAberto(null); return; }
    setAberto((a) => (a ? linhas.find((l) => chave(l) === chave(a)) || linhas[0] : linhas[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas]);

  return (
    <div className={`sd-sinistros as${aberto ? " sd-sinistros--aberto" : ""}`}>
      <div className="as-esquerda">
        <Cartao
          titulo={<><Icone nome={icone} tamanho={18} /> {titulo}</>}
          acao={(
            <span className="as-ferramentas">
              <span className="as-busca">
                <Icone nome="search" tamanho={14} />
                <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
                       placeholder={placeholder} aria-label={`Buscar em ${titulo}`} />
              </span>
              {situacoes.length > 0 && (
                <select value={situacao} onChange={(e) => setSituacao(e.target.value)} aria-label="Situação">
                  <option value="">Todos os status</option>
                  {situacoes.map((s) => <option key={`${s.campo || "status"}-${s.valor}`} value={s.valor}>{s.rotulo}</option>)}
                </select>
              )}
              {novo && (
                <button className="botao botao--primario botao--pequeno" onClick={novo.aoClicar}>
                  <Icone nome="mais" tamanho={13} monocromatico /> {novo.rotulo}
                </button>
              )}
            </span>
          )}>
          {!linhas ? <div className="carregando">Carregando...</div>
            : !linhas.length ? <p className="texto-corrido">{buscaAtiva || situacao ? "Nenhum registro com esses filtros." : vazio}</p> : (
              <>
                <div className="rolagem-x">
                  <table className="tabela vd-tabela tabela-ficha as-tabela">
                    <thead>
                      <tr>{colunas.map((c) => <th key={c.rotulo}>{c.rotulo}</th>)}<th>Ações</th></tr>
                    </thead>
                    <tbody>
                      {linhas.map((l) => {
                        const ativo = aberto && chave(aberto) === chave(l);
                        const menu = acoes ? acoes(l, recarregar) : [];
                        return (
                          <tr key={chave(l)} className="vd-tabela__linha" data-ativo={ativo ? "sim" : undefined}
                              onClick={() => setAberto(l)}>
                            {colunas.map((c) => <td key={c.rotulo} className={c.classe}>{c.render(l)}</td>)}
                            <td onClick={(e) => e.stopPropagation()}>
                              <span className="as-acoes">
                                <button type="button" className="botao botao--pequeno" aria-label="Ver detalhes ao lado" onClick={() => setAberto(l)}>
                                  <Icone nome="visualizar" tamanho={14} />
                                </button>
                                {menu.length > 0 && <Acoes acoes={menu} />}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Paginacao pagina={pagina} setPagina={setPagina} porPagina={porPagina} setPorPagina={setPorPagina}
                           total={info.total} paginas={info.paginas} unidade={unidade} />
              </>
            )}
        </Cartao>

        {aberto && baixo && baixo(aberto, versao)}
      </div>

      {aberto && (
        <aside className="cartao sd-sinistro-resumo">
          {painel(aberto, { fechar: () => setAberto(null), recarregar })}
        </aside>
      )}
    </div>
  );
}
