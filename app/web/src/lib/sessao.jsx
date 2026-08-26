/**
 * sessao.jsx - Quem esta logado, e o que essa pessoa pode fazer.
 *
 * O QUE E UM "CONTEXT"
 * --------------------
 * No React, passar dados de uma tela para outra normalmente exige repassar de
 * componente em componente. O Context resolve isso: o dado e colocado no topo
 * da arvore (aqui, o ProvedorSessao envolve o app inteiro em main.jsx) e
 * qualquer componente la dentro pega direto, sem repasse.
 *
 * COMO USAR NAS TELAS
 * -------------------
 *     const { usuario, sair, podeVer } = useSessao();
 *
 *     usuario.nome                        -> "Joao Carlos Ferreira"
 *     podeVer("FROTAS_GERENCIAR_VEICULOS") -> true / false
 */
import { createContext, useContext, useEffect, useState } from "react";
import { api, gravarToken, lerToken } from "./api.js";

// O "canal" por onde os dados da sessao trafegam.
const ContextoSessao = createContext(null);

/**
 * Componente que envolve o aplicativo e fornece os dados da sessao.
 * Usado uma vez so, em main.jsx.
 */
export function ProvedorSessao({ children }) {
  const [usuario, setUsuario] = useState(null);
  // Comeca em true porque, ao abrir o app, ainda nao sabemos se existe sessao.
  // Sem esse estado, a tela de login apareceria por um instante para quem ja
  // esta logado, antes da confirmacao chegar.
  const [carregando, setCarregando] = useState(true);

  /**
   * Ao abrir o aplicativo: se existe um token guardado, confirma com o servidor
   * se ele ainda vale, antes de mostrar qualquer tela interna.
   *
   * Isso e necessario porque o token pode ter expirado enquanto a aba estava
   * fechada, ou o usuario pode ter sido desativado.
   *
   * O array vazio [] no fim significa "rode isto uma vez so, ao montar".
   */
  useEffect(() => {
    if (!lerToken()) {
      setCarregando(false);
      return;
    }
    api("/sessao/eu")
      .then((r) => setUsuario(r.usuario))
      .catch(() => gravarToken(null)) // token invalido: descarta
      .finally(() => setCarregando(false));
  }, []);

  /**
   * Faz login.
   * @param {string} login
   * @param {string} senha
   * @returns {Promise<object>} O usuario logado.
   * @throws {ErroApi} Se as credenciais estiverem erradas.
   */
  async function entrar(login, senha) {
    const r = await api("/sessao/login", { method: "POST", body: { login, senha } });
    gravarToken(r.token);
    setUsuario(r.usuario);
    return r.usuario;
  }

  /**
   * Faz logout.
   * Avisa o servidor (que registra o evento em log_acesso) e limpa o token.
   * O .catch vazio e proposital: se a chamada falhar, o logout local acontece
   * do mesmo jeito - ninguem deve ficar preso dentro do sistema.
   */
  async function sair() {
    await api("/sessao/logout", { method: "POST" }).catch(() => {});
    gravarToken(null);
    setUsuario(null);
  }

  /**
   * Diz se o usuario tem uma permissao.
   *
   * As permissoes vieram do perfil dele no momento do login. Serve para
   * esconder botoes e itens de menu.
   *
   * ATENCAO: isto e conveniencia visual, NAO seguranca. Quem souber montar uma
   * requisicao passa por aqui sem dificuldade. A protecao de verdade esta no
   * servidor, no exigePermissao() de api/src/auth.js. Toda tela escondida aqui
   * tem que ter a rota protegida la tambem.
   *
   * @param {string} codigo  Ex.: "FROTAS_GERENCIAR_VEICULOS"
   * @returns {boolean}
   */
  function podeVer(codigo) {
    return !!usuario?.permissoes?.includes(codigo);
  }

  return (
    <ContextoSessao.Provider value={{ usuario, carregando, entrar, sair, podeVer }}>
      {children}
    </ContextoSessao.Provider>
  );
}

/**
 * Hook que as telas usam para pegar os dados da sessao.
 * @returns {{usuario, carregando, entrar, sair, podeVer}}
 */
export function useSessao() {
  const contexto = useContext(ContextoSessao);
  // Se alguem usar este hook fora do provedor, o erro aparece aqui com uma
  // mensagem clara, em vez de um "cannot read property of null" mais adiante.
  if (!contexto) throw new Error("useSessao precisa estar dentro de <ProvedorSessao>");
  return contexto;
}
