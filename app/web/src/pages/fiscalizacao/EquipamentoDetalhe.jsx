/**
 * EquipamentoDetalhe.jsx - Detalhes de um equipamento (21/10): o controle de
 * estoque do item.
 *
 * "Tal dia o fulano pegou 50 cones, devolveu 45. Onde foi parar os 5?"
 * (Cesar). Abas:
 *   Retiradas e devolucoes - cada checklist da viatura: quanto saiu, quanto
 *                            voltou, quanto falta, e os fiscais responsaveis;
 *   Faltas por fiscal      - quanto faltou nos checklists de cada fiscal;
 *   Entradas e baixas      - o que foi cadastrado no estoque (e quando) e o
 *                            que saiu dele (descarte, perda reconhecida);
 *   Por viatura            - a quantidade que cada viatura leva (o checklist
 *                            sugere esse numero na saida);
 *   Historico              - alteracoes do item e das quantidades.
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import Selo from "../../components/Selo.jsx";
import Acoes from "../../components/Acoes.jsx";
import Modal from "../../components/Modal.jsx";
import Cartao from "../../components/Cartao.jsx";
import { Abas } from "../../components/FichaTabela.jsx";
import { Tabela, Paginacao } from "../../components/Tabela.jsx";
import { Selecao, Area, Periodo } from "../../components/Campos.jsx";
import { useLista } from "../../components/useLista.js";
import { useSessao } from "../../lib/sessao.jsx";
import { api } from "../../lib/api.js";
import { data, dataHora, hora, numero } from "../../lib/formato.js";
import { iconeDoItem, rotuloConferencia } from "../../lib/equipamentos.js";
import { Item, Qtd, JanelaItem, JanelaMovimento, GERENCIAR_EQUIPAMENTOS } from "./Equipamentos.jsx";
import { Item as ItemResumo } from "../ServidorDetalhe.jsx";

const BASE = "/fiscalizacao/equipamentos";

function Lista({ lista, colunas, chaveDe, vazio, unidade }) {
  return (
    <>
      {lista.erro ? <div className="vazio">{lista.erro}</div> : (
        <Tabela colunas={colunas} linhas={lista.resultado?.itens} chaveDe={chaveDe} vazio={vazio} carregando={lista.carregando} />
      )}
      {lista.resultado && (
        <Paginacao pagina={lista.pagina} setPagina={lista.setPagina} porPagina={lista.porPagina}
                   setPorPagina={lista.setPorPagina} total={lista.resultado.total}
                   paginas={lista.resultado.paginas} unidade={unidade} />
      )}
    </>
  );
}

const nomeFiscal = (f) => `${f.nome}${f.matricula ? ` (${f.matricula})` : ""}`;

function AbaRetiradas({ id, viaturas, fiscais }) {
  const navegar = useNavigate();
  const lista = useLista(`fiscalizacao/equipamentos/itens/${id}/checklists`, { dataDe: "", dataAte: "", viatura: "", fiscal: "", falta: "" });
  const colunas = [
    { chave: "data", rotulo: "Data", render: (c) => <span className="celula-dupla"><strong>{data(c.data_abertura)}</strong><span>{hora(c.hora_saida)}{c.hora_chegada ? ` – ${hora(c.hora_chegada)}` : ""}</span></span> },
    { chave: "viatura", rotulo: "Viatura", render: (c) => <span className="celula-dupla"><strong>{c.placa}</strong><span>{c.modelo}</span></span> },
    { chave: "equipe", rotulo: "Equipe", render: (c) => <span className="celula-dupla"><strong>{c.equipe || "—"}</strong><span>{c.servico_codigo || ""}</span></span> },
    {
      chave: "fiscais", rotulo: "Responsáveis", classe: "coluna-flexivel",
      render: (c) => (c.fiscais?.length
        ? <span className="celula-lista">{c.fiscais.map((f) => <span key={f.id_servidor}>{nomeFiscal(f)}</span>)}</span>
        : "—"),
    },
    { chave: "saida", rotulo: "Retirou", classe: "eqp-num", render: (c) => <Qtd valor={c.saida} /> },
    { chave: "chegada", rotulo: "Devolveu", classe: "eqp-num", render: (c) => (c.chegada === null ? "—" : <Qtd valor={c.chegada} />) },
    {
      chave: "falta", rotulo: "Situação",
      render: (c) => (c.status === "ABERTO"
        ? <Selo texto="Em serviço" tom="azul" />
        : c.falta > 0 ? <Selo texto={c.falta === 1 ? "Falta 1" : `Faltam ${numero(c.falta)}`} tom="vermelho" /> : <Selo texto="Devolvido" tom="verde" />),
    },
    {
      chave: "acoes", rotulo: "Ações",
      render: (c) => (
        <Acoes acoes={[
          { rotulo: "Ver checklist", icone: "checklist", aoClicar: () => navegar(`/fiscalizacao/checklists/${c.id_checklist}`) },
          c.id_servico_equipe && { rotulo: "Ver serviço diário", icone: "calendar", aoClicar: () => navegar(`/fiscalizacao/servico-diario/${c.id_servico_equipe}`) },
        ].filter(Boolean)} />
      ),
    },
  ];
  return (
    <Cartao titulo={<><Icone nome="checklist" tamanho={18} /> Retiradas e devoluções</>}>
      <div className="filtros eqp-filtros" data-aberto="true">
        <Periodo id="eqp-periodo" de={lista.filtros.dataDe} ate={lista.filtros.dataAte}
                 aoMudarDe={(v) => lista.alterarFiltro("dataDe", v)} aoMudarAte={(v) => lista.alterarFiltro("dataAte", v)} />
        <Selecao rotulo="Viatura" id="eqp-viatura" vazio="Todas"
                 opcoes={viaturas.map((v) => ({ valor: String(v.id_veiculo), rotulo: `${v.placa} - ${v.modelo}` }))}
                 value={lista.filtros.viatura} onChange={(e) => lista.alterarFiltro("viatura", e.target.value)} />
        <Selecao rotulo="Fiscal" id="eqp-fiscal" vazio="Todos"
                 opcoes={fiscais.map((f) => ({ valor: String(f.id_servidor), rotulo: nomeFiscal(f) }))}
                 value={lista.filtros.fiscal} onChange={(e) => lista.alterarFiltro("fiscal", e.target.value)} />
        <Selecao rotulo="Devolução" id="eqp-falta" vazio="Todas" opcoes={[{ valor: "1", rotulo: "Só com falta" }]}
                 value={lista.filtros.falta} onChange={(e) => lista.alterarFiltro("falta", e.target.value)} />
        <div className="filtros__acoes">
          <button className="botao" onClick={lista.limpar}><Icone nome="limpar-filtros" tamanho={15} /> Limpar</button>
        </div>
      </div>
      <Lista lista={lista} colunas={colunas} chaveDe={(c) => c.id_checklist} vazio="Nenhuma retirada com esses filtros." unidade="checklists" />
    </Cartao>
  );
}

function AbaFaltas({ resumo, irPara }) {
  const colunas = [
    { chave: "nome", rotulo: "Fiscal", classe: "coluna-flexivel", render: (f) => <strong>{f.nome}</strong> },
    { chave: "matricula", rotulo: "Matrícula" },
    { chave: "checklists", rotulo: "Checklists com falta", classe: "eqp-num", render: (f) => numero(f.checklists) },
    { chave: "faltando", rotulo: "Total que faltou", classe: "eqp-num", render: (f) => <Qtd valor={f.faltando} alerta /> },
    { chave: "ultima", rotulo: "Última falta", render: (f) => data(f.ultima) },
    {
      chave: "acoes", rotulo: "Ações",
      render: (f) => (
        <Acoes acoes={[
          { rotulo: "Ver as retiradas", icone: "checklist", aoClicar: () => irPara("retiradas", { fiscal: f.id_servidor, falta: "1" }) },
        ]} />
      ),
    },
  ];
  return (
    <Cartao titulo={<><Icone nome="alert-triangle" tamanho={18} /> Faltas por fiscal</>}>
      <p className="texto-corrido">O que saiu no checklist e não voltou na chegada. Os responsáveis são o Fiscal 1 e o Fiscal 2 daquele checklist.</p>
      <Tabela colunas={colunas} linhas={resumo.faltas_por_fiscal} chaveDe={(f) => f.id_servidor} vazio="Nenhuma falta registrada. Tudo o que saiu voltou." />
    </Cartao>
  );
}

function AbaEstoque({ id, recarga }) {
  const lista = useLista(`fiscalizacao/equipamentos/itens/${id}/movimentos`, {});
  useEffect(() => { if (recarga) lista.recarregar(); /* eslint-disable-next-line */ }, [recarga]);
  const colunas = [
    { chave: "data", rotulo: "Data", render: (m) => data(m.data) },
    { chave: "tipo", rotulo: "Movimento", render: (m) => <Selo texto={m.tipo === "ENTRADA" ? "Entrada" : "Baixa"} tom={m.tipo === "ENTRADA" ? "verde" : "vermelho"} /> },
    { chave: "quantidade", rotulo: "Quantidade", classe: "eqp-num", render: (m) => <strong>{m.tipo === "ENTRADA" ? "+" : "−"}{numero(m.quantidade)}</strong> },
    { chave: "observacao", rotulo: "Observação", classe: "coluna-flexivel", render: (m) => m.observacao || "—" },
    { chave: "usuario", rotulo: "Registrado por", render: (m) => <span className="celula-dupla"><strong>{m.usuario || "—"}</strong><span>{dataHora(m.criado_em)}</span></span> },
  ];
  return (
    <Cartao titulo={<><Icone nome="documento" tamanho={18} /> Entradas e baixas</>}>
      <Lista lista={lista} colunas={colunas} chaveDe={(m) => m.id_movimento} vazio="Nenhuma entrada registrada ainda. Use “Registrar entrada” para cadastrar o estoque." unidade="movimentos" />
    </Cartao>
  );
}

