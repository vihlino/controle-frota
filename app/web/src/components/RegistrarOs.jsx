/**
 * RegistrarOs.jsx - Pop-up "Registrar OS" (e "Editar OS", com a OS aberta).
 *
 * A gestao nao executa a manutencao: registra a OS que foi para a oficina,
 * para nao esquecer e para achar depois sem papel. Editar uma OS ainda
 * aberta reabre esta mesma janela, preenchida, e pede justificativa e senha.
 */
import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import Icone from "./Icone.jsx";
import ItensOs from "./ItensOs.jsx";
import CampoDinheiro from "./CampoDinheiro.jsx";
import { useConfirmacaoSenha } from "./ConfirmarSenha.jsx";
import { Texto, Selecao, Data, Area } from "./Campos.jsx";
import { api } from "../lib/api.js";
import { numero, numeroOs } from "../lib/formato.js";

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

export default function RegistrarOs({ os, idVeiculo = "", aoFechar, aoSalvar }) {
  const editando = Boolean(os);
  const { pedirSenha, elemento: modalSenha } = useConfirmacaoSenha();
  const [veiculos, setVeiculos] = useState([]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [formulario, setFormulario] = useState(() => ({
    id_veiculo: texto(os?.id_veiculo ?? idVeiculo),
    data_agendada: soData(os?.data_agendada),
    gravidade: os?.gravidade || "MEDIA",
    tipo: os?.tipo || "PREVENTIVA",
    oficina: texto(os?.oficina),
    responsavel_oficina: texto(os?.responsavel_oficina),
    telefone_oficina: texto(os?.telefone_oficina),
    descricao: texto(os?.descricao),
    custo_estimado: texto(os?.custo_estimado),
    prazo_previsto: soData(os?.prazo_previsto),
    pecas_necessarias: texto(os?.pecas_necessarias),
    observacoes: texto(os?.observacoes),
    quilometragem: texto(os?.quilometragem),
  }));
  // O KM vem do veiculo escolhido ate a pessoa digitar outro.
  const [kmDigitado, setKmDigitado] = useState(editando);
  const [itens, setItens] = useState(() =>
    os?.itens?.length ? os.itens.map((i) => ({ ...i })) : [{ descricao: "", observacao: "" }]
  );

  useEffect(() => {
    api("/frotas/veiculos/opcoes").then((r) => setVeiculos(Array.isArray(r) ? r : [])).catch(() => {});
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
    const corpo = { ...formulario, id_veiculo: Number(formulario.id_veiculo), itens };
    let justificativa;
    if (editando) {
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
        await api("/frotas/manutencoes/registro", { method: "POST", body: corpo });
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
        titulo={editando ? (os.numero ? `Editar ${numeroOs(os.numero)}` : "Editar OS") : "Registrar OS"}
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
          <Selecao rotulo="Veículo *" id="os-veiculo" required vazio="Selecione"
                   opcoes={veiculos.map((v) => ({
                     valor: v.id_veiculo, rotulo: `${v.placa} - ${v.marca} ${v.modelo}`,
                   }))}
                   {...campo("id_veiculo")} />
          <Data rotulo="Data agendada *" id="os-data" required {...campo("data_agendada")} />
          <Selecao rotulo="Prioridade *" id="os-prioridade" required opcoes={PRIORIDADES_OS}
                   {...campo("gravidade")} />
          <Texto rotulo="KM no registro" id="os-km" type="number" min="0" step="1"
                 inputMode="numeric" placeholder="Selecione o veículo"
                 ajuda={veiculo ? `Último KM registrado do veículo: ${numero(veiculo.quilometragem_atual)} km.` : undefined}
                 value={formulario.quilometragem}
                 onChange={(e) => {
                   setKmDigitado(true);
                   setFormulario((f) => ({ ...f, quilometragem: e.target.value }));
                 }} />
          <Selecao rotulo="Tipo de manutenção *" id="os-tipo" required opcoes={TIPOS_OS}
                   {...campo("tipo")} />
          <Texto rotulo="Oficina / Fornecedor *" id="os-oficina" required
                 placeholder="Nome da oficina" {...campo("oficina")} />
          <Texto rotulo="Responsável pela oficina" id="os-resp-oficina"
                 placeholder="Nome do responsável" {...campo("responsavel_oficina")} />
          <Texto rotulo="Telefone da oficina" id="os-telefone"
                 placeholder="(00) 00000-0000" {...campo("telefone_oficina")} />
          <Area rotulo="Descrição / Serviço a ser realizado *" id="os-descricao" largo required
                minLength={5} placeholder="Descreva o serviço ou manutenção a ser realizado..."
                {...campo("descricao")} />

          <h3 className="modal-secao">Informações complementares (opcional)</h3>
          <CampoDinheiro rotulo="Custo estimado" id="os-custo" valor={formulario.custo_estimado}
                         aoMudar={(v) => setFormulario((f) => ({ ...f, custo_estimado: v }))} />
          <Data rotulo="Prazo previsto" id="os-prazo" {...campo("prazo_previsto")} />
          <Area rotulo="Peças necessárias" id="os-pecas" largo
                placeholder="Liste as peças necessárias (se houver)..."
                {...campo("pecas_necessarias")} />
          <Area rotulo="Observações" id="os-obs" largo placeholder="Observações adicionais..."
                {...campo("observacoes")} />

          <h3 className="modal-secao">Itens a serem verificados / serviços</h3>
          <div className="campo" data-largo="sim">
            <ItensOs itens={itens} aoMudar={setItens} />
          </div>
        </form>
      </Modal>
      {modalSenha}
    </>
  );
}
