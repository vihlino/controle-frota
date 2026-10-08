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
import { useLocation, useNavigate } from "react-router-dom";
import PaginaLista from "../../components/PaginaLista.jsx";
import Icone from "../../components/Icone.jsx";
import Selo from "../../components/Selo.jsx";
import Modal from "../../components/Modal.jsx";
import { Selecao, Data, Texto, Periodo } from "../../components/Campos.jsx";
import { useLista } from "../../components/useLista.js";
import { api } from "../../lib/api.js";
import { data, dataHora, numero } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";
import { SimNao } from "../../components/RegistrarSinistro.jsx";

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
const TOM_STATUS = {
  GERADO: "azul", AGUARDANDO_ATESTE: "amarelo",
  ATESTADO: "verde", CANCELADO: "vermelho",
};

export default function Relatórios() {
  const navegar = useNavigate();
  // A mesma tela atende Frotas e Fiscalizacao: o relatorio abre e volta
  // dentro da area em que a pessoa esta.
  const fiscalizacao = useLocation().pathname.startsWith("/fiscalizacao");
  const base = fiscalizacao ? "/fiscalizacao/relatorios" : "/frotas/relatorios";
  const { podeVer } = useSessao();
  const lista = useLista("relatorios", { busca: "", tipo: "", status: "", dataDe: "", dataAte: "" });
  const [tipos, setTipos] = useState([]);
  const [gerando, setGerando] = useState(false);
  const [formulario, setFormulario] = useState(FORM_VAZIO);
  const [usuarios, setUsuarios] = useState([]);
  const [erroForm, setErroForm] = useState("");
  const [salvando, setSalvando] = useState(false);

  const podeGerar = podeVer("RELATORIOS_GERAR");

  useEffect(() => {
    api("/relatorios/tipos").then((r) => setTipos(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

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
          legenda="Escolha o período e o tipo. Cada tipo tem um modelo padrão."
          aoFechar={() => setGerando(false)}
          rodape={
            <>
              <button className="botao" onClick={() => setGerando(false)}>Cancelar</button>
              <button className="botao botao--primario" form="form-relatório" disabled={salvando}>
                {salvando ? "Gerando..." : "Gerar relatório"}
              </button>
            </>
          }
        >
          {erroForm && <div className="login__erro">{erroForm}</div>}
          <form id="form-relatório" onSubmit={gerar}>
            <div className="formulario-grade">
              <Data rotulo="Data inicial *" id="periodo_inicio" required
                    value={formulario.periodo_inicio}
                    onChange={(e) =>
                      setFormulario((f) => ({ ...f, periodo_inicio: e.target.value }))} />
              <Data rotulo="Data final *" id="periodo_fim" required
                    value={formulario.periodo_fim}
                    onChange={(e) =>
                      setFormulario((f) => ({ ...f, periodo_fim: e.target.value }))} />
            </div>

            <div className="tipos-relatorio">
              {tipos.map((t) => (
                <label key={t.tipo} className="tipo-relatorio" data-ativo={formulario.tipo === t.tipo}>
                  <input
                    type="radio" name="tipo" value={t.tipo} required
                    checked={formulario.tipo === t.tipo}
                    onChange={(e) => setFormulario((f) => ({ ...f, tipo: e.target.value }))}
                  />
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
              <h3 className="rel-ateste__titulo">Ateste</h3>
              <div className="formulario-grade">
                <SimNao nome="precisa_ateste" rotulo="O relatório precisa ser atestado? *"
                        valor={formulario.precisa_ateste}
                        aoMudar={(v) => setFormulario((f) => ({ ...f, precisa_ateste: v }))} />
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