function JanelaQuantidadeViatura({ item, viatura, aoFechar, aoSalvar }) {
  const [valor, setValor] = useState(Number(viatura.quantidades?.[item.id_equipamento]) || 0);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const mudar = (n) => setValor(Math.max(0, Math.min(999, Number.isFinite(n) ? n : 0)));
  async function salvar() {
    setSalvando(true); setErro("");
    try {
      await api(`/fiscalizacao/equipamentos/viaturas/${viatura.id_veiculo}`, {
        method: "PUT", body: { quantidades: { [item.id_equipamento]: valor }, motivo },
      });
      aoSalvar();
    } catch (e) { setErro(e.message); setSalvando(false); }
  }
  return (
    <Modal titulo={`${item.nome} na viatura`} legenda={`${viatura.placa} · ${viatura.marca} ${viatura.modelo}`} aoFechar={aoFechar}
           rodape={<>
             <button className="botao" onClick={aoFechar}>Cancelar</button>
             <button className="botao botao--primario" disabled={salvando} onClick={salvar}>
               <Icone nome="check" tamanho={15} /> {salvando ? "Salvando..." : "Salvar"}
             </button>
           </>}>
      {erro && <div className="login__erro">{erro}</div>}
      <p className="texto-corrido">É a quantidade que o checklist da viatura sugere na saída.</p>
      <div className="eqp-qtd">
        <Item nome={item.nome} />
        <div className="qf-contador eqp-contador">
          <button type="button" aria-label="Menos" disabled={!(valor > 0)} onClick={() => mudar(valor - 1)}><Icone nome="minus" tamanho={16} /></button>
          <input type="number" min={0} max={999} inputMode="numeric" aria-label="Quantidade" value={valor} onChange={(e) => mudar(parseInt(e.target.value, 10))} />
          <button type="button" aria-label="Mais" onClick={() => mudar(valor + 1)}><Icone nome="mais" tamanho={16} /></button>
        </div>
      </div>
      <div className="formulario-grade" style={{ marginTop: 12 }}>
        <Area rotulo="Motivo da alteração (opcional)" id="eqp-motivo" largo rows={2} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </div>
    </Modal>
  );
}

