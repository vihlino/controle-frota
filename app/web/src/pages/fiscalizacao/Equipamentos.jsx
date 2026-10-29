/**
 * Equipamentos.jsx - Fiscalizacao > Equipamentos.
 *
 * 21/10 (2a versao, pedido do Cesar): a tela principal mostra os ITENS
 * (Cone, Pantografica, Cavalete, Barreira), nao as viaturas. E controle de
 * estoque: "anda sumindo muito cone". Para cada item:
 *   Cadastrado  - entradas menos baixas (o que a CMTT tem);
 *   Em uso      - o que saiu nos checklists que ainda estao abertos;
 *   Faltando    - o que saiu e nao voltou nos checklists finalizados;
 *   Disponivel  - cadastrado menos em uso menos faltando.
 * Clicar no item abre os detalhes (EquipamentoDetalhe.jsx): retiradas e
 * devolucoes por checklist, com os fiscais responsaveis, faltas por fiscal,
 * entradas e baixas, quantidade por viatura e historico.
 *
 * Radio (um por fiscal) e Macaco, Estepe e Chave de roda (presente/ausente)
 * ficam no quadro "Outros itens do checklist".
 */
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import AjudaTela from "../../components/AjudaTela.jsx";
import Acoes from "../../components/Acoes.jsx";
import Selo from "../../components/Selo.jsx";
import Modal from "../../components/Modal.jsx";
import Cartao from "../../components/Cartao.jsx";
import { Tabela } from "../../components/Tabela.jsx";
import { Selecao, Texto, Area, Data } from "../../components/Campos.jsx";
import { useSessao } from "../../lib/sessao.jsx";
import { api } from "../../lib/api.js";
import { data, numero } from "../../lib/formato.js";
import { CONFERENCIAS, iconeDoItem, rotuloConferencia } from "../../lib/equipamentos.js";

export const GERENCIAR_EQUIPAMENTOS = "FISCALIZACAO_GERENCIAR_VIATURAS";

export function Item({ nome, pequeno }) {
  return (
    <span className="eqp-item">
      <span className="eqp-item__icone"><Icone nome={iconeDoItem(nome)} tamanho={pequeno ? 16 : 18} /></span>
      {nome}
    </span>
  );
}

/** Numero do estoque; negativo ou faltando aparece em vermelho. */
export function Qtd({ valor, alerta, tom }) {
  const n = Number(valor) || 0;
  return <span className="eqp-n" data-tom={tom} data-zero={n === 0} data-alerta={alerta && n > 0 ? "sim" : n < 0 ? "sim" : undefined}>{numero(n)}</span>;
}

/** Entrada (cadastro de itens recebidos) ou baixa (descarte, perda reconhecida). */
export function JanelaMovimento({ item, tipo, aoFechar, aoSalvar }) {
  const entrada = tipo === "ENTRADA";
  const [form, setForm] = useState({ quantidade: "", data: new Date().toLocaleDateString("sv-SE"), observacao: "" });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  async function salvar() {
    setSalvando(true); setErro("");
    try {
      await api(`/fiscalizacao/equipamentos/itens/${item.id_equipamento}/movimentos`, {
        method: "POST", body: { tipo, quantidade: Number(form.quantidade), data: form.data, observacao: form.observacao },
      });
      aoSalvar();
    } catch (e) { setErro(e.message); setSalvando(false); }
  }
  return (
    <Modal titulo={entrada ? `Registrar entrada de ${item.nome}` : `Registrar baixa de ${item.nome}`}
           legenda={entrada ? "Itens recebidos ou comprados que passam a fazer parte do estoque." : "Itens que saem do estoque: danificados, descartados ou dados como perdidos."}
           aoFechar={aoFechar}
           rodape={<>
             <button className="botao" onClick={aoFechar}>Cancelar</button>
             <button className="botao botao--primario" disabled={salvando} onClick={salvar}>
               <Icone nome="check" tamanho={15} /> {salvando ? "Salvando..." : "Salvar"}
             </button>
           </>}>
      {erro && <div className="login__erro">{erro}</div>}
      <div className="formulario-grade">
        <Texto rotulo="Quantidade *" id="eqp-mov-qtd" type="number" min={1} inputMode="numeric" placeholder="Ex.: 50"
               value={form.quantidade} onChange={(e) => setForm((f) => ({ ...f, quantidade: e.target.value }))} />
        <Data rotulo="Data *" id="eqp-mov-data" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
        <Area rotulo={entrada ? "Observação" : "Motivo da baixa *"} id="eqp-mov-obs" largo rows={2} maxLength={500}
              placeholder={entrada ? "Ex.: compra 2026/015, recebido do almoxarifado" : "Ex.: 3 cones quebrados na operação do dia 20/10"}
              value={form.observacao} onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))} />
      </div>
    </Modal>
  );
}

