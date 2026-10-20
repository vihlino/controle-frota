/**
 * ManutencaoDetalhe.jsx - Detalhes da OS.
 *
 * Desenho do Cesar (06/10), o mais parecido possivel: faixa do veiculo;
 * Informacoes da OS, Descricao do problema, Status da OS (etapas); Servicos
 * realizados, Pecas utilizadas, Custos da OS; Historico (da auditoria) e
 * Observacoes.
 *
 * Fica de fora o que o SITRA nao tem: foto do veiculo, fotos do problema,
 * codigo e valor por peca, mao de obra separada, Exportar PDF. As pecas sao
 * as linhas do texto "pecas necessarias" (registro) e "pecas trocadas"
 * (fechamento). Editar abre o pop-up do Registro; Fechar OS, o do fechamento.
 */
import { useEffect, useState } from "react";
import { useLocation, useOutletContext, useParams, useNavigate } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import Selo from "../../components/Selo.jsx";
import RegistrarOs from "../../components/RegistrarOs.jsx";
import FecharOs from "../../components/FecharOs.jsx";
import ResumoVeiculo from "../../components/ResumoVeiculo.jsx";
import HistoricoAuditoria from "../../components/HistoricoAuditoria.jsx";
import { api } from "../../lib/api.js";
import { data, dataHora, dinheiro, numero, numeroOs, rotulo } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";

const ORIGEM = {
  FROTAS: { texto: "Registro da gestão" },
  INSPECAO: { texto: "Inspeção", link: (id) => `/frotas/inspecoes/${id}` },
  CHECKLIST_FROTAS: { texto: "Checklist (QR Code)", link: (id) => `/frotas/checklists/${id}` },
  CHECKLIST_FISCALIZACAO: { texto: "Checklist da fiscalização" },
  FISCALIZACAO: { texto: "Fiscalização" },
  SINISTRO: { texto: "Sinistro", link: (id) => `/frotas/sinistros/${id}` },
};
const TOM_PRIORIDADE = { BAIXA: "verde", MEDIA: "amarelo", ALTA: "vermelho" };
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

/** As etapas da OS, na ordem em que acontecem. */
function etapasDaOs(os) {
  const ordem = { PENDENTE: 0, EM_ANALISE: 1, EM_MANUTENCAO: 2, RESOLVIDA: 4 }[os.status] ?? 1;
  const estado = (n) => (os.status === "RESOLVIDA" || n < ordem ? "feito" : n === ordem ? "atual" : "pendente");
  const lista = [
    { titulo: os.origem === "FISCALIZACAO" ? "OS solicitada pela Fiscalização" : "OS registrada", quando: dataHora(os.data_abertura), estado: "feito" },
    // Solicitacao da Fiscalizacao (18/10): espera o Frotas completar.
    ...(os.origem === "FISCALIZACAO" ? [{ titulo: "Completada pelo Frotas", quando: os.status === "PENDENTE" ? "Aguardando oficina, responsável e custo" : null, estado: os.status === "PENDENTE" ? "atual" : "feito" }] : []),
    { titulo: "Em análise", estado: estado(1) },
    { titulo: "Em manutenção na oficina", quando: os.data_agendada ? `Agendada para ${data(os.data_agendada)}` : null, estado: estado(2) },
    { titulo: "Serviço finalizado", quando: os.data_conclusao ? data(os.data_conclusao) : null, estado: estado(3) },
    { titulo: "OS fechada", quando: os.data_fechamento ? `${data(os.data_fechamento)}${os.fechada_por_nome ? ` por ${os.fechada_por_nome}` : ""}` : null, estado: estado(4) },
  ];
  if (os.status === "CANCELADA") {
    return [lista[0], { titulo: "OS cancelada", estado: "cancelado" }];
  }
  return lista;
}

