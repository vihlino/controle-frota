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
 */
import { useEffect, useState } from "react";
import { useOutletContext, useParams, useNavigate, useSearchParams } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import Selo from "../../components/Selo.jsx";
import Modal from "../../components/Modal.jsx";
import EditarInspecao from "../../components/EditarInspecao.jsx";
import RegistrarOs from "../../components/RegistrarOs.jsx";
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
/** Um quadro por grupo, lado a lado, com o aviso de ressalva no topo de cada um. */
function ItensGrupos({ itens }) {
  return (
    <div className="insp-grupos">
      {agrupar(itens).map((g) => {
        const ressalvas = g.itens.filter((it) => it.resultado && it.resultado !== "NORMAL").length;
        return (
          <section className="insp-grupo" key={g.grupo}>
            <header>
              <strong>{g.grupo}</strong>
              {ressalvas ? <Selo texto={`${ressalvas} com ressalva`} tom="amarelo" />
                : g.itens[0]?.resultado ? <Selo texto="Tudo conforme" tom="verde" /> : <Selo texto="Aguardando" tom="cinza" />}
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
  const editar = () => (pendente ? navegar(`/frotas/inspecoes?editar=${i.id_inspecao}`) : setCorrigindo(true));

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

  const listaOs = (
    ordens.length === 0 ? (
      <div className="insp-nota">
        <Icone nome="informacao" tamanho={16} />
        <span>
          {pendente
            ? "A inspeção ainda não foi realizada."
            : i.itens_com_ressalva
              ? "Nenhuma OS de manutenção aberta para esta inspeção."
              : "Nenhum item com ressalva: não há manutenção a abrir."}
          {i.analise === "ANALISADO" && i.analise_observacao && <> Decisão da gestão: {i.analise_observacao}</>}
        </span>
      </div>
    ) : (
      <div className="rolagem-x">
        <table className="tabela vd-tabela">
          <thead>
            <tr><th>Nº da OS</th><th>Aberta em</th><th>Descrição</th><th>Oficina</th><th>Situação</th></tr>
          </thead>
          <tbody>
            {ordens.map((o) => (
              <tr key={o.id_os} className="vd-tabela__linha" onClick={() => navegar(`/frotas/manutencoes/${o.id_os}`)}>
                <td>{numeroOs(o.numero)}</td>
                <td>{data(o.data_abertura)}</td>
                <td className="coluna-flexivel">
                  <span className="celula-cortada" title={o.descricao || ""}>{String(o.descricao || "—").split("\n")[0]}</span>
                </td>
                <td>{vazio(o.oficina)}</td>
                <td><Selo valor={o.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  );

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

      <section className="vd-resumo">
        <div className="vd-resumo__principal">
          <span className="vd-resumo__rotulo">Veículo</span>
          <button type="button" className="vd-resumo__placa insp-link"
                  onClick={() => navegar(`/frotas/veiculos/${i.id_veiculo}`)}>{i.placa}</button>
          <span className="vd-resumo__modelo">{i.marca} {i.modelo}</span>
          <span className="vd-resumo__linha">
            {[i.tipo_veiculo && rotulo("tipoVeiculo", i.tipo_veiculo),
              i.tipo_combustivel && rotulo("combustivel", i.tipo_combustivel),
              i.ano_fabricacao && `${i.ano_fabricacao} / ${i.ano_modelo}`].filter(Boolean).join("  •  ")}
          </span>
        </div>
        <div className="vd-resumo__grade vd-resumo__grade--5">
          <div className="vd-resumo__coluna">
            <Item rotulo="Nº da inspeção">{vazio(i.numero)}</Item>
            <Item rotulo="Setor">{vazio(i.setor)}</Item>
          </div>
          <div className="vd-resumo__coluna">
            <Item rotulo="Responsável">{vazio(i.responsavel)}</Item>
            {i.responsavel_matricula && <span className="vd-resumo__apoio">Matrícula: {i.responsavel_matricula}</span>}
          </div>
          <div className="vd-resumo__coluna">
            <Item rotulo={pendente ? "Agendada para" : "Data da inspeção"}>
              {data(pendente ? i.data_programada : i.data_realizacao)}
            </Item>
            {!pendente && <span className="vd-resumo__apoio">{hora(i.hora_inicio)}</span>}
          </div>
          <div className="vd-resumo__coluna">
            <Item rotulo="Frequência">
              <Selo texto={FREQUENCIA[i.tipo] || i.tipo} tom="azul" />
            </Item>
          </div>
          <div className="vd-resumo__coluna">
            <Item rotulo="Status">
              <Selo texto={quadro.titulo} tom={quadro.tom} />
            </Item>
          </div>
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
              acao={<span className="vd2-nota vd-cartao-acao">{FREQUENCIA[i.tipo] === "Semanal" ? "Lista semanal" : "Lista completa"} · {linhas.length} itens</span>}
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
                <>
                  <div className="insp-contagem">
                    <span className="insp-contagem__item" data-tom="verde"><strong>{contagem.NORMAL}</strong> Conforme</span>
                    <span className="insp-contagem__item" data-tom="amarelo"><strong>{contagem.ATENCAO}</strong> Atenção</span>
                    <span className="insp-contagem__item" data-tom="vermelho"><strong>{contagem.AVARIA}</strong> Não conforme</span>
                  </div>
                  <ItensGrupos itens={itens} />
                </>
              )}
            </Cartao>

            <Cartao
              className="cartao--acao-junto"
              titulo={<><Icone nome="kpi-wrench" tamanho={18} /> Manutenção</>}
              acao={mostraAbrirOs && i.itens_com_ressalva > 0 && (
                <button className="botao botao--primario botao--pequeno vd-cartao-acao" onClick={abrirOs}>
                  <Icone nome="kpi-wrench" tamanho={14} monocromatico /> Abrir OS
                </button>
              )}
            >
              {listaOs}
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

            {(mostraAbrirOs || mostraConcluir || podeInspecao) && (
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
                </div>
              </Cartao>
            )}

            <Cartao titulo={<><Icone nome="documento" tamanho={18} /> Observações do Responsável</>}>
              <p className="texto-corrido texto-quebra insp-observacao">
                {i.observacoes || "Nenhuma observação registrada."}
              </p>
            </Cartao>
          </div>
        </div>
      )}

      {aba === "itens" && (
        <Cartao
          titulo={`Itens da inspeção · ${FREQUENCIA[i.tipo] === "Semanal" ? "lista semanal" : "lista completa"} (${linhas.length} itens)`}
          acao={!pendente && (
            <div className="insp-contagem vd-cartao-acao">
              <span className="insp-contagem__item" data-tom="verde"><strong>{contagem.NORMAL}</strong> Conforme</span>
              <span className="insp-contagem__item" data-tom="amarelo"><strong>{contagem.ATENCAO}</strong> Atenção</span>
              <span className="insp-contagem__item" data-tom="vermelho"><strong>{contagem.AVARIA}</strong> Não conforme</span>
            </div>
          )}
        >
          {pendente && (
            <div className="insp-nota">
              <Icone nome="informacao" tamanho={16} />
              <span>Inspeção ainda não realizada: esta é a lista que o responsável vai conferir pelo QR Code.</span>
            </div>
          )}
          <ItensGrupos itens={linhas} />
        </Cartao>
      )}

      {aba === "manutencao" && (
        <Cartao
          className="cartao--acao-junto"
          titulo={<><Icone nome="kpi-wrench" tamanho={18} /> Manutenção</>}
          acao={mostraAbrirOs && i.itens_com_ressalva > 0 && (
            <button className="botao botao--primario botao--pequeno vd-cartao-acao" onClick={abrirOs}>
              <Icone nome="kpi-wrench" tamanho={14} monocromatico /> Abrir OS
            </button>
          )}
        >
          {listaOs}
        </Cartao>
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
