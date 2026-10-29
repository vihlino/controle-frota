/**
 * AgendarInspecao.jsx - Janela "Agendar inspeção" (e "Editar inspeção" de uma
 * inspecao ainda PENDENTE, que e reagendar).
 *
 * Saiu de dentro de Inspecoes.jsx (29/10) para abrir tambem na aba Inspecoes
 * dos Detalhes do Veiculo e nos Detalhes da Inspecao, sem sair da tela.
 *
 * A proxima inspecao sai calculada pela frequencia: semanal +7 dias,
 * quinzenal +15, mensal +30.
 */
import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import Icone from "./Icone.jsx";
import { useConfirmacaoSenha } from "./ConfirmarSenha.jsx";
import { Texto, Selecao, Data, Area } from "./Campos.jsx";
import { api } from "../lib/api.js";
import { data } from "../lib/formato.js";

export const FREQUENCIAS = [
  { valor: "SEMANAL", rotulo: "Semanal" },
  { valor: "QUINZENAL", rotulo: "Quinzenal" },
  { valor: "MENSAL", rotulo: "Mensal" },
  { valor: "PERSONALIZADA", rotulo: "Personalizada" },
  { valor: "SEM_PERIODICIDADE", rotulo: "Sem periodicidade" },
];
const DIAS_POR_FREQUENCIA = { SEMANAL: 7, QUINZENAL: 15, MENSAL: 30 };

/**
 * @param {object} [inspecao]  Inspecao pendente a reagendar (editar).
 * @param {string|number} [idVeiculo]  Veiculo ja escolhido (agendar).
 */
export default function AgendarInspecao({ inspecao, idVeiculo = "", travarVeiculo = false, aoFechar, aoSalvar }) {
  const editando = Boolean(inspecao);
  const [veiculos, setVeiculos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [f, setF] = useState(() => (editando ? {
    id_veiculo: String(inspecao.id_veiculo ?? ""),
    id_gestor: String(inspecao.id_gestor ?? ""),
    tipo: inspecao.tipo || "MENSAL",
    data_realizacao: inspecao.data_realizacao ? String(inspecao.data_realizacao).slice(0, 10)
      : inspecao.data_programada ? String(inspecao.data_programada).slice(0, 10) : "",
    hora_inicio: inspecao.hora_inicio ? String(inspecao.hora_inicio).slice(0, 5) : "08:00",
    observacoes: inspecao.observacoes || "",
  } : {
    id_veiculo: idVeiculo ? String(idVeiculo) : "", id_gestor: "", tipo: "MENSAL",
    data_realizacao: "", hora_inicio: "08:00", observacoes: "",
  }));
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const { pedirSenha, elemento: modalSenha } = useConfirmacaoSenha();

  useEffect(() => {
    api("/frotas/veiculos/opcoes").then(setVeiculos).catch(() => {});
    // Rota de Frotas (09/10): a de usuarios exige Administracao.
    api("/frotas/responsaveis").then((r) => setUsuarios(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  const campo = (nome) => ({
    value: f[nome] ?? "",
    onChange: (e) => setF((x) => ({ ...x, [nome]: e.target.value })),
  });

  function proximaCalculada() {
    const dias = DIAS_POR_FREQUENCIA[f.tipo];
    if (!dias || !f.data_realizacao) return null;
    const d = new Date(`${f.data_realizacao}T12:00:00`);
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
  }
  const proxima = proximaCalculada();

  async function salvar(e) {
    e.preventDefault();
    setErro("");
    const dados = {
      id_veiculo: Number(f.id_veiculo),
      id_gestor: Number(f.id_gestor),
      tipo: f.tipo,
      data_realizacao: f.data_realizacao || null,
      data_programada: f.data_realizacao || null,
      hora_inicio: f.hora_inicio || null,
      observacoes: f.observacoes,
      proxima_inspecao: proxima,
    };
    setSalvando(true);
    try {
      if (editando) {
        const resposta = await pedirSenha({
          titulo: "Salvar alterações",
          aviso: "A alteração do agendamento fica registrada na auditoria, com o que estava antes.",
          justificativa: true,
        });
        if (!resposta.ok) return;
        await api(`/frotas/inspecoes/${inspecao.id_inspecao}`, {
          method: "PUT", body: { ...dados, justificativa: resposta.justificativa },
        });
      } else {
        await api("/frotas/inspecoes", { method: "POST", body: { ...dados, status: "ABERTA" } });
      }
      aoSalvar?.();
      aoFechar();
    } catch (e2) {
      setErro(e2.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Modal
        titulo={editando ? "Editar inspeção" : "Agendar inspeção"}
        icone="calendario-check"
        legenda="A próxima inspeção é calculada automaticamente pela frequência."
        aoFechar={aoFechar}
        rodape={
          <>
            <button type="button" className="botao" onClick={aoFechar}>Cancelar</button>
            <button className="botao botao--primario" form="form-agendar-inspecao" disabled={salvando}>
              <Icone nome="salvar" tamanho={15} monocromatico /> {salvando ? "Salvando..." : "Salvar"}
            </button>
          </>
        }
      >
        {erro && <div className="login__erro">{erro}</div>}
        <form id="form-agendar-inspecao" className="formulario-grade" onSubmit={salvar}>
          <Selecao rotulo="Veículo *" id="ai-veiculo" required vazio="Selecione o veículo"
                   disabled={travarVeiculo}
                   opcoes={veiculos.map((v) => ({ valor: v.id_veiculo, rotulo: `${v.placa} - ${v.marca} ${v.modelo}` }))}
                   {...campo("id_veiculo")} />
          <Selecao rotulo="Responsável *" id="ai-responsavel" required vazio="Selecione o responsável"
                   opcoes={usuarios.map((u) => ({ valor: u.id_usuario, rotulo: u.nome }))}
                   {...campo("id_gestor")} />
          <Selecao rotulo="Frequência *" id="ai-frequencia" required opcoes={FREQUENCIAS}
                   ajuda="Define automaticamente a próxima inspeção." {...campo("tipo")} />
          <Data rotulo="Data da inspeção *" id="ai-data" required {...campo("data_realizacao")} />
          <Texto rotulo="Hora *" id="ai-hora" type="time" required {...campo("hora_inicio")} />
          <div className="ai-proxima">
            <strong>Próxima inspeção</strong>
            <span><Icone nome="calendar" tamanho={15} />
              {!DIAS_POR_FREQUENCIA[f.tipo] ? "Não calculada nesta frequência"
                : proxima ? data(proxima) : "Será calculada automaticamente"}</span>
            <small>Com base na data da inspeção e na frequência selecionada.</small>
          </div>
          <Area rotulo="Observações" id="ai-observacoes" largo maxLength={500}
                placeholder="Ex.: Veículo em boas condições gerais" {...campo("observacoes")} />
        </form>
        <div className="aviso-info">
          <Icone nome="informacao" tamanho={22} />
          <span><strong>Cálculo automático</strong>
            A próxima inspeção será calculada automaticamente com base na data informada e na frequência selecionada.</span>
        </div>
      </Modal>
      {modalSenha}
    </>
  );
}
