/**
 * DocumentoDetalhe.jsx - Visualizar um documento: o que foi preenchido, os
 * arquivos anexados e o historico de versoes.
 *
 * Mesmo desenho das fichas do checklist, da OS e do sinistro: faixa de
 * identificacao no topo, os dados a esquerda, arquivos e historico a direita.
 *
 * VERSOES: "Atualizar" (renovacao) cria um documento novo ligado ao anterior;
 * o anterior nao e apagado. Toda versao abre nesta mesma tela - a antiga com
 * um aviso no topo e sem os botoes de alterar (historico nao se edita).
 */
import { useEffect, useRef, useState } from "react";
import { useOutletContext, useParams, useNavigate } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import Selo from "../../components/Selo.jsx";
import FormularioDocumento, {
  conferirArquivo, enviarArquivoDocumento, tamanhoArquivo,
} from "../../components/FormularioDocumento.jsx";
import { useConfirmacaoSenha } from "../../components/ConfirmarSenha.jsx";
import { api, apiArquivo } from "../../lib/api.js";
import { data, dataHora } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";

function Campo({ icone, rotulo: texto, children }) {
  return (
    <div className="checklist-faixa__campo">
      <span className="checklist-faixa__rotulo">
        <Icone nome={icone} tamanho={14} />
        {texto}
      </span>
      <div className="checklist-faixa__valor">{children}</div>
    </div>
  );
}

function Dados({ linhas }) {
  return (
    <dl className="lista-dados">
      {linhas.map(([r, v]) => (
        <div className="lista-dados__linha" key={r}>
          <dt>{r}</dt>
          <dd>{v === null || v === undefined || v === "" ? "—" : v}</dd>
        </div>
      ))}
    </dl>
  );
}

