/**
 * AbaSinistros.jsx - Aba Sinistros dos Detalhes do Motorista, do Servidor e
 * do Fiscal no desenho do Cesar de 29/10 (sem os cartoes de contagem do topo,
 * a pedido).
 *
 *   Lista de Sinistros   busca, filtro de situacao, "Novo Sinistro", colunas
 *                        com a descricao, e as acoes de cada linha
 *   Detalhes do Sinistro ao lado: situacao, data/hora, local, tipo, descricao,
 *                        veiculo envolvido (com a foto do cadastro), danos,
 *                        envolvidos e responsavel; "Editar" e a frase
 *                        "Abrir em Sinistros"
 *   Fotos do Sinistro e Documentos, embaixo da lista, do sinistro aberto
 *
 * 29/10: tambem nas abas Sinistros dos Detalhes do Veiculo e da Viatura
 * (idVeiculo), sem a coluna Veiculo.
 *
 * Quem nao ve o Frotas (so a Fiscalizacao) recebe a lista que a ficha ja
 * trouxe, sem fotos, documentos nem os botoes de alterar.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Cartao from "./Cartao.jsx";
import Icone from "./Icone.jsx";
import Selo from "./Selo.jsx";
import Acoes from "./Acoes.jsx";
import RegistrarSinistro, { SITUACOES_SINISTRO, TIPOS_ENVOLVIDO } from "./RegistrarSinistro.jsx";
import { Paginacao } from "./Tabela.jsx";
import { useFotoVeiculo } from "./FaixaVeiculo.jsx";
import { useArquivos } from "./useArquivos.js";
import { api } from "../lib/api.js";
import { data, dataHora, dinheiro, hora, rotulo } from "../lib/formato.js";

const vazio = (v) => (v === null || v === undefined || v === "" ? "—" : v);
const linhasDe = (t) => String(t || "").split("\n").map((x) => x.trim()).filter(Boolean);

/** O painel "Detalhes do Sinistro" (busca a ficha para ter os envolvidos). */
function PainelSinistro({ linha, completo, podeEditar, aoEditar, aoFechar, podeAbrir }) {
  const navegar = useNavigate();
  const [veiculo, setVeiculo] = useState(null);
  const x = completo || linha;
  useEffect(() => {
    setVeiculo(null);
    if (!x.id_veiculo) return;
    api(`/frotas/veiculos/${x.id_veiculo}`).then(setVeiculo).catch(() => {});
  }, [x.id_veiculo]);
  const foto = useFotoVeiculo(veiculo?.id_veiculo, veiculo?.foto_em);
  const danos = [
    ...(x.parte_danificada ? [`Parte: ${rotulo("parteSinistro", x.parte_danificada)}`] : []),
    ...(x.gravidade_danos ? [`Gravidade: ${rotulo("gravidadeDanos", x.gravidade_danos)}`] : []),
    ...linhasDe(x.descricao_danos),
  ];
  const custos = ["orcamento_pecas", "orcamento_mao_obra", "orcamento_outros"].reduce((t, k) => t + (Number(x[k]) || 0), 0);
  const tipoEnv = (t) => TIPOS_ENVOLVIDO.find((e) => e.valor === t)?.rotulo || t;
  return (
    <div className="pck">
      <header className="pck-topo">
        <h3><Icone nome="sinistro" tamanho={18} /> Detalhes do Sinistro</h3>
        <span className="as-topo-acoes">
          {podeEditar && completo && (
            <button type="button" className="botao botao--pequeno" onClick={aoEditar}>
              <Icone nome="editar" tamanho={13} /> Editar
            </button>
          )}
          <button type="button" className="sd-sinistro-resumo__fechar" aria-label="Fechar" onClick={aoFechar}>×</button>
        </span>
      </header>
      <div className="pck-linha">
        <Selo valor={x.status} />
        <span className="pck-codigo">{vazio(x.numero)}</span>
      </div>
      <div className="as-info">
        <span><Icone nome="calendar" tamanho={15} /> {data(x.data)}</span>
        <span><Icone nome="historico" tamanho={15} /> {x.hora ? hora(x.hora) : "—"}</span>
        <span><Icone nome="oc-local" tamanho={15} /> {vazio(x.local)}</span>
        <span><Icone nome="sinistro" tamanho={15} /> {x.tipo ? rotulo("tipoSinistro", x.tipo) : "—"}</span>
      </div>

      <section className="pck-bloco">
        <h4><Icone nome="arquivo-texto" tamanho={16} /> Descrição</h4>
        <p className="pck-texto">{vazio(x.descricao)}</p>
      </section>

      <section className="pck-bloco">
        <h4><Icone nome="kpi-car" tamanho={16} /> Veículo envolvido</h4>
        <div className="pck-veiculo">
          <span className="pck-veiculo__foto">{foto ? <img src={foto} alt="" /> : <Icone nome="kpi-car" tamanho={26} />}</span>
          <span className="pck-veiculo__textos">
            <strong>{x.placa}</strong>
            <span>{x.marca} {x.modelo}</span>
            {(veiculo?.setor || x.setor) && <span>Setor: {veiculo?.setor || x.setor}</span>}
          </span>
        </div>
      </section>

      <section className="pck-bloco">
        <h4><Icone nome="alert-triangle" tamanho={16} /> Danos</h4>
        {danos.length ? <ul className="as-lista">{danos.map((d) => <li key={d}>{d}</li>)}</ul>
          : <p className="pck-vazio">Nenhum dano descrito.</p>}
        {custos > 0 && <p className="pck-sub">Custos estimados: {dinheiro(custos)}</p>}
      </section>

      <section className="pck-bloco">
        <h4><Icone nome="usuarios" tamanho={16} /> Envolvidos</h4>
        {!completo ? <p className="pck-vazio">{podeAbrir ? "Carregando..." : "—"}</p>
          : (completo.envolvidos || []).length === 0
            ? <p className="pck-vazio">{x.houve_terceiros ? "Terceiros envolvidos (sem detalhes)." : "Nenhum outro envolvido."}</p>
            : (
              <ul className="as-lista">
                {completo.envolvidos.map((e, i) => (
                  <li key={i}>
                    {tipoEnv(e.tipo)}: {e.tipo === "OUTRO_VEICULO" && (e.placa || e.modelo)
                      ? [e.modelo, e.placa ? `placa ${e.placa}` : "placa não identificada"].filter(Boolean).join(" · ")
                      : vazio(e.nome)}
                  </li>
                ))}
              </ul>
            )}
      </section>

      <section className="pck-bloco">
        <h4><Icone nome="user" tamanho={16} /> Responsável pelo sinistro</h4>
        <ul className="as-lista"><li>{vazio(x.responsavel)}</li></ul>
      </section>

      {podeAbrir && (
        <button type="button" className="lr-abrir" onClick={() => navegar(`/frotas/sinistros/${x.id_sinistro}`)}>
          Abrir em Sinistros <Icone nome="seta-direita" tamanho={13} monocromatico />
        </button>
      )}
    </div>
  );
}

