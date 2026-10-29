/**
 * RegistrarOs.jsx - Pop-up "Registrar OS" (e "Editar OS", com a OS aberta).
 *
 * A gestao nao executa a manutencao: registra a OS que foi para a oficina,
 * para nao esquecer e para achar depois sem papel. Editar uma OS ainda
 * aberta reabre esta mesma janela, preenchida, e pede justificativa e senha.
 *
 * 18/10 - SOLICITACAO DA FISCALIZACAO (`solicitacao`): a Fiscalizacao nao
 * registra a oficina, o custo ou as pecas - ela pede o servico da viatura.
 * A janela mostra so veiculo, prioridade, data do ocorrido, KM atual, tipo,
 * descricao, observacoes e itens; a OS nasce "Pendente" e o Frotas completa
 * (a mesma janela, em "Completar OS", sem pedir justificativa).
 * Nas duas: Responsavel, Data e Horario da OS vem sozinhos (quem esta
 * registrando, agora).
 */
import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import Icone from "./Icone.jsx";
import ItensOs from "./ItensOs.jsx";
import CampoDinheiro from "./CampoDinheiro.jsx";
import { useConfirmacaoSenha } from "./ConfirmarSenha.jsx";
import { Texto, Selecao, Data, Area } from "./Campos.jsx";
import { api } from "../lib/api.js";
import { data as dataBr, hora as horaBr, numero, numeroOs } from "../lib/formato.js";
import { useSessao } from "../lib/sessao.jsx";
import TituloSecao from "./TituloSecao.jsx";

export const TIPOS_OS = [
  { valor: "PREVENTIVA", rotulo: "Preventiva" },
  { valor: "CORRETIVA", rotulo: "Corretiva" },
];
export const PRIORIDADES_OS = [
  { valor: "BAIXA", rotulo: "Baixa" },
  { valor: "MEDIA", rotulo: "Média" },
  { valor: "ALTA", rotulo: "Alta" },
];

const soData = (v) => (v ? String(v).slice(0, 10) : "");
const texto = (v) => (v === null || v === undefined ? "" : String(v));

/*
 * Pela INSPECAO (botao "Abrir OS" da ficha): a mesma janela, com `inspecao`
 * = { id, numero, id_veiculo } e `inicial` = { descricao, gravidade, itens }
 * vindos dos itens com ressalva.
 * Pelo CHECKLIST (aba Manutencao dos Detalhes do Checklist, 29/10): `checklist`
 * = { id }; a OS nasce ligada a ele (origem CHECKLIST_FROTAS) e o veiculo trava.
 * O veiculo fica travado no da inspecao, e a OS
 * nasce ligada a ela.
 */