function AbaViaturas({ item, podeGerenciar, aoMudar }) {
  const navegar = useNavigate();
  const lista = useLista("fiscalizacao/equipamentos/viaturas", { busca: "" });
  const [editando, setEditando] = useState(null);
  const colunas = [
    { chave: "placa", rotulo: "Viatura", classe: "coluna-flexivel", render: (v) => <span className="celula-dupla"><strong>{v.placa}</strong><span>{v.marca} {v.modelo}</span></span> },
    { chave: "qtd", rotulo: `${item.nome} na viatura`, classe: "eqp-num", render: (v) => <Qtd valor={v.quantidades?.[item.id_equipamento]} /> },
    { chave: "status", rotulo: "Situação", render: (v) => <Selo valor={v.status} /> },
    { chave: "atualizado_em", rotulo: "Alterado em", render: (v) => (v.atualizado_em ? dataHora(v.atualizado_em) : "—") },
    {
      chave: "acoes", rotulo: "Ações",
      render: (v) => (
        <Acoes acoes={[
          podeGerenciar && { rotulo: "Editar quantidade", icone: "editar", aoClicar: () => setEditando(v) },
          { rotulo: "Ver viatura", icone: "fisc-viatura", aoClicar: () => navegar(`/fiscalizacao/viaturas/${v.id_veiculo}`) },
        ].filter(Boolean)} />
      ),
    },
  ];
  return (
    <Cartao titulo={<><Icone nome="fisc-viatura" tamanho={18} /> Por viatura</>}>
      <div className="filtros eqp-filtros" data-aberto="true">
        <div className="campo"><label htmlFor="eqp-busca-v">Buscar</label>
          <input id="eqp-busca-v" className="campo__input" placeholder="Placa ou modelo" value={lista.filtros.busca}
                 onChange={(e) => lista.alterarFiltro("busca", e.target.value)} /></div>
      </div>
      <Lista lista={lista} colunas={colunas} chaveDe={(v) => v.id_veiculo} vazio="Nenhuma viatura." unidade="viaturas" />
      {editando && (
        <JanelaQuantidadeViatura item={item} viatura={editando} aoFechar={() => setEditando(null)}
                                 aoSalvar={() => { setEditando(null); lista.recarregar(); aoMudar(); }} />
      )}
    </Cartao>
  );
}

