/**
 * SinistroDetalhe.jsx - Detalhes do Sinistro.
 *
 * Desenho do Cesar (06/10), o mais parecido possivel, no padrao das telas de
 * detalhes: faixa do veiculo, abas (Visao geral, Fotos, Documentos,
 * Envolvidos, Veiculo, Providencias, Historico) e cartoes. "Envolvidos" e os
 * "Custos estimados" (orcamento) vem da migracao 035.
 *
 * Fica de fora o que o SITRA nao tem: foto do veiculo e condicoes
 * climaticas. "Ver no mapa" abre o endereco no Google Maps.
 */
import { useEffect, useRef, useState } from "react";
import { useOutletContext, useParams, useNavigate, useSearchParams } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import Selo from "../../components/Selo.jsx";
import RegistrarSinistro, { TIPOS_ENVOLVIDO, SITUACOES_ENVOLVIDO } from "../../components/RegistrarSinistro.jsx";
import ArquivosAnexados from "../../components/ArquivosAnexados.jsx";
import ResumoVeiculo from "../../components/ResumoVeiculo.jsx";
import HistoricoAuditoria from "../../components/HistoricoAuditoria.jsx";
import { useArquivos } from "../../components/useArquivos.js";
import { api } from "../../lib/api.js";
import { data, dataHora, dinheiro, hora, numero, rotulo } from "../../lib/formato.js";
import { tamanhoArquivo } from "../../lib/arquivos.js";
import { useSessao } from "../../lib/sessao.jsx";
import { TOM_TIPO_SINISTRO } from "./Sinistros.jsx";

const vazio = (v) => (v === null || v === undefined || v === "" ? "—" : v);
const ORDEM = { ABERTO: 0, EM_ANALISE: 1, RESOLVIDO: 2, ENCERRADO: 3 };
const nomeTipo = (t) => TIPOS_ENVOLVIDO.find((x) => x.valor === t)?.rotulo || t;
function SeloSituacao({ valor }) {
  const s = SITUACOES_ENVOLVIDO.find((x) => x.valor === valor);
  return s ? <Selo texto={s.rotulo} tom={s.tom} /> : <span>—</span>;
}

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