/** Fotos e Documentos do sinistro aberto (embaixo da lista). */
function ArquivosSinistro({ idSinistro, podeGerenciar }) {
  const navegar = useNavigate();
  const anexos = useArquivos(`/frotas/sinistros/${idSinistro}/arquivos`, "/frotas/sinistros/arquivos");
  const entrada = useRef(null);
  const todos = anexos.arquivos || [];
  const fotos = todos.filter((a) => a.tipo.startsWith("image/"));
  const docs = todos.filter((a) => !a.tipo.startsWith("image/"));
  return (
    <div className="as-baixo">
      <Cartao titulo={<><Icone nome="oc-camera" tamanho={18} /> Fotos do Sinistro</>}
              acao={fotos.length > 4 && (
                <button className="botao botao--pequeno vd-cartao-acao" onClick={() => navegar(`/frotas/sinistros/${idSinistro}?aba=fotos`)}>Ver todas</button>
              )}>
        <input ref={entrada} type="file" hidden multiple accept="image/jpeg,image/png"
               onChange={(e) => { anexos.enviar(e.target.files); e.target.value = ""; }} />
        {anexos.arquivos === null ? <div className="carregando">Carregando...</div> : (
          <div className="as-fotos">
            {fotos.slice(0, 4).map((f) => (
              <button key={f.id_arquivo} type="button" className="as-foto" onClick={() => anexos.abrir(f)} title={f.nome}>
                {anexos.miniaturas[f.id_arquivo] ? <img src={anexos.miniaturas[f.id_arquivo]} alt={f.nome} /> : null}
              </button>
            ))}
            {podeGerenciar && (
              <button type="button" className="as-foto as-foto--nova" onClick={() => entrada.current?.click()} disabled={anexos.enviando}>
                <Icone nome="oc-camera" tamanho={20} />
                <span>{anexos.enviando ? "Enviando..." : "Adicionar fotos"}</span>
              </button>
            )}
            {!fotos.length && !podeGerenciar && <p className="pck-vazio">Nenhuma foto anexada.</p>}
          </div>
        )}
      </Cartao>

      <Cartao titulo={<><Icone nome="documentos" tamanho={18} /> Documentos</>}
              acao={<button className="botao botao--pequeno vd-cartao-acao" onClick={() => navegar(`/frotas/sinistros/${idSinistro}?aba=documentos`)}>Ver todos</button>}>
        {anexos.arquivos === null ? <div className="carregando">Carregando...</div>
          : docs.length === 0 && fotos.length === 0 ? <p className="pck-vazio">Nenhum documento anexado.</p> : (
            <ul className="as-docs">
              {docs.slice(0, 4).map((a) => (
                <li key={a.id_arquivo}>
                  <Icone nome="arquivo-texto" tamanho={20} />
                  <span className="as-docs__textos"><strong title={a.nome}>{a.nome}</strong><small>Adicionado em {data(a.criado_em)}</small></span>
                  <button type="button" className="botao botao--pequeno" aria-label="Baixar" onClick={() => anexos.baixar(a)}>
                    <Icone nome="baixar" tamanho={14} />
                  </button>
                </li>
              ))}
              {fotos.length > 0 && (
                <li>
                  <Icone nome="oc-camera" tamanho={20} />
                  <span className="as-docs__textos"><strong>Fotos do Sinistro ({fotos.length})</strong><small>Última em {dataHora(fotos[fotos.length - 1].criado_em)}</small></span>
                  <button type="button" className="botao botao--pequeno" aria-label="Ver fotos" onClick={() => navegar(`/frotas/sinistros/${idSinistro}?aba=fotos`)}>
                    <Icone nome="visualizar" tamanho={14} />
                  </button>
                </li>
              )}
            </ul>
          )}
      </Cartao>
    </div>
  );
}

