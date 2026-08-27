/**
 * Login.jsx - A tela de entrada.
 *
 * Manda login e senha para a API e, dando certo, guarda o token e vai para o
 * Dashboard. O erro aparece na propria tela, com o que foi digitado ainda ali.
 *
 * A mensagem de erro e sempre a mesma para login inexistente e senha errada -
 * o servidor faz questao disso, para nao revelar quais logins existem.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icone from "../components/Icone.jsx";
import { useSessao } from "../lib/sessao.jsx";

export default function Login() {
  const { entrar } = useSessao();
  const navegar = useNavigate();
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function aoEnviar(e) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      await entrar(login, senha);
      navegar("/dashboard", { replace: true });
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <div className="login__marca">
        <div className="login__logo">
          <img src="/icons/logo-sitra.svg" alt="" />
          <div>
            <div className="login__logo-nome">SITRA</div>
            <div className="login__logo-sub">Sistema Integrado de Gestão Publica</div>
          </div>
        </div>
        <p className="login__frase">
          Frota, fiscalização e relatórios da CMTT em um so lugar, com registro de
          tudo o que acontece.
        </p>
        <div className="login__módulos">
          <span className="login__módulo">
            <Icone nome="nav-frotas" tamanho={18} /> Frotas
          </span>
          <span className="login__módulo">
            <Icone nome="nav-fiscalizacao" tamanho={18} /> Fiscalização
          </span>
          <span className="login__módulo">
            <Icone nome="chart-line" tamanho={18} /> Relatórios
          </span>
          <span className="login__módulo">
            <Icone nome="nav-administracao" tamanho={18} /> Administração
          </span>
        </div>
      </div>

      <div className="login__painel">
        <form className="login__formulario" onSubmit={aoEnviar}>
          <div>
            <h1 className="login__titulo">Acessar o sistema</h1>
            <p className="login__legenda">Use o login institucional cadastrado pela administração.</p>
          </div>

          {erro && <div className="login__erro">{erro}</div>}

          <div className="campo">
            <label htmlFor="login">Login</label>
            <input
              id="login"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div className="campo">
            <label htmlFor="senha">Senha</label>
            <input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button className="botao botao--primario login__botao" disabled={enviando}>
            {enviando ? "Entrando..." : "Entrar"}
          </button>

          <p className="login__rodape">
            Esqueceu a senha? Procure a administração do sistema.
          </p>
        </form>
      </div>
    </div>
  );
}