export default function RegistrarOs({ os, idVeiculo = "", inspecao, checklist, inicial, aoFechar, aoSalvar, soViaturas = false, solicitacao = false }) {
  const editando = Boolean(os);
  const { usuario } = useSessao();
  // Frotas completando a OS que a Fiscalizacao solicitou.
  const completando = editando && os.status === "PENDENTE";
  const [agora] = useState(() => new Date());
  const { pedirSenha, elemento: modalSenha } = useConfirmacaoSenha();
  const [veiculos, setVeiculos] = useState([]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [formulario, setFormulario] = useState(() => ({
    id_veiculo: texto(os?.id_veiculo ?? inspecao?.id_veiculo ?? idVeiculo),
    data_agendada: soData(os?.data_agendada),
    gravidade: os?.gravidade || inicial?.gravidade || "MEDIA",
    tipo: os?.tipo || inicial?.tipo || (inspecao ? "CORRETIVA" : "PREVENTIVA"),
    oficina: texto(os?.oficina),
    responsavel_oficina: texto(os?.responsavel_oficina),
    telefone_oficina: texto(os?.telefone_oficina),
    descricao: texto(os?.descricao ?? inicial?.descricao),
    custo_estimado: texto(os?.custo_estimado),
    prazo_previsto: soData(os?.prazo_previsto),
    pecas_necessarias: texto(os?.pecas_necessarias),
    observacoes: texto(os?.observacoes),
    quilometragem: texto(os?.quilometragem),
    data_ocorrido: soData(os?.data_ocorrido),
  }));
  // O KM vem do veiculo escolhido ate a pessoa digitar outro.
  const [kmDigitado, setKmDigitado] = useState(editando);
  const [itens, setItens] = useState(() => {
    const base = os?.itens?.length ? os.itens : inicial?.itens;
    return base?.length ? base.map((i) => ({ ...i })) : [{ descricao: "", observacao: "" }];
  });

  useEffect(() => {
    // Na Fiscalizacao (09/10) so as viaturas.
    api(`/frotas/veiculos/opcoes${soViaturas ? "?viatura=true" : ""}`)
      .then((r) => setVeiculos(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  const campo = (nome) => ({
    value: formulario[nome] ?? "",
    onChange: (e) => setFormulario((f) => ({ ...f, [nome]: e.target.value })),
  });

  const veiculo = veiculos.find((v) => String(v.id_veiculo) === String(formulario.id_veiculo));
  useEffect(() => {
    if (kmDigitado || !veiculo) return;
    setFormulario((f) => ({ ...f, quilometragem: texto(veiculo.quilometragem_atual) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veiculo?.id_veiculo]);

  async function salvar(e) {
    e.preventDefault();
    setErro("");
    const corpo = { ...formulario, id_veiculo: Number(formulario.id_veiculo), itens, ...(solicitacao ? { solicitacao: true } : {}) };
    let justificativa;
    if (completando) {
      const ok = await pedirSenha({
        titulo: "Completar OS",
        aviso: "Confirme sua senha para completar a OS solicitada pela Fiscalização.",
      });
      if (!ok) return;
    } else if (editando) {
      const resposta = await pedirSenha({
        titulo: "Salvar alterações",
        aviso: "A alteração da OS fica registrada na auditoria, com o que estava antes.",
        justificativa: true,
      });
      if (!resposta.ok) return;
      justificativa = resposta.justificativa;
    }
    setSalvando(true);
    try {
      if (editando) {
        await api(`/frotas/manutencoes/${os.id_os}/registro`, {
          method: "PUT", body: { ...corpo, justificativa },
        });
      } else {
        await api("/frotas/manutencoes/registro", {
          method: "POST",
          body: inspecao ? { ...corpo, id_inspecao: inspecao.id } : checklist ? { ...corpo, id_checklist: checklist.id } : corpo,
        });
      }
      aoSalvar?.();
      aoFechar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Modal
        titulo={completando ? `Completar OS${os.numero ? ` ${numeroOs(os.numero)}` : ""}`
          : editando ? (os.numero ? `Editar Registro ${numeroOs(os.numero)}` : "Editar Registro da OS")
            : "Registrar OS"}
        legenda={inspecao && !editando ? `Vinculada à inspeção ${inspecao.numero || ""}`.trim()
          : checklist && !editando ? `Vinculada ao checklist #CK-${checklist.id}`
          : solicitacao ? "A OS vai para o Frotas completar com a oficina, o responsável e o custo."
            : completando ? "Solicitada pela Fiscalização. Preencha a oficina e o que mais souber; a OS passa para Em análise."
              : editando ? "Atualize as informações da ordem de serviço." : "Registre uma nova ordem de serviço (OS) para o veículo."}
        aoFechar={aoFechar}
        rodape={
          <>
            <button type="button" className="botao" onClick={aoFechar}>Cancelar</button>
            <button className="botao botao--primario" form="form-registrar-os" disabled={salvando}>
              <Icone nome="salvar" tamanho={15} monocromatico /> {salvando ? "Salvando..." : "Salvar"}
            </button>
          </>
        }
      >
        {erro && <div className="login__erro">{erro}</div>}
        <form id="form-registrar-os" className="formulario-grade" onSubmit={salvar}>
          <TituloSecao>Informações da ordem de serviço</TituloSecao>
          {/* Preenchidos sozinhos (18/10): quem registra, e quando. */}
          <Texto rotulo="Responsável pela OS" id="os-responsavel" disabled readOnly
                 value={editando ? (os.solicitante || "—") : (usuario?.nome || "")} />
          <Texto rotulo="Data da OS" id="os-data-abertura" disabled readOnly
                 value={editando && os.data_abertura ? dataBr(os.data_abertura) : agora.toLocaleDateString("pt-BR")} />
          <Texto rotulo="Horário da OS" id="os-hora-abertura" disabled readOnly
                 value={editando && os.data_abertura ? horaBr(String(os.data_abertura).slice(11, 16))
                   : agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} />
          <TituloSecao>Dados do veículo e agendamento</TituloSecao>
          <Selecao rotulo="Veículo *" id="os-veiculo" required vazio="Selecione o veículo"
                   disabled={Boolean(inspecao || checklist)}
                   opcoes={veiculos.map((v) => ({
                     valor: v.id_veiculo, rotulo: `${v.placa} - ${v.marca} ${v.modelo}`,
                   }))}
                   {...campo("id_veiculo")} />
          {(solicitacao || formulario.data_ocorrido) && (
            <Data rotulo={solicitacao ? "Data do ocorrido *" : "Data do ocorrido"} id="os-ocorrido"
                  required={solicitacao} {...campo("data_ocorrido")} />
          )}
          {!solicitacao && <Data rotulo="Data agendada *" id="os-data" required {...campo("data_agendada")} />}
          <Selecao rotulo="Prioridade *" id="os-prioridade" required opcoes={PRIORIDADES_OS}
                   {...campo("gravidade")} />
          <Texto rotulo="KM atual" id="os-km" type="number" min="0" step="1"
                 inputMode="numeric" placeholder="Selecione o veículo"
                 ajuda={veiculo ? `Último KM registrado do veículo: ${numero(veiculo.quilometragem_atual)} km.` : undefined}
                 value={formulario.quilometragem}
                 onChange={(e) => {
                   setKmDigitado(true);
                   setFormulario((f) => ({ ...f, quilometragem: e.target.value }));
                 }} />
          <Selecao rotulo="Tipo de manutenção *" id="os-tipo" required opcoes={TIPOS_OS}
                   {...campo("tipo")} />
          {!solicitacao && (
            <>
              <Texto rotulo="Oficina / Fornecedor *" id="os-oficina" required
                     placeholder="Nome da oficina" {...campo("oficina")} />
              <Texto rotulo="Responsável pela oficina" id="os-resp-oficina"
                     placeholder="Nome do responsável" {...campo("responsavel_oficina")} />
              <Texto rotulo="Telefone da oficina" id="os-telefone"
                     placeholder="(00) 00000-0000" {...campo("telefone_oficina")} />
            </>
          )}
          <TituloSecao>Descrição do serviço</TituloSecao>
          <Area rotulo="Descrição / Serviço a ser realizado *" id="os-descricao" largo required maxLength={1000}
                minLength={5} placeholder="Descreva o serviço ou manutenção a ser realizado..."
                {...campo("descricao")} />

          {!solicitacao && (
            <>
              <TituloSecao>Informações complementares (opcional)</TituloSecao>
              <CampoDinheiro rotulo="Custo estimado" id="os-custo" valor={formulario.custo_estimado}
                             aoMudar={(v) => setFormulario((f) => ({ ...f, custo_estimado: v }))} />
              <Data rotulo="Prazo previsto" id="os-prazo" {...campo("prazo_previsto")} />
              <Area rotulo="Peças necessárias" id="os-pecas" largo maxLength={500}
                    placeholder="Liste as peças necessárias (se houver)..."
                    {...campo("pecas_necessarias")} />
            </>
          )}
          <TituloSecao>Itens a serem verificados / serviços</TituloSecao>
          <div className="campo" data-largo="sim">
            <ItensOs itens={itens} aoMudar={setItens} />
          </div>

          <TituloSecao>Observações (opcional)</TituloSecao>
          <Area rotulo="Observações" id="os-obs" largo maxLength={500} placeholder="Observações adicionais..."
                {...campo("observacoes")} />
        </form>
      </Modal>
      {modalSenha}
    </>
  );
}
