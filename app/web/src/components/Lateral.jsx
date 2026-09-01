/**
 * Lateral.jsx - A barra de menu preta.
 *
 * Monta o menu a partir de menu.js, escondendo o que o perfil do usuário nao
 * pode abrir - grupo inteiro sem nenhum item visivel tambem some.
 *
 * Isso e comodidade visual, nao seguranca: a protecao de verdade esta nas
 * rotas (App.jsx) e no servidor.
 */
import { NavLink } from "react-router-dom";
import Icone from "./Icone.jsx";
import { MENU } from "./menu.js";
import { useSessao } from "../lib/sessao.jsx";

export default function Lateral({ recolhida }) {
  const { podeVer } = useSessao();

  function rotuloDashboard() {
    if (podeVer("FROTAS_VISUALIZAR") && !podeVer("FISCALIZACAO_VISUALIZAR") && !podeVer("ADMIN_VISUALIZAR")) return "Dashboard Frotas";
    if (podeVer("FISCALIZACAO_VISUALIZAR") && !podeVer("FROTAS_VISUALIZAR") && !podeVer("ADMIN_VISUALIZAR")) return "Dashboard Fiscalização";
    if (podeVer("ADMIN_VISUALIZAR")) return "Dashboard TI";
    return "Dashboard";
  }

  const blocos = MENU
    .filter((b) => !b.permissao || podeVer(b.permissao))
    .map((b) => ({
      ...b,
      itens: b.itens.filter((i) => !i.permissao || podeVer(i.permissao)),
    }))
    .filter((b) => b.itens.length);

  return (
    <aside className="lateral">
      <div className="lateral__marca">
        <img src="/icons/logo-sitra.svg" alt="" />
        {!recolhida && (
          <div>
            <div className="lateral__nome">SITRA</div>
            <div className="lateral__sub">
              Sistema Integrado de
              <br />
              Gestão Publica
            </div>
          </div>
        )}
      </div>

      <nav className="lateral__menu">
        {blocos.map((bloco, i) => (
          <div key={bloco.grupo || i}>
            {bloco.grupo && !recolhida && <div className="lateral__grupo">{bloco.grupo}</div>}
            {bloco.itens.map((item) => (
              <NavLink
                key={item.para}
                to={item.para}
                end={item.fim}
                title={recolhida ? (item.para === "/dashboard" ? rotuloDashboard() : item.rotulo) : undefined}
                className={({ isActive }) =>
                  `lateral__item ${isActive ? "lateral__item--ativo" : ""}`
                }
              >
                <Icone nome={item.icone} tamanho={20} />
                {!recolhida && (
                  <span className="lateral__rotulo">
                    {item.para === "/dashboard" ? rotuloDashboard() : item.rotulo}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

    </aside>
  );
}
