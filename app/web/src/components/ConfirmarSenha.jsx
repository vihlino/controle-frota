/**
 * ConfirmarSenha.jsx - Pede a senha antes de uma acao que altera ou apaga.
 *
 * POR QUE ISTO EXISTE
 * -------------------
 * O login prova quem ENTROU; nao prova quem esta na frente do computador
 * agora. Numa sala compartilhada, uma sessao aberta e esquecida deixa qualquer
 * pessoa apagar um cadastro em nome de outra - e a auditoria registraria o
 * nome errado, o que e pior do que nao registrar nada.
 *
 * COMO USAR
 *
 *   const { pedirSenha, elemento } = useConfirmacaoSenha();
 *
 *   async function excluir() {
 *     if (!(await pedirSenha({ titulo: "Excluir servidor" }))) return;
 *     ...
 *   }
 *
 *   return <>{elemento}...</>;
 *
 * pedirSenha() devolve uma Promise que resolve true (senha conferida) ou
 * false (cancelou). Quem chama nao precisa saber de estado nem de modal.
 *
 * JUSTIFICATIVA NO MESMO LUGAR
 * ----------------------------
 * Com `justificativa: true`, a caixa pede tambem o MOTIVO da alteracao, e a
 * Promise resolve { ok: true, justificativa: "..." } em vez de true.
 *
 * As duas perguntas vivem juntas porque sao o mesmo momento: a pessoa para,
 * assume a alteracao e diz por que. Pedir o motivo no formulario e a senha
 * depois separava uma coisa so em dois passos - e quem escrevesse a
 * justificativa antes ainda podia desistir na senha, deixando o texto
 * escrito para nada.
 *
 * Quem NAO pede justificativa continua recebendo true/false: nenhuma das
 * dezenas de chamadas existentes precisou mudar.
 */
