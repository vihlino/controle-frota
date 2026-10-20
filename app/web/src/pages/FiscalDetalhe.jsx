/**
 * FiscalDetalhe.jsx - Detalhes do Fiscal (08/10).
 *
 * Mesmo modelo da tela de Detalhes do Motorista, com o que e da
 * Fiscalizacao: ocorrencias atendidas pelas equipes do fiscal, checklists de
 * viatura que ele assinou, pontuacao (so para quem gerencia a pontuacao),
 * equipes e o historico de atividades. Tudo vem de uma chamada so:
 * /fiscalizacao/fiscais/:id/ficha.
 *
 * Ocorrencia e pontuacao sao registradas por EQUIPE: aparecem as da equipe em
 * que o fiscal estava naquele dia.
 */
import { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import Cartao from "../components/Cartao.jsx";
import Icone from "../components/Icone.jsx";
import Trilha from "../components/Trilha.jsx";
import Selo from "../components/Selo.jsx";
import { api } from "../lib/api.js";
import { data, dataHora, hora, numero, rotulo } from "../lib/formato.js";
import FiltroPeriodo, { dentroDoPeriodo } from "../components/FiltroPeriodo.jsx";
import { cpf as mascaraCpf, telefone as mascaraTelefone } from "../lib/mascaras.js";
import { useSessao } from "../lib/sessao.jsx";
import { iniciais, situacaoCnh, Item, Linhas } from "./ServidorDetalhe.jsx";
import JanelaCadastro from "../components/JanelaCadastro.jsx";
import MultasPessoa from "../components/MultasPessoa.jsx";
import { CONFIG_SERVIDOR } from "./admin/Servidores.jsx";

const vazio = (v) => (v === null || v === undefined || v === "" ? "—" : v);
const BASE = "/fiscalizacao/fiscais";

const SITUACAO_OCORRENCIA = {
  PENDENTE: { texto: "Pendente", tom: "amarelo" },
  ATRIBUIDA: { texto: "Atribuída", tom: "azul" },
  EM_ATENDIMENTO: { texto: "Em atendimento", tom: "azul" },
  EM_ANDAMENTO: { texto: "Em andamento", tom: "azul" },
  FINALIZADA: { texto: "Finalizada", tom: "verde" },
  INTERCORRENCIA: { texto: "Intercorrência", tom: "vermelho" },
};
const TIPO_OCORRENCIA = {
  QRU: "QRU", PROGRAMADA: "Programada", ACIDENTE: "Acidente de trânsito",
  APOIO: "Apoio operacional", FISCALIZACAO: "Fiscalização de trânsito",
  ESTACIONAMENTO: "Estacionamento irregular", EVENTO: "Apoio a evento", OUTRO: "Outro",
};
const PAPEL = { FISCAL_1: "Fiscal 1", FISCAL_2: "Fiscal 2" };
const capitalizar = (t) => (t ? t.charAt(0) + t.slice(1).toLowerCase() : "");

function SeloOcorrencia({ status }) {
  const s = SITUACAO_OCORRENCIA[status] || { texto: capitalizar(status), tom: "cinza" };
  return <Selo texto={s.texto} tom={s.tom} />;
}

function Pontos({ valor }) {
  const n = Number(valor || 0);
  return <strong className="fd-pontos" data-sinal={n > 0 ? "mais" : n < 0 ? "menos" : "zero"}>
    {n > 0 ? "+" : ""}{numero(n, Number.isInteger(n) ? 0 : 1)}
  </strong>;
}

/** Tabela simples: colunas {rotulo, render, classe}; linhas clicaveis se aoAbrir. */
function Tabela({ linhas, colunas, aoAbrir, vazio: textoVazio }) {
  if (!linhas.length) return <p className="texto-corrido">{textoVazio}</p>;
  return (
    <div className="rolagem-x">
      <table className="tabela vd-tabela tabela-ficha">
        <thead><tr>{colunas.map((c) => <th key={c.rotulo}>{c.rotulo}</th>)}</tr></thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className={aoAbrir ? "vd-tabela__linha" : undefined}
                onClick={aoAbrir ? () => aoAbrir(l) : undefined}>
              {colunas.map((c) => <td key={c.rotulo} className={c.classe}>{c.render(l)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FiscalDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const { podeVer } = useSessao();
  const [f, setF] = useState(null);
  const [erro, setErro] = useState("");
  const [parametros, definirParametros] = useSearchParams();
  const aba = parametros.get("aba") || "geral";
  const setAba = (chave) => {
    const p = new URLSearchParams(parametros);
    if (chave === "geral") p.delete("aba"); else p.set("aba", chave);
    definirParametros(p, { replace: true });
    window.scrollTo({ top: 0 });
  };
  const podeEditar = podeVer("FROTAS_GERENCIAR_SERVIDORES") || podeVer("FISCALIZACAO_GERENCIAR_FISCAIS");

  useEffect(() => {
    definirCabecalho({ titulo: "", legenda: "" });
  }, [definirCabecalho]);

  // Editar abre a janela aqui mesmo (08/10); ao salvar, a ficha recarrega.
  const [editando, setEditando] = useState(false);
  const [recarga, setRecarga] = useState(0);
  // Periodo das abas Checklists, Ocorrencias e Pontuacao (18/10).
  const [periodos, setPeriodos] = useState({});
  const periodoDe = (aba) => periodos[aba] || { de: "", ate: "" };
  const filtroDe = (aba) => (
    <FiltroPeriodo id={`periodo-${aba}`} de={periodoDe(aba).de} ate={periodoDe(aba).ate}
                   aoMudar={(v) => setPeriodos((p) => ({ ...p, [aba]: v }))} />
  );
  useEffect(() => {
    api(`/fiscalizacao/fiscais/${id}/ficha`).then(setF).catch((e) => setErro(e.message));
  }, [id, recarga]);

  if (erro) return <Cartao><div className="vazio">{erro}</div></Cartao>;
  if (!f) return <div className="carregando">Carregando...</div>;

  const r = f.resumo || {};
  const cnh = situacaoCnh(f);
  const cargo = f.cargo || f.cargo_funcao;
  const vePontos = Array.isArray(f.pontuacao);
  const equipeAtual = (f.equipes || []).find((e) => e.atual);
  const abrirOcorrencia = (o) => navegar(`/fiscalizacao/ocorrencias/${o.id_ocorrencia}`);
  // Checklist de viatura: abre a janela de Visualizar da lista (18/10).
  const abrirChecklist = (c) => navegar(`/fiscalizacao/checklists/${c.id_checklist}`);
  const abrirSinistro = (x) => navegar(`/frotas/sinistros/${x.id_sinistro}`);
  const noPeriodo = (aba, lista, campo) => (lista || []).filter((l) => dentroDoPeriodo(l[campo], periodoDe(aba).de, periodoDe(aba).ate));

  // Historico de atividades: ocorrencias, checklists, pontuacao, servicos
  // coordenados e alteracoes do cadastro, numa linha do tempo so.
  const atividades = [
    ...(f.ocorrencias || []).map((o) => ({
      quando: `${o.data}T${o.hora || "00:00"}`, tipo: "Ocorrência", tom: "vermelho",
      descricao: `${o.protocolo} - ${TIPO_OCORRENCIA[o.tipo] || o.tipo} - ${o.endereco || ""}`,
      selo: <SeloOcorrencia status={o.status} />,
    })),
    ...(f.checklists || []).map((c) => ({
      quando: `${c.data_abertura}T${c.hora_saida || "00:00"}`, tipo: "Checklist", tom: "azul",
      descricao: `Checklist da viatura ${c.placa}${c.equipe ? ` - ${c.equipe}` : ""} (${PAPEL[c.papel] || c.papel})`,
      selo: <Selo valor={c.status} />,
    })),
    ...(vePontos ? f.pontuacao : []).map((p) => ({
      quando: p.data_registro, tipo: "Pontuação", tom: "amarelo",
      descricao: `${p.codigo} - ${p.item}${p.individual ? "" : ` (equipe ${p.equipe})`}`,
      selo: <Pontos valor={p.pontos_aplicados} />,
    })),
    ...(f.servicos || []).map((s) => ({
      quando: s.data, tipo: "Serviço diário", tom: "roxo",
      descricao: `Coordenou o serviço ${capitalizar(s.turno)} de ${data(s.data)}`,
      selo: <Selo texto={capitalizar(s.status)} tom="cinza" />,
    })),
    ...(f.cadastro || []).map((a) => ({
      quando: a.data_hora, tipo: "Cadastro", tom: "roxo",
      descricao: (a.entidade === "usuario"
        ? (a.acao === "CRIAR" ? "Acesso ao sistema criado" : a.acao === "ALTERAR_SENHA" ? "Senha de acesso alterada" : "Acesso ao sistema alterado")
        : (a.acao === "CRIAR" ? "Cadastro criado" : "Dados do cadastro alterados"))
        + (a.justificativa ? ` - Motivo: ${a.justificativa}` : "") + (a.pessoa ? ` (por ${a.pessoa})` : ""),
      selo: null,
    })),
  ].sort((a, b) => String(b.quando).localeCompare(String(a.quando)));

  // Ordem pedida pelo Cesar (18/10).
  const ABAS = [
    { chave: "geral", rotulo: "Visão Geral", icone: "user" },
    { chave: "cnh", rotulo: "CNH", icone: "cnh" },
    { chave: "multas", rotulo: "Multas", icone: "alert-triangle", total: r.multas },
    { chave: "equipes", rotulo: "Equipes", icone: "equipe", total: (f.equipes || []).length },
    { chave: "checklists", rotulo: "Checklists", icone: "checklist", total: r.checklists },
    { chave: "ocorrencias", rotulo: "Ocorrências", icone: "fisc-ocorrencias", total: r.ocorrencias },
    { chave: "sinistros", rotulo: "Sinistros", icone: "sinistro", total: r.sinistros },
    ...(vePontos ? [{ chave: "pontuacao", rotulo: "Pontuação", icone: "fisc-bolt" }] : []),
    { chave: "historico", rotulo: "Histórico", icone: "historico" },
  ];
  const COL_SINISTRO = [
    { rotulo: "Nº do Sinistro", render: (x) => vazio(x.numero) },
    { rotulo: "Data", render: (x) => data(x.data) },
    { rotulo: "Viatura", render: (x) => (
      <span className="celula-dupla"><strong>{x.placa}</strong><span>{x.marca} {x.modelo}</span></span>
    ) },
    { rotulo: "Tipo", render: (x) => rotulo("tipoSinistro", x.tipo) },
    { rotulo: "Situação", render: (x) => <Selo valor={x.status} /> },
  ];

  const COL_OCORRENCIA = [
    { rotulo: "Nº da ocorrência", render: (o) => vazio(o.protocolo) },
    { rotulo: "Data / Hora", render: (o) => `${data(o.data)} ${hora(o.hora)}` },
    { rotulo: "Tipo", render: (o) => TIPO_OCORRENCIA[o.tipo] || o.tipo },
    { rotulo: "Local", classe: "coluna-flexivel", render: (o) => (
      <span className="celula-cortada" title={o.endereco || ""}>{vazio(o.endereco)}</span>
    ) },
    { rotulo: "Equipe", render: (o) => vazio(o.equipe) },
    { rotulo: "Situação", render: (o) => <SeloOcorrencia status={o.status} /> },
  ];
  const COL_CHECKLIST = [
    { rotulo: "Data / Hora", render: (c) => `${data(c.data_abertura)} ${hora(c.hora_saida)}` },
    { rotulo: "Viatura", render: (c) => (
      <span className="celula-dupla"><strong>{c.placa}</strong><span>{c.marca} {c.modelo}</span></span>
    ) },
    { rotulo: "Equipe", render: (c) => vazio(c.equipe) },
    { rotulo: "Função", render: (c) => PAPEL[c.papel] || vazio(c.papel) },
    { rotulo: "KM rodado", render: (c) => (c.km_rodado ? `${numero(c.km_rodado)} km` : "—") },
    { rotulo: "Situação", render: (c) => <Selo valor={c.status} /> },
  ];
  const COL_PONTOS = [
    { rotulo: "Data", render: (p) => data(p.data_registro) },
    { rotulo: "Item", classe: "coluna-flexivel", render: (p) => (
      <span className="celula-cortada" title={p.observacao || p.item}>{p.codigo} - {p.item}</span>
    ) },
    { rotulo: "Origem", render: (p) => (p.individual ? "Individual" : `Equipe ${p.equipe}`) },
    { rotulo: "Qtd.", render: (p) => numero(p.quantidade) },
    { rotulo: "Pontos", render: (p) => <Pontos valor={p.pontos_aplicados} /> },
  ];
  const COL_EQUIPE = [
    { rotulo: "Equipe", render: (e) => <strong>{e.numero}</strong> },
    { rotulo: "Tipo", render: (e) => capitalizar(e.tipo) },
    { rotulo: "Turno atual", render: (e) => (e.turno ? capitalizar(e.turno) : "—") },
    { rotulo: "Desde", render: (e) => data(e.data_inicio) },
    { rotulo: "Até", render: (e) => (e.data_fim ? data(e.data_fim) : "—") },
    { rotulo: "Colegas de equipe", classe: "coluna-flexivel", render: (e) => (
      <span className="celula-cortada" title={e.colegas || ""}>{vazio(e.colegas)}</span>
    ) },
    { rotulo: "Situação", render: (e) => (e.atual ? <Selo texto="Atual" tom="verde" /> : <Selo texto="Encerrada" tom="cinza" />) },
  ];
  const COL_ATIVIDADE = [
    { rotulo: "Data / Hora", render: (a) => (String(a.quando).length > 10 ? dataHora(a.quando) : data(a.quando)) },
    { rotulo: "Tipo", render: (a) => <span className="vd-tipo" data-tom={a.tom}>{a.tipo}</span> },
    { rotulo: "Descrição", classe: "coluna-flexivel", render: (a) => (
      <span className="celula-cortada" title={a.descricao}>{a.descricao}</span>
    ) },
    { rotulo: "Situação", render: (a) => a.selo || "—" },
  ];

  const verTodos = (chave, total) => (
    <button className="botao botao--pequeno vd-cartao-acao" onClick={() => setAba(chave)}>
      Ver todos ({numero(total || 0)})
    </button>
  );
  // Com período escolhido, Positivos/Negativos (e o cartão "No período")
  // somam só as linhas do período - o mesmo que a tabela mostra.
  const pontosVisiveis = vePontos ? noPeriodo("pontuacao", f.pontuacao, "data_registro") : [];
  const comPeriodoPontos = Boolean(periodoDe("pontuacao").de || periodoDe("pontuacao").ate);
  const soma = (l) => l.reduce((t, p) => t + Number(p.pontos_aplicados), 0);
  const totalPositivo = soma(pontosVisiveis.filter((p) => Number(p.pontos_aplicados) > 0));
  const totalNegativo = soma(pontosVisiveis.filter((p) => Number(p.pontos_aplicados) < 0));

  const cards = [
    { chave: "ocorrencias", rotulo: "Ocorrências", valor: numero(r.ocorrencias_6m || 0), icone: "fisc-ocorrencias", tom: "vermelho" },
    { chave: "checklists", rotulo: "Checklists", valor: numero(r.checklists_6m || 0), icone: "checklist", tom: "verde" },
    vePontos
      ? { chave: "pontuacao", rotulo: "Pontuação", valor: <Pontos valor={r.pontos_6m} />, icone: "fisc-bolt", tom: "azul" }
      : { chave: "historico", rotulo: "Serviços coordenados", valor: numero(r.servicos || 0), icone: "calendar", tom: "azul", rodape: "Total" },
  ];

  const blocoEquipes = (
    <Cartao titulo={<><Icone nome="equipe" tamanho={18} /> Equipes</>} acao={verTodos("equipes", (f.equipes || []).length)}>
      <Tabela linhas={(f.equipes || []).slice(0, 5)} colunas={COL_EQUIPE.filter((c) => !["Desde", "Até"].includes(c.rotulo))}
              vazio="Não faz parte de nenhuma equipe." />
    </Cartao>
  );

  return (
    <div className="ficha">
      <div className="cabecalho-pagina vd-cabecalho">
        <div>
          <Trilha
            itens={[
              { rotulo: "Fiscalização" },
              { rotulo: "Fiscais", para: BASE },
              { rotulo: "Detalhes do Fiscal" },
            ]}
          />
          <div className="vd-titulo">
            <span className="vd-titulo__icone"><Icone nome="motorista" tamanho={26} /></span>
            <div>
              <h1>Detalhes do Fiscal</h1>
              <p>Visualize todas as informações do fiscal, incluindo dados pessoais, equipes, ocorrências, pontuação e histórico.</p>
            </div>
          </div>
        </div>
        <div className="cabecalho-pagina__acoes">
          <button className="botao" onClick={() => navegar(BASE)}>
            <Icone nome="seta-esquerda" tamanho={15} /> Voltar
          </button>
          {podeEditar && (
            <button className="botao" onClick={() => setEditando(true)}>
              <Icone nome="editar" tamanho={15} /> Editar
            </button>
          )}
        </div>
      </div>

      <section className="vd-resumo sd-resumo">
        <div className="sd-pessoa">
          <span className="sd-avatar" aria-hidden="true">{iniciais(f.nome)}</span>
          <div className="sd-pessoa__dados">
            <span className="vd-resumo__rotulo">Nome completo</span>
            <span className="sd-pessoa__nome">
              <strong>{f.nome}</strong>
              <Selo texto={f.status ? "Ativo" : "Inativo"} tom={f.status ? "verde" : "vermelho"} />
            </span>
            <span className="sd-pessoa__linha">
              Matrícula: <strong>{f.matricula}</strong>
              <span className="sd-sep">|</span>
              CPF: <strong>{mascaraCpf(f.cpf)}</strong>
            </span>
          </div>
        </div>
        <div className="vd-resumo__grade vd-resumo__grade--4">
          <div className="vd-resumo__coluna"><Item rotulo="Telefone">{vazio(mascaraTelefone(f.telefone))}</Item></div>
          <div className="vd-resumo__coluna"><Item rotulo="E-mail">{vazio(f.email)}</Item></div>
          <div className="vd-resumo__coluna">
            <Item rotulo="Equipe atual">
              {equipeAtual ? `${equipeAtual.numero}${equipeAtual.turno ? ` · ${capitalizar(equipeAtual.turno)}` : ""}` : "—"}
            </Item>
          </div>
          <div className="vd-resumo__coluna"><Item rotulo="Cargo / Função">{vazio(cargo)}</Item></div>
        </div>
      </section>

      <div className="abas vd-abas" role="tablist">
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
          <div className="ficha-3 sd-linha1 ficha-bloco">
            <Cartao titulo={<><Icone nome="user" tamanho={18} /> Dados Pessoais</>}>
              <Linhas linhas={[
                ["Nome completo", f.nome],
                ["Matrícula", f.matricula],
                ["CPF", mascaraCpf(f.cpf)],
                ["Data de nascimento", f.data_nascimento ? data(f.data_nascimento) : null],
                ["Telefone", mascaraTelefone(f.telefone) || null],
                ["E-mail", f.email],
              ]} />
            </Cartao>

            <Cartao titulo={<><Icone nome="setores" tamanho={18} /> Vinculação</>}>
              <Linhas linhas={[
                ["Setor", f.setor],
                ["Cargo / Função", cargo],
                ["Equipe atual", equipeAtual
                  ? <span className="celula-dupla sd-esquerda"><strong>{equipeAtual.numero}{equipeAtual.turno ? ` · ${capitalizar(equipeAtual.turno)}` : ""}</strong>
                      {equipeAtual.colegas && <span>Com {equipeAtual.colegas}</span>}</span>
                  : "Sem equipe"],
                ["Acesso ao sistema", f.usuario
                  ? <span className="celula-dupla sd-esquerda"><strong>{f.usuario.login}</strong><span>Perfil {f.usuario.perfil}</span></span>
                  : "Sem usuário"],
                ["Último acesso", f.usuario?.ultimo_acesso ? dataHora(f.usuario.ultimo_acesso) : null],
                ["Situação", <Selo texto={f.status ? "Ativo" : "Inativo"} tom={f.status ? "verde" : "vermelho"} />],
              ]} />
            </Cartao>

            <Cartao titulo={<><Icone nome="chart-line" tamanho={18} /> Resumo</>}>
              <div className="sd-resumo-cards">
                {cards.map((c) => (
                  <button type="button" key={c.chave} className="sd-card" data-tom={c.tom} onClick={() => setAba(c.chave)}>
                    <Icone nome={c.icone} tamanho={24} />
                    <span>
                      <span className="sd-card__rotulo">{c.rotulo}</span>
                      <strong>{c.valor}</strong>
                      <small>{c.rodape || "Últimos 6 meses"}</small>
                    </span>
                  </button>
                ))}
                <button type="button" className="sd-card" data-tom={f.condutor ? cnh.tom : "cinza"} onClick={() => setAba("cnh")}>
                  <Icone nome="cnh" tamanho={24} />
                  <span>
                    <span className="sd-card__rotulo">CNH</span>
                    <strong>{f.condutor && f.cnh ? (f.categoria_cnh || "—") : "—"}</strong>
                    <small>
                      {!f.condutor ? "Não é condutor"
                        : f.cnh_data_validade ? `${cnh.texto} · ${data(f.cnh_data_validade)}` : cnh.texto}
                    </small>
                  </span>
                </button>
              </div>
            </Cartao>
          </div>

          <div className="ficha-2 ficha-bloco">
            <Cartao titulo={<><Icone nome="fisc-ocorrencias" tamanho={18} /> Últimas Ocorrências</>}
                    acao={verTodos("ocorrencias", r.ocorrencias)}>
              <Tabela linhas={(f.ocorrencias || []).slice(0, 5)}
                      colunas={COL_OCORRENCIA.filter((c) => c.rotulo !== "Equipe")}
                      aoAbrir={abrirOcorrencia} vazio="Nenhuma ocorrência atendida." />
            </Cartao>
            <Cartao titulo={<><Icone nome="checklist" tamanho={18} /> Checklists</>}
                    acao={verTodos("checklists", r.checklists)}>
              <Tabela linhas={(f.checklists || []).slice(0, 5)}
                      colunas={COL_CHECKLIST.filter((c) => c.rotulo !== "KM rodado")}
                      aoAbrir={abrirChecklist} vazio="Nenhum checklist de viatura." />
            </Cartao>
          </div>

          <div className="ficha-2 ficha-bloco">
            {vePontos ? (
              <Cartao titulo={<><Icone nome="fisc-bolt" tamanho={18} /> Pontuação Recente</>}
                      acao={verTodos("pontuacao", f.pontuacao.length)}>
                <Tabela linhas={f.pontuacao.slice(0, 5)} colunas={COL_PONTOS.filter((c) => c.rotulo !== "Qtd.")}
                        vazio="Nenhum registro de pontuação." />
              </Cartao>
            ) : blocoEquipes}
            <Cartao titulo={<><Icone nome="historico" tamanho={18} /> Histórico de Atividades</>}
                    acao={verTodos("historico", atividades.length)}>
              <Tabela linhas={atividades.slice(0, 5)} colunas={COL_ATIVIDADE} vazio="Nenhuma atividade registrada." />
            </Cartao>
          </div>
        </>
      )}

      {aba === "cnh" && (
        <div className="ficha-2 ficha-bloco">
          <Cartao titulo={<><Icone nome="cnh" tamanho={18} /> Carteira Nacional de Habilitação</>}>
            {!f.condutor ? (
              <p className="texto-corrido">Este fiscal não está cadastrado como condutor, por isso não tem CNH registrada.</p>
            ) : (
              <Linhas linhas={[
                ["Nº da CNH / registro", f.cnh],
                ["Categoria", f.categoria_cnh],
                ["Data de emissão", f.cnh_data_emissao ? data(f.cnh_data_emissao) : null],
                ["Data de validade", f.cnh_data_validade ? data(f.cnh_data_validade) : null],
                ["Situação", <Selo texto={cnh.texto} tom={cnh.tom} />],
              ]} />
            )}
          </Cartao>
          <Cartao titulo={<><Icone nome="informacao" tamanho={18} /> Uso das viaturas</>}>
            <Linhas linhas={[
              ["Condutor", f.condutor ? "Sim" : "Não"],
              ["Checklists de viatura", numero(r.checklists || 0)],
              ["Como Fiscal 1", numero((f.checklists || []).filter((c) => c.papel === "FISCAL_1").length)],
              ["Como Fiscal 2", numero((f.checklists || []).filter((c) => c.papel === "FISCAL_2").length)],
              ["Pontos de multas (12 meses)", numero(r.pontos_12m || 0)],
            ]} />
            {f.condutor && (
              <p className="vd2-nota" style={{ marginTop: 10 }}>
                O aviso de CNH vencendo aparece no sino 30 dias antes da validade.
              </p>
            )}
          </Cartao>
        </div>
      )}

      {aba === "ocorrencias" && (
        <Cartao titulo={<><Icone nome="fisc-ocorrencias" tamanho={18} /> Ocorrências Atendidas {filtroDe("ocorrencias")}</>}>
          <Tabela linhas={noPeriodo("ocorrencias", f.ocorrencias, "data")} colunas={COL_OCORRENCIA} aoAbrir={abrirOcorrencia}
                  vazio="Nenhuma ocorrência atendida no período." />
        </Cartao>
      )}

      {aba === "checklists" && (
        <Cartao titulo={<><Icone nome="checklist" tamanho={18} /> Checklists {filtroDe("checklists")}</>}>
          <Tabela linhas={noPeriodo("checklists", f.checklists, "data_abertura")} colunas={COL_CHECKLIST}
                  aoAbrir={abrirChecklist} vazio="Nenhum checklist de viatura no período." />
        </Cartao>
      )}

      {aba === "pontuacao" && vePontos && (
        <Cartao titulo={<><Icone nome="fisc-bolt" tamanho={18} /> Pontuação {filtroDe("pontuacao")}</>}>
          <div className="fd-pontos-resumo">
            <div><span>Total</span><Pontos valor={r.pontos} /></div>
            {comPeriodoPontos
              ? <div><span>No período</span><Pontos valor={soma(pontosVisiveis)} /></div>
              : <div><span>Últimos 6 meses</span><Pontos valor={r.pontos_6m} /></div>}
            <div><span>Positivos</span><Pontos valor={totalPositivo} /></div>
            <div><span>Negativos</span><Pontos valor={totalNegativo} /></div>
          </div>
          <Tabela linhas={pontosVisiveis} colunas={COL_PONTOS}
                  vazio="Nenhum registro de pontuação no período." />
          <p className="vd2-nota" style={{ marginTop: 10 }}>
            Pontuação lançada para a equipe vale para todos os fiscais que estavam nela naquele dia.
          </p>
        </Cartao>
      )}

      {aba === "sinistros" && (
        <Cartao titulo={<><Icone nome="sinistro" tamanho={18} /> Sinistros como condutor</>}>
          <Tabela linhas={f.sinistros || []} colunas={COL_SINISTRO}
                  aoAbrir={podeVer("FROTAS_VISUALIZAR") ? abrirSinistro : undefined}
                  vazio="Nenhum sinistro registrado." />
        </Cartao>
      )}

      {aba === "multas" && <MultasPessoa servidor={f} aoMudar={() => setRecarga((n) => n + 1)} />}

      {aba === "equipes" && (
        <Cartao titulo={<><Icone nome="equipe" tamanho={18} /> Equipes</>}>
          <Tabela linhas={f.equipes || []} colunas={COL_EQUIPE} vazio="Não faz parte de nenhuma equipe." />
        </Cartao>
      )}

      {aba === "historico" && (
        <Cartao titulo={<><Icone nome="historico" tamanho={18} /> Histórico de Atividades</>}>
          <Tabela linhas={atividades} colunas={COL_ATIVIDADE} vazio="Nenhuma atividade registrada." />
        </Cartao>
      )}

      {editando && (
        <JanelaCadastro config={{ ...CONFIG_SERVIDOR, singular: "fiscal" }} id={id}
                        aoFechar={() => setEditando(false)}
                        aoSalvar={() => setRecarga((n) => n + 1)} />
      )}
    </div>
  );
}