function AbaHistorico({ id }) {
  const lista = useLista("fiscalizacao/equipamentos/historico", { item: String(id), viatura: "" }, { item: String(id) });
  const TIPO = {
    QUANTIDADE: ["Quantidade na viatura", "azul"], ITEM_CRIADO: ["Item criado", "verde"], ITEM_ALTERADO: ["Item alterado", "amarelo"],
    ITEM_ATIVADO: ["Item ativado", "verde"], ITEM_INATIVADO: ["Item inativado", "cinza"],
  };
  const colunas = [
    { chave: "alterado_em", rotulo: "Data", render: (h) => dataHora(h.alterado_em) },
    { chave: "tipo", rotulo: "Alteração", render: (h) => <Selo texto={TIPO[h.tipo]?.[0] || h.tipo} tom={TIPO[h.tipo]?.[1] || "cinza"} /> },
    { chave: "placa", rotulo: "Viatura", render: (h) => h.placa || "—" },
    {
      chave: "descricao", rotulo: "O que mudou", classe: "coluna-flexivel",
      render: (h) => (h.tipo === "QUANTIDADE"
        ? <span className="eqp-mudou">{h.quantidade_anterior ?? 0} <Icone nome="seta-direita" tamanho={13} /> <strong>{h.quantidade_nova}</strong></span>
        : h.descricao || "—"),
    },
    { chave: "motivo", rotulo: "Motivo", render: (h) => h.motivo || "—" },
    { chave: "usuario", rotulo: "Por", render: (h) => h.usuario || "—" },
  ];
  return (
    <Cartao titulo={<><Icone nome="historico" tamanho={18} /> Histórico</>}>
      <Lista lista={lista} colunas={colunas} chaveDe={(h) => h.id_historico} vazio="Nenhuma alteração registrada." unidade="alterações" />
    </Cartao>
  );
}

