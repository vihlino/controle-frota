/**
 * InspecaoDetalhe.jsx - Detalhes da Inspecao.
 *
 * Desenho pedido pelo Cesar (01/10), no mesmo padrao dos Detalhes do Veiculo:
 * cabecalho com icone, faixa de resumo, abas (Visao geral, Itens da inspecao,
 * Manutencao, Historico). Fica de fora o que o SITRA nao tem: foto do
 * veiculo, fotos da inspecao, rota/percurso e ocorrencias (essas so existem
 * na Fiscalizacao).
 *
 * Os itens sao os combinados por frequencia (lib/itensInspecao.js: semanal 14,
 * demais 21) e as opcoes sao Conforme, Atencao e Nao conforme. Inspecao ainda
 * pendente mostra a lista que vai ser conferida, como "Aguardando".
 *
 * A analise da gestao continua aqui: Abrir OS (mesma janela do Registrar OS,
 * ja preenchida com os itens com ressalva) ou Concluir sem OS.
 *
 * 29/10 (desenho do Cesar): faixa do veiculo com a foto (FaixaVeiculo);
 * grupos com icone e seta para a aba Itens; a aba Itens com barra de
 * progresso, contagem e cada grupo numa tabela que abre e fecha; a
 * "Manutencao Relacionada" foi para a direita da Visao Geral; a aba
 * Manutencao e a mesma tela da aba Manutencoes do veiculo, so com as OS desta
 * inspecao.
 */
import { useEffect, useState } from "react";
import { useOutletContext, useParams, useNavigate, useSearchParams } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import Selo from "../../components/Selo.jsx";
import Modal from "../../components/Modal.jsx";
import EditarInspecao from "../../components/EditarInspecao.jsx";
import AgendarInspecao from "../../components/AgendarInspecao.jsx";
import RegistrarOs from "../../components/RegistrarOs.jsx";
import FaixaVeiculo from "../../components/FaixaVeiculo.jsx";
import { AbaManutencoesVeiculo } from "../../components/AbasVeiculo.jsx";
import { api } from "../../lib/api.js";
import { data, dataHora, hora, numero, numeroOs, rotulo, ROTULOS } from "../../lib/formato.js";
import { gruposDaInspecao } from "../../lib/itensInspecao.js";
import { useSessao } from "../../lib/sessao.jsx";

const NOME_RESULTADO = { ATENCAO: "Atenção", AVARIA: "Não conforme" };
const FREQUENCIA = {
  SEMANAL: "Semanal", QUINZENAL: "Quinzenal", MENSAL: "Mensal",
  PERSONALIZADA: "Personalizada", SEM_PERIODICIDADE: "Sem periodicidade",
};
const vazio = (v) => (v === null || v === undefined || v === "" ? "—" : v);

/* Texto inicial da OS: cada item com ressalva, com o que o responsavel escreveu. */
function descricaoDaOs(itens) {
  return itens
    .filter((i) => i.resultado !== "NORMAL")
    .map((i) => `${i.item} (${NOME_RESULTADO[i.resultado] || i.resultado}): ${i.observacao || "sem observação"}`)
    .join("\n");
}

