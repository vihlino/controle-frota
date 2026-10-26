/**
 * Manutenções.jsx - O historico das ordens de servico da frota.
 *
 * A gestao nao executa a manutencao: REGISTRA a OS que foi para a oficina e,
 * quando o servico volta, registra o FECHAMENTO. A tela e o lugar de achar
 * isso depois, sem papel.
 *
 * Sem os cartoes de numeros no topo (total, em aberto, fechadas, atrasadas):
 * poluiam a tela. Os filtros de Situacao e Periodo respondem o mesmo.
 */
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import PaginaLista from "../../components/PaginaLista.jsx";
import Icone from "../../components/Icone.jsx";
import Selo from "../../components/Selo.jsx";
import Acoes from "../../components/Acoes.jsx";
import RegistrarOs, { TIPOS_OS, PRIORIDADES_OS } from "../../components/RegistrarOs.jsx";
import FecharOs from "../../components/FecharOs.jsx";
import { useConfirmacaoSenha } from "../../components/ConfirmarSenha.jsx";
import { Texto, Selecao, Periodo } from "../../components/Campos.jsx";
import { useLista } from "../../components/useLista.js";
import { api } from "../../lib/api.js";
import { data, dinheiro, numero, numeroOs, rotulo } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";

const SITUACOES = [
  { valor: "PENDENTE", rotulo: "Pendente (solicitada)" },
  { valor: "EM_ANALISE", rotulo: "Em análise" },
  { valor: "EM_MANUTENCAO", rotulo: "Em manutenção" },
  { valor: "RESOLVIDA", rotulo: "Resolvida" },
  { valor: "CANCELADA", rotulo: "Cancelada" },
];
const ENCERRADA = ["RESOLVIDA", "CANCELADA"];

