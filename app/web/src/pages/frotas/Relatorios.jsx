/**
 * Relatórios.jsx - Lista e geracao de relatórios.
 *
 * A geracao e simples de proposito: escolher periodo, escolher tipo, gerar.
 * Sem filtros extras nem selecao manual de colunas - cada tipo tem seu modelo
 * padrao, definido no backend.
 *
 * Gerado, o relatório nasce AGUARDANDO ATESTE e a tela abre o documento.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PaginaLista from "../../components/PaginaLista.jsx";
import Icone from "../../components/Icone.jsx";
import Selo from "../../components/Selo.jsx";
import Modal from "../../components/Modal.jsx";
import { Selecao, Data } from "../../components/Campos.jsx";
import { useLista } from "../../components/useLista.js";
import { api } from "../../lib/api.js";
import { data, dataHora, numero } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";

const SITUACOES = [
  { valor: "GERADO", rotulo: "Gerado" },
  { valor: "AGUARDANDO_ATESTE", rotulo: "Aguardando ateste" },
  { valor: "ATESTADO", rotulo: "Atestado" },
  { valor: "CANCELADO", rotulo: "Cancelado" },
];
const TOM_STATUS = {
  GERADO: "azul", AGUARDANDO_ATESTE: "amarelo",
  ATESTADO: "verde", CANCELADO: "vermelho",
};

export default function Relatórios() {
  const navegar = useNavigate();
  const { podeVer } = useSessao();
  const lista = useLista("relatorios", { busca: "", tipo: "", status: "" });
  const [tipos, setTipos] = useState([]);
  const [gerando, setGerando] = useState(false);
  const [formulario, setFormulario] = useState({ tipo: "", periodo_inicio: "", periodo_fim: "" });
  const [erroForm, setErroForm] = useState("");
  const [salvando, setSalvando] = useState(false);

  const podeGerar = podeVer("RELATORIOS_GERAR");

  useEffect(() => {
    api("/relatorios/tipos").then(setTipos).catch(() => {});
  }, []);

  async function gerar(e) {
    e.preventDefault();
    setSalvando(true);
    setErroForm("");
    try {
      const novo = await api("/relatorios", { method: "POST", body: formulario });
      setGerando(false);
      navegar(`/frotas/relatorios/${novo.id_relatorio}`);
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
      chave: "periodo", rotulo: "Periodo",
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
          {r.atestado_por && (
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
        <button className="botao botao--pequeno"
                onClick={() => navegar(`/frotas/relatorios/${r.id_relatorio}`)}>
          Ver
        </button>
      ),
    },
  ];

  const CATEGORIAS_RELATORIO = [
    { tipo: "VEICULOS", nome: "Veículos", descricao: "Relatórios sobre a frota, cadastro, status e utilização dos veículos.", icone: "kpi-car", tom: "azul" },
    { tipo: "CHECKLISTS", nome: "Checklists", descricao: "Checklists realizados pelos motoristas.", icone: "checklist", tom: "verde" },
    { tipo: "INSPECOES", nome: "Inspeções", descricao: "Relatórios das inspeções veiculares realizadas.", icone: "calendar", tom: "amarelo" },
    { tipo: "MANUTENCOES", nome: "Manutenções", descricao: "Relatórios de manutenções, custos e histórico de serviços.", icone: "kpi-wrench", tom: "laranja" },
    { tipo: "DOCUMENTOS", nome: "Documentos", descricao: "Relatórios de documentos, vencimentos e pendências.", icone: "nav-gestao", tom: "azul" },
    { tipo: "SINISTROS", nome: "Sinistros", descricao: "Relatórios de sinistros, ocorrências e status.", icone: "alert-triangle", tom: "vermelho" },
    { tipo: "INDICADORES", nome: "Indicadores", descricao: "Indicadores de desempenho e KPIs da frota.", icone: "chart-line", tom: "verde" },
    { tipo: "PERSONALIZADO", nome: "Personalizado", descricao: "Monte seu próprio relatório com campos personalizados.", icone: "arrow-up", tom: "amarelo" },
  ];

  return (
    <PaginaLista
      trilha={[{ rotulo: "Frotas" }, { rotulo: "Relatórios" }]}
      titulo="Relatórios"
      descricao="Visualize, gerencie e ateste os relatórios gerados no sistema."
      acao={
        podeGerar && (
          <button className="botao botao--primario" onClick={() => setGerando(true)}>
            <Icone nome="chart-line" tamanho={16} /> Gerar relatório
          </button>
        )
      }
      secao={
        podeGerar && (
          <div className="cartao" style={{ padding: "24px" }}>
            <h2 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 600 }}>Categorias de relatórios</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
              {CATEGORIAS_RELATORIO.map((cat) => (
                <div key={cat.tipo} className="cartao" style={{ padding: "20px", cursor: "pointer", border: "1px solid var(--borda)" }}
                     onClick={() => { setFormulario((f) => ({ ...f, tipo: cat.tipo })); setGerando(true); }}>
                  <Icone nome={cat.icone} tamanho={24} style={{ color: `var(--${cat.tom})` }} />
                  <strong style={{ display: "block", marginTop: "10px", fontSize: "14px" }}>{cat.nome}</strong>
                  <p style={{ fontSize: "12px", color: "var(--texto-2)", margin: "6px 0 14px" }}>{cat.descricao}</p>
                  <span style={{ fontSize: "12px", color: "var(--amarelo)", fontWeight: 600 }}>Gerar relatório →</span>
                </div>
              ))}
            </div>
          </div>
        )
      }
      lista={lista}
      colunas={colunas}
      chaveDe={(r) => r.id_relatorio}
      unidade="relatórios"
      vazio="Nenhum relatório gerado ainda."
      filtros={
        <>
          <Selecao rotulo="Tipo de relatório" id="tipo" vazio="Todos os tipos"
                   opcoes={tipos.map((t) => ({ valor: t.tipo, rotulo: t.nome }))}
                   value={lista.filtros.tipo}
                   onChange={(e) => lista.alterarFiltro("tipo", e.target.value)} />
          <Selecao rotulo="Situação" id="status" vazio="Todas" opcoes={SITUACOES}
                   value={lista.filtros.status}
                   onChange={(e) => lista.alterarFiltro("status", e.target.value)} />
        </>
      }
    >
      {gerando && (
        <Modal
          titulo="Gerar relatório"
          legenda="Escolha o periodo e o tipo. Cada tipo tem um modelo padrao."
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
          </form>
        </Modal>
      )}
    </PaginaLista>
  );
}