export default function AbaSinistros({ idServidor, idVeiculo, linhas: prontas, podeFrotas, podeGerenciar }) {
  const navegar = useNavigate();
  const [busca, setBusca] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState("");
  const [status, setStatus] = useState("");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const [linhas, setLinhas] = useState(null);
  const [info, setInfo] = useState({ total: 0, paginas: 1 });
  const [aberto, setAberto] = useState(null);
  const [completo, setCompleto] = useState(null);
  const [janela, setJanela] = useState(null); // null | "novo" | sinistro (edicao)
  const [recarga, setRecarga] = useState(0);
  const usaApi = podeFrotas;

  // A busca so dispara meio segundo depois de parar de digitar.
  useEffect(() => {
    const t = setTimeout(() => setBuscaAtiva(busca.trim()), 400);
    return () => clearTimeout(t);
  }, [busca]);
  useEffect(() => { setPagina(1); }, [buscaAtiva, status]);

  const filtradasProntas = useMemo(() => {
    if (usaApi) return null;
    const q = buscaAtiva.toLowerCase();
    return (prontas || []).filter((x) => (!status || x.status === status)
      && (!q || [x.placa, x.local, x.descricao, x.numero, x.tipo && rotulo("tipoSinistro", x.tipo)].some((v) => String(v || "").toLowerCase().includes(q))));
  }, [usaApi, prontas, buscaAtiva, status]);

  useEffect(() => {
    if (!usaApi) {
      const lista = filtradasProntas || [];
      setInfo({ total: lista.length, paginas: Math.max(1, Math.ceil(lista.length / porPagina)) });
      setLinhas(lista.slice((pagina - 1) * porPagina, pagina * porPagina));
      return;
    }
    setLinhas(null);
    // 29/10: tambem nos Detalhes do Veiculo e da Viatura (filtra pelo veiculo).
    const q = new URLSearchParams(idVeiculo ? { veiculo: idVeiculo, pagina, porPagina } : { servidor: idServidor, pagina, porPagina });
    if (buscaAtiva) q.set("busca", buscaAtiva);
    if (status) q.set("status", status);
    api(`/frotas/sinistros?${q}`)
      .then((r) => { setLinhas(r.itens || []); setInfo({ total: r.total || 0, paginas: r.paginas || 1 }); })
      .catch(() => setLinhas([]));
  }, [usaApi, filtradasProntas, idServidor, idVeiculo, buscaAtiva, status, pagina, porPagina, recarga]);

  // Abre o primeiro da lista, como no desenho; ao recarregar, mantem o aberto.
  useEffect(() => {
    if (!linhas || !linhas.length) return;
    setAberto((a) => (a ? linhas.find((l) => l.id_sinistro === a.id_sinistro) || a : linhas[0]));
  }, [linhas]);

  // A ficha do sinistro aberto (envolvidos e o resto, para o Editar).
  useEffect(() => {
    setCompleto(null);
    if (!aberto || !usaApi) return;
    api(`/frotas/sinistros/${aberto.id_sinistro}`).then(setCompleto).catch(() => {});
  }, [aberto, usaApi, recarga]);

  const recarregar = () => setRecarga((n) => n + 1);

  return (
    <div className={`sd-sinistros as${aberto ? " sd-sinistros--aberto" : ""}`}>
      <div className="as-esquerda">
        <Cartao
          titulo={<><Icone nome="sinistro" tamanho={18} /> Lista de Sinistros</>}
          acao={(
            <span className="as-ferramentas">
              <span className="as-busca">
                <Icone nome="search" tamanho={14} />
                <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
                       placeholder={idVeiculo ? "Buscar por local, tipo, descrição..." : "Buscar por veículo, local, tipo..."} aria-label="Buscar sinistros" />
              </span>
              <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Situação">
                <option value="">Todos os status</option>
                {SITUACOES_SINISTRO.map((s) => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
              </select>
              {podeGerenciar && (
                <button className="botao botao--primario botao--pequeno" onClick={() => setJanela("novo")}>
                  <Icone nome="mais" tamanho={13} monocromatico /> Novo Sinistro
                </button>
              )}
            </span>
          )}>
          {!linhas ? <div className="carregando">Carregando...</div>
            : !linhas.length ? <p className="texto-corrido">{buscaAtiva || status ? "Nenhum sinistro com esses filtros." : "Nenhum sinistro registrado."}</p> : (
              <>
                <div className="rolagem-x">
                  <table className="tabela vd-tabela tabela-ficha as-tabela">
                    <thead>
                      <tr><th>Nº do Sinistro</th><th>Data</th>{!idVeiculo && <th>Veículo</th>}<th>Tipo</th><th>Local</th><th>Descrição</th><th>Status</th><th>Ações</th></tr>
                    </thead>
                    <tbody>
                      {linhas.map((x) => {
                        const ativo = aberto?.id_sinistro === x.id_sinistro;
                        return (
                          <tr key={x.id_sinistro} className="vd-tabela__linha" data-ativo={ativo ? "sim" : undefined}
                              onClick={() => setAberto(x)}>
                            <td><strong>{vazio(x.numero)}</strong></td>
                            <td>{data(x.data)}</td>
                            {!idVeiculo && <td><span className="celula-dupla"><strong>{x.placa}</strong><span>{x.marca} {x.modelo}</span></span></td>}
                            <td>{x.tipo ? rotulo("tipoSinistro", x.tipo) : "—"}</td>
                            <td className="as-quebra"><span className="as-clamp">{vazio(x.local)}</span></td>
                            <td className="as-quebra as-descricao"><span className="as-clamp" title={x.descricao || ""}>{vazio(x.descricao)}</span></td>
                            <td><Selo valor={x.status} /></td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <span className="as-acoes">
                                <button type="button" className="botao botao--pequeno" aria-label="Ver detalhes ao lado" onClick={() => setAberto(x)}>
                                  <Icone nome="visualizar" tamanho={14} />
                                </button>
                                {podeFrotas && (
                                  <Acoes acoes={[
                                    { rotulo: "Abrir em Sinistros", icone: "visualizar", aoClicar: () => navegar(`/frotas/sinistros/${x.id_sinistro}`) },
                                    ...(podeGerenciar ? [{ rotulo: "Editar", icone: "editar", aoClicar: async () => {
                                      try { setJanela(await api(`/frotas/sinistros/${x.id_sinistro}`)); } catch (e) { alert(e.message); }
                                    } }] : []),
                                  ]} />
                                )}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Paginacao pagina={pagina} setPagina={setPagina} porPagina={porPagina} setPorPagina={setPorPagina}
                           total={info.total} paginas={info.paginas} unidade="sinistros" />
              </>
            )}
        </Cartao>

        {aberto && podeFrotas && <ArquivosSinistro key={`${aberto.id_sinistro}-${recarga}`} idSinistro={aberto.id_sinistro} podeGerenciar={podeGerenciar} />}
      </div>

      {aberto && (
        <aside className="cartao sd-sinistro-resumo">
          <PainelSinistro linha={aberto} completo={completo} podeEditar={podeGerenciar} podeAbrir={podeFrotas}
                          aoEditar={() => setJanela(completo)} aoFechar={() => setAberto(null)} />
        </aside>
      )}

      {janela && (
        <RegistrarSinistro sinistro={janela === "novo" ? null : janela} idServidor={idServidor}
                           idVeiculo={idVeiculo ? String(idVeiculo) : undefined}
                           aoFechar={() => setJanela(null)} aoSalvar={recarregar} />
      )}
    </div>
  );
}
