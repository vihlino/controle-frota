/**
 * EditarInspecao.jsx - Corrigir o que foi marcado numa inspecao ja feita.
 *
 * Abre a MESMA lista de itens que o condutor preencheu pelo QR Code
 * (ItensInspecao), com o que ele marcou, e a observacao geral. So isso:
 * veiculo, responsavel, frequencia, data e hora sao o registro de quando e de
 * que a inspecao foi feita, e nao mudam por aqui.
 *
 * Salvar pede senha e justificativa, e a API guarda na auditoria o antes e o
 * depois de cada item. O resultado e recalculado: se a correcao cria uma
 * ressalva onde nao havia, a inspecao volta para "Em analise".
 */
import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import Icone from "./Icone.jsx";
import ItensInspecao from "./ItensInspecao.jsx";
import { useConfirmacaoSenha } from "./ConfirmarSenha.jsx";
import { api } from "../lib/api.js";
import { data } from "../lib/formato.js";

export default function EditarInspecao({ inspecao, aoFechar, aoSalvar }) {
  const { pedirSenha, elemento: modalSenha } = useConfirmacaoSenha();
  const [itens, setItens] = useState(null);
  const [observacoes, setObservacoes] = useState(inspecao.observacoes || "");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api(`/frotas/inspecoes/${inspecao.id_inspecao}/itens`)
      .then((r) => setItens((Array.isArray(r) ? r : []).map((i) => ({
        item: i.item, grupo: i.grupo, resultado: i.resultado, observacao: i.observacao || "",
      }))))
      .catch((e) => setErro(e.message));
  }, [inspecao.id_inspecao]);

  function marcar(indice, mudanca) {
    setItens((atual) => atual.map((it, i) => (i === indice ? { ...it, ...mudanca } : it)));
  }

  async function salvar() {
    setErro("");
    // Conferido antes da senha: descobrir o item sem observacao DEPOIS de
    // digitar senha e justificativa obrigaria a fazer tudo de novo.
    const semObs = itens.find((i) => i.resultado !== "NORMAL" && !i.observacao.trim());
    if (semObs) {
      setErro(`Escreva o que foi observado em "${semObs.item}".`);
      return;
    }
    const resposta = await pedirSenha({
      titulo: "Salvar alterações",
      aviso: "A correção dos itens fica registrada na auditoria, com o que estava marcado antes.",
      justificativa: true,
    });
    if (!resposta.ok) return;
    setSalvando(true);
    try {
      await api(`/frotas/inspecoes/${inspecao.id_inspecao}/itens`, {
        method: "PUT",
        body: { itens, observacoes, justificativa: resposta.justificativa },
      });
      aoSalvar?.();
      aoFechar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Modal
        titulo="Editar inspeção"
        legenda={`${inspecao.placa} · ${data(inspecao.data_realizacao)} · corrigir o que foi marcado`}
        largura={440}
        aoFechar={aoFechar}
        rodape={
          <>
            <button className="botao" onClick={aoFechar}>Cancelar</button>
            <button className="botao botao--primario" onClick={salvar} disabled={!itens || salvando}>
              <Icone nome="salvar" tamanho={15} monocromatico /> {salvando ? "Salvando..." : "Salvar"}
            </button>
          </>
        }
      >
        {erro && <div className="login__erro">{erro}</div>}
        {!itens ? (
          <div className="carregando">Carregando os itens...</div>
        ) : itens.length === 0 ? (
          <div className="vazio">Esta inspeção não tem itens registrados.</div>
        ) : (
          <ItensInspecao itens={itens} aoMudar={marcar} />
        )}
        <div className="campo">
          <label htmlFor="obs-edicao-inspecao">Observações</label>
          <textarea
            id="obs-edicao-inspecao"
            rows={3}
            value={observacoes}
            placeholder="Ex.: veículo conferido no pátio, sem pendências"
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </div>
      </Modal>
      {modalSenha}
    </>
  );
}