import { useCallback, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import Icone from "./Icone.jsx";
import { api } from "../lib/api.js";

export function useConfirmacaoSenha() {
  const [pedido, setPedido] = useState(null);   // { titulo, aviso } ou null
  const [senha, setSenha] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [erro, setErro] = useState("");
  const [verificando, setVerificando] = useState(false);
  // Guarda o resolve da Promise em aberto, para responder quando o usuario
  // confirmar ou cancelar.
  const resolver = useRef(null);

  const pedirSenha = useCallback((opcoes = {}) => {
    setSenha("");
    setJustificativa("");
    setErro("");
    setPedido({
      titulo: opcoes.titulo || "Confirme sua senha",
      aviso: opcoes.aviso || "",
      perigo: !!opcoes.perigo,
      justificativa: !!opcoes.justificativa,
      rotuloJustificativa: opcoes.rotuloJustificativa || "Justificativa da alteração *",
      dicaJustificativa:
        opcoes.dicaJustificativa ||
        "Ex.: condutor informou 100 km a menos; corrigido conforme foto do painel",
    });
    return new Promise((res) => {
      resolver.current = res;
    });
  }, []);

  /**
   * A exclusao padronizada do sistema inteiro.
   *
   * Todas as telas diziam a mesma coisa de jeitos diferentes ("Esta acao nao
   * pode ser desfeita. Confirme sua senha para excluir este registro", "Excluir
   * o documento X?"), e so algumas pediam o motivo. Agora toda exclusao passa
   * por aqui: a mesma frase, mudando so O QUE sai, e sempre com senha e
   * justificativa - a API tambem recusa exclusao sem motivo (crud.js).
   *
   * @param {object} p
   * @param {string} p.titulo  Ex.: "Excluir inspeção".
   * @param {string} p.oQue    Ex.: "a inspeção do veículo GSQ1E87".
   * @returns {Promise<{ok: boolean, justificativa: string}>}
   */
  const pedirExclusao = useCallback(({ titulo, oQue }) => pedirSenha({
    titulo: titulo || "Excluir",
    aviso: `Esta ação não pode ser desfeita: ${oQue} não irá constar do histórico.`,
    perigo: true,
    justificativa: true,
    rotuloJustificativa: "Justificativa da exclusão *",
    dicaJustificativa: "Ex.: cadastrado em duplicidade; o correto é o registro de 12/09",
  }), [pedirSenha]);

  /*
   * O formato da resposta acompanha o que foi PEDIDO.
   *
   * Sem justificativa: true/false, como sempre foi.
   * Com justificativa: { ok, justificativa } - e no cancelamento tambem um
   * objeto, para quem chama poder testar `resposta.ok` sem se preocupar com
   * o caso do cancelamento ter vindo em outro formato.
   */
  function responder(ok, comJustificativa) {
    const pedeMotivo = pedido?.justificativa;
    const texto = justificativa;
    setPedido(null);
    setSenha("");
    setJustificativa("");
    setErro("");
    resolver.current?.(
      pedeMotivo ? { ok, justificativa: ok ? (comJustificativa ?? texto) : "" } : ok
    );
    resolver.current = null;
  }

  async function conferir(e) {
    e.preventDefault();
    if (!senha) return;
    // A mesma regra da API (5 caracteres), conferida aqui para a pessoa nao
    // descobrir depois de digitar a senha.
    if (pedido.justificativa && justificativa.trim().length < 5) {
      setErro(pedido.perigo ? "Escreva a justificativa da exclusão." : "Escreva a justificativa da alteração.");
      return;
    }
    setVerificando(true);
    setErro("");
    try {
      await api("/sessao/confirmar", { method: "POST", body: { senha } });
      responder(true, justificativa.trim());
    } catch (err) {
      // Erro NAO fecha o modal: a pessoa pode ter errado a digitacao e deve
      // poder tentar de novo sem refazer o caminho todo.
      setErro(err.message || "Não foi possível confirmar a senha.");
    } finally {
      setVerificando(false);
    }
  }

  const elemento = pedido ? (
    <Modal
      titulo={pedido.titulo}
      aoFechar={() => responder(false)}
      // Editar e Excluir do MESMO tamanho: sao a mesma pergunta (quem e voce e
      // por que), e janelas de larguras diferentes pareciam coisas diferentes.
      largura={480}
      compacto
      rodape={
        <>
          <button type="button" className="botao" onClick={() => responder(false)}>
            Cancelar
          </button>
          <button
            className={`botao ${pedido.perigo ? "botao--perigo" : "botao--primario"}`}
            form="form-confirmar-senha"
            disabled={
              verificando || !senha ||
              (pedido.justificativa && justificativa.trim().length < 5)
            }
          >
            <Icone nome={pedido.perigo ? "lixo" : "salvar"} tamanho={15} monocromatico />{" "}
            {verificando ? "Conferindo..." : "Confirmar"}
          </button>
        </>
      }
    >
      <form id="form-confirmar-senha" onSubmit={conferir} className="confirmar-senha">
        {/* A frase e uma OBSERVACAO sobre o que vai acontecer - menor e no
            centro, para nao competir com os campos, que sao o que a pessoa
            precisa preencher. */}
        <p className="confirmar-senha__texto confirmar-senha__texto--nota">
          {pedido.aviso || "Digite sua senha para confirmar esta ação."}
        </p>
        {erro && <div className="login__erro">{erro}</div>}

        {/* O motivo vem ANTES da senha: e o que exige pensar. A senha e
            mecanica, e fecha a acao. */}
        {pedido.justificativa && (
          <div className="campo">
            <label htmlFor="justificativa-confirmacao">{pedido.rotuloJustificativa}</label>
            <textarea
              id="justificativa-confirmacao"
              rows={3}
              required
              minLength={5}
              value={justificativa}
              placeholder={pedido.dicaJustificativa}
              onChange={(ev) => setJustificativa(ev.target.value)}
            />
          </div>
        )}

        {/* A senha nao precisa da largura da caixa: sao poucos caracteres, e
            um campo esticado sugere um texto longo. A justificativa acima, que
            e texto de verdade, fica com a largura inteira. */}
        <div className="campo campo--senha">
          <label htmlFor="senha-confirmacao">Sua senha *</label>
          <input
            id="senha-confirmacao"
            type="password"
            autoComplete="current-password"
            autoFocus={!pedido.justificativa}
            required
            value={senha}
            placeholder="Digite sua senha de acesso"
            onChange={(ev) => setSenha(ev.target.value)}
          />
        </div>
      </form>
    </Modal>
  ) : null;

  return { pedirSenha, pedirExclusao, elemento };
}
