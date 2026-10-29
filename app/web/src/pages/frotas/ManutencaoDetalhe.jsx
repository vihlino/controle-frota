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
 *
 * 29/10 (desenho do Cesar): faixa do veiculo com a foto; abas Visao Geral,
 * Servicos e Pecas, Custos, Historico e Documentos e Fotos (anexos da OS,
 * migracao 053); "Informacoes Adicionais" com a ultima OS fechada do veiculo e
 * a proxima manutencao. Fica de fora: custo separado de servicos e de pecas e
 * o KM previsto para a proxima (o SITRA nao guarda).
 */
import { useEffect, useState } from "react";
import { useLocation, useOutletContext, useParams, useNavigate, useSearchParams } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import Selo from "../../components/Selo.jsx";
import RegistrarOs from "../../components/RegistrarOs.jsx";
import FecharOs from "../../components/FecharOs.jsx";
import FaixaVeiculo from "../../components/FaixaVeiculo.jsx";
import AnexosRegistro from "../../components/AnexosRegistro.jsx";
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
  const [veiculo, setVeiculo] = useState(null);
  const [anteriores, setAnteriores] = useState(null);
  const [parametros, definirParametros] = useSearchParams();
  const aba = parametros.get("aba") || "geral";
  const setAba = (chave) => {
    const p = new URLSearchParams(parametros);
    if (chave === "geral") p.delete("aba"); else p.set("aba", chave);
    definirParametros(p, { replace: true });
  };

  useEffect(() => {
    definirCabecalho({ titulo: "", legenda: "" });
  }, [definirCabecalho]);

  useEffect(() => {
    api(`/frotas/manutencoes/${id}`).then(setOs).catch((e) => setErro(e.message));
  }, [id, recarga]);

  // Veiculo (foto) e as OS fechadas antes desta, para "Informacoes adicionais".
  const idVeiculo = os?.id_veiculo;
  useEffect(() => {
    if (!idVeiculo) return;
    api(`/frotas/veiculos/${idVeiculo}`).then(setVeiculo).catch(() => {});
    api(`/frotas/manutencoes?veiculo=${idVeiculo}&status=RESOLVIDA&porPagina=5`)
      .then((r) => setAnteriores((r?.itens || []).filter((o) => String(o.id_os) !== String(id))))
      .catch(() => setAnteriores([]));
  }, [idVeiculo, id, recarga]);

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

  const podeArquivos = podeVer("FROTAS_GERENCIAR_OS");
  const ultima = (anteriores || [])[0] || null;
  const ABAS = [
    { chave: "geral", rotulo: "Visão Geral", icone: "informacao" },
    { chave: "servicos", rotulo: "Serviços e Peças", icone: "kpi-wrench", total: (servicos.length + pecas.length) || undefined },
    { chave: "custos", rotulo: "Custos", icone: "dinheiro" },
    { chave: "historico", rotulo: "Histórico", icone: "historico" },
    { chave: "arquivos", rotulo: "Documentos e Fotos", icone: "documentos" },
  ];
  const botaoEditar = (rotuloBotao = "Editar", aoClicar = () => setEditando(true)) => podeGerenciar && os.status !== "CANCELADA" && (
    <button className="botao botao--pequeno vd-cartao-acao" onClick={aoClicar}>
      <Icone nome={rotuloBotao === "Editar" ? "editar" : "mais"} tamanho={13} /> {rotuloBotao}
    </button>
  );
  const editarItens = () => (fechada ? setFechando(true) : setEditando(true));

  const cartaoInformacoes = (
    <Cartao titulo={<><Icone nome="informacao" tamanho={18} /> Informações da OS</>} acao={botaoEditar()}>
      <Linhas
        linhas={[
          ["Número da OS", numeroOs(os.numero)],
          ["Tipo de manutenção", <Selo key="t" texto={rotulo("tipoOs", os.tipo)} tom="azul" />],
          ["Data de abertura", dataHora(os.data_abertura)],
          ["Data do ocorrido", os.data_ocorrido ? data(os.data_ocorrido) : null],
          ["Origem", origem.link && os.id_registro_origem ? (
            <button type="button" className="selo selo--link" data-tom="azul"
                    onClick={() => navegar(origem.link(os.id_registro_origem))}>{origem.texto}</button>
          ) : <Selo key="o" texto={origem.texto} tom="azul" />],
          ["Setor", os.setor],
          ["Responsável pela OS", os.solicitante],
          ["Oficina responsável", [os.oficina, os.responsavel_oficina, os.telefone_oficina].filter(Boolean).join(" · ")],
          ["Previsão de conclusão", os.prazo_previsto ? data(os.prazo_previsto) : os.data_agendada ? `Agendada para ${data(os.data_agendada)}` : null],
          ["Prioridade", <Selo key="p" texto={rotulo("gravidade", os.gravidade)} tom={TOM_PRIORIDADE[os.gravidade]} />],
          ["Status", <Selo key="s" valor={os.status} />],
          ["KM atual (no registro)", os.quilometragem != null ? `${numero(os.quilometragem)} km` : null],
          ...(fechada ? [
            ["Fechada em", `${data(os.data_fechamento)}${os.fechada_por_nome ? ` por ${os.fechada_por_nome}` : ""}`],
            ["KM no fechamento", os.km_fechamento != null ? `${numero(os.km_fechamento)} km` : null],
          ] : []),
        ]}
      />
    </Cartao>
  );

  const cartaoDescricao = (
    <Cartao titulo={<><Icone nome="arquivo-texto" tamanho={18} /> Descrição do Problema</>} acao={botaoEditar()}>
      <p className="ficha-subtitulo">Descrição informada no registro</p>
      <p className="ficha-texto os-caixa">{os.descricao || "Sem descrição."}</p>
      {fechada && (
        <>
          <p className="ficha-subtitulo">Serviço realizado (fechamento)</p>
          <p className="ficha-texto os-caixa">{os.servico_realizado || "—"}</p>
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
  );

  const cartaoStatus = (
    <Cartao titulo={<><Icone nome="historico" tamanho={18} /> Status da OS</>}>
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
  );

  const cartaoServicos = (
    <Cartao titulo={<><Icone nome="kpi-wrench" tamanho={18} /> Serviços Realizados</>} acao={botaoEditar("Adicionar serviço", editarItens)}>
      <div className="rolagem-x">
        <table className="tabela vd-tabela tabela-ficha os-tabela">
          <thead><tr><th>#</th><th>Serviço</th><th>Tipo</th><th>Status</th></tr></thead>
          <tbody>
            {servicos.length === 0 ? (
              <tr><td colSpan={4}><div className="os-vazio"><Icone nome="kpi-wrench" tamanho={26} monocromatico /> Nenhum serviço listado.</div></td></tr>
            ) : servicos.map((sv, n) => (
              <tr key={n}>
                <td>{n + 1}</td>
                <td className="coluna-flexivel"><span className="celula-cortada" title={[sv.descricao, sv.observacao].filter(Boolean).join(" — ")}>{sv.descricao}</span></td>
                <td>{sv.tipo}</td>
                <td>{sv.feito ? <Selo texto="Concluído" tom="verde" /> : os.status === "EM_MANUTENCAO" ? <Selo texto="Em andamento" tom="azul" /> : <Selo texto="Pendente" tom="amarelo" />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Cartao>
  );

  const cartaoPecas = (
    <Cartao titulo={<><Icone nome="eq-chave-roda" tamanho={18} /> Peças Utilizadas</>} acao={botaoEditar("Adicionar peça", editarItens)}>
      <div className="rolagem-x">
        <table className="tabela vd-tabela tabela-ficha os-tabela">
          <thead><tr><th>#</th><th>Peça</th><th>Momento</th><th>Status</th></tr></thead>
          <tbody>
            {pecas.length === 0 ? (
              <tr><td colSpan={4}><div className="os-vazio"><Icone nome="camadas" tamanho={26} monocromatico /> Nenhuma peça informada.</div></td></tr>
            ) : pecas.map((p, n) => (
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
    </Cartao>
  );

  const cartaoCustos = (
    <Cartao titulo={<><Icone nome="dinheiro" tamanho={18} /> Custos da OS</>} acao={botaoEditar("Editar", editarItens)}>
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
  );

  const cartaoObservacoes = (
    <Cartao titulo={<><Icone nome="arquivo-texto" tamanho={18} /> Observações</>} acao={botaoEditar("Editar", editarItens)}>
      {observacoes.length === 0 ? <p className="ficha-texto os-caixa">Nenhuma observação registrada.</p> : (
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
  );

  const cartaoAdicionais = (
    <Cartao titulo={<><Icone nome="informacao" tamanho={18} /> Informações Adicionais</>}>
      <Linhas linhas={[
        ["Última manutenção", ultima ? (
          <button type="button" className="os-ligadas__link" onClick={() => navegar(`${base}/${ultima.id_os}`)}>
            {data(ultima.data_fechamento || ultima.data_abertura)} · {numeroOs(ultima.numero)}
          </button>
        ) : anteriores ? "Nenhuma antes desta" : null],
        ["Próxima manutenção", os.proxima_manutencao ? data(os.proxima_manutencao) : null],
        ["KM na última manutenção", ultima ? (ultima.km_fechamento != null ? `${numero(ultima.km_fechamento)} km` : ultima.quilometragem != null ? `${numero(ultima.quilometragem)} km` : null) : null],
        ["KM atual do veículo", `${numero(os.quilometragem_atual)} km`],
      ]} />
    </Cartao>
  );

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

      <FaixaVeiculo
        v={veiculo ? { ...veiculo, veiculo_status: veiculo.status } : { ...os, veiculo_status: os.veiculo_status }}
        dados={[
          { icone: "predio", rotulo: "Setor", valor: vazio(os.setor) },
          { icone: "arquivo-texto", rotulo: "Nº da OS", valor: numeroOs(os.numero) || "—", apoio: rotulo("tipoOs", os.tipo) },
          { icone: "calendar", rotulo: "Data de abertura", valor: dataHora(os.data_abertura) },
          { icone: "odometro", rotulo: "Odômetro atual", valor: `${numero(os.quilometragem_atual)} km` },
          { icone: "user", rotulo: "Responsável", valor: vazio(os.solicitante), apoio: "Solicitante da OS" },
        ]} />

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

      {aba === "geral" && (
        <>
          <div className="ficha-3 ficha-bloco">
            {cartaoInformacoes}
            {cartaoDescricao}
            {cartaoStatus}
          </div>
          <div className="ficha-3 ficha-bloco os-linha2">
            {cartaoServicos}
            {cartaoPecas}
            {cartaoCustos}
          </div>
          <div className="ficha-bloco os-linha-tres">
            {cartaoObservacoes}
            <Cartao titulo={<><Icone nome="documentos" tamanho={18} /> Documentos e Fotos</>}
                    acao={<button className="botao botao--pequeno vd-cartao-acao" onClick={() => setAba("arquivos")}>Ver todos</button>}>
              <AnexosRegistro tituloFotos="Fotos da OS" podeGerenciar={podeArquivos} compacto
                              caminhoLista={`/frotas/manutencoes/${os.id_os}/arquivos`} caminhoArquivo="/frotas/manutencoes/arquivos" />
            </Cartao>
            {cartaoAdicionais}
          </div>
        </>
      )}

      {aba === "servicos" && (
        <div className="ficha-2 ficha-bloco">
          {cartaoServicos}
          {cartaoPecas}
        </div>
      )}

      {aba === "custos" && (
        <div className="ficha-2 ficha-bloco">
          {cartaoCustos}
          {cartaoAdicionais}
        </div>
      )}

      {aba === "historico" && (
        <div className="ficha-2 ficha-bloco os-linha3">
          <Cartao titulo={<><Icone nome="historico" tamanho={18} /> Histórico da OS</>}>
            <HistoricoAuditoria
              tipo="os" id={os.id_os} recarga={recarga}
              inicio={{ quando: os.data_abertura, usuario: os.solicitante, acao: "Abertura", descricao: `OS aberta (${origem.texto})` }}
            />
          </Cartao>
          {cartaoStatus}
        </div>
      )}

      {aba === "arquivos" && (
        <AnexosRegistro tituloFotos="Fotos da OS" podeGerenciar={podeArquivos}
                        caminhoLista={`/frotas/manutencoes/${os.id_os}/arquivos`} caminhoArquivo="/frotas/manutencoes/arquivos" />
      )}

      {editando && (
        <RegistrarOs os={os} aoFechar={() => setEditando(false)} aoSalvar={recarregar} soViaturas={fiscalizacao} />
      )}
      {fechando && (
        <FecharOs os={os} aoFechar={() => setFechando(false)} aoSalvar={recarregar} />
      )}
    </div>
  );
}
