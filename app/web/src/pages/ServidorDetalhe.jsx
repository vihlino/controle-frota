/**
 * ServidorDetalhe.jsx - Detalhes do Motorista / Detalhes do Servidor (08/10).
 *
 * Uma tela so para tres caminhos:
 *   /frotas/motoristas/:id   "Detalhes do Motorista" (Frotas > Motoristas)
 *   /frotas/servidores/:id   "Detalhes do Servidor"  (Frotas > Servidores)
 *   /admin/servidores/:id    "Detalhes do Servidor"  (Administracao > Servidores)
 *
 * Modelo do Cesar de 08/10, tirando o que o SITRA nao guarda: foto (vira as
 * iniciais), endereco, data de admissao e tipo de vinculo. No topo, o cartao
 * da pessoa; abas Visao Geral, CNH, Checklists, Sinistros e Historico
 * (Manutencoes saiu em 08/10, a pedido do Cesar). A Visao Geral tem Dados Pessoais, Vinculacao (com o acesso ao
 * sistema), Resumo dos ultimos 6 meses e as ultimas linhas de cada modulo.
 *
 * A ficha de Fiscais vai ser diferente e nao usa esta tela.
 */
import { useEffect, useState } from "react";
import FiltroPeriodo from "../components/FiltroPeriodo.jsx";
import { useLocation, useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import Cartao from "../components/Cartao.jsx";
import Icone from "../components/Icone.jsx";
import Trilha from "../components/Trilha.jsx";
import Selo from "../components/Selo.jsx";
import { Paginacao } from "../components/Tabela.jsx";
import ListaResumo from "../components/ListaResumo.jsx";
import { resumoSinistro } from "../components/ResumosLista.jsx";
import { api } from "../lib/api.js";
import { data, dataHora, dinheiro, hora, numero, rotulo } from "../lib/formato.js";
import { cpf as mascaraCpf, telefone as mascaraTelefone } from "../lib/mascaras.js";
import { useSessao } from "../lib/sessao.jsx";
import JanelaCadastro from "../components/JanelaCadastro.jsx";
import AtualizarCnh from "../components/AtualizarCnh.jsx";
import MultasPessoa, { SeloMulta, SeloGravidade } from "../components/MultasPessoa.jsx";
import { Equipamentos } from "./frotas/Checklists.jsx";
import { CONFIG_SERVIDOR } from "./admin/Servidores.jsx";

const vazio = (v) => (v === null || v === undefined || v === "" ? "—" : v);
const primeiraLinha = (t) => String(t || "").split("\n")[0];

const ORIGEM = {
  CHECKLIST: { texto: "Checklist", tom: "azul", rota: "/frotas/checklists" },
  SINISTRO: { texto: "Sinistro", tom: "vermelho", rota: "/frotas/sinistros" },
  CADASTRO: { texto: "Cadastro", tom: "roxo", rota: null },
  MULTA: { texto: "Multa", tom: "amarelo", rota: null },
};

/** "Fernanda Rocha Alves" -> "FA". */
export function iniciais(nome) {
  const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

/** Situacao da CNH pela validade: mesmo criterio do alerta do sino (30 dias). */
export function situacaoCnh(s) {
  if (!s.cnh_data_validade) return { texto: "Sem validade cadastrada", tom: "cinza" };
  const d = Number(s.cnh_dias);
  if (d < 0) return { texto: `Vencida há ${Math.abs(d)} dia${Math.abs(d) === 1 ? "" : "s"}`, tom: "vermelho" };
  if (d === 0) return { texto: "Vence hoje", tom: "vermelho" };
  if (d <= 30) return { texto: `Vence em ${d} dia${d === 1 ? "" : "s"}`, tom: "amarelo" };
  return { texto: "Válida", tom: "verde" };
}

/** Idade em anos completos a partir de "aaaa-mm-dd". */
function idade(nasc) {
  if (!nasc) return null;
  const [a, m, d] = String(nasc).slice(0, 10).split("-").map(Number);
  const h = new Date();
  let i = h.getFullYear() - a;
  if (h.getMonth() + 1 < m || (h.getMonth() + 1 === m && h.getDate() < d)) i -= 1;
  return i;
}

/**
 * Cartao da pessoa no topo das fichas de Motorista, Servidor e Fiscal
 * (desenho do Cesar, 26/10): iniciais, nome e situacao, matricula e CPF,
 * telefone e e-mail com icone; e quatro colunas com icone - Data de
 * nascimento (idade), Setor (equipe, no fiscal), Cargo / Funcao (condutor) e
 * CNH (categoria e validade). O desenho tinha "Vinculo / Efetivo desde": o
 * SITRA nao guarda tipo de vinculo nem data de admissao, entao essa coluna
 * virou a CNH, que o sistema tem.
 */
export function CartaoPessoa({ pessoa: p, cargo, equipe }) {
  const anos = idade(p.data_nascimento);
  const cnh = situacaoCnh(p);
  const Coluna = ({ icone, rotulo: r, valor, apoio, tomApoio }) => (
    <div className="pc-coluna">
      <span className="pc-coluna__icone"><Icone nome={icone} tamanho={18} /></span>
      <div className="pc-coluna__textos">
        <span className="pc-coluna__rotulo">{r}</span>
        <strong className="pc-coluna__valor">{valor}</strong>
        {apoio && <span className="pc-coluna__apoio" data-tom={tomApoio || undefined}>{apoio}</span>}
      </div>
    </div>
  );
  return (
    <section className="pc-cartao">
      <div className="pc-pessoa">
        <span className="pc-avatar" aria-hidden="true">{iniciais(p.nome)}</span>
        <div className="pc-pessoa__dados">
          <span className="pc-pessoa__nome">
            <strong>{p.nome}</strong>
            <Selo texto={p.status ? "Ativo" : "Inativo"} tom={p.status ? "verde" : "vermelho"} />
          </span>
          <span className="pc-pessoa__linha">
            Matrícula: <strong>{p.matricula}</strong>
            <span className="sd-sep">|</span>
            CPF: <strong>{mascaraCpf(p.cpf)}</strong>
          </span>
          <span className="pc-pessoa__contato">
            <span><Icone nome="telefone" tamanho={16} /> {vazio(mascaraTelefone(p.telefone))}</span>
            <span className="sd-sep">|</span>
            <span><Icone nome="email" tamanho={16} /> {vazio(p.email)}</span>
          </span>
        </div>
      </div>
      <Coluna icone="calendar" rotulo="Data de nascimento" valor={p.data_nascimento ? data(p.data_nascimento) : "—"}
              apoio={anos !== null ? `${anos} anos` : null} />
      <Coluna icone="organograma" rotulo="Setor" valor={vazio(p.setor)} apoio={equipe || null} />
      <Coluna icone="maleta" rotulo="Cargo / Função" valor={vazio(cargo)}
              apoio={`Condutor: ${p.condutor ? "Sim" : "Não"}`} />
      <Coluna icone="cnh" rotulo="CNH"
              valor={p.condutor || p.categoria_cnh ? `Categoria ${vazio(p.categoria_cnh)}` : "Não é condutor"}
              apoio={p.cnh_data_validade ? `${cnh.texto === "Válida" ? "Válida até" : cnh.texto + " ·"} ${data(p.cnh_data_validade)}` : null}
              tomApoio={cnh.tom} />
    </section>
  );
}

/** Rotulo + valor de uma coluna da faixa do topo. */
export function Item({ rotulo: r, children }) {
  return (
    <div className="vd-resumo__item">
      <span className="vd-resumo__rotulo">{r}</span>
      <span className="vd-resumo__valor">{children}</span>
    </div>
  );
}

export function Linhas({ linhas }) {
  return (
    <dl className="vd-dados__coluna">
      {linhas.map(([r, v]) => (
        <div className="vd-dados__linha" key={r}><dt>{r}</dt><dd>{v ?? "—"}</dd></div>
      ))}
    </dl>
  );
}

/** Tabela de uma lista (checklists, OS, sinistros) vinda da API do modulo. */
/*
 * Com `unidade` (aba Checklists, 26/10) a lista vem de 10 em 10 e ganha
 * embaixo o mesmo rodape das telas de lista: "Mostrando 1 a 10 de 31
 * checklists", o Exibir e as paginas. O `caminho` vem sem pagina/porPagina.
 */
// Exportada (26/10): a aba Checklists dos Detalhes do Veiculo usa a mesma lista.
export function Lista({ caminho, colunas, aoAbrir, vazio: textoVazio, unidade, ativo }) {
  const [linhas, setLinhas] = useState(null);
  const [erro, setErro] = useState("");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const [info, setInfo] = useState({ total: 0, paginas: 1 });
  useEffect(() => { setPagina(1); }, [caminho]);
  const endereco = unidade ? `${caminho}&pagina=${pagina}&porPagina=${porPagina}` : caminho;
  useEffect(() => {
    setLinhas(null);
    api(endereco)
      .then((r) => {
        setLinhas(Array.isArray(r) ? r : r.itens || []);
        if (!Array.isArray(r)) setInfo({ total: r.total || 0, paginas: r.paginas || 1 });
      })
      .catch((e) => setErro(e.message));
  }, [endereco]);
  if (erro) return <div className="vazio">{erro}</div>;
  if (!linhas) return <div className="carregando">Carregando...</div>;
  if (!linhas.length) return <p className="texto-corrido">{textoVazio}</p>;
  return (
    <>
    <div className="rolagem-x">
      <table className="tabela vd-tabela tabela-ficha">
        <thead><tr>{colunas.map((c) => <th key={c.rotulo}>{c.rotulo}</th>)}</tr></thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className="vd-tabela__linha" onClick={() => aoAbrir(l)}
                data-ativo={ativo && ativo(l) ? "sim" : undefined}>
              {colunas.map((c) => <td key={c.rotulo} className={c.classe}>{c.render(l)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {unidade && (
      <Paginacao pagina={pagina} setPagina={setPagina} porPagina={porPagina} setPorPagina={setPorPagina}
                 total={info.total} paginas={info.paginas} unidade={unidade} />
    )}
    </>
  );
}

/*
 * Aba Sinistros (26/10): a lista de sinistros do condutor e, ao clicar num
 * deles, um resumo no lado direito da tela com "Ver mais", que abre os
 * Detalhes do Sinistro com tudo o que aconteceu. A lista ja traz os campos do
 * sinistro, entao o resumo nao precisa de outra chamada.
 */
function SinistrosPessoa({ idServidor }) {
  // A lista e o resumo ao lado vem do ListaResumo (o mesmo padrao das abas do
  // veiculo); o botao do resumo diz para onde leva: "Abrir em Sinistros".
  const colunas = [
    { rotulo: "Nº do Sinistro", render: (x) => <strong>{vazio(x.numero)}</strong> },
    { rotulo: "Data", render: (x) => data(x.data) },
    { rotulo: "Veículo", render: (x) => (
      <span className="celula-dupla"><strong>{x.placa}</strong><span>{x.marca} {x.modelo}</span></span>
    ) },
    { rotulo: "Tipo", render: (x) => rotulo("tipoSinistro", x.tipo) },
    // Sem "coluna-flexivel": ela reserva mais da metade da tabela e, com a
    // lista na largura toda, sobrava um vao enorme no Local.
    { rotulo: "Local", render: (x) => (
      <span className="sd-local" title={x.local || ""}>{vazio(x.local)}</span>
    ) },
    { rotulo: "Situação", render: (x) => <Selo valor={x.status} /> },
  ];
  return (
    <ListaResumo
      titulo={<><Icone nome="sinistro" tamanho={18} /> Lista de Sinistros do Condutor</>}
      caminho={`/frotas/sinistros?servidor=${idServidor}`}
      colunas={colunas} chave={(x) => x.id_sinistro} unidade="sinistros"
      vazio="Nenhum sinistro registrado."
      resumo={(x) => resumoSinistro(x, { condutor: false })}
      abrir={{ rotulo: "Abrir em Sinistros", destino: (x) => `/frotas/sinistros/${x.id_sinistro}` }} />
  );
}

/*
 * Historico de renovacao da CNH (26/10): a CNH atual em cima e, embaixo, as
 * anteriores, guardadas pelo banco toda vez que a CNH e alterada (migracao
 * 049). Usado tambem nos Detalhes do Fiscal.
 */
export function HistoricoCnh({ pessoa: p }) {
  const atual = p.condutor && (p.cnh || p.cnh_data_validade)
    ? [{ chave: "atual", atual: true, ...p }] : [];
  const linhas = [...atual, ...(p.cnh_historico || []).map((h) => ({ chave: h.id_historico, ...h }))];
  return (
    <Cartao titulo={<><Icone nome="historico" tamanho={18} /> Histórico de renovação</>}>
      {linhas.length === 0 ? (
        <p className="texto-corrido">Nenhuma CNH registrada.</p>
      ) : (
        <div className="rolagem-x">
          <table className="tabela vd-tabela tabela-ficha">
            <thead>
              <tr><th>CNH</th><th>Categoria</th><th>Emissão</th><th>Validade</th><th>Substituída em</th></tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.chave}>
                  <td>
                    <span className="celula-dupla">
                      <strong>{vazio(l.cnh)}</strong>
                      <span>{l.atual ? "Atual" : "Anterior"}</span>
                    </span>
                  </td>
                  <td>{vazio(l.categoria_cnh)}</td>
                  <td>{l.cnh_data_emissao ? data(l.cnh_data_emissao) : "—"}</td>
                  <td>{l.cnh_data_validade ? data(l.cnh_data_validade) : "—"}</td>
                  <td>
                    {l.atual ? <Selo texto="Em uso" tom="verde" /> : (
                      <span className="celula-dupla">
                        <strong>{dataHora(l.substituida_em)}</strong>
                        {(l.motivo || l.alterado_por) && (
                          <span>{[l.motivo, l.alterado_por && `por ${l.alterado_por}`].filter(Boolean).join(" · ")}</span>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="vd2-nota" style={{ marginTop: 10 }}>
        Quando a CNH é alterada ou renovada, os dados da anterior ficam guardados aqui.
      </p>
    </Cartao>
  );
}

/** Historico de atividades: checklists, OS, sinistros e o cadastro. */
function Atividades({ itens, aoAbrir, compacto }) {
  if (!itens.length) return <p className="texto-corrido">Nenhuma atividade registrada.</p>;
  return (
    <div className="rolagem-x">
      <table className="tabela vd-tabela tabela-ficha">
        <thead><tr><th>Data / Hora</th><th>Tipo</th><th>Descrição</th>{!compacto && <th>Registrado por</th>}<th>Situação</th></tr></thead>
        <tbody>
          {itens.map((a, i) => {
            const o = ORIGEM[a.origem] || ORIGEM.CADASTRO;
            return (
              <tr key={i} className={o.rota ? "vd-tabela__linha" : undefined}
                  onClick={o.rota ? () => aoAbrir(a) : undefined}>
                <td>{dataHora(a.quando)}</td>
                <td><span className="vd-tipo" data-tom={o.tom}>{o.texto}</span></td>
                <td className="coluna-flexivel">
                  <span className="celula-cortada" title={a.descricao}>{primeiraLinha(a.descricao)}</span>
                </td>
                {!compacto && <td>{vazio(a.pessoa)}</td>}
                <td>{!a.status ? "—" : a.origem === "MULTA" ? <SeloMulta valor={a.status} /> : <Selo valor={a.status} />}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ServidorDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const { definirCabecalho } = useOutletContext();
  const { podeVer } = useSessao();
  const [s, setS] = useState(null);
  const [erro, setErro] = useState("");
  const [parametros, definirParametros] = useSearchParams();
  const aba = parametros.get("aba") || "geral";
  const setAba = (chave) => {
    const p = new URLSearchParams(parametros);
    if (chave === "geral") p.delete("aba"); else p.set("aba", chave);
    definirParametros(p, { replace: true });
    window.scrollTo({ top: 0 });
  };

  // De onde a pessoa veio: Motoristas (Frotas), Servidores (Frotas) ou
  // Servidores (Administracao). Define titulo, trilha, Voltar e Editar.
  const motorista = pathname.startsWith("/frotas/motoristas");
  const admin = pathname.startsWith("/admin");
  const base = motorista ? "/frotas/motoristas" : admin ? "/admin/servidores" : "/frotas/servidores";
  const nomeTela = motorista ? "Motorista" : "Servidor";
  const podeEditar = podeVer(motorista ? "FROTAS_GERENCIAR_SERVIDORES" : "ADMIN_GERENCIAR_SERVIDORES");
  // "Atualizar CNH" (26/10): quem gerencia servidores pelo Frotas ou pela
  // Administracao (a mesma regra da rota).
  const podeCnh = podeVer("FROTAS_GERENCIAR_SERVIDORES") || podeVer("ADMIN_GERENCIAR_SERVIDORES");
  const [atualizandoCnh, setAtualizandoCnh] = useState(false);

  useEffect(() => {
    definirCabecalho({ titulo: "", legenda: "" });
  }, [definirCabecalho]);

  // Editar abre a janela aqui mesmo (08/10); ao salvar, a ficha recarrega.
  const [editando, setEditando] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [periodo, setPeriodo] = useState({ de: "", ate: "" });
  useEffect(() => {
    api(`/frotas/servidores/${id}/ficha`).then(setS).catch((e) => setErro(e.message));
  }, [id, recarga]);

  if (erro) return <Cartao><div className="vazio">{erro}</div></Cartao>;
  if (!s) return <div className="carregando">Carregando...</div>;

  const r = s.resumo || {};
  // OS pedidas pela pessoa nao aparecem mais na ficha (08/10).
  const atividades = (s.atividades || []).filter((a) => a.origem !== "MANUTENCAO");
  const cnh = situacaoCnh(s);
  const cargo = s.cargo || s.cargo_funcao;
  const abrirAtividade = (a) => {
    const o = ORIGEM[a.origem];
    if (o?.rota) navegar(`${o.rota}/${a.id_registro}`);
  };

  const ABAS = [
    { chave: "geral", rotulo: "Visão Geral", icone: "user" },
    { chave: "cnh", rotulo: "CNH", icone: "cnh" },
    // Ordem pedida pelo Cesar (18/10).
    { chave: "multas", rotulo: "Multas", icone: "alert-triangle", total: r.multas },
    { chave: "checklists", rotulo: "Checklists", icone: "checklist", total: r.checklists },
    { chave: "sinistros", rotulo: "Sinistros", icone: "sinistro", total: r.sinistros },
    { chave: "historico", rotulo: "Histórico", icone: "historico" },
  ];

  // As mesmas colunas da tela Checklists (pedido do Cesar, 26/10). Sem a
  // coluna Condutor: aqui o condutor e sempre a propria pessoa da ficha.
  const COL_CHECKLIST = [
    { rotulo: "Enviado em", render: (c) => <strong>{dataHora(c.criado_em)}</strong> },
    { rotulo: "Placa / Veículo", render: (c) => (
      <span className="celula-dupla"><strong>{c.placa}</strong><span>{c.marca} {c.modelo}</span></span>
    ) },
    { rotulo: "Saída (hora / KM)", render: (c) => (
      <span className="celula-dupla"><strong>{hora(c.hora_saida)}</strong><span>{numero(c.odometro_saida)} km</span></span>
    ) },
    { rotulo: "Chegada (hora / KM)", render: (c) => (c.odometro_chegada === null || c.odometro_chegada === undefined ? "—" : (
      <span className="celula-dupla"><strong>{hora(c.hora_chegada)}</strong><span>{numero(c.odometro_chegada)} km</span></span>
    )) },
    { rotulo: "Fechado em", render: (c) => (!c.data_finalizacao
      ? <span className="texto-fraco">Em aberto</span>
      : <strong>{dataHora(c.data_finalizacao)}</strong>) },
    { rotulo: "KM rodado", render: (c) => (c.km_rodado === null || c.km_rodado === undefined ? "—" : `${numero(c.km_rodado)} km`) },
    { rotulo: "Equipamentos", render: (c) => <Equipamentos itens={c.equipamentos} /> },
    { rotulo: "Situação", render: (c) => <Selo valor={c.status} /> },
  ];
  // Card "Multas" da Visao Geral (26/10): as 5 ultimas; a linha abre a aba
  // Multas, onde ficam os Detalhes da multa.
  const COL_MULTA = [
    { rotulo: "Nº do auto", render: (m) => vazio(m.numero_auto) },
    { rotulo: "Data", render: (m) => data(m.data) },
    { rotulo: "Veículo", render: (m) => m.placa },
    { rotulo: "Gravidade", render: (m) => <SeloGravidade valor={m.gravidade} /> },
    { rotulo: "Valor", render: (m) => (m.valor !== null && m.valor !== undefined ? dinheiro(m.valor) : "—") },
    { rotulo: "Situação", render: (m) => <SeloMulta valor={m.status} /> },
  ];
  const COL_SINISTRO = [
    { rotulo: "Nº do Sinistro", render: (x) => vazio(x.numero) },
    { rotulo: "Data", render: (x) => data(x.data) },
    { rotulo: "Veículo", render: (x) => x.placa },
    { rotulo: "Tipo", render: (x) => rotulo("tipoSinistro", x.tipo) },
    { rotulo: "Situação", render: (x) => <Selo valor={x.status} /> },
  ];
  const caminho = (modulo, n) => `/frotas/${modulo}?servidor=${id}&porPagina=${n}`;
  // Periodo da aba Checklists (18/10): vai como filtro para a API.
  const caminhoChecklists = `/frotas/checklists?servidor=${id}${periodo.de ? `&dataDe=${periodo.de}` : ""}${periodo.ate ? `&dataAte=${periodo.ate}` : ""}`;
  const verTodos = (chave, total) => (
    <button className="botao botao--pequeno vd-cartao-acao" onClick={() => setAba(chave)}>
      Ver todos ({numero(total || 0)})
    </button>
  );

  const resumoCards = [
    { chave: "checklists", rotulo: "Checklists", valor: r.checklists_6m, icone: "checklist", tom: "verde" },
    { chave: "sinistros", rotulo: "Sinistros", valor: r.sinistros_6m, icone: "sinistro", tom: "vermelho" },
    { chave: "multas", rotulo: "Multas", valor: r.multas, icone: "alert-triangle", tom: "amarelo",
      // Uma frase por linha (26/10).
      rodape: [`${numero(r.multas_abertas || 0)} em aberto`, `${numero(r.pontos_12m || 0)} pts em 12 meses`] },
  ];

  return (
    <div className="ficha">
      <div className="cabecalho-pagina vd-cabecalho">
        <div>
          <Trilha
            itens={[
              { rotulo: admin ? "Administração" : "Frotas" },
              { rotulo: motorista ? "Motoristas" : "Servidores", para: base },
              { rotulo: `Detalhes do ${nomeTela}` },
            ]}
          />
          <div className="vd-titulo">
            <span className="vd-titulo__icone"><Icone nome={motorista ? "motorista" : "user"} tamanho={26} /></span>
            <div>
              <h1>Detalhes do {nomeTela}</h1>
              <p>Visualize todas as informações do {nomeTela.toLowerCase()}, incluindo dados pessoais, CNH, vinculação e histórico.</p>
            </div>
          </div>
        </div>
        <div className="cabecalho-pagina__acoes">
          <button className="botao" onClick={() => navegar(base)}>
            <Icone nome="seta-esquerda" tamanho={15} /> Voltar
          </button>
          {podeEditar && (
            <button className="botao" onClick={() => setEditando(true)}>
              <Icone nome="editar" tamanho={15} /> Editar
            </button>
          )}
        </div>
      </div>

      <CartaoPessoa pessoa={s} cargo={cargo} />

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
                ["Nome completo", s.nome],
                ["Matrícula", s.matricula],
                ["CPF", mascaraCpf(s.cpf)],
                ["Data de nascimento", s.data_nascimento ? data(s.data_nascimento) : null],
                ["Telefone", mascaraTelefone(s.telefone) || null],
                ["E-mail", s.email],
              ]} />
            </Cartao>

            <Cartao titulo={<><Icone nome="setores" tamanho={18} /> Vinculação</>}>
              <Linhas linhas={[
                ["Setor", s.setor],
                ["Cargo / Função", cargo],
                ["Condutor", s.condutor ? "Sim" : "Não"],
                ["Acesso ao sistema", s.usuario
                  ? <span className="celula-dupla sd-esquerda"><strong>{s.usuario.login}</strong><span>Perfil {s.usuario.perfil}</span></span>
                  : "Sem usuário"],
                ["Último acesso", s.usuario?.ultimo_acesso ? dataHora(s.usuario.ultimo_acesso) : null],
                ["Situação", <Selo texto={s.status ? "Ativo" : "Inativo"} tom={s.status ? "verde" : "vermelho"} />],
              ]} />
            </Cartao>

            <Cartao titulo={<><Icone nome="chart-line" tamanho={18} /> Resumo</>}>
              <div className="sd-resumo-cards">
                {resumoCards.map((c) => (
                  <button type="button" key={c.chave} className="sd-card" data-tom={c.tom} onClick={() => setAba(c.chave)}>
                    <Icone nome={c.icone} tamanho={24} />
                    <span>
                      <span className="sd-card__rotulo">{c.rotulo}</span>
                      <strong>{numero(c.valor || 0)}</strong>
                      {Array.isArray(c.rodape)
                        ? c.rodape.map((t) => <small key={t} className="sd-card__linha">{t}</small>)
                        : <small>{c.rodape || "Últimos 6 meses"}</small>}
                    </span>
                  </button>
                ))}
                <button type="button" className="sd-card" data-tom={s.condutor ? cnh.tom : "cinza"} onClick={() => setAba("cnh")}>
                  <Icone nome="cnh" tamanho={24} />
                  <span>
                    <span className="sd-card__rotulo">CNH</span>
                    <strong>{s.condutor && s.cnh ? (s.categoria_cnh || "—") : "—"}</strong>
                    <small>
                      {!s.condutor ? "Não é condutor"
                        : s.cnh_data_validade ? `${cnh.texto} · ${data(s.cnh_data_validade)}` : cnh.texto}
                    </small>
                  </span>
                </button>
              </div>
            </Cartao>
          </div>

          {/* Ordem pedida pelo Cesar (26/10): Ultimos Checklists | Ultimos
              Sinistros e, embaixo, Ultimas Multas | Historico de Atividades.
              Os Checklists ficam mais largos (todas as colunas da tela
              Checklists); em tela menor cada cartao ocupa a linha toda. */}
          <div className="ficha-2 sd-par sd-par--largo ficha-bloco">
            <Cartao className="sd-checklists" titulo={<><Icone nome="checklist" tamanho={18} /> Últimos Checklists</>}
                    acao={verTodos("checklists", r.checklists)}>
              <Lista caminho={caminho("checklists", 5)} colunas={COL_CHECKLIST}
                     vazio="Nenhum checklist registrado."
                     aoAbrir={(c) => navegar(`/frotas/checklists/${c.id_checklist}`)} />
            </Cartao>
            <Cartao titulo={<><Icone nome="sinistro" tamanho={18} /> Últimos Sinistros</>}
                    acao={verTodos("sinistros", r.sinistros)}>
              <Lista caminho={caminho("sinistros", 5)} colunas={COL_SINISTRO}
                     vazio="Nenhum sinistro registrado."
                     aoAbrir={(x) => navegar(`/frotas/sinistros/${x.id_sinistro}`)} />
            </Cartao>
          </div>

          <div className="ficha-2 sd-par ficha-bloco">
            <Cartao titulo={<><Icone nome="alert-triangle" tamanho={18} /> Últimas Multas</>}
                    acao={verTodos("multas", r.multas)}>
              <Lista caminho={`/frotas/multas?servidor=${id}&porPagina=5`} colunas={COL_MULTA}
                     vazio="Nenhuma multa registrada."
                     aoAbrir={() => setAba("multas")} />
            </Cartao>
            <Cartao titulo={<><Icone nome="historico" tamanho={18} /> Histórico de Atividades</>}
                    acao={(
                      <button className="botao botao--pequeno vd-cartao-acao" onClick={() => setAba("historico")}>
                        Ver todos ({numero(atividades.length)})
                      </button>
                    )}>
              <Atividades itens={atividades.slice(0, 5)} aoAbrir={abrirAtividade} compacto />
            </Cartao>
          </div>
        </>
      )}

      {/* Aba CNH (26/10): Informacoes da CNH, Historico de renovacao e Uso da
          frota. */}
      {aba === "cnh" && (
        <div className="sd-cnh ficha-bloco">
          <Cartao titulo={<><Icone nome="cnh" tamanho={18} /> Informações da CNH</>}
                  acao={podeCnh && (
                    <button className="botao botao--pequeno vd-cartao-acao" onClick={() => setAtualizandoCnh(true)}>
                      <Icone nome="editar" tamanho={14} /> Atualizar CNH
                    </button>
                  )}>
            {!s.condutor ? (
              <p className="texto-corrido">
                Este servidor não está cadastrado como condutor, por isso não tem CNH registrada.
              </p>
            ) : (
              <Linhas linhas={[
                ["Nº da CNH / registro", s.cnh],
                ["Categoria", s.categoria_cnh],
                ["Data de emissão", s.cnh_data_emissao ? data(s.cnh_data_emissao) : null],
                ["Data de validade", s.cnh_data_validade ? data(s.cnh_data_validade) : null],
                ["Situação", <Selo texto={cnh.texto} tom={cnh.tom} />],
              ]} />
            )}
          </Cartao>
          <HistoricoCnh pessoa={s} />
          <Cartao titulo={<><Icone nome="informacao" tamanho={18} /> Uso da frota</>}>
            <Linhas linhas={[
              ["Condutor", s.condutor ? "Sim" : "Não"],
              ["Veículo em uso agora", r.veiculo_em_uso || "Nenhum"],
              ["Último checklist", r.ultimo_checklist ? dataHora(r.ultimo_checklist) : null],
              ["Checklists (total)", numero(r.checklists || 0)],
              ["Sinistros como condutor", numero(r.sinistros || 0)],
              ["Pontos de multas (12 meses)", numero(r.pontos_12m || 0)],
            ]} />
            {s.condutor && (
              <p className="vd2-nota" style={{ marginTop: 10 }}>
                O aviso de CNH vencendo aparece no sino 30 dias antes da validade.
              </p>
            )}
          </Cartao>
        </div>
      )}

      {aba === "checklists" && (
        <Cartao className="sd-checklists" titulo={<><Icone nome="checklist" tamanho={18} /> Checklists
          <FiltroPeriodo id="periodo-checklists" de={periodo.de} ate={periodo.ate} aoMudar={setPeriodo} /></>}>
          <Lista caminho={caminhoChecklists} colunas={COL_CHECKLIST} unidade="checklists"
                 vazio="Nenhum checklist registrado."
                 aoAbrir={(c) => navegar(`/frotas/checklists/${c.id_checklist}`)} />
        </Cartao>
      )}

      {aba === "multas" && <MultasPessoa servidor={s} aoMudar={() => setRecarga((n) => n + 1)} />}

      {aba === "sinistros" && <SinistrosPessoa idServidor={id} />}

      {aba === "historico" && (
        <Cartao titulo={<><Icone nome="historico" tamanho={18} /> Histórico de Atividades</>}>
          <Atividades itens={atividades} aoAbrir={abrirAtividade} />
        </Cartao>
      )}

      {atualizandoCnh && (
        <AtualizarCnh pessoa={s} aoFechar={() => setAtualizandoCnh(false)}
                      aoSalvar={() => setRecarga((n) => n + 1)} />
      )}

      {editando && (
        <JanelaCadastro config={CONFIG_SERVIDOR} id={id}
                        aoFechar={() => setEditando(false)}
                        aoSalvar={() => setRecarga((n) => n + 1)} />
      )}
    </div>
  );
}
