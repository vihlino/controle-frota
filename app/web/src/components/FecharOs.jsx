/**
 * FecharOs.jsx - Pop-up "Fechamento de OS".
 *
 * Quando o servico volta da oficina, a gestao documenta o que foi feito.
 * Veiculo, prioridade e tipo vem da OS aberta e nao mudam aqui; oficina e
 * telefone vem preenchidos e podem ser ajustados.
 *
 * O KM vem com o ultimo registrado do veiculo e PRECISA ser confirmado, como
 * no checklist: se o checklist de ida para o mecanico nao foi feito, esse
 * numero pode estar velho. "Nao" libera o campo para digitar.
 *
 * Em OS ja fechada, a mesma janela serve para corrigir o fechamento - ai pede
 * justificativa e senha.
 */
import { useState } from "react";
import Modal from "./Modal.jsx";
import Icone from "./Icone.jsx";
import ItensOs from "./ItensOs.jsx";
import CampoDinheiro from "./CampoDinheiro.jsx";
import { useConfirmacaoSenha } from "./ConfirmarSenha.jsx";
import { Texto, Data, Area } from "./Campos.jsx";
import { api } from "../lib/api.js";
import { numero, numeroOs, rotulo } from "../lib/formato.js";

const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const soData = (v) => (v ? String(v).slice(0, 10) : "");
const texto = (v) => (v === null || v === undefined ? "" : String(v));

export default function FecharOs({ os, aoFechar, aoSalvar }) {
  const corrigindo = os.status === "RESOLVIDA";
  const { pedirSenha, elemento: modalSenha } = useConfirmacaoSenha();
  const kmInicial = corrigindo && os.km_fechamento != null ? os.km_fechamento : os.quilometragem_atual;
  const [kmConfere, setKmConfere] = useState(corrigindo ? true : null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [formulario, setFormulario] = useState({
    data_fechamento: soData(os.data_fechamento) || hoje(),
    km_fechamento: texto(kmInicial),
    oficina: texto(os.oficina),
    telefone_oficina: texto(os.telefone_oficina),
    servico_realizado: texto(os.servico_realizado || os.descricao),
    custo_final: texto(os.custo),
    data_conclusao: soData(os.data_conclusao),
    pecas_trocadas: texto(os.pecas_trocadas),
    observacoes_fechamento: texto(os.observacoes_fechamento),
  });
  // Primeiro fechamento: parte dos itens do registro (o que a oficina devia
  // olhar) para marcar o que foi feito. Corrigindo: a lista do fechamento.
  const [itens, setItens] = useState(() => {
    const base = os.itens_fechamento?.length ? os.itens_fechamento : os.itens;
    return base?.length ? base.map((i) => ({ ...i })) : [{ descricao: "", observacao: "" }];
  });

  const campo = (nome) => ({
    value: formulario[nome] ?? "",
    onChange: (e) => setFormulario((f) => ({ ...f, [nome]: e.target.value })),
  });

  async function salvar(e) {
    e.preventDefault();
    setErro("");
    if (kmConfere === null) {
      setErro("Confirme se o KM atual está correto (Sim ou Não).");
      return;
    }
    let justificativa;
    if (corrigindo) {
      const resposta = await pedirSenha({
        titulo: "Salvar alterações",
        aviso: "A correção do fechamento fica registrada na auditoria, com o que estava antes.",
        justificativa: true,
      });
      if (!resposta.ok) return;
      justificativa = resposta.justificativa;
    }
    setSalvando(true);
    try {
      await api(`/frotas/manutencoes/${os.id_os}/fechamento`, {
        method: "POST",
        body: {
          ...formulario,
          km_fechamento: Number(formulario.km_fechamento),
          km_confirmado: true,
          itens,
          justificativa,
        },
      });
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
        titulo={corrigindo ? (os.numero ? `Editar ${numeroOs(os.numero)}` : "Editar OS") : "Fechamento de OS"}
        legenda={corrigindo ? undefined : numeroOs(os.numero) || undefined}
        aoFechar={aoFechar}
        rodape={
          <>
            <button type="button" className="botao" onClick={aoFechar}>Cancelar</button>
            <button className="botao botao--primario" form="form-fechar-os" disabled={salvando}>
              <Icone nome="salvar" tamanho={15} monocromatico /> {salvando ? "Salvando..." : "Salvar"}
            </button>
          </>
        }
      >
        {erro && <div className="login__erro">{erro}</div>}
        <form id="form-fechar-os" className="formulario-grade" onSubmit={salvar}>
          <Texto rotulo="Veículo" id="fo-veiculo" disabled readOnly
                 value={`${os.placa} - ${os.marca} ${os.modelo}`} />
          <Data rotulo="Data de fechamento *" id="fo-data" required {...campo("data_fechamento")} />
          <Texto rotulo="Prioridade" id="fo-prioridade" disabled readOnly
                 value={rotulo("gravidade", os.gravidade)} />

          <div className="campo">
            <label htmlFor="fo-km">Quilometragem atual *</label>
            <div className="qr-km">
              <input id="fo-km" type="number" min="0" required inputMode="numeric"
                     value={formulario.km_fechamento} readOnly={kmConfere !== false}
                     onChange={(e) => setFormulario((f) => ({ ...f, km_fechamento: e.target.value }))} />
              <div className="qr-km__confirma" role="group" aria-label="O KM exibido está correto?">
                <button type="button" data-ativo={kmConfere === true}
                        onClick={() => {
                          setKmConfere(true);
                          if (!corrigindo) {
                            setFormulario((f) => ({ ...f, km_fechamento: texto(os.quilometragem_atual) }));
                          }
                        }}>
                  Sim
                </button>
                <button type="button" data-ativo={kmConfere === false}
                        onClick={() => setKmConfere(false)}>
                  Não
                </button>
              </div>
            </div>
            <span className="campo__ajuda">
              Último KM registrado: {numero(os.quilometragem_atual)} km. Marque "Não" se estiver
              errado para digitar o KM correto.
            </span>
          </div>

          <Texto rotulo="Tipo de manutenção" id="fo-tipo" disabled readOnly
                 value={rotulo("tipoOs", os.tipo)} />
          <Texto rotulo="Oficina / Fornecedor" id="fo-oficina" {...campo("oficina")} />
          <Texto rotulo="Telefone da oficina" id="fo-telefone" placeholder="(00) 00000-0000"
                 {...campo("telefone_oficina")} />
          <Area rotulo="Descrição / Serviço realizado *" id="fo-servico" largo required minLength={5}
                placeholder="Descreva o serviço que foi realizado..."
                {...campo("servico_realizado")} />

          <h3 className="modal-secao">Informações complementares (opcional)</h3>
          <CampoDinheiro rotulo="Custo final" id="fo-custo" valor={formulario.custo_final}
                         aoMudar={(v) => setFormulario((f) => ({ ...f, custo_final: v }))} />
          <Data rotulo="Data de finalização" id="fo-finalizacao" {...campo("data_conclusao")} />
          <Area rotulo="Peças trocadas" id="fo-pecas" largo
                placeholder="Liste as peças trocadas (se houver)..."
                {...campo("pecas_trocadas")} />
          <Area rotulo="Observações" id="fo-obs" largo placeholder="Observações adicionais..."
                {...campo("observacoes_fechamento")} />

          <h3 className="modal-secao">Itens verificados / serviços prestados</h3>
          <div className="campo" data-largo="sim">
            <ItensOs itens={itens} aoMudar={setItens} />
          </div>
        </form>
      </Modal>
      {modalSenha}
    </>
  );
}
