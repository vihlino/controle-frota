/**
 * DocumentoAbas.jsx - Abas dos Detalhes do Documento no desenho do Cesar de
 * 29/10: Dados do Documento, Arquivo, Historico e Alertas e Vencimentos (a
 * Visao Geral continua na propria tela, DocumentoDetalhe.jsx).
 *
 *   Dados       os dados em duas colunas e o "Vinculo do Documento" (o
 *               veiculo, com a foto do cadastro)
 *   Arquivo     os arquivos em miniatura a esquerda (o escolhido em
 *               destaque), o visualizador ao lado (zoom, girar, tela cheia)
 *               e as "Informacoes do Arquivo" embaixo
 *   Historico   o Historico do Documento (todas as versoes, com busca e
 *               filtro de acao, dizendo o que mudou) e o Historico de Versoes
 *   Alertas     os documentos do veiculo com os dias restantes
 *
 * Fica de fora o que o SITRA nao guarda: o IP de quem alterou e a
 * configuracao de alerta por documento (o alerta e o do sistema: 90 dias antes).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Cartao from "./Cartao.jsx";
import Icone from "./Icone.jsx";
import Selo from "./Selo.jsx";
import Acoes from "./Acoes.jsx";
import { Paginacao } from "./Tabela.jsx";
import { useConfirmacaoSenha } from "./ConfirmarSenha.jsx";
import { useFotoVeiculo } from "./FaixaVeiculo.jsx";
import { api, apiArquivo } from "../lib/api.js";
import { data, dataHora, status as situacaoDe } from "../lib/formato.js";
import { tamanhoArquivo } from "../lib/arquivos.js";

const vazio = (v) => (v === null || v === undefined || v === "" ? "—" : v);
export const tipoCurto = (t) => (t === "application/pdf" ? "PDF" : t === "image/png" ? "PNG" : t === "image/jpeg" ? "JPG" : "DOC");
const dia = (v) => (v ? String(v).slice(0, 10) : "");

/** Selo "-70 dias" / "30 dias" / "285 dias" pelo prazo. */
export function SeloDias({ dias }) {
  if (dias === null || dias === undefined) return <span className="dd-dias" data-tom="cinza">Não vence</span>;
  const tom = dias < 0 ? "vermelho" : dias <= 90 ? "amarelo" : "verde";
  return <span className="dd-dias" data-tom={tom}>{dias} dias</span>;
}