/** Minutos entre duas horas do mesmo dia ("07:09:00" -> "11:24:00"). */
function duracao(inicio, fim) {
  if (!inicio || !fim) return null;
  const min = (h) => { const [a, b] = String(h).split(":").map(Number); return a * 60 + b; };
  const total = min(fim) - min(inicio);
  if (total < 0) return null;
  if (total < 60) return `${total} minuto${total === 1 ? "" : "s"}`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h} h${m ? ` ${m} min` : ""}`;
}

function Item({ rotulo: r, children }) {
  return (
    <div className="vd-resumo__item">
      <span className="vd-resumo__rotulo">{r}</span>
      <span className="vd-resumo__valor">{children}</span>
    </div>
  );
}




/* ---------- Itens da Inspecao: um quadro por grupo (escolha do Cesar, 06/10) ---------- */
const STATUS_ITEM = {
  NORMAL: { texto: "Conforme", tom: "verde", marca: "✓" },
  ATENCAO: { texto: "Atenção", tom: "amarelo", marca: "!" },
  AVARIA: { texto: "Não conforme", tom: "vermelho", marca: "✕" },
};
function StatusItem({ resultado }) {
  const st = STATUS_ITEM[resultado] || { texto: "Aguardando", tom: "cinza", marca: "–" };
  return <span className="ck-status" data-tom={st.tom}><span className="ck-status__ponto">{st.marca}</span> {st.texto}</span>;
}
function agrupar(itens) {
  const grupos = [];
  for (const it of itens) {
    const g = grupos.find((x) => x.grupo === (it.grupo || "Itens"));
    if (g) g.itens.push(it); else grupos.push({ grupo: it.grupo || "Itens", itens: [it] });
  }
  return grupos;
}
/** Icone de cada grupo de itens (desenho de 29/10). */
const ICONE_GRUPO = {
  "Níveis de fluidos (com o motor frio)": "aviso-oleo",
  "Pneus e rodas": "pneu",
  "Sistema elétrico e iluminação": "lampada",
  "Visibilidade e itens de emergência": "alert-triangle",
  "Conservação e higiene": "limpeza",
  "Testes dinâmicos e interior": "kpi-steering",
};
const iconeGrupo = (g) => ICONE_GRUPO[g] || (/flu/i.test(g) ? "aviso-oleo" : /pneu/i.test(g) ? "pneu" : "checklist");

function SeloGrupo({ itens }) {
  const ressalvas = itens.filter((it) => it.resultado && it.resultado !== "NORMAL").length;
  if (ressalvas) return <Selo texto={`${ressalvas} com ressalva`} tom="amarelo" />;
  return itens[0]?.resultado ? <Selo texto="Tudo conforme" tom="verde" /> : <Selo texto="Aguardando" tom="cinza" />;
}

/** Visao Geral: um quadro por grupo, com o icone, a situacao e a seta para a aba. */
function ItensGrupos({ itens, aoAbrir }) {
  return (
    <div className="insp-grupos">
      {agrupar(itens).map((g) => (
        <section className="insp-grupo" key={g.grupo}>
          <header>
            <strong className="insp-grupo__titulo"><Icone nome={iconeGrupo(g.grupo)} tamanho={18} /> {g.grupo}</strong>
            <span className="insp-grupo__lado">
              <SeloGrupo itens={g.itens} />
              {aoAbrir && (
                <button type="button" className="insp-grupo__ir" aria-label={`Ver ${g.grupo}`} onClick={aoAbrir}>
                  <Icone nome="chevron-right" tamanho={14} />
                </button>
              )}
            </span>
          </header>
          <ul>
            {g.itens.map((it) => (
              <li key={it.item} data-tom={STATUS_ITEM[it.resultado]?.tom || "cinza"}>
                <span className="insp-grupo__marca">{STATUS_ITEM[it.resultado]?.marca || "–"}</span>
                <div>
                  <span>{it.item}</span>
                  {it.resultado && it.resultado !== "NORMAL" && (
                    <em>{STATUS_ITEM[it.resultado].texto}{it.observacao ? ` — ${it.observacao}` : ""}</em>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Aba Itens: cada grupo num quadro que abre e fecha, com a tabela dos itens. */
function ItensTabelas({ itens, abertos, alternar }) {
  return (
    <div className="insp-grupos insp-grupos--tabela">
      {agrupar(itens).map((g) => {
        const aberto = abertos[g.grupo] !== false;
        return (
          <section className="insp-grupo insp-grupo--tabela" key={g.grupo}>
            <header>
              <button type="button" className="insp-grupo__cabeca" aria-expanded={aberto} onClick={() => alternar(g.grupo)}>
                <strong className="insp-grupo__titulo"><Icone nome={iconeGrupo(g.grupo)} tamanho={18} /> {g.grupo}</strong>
                <span className="insp-grupo__lado">
                  <SeloGrupo itens={g.itens} />
                  <small>{g.itens.length} {g.itens.length === 1 ? "item" : "itens"}</small>
                  <span className="insp-grupo__seta" data-aberto={aberto ? "sim" : undefined}><Icone nome="chevron-down" tamanho={14} /></span>
                </span>
              </button>
            </header>
            {aberto && (
              <table className="tabela insp-tabela">
                <thead><tr><th>#</th><th>Item</th><th>Status</th><th>Observação</th></tr></thead>
                <tbody>
                  {g.itens.map((it, n) => (
                    <tr key={it.item}>
                      <td>{n + 1}</td>
                      <td>{it.item}</td>
                      <td><StatusItem resultado={it.resultado} /></td>
                      <td className="insp-tabela__obs">{vazio(it.observacao)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </div>
  );
}

export default function InspecaoDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const { podeVer } = useSessao();
  const [inspecao, setInspecao] = useState(null);
  const [itens, setItens] = useState([]);
  const [erro, setErro] = useState("");
  const [recarga, setRecarga] = useState(0);
  const [parametros, definirParametros] = useSearchParams();
  const aba = parametros.get("aba") || "geral";
  const setAba = (chave) => {
    const p = new URLSearchParams(parametros);
    if (chave === "geral") p.delete("aba"); else p.set("aba", chave);
    definirParametros(p, { replace: true });
  };

  const [corrigindo, setCorrigindo] = useState(false);
  const [reagendando, setReagendando] = useState(false);
  const [veiculo, setVeiculo] = useState(null);
  const [abertos, setAbertos] = useState({});
  const [abrindoOs, setAbrindoOs] = useState(null);
  const [analisando, setAnalisando] = useState(null);
  const [erroJanela, setErroJanela] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    definirCabecalho({ titulo: "", legenda: "" });
  }, [definirCabecalho]);

  useEffect(() => {
    api(`/frotas/inspecoes/${id}`).then(setInspecao).catch((e) => setErro(e.message));
    api(`/frotas/inspecoes/${id}/itens`).then((r) => setItens(Array.isArray(r) ? r : [])).catch(() => {});
  }, [id, recarga]);

  // Veiculo (foto e situacao) para a faixa do topo.
  const idVeiculo = inspecao?.id_veiculo;
  useEffect(() => {
    if (!idVeiculo) return;
    api(`/frotas/veiculos/${idVeiculo}`).then(setVeiculo).catch(() => {});
  }, [idVeiculo]);

  const recarregar = () => setRecarga((n) => n + 1);

  function abrirOs() {
    const comRessalva = itens.filter((i) => i.resultado !== "NORMAL");
    setAbrindoOs({
      tipo: "CORRETIVA",
      gravidade: comRessalva.some((i) => i.resultado === "AVARIA") ? "ALTA" : "MEDIA",
      descricao: descricaoDaOs(itens),
      itens: comRessalva.map((i) => ({
        descricao: i.item,
        observacao: `${NOME_RESULTADO[i.resultado] || i.resultado}: ${i.observacao || "sem observação"}`,
      })),
    });
  }

  async function enviarAnalise(e) {
    e.preventDefault();
    setEnviando(true);
    setErroJanela("");
    try {
      await api(`/frotas/inspecoes/${id}/analise`, { method: "POST", body: { observacao: analisando } });
      setAnalisando(null);
      recarregar();
    } catch (err) {
      setErroJanela(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (erro) return <Cartao><div className="vazio">{erro}</div></Cartao>;
  if (!inspecao) return <div className="carregando">Carregando a inspeção...</div>;

  const i = inspecao;
  const pendente = i.status === "ABERTA";
  const ordens = i.ordens_servico || [];
  const osAbertas = ordens.filter((o) => !["RESOLVIDA", "CANCELADA"].includes(o.status));

  // Pendente: a lista combinada para a frequencia, ainda sem resultado.
  // Pendente mostra a lista combinada como "Aguardando", mesmo que exista
  // alguma linha gravada antes da hora.
  const linhas = itens.length && !pendente
    ? itens
    : gruposDaInspecao(i.tipo).flatMap((g) => g.itens.map((item) => ({ item, grupo: g.grupo, resultado: null })));
  const contagem = {
    NORMAL: itens.filter((x) => x.resultado === "NORMAL").length,
    ATENCAO: itens.filter((x) => x.resultado === "ATENCAO").length,
    AVARIA: itens.filter((x) => x.resultado === "AVARIA").length,
  };
  const comRessalva = itens.filter((x) => x.resultado !== "NORMAL");

  const podeOs = podeVer("FROTAS_GERENCIAR_OS");
  const podeInspecao = podeVer("FROTAS_REALIZAR_INSPECAO");
  const mostraAbrirOs = !pendente && i.analise !== "APROVADO" && podeOs && ordens.length === 0;
  const mostraConcluir = !pendente && i.analise === "EM_ANALISE" && podeInspecao;
  const editar = () => (pendente ? setReagendando(true) : setCorrigindo(true));

  // Quadro colorido do "Status da Inspecao".
  const quadro = pendente
    ? { tom: "amarelo", icone: "calendar", titulo: "Pendente",
        texto: i.data_programada ? `Agendada para ${data(i.data_programada)}.` : "Aguardando ser realizada pelo QR Code." }
    : {
        EM_ANALISE: { tom: "amarelo", icone: "alert-triangle", titulo: "Em análise",
          texto: `${i.itens_com_ressalva} ${i.itens_com_ressalva === 1 ? "item" : "itens"} com ressalva: abra uma OS ou conclua a análise.` },
        ANALISADO: { tom: "azul", icone: "check", titulo: "Analisado",
          texto: osAbertas.length ? "Aguardando o fechamento da OS para ser aprovada." : "Análise concluída pela gestão." },
        APROVADO: { tom: "verde", icone: "check", titulo: "Aprovado",
          texto: i.aprovada_em ? "Aprovada com o fechamento da OS de manutenção." : "Inspeção realizada sem ressalvas." },
      }[i.analise] || { tom: "verde", icone: "check", titulo: "Concluída", texto: "" };

  const ABAS = [
    { chave: "geral", rotulo: "Visão Geral", icone: "inspecao" },
    { chave: "itens", rotulo: "Itens da Inspeção", icone: "checklist", total: linhas.length },
    { chave: "manutencao", rotulo: "Manutenção", icone: "kpi-wrench", total: ordens.length || undefined },
    { chave: "historico", rotulo: "Histórico", icone: "historico" },
  ];

  const historico = [
    i.data_programada && { tom: "azul", titulo: "Inspeção agendada", quando: data(i.data_programada) },
    !pendente && { tom: "verde", titulo: "Inspeção realizada pelo QR Code",
      quando: `${data(i.data_realizacao)} ${hora(i.hora_inicio)}`, quem: i.responsavel },
    !pendente && i.hora_finalizacao && { tom: "verde", titulo: "Inspeção concluída",
      quando: `${data(i.data_realizacao)} ${hora(i.hora_finalizacao)}` },
    !pendente && i.itens_com_ressalva > 0 && { tom: "amarelo", titulo: `${i.itens_com_ressalva} ${i.itens_com_ressalva === 1 ? "item" : "itens"} com ressalva — em análise` },
    ...ordens.map((o) => ({ tom: "amarelo", titulo: `${numeroOs(o.numero)} aberta`, quando: dataHora(o.data_abertura) })),
    i.analisada_em && { tom: "azul", titulo: "Análise concluída", quando: dataHora(i.analisada_em),
      quem: i.analisada_por_nome, texto: i.analise_observacao },
    ...ordens.filter((o) => o.status === "RESOLVIDA").map((o) => ({
      tom: "verde", titulo: `${numeroOs(o.numero)} fechada`, quando: data(o.data_fechamento) })),
    i.aprovada_em && { tom: "verde", titulo: "Inspeção aprovada", quando: dataHora(i.aprovada_em) },
    i.proxima_inspecao && { tom: "cinza", titulo: "Próxima inspeção prevista", quando: data(i.proxima_inspecao) },
  ].filter(Boolean);

  return (
    <div className="ficha">
      <div className="cabecalho-pagina vd-cabecalho">
        <div>
          <Trilha
            itens={[
              { rotulo: "Frotas" },
              { rotulo: "Inspeções", para: "/frotas/inspecoes" },
              { rotulo: "Detalhes da Inspeção" },
            ]}
          />
          <div className="vd-titulo">
            <span className="vd-titulo__icone"><Icone nome="inspecao" tamanho={26} /></span>
            <div>
              <h1>Detalhes da Inspeção</h1>
              <p>Visualize todas as informações desta inspeção realizada via QR Code.</p>
            </div>
          </div>
        </div>
        <div className="cabecalho-pagina__acoes esconder-impressao">
          <button className="botao" onClick={() => navegar("/frotas/inspecoes")}>
            <Icone nome="seta-esquerda" tamanho={15} /> Voltar
          </button>
          {podeInspecao && (
            <button className="botao" onClick={editar}>
              <Icone nome="editar" tamanho={15} /> Editar
            </button>
          )}
        </div>
      </div>

      <FaixaVeiculo
        v={veiculo ? { ...veiculo, veiculo_status: veiculo.status } : { id_veiculo: i.id_veiculo, placa: i.placa, marca: i.marca, modelo: i.modelo,
          tipo_veiculo: i.tipo_veiculo, tipo_combustivel: i.tipo_combustivel, ano_fabricacao: i.ano_fabricacao, ano_modelo: i.ano_modelo }}
        dados={[
          { icone: "checklist", rotulo: "Nº da inspeção", valor: vazio(i.numero), apoio: `Setor: ${vazio(i.setor)}` },
          { icone: "user", rotulo: "Responsável", valor: vazio(i.responsavel), apoio: i.responsavel_matricula ? `Matrícula: ${i.responsavel_matricula}` : null },
          { icone: "calendar", rotulo: pendente ? "Agendada para" : "Data da inspeção",
            valor: data(pendente ? i.data_programada : i.data_realizacao), apoio: pendente ? null : hora(i.hora_inicio) },
          { icone: "calendario-check", rotulo: "Frequência", valor: <Selo texto={FREQUENCIA[i.tipo] || i.tipo} tom="azul" /> },
          { icone: "concluidas", rotulo: "Status", valor: <Selo texto={quadro.titulo} tom={quadro.tom} /> },
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
        <div className="vd-corpo">
          <div className="vd-corpo__principal">
            <div className="insp-linha">
              <Cartao titulo={<><Icone nome="informacao" tamanho={18} /> Informações da Inspeção</>}>
                <dl className="vd-dados__coluna">
                  {[
                    ["Nº da inspeção", i.numero],
                    ["Frequência", FREQUENCIA[i.tipo] || i.tipo],
                    ["Agendada para", i.data_programada ? data(i.data_programada) : null],
                    ["Data e hora", pendente ? null : `${data(i.data_realizacao)} ${hora(i.hora_inicio)}`],
                    [pendente ? "Responsável" : "Realizada por", i.responsavel
                      ? `${i.responsavel}${i.responsavel_matricula ? ` (Matrícula ${i.responsavel_matricula})` : ""}` : null],
                    ["Próxima inspeção", i.proxima_inspecao ? data(i.proxima_inspecao) : null],
                  ].map(([r, v]) => (
                    <div className="vd-dados__linha" key={r}><dt>{r}</dt><dd>{vazio(v)}</dd></div>
                  ))}
                </dl>
              </Cartao>
              <Cartao titulo={<><Icone nome="kpi-car" tamanho={18} /> Odômetro</>}>
                <dl className="vd-controle">
                  <div className="vd-controle__linha">
                    <dt>KM na inspeção</dt>
                    <dd>{i.quilometragem ? `${numero(i.quilometragem)} km` : "—"}</dd>
                  </div>
                  <div className="vd-controle__linha">
                    <dt>KM atual do veículo</dt>
                    <dd>{`${numero(i.km_atual_veiculo)} km`}</dd>
                  </div>
                </dl>
                <div className="insp-nota insp-nota--pequena">
                  <Icone nome="informacao" tamanho={14} />
                  <span>O KM é informado pelo responsável ao fazer a inspeção pelo QR Code.</span>
                </div>
              </Cartao>
            </div>

            <Cartao
              titulo={<><Icone nome="checklist" tamanho={18} /> Itens da Inspeção</>}
              acao={(
                <span className="insp-topo-itens vd-cartao-acao">
                  {!pendente && (
                    <span className="insp-contagem">
                      <span className="insp-contagem__item" data-tom="verde"><strong>{contagem.NORMAL}</strong> Conforme</span>
                      <span className="insp-contagem__item" data-tom="amarelo"><strong>{contagem.ATENCAO}</strong> Atenção</span>
                      <span className="insp-contagem__item" data-tom="vermelho"><strong>{contagem.AVARIA}</strong> Não conforme</span>
                    </span>
                  )}
                  <span className="vd2-nota">{FREQUENCIA[i.tipo] === "Semanal" ? "Lista semanal" : "Lista completa"} · {linhas.length} itens</span>
                </span>
              )}
            >
              {pendente ? (
                <div className="insp-nota">
                  <Icone nome="informacao" tamanho={16} />
                  <span>
                    Inspeção ainda não realizada. Serão conferidos {linhas.length} itens
                    ({FREQUENCIA[i.tipo] === "Semanal" ? "lista semanal" : "lista completa"}), cada um como
                    Conforme, Atenção ou Não conforme.
                  </span>
                </div>
              ) : (
                <ItensGrupos itens={itens} aoAbrir={() => setAba("itens")} />
              )}
            </Cartao>
          </div>

          <div className="vd-corpo__lado">
            <Cartao titulo={<><Icone nome="check" tamanho={18} /> Status da Inspeção</>}>
              <div className="vd-situacao" data-tom={quadro.tom}>
                <span className="vd-situacao__icone"><Icone nome={quadro.icone} tamanho={22} /></span>
                <div>
                  <strong>{quadro.titulo}</strong>
                  {quadro.texto && <span>{quadro.texto}</span>}
                </div>
              </div>
              {!pendente && (
                <div className="insp-tempos">
                  <Item rotulo="Início">{`${data(i.data_realizacao)} ${hora(i.hora_inicio)}`}</Item>
                  <Item rotulo="Conclusão">{i.hora_finalizacao ? `${data(i.data_realizacao)} ${hora(i.hora_finalizacao)}` : "—"}</Item>
                  <Item rotulo="Duração">{vazio(duracao(i.hora_inicio, i.hora_finalizacao))}</Item>
                  <Item rotulo="Itens com ressalva">{numero(i.itens_com_ressalva || 0)}</Item>
                </div>
              )}
              {i.analisada_em && (
                <p className="insp-analise">
                  Analisada por <strong>{vazio(i.analisada_por_nome)}</strong> em {dataHora(i.analisada_em)}.
                </p>
              )}
            </Cartao>

            {(
              <Cartao titulo={<><Icone nome="fisc-bolt" tamanho={18} /> Ações</>}>
                <div className="vd-acoes">
                  {mostraAbrirOs && i.itens_com_ressalva > 0 && (
                    <button type="button" className="vd-acoes__item" onClick={abrirOs}>
                      <Icone nome="kpi-wrench" tamanho={18} />
                      <span className="vd-acoes__rotulo">Abrir OS</span>
                      <Icone nome="chevron-right" tamanho={14} />
                    </button>
                  )}
                  {mostraConcluir && (
                    <button type="button" className="vd-acoes__item"
                            onClick={() => { setErroJanela(""); setAnalisando(""); }}>
                      <Icone nome="check" tamanho={18} />
                      <span className="vd-acoes__rotulo">Concluir análise sem OS</span>
                      <Icone nome="chevron-right" tamanho={14} />
                    </button>
                  )}
                  {podeInspecao && (
                    <button type="button" className="vd-acoes__item" onClick={editar}>
                      <Icone nome="editar" tamanho={18} />
                      <span className="vd-acoes__rotulo">{pendente ? "Reagendar inspeção" : "Corrigir itens da inspeção"}</span>
                      <Icone nome="chevron-right" tamanho={14} />
                    </button>
                  )}
                  <button type="button" className="vd-acoes__item"
                          onClick={() => navegar(`/frotas/veiculos/${i.id_veiculo}`)}>
                    <Icone nome="kpi-car" tamanho={18} />
                    <span className="vd-acoes__rotulo">Ver veículo</span>
                    <Icone nome="chevron-right" tamanho={14} />
                  </button>
                  <button type="button" className="vd-acoes__item" onClick={() => window.print()}>
                    <Icone nome="imprimir" tamanho={18} />
                    <span className="vd-acoes__rotulo">Imprimir inspeção</span>
                    <Icone nome="chevron-right" tamanho={14} />
                  </button>
                </div>
              </Cartao>
            )}

            <Cartao titulo={<><Icone nome="documento" tamanho={18} /> Observações do Responsável</>}>
              <p className="texto-corrido texto-quebra insp-observacao">
                {i.observacoes || "Nenhuma observação registrada."}
              </p>
            </Cartao>

            <Cartao titulo={<><Icone nome="kpi-wrench" tamanho={18} /> Manutenção Relacionada</>}>
              {ordens.length === 0 ? (
                <p className="pck-vazio">
                  {pendente ? "A inspeção ainda não foi realizada."
                    : i.itens_com_ressalva ? "Nenhuma OS aberta para esta inspeção." : "Nenhum item com ressalva: não há manutenção a abrir."}
                  {i.analise === "ANALISADO" && i.analise_observacao && <> Decisão da gestão: {i.analise_observacao}</>}
                </p>
              ) : (
                <table className="tabela ck2-ultimos insp-os">
                  <thead><tr><th>Nº da OS</th><th>Aberta em</th><th>Descrição</th><th>Situação</th></tr></thead>
                  <tbody>
                    {ordens.slice(0, 4).map((o) => (
                      <tr key={o.id_os} onClick={() => navegar(`/frotas/manutencoes/${o.id_os}`)}>
                        <td className="dd-nowrap">{numeroOs(o.numero)}</td>
                        <td>{data(o.data_abertura)}</td>
                        <td><span className="insp-os__desc" title={o.descricao || ""}>{String(o.descricao || "—").split("\n")[0]}</span></td>
                        <td><Selo valor={o.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <button type="button" className="lr-abrir" onClick={() => setAba("manutencao")}>
                Ver todas as manutenções <Icone nome="seta-direita" tamanho={13} monocromatico />
              </button>
            </Cartao>
          </div>
        </div>
      )}

      {aba === "itens" && (
        <section className="cartao insp-itens">
          <header className="dd-titulo">
            <Icone nome="checklist" tamanho={22} />
            <div>
              <h2>Itens da Inspeção ({linhas.length} itens)</h2>
              <p>{pendente ? "A lista que o responsável vai conferir pelo QR Code, organizada por categoria." : "Itens verificados nesta inspeção, organizados por categoria."}</p>
            </div>
            <span className="insp-resumo-itens">
              {!pendente && (
                <>
                  <span className="insp-progresso">
                    <span className="insp-progresso__barra"><span style={{ width: `${Math.round((contagem.NORMAL / Math.max(1, itens.length)) * 100)}%` }} /></span>
                    <small>{contagem.NORMAL} de {itens.length} itens conformes ({Math.round((contagem.NORMAL / Math.max(1, itens.length)) * 100)}%)</small>
                  </span>
                  <span className="insp-caixa" data-tom="verde"><Icone nome="check" tamanho={18} /><span><strong>{contagem.NORMAL}</strong>Conforme</span></span>
                  <span className="insp-caixa" data-tom="amarelo"><Icone nome="alert-triangle" tamanho={18} /><span><strong>{contagem.ATENCAO}</strong>Atenção</span></span>
                  <span className="insp-caixa" data-tom="vermelho"><Icone nome="alert-triangle" tamanho={18} /><span><strong>{contagem.AVARIA}</strong>Não conforme</span></span>
                </>
              )}
              <button type="button" className="botao botao--pequeno" onClick={() => {
                const todosAbertos = agrupar(linhas).every((g) => abertos[g.grupo] !== false);
                setAbertos(Object.fromEntries(agrupar(linhas).map((g) => [g.grupo, !todosAbertos])));
              }}>
                <Icone nome="chevron-down" tamanho={13} /> {agrupar(linhas).every((g) => abertos[g.grupo] !== false) ? "Recolher todos" : "Expandir todos"}
              </button>
            </span>
          </header>
          {pendente && (
            <div className="insp-nota">
              <Icone nome="informacao" tamanho={16} />
              <span>Inspeção ainda não realizada: cada item será marcado como Conforme, Atenção ou Não conforme.</span>
            </div>
          )}
          <ItensTabelas itens={linhas} abertos={abertos}
                        alternar={(g) => setAbertos((x) => ({ ...x, [g]: x[g] === false }))} />
        </section>
      )}

      {/* Mesma tela da aba Manutencoes do veiculo (29/10), so com as OS desta
          inspecao; a OS nova sai ja preenchida com os itens com ressalva. */}
      {aba === "manutencao" && (
        <AbaManutencoesVeiculo key={`os-${recarga}`} veiculo={veiculo ? { ...veiculo } : { id_veiculo: i.id_veiculo, placa: i.placa, marca: i.marca, modelo: i.modelo, setor: i.setor }}
          podeGerenciar={podeOs} podeNovo={!pendente && i.analise !== "APROVADO"} aoNovo={abrirOs} semMenu aoMudar={recarregar}
          caminho={`/frotas/manutencoes?origem=INSPECAO&registroOrigem=${i.id_inspecao}`}
          vazio={pendente ? "A inspeção ainda não foi realizada." : i.itens_com_ressalva ? "Nenhuma OS aberta para esta inspeção." : "Nenhum item com ressalva: não há manutenção a abrir."} />
      )}

      {aba === "historico" && (
        <Cartao titulo="Histórico da inspeção">
          <ol className="linha-tempo">
            {historico.map((h, n) => (
              <li key={n}>
                <span className="linha-tempo__ponto" data-tom={h.tom} />
                <div>
                  <strong>{h.titulo}</strong>
                  {(h.quando || h.quem) && <span>{[h.quando, h.quem].filter(Boolean).join(" - ")}</span>}
                  {h.texto && <span className="insp-historico__texto">{h.texto}</span>}
                </div>
              </li>
            ))}
          </ol>
        </Cartao>
      )}

      {reagendando && (
        <AgendarInspecao inspecao={i} travarVeiculo aoFechar={() => setReagendando(false)} aoSalvar={recarregar} />
      )}

      {corrigindo && (
        <EditarInspecao inspecao={i} aoFechar={() => setCorrigindo(false)} aoSalvar={recarregar} />
      )}

      {abrindoOs && (
        <RegistrarOs
          inspecao={{ id: i.id_inspecao, numero: i.numero, id_veiculo: i.id_veiculo }}
          inicial={abrindoOs}
          aoFechar={() => setAbrindoOs(null)}
          aoSalvar={recarregar}
        />
      )}

      {analisando !== null && (
        <Modal
          titulo="Concluir análise"
          largura={480}
          compacto
          aoFechar={() => setAnalisando(null)}
          rodape={
            <>
              <button className="botao" onClick={() => setAnalisando(null)}>Cancelar</button>
              <button className="botao botao--primario" form="form-analise" disabled={enviando}>
                {enviando ? "Salvando..." : "Concluir análise"}
              </button>
            </>
          }
        >
          <form id="form-analise" className="confirmar-senha" onSubmit={enviarAnalise}>
            <p className="confirmar-senha__texto confirmar-senha__texto--nota">
              A inspeção passa para "Analisado", com o seu nome e o que foi decidido.
            </p>
            {erroJanela && <div className="login__erro">{erroJanela}</div>}
            <div className="campo">
              <label htmlFor="analise-texto">O que foi decidido *</label>
              <textarea id="analise-texto" rows={3} required minLength={5} autoFocus
                        placeholder="Ex.: óleo completado na garagem; não precisa de OS"
                        value={analisando}
                        onChange={(e) => setAnalisando(e.target.value)} />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
