/**
 * sessao.jsx - Quem esta logado, e o que essa pessoa pode fazer.
 */
import { createContext, useContext, useEffect, useState } from "react";
import { api, gravarToken, lerToken } from "./api.js";

const ContextoSessao = createContext(null);

export function ProvedorSessao({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!lerToken()) {
      setCarregando(false);
      return;
    }
    api("/sessao/eu")
      .then((r) => setUsuario(r.usuario))
      .catch(() => gravarToken(null))
      .finally(() => setCarregando(false));
  }, []);

  async function entrar(login, senha) {
    const r = await api("/sessao/login", { method: "POST", body: { login, senha } });
    gravarToken(r.token);
    setUsuario(r.usuario);
    return r.usuario;
  }

  async function sair() {
    await api("/sessao/logout", { method: "POST" }).catch(() => {});
    gravarToken(null);
    setUsuario(null);
  }

  /**
   * Diz se o usuario tem uma permissao.
   * ATENCAO: isto e conveniencia visual, NAO seguranca. A protecao real esta no servidor.
   * @param {string} codigo  Ex.: "FROTAS_GERENCIAR_VEICULOS"
   * @returns {boolean}
   */
  function podeVer(codigo) {
    return !!(usuario?.permissoes || []).includes(codigo);
  }

  return (
    <ContextoSessao.Provider value={{ usuario, carregando, entrar, sair, podeVer }}>
      {children}
    </ContextoSessao.Provider>
  );
}

export function useSessao() {
  const contexto = useContext(ContextoSessao);
  if (!contexto) throw new Error("useSessao precisa estar dentro de <ProvedorSessao>");
  return contexto;
}