/** Cadastro do item (nome, descricao e como e conferido). */
export function JanelaItem({ item, aoFechar, aoSalvar }) {
  const [form, setForm] = useState({ nome: item?.nome || "", descricao: item?.descricao || "", conferencia: item?.conferencia || "QUANTIDADE" });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  async function salvar() {
    setSalvando(true); setErro("");
    try {
      await api(item ? `/fiscalizacao/equipamentos/itens/${item.id_equipamento}` : "/fiscalizacao/equipamentos/itens",
        { method: item ? "PUT" : "POST", body: form });
      aoSalvar();
    } catch (e) { setErro(e.message); setSalvando(false); }
  }
  return (
    <Modal titulo={item ? "Editar item" : "Novo item"} legenda="Item conferido no checklist da viatura." aoFechar={aoFechar}
           rodape={<>
             <button className="botao" onClick={aoFechar}>Cancelar</button>
             <button className="botao botao--primario" disabled={salvando} onClick={salvar}>
               <Icone nome="check" tamanho={15} /> {salvando ? "Salvando..." : "Salvar"}
             </button>
           </>}>
      {erro && <div className="login__erro">{erro}</div>}
      <div className="formulario-grade">
        <Texto rotulo="Nome *" id="eqp-item-nome" maxLength={100} placeholder="Ex.: Lanterna" value={form.nome}
               onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
        <Selecao rotulo="Como é conferido *" id="eqp-item-conf" opcoes={CONFERENCIAS} value={form.conferencia}
                 ajuda={CONFERENCIAS.find((c) => c.valor === form.conferencia)?.ajuda}
                 onChange={(e) => setForm((f) => ({ ...f, conferencia: e.target.value }))} />
        <Area rotulo="Descrição" id="eqp-item-desc" largo rows={2} maxLength={500} value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} />
      </div>
    </Modal>
  );
}

