/**
 * DocumentoDetalhe.jsx - Detalhes do Documento.
 *
 * Desenho do Cesar (06/10), o mais parecido possivel: cabecalho com icone,
 * faixa do veiculo e abas Visao geral, Dados do documento, Arquivo,
 * Historico e Alertas e vencimentos. Continua tudo o que a tela ja tinha: os arquivos anexados e o
 * HISTORICO DE VERSOES (Atualizar = renovacao; a versao antiga nao e apagada
 * e abre nesta mesma tela, com aviso e sem os botoes de alterar).
 *
 * Fica de fora o que o SITRA nao tem: ano de referencia, configurar alerta
 * de vencimento, enviar por e-mail.
 *
 * 26/10 (desenho novo do Cesar): no topo a faixa do veiculo COM A FOTO do
 * cadastro (FaixaVeiculo); na Visao Geral o cartao do arquivo vem primeiro,
 * com a previa ao lado (zoom, girar, tela cheia); o aviso de vencimento fica
 * dentro do Historico de Versoes.
 *
 * 29/10 (desenho do Cesar): abas Dados do Documento, Arquivo, Historico e
 * Alertas e Vencimentos refeitas (components/DocumentoAbas.jsx), todas com o
 * Status do Documento e as Acoes Rapidas a direita; "Imprimir documento"
 * imprime o arquivo, e entram "Visualizar arquivo" e "Baixar arquivo".
 */
import { useEffect, useRef, useState } from "react";
import { useOutletContext, useParams, useNavigate, useSearchParams } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import Selo from "../../components/Selo.jsx";
import FormularioDocumento from "../../components/FormularioDocumento.jsx";
import { AbaDados, AbaArquivo, AbaHistorico, AbaAlertas, abrirArquivo, baixarArquivo, imprimirArquivo } from "../../components/DocumentoAbas.jsx";
import FaixaVeiculo from "../../components/FaixaVeiculo.jsx";
import HistoricoAuditoria from "../../components/HistoricoAuditoria.jsx";
import { useArquivos } from "../../components/useArquivos.js";
import { api, apiArquivo } from "../../lib/api.js";
import { data, dataHora } from "../../lib/formato.js";
import { ACEITAR, tamanhoArquivo } from "../../lib/arquivos.js";
import { useSessao } from "../../lib/sessao.jsx";

const vazio = (v) => (v === null || v === undefined || v === "" ? "—" : v);

function Item({ rotulo: r, children }) {
  return (
    <div className="vd-resumo__item">
      <span className="vd-resumo__rotulo">{r}</span>
      <span className="vd-resumo__valor">{children}</span>
    </div>
  );
}

function Linhas({ linhas }) {
  return (
    <dl className="vd-dados__coluna">
      {linhas.map(([r, v]) => (
        <div className="vd-dados__linha" key={r}><dt>{r}</dt><dd>{vazio(v)}</dd></div>
      ))}
    </dl>
  );
}

/*
 * Previa do arquivo (26/10): foto com zoom e girar; PDF no leitor do
 * navegador. "Tela cheia" abre o arquivo numa aba nova.
 */
