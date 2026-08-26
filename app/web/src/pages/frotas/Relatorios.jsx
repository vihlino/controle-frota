/**
 * Relatorios.jsx - Lista e geracao de relatorios.
 *
 * A geracao e simples de proposito: escolher periodo, escolher tipo, gerar.
 * Sem filtros extras nem selecao manual de colunas - cada tipo tem seu modelo
 * padrao, definido no backend.
 *
 * Gerado, o relatorio nasce AGUARDANDO ATESTE e a tela abre o documento.
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

export default function Relatorios() {
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
      chave: "nome", rotulo: "Nome do relatorio",
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
      chave: "status", rotulo: "Situacao",
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
      chave: "acoes", rotulo: "Acoes",
      render: (r) => (
        <button className="botao botao--pequeno"
                onClick={() => navegar(`/frotas/relatorios/${r.id_relatorio}`)}>
          Ver
        </button>
      ),
    },
  ];

  return (
    <PaginaLista
      trilha={[{ rotulo: "Frotas" }, { rotulo: "Relatorios" }]}
      titulo="Relatorios"
      descricao="Visualize, gerencie e ateste os relatorios gerados no sistema."
      acao={
        podeGerar && (
          <button className="botao botao--primario" onClick={() => setGerando(true)}>
            <Icone nome="chart-line" tamanho={16} /> Gerar relatorio
          </button>
        )
      }
      lista={lista}
      colunas={colunas}
      chaveDe={(r) => r.id_relatorio}
      unidade="relatorios"
      vazio="Nenhum relatorio gerado ainda."
      filtros={
        <>
          <Selecao rotulo="Tipo de relatorio" id="tipo" vazio="Todos os tipos"
                   opcoes={tipos.map((t) => ({ valor: t.tipo, rotulo: t.nome }))}
                   value={lista.filtros.tipo}
                   onChange={(e) => lista.alterarFiltro("tipo", e.target.value)} />
          <Selecao rotulo="Situacao" id="status" vazio="Todas" opcoes={SITUACOES}
                   value={lista.filtros.status}
                   onChange={(e) => lista.alterarFiltro("status", e.target.value)} />
        </>
      }
    >
      {gerando && (
        <Modal
          titulo="Gerar relatorio"
          legenda="Escolha o periodo e o tipo. Cada tipo tem um modelo padrao."
          aoFechar={() => setGerando(false)}
          rodape={
            <>
              <button className="botao" onClick={() => setGerando(false)}>Cancelar</button>
              <button className="botao botao--primario" form="form-relatorio" disabled={salvando}>
                {salvando ? "Gerando..." : "Gerar relatorio"}
              </button>
            </>
          }
        >
          {erroForm && <div className="login__erro">{erroForm}</div>}
          <form id="form-relatorio" onSubmit={gerar}>
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
                <strong>Informacoes do modelo:</strong> {escolhido.colunas.join(", ")}.
              </p>
            )}
          </form>
        </Modal>
      )}
    </PaginaLista>
  );
}