export default function Equipamentos() {
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const { podeVer } = useSessao();
  const podeGerenciar = podeVer(GERENCIAR_EQUIPAMENTOS);
  const [itens, setItens] = useState(null);
  const [erro, setErro] = useState("");
  const [janela, setJanela] = useState(null);   // { tipo: "item" | "ENTRADA" | "BAIXA", item }
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("");

  useEffect(() => { definirCabecalho({ titulo: "", legenda: "" }); }, [definirCabecalho]);
  const carregar = useCallback(() => {
    api("/fiscalizacao/equipamentos/estoque").then((r) => setItens(Array.isArray(r) ? r : [])).catch((e) => setErro(e.message));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function alternar(i) {
    setErro("");
    try {
      await api(`/fiscalizacao/equipamentos/itens/${i.id_equipamento}`, { method: "PUT", body: { status: !i.status } });
      carregar();
    } catch (e) { setErro(e.message); }
  }
  const abrir = (i) => navegar(`/fiscalizacao/equipamentos/${i.id_equipamento}`);

  const estoque = (itens || []).filter((i) => i.status && i.conferencia === "QUANTIDADE");
  const outros = (itens || []).filter((i) => !i.status || i.conferencia !== "QUANTIDADE")
    .filter((i) => (!situacao || String(i.status) === situacao)
      && (!busca.trim() || `${i.nome} ${i.descricao || ""}`.toLowerCase().includes(busca.trim().toLowerCase())));

  const colunas = [
    {
      chave: "nome", rotulo: "Item", classe: "coluna-flexivel",
      render: (i) => (
        <button type="button" className="eqp-abrir" onClick={() => abrir(i)}>
          <Item nome={i.nome} />
        </button>
      ),
    },
    { chave: "cadastrado", rotulo: "Cadastrado", classe: "eqp-num", render: (i) => <Qtd valor={i.cadastrado} tom="azul" /> },
    { chave: "em_uso", rotulo: "Em uso agora", classe: "eqp-num", render: (i) => <Qtd valor={i.em_uso} tom="amarelo" /> },
    { chave: "faltando", rotulo: "Faltando", classe: "eqp-num",
      render: (i) => (i.faltando > 0
        ? <span className="celula-dupla"><Qtd valor={i.faltando} alerta /><span>{i.checklists_com_falta} checklist{i.checklists_com_falta > 1 ? "s" : ""}</span></span>
        : <Qtd valor={0} tom="vermelho" />) },
    { chave: "disponivel", rotulo: "Disponível", classe: "eqp-num", render: (i) => <Qtd valor={i.disponivel} tom="verde" /> },
    { chave: "nas_viaturas", rotulo: "Nas viaturas", classe: "eqp-num", render: (i) => <Qtd valor={i.nas_viaturas} tom="cinza" /> },
    { chave: "ultima_entrada", rotulo: "Última entrada", render: (i) => (i.ultima_entrada ? data(i.ultima_entrada) : "—") },
    {
      chave: "acoes", rotulo: "Ações",
      render: (i) => (
        <Acoes acoes={[
          { rotulo: "Visualizar", icone: "visualizar", aoClicar: () => abrir(i) },
          podeGerenciar && { rotulo: "Registrar entrada", icone: "mais", aoClicar: () => setJanela({ tipo: "ENTRADA", item: i }) },
          podeGerenciar && { rotulo: "Registrar baixa", icone: "minus", aoClicar: () => setJanela({ tipo: "BAIXA", item: i }) },
          podeGerenciar && { rotulo: "Editar item", icone: "editar", aoClicar: () => setJanela({ tipo: "item", item: i }) },
          podeGerenciar && { rotulo: "Inativar", icone: "fechar", aoClicar: () => alternar(i) },
        ].filter(Boolean)} />
      ),
    },
  ];
  const colunasOutros = [
    { chave: "nome", rotulo: "Item", classe: "coluna-flexivel",
      render: (i) => <span className="celula-dupla"><strong><Item nome={i.nome} pequeno /></strong><span>{i.descricao || ""}</span></span> },
    { chave: "conferencia", rotulo: "Conferência no checklist", render: (i) => rotuloConferencia(i.conferencia) },
    { chave: "faltando", rotulo: "Faltas", render: (i) => (i.faltando > 0 ? <Qtd valor={i.faltando} alerta /> : "—") },
    { chave: "status", rotulo: "Situação", render: (i) => <Selo texto={i.status ? "Ativo" : "Inativo"} tom={i.status ? "verde" : "cinza"} /> },
    {
      chave: "acoes", rotulo: "Ações",
      render: (i) => (
        <Acoes acoes={[
          { rotulo: "Visualizar", icone: "visualizar", aoClicar: () => abrir(i) },
          podeGerenciar && { rotulo: "Editar item", icone: "editar", aoClicar: () => setJanela({ tipo: "item", item: i }) },
          podeGerenciar && { rotulo: i.status ? "Inativar" : "Ativar", icone: i.status ? "fechar" : "check", aoClicar: () => alternar(i) },
        ].filter(Boolean)} />
      ),
    },
  ];

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <Trilha itens={[{ rotulo: "Fiscalização" }, { rotulo: "Equipamentos" }]} />
          <h1>Equipamentos<AjudaTela texto="Controle de estoque dos equipamentos: quanto foi cadastrado, quanto está em uso, quanto faltou na devolução dos checklists e quanto está disponível. Clique no item para ver quem retirou e quem devolveu." /></h1>
        </div>
        {podeGerenciar && (
          <div className="cabecalho-pagina__acoes">
            <button className="botao botao--primario" onClick={() => setJanela({ tipo: "item", item: null })}>
              <Icone nome="mais" tamanho={15} /> Novo item
            </button>
          </div>
        )}
      </div>

      {erro && <div className="login__erro">{erro}</div>}

      <section className="cartao eqp-secao">
        <header className="dd-titulo">
          <span className="eqp-secao__icone"><Icone nome="eq-cone" tamanho={26} /></span>
          <div><h2>Estoque de equipamentos</h2><p>Visão geral dos equipamentos principais utilizados na fiscalização.</p></div>
        </header>
        <Tabela colunas={colunas} linhas={itens ? estoque : null} chaveDe={(i) => i.id_equipamento}
                vazio="Nenhum item com controle de quantidade." carregando={!itens} />
        <p className="campo__ajuda eqp-nota eqp-nota--rodape">
          <Icone nome="informacao" tamanho={15} /> Disponível = cadastrado − em uso − faltando. Faltando é o que saiu no checklist e não voltou na chegada; os responsáveis estão nos detalhes do item.
        </p>
      </section>

      <section className="cartao eqp-secao">
        <header className="dd-titulo">
          <span className="eqp-secao__icone eqp-secao__icone--cinza"><Icone nome="checklist" tamanho={24} /></span>
          <div><h2>Outros itens do checklist</h2><p>Equipamentos adicionais que fazem parte da conferência no checklist da viatura.</p></div>
          <span className="as-ferramentas">
            <span className="as-busca">
              <Icone nome="search" tamanho={14} />
              <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar equipamento..." aria-label="Buscar equipamento" />
            </span>
            <select value={situacao} onChange={(e) => setSituacao(e.target.value)} aria-label="Situação">
              <option value="">Todos</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
          </span>
        </header>
        <Tabela colunas={colunasOutros} linhas={itens ? outros : null} chaveDe={(i) => i.id_equipamento}
                vazio="Nenhum outro item." carregando={!itens} />
      </section>

      {janela?.tipo === "item" && (
        <JanelaItem item={janela.item} aoFechar={() => setJanela(null)} aoSalvar={() => { setJanela(null); carregar(); }} />
      )}
      {(janela?.tipo === "ENTRADA" || janela?.tipo === "BAIXA") && (
        <JanelaMovimento item={janela.item} tipo={janela.tipo} aoFechar={() => setJanela(null)}
                         aoSalvar={() => { setJanela(null); carregar(); }} />
      )}
    </>
  );
}