/** Linhas de um texto livre de pecas ("Pastilha\nDisco" ou "Pastilha; Disco"). */
const linhasDe = (texto) => String(texto || "").split(/\r?\n|;/).map((x) => x.replace(/^[-•*\d.)\s]+/, "").trim()).filter(Boolean);
const iniciais = (nome) => String(nome || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

export default function ManutencaoDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const { podeVer } = useSessao();
  const { pathname } = useLocation();
  const [os, setOs] = useState(null);
  const [erro, setErro] = useState("");
  const [recarga, setRecarga] = useState(0);
  const [editando, setEditando] = useState(false);
  const [fechando, setFechando] = useState(false);

  useEffect(() => {
    definirCabecalho({ titulo: "", legenda: "" });
  }, [definirCabecalho]);

  useEffect(() => {
    api(`/frotas/manutencoes/${id}`).then(setOs).catch((e) => setErro(e.message));
  }, [id, recarga]);

  const recarregar = () => setRecarga((n) => n + 1);

  if (erro) return <Cartao><div className="vazio">{erro}</div></Cartao>;
  if (!os) return <div className="carregando">Carregando a OS...</div>;

  // Na Fiscalizacao (09/10): volta para a lista de la e gerencia com a
  // permissao das viaturas. (O useLocation fica no alto, junto dos outros
  // hooks: abaixo dos "return" de carregando ele mudava a ordem dos hooks.)
  const fiscalizacao = pathname.startsWith("/fiscalizacao");
  const base = fiscalizacao ? "/fiscalizacao/manutencoes" : "/frotas/manutencoes";
  // 18/10: na Fiscalizacao a OS so e acompanhada; editar, completar e
  // fechar sao do Frotas.
  const podeGerenciar = !fiscalizacao && podeVer("FROTAS_GERENCIAR_OS");
  const pendente = os.status === "PENDENTE";
  const fechada = os.status === "RESOLVIDA";
  const aberta = !["RESOLVIDA", "CANCELADA"].includes(os.status);
  const origem = ORIGEM[os.origem] || { texto: os.origem };

  // Servicos: o que o registro mandou verificar e o que o fechamento diz que
  // foi feito.
  const servicos = [
    ...(os.itens || []).map((i) => ({ ...i, tipo: "A verificar", feito: fechada })),
    ...(os.itens_fechamento || []).map((i) => ({ ...i, tipo: "Realizado", feito: true })),
  ];
  // Pecas: as necessarias (registro) e as trocadas (fechamento). Uma peca que
  // aparece nas duas listas vale como instalada.
  const trocadas = linhasDe(os.pecas_trocadas);
  const pecas = [
    ...linhasDe(os.pecas_necessarias)
      .filter((p) => !trocadas.some((t) => t.toLowerCase() === p.toLowerCase()))
      .map((p) => ({ peca: p, momento: "Necessária", instalada: false })),
    ...trocadas.map((p) => ({ peca: p, momento: "Trocada", instalada: true })),
  ];
  const totalOs = os.custo != null ? Number(os.custo) : os.custo_estimado != null ? Number(os.custo_estimado) : null;
  const diferenca = os.custo != null && os.custo_estimado != null ? Number(os.custo) - Number(os.custo_estimado) : null;

  const observacoes = [
    os.observacoes && { autor: os.solicitante, papel: "Registro da OS", quando: dataHora(os.data_abertura), texto: os.observacoes },
    os.observacoes_fechamento && { autor: os.fechada_por_nome, papel: "Fechamento da OS", quando: data(os.data_fechamento), texto: os.observacoes_fechamento },
  ].filter(Boolean);

  return (
    <div className="ficha">
      <div className="cabecalho-pagina vd-cabecalho">
        <div>
          <Trilha
            itens={[
              { rotulo: fiscalizacao ? "Fiscalização" : "Frotas" },
              { rotulo: "Manutenções", para: base },
              { rotulo: "Detalhes da OS" },
            ]}
          />
          <div className="vd-titulo">
            <span className="vd-titulo__icone"><Icone nome="kpi-wrench" tamanho={26} /></span>
            <div>
              <h1>Detalhes da OS</h1>
              <p>Visualize todas as informações da ordem de serviço, incluindo diagnóstico, serviços, peças, custos e histórico.</p>
            </div>
          </div>
        </div>
        <div className="cabecalho-pagina__acoes esconder-impressao">
          <button className="botao" onClick={() => navegar(base)}>
            <Icone nome="seta-esquerda" tamanho={15} /> Voltar
          </button>
          {podeGerenciar && aberta && !pendente && (
            <button className="botao botao--primario" onClick={() => setFechando(true)}>
              <Icone nome="concluir" tamanho={15} monocromatico /> Fechar OS
            </button>
          )}
          {podeGerenciar && os.status !== "CANCELADA" && (
            <button className={pendente ? "botao botao--primario" : "botao"} onClick={() => setEditando(true)}>
              <Icone nome="editar" tamanho={15} monocromatico={pendente} /> {pendente ? "Completar OS" : "Editar"}
            </button>
          )}
        </div>
      </div>

      <section className="vd-resumo">
        <ResumoVeiculo v={os} />
        <div className="vd-resumo__grade vd-resumo__grade--4">
          <div className="vd-resumo__coluna"><Item rotulo="Setor">{vazio(os.setor)}</Item></div>
          <div className="vd-resumo__coluna">
            <Item rotulo="Nº da OS">{numeroOs(os.numero) || "—"}</Item>
            <span className="vd-resumo__apoio">{rotulo("tipoOs", os.tipo)}</span>
          </div>
          <div className="vd-resumo__coluna"><Item rotulo="Odômetro atual">{`${numero(os.quilometragem_atual)} km`}</Item></div>
          <div className="vd-resumo__coluna">
            <Item rotulo="Responsável">{vazio(os.solicitante)}</Item>
            <span className="vd-resumo__apoio">Solicitante da OS</span>
          </div>
        </div>
      </section>

      <div className="ficha-3 ficha-bloco">
        <Cartao titulo={<><Icone nome="informacao" tamanho={18} /> Informações da OS</>}>
          <Linhas
            linhas={[
              ["Número da OS", numeroOs(os.numero)],
              ["Data de abertura", dataHora(os.data_abertura)],
              ["Origem", origem.link && os.id_registro_origem ? (
                <button type="button" className="selo selo--link" data-tom="azul"
                        onClick={() => navegar(origem.link(os.id_registro_origem))}>{origem.texto}</button>
              ) : <Selo key="o" texto={origem.texto} tom="azul" />],
              ["Responsável pela OS", os.solicitante],
              ["Data do ocorrido", os.data_ocorrido ? data(os.data_ocorrido) : null],
              ["Setor", os.setor],
              ["Prioridade", <Selo key="p" texto={rotulo("gravidade", os.gravidade)} tom={TOM_PRIORIDADE[os.gravidade]} />],
              ["Status", <Selo key="s" valor={os.status} />],
              ["Oficina responsável", [os.oficina, os.responsavel_oficina, os.telefone_oficina].filter(Boolean).join(" · ")],
              ["Previsão de conclusão", os.prazo_previsto ? data(os.prazo_previsto) : os.data_agendada ? `Agendada para ${data(os.data_agendada)}` : null],
              ["KM atual (no registro)", os.quilometragem != null ? `${numero(os.quilometragem)} km` : null],
              ...(fechada ? [
                ["Fechada em", `${data(os.data_fechamento)}${os.fechada_por_nome ? ` por ${os.fechada_por_nome}` : ""}`],
                ["KM no fechamento", os.km_fechamento != null ? `${numero(os.km_fechamento)} km` : null],
              ] : []),
            ]}
          />
        </Cartao>

        <Cartao
          titulo={<><Icone nome="documento" tamanho={18} /> Descrição do Problema</>}
          acao={podeGerenciar && os.status !== "CANCELADA" && (
            <button className="botao botao--pequeno vd-cartao-acao" onClick={() => setEditando(true)}>
              <Icone nome="editar" tamanho={13} /> Editar
            </button>
          )}
        >
          <p className="ficha-subtitulo">Descrição informada no registro</p>
          <p className="ficha-texto">{os.descricao || "Sem descrição."}</p>
          {fechada && (
            <>
              <p className="ficha-subtitulo">Serviço realizado (fechamento)</p>
              <p className="ficha-texto">{os.servico_realizado || "—"}</p>
            </>
          )}
          {!fechada && aberta && podeGerenciar && !pendente && (
            <div className="insp-nota insp-nota--pequena">
              <Icone nome="informacao" tamanho={14} />
              <span>Quando o serviço voltar da oficina, use <strong>Fechar OS</strong> para registrar o que foi feito.</span>
            </div>
          )}
          {pendente && (
            <div className="insp-nota insp-nota--pequena">
              <Icone nome="informacao" tamanho={14} />
              <span>{podeGerenciar
                ? <>Solicitada pela Fiscalização. Use <strong>Completar OS</strong> para informar a oficina, o responsável e o custo.</>
                : "Solicitação enviada ao Frotas. A OS segue para a oficina quando o Frotas completar o registro."}</span>
            </div>
          )}
        </Cartao>

        <Cartao titulo={<><Icone nome="check" tamanho={18} /> Status da OS</>}>
          <ol className="etapas">
            {etapasDaOs(os).map((e) => (
              <li key={e.titulo} data-estado={e.estado}>
                <span className="etapas__ponto">{e.estado === "feito" ? "✓" : e.estado === "cancelado" ? "×" : ""}</span>
                <div className="etapas__texto">
                  <strong>{e.titulo}</strong>
                  {e.quando && <span>{e.quando}</span>}
                </div>
              </li>
            ))}
          </ol>
        </Cartao>
      </div>

      <div className="ficha-3 ficha-bloco os-linha2">
        <Cartao titulo={<><Icone nome="kpi-wrench" tamanho={18} /> Serviços Realizados</>}>
          {servicos.length === 0 ? <p className="texto-corrido">Nenhum serviço listado.</p> : (
            <div className="rolagem-x">
              <table className="tabela vd-tabela tabela-ficha">
                <thead><tr><th>#</th><th>Serviço</th><th>Tipo</th><th>Status</th></tr></thead>
                <tbody>
                  {servicos.map((sv, n) => (
                    <tr key={n}>
                      <td>{n + 1}</td>
                      <td className="coluna-flexivel"><span className="celula-cortada" title={[sv.descricao, sv.observacao].filter(Boolean).join(" — ")}>{sv.descricao}</span></td>
                      <td>{sv.tipo}</td>
                      <td>{sv.feito ? <Selo texto="Concluído" tom="verde" /> : os.status === "EM_MANUTENCAO" ? <Selo texto="Em andamento" tom="azul" /> : <Selo texto="Pendente" tom="cinza" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Cartao>

        <Cartao titulo={<><Icone nome="eq-chave-roda" tamanho={18} /> Peças Utilizadas</>}>
          {pecas.length === 0 ? <p className="texto-corrido">Nenhuma peça informada.</p> : (
            <div className="rolagem-x">
              <table className="tabela vd-tabela tabela-ficha">
                <thead><tr><th>#</th><th>Peça</th><th>Momento</th><th>Status</th></tr></thead>
                <tbody>
                  {pecas.map((p, n) => (
                    <tr key={n}>
                      <td>{n + 1}</td>
                      <td className="coluna-flexivel"><span className="celula-cortada" title={p.peca}>{p.peca}</span></td>
                      <td>{p.momento}</td>
                      <td>{p.instalada ? <Selo texto="Instalado" tom="verde" /> : fechada ? <Selo texto="Não trocada" tom="cinza" /> : <Selo texto="Aguardando" tom="azul" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Cartao>

        <Cartao titulo={<><Icone nome="chart-line" tamanho={18} /> Custos da OS</>}>
          <dl className="custos">
            <div className="custos__linha"><dt>Custo estimado (registro)</dt><dd>{os.custo_estimado != null ? dinheiro(os.custo_estimado) : "—"}</dd></div>
            <div className="custos__linha"><dt>Custo final (fechamento)</dt><dd>{os.custo != null ? dinheiro(os.custo) : "—"}</dd></div>
            <div className="custos__linha"><dt>Diferença</dt><dd>{diferenca != null ? `${diferenca > 0 ? "+" : ""}${dinheiro(diferenca)}` : "—"}</dd></div>
          </dl>
          <div className="custos__total">
            <span>{os.custo != null ? "Total da OS" : "Total estimado"}</span>
            <strong>{totalOs != null ? dinheiro(totalOs) : "—"}</strong>
          </div>
        </Cartao>
      </div>

      <div className="ficha-2 ficha-bloco os-linha3">
        <Cartao titulo={<><Icone nome="historico" tamanho={18} /> Histórico da OS</>}>
          <HistoricoAuditoria
            tipo="os" id={os.id_os} recarga={recarga}
            inicio={{ quando: os.data_abertura, usuario: os.solicitante, acao: "Abertura", descricao: `OS aberta (${origem.texto})` }}
          />
        </Cartao>

        <Cartao
          titulo={<><Icone nome="documento" tamanho={18} /> Observações</>}
          acao={podeGerenciar && os.status !== "CANCELADA" && (
            <button className="botao botao--pequeno vd-cartao-acao" onClick={() => (fechada ? setFechando(true) : setEditando(true))}>
              Adicionar observação
            </button>
          )}
        >
          {observacoes.length === 0 ? <p className="texto-corrido">Nenhuma observação registrada.</p> : (
            <div className="mensagens">
              {observacoes.map((o, n) => (
                <div className="mensagem" key={n}>
                  <span className="mensagem__avatar">{iniciais(o.autor)}</span>
                  <div>
                    <div className="mensagem__topo"><strong>{vazio(o.autor)}</strong><span>{o.quando}</span></div>
                    <span className="mensagem__papel">{o.papel}</span>
                    <p>{o.texto}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Cartao>
      </div>

      {editando && (
        <RegistrarOs os={os} aoFechar={() => setEditando(false)} aoSalvar={recarregar} soViaturas={fiscalizacao} />
      )}
      {fechando && (
        <FecharOs os={os} aoFechar={() => setFechando(false)} aoSalvar={recarregar} />
      )}
    </div>
  );
}