function PreviaArquivo({ arquivo: a, miniatura, aoAbrir }) {
  const [zoom, setZoom] = useState(100);
  const [giro, setGiro] = useState(0);
  const [pdf, setPdf] = useState(null);
  const ehPdf = a.tipo === "application/pdf";
  useEffect(() => {
    setZoom(100); setGiro(0); setPdf(null);
    if (!ehPdf) return undefined;
    let criada = null;
    apiArquivo(`/frotas/documentos/arquivos/${a.id_arquivo}`)
      .then((u) => { criada = u; setPdf(u); })
      .catch(() => {});
    return () => { if (criada) URL.revokeObjectURL(criada); };
  }, [a.id_arquivo, ehPdf]);
  return (
    <div className="doc-previa">
      <div className="doc-previa__area">
        {ehPdf
          ? (pdf ? <object data={`${pdf}#toolbar=0&view=FitH`} type="application/pdf" aria-label={a.nome} /> : <span className="doc-previa__vazio">Carregando a prévia...</span>)
          : miniatura
            ? <img src={miniatura} alt={a.nome} style={{ transform: `scale(${zoom / 100}) rotate(${giro}deg)` }} />
            : <span className="doc-previa__vazio">Carregando a prévia...</span>}
      </div>
      <div className="doc-previa__barra">
        {!ehPdf && (
          <>
            <button type="button" aria-label="Diminuir" onClick={() => setZoom((z) => Math.max(50, z - 25))}><Icone nome="minus" tamanho={16} monocromatico /></button>
            <span>{zoom}%</span>
            <button type="button" aria-label="Aumentar" onClick={() => setZoom((z) => Math.min(300, z + 25))}><Icone nome="mais" tamanho={16} monocromatico /></button>
          </>
        )}
        <span className="doc-previa__espaco" />
        {!ehPdf && (
          <button type="button" aria-label="Girar" onClick={() => setGiro((g) => (g + 90) % 360)}><Icone nome="historico" tamanho={16} monocromatico /></button>
        )}
        <button type="button" aria-label="Tela cheia" onClick={aoAbrir}><Icone nome="visualizar" tamanho={16} monocromatico /></button>
      </div>
    </div>
  );
}

/** Quadro do "Status do Documento", pela situacao calculada. */
function quadroDaSituacao(d, antigo) {
  if (antigo) return { tom: "cinza", icone: "historico", titulo: "Substituído", texto: "Versão antiga, guardada no histórico." };
  const dias = d.dias_para_vencer;
  return {
    VALIDO: { tom: "verde", icone: "check", titulo: "Válido", texto: d.data_validade ? "Documento dentro do prazo de validade." : "Documento sem data de vencimento." },
    VENCENDO: { tom: "amarelo", icone: "alert-triangle", titulo: "Vencendo", texto: `Vence em ${dias} dia${dias === 1 ? "" : "s"}: providencie a renovação.` },
    VENCIDO: { tom: "vermelho", icone: "alert-triangle", titulo: "Vencido", texto: `Venceu há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? "" : "s"}.` },
    INATIVO: { tom: "cinza", icone: "inativos", titulo: "Inativo", texto: "Documento arquivado: não entra nos alertas." },
  }[d.situacao] || { tom: "verde", icone: "check", titulo: d.situacao, texto: "" };
}