export default function Manutenções() {
  const navegar = useNavigate();
  const { podeVer } = useSessao();
  const [parametros] = useSearchParams();
  // A mesma tela atende a Fiscalizacao (09/10): la so aparecem as OS das
  // viaturas, e o registro so oferece viaturas.
  const fiscalizacao = useLocation().pathname.startsWith("/fiscalizacao");
  const base = fiscalizacao ? "/fiscalizacao/manutencoes" : "/frotas/manutencoes";
  const lista = useLista("frotas/manutencoes", {
    // ?status=PENDENTE: o alerta "OS solicitada" do painel abre a lista ja filtrada.
    busca: "", veiculo: parametros.get("veiculo") || "", status: parametros.get("status") || "", tipo: "", gravidade: "", dataDe: "", dataAte: "",
    ...(fiscalizacao ? { viatura: "true" } : {}),
  }, fiscalizacao ? { viatura: "true" } : {});
  const [veículos, setVeículos] = useState([]);
  // As janelas: registrar/editar (registrando = {os?, idVeiculo?}) e fechar.
  const [registrando, setRegistrando] = useState(null);
  const [fechando, setFechando] = useState(null);
  const { pedirExclusao, elemento: modalSenha } = useConfirmacaoSenha();

  // 18/10: so o Frotas edita, fecha e exclui. Na Fiscalizacao a OS e
  // SOLICITADA (nasce Pendente para o Frotas completar) e so acompanhada.
  const podeGerenciar = !fiscalizacao && podeVer("FROTAS_GERENCIAR_OS");
  const podeRegistrar = fiscalizacao
    ? podeVer("FROTAS_GERENCIAR_OS") || podeVer("FISCALIZACAO_GERENCIAR_VIATURAS")
    : podeGerenciar;

  useEffect(() => {
    api(`/frotas/veiculos/opcoes${fiscalizacao ? "?viatura=true" : ""}`).then(setVeículos).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * ?registrar=1 abre o Registrar OS (atalho do painel e o endereco antigo
   * /frotas/manutencoes/agendar). ?editar=ID e ?fechar=ID vem dos botoes da
   * ficha da OS. Os parametros saem do endereco depois de usados, senao um
   * F5 abriria a janela de novo.
   */
  useEffect(() => {
    const registrar = parametros.get("registrar");
    const editar = parametros.get("editar");
    const fechar = parametros.get("fechar");
    if (!registrar && !editar && !fechar) return;
    if (registrar) setRegistrando({ idVeiculo: parametros.get("veiculo") || "" });
    const id = editar || fechar;
    if (id) {
      api(`/frotas/manutencoes/${id}`)
        .then((os) => (fechar || ENCERRADA.includes(os.status) ? setFechando(os) : setRegistrando({ os })))
        .catch((e) => alert(e.message));
    }
    navegar(base, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Editar: OS aberta volta ao registro; OS fechada corrige o fechamento. */
  function editar(o) {
    if (ENCERRADA.includes(o.status)) setFechando(o);
    else setRegistrando({ os: o });
  }

  async function excluir(o) {
    const resposta = await pedirExclusao({
      titulo: "Excluir OS",
      oQue: o.numero ? `a ${numeroOs(o.numero)} do veículo ${o.placa}` : `a OS do veículo ${o.placa}`,
    });
    if (!resposta.ok) return;
    try {
      await api(`/frotas/manutencoes/${o.id_os}`, {
        method: "DELETE",
        body: { justificativa: resposta.justificativa },
      });
      lista.recarregar();
    } catch (e) {
      alert(e.message);
    }
  }

  const colunas = [
    { chave: "numero", rotulo: "Nº da OS", render: (o) => numeroOs(o.numero) || "-" },
    {
      chave: "data_agendada", rotulo: "Data agendada", ordenavel: true,
      render: (o) => data(o.data_agendada || o.data_abertura),
    },
    {
      chave: "placa", rotulo: "Veículo", ordenavel: true,
      render: (o) => (
        <span className="celula-dupla">
          <strong>{o.placa}</strong>
          <span className="celula-cortada celula-cortada--curta" title={`${o.marca} ${o.modelo}`}>
            {`${o.marca} ${o.modelo}`}
          </span>
        </span>
      ),
    },
    { chave: "tipo", rotulo: "Tipo", render: (o) => rotulo("tipoOs", o.tipo) },
    {
      // So o comeco, numa linha: a descricao inteira esticava a linha da
      // tabela. Passando o mouse aparece o texto todo; completo na ficha da OS.
      chave: "descricao", rotulo: "Descrição", classe: "coluna-flexivel",
      render: (o) => {
        const t = o.descricao || o.servico_realizado;
        return t ? <span className="celula-cortada" title={t}>{t}</span> : "-";
      },
    },
    {
      chave: "oficina", rotulo: "Oficina",
      render: (o) => (o.oficina
        ? <span className="celula-cortada celula-cortada--curta" title={o.oficina}>{o.oficina}</span>
        : "-"),
    },
    {
      chave: "quilometragem", rotulo: "KM",
      render: (o) => {
        const km = o.km_fechamento ?? o.quilometragem;
        return km ? `${numero(km)} km` : "-";
      },
    },
    {
      // Custo real depois do fechamento; antes, o estimado do registro.
      chave: "custo", rotulo: "Custo", ordenavel: true,
      render: (o) =>
        o.custo != null ? dinheiro(o.custo)
          : o.custo_estimado != null ? (
              <span className="celula-dupla" title="Custo estimado no registro">
                <span>{dinheiro(o.custo_estimado)}</span>
                <span>estimado</span>
              </span>
            )
            : "-",
    },
    { chave: "status", rotulo: "Situação", ordenavel: true, render: (o) => <Selo valor={o.status} /> },
    {
      chave: "gravidade", rotulo: "Prioridade", ordenavel: true,
      render: (o) => {
        const tom = { BAIXA: "verde", MEDIA: "amarelo", ALTA: "vermelho" }[o.gravidade];
        return <Selo texto={rotulo("gravidade", o.gravidade)} tom={tom} />;
      },
    },
    {
      chave: "ações", rotulo: "Ações",
      render: (o) => (
        <Acoes
          acoes={[
            { rotulo: "Visualizar", icone: "visualizar",
              aoClicar: () => navegar(`${base}/${o.id_os}`) },
            ...(podeGerenciar && !ENCERRADA.includes(o.status) && o.status !== "PENDENTE"
              ? [{ rotulo: "Fechar OS", icone: "concluir", aoClicar: () => setFechando(o) }]
              : []),
            ...(podeGerenciar && o.status !== "CANCELADA"
              ? [{ rotulo: o.status === "PENDENTE" ? "Completar OS" : "Editar", icone: "editar", aoClicar: () => editar(o) }]
              : []),
            ...(fiscalizacao ? [] : [{ rotulo: "Ver veículo", icone: "kpi-car",
              aoClicar: () => navegar(`/frotas/veiculos/${o.id_veiculo}`) }]),
            ...(podeGerenciar
              ? [{ rotulo: "Excluir", perigo: true, icone: "lixo", aoClicar: () => excluir(o) }]
              : []),
          ]}
        />
      ),
    },
  ];

  return (
    <PaginaLista
      trilha={[{ rotulo: fiscalizacao ? "Fiscalização" : "Frotas" }, { rotulo: "Manutenções" }]}
      titulo={fiscalizacao ? "Manutenções das Viaturas" : "Manutenções"}
      descricao={fiscalizacao
        ? "Ordens de serviço das viaturas: a Fiscalização solicita e acompanha; o Frotas completa e fecha."
        : "Histórico das ordens de serviço da frota: registro e fechamento."}
      acao={
        podeRegistrar && (
          <button className="botao botao--primario" onClick={() => setRegistrando({})}>
            <Icone nome="kpi-wrench" tamanho={15} /> Registrar OS
          </button>
        )
      }
      lista={lista}
      colunas={colunas}
      chaveDe={(o) => o.id_os}
      unidade="manutenções"
      vazio="Nenhuma manutenção encontrada com esses filtros."
      filtros={
        <>
          <Texto rotulo="Buscar" id="busca" placeholder="Placa, nº da OS, descrição ou oficina"
                 value={lista.filtros.busca}
                 onChange={(e) => lista.alterarFiltro("busca", e.target.value)} />
          <Selecao rotulo={fiscalizacao ? "Viatura" : "Veículo"} id="veiculo" vazio="Todos"
                   opcoes={veículos.map((v) => ({ valor: v.id_veiculo, rotulo: `${v.placa} - ${v.modelo}` }))}
                   value={lista.filtros.veiculo}
                   onChange={(e) => lista.alterarFiltro("veiculo", e.target.value)} />
          <Selecao rotulo="Tipo" id="tipo" vazio="Todos" opcoes={TIPOS_OS}
                   value={lista.filtros.tipo}
                   onChange={(e) => lista.alterarFiltro("tipo", e.target.value)} />
          <Selecao rotulo="Situação" id="status" vazio="Todas" opcoes={SITUACOES}
                   value={lista.filtros.status}
                   onChange={(e) => lista.alterarFiltro("status", e.target.value)} />
          <Selecao rotulo="Prioridade" id="gravidade" vazio="Todas" opcoes={PRIORIDADES_OS}
                   value={lista.filtros.gravidade}
                   onChange={(e) => lista.alterarFiltro("gravidade", e.target.value)} />
          <Periodo id="periodo" de={lista.filtros.dataDe} ate={lista.filtros.dataAte}
                   aoMudarDe={(v) => lista.alterarFiltro("dataDe", v)}
                   aoMudarAte={(v) => lista.alterarFiltro("dataAte", v)} />
        </>
      }
    >
      {registrando && (
        <RegistrarOs
          os={registrando.os}
          idVeiculo={registrando.idVeiculo}
          soViaturas={fiscalizacao}
          solicitacao={fiscalizacao && !registrando.os}
          aoFechar={() => setRegistrando(null)}
          aoSalvar={lista.recarregar}
        />
      )}
      {fechando && (
        <FecharOs os={fechando} aoFechar={() => setFechando(null)} aoSalvar={lista.recarregar} />
      )}
      {modalSenha}
    </PaginaLista>
  );
}