export default function EquipamentoDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const { podeVer } = useSessao();
  const podeGerenciar = podeVer(GERENCIAR_EQUIPAMENTOS);
  const [parametros] = useSearchParams();
  // A aba fica no estado: o "Limpar" dos filtros tira a pesquisa do endereco.
  const [aba, setAba] = useState(parametros.get("aba") || "retiradas");
  const [r, setR] = useState(null);
  const [erro, setErro] = useState("");
  const [viaturas, setViaturas] = useState([]);
  const [fiscais, setFiscais] = useState([]);
  const [janela, setJanela] = useState(null);
  const [recargaEstoque, setRecargaEstoque] = useState(0);

  useEffect(() => { definirCabecalho({ titulo: "", legenda: "" }); }, [definirCabecalho]);
  const carregar = useCallback(() => {
    api(`/fiscalizacao/equipamentos/itens/${id}/resumo`).then(setR).catch((e) => setErro(e.message));
  }, [id]);
  useEffect(() => {
    carregar();
    const comoLista = (x) => (Array.isArray(x) ? x : []);
    api("/frotas/veiculos/opcoes?viatura=true").then((x) => setViaturas(comoLista(x))).catch(() => {});
    api("/admin/servidores/opcoes?cargo_nome=FISCAL%20DE%20TRANSITO&status=true").then((x) => setFiscais(comoLista(x))).catch(() => {});
  }, [carregar]);

  const irPara = (chave, filtros = {}) => {
    setAba(chave);
    navegar(`?${new URLSearchParams({ aba: chave, ...Object.fromEntries(Object.entries(filtros).map(([k, v]) => [k, String(v)])) })}`, { replace: true });
  };

  if (erro) return <Cartao><div className="vazio">{erro}</div></Cartao>;
  if (!r) return <div className="carregando">Carregando o equipamento...</div>;
  const porQuantidade = r.conferencia === "QUANTIDADE";
  const ABAS = [
    { chave: "retiradas", rotulo: "Retiradas e devoluções", icone: "checklist" },
    { chave: "faltas", rotulo: "Faltas por fiscal", icone: "alert-triangle", total: r.faltas_por_fiscal.length },
    { chave: "estoque", rotulo: "Entradas e baixas", icone: "documento" },
    porQuantidade && { chave: "viaturas", rotulo: "Por viatura", icone: "fisc-viatura" },
    { chave: "historico", rotulo: "Histórico", icone: "historico" },
  ].filter(Boolean);

  return (
    <div className="ficha">
      <div className="cabecalho-pagina vd-cabecalho">
        <div>
          <Trilha itens={[{ rotulo: "Fiscalização" }, { rotulo: "Equipamentos", para: BASE }, { rotulo: r.nome }]} />
          <div className="vd-titulo">
            <span className="vd-titulo__icone"><Icone nome={iconeDoItem(r.nome)} tamanho={26} /></span>
            <div>
              <h1>{r.nome}</h1>
              <p>Estoque, retiradas e devoluções nos checklists das viaturas, com os responsáveis.</p>
            </div>
          </div>
        </div>
        <div className="cabecalho-pagina__acoes">
          <button className="botao" onClick={() => navegar(BASE)}><Icone nome="seta-esquerda" tamanho={15} /> Voltar</button>
          {podeGerenciar && (
            <>
              <button className="botao" onClick={() => setJanela("item")}><Icone nome="editar" tamanho={15} /> Editar item</button>
              <button className="botao" onClick={() => setJanela("BAIXA")}><Icone nome="minus" tamanho={15} /> Registrar baixa</button>
              <button className="botao botao--primario" onClick={() => setJanela("ENTRADA")}><Icone nome="mais" tamanho={15} /> Registrar entrada</button>
            </>
          )}
        </div>
      </div>

      <section className="vd-resumo sd-resumo">
        <div className="sd-pessoa">
          <span className="sd-avatar eq-avatar" aria-hidden="true"><Icone nome={iconeDoItem(r.nome)} tamanho={40} /></span>
          <div className="sd-pessoa__dados">
            <span className="vd-resumo__rotulo">Equipamento</span>
            <span className="sd-pessoa__nome"><strong>{r.nome}</strong><Selo texto={r.status ? "Ativo" : "Inativo"} tom={r.status ? "verde" : "cinza"} /></span>
            <span className="sd-pessoa__linha">{rotuloConferencia(r.conferencia)}{r.ultima_entrada ? <><span className="sd-sep">|</span>Última entrada em {data(r.ultima_entrada)}</> : null}</span>
          </div>
        </div>
        <div className="vd-resumo__grade vd-resumo__grade--5">
          <div className="vd-resumo__coluna"><ItemResumo rotulo="Cadastrado"><span className="eqp-grande"><Qtd valor={r.cadastrado} /></span></ItemResumo></div>
          <div className="vd-resumo__coluna"><ItemResumo rotulo="Em uso agora"><span className="eqp-grande"><Qtd valor={r.em_uso} /></span></ItemResumo></div>
          <div className="vd-resumo__coluna"><ItemResumo rotulo="Faltando"><span className="eqp-grande"><Qtd valor={r.faltando} alerta /></span></ItemResumo></div>
          <div className="vd-resumo__coluna"><ItemResumo rotulo="Disponível"><span className="eqp-grande"><Qtd valor={r.disponivel} /></span></ItemResumo></div>
          <div className="vd-resumo__coluna"><ItemResumo rotulo="Nas viaturas"><span className="eqp-grande"><Qtd valor={r.nas_viaturas} /></span></ItemResumo></div>
        </div>
      </section>

      <Abas abas={ABAS} ativa={aba} aoMudar={(c) => irPara(c)} />

      <div key={aba} className="eqp-corpo">
        {aba === "retiradas" && <AbaRetiradas id={id} viaturas={viaturas} fiscais={fiscais} />}
        {aba === "faltas" && <AbaFaltas resumo={r} irPara={irPara} />}
        {aba === "estoque" && <AbaEstoque id={id} recarga={recargaEstoque} />}
        {aba === "viaturas" && porQuantidade && <AbaViaturas item={r} podeGerenciar={podeGerenciar} aoMudar={carregar} />}
        {aba === "historico" && <AbaHistorico id={id} />}
      </div>

      {janela === "item" && <JanelaItem item={r} aoFechar={() => setJanela(null)} aoSalvar={() => { setJanela(null); carregar(); }} />}
      {(janela === "ENTRADA" || janela === "BAIXA") && (
        <JanelaMovimento item={r} tipo={janela} aoFechar={() => setJanela(null)}
                         aoSalvar={() => { setJanela(null); carregar(); setRecargaEstoque((n) => n + 1); if (aba !== "estoque") irPara("estoque"); }} />
      )}
    </div>
  );
}
