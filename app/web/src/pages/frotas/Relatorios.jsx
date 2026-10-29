/**
 * Relatórios.jsx - Lista e geracao de relatórios.
 *
 * A geracao e simples de proposito: escolher periodo, escolher tipo, gerar.
 * Sem filtros extras nem selecao manual de colunas - cada tipo tem seu modelo
 * padrao, definido no backend.
 *
 * Ao gerar, a pessoa responde se o relatório precisa de ateste. Se precisa,
 * escolhe quantas pessoas (1 a 3) e quem: o relatório nasce AGUARDANDO
 * ATESTE e vai para o sino de cada escolhido. Sem ateste, nasce GERADO.
 */
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams, Navigate } from "react-router-dom";
import PaginaLista from "../../components/PaginaLista.jsx";
import Icone from "../../components/Icone.jsx";
import Selo from "../../components/Selo.jsx";
import Modal from "../../components/Modal.jsx";
import { Selecao, Data, Texto, Periodo } from "../../components/Campos.jsx";
import { useLista } from "../../components/useLista.js";
import { api } from "../../lib/api.js";
import { data, dataHora, numero } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";

const SITUACOES = [
  { valor: "GERADO", rotulo: "Sem ateste" },
  { valor: "AGUARDANDO_ATESTE", rotulo: "Aguardando ateste" },
  { valor: "ATESTADO", rotulo: "Atestado" },
  { valor: "CANCELADO", rotulo: "Cancelado" },
];
// Só no filtro: os relatórios encaminhados para quem está usando o sistema.
const FILTRO_SITUACAO = [{ valor: "MEU_ATESTE", rotulo: "Aguardando meu ateste" }, ...SITUACOES];
const FORM_VAZIO = { tipo: "", periodo_inicio: "", periodo_fim: "", precisa_ateste: null, quantidade: "1", atestantes: [""] };
const ORDINAL = ["1º", "2º", "3º"];
/** Icone e cor de cada tipo de relatorio, pelo nome (desenho de 29/10). */
const ICONES_TIPO = [
  [/entrada|sa[ií]da|movimenta/i, "kpi-car", "azul"],
  [/manuten/i, "kpi-wrench", "verde"],
  [/checklist/i, "checklist", "roxo"],
  [/inspe/i, "search", "amarelo"],
  [/sinistro/i, "alert-triangle", "vermelho"],
  [/documento/i, "documento", "azul"],
  [/indicador|desempenho/i, "chart-line", "roxo"],
  [/ocorr/i, "fisc-ocorrencias", "laranja"],
  [/servi[cç]o/i, "calendar", "azul"],
  [/pontua/i, "fisc-bolt", "amarelo"],
  [/equipamento/i, "eq-cone", "laranja"],
  [/multa/i, "dinheiro", "vermelho"],
];
const iconeTipo = (nome) => ICONES_TIPO.find(([re]) => re.test(nome || "")) || [null, "arquivo-texto", "azul"];
const TOM_STATUS = {
  GERADO: "azul", AGUARDANDO_ATESTE: "amarelo",
  ATESTADO: "verde", CANCELADO: "vermelho",
};

/**
 * Cada menu so mostra os relatorios do proprio modulo (18/10). Quem abre o
 * endereco do outro modulo (link antigo, favorito) e levado para o seu, em
 * vez de ficar numa tela que a API recusa.
 */
export default function Relatórios() {
  const fiscalizacao = useLocation().pathname.startsWith("/fiscalizacao");
  const { podeVer } = useSessao();
  const tem = (m) => podeVer(m === "FISCALIZACAO" ? "FISCALIZACAO_VISUALIZAR" : "FROTAS_VISUALIZAR");
  const daTela = fiscalizacao ? "FISCALIZACAO" : "FROTAS";
  const outro = fiscalizacao ? "FROTAS" : "FISCALIZACAO";
  if (!tem(daTela) && tem(outro)) {
    return <Navigate to={fiscalizacao ? "/frotas/relatorios" : "/fiscalizacao/relatorios"} replace />;
  }
  return <TelaRelatorios />;
}

