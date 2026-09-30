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
import EditarInspecao from "../../components/EditarInspecao.jsx";
import { Texto, Selecao, Data, Area, Periodo } from "../../components/Campos.jsx";
import { useLista } from "../../components/useLista.js";
import { api } from "../../lib/api.js";
import { data, hora, numero, rotulo, ROTULOS, opcoes } from "../../lib/formato.js";
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
    busca: "", veiculo: parametros.get("veiculo") || "", tipo: "", status: "", analise: "",
    dataDe: "", dataAte: "",
  });
  const [veículos, setVeículos] = useState([]);
  const [usuários, setUsuários] = useState([]);
  const [agendando, setAgendando] = useState(false);
  /*
   * EDITAR TEM DOIS SENTIDOS, CONFORME A SITUACAO
   *
   * - PENDENTE: a inspecao ainda nao aconteceu. Editar reabre a janela de
   *   agendar com tudo preenchido (veiculo, responsavel, frequencia, data,
   *   hora) - e reagendar. `editandoId` guarda qual.
   * - CONCLUIDA: a data e o veiculo viraram fato. Editar abre os ITENS que o
   *   condutor marcou (EditarInspecao) - `corrigindo`. A API recusa trocar
   *   veiculo/data de inspecao ja feita.
   */
  const [editandoId, setEditandoId] = useState(null);
  const [corrigindo, setCorrigindo] = useState(null);
  const { pedirSenha, pedirExclusao, elemento: modalSenha } = useConfirmacaoSenha();
  const [formulario, setFormulario] = useState({
    id_veículo: "", id_gestor: "", tipo: "MENSAL", data_realizacao: "",
    hora_inicio: "08:00", observacoes: "",
  });
  const [erroForm, setErroForm] = useState("");
  const [salvando, setSalvando] = useState(false);

  const podeGerenciar = podeVer("FROTAS_REALIZAR_INSPECAO");

  function abrirAgendamento(idVeiculo = "") {
    setFormulario({
      id_veículo: idVeiculo, id_gestor: "", tipo: "MENSAL", data_realizacao: "",
      hora_inicio: "08:00", observacoes: "",
    });
    setEditandoId(null);
    setErroForm("");
    setAgendando(true);
  }

  /** Reabre a janela de agendar com a inspecao PENDENTE ja preenchida. */
  function abrirEdicao(i) {
    setFormulario({
      id_veículo: String(i.id_veiculo ?? ""),
      id_gestor: String(i.id_gestor ?? ""),
      tipo: i.tipo || "MENSAL",
      data_realizacao: i.data_realizacao ? String(i.data_realizacao).slice(0, 10) : "",
      hora_inicio: i.hora_inicio ? String(i.hora_inicio).slice(0, 5) : "",
      observacoes: i.observacoes || "",
    });
    setEditandoId(i.id_inspecao);
    setErroForm("");
    setAgendando(true);
  }

  /*
   * /frotas/inspecoes?agendar=1 abre a janela de agendar. E o que o atalho
   * "Agendar inspecao" do painel usa - antes ele levava a uma pagina separada,
   * com outro desenho. O parametro sai do endereco depois de usado, senao um
   * F5 abriria a janela de novo.
   */
  useEffect(() => {
    if (parametros.get("agendar")) {
      abrirAgendamento(parametros.get("veiculo") || "");
      navegar("/frotas/inspecoes", { replace: true });
    }
    // ?editar=ID vem do botao Editar da ficha de uma inspecao pendente.
    const idEditar = parametros.get("editar");
    if (idEditar) {
      navegar("/frotas/inspecoes", { replace: true });
      api(`/frotas/inspecoes/${idEditar}`)
        .then((i) => (i.status === "ABERTA" ? abrirEdicao(i) : setCorrigindo(i)))
        .catch((e) => alert(e.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function excluir(i) {
    const resposta = await pedirExclusao({
      titulo: "Excluir inspeção",
      oQue: `a inspeção do veículo ${i.placa}`,
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

  /** A proxima inspecao, pela frequencia e pela data escolhidas. */
  function proximaCalculada() {
    const dias = DIAS_POR_FREQUENCIA[formulario.tipo];
    if (!dias || !formulario.data_realizacao) return null;
    const d = new Date(`${formulario.data_realizacao}T12:00:00`);
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
  }

  async function agendar(e) {
    e.preventDefault();
    setSalvando(true);
    setErroForm("");
    try {
      // A proxima inspeção ja sai calculada pela frequencia escolhida.
      const proxima = proximaCalculada();
      const dados = {
        id_veiculo: Number(formulario.id_veículo),
        id_gestor: Number(formulario.id_gestor),
        tipo: formulario.tipo,
        data_realizacao: formulario.data_realizacao || null,
        data_programada: formulario.data_realizacao || null,
        hora_inicio: formulario.hora_inicio || null,
        observacoes: formulario.observacoes,
        proxima_inspecao: proxima,
      };

      if (editandoId) {
        // Reagendar tambem fica na auditoria, com o motivo: e o mesmo pedido
        // de senha e justificativa das outras alteracoes.
        const resposta = await pedirSenha({
          titulo: "Salvar alterações",
          aviso: "A alteração do agendamento fica registrada na auditoria, com o que estava antes.",
          justificativa: true,
        });
        if (!resposta.ok) return;
        await api(`/frotas/inspecoes/${editandoId}`, {
          method: "PUT",
          body: { ...dados, justificativa: resposta.justificativa },
        });
      } else {
        await api("/frotas/inspecoes", {
          method: "POST",
          body: { ...dados, status: "ABERTA" },
        });
      }
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
      /*
       * Nao e mais "Aprovado / Reprovado": uma inspecao com ressalva que
       * ninguem olhou ainda e "Em analise" - e e ela que a gestao precisa
       * abrir. Depois de alguem decidir (abrir OS ou registrar que nao
       * precisa), vira "Analisado".
       */
      chave: "analise", rotulo: "Resultado", ordenavel: true,
      render: (i) => {
        const r = ROTULOS.analiseInspecao[i.analise];
        return r ? <Selo texto={r.texto} tom={r.tom} /> : "-";
      },
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
            // Pendente: reagendar. Concluida: corrigir o que foi marcado.
            ...(podeGerenciar
              ? [{ rotulo: "Editar", icone: "editar",
                   aoClicar: () => (i.status === "ABERTA" ? abrirEdicao(i) : setCorrigindo(i)) }]
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
          <button className="botao botao--primario" onClick={() => abrirAgendamento()}>
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
          <Selecao rotulo="Resultado" id="analise" vazio="Todos"
                   opcoes={opcoes("analiseInspecao")}
                   value={lista.filtros.analise}
                   onChange={(e) => lista.alterarFiltro("analise", e.target.value)} />
          <Periodo id="periodo" de={lista.filtros.dataDe} ate={lista.filtros.dataAte}
                   aoMudarDe={(v) => lista.alterarFiltro("dataDe", v)}
                   aoMudarAte={(v) => lista.alterarFiltro("dataAte", v)} />
        </>
      }
    >
      {agendando && (
        <Modal
          titulo={editandoId ? "Editar inspeção" : "Agendar inspeção"}
          legenda="A próxima inspeção é calculada automaticamente pela frequência."
          aoFechar={() => setAgendando(false)}
          rodape={
            <>
              <button className="botao" onClick={() => setAgendando(false)}>
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
          <form id="form-inspeção" className="formulario-grade" onSubmit={agendar}>
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
            {/* Calculada, nao digitada: mostra na hora o que a frequencia
                escolhida vai gerar, ao lado da hora - que ficava sozinha na
                linha depois que o campo Local saiu. */}
            <Texto rotulo="Próxima inspeção" id="proxima_calculada" disabled
                   value={
                     !DIAS_POR_FREQUENCIA[formulario.tipo] ? "Não calculada nesta frequência"
                       : proximaCalculada() ? data(proximaCalculada()) : "Escolha a data"
                   } />
            <Area rotulo="Observações" id="observacoes" largo {...campo("observacoes")}  placeholder="Ex.: Veículo em boas condições gerais"/>
          </form>
        </Modal>
      )}

      {corrigindo && (
        <EditarInspecao
          inspecao={corrigindo}
          aoFechar={() => setCorrigindo(null)}
          aoSalvar={lista.recarregar}
        />
      )}

      {modalSenha}
    </PaginaLista>
  );
}
