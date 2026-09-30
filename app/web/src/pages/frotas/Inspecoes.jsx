/**
 * Inspeções.jsx - As inspeções periodicas dos veículos.
 *
 * O botao e "Agendar inspeção" (e nao "Nova"), porque e disso que se trata.
 *
 * Ao agendar, a data da proxima inspeção ja sai calculada pela frequencia
 * escolhida: semanal +7 dias, quinzenal +15, mensal +30.
 */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PaginaLista from "../../components/PaginaLista.jsx";
import Icone from "../../components/Icone.jsx";
import Selo from "../../components/Selo.jsx";
import Acoes from "../../components/Acoes.jsx";
import Modal from "../../components/Modal.jsx";
import { useConfirmacaoSenha } from "../../components/ConfirmarSenha.jsx";
import { Texto, Selecao, Data, Area, Periodo } from "../../components/Campos.jsx";
import { useLista } from "../../components/useLista.js";
import { api } from "../../lib/api.js";
import { data, hora, numero, rotulo } from "../../lib/formato.js";
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
  const [parametros] = useSearchParams();
  const lista = useLista("frotas/inspecoes", {
    busca: "", veiculo: parametros.get("veiculo") || "", tipo: "", status: "", dataDe: "", dataAte: "",
  });
  const [veículos, setVeículos] = useState([]);
  const [usuários, setUsuários] = useState([]);
  const [agendando, setAgendando] = useState(false);
  /*
   * A MESMA JANELA AGENDA E CORRIGE
   *
   * Sao os mesmos campos: o que muda e para onde vai (POST ou PUT) e o que se
   * exige antes de gravar. Duplicar o formulario so garantiria que um dia os
   * dois ficariam diferentes sem ninguem perceber.
   */
  const [editando, setEditando] = useState(null);
  const { pedirSenha, elemento: modalSenha } = useConfirmacaoSenha();
  const [formulario, setFormulario] = useState({
    id_veículo: "", id_gestor: "", tipo: "MENSAL", data_realizacao: "",
    hora_inicio: "08:00", observacoes: "",
  });
  const [erroForm, setErroForm] = useState("");
  const [salvando, setSalvando] = useState(false);

  const podeGerenciar = podeVer("FROTAS_REALIZAR_INSPECAO");

  function abrirEdicao(i) {
    setFormulario({
      id_veículo: i.id_veiculo ?? "",
      id_gestor: i.id_gestor ?? "",
      tipo: i.tipo || "MENSAL",
      data_realizacao: (i.data_realizacao || "").slice(0, 10),
      // O <input type="time"> recusa hora com microssegundos e esvazia o campo
      // em silencio; o banco grava assim.
      hora_inicio: (i.hora_inicio || "").slice(0, 5),
      observacoes: i.observacoes || "",
    });
    setErroForm("");
    setEditando(i.id_inspecao);
  }

  /** Corrigir e excluir pedem senha E motivo, que vai para a auditoria. */
  async function salvarEdicao(e) {
    e.preventDefault();
    setSalvando(true);
    setErroForm("");
    try {
      const resposta = await pedirSenha({
        titulo: "Salvar alterações",
        aviso: "Confirme sua senha para alterar esta inspeção.",
        justificativa: true,
      });
      if (!resposta.ok) {
        setSalvando(false);
        return;
      }
      await api(`/frotas/inspecoes/${editando}`, {
        method: "PUT",
        body: {
          justificativa: resposta.justificativa,
          id_veiculo: Number(formulario.id_veículo),
          id_gestor: Number(formulario.id_gestor),
          tipo: formulario.tipo,
          data_realizacao: formulario.data_realizacao || null,
          hora_inicio: formulario.hora_inicio || null,
          observacoes: formulario.observacoes,
        },
      });
      setEditando(null);
      lista.recarregar();
    } catch (e) {
      setErroForm(e.message);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(i) {
    const resposta = await pedirSenha({
      titulo: "Excluir inspeção",
      aviso:
        `Esta ação não pode ser desfeita: a inspeção do veículo ${i.placa} sai ` +
        `do histórico. Confirme sua senha para excluir.`,
      perigo: true,
      justificativa: true,
      rotuloJustificativa: "Justificativa da exclusão *",
    });
    if (!resposta.ok) return;
    try {
      await api(`/frotas/inspecoes/${i.id_inspecao}`, {
        method: "DELETE",
        body: { justificativa: resposta.justificativa },
      });
      lista.recarregar();
    } catch (e) {
      alert(e.message);
    }
  }

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
      // A hora fica junto da data, e nao em coluna propria: as duas respondem
      // "quando", e separadas obrigavam a ler duas colunas para montar uma
      // informacao so.
      chave: "hora_inicio", rotulo: "Horário",
      render: (i) => hora(i.hora_inicio),
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
    { chave: "responsavel", rotulo: "Responsável", ordenavel: true },
    {
      chave: "status", rotulo: "Situação", ordenavel: true,
      render: (i) => (
        <Selo
          texto={i.status === "ABERTA" ? "Pendente" : "Concluída"}
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
          acoes={[
            {
              rotulo: "Visualizar", icone: "visualizar",
              aoClicar: () => navegar(`/frotas/inspecoes/${i.id_inspecao}`),
            },
            ...(podeGerenciar
              ? [{ rotulo: "Editar", icone: "editar", aoClicar: () => abrirEdicao(i) }]
              : []),
            {
              rotulo: "Ver veículo", icone: "kpi-car",
              aoClicar: () => navegar(`/frotas/veiculos/${i.id_veiculo}`),
            },
            ...(podeGerenciar
              ? [{ rotulo: "Excluir", perigo: true, icone: "lixo",
                   aoClicar: () => excluir(i) }]
              : []),
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
            <Icone nome="calendar" tamanho={15} /> Agendar inspeção
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
          <Texto rotulo="Buscar" id="busca" placeholder="Placa, responsável ou número"
                 value={lista.filtros.busca}
                 onChange={(e) => lista.alterarFiltro("busca", e.target.value)} />
          <Selecao rotulo="Veículo" id="veículo" vazio="Todos"
                   opcoes={veículos.map((v) => ({ valor: v.id_veiculo, rotulo: `${v.placa} - ${v.modelo}` }))}
                   value={lista.filtros.veiculo}
                   onChange={(e) => lista.alterarFiltro("veiculo", e.target.value)} />
          <Selecao rotulo="Frequência" id="tipo" vazio="Todas" opcoes={FREQUENCIAS}
                   value={lista.filtros.tipo}
                   onChange={(e) => lista.alterarFiltro("tipo", e.target.value)} />
          <Selecao rotulo="Situação" id="status" vazio="Todas"
                   opcoes={[
                     { valor: "ABERTA", rotulo: "Pendente" },
                     { valor: "FINALIZADA", rotulo: "Concluída" },
                   ]}
                   value={lista.filtros.status}
                   onChange={(e) => lista.alterarFiltro("status", e.target.value)} />
          <Periodo id="periodo" de={lista.filtros.dataDe} ate={lista.filtros.dataAte}
                   aoMudarDe={(v) => lista.alterarFiltro("dataDe", v)}
                   aoMudarAte={(v) => lista.alterarFiltro("dataAte", v)} />
        </>
      }
    >
      {(agendando || editando) && (
        <Modal
          titulo={editando ? "Editar inspeção" : "Agendar inspeção"}
          legenda={
            editando
              ? "A alteração fica registrada na auditoria, com o valor anterior."
              : "A próxima inspeção e calculada automaticamente pela frequência."
          }
          aoFechar={() => { setAgendando(false); setEditando(null); }}
          rodape={
            <>
              <button className="botao"
                      onClick={() => { setAgendando(false); setEditando(null); }}>
                Cancelar
              </button>
              <button className="botao botao--primario" form="form-inspeção" disabled={salvando}>
                <Icone nome="salvar" tamanho={15} />
                {salvando ? " Salvando..." : " Salvar"}
              </button>
            </>
          }
        >
          {erroForm && <div className="login__erro">{erroForm}</div>}
          <form id="form-inspeção" className="formulario-grade"
                onSubmit={editando ? salvarEdicao : agendar}>
            <Selecao rotulo="Veículo *" id="id_veículo" required vazio="Selecione"
                     opcoes={veículos.map((v) => ({
                       valor: v.id_veiculo, rotulo: `${v.placa} - ${v.marca} ${v.modelo}`,
                     }))}
                     {...campo("id_veículo")} />
            <Selecao rotulo="Responsável *" id="id_gestor" required vazio="Selecione"
                     opcoes={usuários.map((u) => ({ valor: u.id_usuario, rotulo: u.nome }))}
                     {...campo("id_gestor")} />
            <Selecao rotulo="Frequência *" id="form-tipo" required opcoes={FREQUENCIAS}
                     {...campo("tipo")} />
            <Data rotulo="Data da inspeção *" id="data_realizacao" required
                  {...campo("data_realizacao")} />
            <Texto rotulo="Hora" id="hora_inicio" type="time" {...campo("hora_inicio")}  placeholder="Ex.: 08:30"/>
            <Area rotulo="Observações" id="observacoes" largo {...campo("observacoes")}  placeholder="Ex.: Veículo em boas condições gerais"/>
          </form>
        </Modal>
      )}

      {modalSenha}
    </PaginaLista>
  );
}
