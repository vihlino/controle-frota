/**
 * sessao.jsx - Quem esta logado, e o que essa pessoa pode fazer.
 */
import { createContext, useContext, useEffect, useState } from "react";
import { api, gravarToken, lerToken } from "./api.js";

const ContextoSessao = createContext(null);

export function ProvedorSessao({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);
  // Guardado para a tela poder dizer "o servidor nao respondeu" em vez de
  // fingir que ninguem esta logado.
  const [erroConexao, setErroConexao] = useState("");

  useEffect(() => {
    if (!lerToken()) {
      setCarregando(false);
      return;
    }
    // SO apaga o token quando o servidor DIZ que a sessao nao vale mais.
    //
    // Antes, qualquer falha aqui apagava o token: a API reiniciando (o
    // `node --watch` reinicia a cada arquivo salvo), um 429 do limite de
    // requisicoes, um 500 momentaneo. O efeito era sempre o mesmo - de volta
    // para a tela de entrada, com a senha certa sendo recusada ate o servidor
    // voltar. E cada nova tentativa gastava uma das 10 permitidas por 15
    // minutos, ate travar de vez.
    //
    // 401 e 403 sao o servidor respondendo "esta sessao acabou": ai sim,
    // apaga. Qualquer outra coisa e problema de rede ou do servidor, e o token
    // continua valendo - basta recarregar quando a API voltar.
    api("/sessao/eu")
      .then((r) => setUsuario(r.usuario))
      .catch((e) => {
        if (e.status === 401 || e.status === 403) gravarToken(null);
        else setErroConexao(e.message);
      })
      .finally(() => setCarregando(false));
  }, []);

  async function entrar(login, senha) {
    const r = await api("/sessao/login", { method: "POST", body: { login, senha } });
    gravarToken(r.token);
    setUsuario(r.usuario);
    return r.usuario;
  }

  /**
   * Troca a sessao pela que o servidor devolveu - usada depois de a pessoa
   * trocar a propria senha. O token antigo deixou de valer no instante da
   * troca; sem guardar o novo, a proxima tela a derrubaria para o login.
   */
  function atualizarSessao(token, novoUsuario) {
    gravarToken(token);
    setUsuario(novoUsuario);
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
    <ContextoSessao.Provider value={{ usuario, carregando, erroConexao, entrar, sair, podeVer, atualizarSessao }}>
      {children}
    </ContextoSessao.Provider>
  );
}

export function useSessao() {
  const contexto = useContext(ContextoSessao);
  if (!contexto) throw new Error("useSessao precisa estar dentro de <ProvedorSessao>");
  return contexto;
}
