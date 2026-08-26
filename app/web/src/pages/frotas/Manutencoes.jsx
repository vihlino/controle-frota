/**
 * Manutencoes.jsx - As ordens de servico da frota.
 *
 * Os quatro KPIs do topo (total, em andamento, concluidas e atrasadas) sao
 * calculados a partir da propria listagem, para nao criar um endpoint so por
 * causa de quatro numeros.
 *
 * "Atrasada" e a OS cuja data agendada ja passou e que ainda nao foi resolvida
 * nem cancelada.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PaginaLista from "../../components/PaginaLista.jsx";
import Icone from "../../components/Icone.jsx";
import Selo from "../../components/Selo.jsx";
import Acoes from "../../components/Acoes.jsx";
import Modal from "../../components/Modal.jsx";
import { Texto, Selecao, Data, Area } from "../../components/Campos.jsx";
import { useLista } from "../../components/useLista.js";
import { api } from "../../lib/api.js";
import { data, dinheiro, numero, rotulo } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";

const TIPOS = [
  { valor: "PREVENTIVA", rotulo: "Preventiva" },
  { valor: "CORRETIVA", rotulo: "Corretiva" },
];
const PRIORIDADES = [
  { valor: "BAIXA", rotulo: "Baixa" },
  { valor: "MEDIA", rotulo: "Media" },
  { valor: "ALTA", rotulo: "Alta" },
];
const SITUACOES = [
  { valor: "EM_ANALISE", rotulo: "Em analise" },
  { valor: "EM_MANUTENCAO", rotulo: "Em manutencao" },
  { valor: "RESOLVIDA", rotulo: "Resolvida" },
  { valor: "CANCELADA", rotulo: "Cancelada" },
];

export default function Manutencoes() {
  const navegar = useNavigate();
  const { podeVer, usuario } = useSessao();
  const lista = useLista("frotas/manutencoes", {
    busca: "", veiculo: "", status: "", tipo: "", gravidade: "", dataDe: "", dataAte: "",
  });
  const [veiculos, setVeiculos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [agendando, setAgendando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState("");
  const [formulario, setFormulario] = useState({
    id_veiculo: "", tipo: "PREVENTIVA", gravidade: "MEDIA", descricao: "",
    oficina: "", data_agendada: "", quilometragem: "", custo: "", observacoes: "",
  });

  const podeGerenciar = podeVer("FROTAS_GERENCIAR_OS");

  useEffect(() => {
    api("/frotas/veiculos/opcoes").then(setVeiculos).catch(() => {});
    api("/usuarios?porPagina=200").then((r) => setUsuarios(r.itens)).catch(() => {});
  }, []);

  // Os KPIs do topo saem da propria listagem, sem filtro, para nao criar um
  // endpoint so para quatro numeros.
  useEffect(() => {
    api("/frotas/manutencoes?porPagina=200").then((r) => {
      const itens = r.itens;
      setResumo({
        total: r.total,
        andamento: itens.filter((o) => o.status === "EM_MANUTENCAO").length,
        concluidas: itens.filter((o) => o.status === "RESOLVIDA").length,
        atrasadas: itens.filter(
          (o) => o.data_agendada && o.data_agendada < new Date().toISOString().slice(0, 10)
            && !["RESOLVIDA", "CANCELADA"].includes(o.status)
        ).length,
      });
    }).catch(() => {});
  }, [lista.resultado]);

  async function agendarManutencao(e) {
    e.preventDefault();
    setSalvando(true);
    setErroForm("");
    try {
      await api("/frotas/manutencoes", {
        method: "POST",
        body: {
          ...formulario,
          id_veiculo: Number(formulario.id_veiculo),
          id_solicitante: usuario.id_usuario,
          origem: "FROTAS",
          status: "EM_ANALISE",
          quilometragem: formulario.quilometragem ? Number(formulario.quilometragem) : null,
          custo: formulario.custo ? Number(formulario.custo) : null,
        },
      });
      setAgendando(false);
      lista.recarregar();
    } catch (e) {
      setErroForm(e.message);
    } finally {
      setSalvando(false);
    }
  }

  const campo = (nome) => ({
    value: formulario[nome] ?? "",
    onChange: (e) => setFormulario((f) => ({ ...f, [nome]: e.target.value })),
  });

  const colunas = [
    { chave: "numero", rotulo: "No da OS", render: (o) => o.numero || "-" },
    {
      chave: "data_agendada", rotulo: "Data agendada", ordenavel: true,
      render: (o) => data(o.data_agendada || o.data_abertura),
    },
    {
      chave: "placa", rotulo: "Veiculo", ordenavel: true,
      render: (o) => (
        <span className="celula-dupla">
          <strong>{o.placa}</strong>
          <span>{`${o.marca} ${o.modelo}`}</span>
        </span>
      ),
    },
    { chave: "tipo", rotulo: "Tipo", render: (o) => rotulo("tipoOs", o.tipo) },
    { chave: "descricao", rotulo: "Descricao", render: (o) => o.descricao || o.servico_realizado || "-" },
    { chave: "oficina", rotulo: "Oficina", render: (o) => o.oficina || "-" },
    {
      chave: "quilometragem", rotulo: "KM atual",
      render: (o) => (o.quilometragem ? `${numero(o.quilometragem)} km` : "-"),
    },
    { chave: "custo", rotulo: "Custo", ordenavel: true, render: (o) => dinheiro(o.custo) },
    { chave: "status", rotulo: "Situacao", ordenavel: true, render: (o) => <Selo valor={o.status} /> },
    {
      chave: "gravidade", rotulo: "Prioridade", ordenavel: true,
      render: (o) => {
        const g = rotulo("gravidade", o.gravidade);
        const tom = { BAIXA: "verde", MEDIA: "amarelo", ALTA: "vermelho" }[o.gravidade];
        return <Selo texto={g} tom={tom} />;
      },
    },
    {
      chave: "acoes", rotulo: "Acoes",
      render: (o) => (
        <Acoes
          acoes={[
            { rotulo: "Visualizar detalhes", aoClicar: () => navegar(`/frotas/manutencoes/${o.id_os}`) },
            { rotulo: "Ver veiculo", aoClicar: () => navegar(`/frotas/veiculos/${o.id_veiculo}`) },
          ]}
        />
      ),
    },
  ];

  return (
    <PaginaLista
      trilha={[{ rotulo: "Frotas" }, { rotulo: "Manutencoes" }]}
      titulo="Manutencoes"
      descricao="Acompanhe e gerencie as manutencoes da frota."
      acao={
        podeGerenciar && (
          <button className="botao botao--primario" onClick={() => setAgendando(true)}>
            <Icone nome="kpi-wrench" tamanho={16} /> Agendar manutencao
          </button>
        )
      }
      kpis={
        resumo && [
          { icone: "kpi-wrench", rotulo: "Total de manutencoes", valor: resumo.total, nota: "Todas", tom: "azul" },
          { icone: "calendar", rotulo: "Em andamento", valor: resumo.andamento, nota: "Servicos abertos", tom: "amarelo" },
          { icone: "checklist", rotulo: "Concluidas", valor: resumo.concluidas, nota: "Servicos finalizados", tom: "verde" },
          { icone: "alert-triangle", rotulo: "Atrasadas", valor: resumo.atrasadas, nota: "Passaram da data", tom: "vermelho" },
        ]
      }
      lista={lista}
      colunas={colunas}
      chaveDe={(o) => o.id_os}
      unidade="manutencoes"
      vazio="Nenhuma manutencao encontrada com esses filtros."
      filtros={
        <>
          <Texto rotulo="Buscar" id="busca" placeholder="Placa, descricao ou oficina"
                 value={lista.filtros.busca}
                 onChange={(e) => lista.alterarFiltro("busca", e.target.value)} />
          <Selecao rotulo="Veiculo" id="veiculo" vazio="Todos os veiculos"
                   opcoes={veiculos.map((v) => ({ valor: v.id_veiculo, rotulo: `${v.placa} - ${v.modelo}` }))}
                   value={lista.filtros.veiculo}
                   onChange={(e) => lista.alterarFiltro("veiculo", e.target.value)} />
          <Selecao rotulo="Tipo" id="tipo" vazio="Todos" opcoes={TIPOS}
                   value={lista.filtros.tipo}
                   onChange={(e) => lista.alterarFiltro("tipo", e.target.value)} />
          <Selecao rotulo="Situacao" id="status" vazio="Todas" opcoes={SITUACOES}
                   value={lista.filtros.status}
                   onChange={(e) => lista.alterarFiltro("status", e.target.value)} />
          <Selecao rotulo="Prioridade" id="gravidade" vazio="Todas" opcoes={PRIORIDADES}
                   value={lista.filtros.gravidade}
                   onChange={(e) => lista.alterarFiltro("gravidade", e.target.value)} />
          <Data rotulo="De" id="dataDe" value={lista.filtros.dataDe}
                onChange={(e) => lista.alterarFiltro("dataDe", e.target.value)} />
          <Data rotulo="Ate" id="dataAte" value={lista.filtros.dataAte}
                onChange={(e) => lista.alterarFiltro("dataAte", e.target.value)} />
        </>
      }
    >
      {agendando && (
        <Modal
          titulo="Agendar manutencao"
          legenda="A ordem de servico nasce em analise."
          largura={720}
          aoFechar={() => setAgendando(false)}
          rodape={
            <>
              <button className="botao" onClick={() => setAgendando(false)}>Cancelar</button>
              <button className="botao botao--primario" form="form-os" disabled={salvando}>
                {salvando ? "Salvando..." : "Agendar manutencao"}
              </button>
            </>
          }
        >
          {erroForm && <div className="login__erro">{erroForm}</div>}
          <form id="form-os" className="formulario-grade" onSubmit={agendarManutencao}>
            <Selecao rotulo="Veiculo *" id="id_veiculo" required vazio="Selecione"
                     opcoes={veiculos.map((v) => ({
                       valor: v.id_veiculo, rotulo: `${v.placa} - ${v.marca} ${v.modelo}`,
                     }))}
                     {...campo("id_veiculo")} />
            <Selecao rotulo="Tipo de manutencao *" id="tipo" required opcoes={TIPOS} {...campo("tipo")} />
            <Selecao rotulo="Prioridade *" id="gravidade" required opcoes={PRIORIDADES}
                     {...campo("gravidade")} />
            <Data rotulo="Data agendada" id="data_agendada" {...campo("data_agendada")} />
            <Texto rotulo="Oficina / Fornecedor" id="oficina" {...campo("oficina")} />
            <Texto rotulo="Quilometragem" id="quilometragem" type="number" min="0"
                   {...campo("quilometragem")} />
            <Texto rotulo="Custo previsto (R$)" id="custo" type="number" min="0" step="0.01"
                   {...campo("custo")} />
            <Area rotulo="Descricao do servico *" id="descricao" largo required
                  {...campo("descricao")} />
            <Area rotulo="Observacoes" id="observacoes" largo {...campo("observacoes")} />
          </form>
        </Modal>
      )}
    </PaginaLista>
  );
}
