/**
 * Lateral.jsx - A barra de menu preta.
 *
 * Monta o menu a partir de menu.js, escondendo o que o perfil do usuário nao
 * pode abrir - grupo inteiro sem nenhum item visivel tambem some.
 *
 * Isso e comodidade visual, nao seguranca: a protecao de verdade esta nas
 * rotas (App.jsx) e no servidor.
 */
import { Link, NavLink } from "react-router-dom";
import Icone from "./Icone.jsx";
import { MENU } from "./menu.js";
import { useSessao } from "../lib/sessao.jsx";

export default function Lateral() {
  const { podeVer } = useSessao();

  /*
   * O item do menu se chama "Dashboard", e ponto.
   *
   * Ele ja mostrava o modulo no rotulo ("Dashboard Frotas", "Dashboard TI").
   * Isso nao ajudava: quem tem um modulo so nao precisa que o menu repita qual
   * e, e quem tem os tres (o administrador) via "Dashboard TI" num item que
   * abre os tres paineis - o rotulo mentia. O painel em si continua dizendo de
   * qual setor ele e.
   */
  const blocos = MENU
    .filter((b) => !b.permissao || podeVer(b.permissao))
    .map((b) => ({
      ...b,
      itens: b.itens.filter((i) => !i.permissao || podeVer(i.permissao)),
    }))
    .filter((b) => b.itens.length);

  return (
    <aside className="lateral">
      {/* A logo oficial ja traz a estrada, o nome e a linha "Sistema Integrado
          de Transporte e Rotas Administrativas" desenhados juntos. Repetir o
          nome em texto ao lado dela seria dizer a mesma coisa duas vezes. */}
      <div className="lateral__marca">
        <img src="/icons/logo-sitra.png"
             alt="SITRA - Sistema Integrado de Transporte e Rotas Administrativas" />
      </div>
      <nav className="lateral__menu">
        {blocos.map((bloco, i) => (
          <div key={bloco.grupo || i}>
            {bloco.grupo && <div className="lateral__grupo">{bloco.grupo}</div>}
            {bloco.itens.map((item) => (
              <NavLink
                key={item.para}
                to={item.para}
                end={item.fim}
                className={({ isActive }) =>
                  `lateral__item ${isActive ? "lateral__item--ativo" : ""}`
                }
              >
                <Icone nome={item.icone} tamanho={20} monocromatico />
                <span className="lateral__rotulo">{item.rotulo}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Rodape fixo da lateral. Nos mockups a Ajuda fica sempre ancorada em
          baixo, separada do menu - nao e mais um item da lista. */}
      <Link to="/ajuda" className="lateral__ajuda" title="Ajuda">
        <Icone nome="ajuda" tamanho={20} monocromatico />
        {(
          <>
            <span className="lateral__rotulo">Ajuda</span>
            <Icone nome="chevron-right" tamanho={15} className="lateral__ajuda-seta" monocromatico />
          </>
        )}
      </Link>
    </aside>
  );
}
