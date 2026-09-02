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
 */
import { useCallback, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import { api } from "../lib/api.js";

export function useConfirmacaoSenha() {
  const [pedido, setPedido] = useState(null);   // { titulo, aviso } ou null
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [verificando, setVerificando] = useState(false);
  // Guarda o resolve da Promise em aberto, para responder quando o usuario
  // confirmar ou cancelar.
  const resolver = useRef(null);

  const pedirSenha = useCallback((opcoes = {}) => {
    setSenha("");
    setErro("");
    setPedido({
      titulo: opcoes.titulo || "Confirme sua senha",
      aviso: opcoes.aviso || "",
      perigo: !!opcoes.perigo,
    });
    return new Promise((res) => {
      resolver.current = res;
    });
  }, []);

  function responder(ok) {
    setPedido(null);
    setSenha("");
    setErro("");
    resolver.current?.(ok);
    resolver.current = null;
  }

  async function conferir(e) {
    e.preventDefault();
    if (!senha) return;
    setVerificando(true);
    setErro("");
    try {
      await api("/sessao/confirmar", { method: "POST", body: { senha } });
      responder(true);
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
      largura={420}
      rodape={
        <>
          <button type="button" className="botao" onClick={() => responder(false)}>
            Cancelar
          </button>
          <button
            className={`botao ${pedido.perigo ? "botao--perigo" : "botao--primario"}`}
            form="form-confirmar-senha"
            disabled={verificando || !senha}
          >
            {verificando ? "Conferindo..." : "Confirmar"}
          </button>
        </>
      }
    >
      <form id="form-confirmar-senha" onSubmit={conferir} className="confirmar-senha">
        <p className="confirmar-senha__texto">
          {pedido.aviso || "Digite sua senha para confirmar esta ação."}
        </p>
        {erro && <div className="login__erro">{erro}</div>}
        <div className="campo">
          <label htmlFor="senha-confirmacao">Sua senha *</label>
          <input
            id="senha-confirmacao"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            value={senha}
            placeholder="Digite sua senha de acesso"
            onChange={(ev) => setSenha(ev.target.value)}
          />
        </div>
      </form>
    </Modal>
  ) : null;

  return { pedirSenha, elemento };
}