/** URLs locais (blob) dos arquivos, para miniatura e visualizador. */
function useBlobs(arquivos) {
  const [urls, setUrls] = useState({});
  const chave = (arquivos || []).map((a) => a.id_arquivo).join(",");
  useEffect(() => {
    let vivo = true;
    const criadas = [];
    (arquivos || []).forEach(async (a) => {
      try {
        const u = await apiArquivo(`/frotas/documentos/arquivos/${a.id_arquivo}`);
        criadas.push(u);
        if (vivo) setUrls((x) => ({ ...x, [a.id_arquivo]: u }));
      } catch { /* fica o icone */ }
    });
    return () => { vivo = false; criadas.forEach((u) => URL.revokeObjectURL(u)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return urls;
}

/** Abre o arquivo do documento numa aba nova. */
export async function abrirArquivo(a) {
  const janela = window.open("", "_blank");
  try {
    const url = await apiArquivo(`/frotas/documentos/arquivos/${a.id_arquivo}`);
    if (janela) janela.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
  } catch (e) {
    janela?.close();
    alert(e.message);
  }
}

export async function baixarArquivo(a) {
  try {
    const url = await apiArquivo(`/frotas/documentos/arquivos/${a.id_arquivo}`);
    const link = document.createElement("a");
    link.href = url; link.download = a.nome; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    alert(e.message);
  }
}

/** Imprime o ARQUIVO (nao a tela): carrega num quadro escondido e chama print. */
export async function imprimirArquivo(a) {
  try {
    const url = await apiArquivo(`/frotas/documentos/arquivos/${a.id_arquivo}`);
    const quadro = document.createElement("iframe");
    quadro.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    quadro.src = url;
    quadro.onload = () => {
      setTimeout(() => {
        try { quadro.contentWindow.focus(); quadro.contentWindow.print(); } catch { window.open(url, "_blank"); }
      }, 300);
    };
    document.body.appendChild(quadro);
    setTimeout(() => { quadro.remove(); URL.revokeObjectURL(url); }, 10 * 60_000);
  } catch (e) {
    alert(e.message);
  }
}

// ======================================================= Dados do Documento
export function AbaDados({ d, antigo, pode, aoEditar }) {
  const foto = useFotoVeiculo(d.id_veiculo, d.foto_em);
  const navegar = useNavigate();
  const ultimo = (d.arquivos || [])[d.arquivos.length - 1];
  const esquerda = [
    ["Nome do documento", ultimo ? ultimo.nome : d.tipo_documento],
    ["Tipo de documento", d.categoria ? `${d.tipo_documento} (${d.categoria})` : d.tipo_documento],
    ["Número do documento", d.numero_documento],
    ["Órgão emissor", d.orgao_emissor],
    ["Categoria", d.categoria],
    ["Placa", d.placa],
    ["Descrição", d.observacoes],
  ];
  const direita = [
    ["Data de emissão", d.data_emissao ? data(d.data_emissao) : null],
    ["Data de validade", d.data_validade ? data(d.data_validade) : "Não vence"],
    ["Situação", antigo ? <Selo texto="Substituído" tom="cinza" /> : <Selo valor={d.situacao} />],
    ["Dias para vencimento", !antigo && d.dias_para_vencer != null ? `${d.dias_para_vencer} dias` : null],
    ["Responsável", d.responsavel],
    ["Data de cadastro", d.criado_em ? dataHora(d.criado_em) : null],
  ];
  const coluna = (linhas) => (
    <dl className="dd-dados__coluna">
      {linhas.map(([r, v]) => <div key={r}><dt>{r}</dt><dd title={typeof v === "string" ? v : undefined}>{vazio(v)}</dd></div>)}
    </dl>
  );
  const botaoEditar = pode && (
    <button className="botao botao--pequeno vd-cartao-acao" onClick={aoEditar}>
      <Icone nome="editar" tamanho={13} /> Editar informações
    </button>
  );
  return (
    <>
      <Cartao titulo={<><Icone nome="informacao" tamanho={18} /> Dados do Documento</>} acao={botaoEditar}>
        <div className="dd-dados">{coluna(esquerda)}{coluna(direita)}</div>
      </Cartao>
      <Cartao titulo={<><Icone nome="kpi-car" tamanho={18} /> Vínculo do Documento</>}>
        <div className="dd-vinculo">
          <button type="button" className="dd-vinculo__foto" title="Abrir os detalhes do veículo"
                  onClick={() => navegar(`/frotas/veiculos/${d.id_veiculo}`)}>
            {foto ? <img src={foto} alt={`Foto do veículo ${d.placa}`} /> : <Icone nome="kpi-car" tamanho={30} />}
          </button>
          <span className="dd-vinculo__veiculo">
            <strong>{d.placa}</strong>
            <span>{d.marca} {d.modelo}</span>
          </span>
          <span className="dd-vinculo__setor">
            <Icone nome="usuarios" tamanho={22} />
            <span><small>Setor</small><strong>{vazio(d.setor)}</strong></span>
          </span>
          {botaoEditar}
        </div>
      </Cartao>
    </>
  );
}

// ================================================================ Arquivo
function Visualizador({ arquivo: a, url }) {
  const [zoom, setZoom] = useState(100);
  const [giro, setGiro] = useState(0);
  const area = useRef(null);
  const ehPdf = a.tipo === "application/pdf";
  useEffect(() => { setZoom(100); setGiro(0); }, [a.id_arquivo]);
  const telaCheia = () => {
    const el = area.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.();
  };
  return (
    <div className="dd-visor" ref={area}>
      <div className="dd-visor__area">
        {!url ? <span className="doc-previa__vazio">Carregando o arquivo...</span>
          : ehPdf
            ? <object key={`${zoom}-${a.id_arquivo}`} data={`${url}#toolbar=0&view=FitH&zoom=${zoom}`} type="application/pdf"
                      aria-label={a.nome} style={{ transform: giro ? `rotate(${giro}deg)` : undefined }} />
            : <img src={url} alt={a.nome} style={{ transform: `scale(${zoom / 100}) rotate(${giro}deg)` }} />}
      </div>
      <div className="dd-visor__barra">
        <button type="button" aria-label="Diminuir" onClick={() => setZoom((z) => Math.max(50, z - 25))}><Icone nome="minus" tamanho={16} monocromatico /></button>
        <span>{zoom}%</span>
        <button type="button" aria-label="Aumentar" onClick={() => setZoom((z) => Math.min(300, z + 25))}><Icone nome="mais" tamanho={16} monocromatico /></button>
        <span className="dd-visor__sep" />
        <button type="button" aria-label="Girar" onClick={() => setGiro((g) => (g + 90) % 360)}><Icone nome="historico" tamanho={16} monocromatico /></button>
        <button type="button" aria-label="Tamanho original" onClick={() => { setZoom(100); setGiro(0); }}><Icone nome="search" tamanho={16} monocromatico /></button>
        <button type="button" aria-label="Tela cheia" onClick={telaCheia}><Icone nome="visualizar" tamanho={16} monocromatico /></button>
      </div>
    </div>
  );
}

export function AbaArquivo({ arquivos, pode, enviando, aoAdicionar, aoMudar }) {
  const urls = useBlobs(arquivos);
  const [escolhido, setEscolhido] = useState(null);
  const { pedirExclusao, elemento: modalSenha } = useConfirmacaoSenha();
  const lista = arquivos || [];
  const atual = lista.find((a) => a.id_arquivo === escolhido) || lista[lista.length - 1] || null;
  // Mais novo primeiro, como no desenho.
  const ordem = [...lista].reverse();

  async function remover(a) {
    const r = await pedirExclusao({ titulo: "Remover arquivo", oQue: `o arquivo ${a.nome}` });
    if (!r.ok) return;
    try {
      await api(`/frotas/documentos/arquivos/${a.id_arquivo}`, { method: "DELETE", body: { justificativa: r.justificativa } });
      setEscolhido(null);
      aoMudar?.();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <>
      <section className="cartao dd-arquivo">
        <header className="dd-titulo">
          <Icone nome="documentos" tamanho={22} />
          <div>
            <h2>Arquivo do Documento</h2>
            <p>Visualize o arquivo atual, faça o download ou substitua por uma nova versão.</p>
          </div>
        </header>
        {lista.length === 0 && !pode ? <p className="texto-corrido">Nenhum arquivo anexado a este documento.</p> : (
          <div className="dd-arquivo__corpo">
            <div className="dd-miniaturas">
              {ordem.map((a) => (
                <button key={a.id_arquivo} type="button" className="dd-mini" data-ativo={atual?.id_arquivo === a.id_arquivo ? "sim" : undefined}
                        onClick={() => setEscolhido(a.id_arquivo)}>
                  <span className="dd-mini__previa">
                    {!urls[a.id_arquivo] ? <span className="ad-tipo" data-tipo={tipoCurto(a.tipo)}>{tipoCurto(a.tipo)}</span>
                      : a.tipo === "application/pdf"
                        ? <object data={`${urls[a.id_arquivo]}#toolbar=0&navpanes=0&view=FitH`} type="application/pdf" aria-hidden="true" tabIndex={-1} />
                        : <img src={urls[a.id_arquivo]} alt="" />}
                  </span>
                  <strong title={a.nome}>{a.nome}</strong>
                  <small>{tipoCurto(a.tipo)} • {tamanhoArquivo(a.bytes)}</small>
                  <small>{dataHora(a.criado_em)}</small>
                </button>
              ))}
              {pode && (
                <button type="button" className="dd-mini dd-mini--novo" onClick={aoAdicionar} disabled={enviando}>
                  <Icone nome="adicionar" tamanho={24} />
                  <strong>{enviando ? "Enviando..." : "Adicionar novo arquivo"}</strong>
                  <small>Envie uma nova versão do documento (PDF, JPG ou PNG).</small>
                </button>
              )}
            </div>
            {atual ? <Visualizador arquivo={atual} url={urls[atual.id_arquivo]} />
              : <div className="dd-visor dd-visor--vazio"><span>Nenhum arquivo anexado a este documento.</span></div>}
          </div>
        )}
      </section>

      {atual && (
        <Cartao titulo={<><Icone nome="informacao" tamanho={18} /> Informações do Arquivo</>}
                acao={pode && (
                  <button className="botao botao--pequeno vd-cartao-acao" onClick={() => remover(atual)}>
                    <Icone nome="lixo" tamanho={13} /> Remover
                  </button>
                )}>
          <dl className="dd-info-arquivo">
            <div><Icone nome="arquivo-texto" tamanho={18} /><span><dt>Nome do arquivo</dt><dd title={atual.nome}>{atual.nome}</dd></span></div>
            <div><Icone nome="documento" tamanho={18} /><span><dt>Tipo de arquivo</dt><dd>{tipoCurto(atual.tipo)}</dd></span></div>
            <div><Icone nome="documentos" tamanho={18} /><span><dt>Tamanho</dt><dd>{tamanhoArquivo(atual.bytes)}</dd></span></div>
            <div><Icone nome="calendar" tamanho={18} /><span><dt>Adicionado em</dt><dd>{dataHora(atual.criado_em)}</dd></span></div>
            <div><Icone nome="user" tamanho={18} /><span><dt>Adicionado por</dt><dd>{vazio(atual.enviado_por_nome)}</dd></span></div>
          </dl>
        </Cartao>
      )}
      {modalSenha}
    </>
  );
}

// =============================================================== Historico
const CAMPOS = {
  tipo_documento: ["tipo do documento"], categoria: ["categoria"], numero_documento: ["número do documento"],
  orgao_emissor: ["órgão emissor"], data_emissao: ["data de emissão", "data"], data_validade: ["data de validade", "data"],
  status: ["status", "status"], observacoes: ["descrição"], id_responsavel: ["responsável", "responsavel"],
};
const valorDe = (v, tipo) => {
  if (v === null || v === undefined || v === "") return "vazio";
  if (tipo === "data") return data(dia(v));
  if (tipo === "status") return situacaoDe(v).texto;
  return String(v);
};
function mudancas(antes, depois) {
  if (!antes || !depois) return [];
  return Object.entries(CAMPOS)
    .filter(([c]) => c in depois && String(antes[c] ?? "") !== String(depois[c] ?? "")
      && !(CAMPOS[c][1] === "data" && dia(antes[c]) === dia(depois[c])))
    .map(([c, [nome, tipo]]) => (tipo === "responsavel"
      ? "Responsável alterado"
      : `Alteração ${nome === "descrição" ? "na" : nome.startsWith("data") || nome === "categoria" ? "na" : "no"} ${nome} de ${valorDe(antes[c], tipo)} para ${valorDe(depois[c], tipo)}`));
}

const ACOES = {
  cadastro: { icone: "mais", texto: "Documento cadastrado" },
  edicao: { icone: "editar", texto: "Informações editadas" },
  arquivo: { icone: "baixar", texto: "Arquivo adicionado" },
  remocao: { icone: "lixo", texto: "Arquivo removido" },
  versao: { icone: "historico", texto: "Nova versão" },
  substituicao: { icone: "historico", texto: "Substituído" },
  exclusao: { icone: "lixo", texto: "Exclusão" },
};

function linhaDoHistorico(l, idVersao, nVersao, versoes) {
  const v = `v${nVersao}`;
  if (l.entidade === "documento_arquivo") {
    const bytes = (l.dados_novos || l.dados_anteriores || {}).bytes;
    return l.acao === "EXCLUIR"
      ? { tipo: "remocao", descricao: `Arquivo "${l.arquivo || ""}" removido.`, versao: v }
      : { tipo: "arquivo", descricao: `Arquivo "${l.arquivo || ""}"${bytes ? ` (${tamanhoArquivo(bytes)})` : ""} adicionado.`, versao: v };
  }
  if (l.acao === "ATUALIZAR_DOCUMENTO") {
    const n = versoes.length - versoes.findIndex((x) => String(x.id_documento) === String(l.id_registro));
    return { tipo: "versao", descricao: `Nova versão (v${n}) cadastrada (renovação).`, versao: `v${n}` };
  }
  if (l.acao === "CRIAR") return { tipo: "cadastro", descricao: `Documento cadastrado${l.dados_novos?.tipo_documento ? `: "${l.dados_novos.tipo_documento}"` : ""}.`, versao: v };
  if (l.acao === "EDITAR") {
    const m = mudancas(l.dados_anteriores, l.dados_novos);
    return { tipo: "edicao", descricao: `${m.length ? m.join("; ") : "Informações do documento alteradas"}.`, versao: v };
  }
  if (l.acao === "EXCLUIR") return { tipo: "exclusao", descricao: "Documento excluído.", versao: v };
  return { tipo: "edicao", descricao: l.acao, versao: v, idVersao };
}

export function AbaHistorico({ d, recarga }) {
  const navegar = useNavigate();
  const versoes = d.versoes && d.versoes.length ? d.versoes : [{ id_documento: d.id_documento, criado_em: d.criado_em }];
  const [linhas, setLinhas] = useState(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const idsVersoes = versoes.map((x) => x.id_documento).join(",");

  // O historico junta todas as versoes; cada linha diz de qual versao e.
  useEffect(() => {
    let vivo = true;
    setLinhas(null);
    Promise.all(versoes.map((x, i) => api(`/frotas/historico/documento/${x.id_documento}`)
      .then((r) => (Array.isArray(r) ? r : []).map((l) => ({ l, idVersao: x.id_documento, nVersao: versoes.length - i })))
      .catch(() => [])))
      .then((grupos) => {
        if (!vivo) return;
        const vistos = new Set();
        const todas = [];
        grupos.flat().forEach(({ l, idVersao, nVersao }) => {
          if (vistos.has(l.id_auditoria)) return;
          // A renovacao aparece nas duas versoes: fica a da versao nova.
          if (l.acao === "ATUALIZAR_DOCUMENTO" && String(l.id_registro) !== String(idVersao)
              && versoes.some((x) => String(x.id_documento) === String(l.id_registro))) return;
          vistos.add(l.id_auditoria);
          todas.push({ quando: l.data_hora, usuario: l.usuario, justificativa: l.justificativa,
            ...linhaDoHistorico(l, idVersao, nVersao, versoes) });
        });
        // Documento antigo, de antes da auditoria: o cadastro entra pela data.
        if (!todas.some((x) => x.tipo === "cadastro")) {
          const primeira = versoes[versoes.length - 1];
          if (primeira?.criado_em) todas.push({ quando: primeira.criado_em, usuario: primeira.criado_por_nome, tipo: "cadastro", descricao: "Documento cadastrado no sistema.", versao: "v1" });
        }
        todas.sort((a, b) => String(b.quando).localeCompare(String(a.quando)));
        setLinhas(todas);
      });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsVersoes, recarga]);

  useEffect(() => { setPagina(1); }, [busca, filtro]);
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (linhas || []).filter((x) => (!filtro || x.tipo === filtro)
      && (!q || [x.descricao, x.usuario, x.versao, ACOES[x.tipo]?.texto, x.justificativa].some((t) => String(t || "").toLowerCase().includes(q))));
  }, [linhas, busca, filtro]);
  const paginas = Math.max(1, Math.ceil(filtradas.length / porPagina));
  const visiveis = filtradas.slice((pagina - 1) * porPagina, pagina * porPagina);

  return (
    <>
      <section className="cartao dd-historico">
        <header className="dd-titulo">
          <Icone nome="historico" tamanho={22} />
          <div>
            <h2>Histórico do Documento</h2>
            <p>Veja todas as alterações, versões e atividades realizadas neste documento.</p>
          </div>
          <span className="as-ferramentas">
            <span className="as-busca">
              <Icone nome="search" tamanho={14} />
              <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
                     placeholder="Buscar por descrição, usuário ou versão..." aria-label="Buscar no histórico" />
            </span>
            <select value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Filtrar por ação">
              <option value="">Todas as ações</option>
              {["cadastro", "edicao", "arquivo", "remocao", "versao"].map((k) => <option key={k} value={k}>{ACOES[k].texto}</option>)}
            </select>
          </span>
        </header>
        {!linhas ? <div className="carregando">Carregando...</div> : !filtradas.length ? <p className="texto-corrido">Nenhum registro no histórico.</p> : (
          <>
            <div className="rolagem-x">
              <table className="tabela dd-tabela">
                <thead><tr><th>Data / Hora</th><th>Ação</th><th>Descrição</th><th>Usuário</th><th>Versão</th></tr></thead>
                <tbody>
                  {visiveis.map((x, i) => (
                    <tr key={`${x.quando}-${i}`}>
                      <td className="dd-nowrap">{dataHora(x.quando)}</td>
                      <td className="dd-nowrap"><span className="dd-acao"><Icone nome={ACOES[x.tipo]?.icone || "editar"} tamanho={16} /> {ACOES[x.tipo]?.texto || x.tipo}</span></td>
                      <td className="dd-descricao">{x.descricao}{x.justificativa ? <small>Motivo: {x.justificativa}</small> : null}</td>
                      <td><span className="dd-usuario"><Icone nome="user" tamanho={14} /> {vazio(x.usuario)}</span></td>
                      <td><span className="dd-versao">{x.versao}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao pagina={pagina} setPagina={setPagina} porPagina={porPagina} setPorPagina={setPorPagina}
                       total={filtradas.length} paginas={paginas} unidade="registros" />
          </>
        )}
      </section>

      <section className="cartao dd-historico">
        <header className="dd-titulo">
          <Icone nome="documento" tamanho={22} />
          <div>
            <h2>Histórico de Versões</h2>
            <p>Veja todas as versões deste documento. Ao substituir (renovação), a versão anterior fica guardada aqui.</p>
          </div>
        </header>
        <div className="rolagem-x">
          <table className="tabela dd-tabela">
            <thead><tr><th>Versão</th><th>Data / Hora</th><th>Arquivo</th><th className="dd-col-tam">Tamanho</th><th>Usuário</th><th>Descrição</th><th>Ações</th></tr></thead>
            <tbody>
              {versoes.map((x, i) => {
                const n = versoes.length - i;
                const esta = String(x.id_documento) === String(d.id_documento);
                const a = x.arquivo;
                return (
                  <tr key={x.id_documento} data-ativo={esta ? "sim" : undefined}>
                    <td><span className="dd-versao">v{n}</span></td>
                    <td className="dd-nowrap">{dataHora(x.criado_em)}</td>
                    <td>{a ? <span className="dd-arq"><span className="ad-tipo" data-tipo={tipoCurto(a.tipo)}>{tipoCurto(a.tipo)}</span><span title={a.nome}>{a.nome}</span></span> : <span className="texto-fraco">Sem arquivo</span>}</td>
                    <td className="dd-nowrap dd-col-tam">{a ? tamanhoArquivo(a.bytes) : "—"}</td>
                    <td><span className="dd-usuario"><Icone nome="user" tamanho={14} /> {vazio(x.criado_por_nome)}</span></td>
                    <td className="dd-descricao">
                      {!x.substituido_em ? "Versão atual do documento." : n === 1 ? "Cadastro inicial." : "Renovação."}
                      {x.data_validade ? <small>Validade {data(x.data_validade)}</small> : null}
                      {esta && <small><strong>Versão aberta</strong></small>}
                    </td>
                    <td>
                      <span className="as-acoes">
                        <button type="button" className="botao botao--pequeno" aria-label="Visualizar"
                                title={a ? "Visualizar o arquivo" : "Abrir esta versão"}
                                onClick={() => (a ? abrirArquivo(a) : navegar(`/frotas/documentos/${x.id_documento}`))}>
                          <Icone nome="visualizar" tamanho={14} />
                        </button>
                        <button type="button" className="botao botao--pequeno" aria-label="Baixar" disabled={!a} onClick={() => a && baixarArquivo(a)}>
                          <Icone nome="baixar" tamanho={14} />
                        </button>
                        {!esta && (
                          <Acoes acoes={[{ rotulo: "Abrir esta versão", icone: "historico", aoClicar: () => navegar(`/frotas/documentos/${x.id_documento}`) }]} />
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

// ================================================== Alertas e Vencimentos
const ICONE_CATEGORIA = {
  Licenciamento: ["documento", "vermelho"], Seguro: ["check", "azul"], Inspecao: ["inspecao", "roxo"], Inspeção: ["inspecao", "roxo"],
  Imposto: ["dinheiro", "amarelo"], Registro: ["documentos", "azul"],
};
const SITUACOES = [
  { valor: "VALIDO", rotulo: "Em dia" }, { valor: "VENCENDO", rotulo: "A vencer" },
  { valor: "VENCIDO", rotulo: "Vencido" }, { valor: "INATIVO", rotulo: "Inativo" },
];
const SELO_SITUACAO = { VALIDO: ["Em dia", "verde"], VENCENDO: ["A vencer", "amarelo"], VENCIDO: ["Vencido", "vermelho"], INATIVO: ["Inativo", "cinza"] };

export function AbaAlertas({ d, docs }) {
  const navegar = useNavigate();
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  useEffect(() => { setPagina(1); }, [busca, situacao]);
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    // Vencidos e os mais perto de vencer primeiro.
    return (docs || []).filter((x) => (!situacao || x.status === situacao)
      && (!q || [x.tipo_documento, x.categoria, x.numero_documento, x.observacoes].some((t) => String(t || "").toLowerCase().includes(q))))
      .sort((a, b) => (a.dias_para_vencer ?? 99999) - (b.dias_para_vencer ?? 99999));
  }, [docs, busca, situacao]);
  const paginas = Math.max(1, Math.ceil(filtradas.length / porPagina));
  const visiveis = filtradas.slice((pagina - 1) * porPagina, pagina * porPagina);

  return (
    <section className="cartao dd-historico">
      <header className="dd-titulo">
        <Icone nome="alert-triangle" tamanho={22} />
        <div>
          <h2>Alertas e Vencimentos</h2>
          <p>Acompanhe os prazos, alertas e o status de validade dos documentos do veículo {d.placa}.</p>
        </div>
        <span className="as-ferramentas">
          <span className="as-busca">
            <Icone nome="search" tamanho={14} />
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar documento..." aria-label="Buscar documento" />
          </span>
          <select value={situacao} onChange={(e) => setSituacao(e.target.value)} aria-label="Situação">
            <option value="">Todos os status</option>
            {SITUACOES.map((s) => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
          </select>
        </span>
      </header>
      {!docs ? <div className="carregando">Carregando...</div> : !filtradas.length ? <p className="texto-corrido">Nenhum documento encontrado.</p> : (
        <>
          <div className="rolagem-x">
            <table className="tabela dd-tabela dd-alertas">
              <thead><tr><th>Tipo de documento</th><th className="dd-col-desc">Descrição</th><th className="dd-col-emissao">Data de emissão</th><th>Data de validade</th><th>Dias restantes</th><th>Status</th><th>Ações</th></tr></thead>
              <tbody>
                {visiveis.map((x) => {
                  const [icone, tom] = ICONE_CATEGORIA[x.categoria] || ["documento", "cinza"];
                  const [texto, tomSelo] = SELO_SITUACAO[x.status] || [x.status, "cinza"];
                  const esta = x.id_documento === d.id_documento;
                  return (
                    <tr key={x.id_documento} data-ativo={esta ? "sim" : undefined}>
                      <td>
                        <span className="dd-tipo-doc">
                          <span className="dd-tipo-doc__icone" data-tom={tom}><Icone nome={icone} tamanho={20} /></span>
                          <span><strong>{x.tipo_documento}</strong><small>{vazio(x.categoria)}</small></span>
                        </span>
                      </td>
                      <td className="dd-descricao dd-col-desc">
                        {x.numero_documento ? `Nº ${x.numero_documento}` : "Sem número"}
                        {x.observacoes ? <small title={x.observacoes}>{x.observacoes}</small> : null}
                      </td>
                      <td className="dd-nowrap dd-col-emissao">{x.data_emissao ? data(x.data_emissao) : "—"}</td>
                      <td className="dd-nowrap">{x.data_validade ? data(x.data_validade) : "Não vence"}</td>
                      <td><SeloDias dias={x.dias_para_vencer} /></td>
                      <td><Selo texto={texto} tom={tomSelo} /></td>
                      <td>
                        <span className="as-acoes">
                          <button type="button" className="botao botao--pequeno" disabled={esta}
                                  onClick={() => navegar(`/frotas/documentos/${x.id_documento}`)}>
                            <Icone nome="visualizar" tamanho={14} /> {esta ? "Aberto" : "Visualizar"}
                          </button>
                          <Acoes acoes={[
                            { rotulo: "Abrir o documento", icone: "visualizar", aoClicar: () => navegar(`/frotas/documentos/${x.id_documento}`) },
                            ...(x.ultimo_arquivo ? [
                              { rotulo: "Visualizar arquivo", icone: "documentos", aoClicar: () => abrirArquivo(x.ultimo_arquivo) },
                              { rotulo: "Baixar arquivo", icone: "baixar", aoClicar: () => baixarArquivo(x.ultimo_arquivo) },
                            ] : []),
                          ]} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Paginacao pagina={pagina} setPagina={setPagina} porPagina={porPagina} setPorPagina={setPorPagina}
                     total={filtradas.length} paginas={paginas} unidade="registros" />
          <p className="vd2-nota" style={{ marginTop: 8 }}>O alerta de vencimento é automático: o documento passa a "A vencer" 90 dias antes da validade e entra nos alertas do sistema.</p>
        </>
      )}
    </section>
  );
}