/** Tabela de envolvidos: o condutor da frota primeiro, depois os demais. */
function TabelaEnvolvidos({ s }) {
  const linhas = [
    { envolvido: "Condutor (veículo SITRA)", pessoa: s.condutor, extra: s.condutor_matricula ? `Matrícula ${s.condutor_matricula}` : null,
      situacao: s.situacao_condutor, contato: s.condutor_telefone },
    ...(s.envolvidos || []).map((e) => ({
      envolvido: nomeTipo(e.tipo),
      pessoa: e.tipo === "OUTRO_VEICULO" && (e.placa || e.modelo) ? [e.placa, e.modelo].filter(Boolean).join(" · ") : e.nome,
      extra: e.tipo === "OUTRO_VEICULO" && (e.placa || e.modelo) ? e.nome : null,
      situacao: e.situacao, contato: e.contato,
    })),
  ];
  return (
    <div className="rolagem-x">
      <table className="tabela vd-tabela tabela-ficha tabela-envolvidos">
        <thead><tr><th>Envolvido</th><th>Pessoa / Veículo</th><th>Situação</th><th>Contato</th></tr></thead>
        <tbody>
          {linhas.map((l, n) => (
            <tr key={n}>
              <td>{l.envolvido}</td>
              <td>
                <span className="celula-dupla">
                  <strong>{vazio(l.pessoa)}</strong>
                  {l.extra && <span>{l.extra}</span>}
                </span>
              </td>
              <td><SeloSituacao valor={l.situacao} /></td>
              <td>{vazio(l.contato)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SinistroDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const { podeVer } = useSessao();
  const [sinistro, setSinistro] = useState(null);
  const [erro, setErro] = useState("");
  const [recarga, setRecarga] = useState(0);
  const [editando, setEditando] = useState(false);
  const [parametros, definirParametros] = useSearchParams();
  const aba = parametros.get("aba") || "geral";
  const setAba = (chave) => {
    const p = new URLSearchParams(parametros);
    if (chave === "geral") p.delete("aba"); else p.set("aba", chave);
    definirParametros(p, { replace: true });
  };
  const entradaFoto = useRef(null);
  const entradaDoc = useRef(null);
  const anexos = useArquivos(`/frotas/sinistros/${id}/arquivos`, "/frotas/sinistros/arquivos", recarga);

  useEffect(() => {
    definirCabecalho({ titulo: "", legenda: "" });
  }, [definirCabecalho]);

  useEffect(() => {
    api(`/frotas/sinistros/${id}`).then(setSinistro).catch((e) => setErro(e.message));
  }, [id, recarga]);

  if (erro) return <Cartao><div className="vazio">{erro}</div></Cartao>;
  if (!sinistro) return <div className="carregando">Carregando o sinistro...</div>;

  const s = sinistro;
  const podeGerenciar = podeVer("FROTAS_GERENCIAR_SINISTROS");
  const fotos = (anexos.arquivos || []).filter((a) => a.tipo.startsWith("image/"));
  const docs = (anexos.arquivos || []).filter((a) => !a.tipo.startsWith("image/"));
  const recarregar = () => setRecarga((n) => n + 1);
  const enviarDe = (e) => { anexos.enviar(e.target.files); e.target.value = ""; };
  const envolvidosTotal = 1 + (s.envolvidos || []).length;

  const ordem = ORDEM[s.status] ?? 0;
  const etapa = (n) => (n < ordem || s.status === "ENCERRADO" ? "feito" : n === ordem ? "atual" : "pendente");
  const etapas = [
    { titulo: "Registro do sinistro", quando: `${data(s.data)} ${hora(s.hora)}`, quem: s.responsavel ? `por ${s.responsavel}` : null, estado: ordem === 0 ? "atual" : "feito" },
    { titulo: "Em análise", estado: etapa(1) },
    { titulo: "Resolvido", quando: s.id_os ? "Com OS de manutenção vinculada" : null, estado: etapa(2) },
    { titulo: "Sinistro encerrado", estado: etapa(3) },
  ];

  const orcamento = ["orcamento_pecas", "orcamento_mao_obra", "orcamento_outros"].map((k) => s[k]);
  const temOrcamento = orcamento.some((v) => v != null) || s.orcamento_oficina;
  const totalOrcamento = orcamento.reduce((t, v) => t + (Number(v) || 0), 0);

  const ABAS = [
    { chave: "geral", rotulo: "Visão Geral", icone: "sinistro" },
    { chave: "fotos", rotulo: "Fotos", icone: "visualizar", total: fotos.length || undefined },
    { chave: "documentos", rotulo: "Documentos", icone: "documentos", total: docs.length || undefined },
    { chave: "envolvidos", rotulo: "Envolvidos", icone: "usuarios", total: envolvidosTotal },
    { chave: "veiculo", rotulo: "Veículo", icone: "kpi-car" },
    { chave: "providencias", rotulo: "Providências", icone: "alert-triangle" },
    { chave: "historico", rotulo: "Histórico", icone: "historico" },
  ];
  const inicioHistorico = { quando: `${String(s.data).slice(0, 10)}T${s.hora || "00:00"}`, usuario: s.responsavel,
    acao: "Registro", descricao: "Sinistro registrado no sistema" };
  const mapa = s.local ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.local)}` : null;

  const cartaoDocumentos = (
    <Cartao
      titulo={<><Icone nome="documentos" tamanho={18} /> Documentos</>}
      acao={podeGerenciar && (
        <button className="botao botao--pequeno vd-cartao-acao" onClick={() => entradaDoc.current?.click()}
                disabled={anexos.enviando}>
          <Icone nome="mais" tamanho={13} /> Adicionar
        </button>
      )}
    >
      {docs.length === 0 ? (
        <p className="texto-corrido">Nenhum documento anexado (B.O., orçamento, laudo...).</p>
      ) : (
        <ul className="lista-arquivos">
          {docs.map((d) => (
            <li key={d.id_arquivo}>
              <Icone nome="documento" tamanho={20} />
              <div className="lista-arquivos__info">
                <strong title={d.nome}>{d.nome}</strong>
                <span>PDF · {tamanhoArquivo(d.bytes)}</span>
              </div>
              <div className="lista-arquivos__botoes">
                <button type="button" className="botao botao--pequeno botao--icone" title="Abrir"
                        aria-label={`Abrir ${d.nome}`} onClick={() => anexos.abrir(d)}>
                  <Icone nome="visualizar" tamanho={13} />
                </button>
                <button type="button" className="botao botao--pequeno botao--icone" title="Baixar"
                        aria-label={`Baixar ${d.nome}`} onClick={() => anexos.baixar(d)}>
                  <Icone nome="baixar" tamanho={13} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );

  return (
    <div className="ficha">
      <div className="cabecalho-pagina vd-cabecalho">
        <div>
          <Trilha
            itens={[
              { rotulo: "Frotas" },
              { rotulo: "Sinistros", para: "/frotas/sinistros" },
              { rotulo: "Detalhes do Sinistro" },
            ]}
          />
          <div className="vd-titulo">
            <span className="vd-titulo__icone"><Icone nome="alert-triangle" tamanho={26} /></span>
            <div>
              <h1>Detalhes do Sinistro</h1>
              <p>Visualize todas as informações do sinistro, incluindo envolvidos, documentação, fotos e histórico.</p>
            </div>
          </div>
        </div>
        <div className="cabecalho-pagina__acoes esconder-impressao">
          <button className="botao" onClick={() => navegar("/frotas/sinistros")}>
            <Icone nome="seta-esquerda" tamanho={15} /> Voltar
          </button>
          <button className="botao" onClick={() => window.print()}>
            <Icone nome="baixar" tamanho={15} /> Imprimir
          </button>
          {podeGerenciar && (
            <button className="botao" onClick={() => setEditando(true)}>
              <Icone nome="editar" tamanho={15} /> Editar
            </button>
          )}
        </div>
      </div>

      <section className="vd-resumo">
        <ResumoVeiculo v={s} />
        <div className="vd-resumo__grade vd-resumo__grade--5">
          <div className="vd-resumo__coluna"><Item rotulo="Setor">{vazio(s.setor)}</Item></div>
          <div className="vd-resumo__coluna">
            <Item rotulo="Motorista">{vazio(s.condutor)}</Item>
            {s.condutor_matricula && <span className="vd-resumo__apoio">Matrícula: {s.condutor_matricula}</span>}
          </div>
          <div className="vd-resumo__coluna">
            <Item rotulo="Data do sinistro">{data(s.data)}</Item>
            <span className="vd-resumo__apoio">{hora(s.hora)}</span>
          </div>
          <div className="vd-resumo__coluna">
            <Item rotulo="Tipo"><Selo texto={rotulo("tipoSinistro", s.tipo)} tom={TOM_TIPO_SINISTRO[s.tipo]} /></Item>
          </div>
          <div className="vd-resumo__coluna"><Item rotulo="Status"><Selo valor={s.status} /></Item></div>
        </div>
      </section>

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

      <input ref={entradaFoto} type="file" multiple hidden accept=".jpg,.jpeg,.png,image/jpeg,image/png" onChange={enviarDe} />
      <input ref={entradaDoc} type="file" multiple hidden accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={enviarDe} />

      {aba === "geral" && (
        <>
          <div className="ficha-3 ficha-bloco">
            <Cartao titulo={<><Icone nome="informacao" tamanho={18} /> Informações do Sinistro</>}>
              <dl className="vd-dados__coluna">
                <div className="vd-dados__linha"><dt>Número do sinistro</dt><dd>{vazio(s.numero)}</dd></div>
                <div className="vd-dados__linha"><dt>Data e hora</dt><dd>{`${data(s.data)} ${hora(s.hora)}`}</dd></div>
                <div className="vd-dados__linha">
                  <dt>Local</dt>
                  <dd className="campo-com-acao">
                    <span>{vazio(s.local)}</span>
                    {mapa && (
                      <a className="mapa-link esconder-impressao" href={mapa} target="_blank" rel="noreferrer">
                        <Icone nome="seta-direita" tamanho={12} /> Ver no mapa
                      </a>
                    )}
                  </dd>
                </div>
                <div className="vd-dados__linha"><dt>Tipo de sinistro</dt><dd>{rotulo("tipoSinistro", s.tipo)}</dd></div>
                <div className="vd-dados__linha"><dt>Natureza</dt><dd>{s.houve_terceiros ? "Com terceiros" : "Sem terceiros"}</dd></div>
                <div className="vd-dados__linha"><dt>Registro policial (B.O.)</dt><dd>{s.bo ? `Sim · nº ${s.bo}` : "Não"}</dd></div>
                <div className="vd-dados__linha"><dt>Parte danificada</dt><dd>{s.parte_danificada ? rotulo("parteSinistro", s.parte_danificada) : "—"}</dd></div>
                <div className="vd-dados__linha"><dt>Gravidade dos danos</dt><dd>{s.gravidade_danos ? rotulo("gravidadeDanos", s.gravidade_danos) : "—"}</dd></div>
                <div className="vd-dados__linha"><dt>Descrição</dt><dd><span className="ficha-texto ficha-texto--celula">{s.descricao || "Sem descrição."}</span></dd></div>
              </dl>
            </Cartao>

            <Cartao
              titulo={<><Icone nome="visualizar" tamanho={18} /> Fotos do Sinistro</>}
              acao={fotos.length > 0 && (
                <button className="botao botao--pequeno vd-cartao-acao" onClick={() => setAba("fotos")}>
                  Ver todas ({fotos.length}) <Icone nome="chevron-right" tamanho={12} />
                </button>
              )}
            >
              {fotos.length === 0 ? (
                podeGerenciar ? (
                  <button type="button" className="galeria__mais galeria__mais--vazia"
                          onClick={() => entradaFoto.current?.click()} disabled={anexos.enviando}>
                    <Icone nome="mais" tamanho={18} />
                    {anexos.enviando ? "Enviando..." : "Adicionar fotos"}
                  </button>
                ) : <p className="texto-corrido">Nenhuma foto anexada.</p>
              ) : (
                <div className="galeria">
                  <button type="button" className="galeria__principal" onClick={() => anexos.abrir(fotos[0])} title={fotos[0].nome}>
                    {anexos.miniaturas[fotos[0].id_arquivo] && <img src={anexos.miniaturas[fotos[0].id_arquivo]} alt={fotos[0].nome} />}
                  </button>
                  <div className="galeria__lado">
                    {fotos.slice(1, podeGerenciar ? 3 : 4).map((f, n, lista) => (
                      <button type="button" key={f.id_arquivo} className="galeria__mini" onClick={() => anexos.abrir(f)} title={f.nome}>
                        {anexos.miniaturas[f.id_arquivo] && <img src={anexos.miniaturas[f.id_arquivo]} alt={f.nome} />}
                        {n === lista.length - 1 && fotos.length > lista.length + 1 && (
                          <span className="galeria__resto">+{fotos.length - lista.length - 1}</span>
                        )}
                      </button>
                    ))}
                    {podeGerenciar && (
                      <button type="button" className="galeria__mais" onClick={() => entradaFoto.current?.click()} disabled={anexos.enviando}>
                        <Icone nome="mais" tamanho={16} />
                        {anexos.enviando ? "Enviando..." : "Adicionar fotos"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </Cartao>

            <Cartao titulo={<><Icone nome="check" tamanho={18} /> Status e Providências</>}>
              <ol className="etapas">
                {etapas.map((e) => (
                  <li key={e.titulo} data-estado={e.estado}>
                    <span className="etapas__ponto">{e.estado === "feito" ? "✓" : ""}</span>
                    <div className="etapas__texto">
                      <strong>{e.titulo}</strong>
                      {e.quando && <span>{e.quando}</span>}
                      {e.quem && <span>{e.quem}</span>}
                    </div>
                  </li>
                ))}
              </ol>
            </Cartao>
          </div>

          <div className="ficha-3b ficha-bloco">
            <Cartao
              titulo={<><Icone nome="usuarios" tamanho={18} /> Envolvidos</>}
              acao={<button className="botao botao--pequeno vd-cartao-acao" onClick={() => setAba("envolvidos")}>Ver todos</button>}
            >
              <TabelaEnvolvidos s={s} />
            </Cartao>

            {cartaoDocumentos}

            <Cartao titulo={<><Icone nome="chart-line" tamanho={18} /> Custos Estimados</>}>
              {!temOrcamento ? (
                <p className="texto-corrido">Nenhum orçamento informado. Use Editar para incluir.</p>
              ) : (
                <>
                  <dl className="custos">
                    <div className="custos__linha"><dt>Orçamento da oficina</dt><dd>{vazio(s.orcamento_oficina)}</dd></div>
                    <div className="custos__linha"><dt>Peças</dt><dd>{s.orcamento_pecas != null ? dinheiro(s.orcamento_pecas) : "—"}</dd></div>
                    <div className="custos__linha"><dt>Mão de obra</dt><dd>{s.orcamento_mao_obra != null ? dinheiro(s.orcamento_mao_obra) : "—"}</dd></div>
                    <div className="custos__linha"><dt>Outros custos</dt><dd>{s.orcamento_outros != null ? dinheiro(s.orcamento_outros) : "—"}</dd></div>
                  </dl>
                  <div className="custos__total"><span>Total estimado</span><strong>{dinheiro(totalOrcamento)}</strong></div>
                </>
              )}
            </Cartao>
          </div>

          <Cartao titulo={<><Icone nome="historico" tamanho={18} /> Histórico do Sinistro</>}
                  acao={<button className="botao botao--pequeno vd-cartao-acao" onClick={() => setAba("historico")}>Ver todo</button>}>
            <HistoricoAuditoria tipo="sinistro" id={s.id_sinistro} recarga={recarga + (anexos.arquivos?.length || 0)} limite={5}
                                inicio={inicioHistorico} />
          </Cartao>
        </>
      )}

      {aba === "fotos" && (
        <Cartao titulo={<><Icone nome="visualizar" tamanho={18} /> Fotos do sinistro</>}>
          <ArquivosAnexados key={`f-${recarga}-${anexos.arquivos?.length}`}
            caminhoLista={`/frotas/sinistros/${s.id_sinistro}/arquivos`} caminhoArquivo="/frotas/sinistros/arquivos"
            podeGerenciar={podeGerenciar} filtro="imagem" aceitar=".jpg,.jpeg,.png,image/jpeg,image/png"
            rotuloAdicionar="Adicionar fotos" vazio="Nenhuma foto anexada." aoMudar={anexos.recarregar} />
        </Cartao>
      )}

      {aba === "documentos" && (
        <Cartao titulo={<><Icone nome="documentos" tamanho={18} /> Documentos do sinistro</>}>
          <ArquivosAnexados key={`d-${recarga}-${anexos.arquivos?.length}`}
            caminhoLista={`/frotas/sinistros/${s.id_sinistro}/arquivos`} caminhoArquivo="/frotas/sinistros/arquivos"
            podeGerenciar={podeGerenciar} filtro="pdf" rotuloAdicionar="Adicionar documento"
            vazio="Nenhum documento anexado." aoMudar={anexos.recarregar} />
        </Cartao>
      )}

      {aba === "envolvidos" && (
        <Cartao titulo={<><Icone nome="usuarios" tamanho={18} /> Envolvidos no sinistro</>}
                acao={podeGerenciar && <button className="botao botao--pequeno vd-cartao-acao" onClick={() => setEditando(true)}><Icone nome="editar" tamanho={13} /> Editar envolvidos</button>}>
          <TabelaEnvolvidos s={s} />
          {(s.envolvidos || []).some((e) => e.observacao) && (
            <ul className="lista-arquivos" style={{ marginTop: 12 }}>
              {s.envolvidos.filter((e) => e.observacao).map((e, n) => (
                <li key={n}><div className="lista-arquivos__info"><strong>{e.nome || e.placa}</strong><span>{e.observacao}</span></div></li>
              ))}
            </ul>
          )}
        </Cartao>
      )}

      {aba === "veiculo" && (
        <Cartao titulo={<><Icone nome="kpi-car" tamanho={18} /> Veículo envolvido</>}
                acao={<button className="botao botao--pequeno vd-cartao-acao" onClick={() => navegar(`/frotas/veiculos/${s.id_veiculo}`)}>Ver detalhes do veículo</button>}>
          <div className="vd-dados">
            <Linhas linhas={[
              ["Placa", s.placa], ["Marca", s.marca], ["Modelo", s.modelo],
              ["Ano/Modelo", s.ano_fabricacao ? `${s.ano_fabricacao} / ${s.ano_modelo}` : null],
            ]} />
            <Linhas linhas={[
              ["Tipo", s.tipo_veiculo ? rotulo("tipoVeiculo", s.tipo_veiculo) : null],
              ["Combustível", s.tipo_combustivel ? rotulo("combustivel", s.tipo_combustivel) : null],
              ["Setor", s.setor], ["Quilometragem atual", s.quilometragem_atual != null ? `${numero(s.quilometragem_atual)} km` : null],
            ]} />
          </div>
        </Cartao>
      )}

      {aba === "providencias" && (
        <div className="ficha-2 ficha-bloco">
          <Cartao titulo={<><Icone nome="alert-triangle" tamanho={18} /> Providências tomadas</>}>
            <p className="ficha-texto">{s.providencias || "Nenhuma providência registrada."}</p>
            <p className="ficha-subtitulo" style={{ marginTop: 12 }}>OS de manutenção</p>
            {s.id_os ? (
              <button type="button" className="os-ligadas__link" onClick={() => navegar(`/frotas/manutencoes/${s.id_os}`)}>Ver OS vinculada</button>
            ) : <p className="texto-corrido">Nenhuma OS vinculada.</p>}
          </Cartao>
          <Cartao titulo={<><Icone nome="documento" tamanho={18} /> Danos e observações</>}>
            <p className="ficha-subtitulo">Descrição dos danos</p>
            <p className="ficha-texto">{s.descricao_danos || "Nenhuma descrição dos danos."}</p>
            <p className="ficha-subtitulo">Observações</p>
            <p className="ficha-texto">{s.observacoes || "Nenhuma observação registrada."}</p>
          </Cartao>
        </div>
      )}

      {aba === "historico" && (
        <Cartao titulo={<><Icone nome="historico" tamanho={18} /> Histórico do sinistro</>}>
          <HistoricoAuditoria tipo="sinistro" id={s.id_sinistro} recarga={recarga + (anexos.arquivos?.length || 0)} inicio={inicioHistorico} />
        </Cartao>
      )}

      {editando && (
        <RegistrarSinistro sinistro={s} aoFechar={() => setEditando(false)} aoSalvar={recarregar} />
      )}
    </div>
  );
}