function TelaRelatorios() {
  const navegar = useNavigate();
  // A mesma tela atende Frotas e Fiscalizacao: o relatorio abre e volta
  // dentro da area em que a pessoa esta.
  const fiscalizacao = useLocation().pathname.startsWith("/fiscalizacao");
  const base = fiscalizacao ? "/fiscalizacao/relatorios" : "/frotas/relatorios";
  const { podeVer } = useSessao();
  /*
   * 18/10: cada menu mostra os relatorios e os dados do proprio modulo
   * (Frotas > Relatorios so Frotas; Fiscalizacao > Relatorios so
   * Fiscalizacao). Quem tem os dois modulos (o administrador) ganha o campo
   * "Dados de" para escolher.
   */
  const moduloDaTela = fiscalizacao ? "FISCALIZACAO" : "FROTAS";
  const temOsDois = podeVer("FROTAS_VISUALIZAR") && podeVer("FISCALIZACAO_VISUALIZAR");
  // ?status=MEU_ATESTE: o alerta "Relatorio para atestar" abre a lista ja no
  // filtro "Aguardando meu ateste" (26/10).
  const [paramsIniciais] = useSearchParams();
  const lista = useLista("relatorios", { busca: "", tipo: "", status: paramsIniciais.get("status") || "", dataDe: "", dataAte: "", modulo: moduloDaTela });
  const modulo = lista.filtros.modulo || moduloDaTela;
  const [tipos, setTipos] = useState([]);
  const [gerando, setGerando] = useState(false);
  const [formulario, setFormulario] = useState(FORM_VAZIO);
  const [usuarios, setUsuarios] = useState([]);
  const [erroForm, setErroForm] = useState("");
  const [salvando, setSalvando] = useState(false);

  const podeGerar = podeVer("RELATORIOS_GERAR");

  useEffect(() => {
    api(`/relatorios/tipos?modulo=${modulo}`).then((r) => setTipos(Array.isArray(r) ? r : [])).catch(() => setTipos([]));
  }, [modulo]);
  const mudarModulo = (m) => {
    lista.alterarFiltro("tipo", "");
    lista.alterarFiltro("modulo", m);
    setFormulario((f) => ({ ...f, tipo: "" }));
  };
  const OPCOES_MODULO = [{ valor: "FROTAS", rotulo: "Frotas" }, { valor: "FISCALIZACAO", rotulo: "Fiscalização" }];

  // A lista de quem pode ser escolhido para atestar carrega ao abrir a janela.
  useEffect(() => {
    if (!gerando) return;
    api("/relatorios/atestantes").then((r) => setUsuarios(Array.isArray(r) ? r : [])).catch(() => {});
  }, [gerando]);

  function abrirGerar() {
    setFormulario(FORM_VAZIO);
    setErroForm("");
    setGerando(true);
  }

  // ?gerar=TIPO (botao "Gerar relatório" da Pontuacao, 18/10): abre a janela
  // ja com o tipo escolhido. O parametro sai do endereco para nao reabrir.
  const [parametros, definirParametros] = useSearchParams();
  useEffect(() => {
    const tipo = parametros.get("gerar");
    if (!tipo || !podeGerar) return;
    setFormulario({ ...FORM_VAZIO, tipo });
    setErroForm("");
    setGerando(true);
    const p = new URLSearchParams(parametros);
    p.delete("gerar");
    definirParametros(p, { replace: true });
  }, [parametros, definirParametros, podeGerar]);

  function mudarQuantidade(valor) {
    const n = Number(valor);
    setFormulario((f) => ({
      ...f, quantidade: valor,
      atestantes: Array.from({ length: n }, (_, i) => f.atestantes[i] || ""),
    }));
  }

  function escolherAtestante(i, valor) {
    setFormulario((f) => ({ ...f, atestantes: f.atestantes.map((a, j) => (j === i ? valor : a)) }));
  }

  async function gerar(e) {
    e.preventDefault();
    setErroForm("");
    if (formulario.precisa_ateste === null) {
      setErroForm("Responda se o relatório precisa ser atestado.");
      return;
    }
    if (formulario.precisa_ateste && formulario.atestantes.some((a) => !a)) {
      setErroForm("Escolha quem vai atestar o relatório.");
      return;
    }
    setSalvando(true);
    try {
      const novo = await api("/relatorios", {
        method: "POST",
        body: {
          tipo: formulario.tipo,
          periodo_inicio: formulario.periodo_inicio,
          periodo_fim: formulario.periodo_fim,
          precisa_ateste: formulario.precisa_ateste,
          atestantes: formulario.precisa_ateste ? formulario.atestantes.map(Number) : [],
        },
      });
      setGerando(false);
      navegar(`${base}/${novo.id_relatorio}`);
    } catch (e) {
      setErroForm(e.message);
    } finally {
      setSalvando(false);
    }
  }

  const escolhido = tipos.find((t) => t.tipo === formulario.tipo);

  const colunas = [
    {
      chave: "nome", rotulo: "Nome do relatório",
      render: (r) => (
        <span className="celula-dupla">
          <strong>{r.nome}</strong>
          <span>{numero(r.registros)} registros</span>
        </span>
      ),
    },
    {
      chave: "tipo", rotulo: "Tipo",
      render: (r) => <Selo texto={r.tipo.replace(/_/g, " ")} tom="amarelo" />,
    },
    {
      chave: "periodo", rotulo: "Período",
      render: (r) => `${data(r.periodo_inicio)} a ${data(r.periodo_fim)}`,
    },
    { chave: "data_geracao", rotulo: "Gerado em", render: (r) => dataHora(r.data_geracao) },
    {
      chave: "gerado_por_nome", rotulo: "Gerado por",
      render: (r) => (
        <span className="celula-dupla">
          <strong>{r.gerado_por_nome}</strong>
          <span>{r.gerado_por_cargo}</span>
        </span>
      ),
    },
    {
      chave: "status", rotulo: "Situação",
      render: (r) => (
        <span className="celula-dupla">
          <Selo
            texto={SITUACOES.find((s) => s.valor === r.status)?.rotulo || r.status}
            tom={TOM_STATUS[r.status]}
          />
          {r.status === "AGUARDANDO_ATESTE" && r.atestos_total > 0 && (
            <span className="celula-nota">{r.atestos_feitos} de {r.atestos_total} atestos</span>
          )}
          {r.status === "ATESTADO" && r.atestado_por && (
            <span className="celula-nota">
              {dataHora(r.atestado_por.data)} - {r.atestado_por.nome}
            </span>
          )}
        </span>
      ),
    },
    {
      chave: "ações", rotulo: "Ações",
      render: (r) => (
        <button className={r.meu_ateste_pendente ? "botao botao--pequeno botao--primario" : "botao botao--pequeno"}
                onClick={() => navegar(`${base}/${r.id_relatorio}`)}>
          {r.meu_ateste_pendente ? "Atestar" : "Ver"}
        </button>
      ),
    },
  ];

  return (
    <PaginaLista
      trilha={[{ rotulo: fiscalizacao ? "Fiscalização" : "Frotas" }, { rotulo: "Relatórios" }]}
      titulo="Relatórios"
      descricao="Visualize, gerencie e ateste os relatórios gerados no sistema."
      acao={
        podeGerar && (
          <button className="botao botao--primario" onClick={abrirGerar}>
            <Icone nome="chart-line" tamanho={15} /> Gerar relatório
          </button>
        )
      }
      lista={lista}
      colunas={colunas}
      chaveDe={(r) => r.id_relatorio}
      unidade="relatórios"
      vazio="Nenhum relatório gerado ainda."
      filtros={
        <>
          {temOsDois && (
            <Selecao rotulo="Dados de" id="modulo" opcoes={OPCOES_MODULO}
                     value={modulo} onChange={(e) => mudarModulo(e.target.value)} />
          )}
          <Texto rotulo="Buscar" id="busca" placeholder="Nome ou tipo do relatório"
                 value={lista.filtros.busca}
                 onChange={(e) => lista.alterarFiltro("busca", e.target.value)} />
          <Periodo id="periodo" de={lista.filtros.dataDe} ate={lista.filtros.dataAte}
                   aoMudarDe={(v) => lista.alterarFiltro("dataDe", v)}
                   aoMudarAte={(v) => lista.alterarFiltro("dataAte", v)} />
          <Selecao rotulo="Tipo de relatório" id="tipo" vazio="Todos"
                   opcoes={tipos.map((t) => ({ valor: t.tipo, rotulo: t.nome }))}
                   value={lista.filtros.tipo}
                   onChange={(e) => lista.alterarFiltro("tipo", e.target.value)} />
          <Selecao rotulo="Situação" id="status" vazio="Todas" opcoes={FILTRO_SITUACAO}
                   value={lista.filtros.status}
                   onChange={(e) => lista.alterarFiltro("status", e.target.value)} />
        </>
      }
    >
      {gerando && (
        <Modal
          titulo="Gerar relatório"
          legenda="Escolha o período e o tipo de relatório. Cada tipo tem um modelo padrão."
          icone="arquivo-texto"
          aoFechar={() => setGerando(false)}
          rodape={
            <>
              <button className="botao" onClick={() => setGerando(false)}>Cancelar</button>
              <button className="botao botao--primario" form="form-relatório" disabled={salvando}>
                <Icone nome="arquivo-texto" tamanho={15} monocromatico /> {salvando ? "Gerando..." : "Gerar relatório"}
              </button>
            </>
          }
        >
          {erroForm && <div className="login__erro">{erroForm}</div>}
          <form id="form-relatório" onSubmit={gerar}>
            <div className="formulario-grade">
              {temOsDois && (
                <Selecao rotulo="Dados de *" id="gerar-modulo" largo opcoes={OPCOES_MODULO}
                         value={modulo} onChange={(e) => mudarModulo(e.target.value)}
                         ajuda="Frotas: veículos da frota (sem as viaturas). Fiscalização: viaturas, ocorrências, serviços e pontuação." />
              )}
              <Data rotulo="Data inicial *" id="periodo_inicio" required
                    value={formulario.periodo_inicio}
                    onChange={(e) =>
                      setFormulario((f) => ({ ...f, periodo_inicio: e.target.value }))} />
              <Data rotulo="Data final *" id="periodo_fim" required
                    value={formulario.periodo_fim}
                    onChange={(e) =>
                      setFormulario((f) => ({ ...f, periodo_fim: e.target.value }))} />
            </div>

            <div className="gr-rotulo"><strong>Tipo de relatório <span className="campo__obrigatorio">*</span></strong>
              <small>Selecione o tipo de relatório que deseja gerar.</small></div>
            <div className="tipos-relatorio gr-tipos">
              {tipos.map((t) => (
                <label key={t.tipo} className="tipo-relatorio gr-tipo" data-ativo={formulario.tipo === t.tipo}>
                  <input
                    type="radio" name="tipo" value={t.tipo} required
                    checked={formulario.tipo === t.tipo}
                    onChange={(e) => setFormulario((f) => ({ ...f, tipo: e.target.value }))}
                  />
                  <span className="gr-tipo__icone" data-tom={iconeTipo(t.nome)[2]}><Icone nome={iconeTipo(t.nome)[1]} tamanho={22} monocromatico /></span>
                  <span>
                    <strong>{t.nome}</strong>
                    <small>{t.descricao}</small>
                  </span>
                </label>
              ))}
            </div>

            {escolhido && (
              <p className="tipo-relatorio__colunas">
                <strong>Informações do modelo:</strong> {escolhido.colunas.join(", ")}.
              </p>
            )}

            <div className="rel-ateste">
              <div className="gr-rotulo"><strong>Ateste</strong><small>Informe se o relatório precisa ser atestado.</small></div>
              <div className="gr-ateste">
                {[[true, "Sim", "O relatório será gerado com área para assinatura/ateste."],
                  [false, "Não", "O relatório será gerado sem área para assinatura."]].map(([v, r, d]) => (
                  <label key={r} className="gr-ateste__opcao" data-ativo={formulario.precisa_ateste === v}>
                    <input type="radio" name="precisa_ateste" required checked={formulario.precisa_ateste === v}
                           onChange={() => setFormulario((f) => ({ ...f, precisa_ateste: v }))} />
                    <span><strong>{r}</strong><small>{d}</small></span>
                  </label>
                ))}
              </div>
              <div className="formulario-grade">
                {formulario.precisa_ateste && (
                  <Selecao rotulo="Quantas pessoas vão atestar? *" id="quantidade"
                           opcoes={[{ valor: "1", rotulo: "1 pessoa" }, { valor: "2", rotulo: "2 pessoas" }, { valor: "3", rotulo: "3 pessoas" }]}
                           value={formulario.quantidade}
                           onChange={(e) => mudarQuantidade(e.target.value)} />
                )}
              </div>
              {formulario.precisa_ateste && (
                <>
                  <div className="formulario-grade">
                    {formulario.atestantes.map((escolha, i) => (
                      <Selecao key={i} rotulo={`${ORDINAL[i]} responsável pelo ateste *`} id={`atestante_${i}`}
                               vazio="Selecione o usuário"
                               opcoes={usuarios
                                 .filter((u) => String(u.id_usuario) === escolha
                                   || !formulario.atestantes.includes(String(u.id_usuario)))
                                 .map((u) => ({ valor: String(u.id_usuario), rotulo: u.cargo ? `${u.nome} - ${u.cargo}` : u.nome }))}
                               value={escolha}
                               onChange={(e) => escolherAtestante(i, e.target.value)} />
                    ))}
                  </div>
                  <p className="rel-ateste__nota">
                    Ao gerar, o relatório é encaminhado para {formulario.atestantes.length === 1 ? "a pessoa escolhida" : "as pessoas escolhidas"}:
                    o aviso aparece no sino e só {formulario.atestantes.length === 1 ? "ela pode" : "elas podem"} atestar.
                  </p>
                </>
              )}
            </div>
          </form>
        </Modal>
      )}
    </PaginaLista>
  );
}
