/**
 * TrocarSenha.jsx - "Voce precisa alterar a sua senha".
 *
 * Aparece no primeiro acesso e sempre que o administrador define a senha de
 * alguem: nesses casos a senha e conhecida por duas pessoas, e o sistema so
 * libera o resto depois que o dono cria uma que so ele conheca.
 *
 * Mesmo desenho da tela de entrada: a pessoa acabou de digitar a senha ali, e
 * uma tela de outro jeito pareceria um erro, ou outro sistema.
 *
 * Nao e so esta tela que segura: a API recusa qualquer outra rota enquanto a
 * troca estiver pendente (auth.js). Esta tela e o caminho; a trava e la.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icone from "../components/Icone.jsx";
import RegrasSenha from "../components/RegrasSenha.jsx";
import { api } from "../lib/api.js";
import { useSessao } from "../lib/sessao.jsx";
import { senhaAceita } from "../lib/regrasSenha.js";

export default function TrocarSenha() {
  const { usuario, atualizarSessao, sair } = useSessao();
  const navegar = useNavigate();
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [repetida, setRepetida] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const iguais = nova.length > 0 && nova === repetida;
  const pronta = atual.length > 0 && senhaAceita(nova, usuario?.login) && iguais;

  async function aoEnviar(e) {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      const r = await api("/sessao/senha", {
        method: "POST",
        body: { senhaAtual: atual, novaSenha: nova },
      });
      atualizarSessao(r.token, r.usuario);
      navegar("/dashboard", { replace: true });
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  }

  async function aoSair() {
    await sair();
    navegar("/entrar", { replace: true });
  }

  return (
    <div className="login">
      <div className="login__marca">
        <div className="login__logo">
          <img src="/icons/logo-sitra.png"
               alt="SITRA - Sistema Integrado de Transporte e Rotas Administrativas" />
        </div>
        <p className="login__frase">
          A senha que você usou foi criada pela administração. Para continuar,
          crie uma senha que só você conheça.
        </p>
      </div>

      <div className="login__painel">
        <form className="login__formulario" onSubmit={aoEnviar}>
          <div>
            <h1 className="login__titulo">Você precisa alterar a sua senha</h1>
            <p className="login__legenda">
              {usuario?.nome ? `${usuario.nome}, este` : "Este"} é o seu primeiro acesso
              com esta senha. Tudo o que for feito no sistema fica registrado no
              seu nome - por isso ela precisa ser só sua.
            </p>
          </div>

          {erro && <div className="login__erro">{erro}</div>}

          <div className="campo">
            <label htmlFor="senha-atual">Senha atual</label>
            <input
              id="senha-atual"
              type="password"
              value={atual}
              placeholder="A senha que você acabou de usar"
              onChange={(e) => setAtual(e.target.value)}
              autoComplete="current-password"
              autoFocus
              required
            />
          </div>

          <div className="campo">
            <label htmlFor="senha-nova">Nova senha</label>
            <input
              id="senha-nova"
              type="password"
              value={nova}
              placeholder="Crie a sua senha"
              onChange={(e) => setNova(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <RegrasSenha senha={nova} login={usuario?.login} />

          <div className="campo">
            <label htmlFor="senha-repetida">Repita a nova senha</label>
            <input
              id="senha-repetida"
              type="password"
              value={repetida}
              placeholder="Digite a nova senha de novo"
              onChange={(e) => setRepetida(e.target.value)}
              autoComplete="new-password"
              required
            />
            {/* So avisa depois que a pessoa comecou a repetir: antes disso,
                "as senhas nao conferem" seria uma bronca por nada. */}
            {repetida.length > 0 && (
              <ul className="regras-senha">
                <li data-ok={iguais ? "sim" : undefined}>
                  {iguais
                    ? <Icone nome="check" tamanho={12} monocromatico />
                    : <span className="regras-senha__marca" aria-hidden="true" />}
                  <span>{iguais ? "As duas senhas são iguais" : "As duas senhas ainda não são iguais"}</span>
                </li>
              </ul>
            )}
          </div>

          <button className="botao botao--primario login__botao" disabled={!pronta || enviando}>
            {enviando ? "Salvando..." : "Alterar senha e entrar"}
          </button>

          <p className="login__rodape">
            <button type="button" className="login__link" onClick={aoSair}>
              Sair e entrar com outro usuário
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