export default function DocumentoDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const { podeVer } = useSessao();
  const [doc, setDoc] = useState(null);
  const [erro, setErro] = useState("");
  const [recarga, setRecarga] = useState(0);
  const [formulario, setFormulario] = useState(null); // "editar" | "atualizar" | null
  const [docsVeiculo, setDocsVeiculo] = useState(null);
  const [parametros, definirParametros] = useSearchParams();
  const aba = parametros.get("aba") || "geral";
  const setAba = (chave) => {
    const p = new URLSearchParams(parametros);
    if (chave === "geral") p.delete("aba"); else p.set("aba", chave);
    definirParametros(p, { replace: true });
  };
  const entrada = useRef(null);
  const anexos = useArquivos(`/frotas/documentos/${id}/arquivos`, "/frotas/documentos/arquivos", recarga);

  useEffect(() => {
    definirCabecalho({ titulo: "", legenda: "" });
  }, [definirCabecalho]);

  useEffect(() => {
    setErro("");
    api(`/frotas/documentos/${id}/ficha`).then(setDoc).catch((e) => setErro(e.message));
  }, [id, recarga]);

  useEffect(() => {
    if (!doc?.id_veiculo) return;
    api(`/frotas/documentos?veiculo=${doc.id_veiculo}&porPagina=50`)
      .then((r) => setDocsVeiculo(r?.itens || []))
      .catch(() => setDocsVeiculo([]));
  }, [doc?.id_veiculo, recarga]);

  if (erro && !doc) return <Cartao><div className="vazio">{erro}</div></Cartao>;
  if (!doc) return <div className="carregando">Carregando o documento...</div>;

  const d = doc;
  const podeGerenciar = podeVer("FROTAS_GERENCIAR_DOCUMENTOS");
  const antigo = !!d.substituido_em;
  const pode = podeGerenciar && !antigo;
  const atual = (d.versoes || []).find((v) => !v.substituido_em);
  const quadro = quadroDaSituacao(d, antigo);
  const recarregar = () => setRecarga((n) => n + 1);
  const arquivos = anexos.arquivos || [];
  const ultimo = arquivos[arquivos.length - 1];
  const alertaAtivo = !antigo && d.situacao !== "INATIVO" && !!d.data_validade;

  const ABAS = [
    { chave: "geral", rotulo: "Visão Geral", icone: "informacao" },
    { chave: "dados", rotulo: "Dados do Documento", icone: "documento" },
    { chave: "arquivo", rotulo: "Arquivo", icone: "documentos", total: arquivos.length || undefined },
    { chave: "historico", rotulo: "Histórico", icone: "historico", total: (d.versoes || []).length > 1 ? d.versoes.length : undefined },
    { chave: "alertas", rotulo: "Alertas e Vencimentos", icone: "alert-triangle" },
  ];

  const versoes = (
    (d.versoes || []).length <= 1 ? (
      <p className="texto-corrido">
        Esta é a única versão. Ao usar <strong>Substituir documento</strong>, a versão atual fica guardada aqui.
      </p>
    ) : (
      <ol className="linha-tempo linha-tempo--compacta doc-versoes">
        {d.versoes.map((v, i) => {
          const esta = v.id_documento === d.id_documento;
          const n = d.versoes.length - i;
          return (
            <li key={v.id_documento} data-atual={esta ? "sim" : undefined}>
              <span className="linha-tempo__ponto" data-tom={v.substituido_em ? "cinza" : "verde"} />
              <div>
                <strong>
                  {v.substituido_em ? `Versão ${n}` : `Versão atual (${n})`}
                  {esta && <em className="doc-versoes__aqui"> (aberta)</em>}
                </strong>
                <span>
                  {[v.numero_documento && `Nº ${v.numero_documento}`,
                    v.data_validade ? `vence ${data(v.data_validade)}` : "não vence",
                    v.arquivos ? `${v.arquivos} arquivo${v.arquivos > 1 ? "s" : ""}` : null].filter(Boolean).join(" · ")}
                </span>
                {v.substituido_em && <span>Substituída em {data(v.substituido_em)}</span>}
                {!esta && (
                  <button type="button" className="os-ligadas__link"
                          onClick={() => navegar(`/frotas/documentos/${v.id_documento}`)}>Visualizar</button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    )
  );

  const cartaoInformacoes = (
    <Cartao titulo={<><Icone nome="informacao" tamanho={18} /> Informações do Documento</>}>
      <div className="vd-dados">
        <div>
          <Linhas linhas={[
            ["Tipo de documento", d.categoria ? `${d.tipo_documento} (${d.categoria})` : d.tipo_documento],
            ["Número do documento", d.numero_documento],
            ["Órgão emissor", d.orgao_emissor],
            ["Categoria", d.categoria],
            ["Placa", d.placa],
          ]} />
          <p className="ficha-subtitulo" style={{ marginTop: 8 }}>Observações</p>
          <p className="ficha-texto">{d.observacoes || "Nenhuma observação registrada."}</p>
        </div>
        <Linhas linhas={[
          ["Data de emissão", d.data_emissao ? data(d.data_emissao) : null],
          ["Data de validade", d.data_validade ? data(d.data_validade) : "Não vence"],
          ["Situação", antigo ? <Selo key="s" texto="Substituído" tom="cinza" /> : <Selo key="s" valor={d.situacao} />],
          ["Dias para vencimento", !antigo && d.dias_para_vencer != null ? `${d.dias_para_vencer} dias` : null],
          ["Responsável", d.responsavel],
          ["Data de cadastro", d.criado_em ? dataHora(d.criado_em) : null],
        ]} />
      </div>
    </Cartao>
  );

  const cartaoStatus = (
    <Cartao titulo={<><Icone nome="check" tamanho={18} /> Status do Documento</>}>
      <div className="vd-situacao" data-tom={quadro.tom}>
        <span className="vd-situacao__icone"><Icone nome={quadro.icone} tamanho={22} /></span>
        <div>
          <strong>{quadro.titulo}</strong>
          {quadro.texto && <span>{quadro.texto}</span>}
        </div>
      </div>
      <dl className="vd-controle doc-status">
        <div className="vd-controle__linha"><dt><Icone nome="calendar" tamanho={14} /> Data de emissão</dt><dd>{d.data_emissao ? data(d.data_emissao) : "—"}</dd></div>
        <div className="vd-controle__linha"><dt><Icone nome="calendar" tamanho={14} /> Data de validade</dt><dd>{d.data_validade ? data(d.data_validade) : "Não vence"}</dd></div>
        <div className="vd-controle__linha">
          <dt><Icone nome="atrasados" tamanho={14} /> Dias para vencimento</dt>
          <dd>{!antigo && d.dias_para_vencer != null ? <Selo texto={`${d.dias_para_vencer} dias`} tom={quadro.tom} /> : "—"}</dd>
        </div>
        <div className="vd-controle__linha">
          <dt><Icone nome="bell" tamanho={14} /> Alerta de vencimento</dt>
          <dd>{alertaAtivo ? <Selo texto="Ativo" tom="verde" /> : <Selo texto="Desligado" tom="cinza" />}</dd>
        </div>
      </dl>
    </Cartao>
  );

  const cartaoAcoes = (
    <Cartao titulo={<><Icone nome="fisc-bolt" tamanho={18} /> Ações Rápidas</>}>
      <div className="vd-acoes">
        {pode && (
          <>
            <button type="button" className="vd-acoes__item" onClick={() => setFormulario("atualizar")}>
              <Icone nome="historico" tamanho={18} />
              <span className="vd-acoes__rotulo">Substituir documento (renovação)</span>
              <Icone nome="chevron-right" tamanho={14} />
            </button>
            <button type="button" className="vd-acoes__item" onClick={() => setFormulario("editar")}>
              <Icone nome="editar" tamanho={18} />
              <span className="vd-acoes__rotulo">Editar informações</span>
              <Icone nome="chevron-right" tamanho={14} />
            </button>
            <button type="button" className="vd-acoes__item" onClick={() => entrada.current?.click()} disabled={anexos.enviando}>
              <Icone nome="mais" tamanho={18} />
              <span className="vd-acoes__rotulo">{anexos.enviando ? "Enviando..." : "Adicionar arquivo"}</span>
              <Icone nome="chevron-right" tamanho={14} />
            </button>
          </>
        )}
        {ultimo && (
          <button type="button" className="vd-acoes__item" onClick={() => abrirArquivo(ultimo)}>
            <Icone nome="visualizar" tamanho={18} />
            <span className="vd-acoes__rotulo">Visualizar arquivo</span>
            <Icone nome="chevron-right" tamanho={14} />
          </button>
        )}
        <button type="button" className="vd-acoes__item" onClick={() => (ultimo ? imprimirArquivo(ultimo) : window.print())}>
          <Icone nome="imprimir" tamanho={18} />
          <span className="vd-acoes__rotulo">Imprimir documento</span>
          <Icone nome="chevron-right" tamanho={14} />
        </button>
        {ultimo && (
          <button type="button" className="vd-acoes__item" onClick={() => baixarArquivo(ultimo)}>
            <Icone nome="baixar" tamanho={18} />
            <span className="vd-acoes__rotulo">Baixar arquivo</span>
            <Icone nome="chevron-right" tamanho={14} />
          </button>
        )}
      </div>
    </Cartao>
  );
  const lado = <div className="vd-corpo__lado">{cartaoStatus}{cartaoAcoes}</div>;

  const avisoVencimento = !antigo && d.data_validade && (
    <div className="aviso-vencimento" data-tom={quadro.tom === "vermelho" ? "vermelho" : undefined}>
      <Icone nome="alert-triangle" tamanho={22} />
      <div>
        <strong>Próximos Vencimentos</strong>
        <p>
          {d.dias_para_vencer < 0
            ? `Este documento venceu há ${Math.abs(d.dias_para_vencer)} dias.`
            : d.dias_para_vencer === 0 ? "Este documento vence hoje."
              : `Este documento vencerá em ${d.dias_para_vencer} dias.`}
        </p>
        <button type="button" className="botao botao--pequeno aviso-vencimento__botao" onClick={() => setAba("alertas")}>
          <Icone nome="calendar" tamanho={13} /> Ver todos os vencimentos do veículo
        </button>
      </div>
    </div>
  );

  return (
    <div className="ficha">
      <div className="cabecalho-pagina vd-cabecalho">
        <div>
          <Trilha
            itens={[
              { rotulo: "Frotas" },
              { rotulo: "Documentos", para: "/frotas/documentos" },
              { rotulo: "Detalhes do Documento" },
            ]}
          />
          <div className="vd-titulo">
            <span className="vd-titulo__icone"><Icone nome="documento" tamanho={26} /></span>
            <div>
              <h1>Detalhes do Documento</h1>
              <p>Visualize todas as informações do documento, validade, histórico e arquivos anexados.</p>
            </div>
          </div>
        </div>
        <div className="cabecalho-pagina__acoes esconder-impressao">
          <button className="botao" onClick={() => navegar("/frotas/documentos")}>
            <Icone nome="seta-esquerda" tamanho={15} /> Voltar
          </button>
          {pode && (
            <button className="botao" onClick={() => setFormulario("editar")}>
              <Icone nome="editar" tamanho={15} /> Editar
            </button>
          )}
        </div>
      </div>

      {antigo && (
        <div className="doc-aviso doc-aviso--pagina">
          <Icone nome="historico" tamanho={16} />
          <span>
            Esta é uma <strong>versão antiga</strong> do documento, substituída em{" "}
            <strong>{dataHora(d.substituido_em)}</strong>
            {d.substituido_por_nome ? <> por {d.substituido_por_nome}</> : null}. Ela fica só para consulta.
          </span>
          {atual && (
            <button type="button" className="os-ligadas__link"
                    onClick={() => navegar(`/frotas/documentos/${atual.id_documento}`)}>Ver versão atual</button>
          )}
        </div>
      )}

      <FaixaVeiculo v={d} />

      <div className="abas vd-abas esconder-impressao" role="tablist">
        {ABAS.map((a) => (
          <button key={a.chave} type="button" role="tab" className="aba"
                  data-ativa={aba === a.chave} aria-selected={aba === a.chave}
                  onClick={() => setAba(a.chave)}>
            <Icone nome={a.icone} tamanho={16} />
            {a.rotulo}
            {a.total ? <span className="vd-abas__total">{a.total}</span> : null}
          </button>
        ))}
      </div>

      <input ref={entrada} type="file" multiple hidden accept={ACEITAR}
             onChange={(e) => { anexos.enviar(e.target.files); e.target.value = ""; }} />

      {aba === "geral" && (
        <div className="vd-corpo">
          <div className="vd-corpo__principal">
            <section className="cartao doc-arquivo">
              {!ultimo ? (
                <div className="doc-arquivo__sem">
                  <Icone nome="documentos" tamanho={28} />
                  <span>Nenhum arquivo anexado a este documento.</span>
                  {pode && (
                    <button className="botao botao--primario" onClick={() => entrada.current?.click()} disabled={anexos.enviando}>
                      <Icone nome="mais" tamanho={14} monocromatico /> {anexos.enviando ? "Enviando..." : "Anexar arquivo"}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="doc-arquivo__info">
                    <div className="doc-arquivo__tipo" data-tipo={ultimo.tipo === "application/pdf" ? "pdf" : "img"}>
                      <Icone nome="arquivo-texto" tamanho={40} />
                      <span>{ultimo.tipo === "application/pdf" ? "PDF" : ultimo.tipo.replace("image/", "").replace("jpeg", "jpg").toUpperCase()}</span>
                    </div>
                    <div className="doc-arquivo__textos">
                      <span className="doc-arquivo__selo">Documento do Veículo</span>
                      <strong className="doc-arquivo__nome" title={ultimo.nome}>{ultimo.nome}</strong>
                      <span className="doc-arquivo__sub">{d.categoria ? `${d.tipo_documento} (${d.categoria})` : d.tipo_documento}</span>
                      <dl className="doc-arquivo__dados">
                        <div><Icone nome="arquivo-texto" tamanho={16} /><dt>Tamanho</dt><dd>{tamanhoArquivo(ultimo.bytes)}</dd></div>
                        <div><Icone nome="calendar" tamanho={16} /><dt>Adicionado em</dt><dd>{dataHora(ultimo.criado_em)}</dd></div>
                        <div><Icone nome="user" tamanho={16} /><dt>Adicionado por</dt><dd>{vazio(ultimo.enviado_por_nome)}</dd></div>
                      </dl>
                      <div className="doc-arquivo__botoes">
                        <button className="botao" onClick={() => anexos.abrir(ultimo)}>
                          <Icone nome="visualizar" tamanho={15} /> Visualizar
                        </button>
                        <button className="botao botao--primario" onClick={() => anexos.baixar(ultimo)}>
                          <Icone nome="baixar" tamanho={15} monocromatico /> Baixar
                        </button>
                      </div>
                      {arquivos.length > 1 && (
                        <button type="button" className="os-ligadas__link doc-mais-arquivos" onClick={() => setAba("arquivo")}>
                          Ver todos os {arquivos.length} arquivos
                        </button>
                      )}
                    </div>
                  </div>
                  <PreviaArquivo arquivo={ultimo} miniatura={anexos.miniaturas[ultimo.id_arquivo]}
                                 aoAbrir={() => anexos.abrir(ultimo)} />
                </>
              )}
            </section>

            {cartaoInformacoes}

            <Cartao titulo={<><Icone nome="historico" tamanho={18} /> Histórico do Documento</>}
                    acao={<button className="botao botao--pequeno vd-cartao-acao" onClick={() => setAba("historico")}>Ver todo</button>}>
              <HistoricoAuditoria tipo="documento" id={d.id_documento} recarga={recarga + arquivos.length} limite={5}
                inicio={d.criado_em ? { quando: d.criado_em, usuario: null, acao: "Cadastro", descricao: "Documento cadastrado no sistema" } : null} />
            </Cartao>
          </div>

          <div className="vd-corpo__lado">
            {cartaoStatus}

            {cartaoAcoes}

            <Cartao titulo={<><Icone nome="historico" tamanho={18} /> Histórico de Versões</>}>
              {versoes}
              {avisoVencimento && <div className="doc-versoes__aviso">{avisoVencimento}</div>}
            </Cartao>
          </div>
        </div>
      )}

      {/* Abas no desenho do Cesar de 29/10 (DocumentoAbas.jsx), sempre com
          o Status do Documento e as Acoes Rapidas a direita. */}
      {aba === "dados" && (
        <div className="vd-corpo">
          <div className="vd-corpo__principal">
            <AbaDados d={d} antigo={antigo} pode={pode} aoEditar={() => setFormulario("editar")} />
          </div>
          {lado}
        </div>
      )}

      {aba === "arquivo" && (
        <div className="vd-corpo">
          <div className="vd-corpo__principal">
            <AbaArquivo arquivos={anexos.arquivos} pode={pode} enviando={anexos.enviando}
                        aoAdicionar={() => entrada.current?.click()}
                        aoMudar={() => { anexos.recarregar(); recarregar(); }} />
          </div>
          {lado}
        </div>
      )}

      {aba === "historico" && (
        <div className="vd-corpo">
          <div className="vd-corpo__principal">
            <AbaHistorico d={d} recarga={recarga + arquivos.length} />
          </div>
          {lado}
        </div>
      )}

      {aba === "alertas" && (
        <div className="vd-corpo">
          <div className="vd-corpo__principal">
            <AbaAlertas d={d} docs={docsVeiculo} />
          </div>
          {lado}
        </div>
      )}

      {formulario && (
        <FormularioDocumento
          modo={formulario}
          documento={d}
          aoFechar={() => setFormulario(null)}
          aoSalvar={(novoId) => {
            if (formulario === "atualizar" && novoId) navegar(`/frotas/documentos/${novoId}`);
            else recarregar();
          }}
        />
      )}
    </div>
  );
}