function prazo(dias) {
  if (dias === null || dias === undefined) return null;
  if (dias < 0) return { texto: `Vencido há ${Math.abs(dias)} dias`, tom: "vermelho" };
  if (dias === 0) return { texto: "Vence hoje", tom: "vermelho" };
  if (dias <= 30) return { texto: `Vence em ${dias} dias`, tom: "laranja" };
  return { texto: `Vence em ${dias} dias`, tom: "verde" };
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
  const [enviando, setEnviando] = useState(false);
  const [abrindo, setAbrindo] = useState(null);
  const entradaArquivo = useRef(null);
  const { pedirExclusao, elemento: modalSenha } = useConfirmacaoSenha();

  useEffect(() => {
    definirCabecalho({ titulo: "", legenda: "" });
  }, [definirCabecalho]);

  useEffect(() => {
    setErro("");
    api(`/frotas/documentos/${id}/ficha`).then(setDoc).catch((e) => setErro(e.message));
  }, [id, recarga]);

  if (erro && !doc) return <Cartao><div className="vazio">{erro}</div></Cartao>;
  if (!doc) return <div className="carregando">Carregando o documento...</div>;

  const d = doc;
  const podeGerenciar = podeVer("FROTAS_GERENCIAR_DOCUMENTOS");
  const antigo = !!d.substituido_em;
  const atual = (d.versoes || []).find((v) => !v.substituido_em);
  const p = antigo ? null : prazo(d.dias_para_vencer);
  const recarregar = () => setRecarga((n) => n + 1);

  /*
   * Abre o arquivo numa aba nova. A aba e aberta JA no clique (antes do
   * download): aberta depois de um await, o navegador a trata como pop-up
   * nao pedido e bloqueia.
   */
  async function abrir(a) {
    const janela = window.open("", "_blank");
    setAbrindo(a.id_arquivo);
    try {
      const url = await apiArquivo(`/frotas/documentos/arquivos/${a.id_arquivo}`);
      if (janela) {
        janela.location.href = url;
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = a.nome;
        link.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
    } catch (e) {
      janela?.close();
      alert(e.message);
    } finally {
      setAbrindo(null);
    }
  }

  async function remover(a) {
    const resposta = await pedirExclusao({
      titulo: "Remover arquivo",
      oQue: `o arquivo ${a.nome}`,
    });
    if (!resposta.ok) return;
    try {
      await api(`/frotas/documentos/arquivos/${a.id_arquivo}`, {
        method: "DELETE", body: { justificativa: resposta.justificativa },
      });
      recarregar();
    } catch (e) {
      alert(e.message);
    }
  }

  async function anexar(e) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    const problema = conferirArquivo(arquivo);
    if (problema) {
      alert(problema);
      return;
    }
    setEnviando(true);
    try {
      await enviarArquivoDocumento(d.id_documento, arquivo);
      recarregar();
    } catch (err) {
      alert(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <Trilha
            itens={[
              { rotulo: "Frotas" },
              { rotulo: "Documentos", para: "/frotas/documentos" },
              { rotulo: "Detalhes do documento" },
            ]}
          />
          <h1>Detalhes do documento</h1>
          <p>Consulte o que foi preenchido, os arquivos anexados e as versões anteriores.</p>
        </div>
        <div className="cabecalho-pagina__acoes">
          <button className="botao" onClick={() => navegar("/frotas/documentos")}>
            <Icone nome="seta-esquerda" tamanho={15} /> Voltar
          </button>
          {podeGerenciar && !antigo && (
            <>
              <button className="botao" onClick={() => setFormulario("atualizar")}>
                <Icone nome="historico" tamanho={15} /> Atualizar
              </button>
              <button className="botao" onClick={() => setFormulario("editar")}>
                <Icone nome="editar" tamanho={15} /> Editar
              </button>
            </>
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
                    onClick={() => navegar(`/frotas/documentos/${atual.id_documento}`)}>
              Ver versão atual
            </button>
          )}
        </div>
      )}

      <div className="checklist-faixa">
        <Campo icone="kpi-car" rotulo="Veículo">
          <button type="button" className="checklist-faixa__destaque os-ligadas__link"
                  onClick={() => navegar(`/frotas/veiculos/${d.id_veiculo}`)}>
            {d.placa}
          </button>
          <span className="checklist-faixa__apoio">{d.marca} {d.modelo}</span>
        </Campo>
        <Campo icone="documento" rotulo="Documento">
          <strong>{d.tipo_documento}</strong>
          {d.categoria && <span className="checklist-faixa__apoio">{d.categoria}</span>}
        </Campo>
        <Campo icone="documentacao" rotulo="Nº / Referência">
          <strong>{d.numero_documento || "—"}</strong>
        </Campo>
        <Campo icone="calendar" rotulo="Vencimento">
          <strong>{d.data_validade ? data(d.data_validade) : "Não vence"}</strong>
          {p && <span className={`prazo prazo--${p.tom}`}>{p.texto}</span>}
        </Campo>
        <Campo icone="check" rotulo="Situação">
          {antigo ? <Selo texto="Substituído" tom="cinza" /> : <Selo valor={d.situacao} />}
        </Campo>
      </div>

      <div className="checklist-corpo">
        <div className="checklist-corpo__coluna">
          <Cartao titulo="Dados do documento">
            <Dados
              linhas={[
                ["Tipo de documento", d.tipo_documento],
                ["Categoria", d.categoria],
                ["Nº / Referência", d.numero_documento],
                ["Órgão emissor", d.orgao_emissor],
                ["Data de emissão", d.data_emissao ? data(d.data_emissao) : null],
                ["Data de vencimento", d.data_validade ? data(d.data_validade) : "Não vence"],
                ["Responsável", d.responsavel],
                ["Cadastrado em", d.criado_em ? dataHora(d.criado_em) : null],
              ]}
            />
          </Cartao>
          <Cartao titulo="Observações">
            <p className="texto-corrido texto-quebra">{d.observacoes || "Nenhuma observação registrada."}</p>
          </Cartao>
        </div>

        <div className="checklist-corpo__coluna checklist-corpo__coluna--lado">
          <Cartao
            titulo="Arquivos anexados"
            acao={
              podeGerenciar && !antigo ? (
                <span className="doc-arquivos__acao">
                  <input ref={entradaArquivo} type="file" hidden
                         accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                         onChange={anexar} />
                  <button type="button" className="botao botao--pequeno" disabled={enviando}
                          onClick={() => entradaArquivo.current?.click()}>
                    <Icone nome="mais" tamanho={13} /> {enviando ? "Enviando..." : "Adicionar"}
                  </button>
                </span>
              ) : null
            }
          >
            {d.arquivos.length === 0 ? (
              <p className="texto-corrido">Nenhum arquivo anexado.</p>
            ) : (
              <ul className="doc-arquivos">
                {d.arquivos.map((a) => (
                  <li key={a.id_arquivo}>
                    <Icone nome="documento" tamanho={18} />
                    <div className="doc-arquivos__info">
                      <strong title={a.nome}>{a.nome}</strong>
                      <span>
                        {[tamanhoArquivo(a.bytes), dataHora(a.criado_em), a.enviado_por_nome]
                          .filter(Boolean).join(" · ")}
                      </span>
                    </div>
                    <div className="doc-arquivos__botoes">
                      <button type="button" className="botao botao--pequeno"
                              disabled={abrindo === a.id_arquivo} onClick={() => abrir(a)}>
                        <Icone nome="visualizar" tamanho={13} /> {abrindo === a.id_arquivo ? "Abrindo..." : "Abrir"}
                      </button>
                      {podeGerenciar && !antigo && (
                        <button type="button" className="botao botao--pequeno botao--icone"
                                title="Remover arquivo" aria-label="Remover arquivo"
                                onClick={() => remover(a)}>
                          <Icone nome="lixo" tamanho={13} />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          <Cartao titulo="Histórico de versões">
            {(d.versoes || []).length <= 1 ? (
              <p className="texto-corrido">
                Esta é a única versão. Ao usar <strong>Atualizar</strong>, a versão atual fica guardada aqui.
              </p>
            ) : (
              <ol className="linha-tempo linha-tempo--compacta doc-versoes">
                {d.versoes.map((v, i) => {
                  const esta = v.id_documento === d.id_documento;
                  // A lista vem da mais nova para a mais antiga: a mais antiga e a 1.
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
                          {[
                            v.numero_documento && `Nº ${v.numero_documento}`,
                            v.data_validade ? `vence ${data(v.data_validade)}` : "não vence",
                            v.arquivos ? `${v.arquivos} arquivo${v.arquivos > 1 ? "s" : ""}` : null,
                          ].filter(Boolean).join(" · ")}
                        </span>
                        {v.substituido_em && <span>Substituída em {data(v.substituido_em)}</span>}
                        {!esta && (
                          <button type="button" className="os-ligadas__link"
                                  onClick={() => navegar(`/frotas/documentos/${v.id_documento}`)}>
                            Visualizar
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Cartao>
        </div>
      </div>

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
      {modalSenha}
    </>
  );
}
