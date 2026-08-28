/**
 * Inspeções.jsx - As inspeções periodicas dos veículos.
 *
 * O botao e "Agendar inspeção" (e nao "Nova"), porque e disso que se trata.
 *
 * Ao agendar, a data da proxima inspeção ja sai calculada pela frequencia
 * escolhida: semanal +7 dias, quinzenal +15, mensal +30.
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
import { data, numero, rotulo } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";

const FREQUENCIAS = [
  { valor: "SEMANAL", rotulo: "Semanal" },
  { valor: "QUINZENAL", rotulo: "Quinzenal" },
  { valor: "MENSAL", rotulo: "Mensal" },
  { valor: "PERSONALIZADA", rotulo: "Personalizada" },
  { valor: "SEM_PERIODICIDADE", rotulo: "Sem periodicidade" },
];
const DIAS_POR_FREQUENCIA = { SEMANAL: 7, QUINZENAL: 15, MENSAL: 30 };

export default function Inspeções() {
  const navegar = useNavigate();
  const { podeVer } = useSessao();
  const lista = useLista("frotas/inspecoes", {
    busca: "", veiculo: "", tipo: "", status: "", dataDe: "", dataAte: "",
  });
  const [veículos, setVeículos] = useState([]);
  const [usuários, setUsuários] = useState([]);
  const [agendando, setAgendando] = useState(false);
  const [formulario, setFormulario] = useState({
    id_veículo: "", id_gestor: "", tipo: "MENSAL", data_realizacao: "",
    hora_inicio: "08:00", local: "", observacoes: "",
  });
  const [erroForm, setErroForm] = useState("");
  const [salvando, setSalvando] = useState(false);

  const podeGerenciar = podeVer("FROTAS_REALIZAR_INSPECAO");

  useEffect(() => {
    api("/frotas/veiculos/opcoes").then(setVeículos).catch(() => {});
    api("/usuarios?porPagina=200").then((r) => setUsuários(r.itens)).catch(() => {});
  }, []);

  async function agendar(e) {
    e.preventDefault();
    setSalvando(true);
    setErroForm("");
    try {
      // A proxima inspeção ja sai calculada pela frequencia escolhida.
      const dias = DIAS_POR_FREQUENCIA[formulario.tipo];
      let proxima = null;
      if (dias && formulario.data_realizacao) {
        const d = new Date(`${formulario.data_realizacao}T12:00:00`);
        d.setDate(d.getDate() + dias);
        proxima = d.toISOString().slice(0, 10);
      }

      await api("/frotas/inspecoes", {
        method: "POST",
        body: {
          ...formulario,
          id_veiculo: Number(formulario.id_veículo),
          id_gestor: Number(formulario.id_gestor),
          data_programada: formulario.data_realizacao || null,
          proxima_inspecao: proxima,
          status: "ABERTA",
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
    {
      chave: "data_realizacao", rotulo: "Data da inspeção", ordenavel: true,
      render: (i) => (
        <span className="celula-dupla">
          <strong>{data(i.data_realizacao)}</strong>
          <span>{i.placa} — {i.marca} {i.modelo}</span>
        </span>
      ),
    },
    {
      chave: "placa", rotulo: "Veículo", ordenavel: true,
      render: (i) => (
        <span className="celula-dupla">
          <strong>{i.placa}</strong>
          <span>{`${i.marca} ${i.modelo}`}</span>
        </span>
      ),
    },
    {
      chave: "tipo", rotulo: "Frequência", ordenavel: true,
      render: (i) => {
        const CORES = { SEMANAL: "azul", QUINZENAL: "laranja", MENSAL: "verde", PERSONALIZADA: "amarelo" };
        const NOMES = { SEMANAL: "Semanal", QUINZENAL: "Quinzenal", MENSAL: "Mensal", PERSONALIZADA: "Personalizada", SEM_PERIODICIDADE: "Sem periodicidade" };
        return <Selo texto={NOMES[i.tipo] || i.tipo} tom={CORES[i.tipo] || "azul"} />;
      },
    },
    {
      chave: "proxima_inspecao", rotulo: "Próxima inspeção", ordenavel: true,
      render: (i) => data(i.proxima_inspecao || i.proxima_inspeção),
    },
    { chave: "responsavel", rotulo: "Responsavel", ordenavel: true },
    {
      chave: "status", rotulo: "Situação", ordenavel: true,
      render: (i) => (
        <Selo
          texto={i.status === "ABERTA" ? "Pendente" : "Concluida"}
          tom={i.status === "ABERTA" ? "amarelo" : "verde"}
        />
      ),
    },
    {
      chave: "resultado", rotulo: "Resultado",
      render: (i) =>
        !i.resultado ? (
          "-"
        ) : (
          <Selo
            texto={i.resultado === "CONFORME" ? "Aprovado" : "Reprovado"}
            tom={i.resultado === "CONFORME" ? "verde" : "vermelho"}
          />
        ),
    },
    {
      chave: "ações", rotulo: "Ações",
      render: (i) => (
        <Acoes
          ações={[
            {
              rotulo: "Visualizar detalhes",
              aoClicar: () => navegar(`/frotas/inspecoes/${i.id_inspecao}`),
            },
            {
              rotulo: "Ver veículo",
              aoClicar: () => navegar(`/frotas/veiculos/${i.id_veiculo}`),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <PaginaLista
      trilha={[{ rotulo: "Frotas" }, { rotulo: "Inspeções" }]}
      titulo="Inspeções"
      descricao="Acompanhe as inspeções periodicas agendadas para os veículos da frota."
      acao={
        podeGerenciar && (
          <button className="botao botao--primario" onClick={() => navegar("/frotas/inspecoes/nova")}>
            <Icone nome="calendar" tamanho={16} /> Agendar inspeção
          </button>
        )
      }
      lista={lista}
      colunas={colunas}
      chaveDe={(i) => i.id_inspecao}
      unidade="inspeções"
      vazio="Nenhuma inspeção encontrada com esses filtros."
      filtros={
        <>
          <Texto rotulo="Buscar" id="busca" placeholder="Placa, responsavel ou numero"
                 value={lista.filtros.busca}
                 onChange={(e) => lista.alterarFiltro("busca", e.target.value)} />
          <Selecao rotulo="Veículo" id="veículo" vazio="Todos"
                   opcoes={veículos.map((v) => ({ valor: v.id_veiculo, rotulo: `${v.placa} - ${v.modelo}` }))}
                   value={lista.filtros.veiculo}
                   onChange={(e) => lista.alterarFiltro("veiculo", e.target.value)} />
          <Selecao rotulo="Frequencia" id="tipo" vazio="Todas" opcoes={FREQUENCIAS}
                   value={lista.filtros.tipo}
                   onChange={(e) => lista.alterarFiltro("tipo", e.target.value)} />
          <Selecao rotulo="Situação" id="status" vazio="Todas"
                   opcoes={[
                     { valor: "ABERTA", rotulo: "Pendente" },
                     { valor: "FINALIZADA", rotulo: "Concluida" },
                   ]}
                   value={lista.filtros.status}
                   onChange={(e) => lista.alterarFiltro("status", e.target.value)} />
          <Data rotulo="De" id="dataDe" value={lista.filtros.dataDe}
                onChange={(e) => lista.alterarFiltro("dataDe", e.target.value)} />
          <Data rotulo="Ate" id="dataAte" value={lista.filtros.dataAte}
                onChange={(e) => lista.alterarFiltro("dataAte", e.target.value)} />
        </>
      }
    >
      {agendando && (
        <Modal
          titulo="Agendar inspeção"
          legenda="A proxima inspeção e calculada automaticamente pela frequencia."
          aoFechar={() => setAgendando(false)}
          rodape={
            <>
              <button className="botao" onClick={() => setAgendando(false)}>Cancelar</button>
              <button className="botao botao--primario" form="form-inspeção" disabled={salvando}>
                {salvando ? "Agendando..." : "Agendar inspeção"}
              </button>
            </>
          }
        >
          {erroForm && <div className="login__erro">{erroForm}</div>}
          <form id="form-inspeção" className="formulario-grade" onSubmit={agendar}>
            <Selecao rotulo="Veículo *" id="id_veículo" required vazio="Selecione"
                     opcoes={veículos.map((v) => ({
                       valor: v.id_veiculo, rotulo: `${v.placa} - ${v.marca} ${v.modelo}`,
                     }))}
                     {...campo("id_veículo")} />
            <Selecao rotulo="Responsavel *" id="id_gestor" required vazio="Selecione"
                     opcoes={usuários.map((u) => ({ valor: u.id_usuario, rotulo: u.nome }))}
                     {...campo("id_gestor")} />
            <Selecao rotulo="Frequencia *" id="tipo" required opcoes={FREQUENCIAS}
                     {...campo("tipo")} />
            <Data rotulo="Data da inspeção *" id="data_realizacao" required
                  {...campo("data_realizacao")} />
            <Texto rotulo="Hora" id="hora_inicio" type="time" {...campo("hora_inicio")} />
            <Texto rotulo="Local" id="local" placeholder="Ex.: Garagem Central"
                   {...campo("local")} />
            <Area rotulo="Observações" id="observacoes" largo {...campo("observacoes")} />
          </form>
        </Modal>
      )}
    </PaginaLista>
  );
}
