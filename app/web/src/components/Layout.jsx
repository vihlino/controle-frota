/**
 * Layout.jsx - A moldura das telas internas.
 *
 * Junta a barra lateral, o topo e a area de conteudo. O Outlet e o buraco onde
 * o React Router encaixa a tela da rota atual.
 *
 * O titulo e a legenda do topo mudam a cada tela, entao cada pagina publica os
 * seus chamando definirCabecalho(), que chega ate ela pelo contexto do Outlet.
 */
import { useState } from "react";
import { Outlet } from "react-router-dom";
import Lateral from "./Lateral.jsx";
import Topo from "./Topo.jsx";

// O titulo e a legenda do topo mudam por página; cada pagina publica os seus
// atraves do contexto do Outlet.
export default function Layout() {
  // No desktop a lateral e FIXA: e o mapa do sistema, e recolher escondia os
  // nomes dos modulos sem devolver nada em troca - a tela ja tem largura de
  // sobra. `menuAberto` vale so no celular, onde a lateral sai da tela e
  // precisa de um jeito de voltar; comeca fechado porque no celular a tela
  // pertence ao conteudo.
  const [menuAberto, setMenuAberto] = useState(false);
  const [cabecalho, setCabecalho] = useState({ titulo: "SITRA", legenda: "" });

  return (
    <div className="app" data-menu={menuAberto ? "aberto" : "fechado"}>
      <Lateral />
      {/* Fundo escuro que fecha o menu no celular ao tocar fora dele. */}
      {menuAberto && (
        <div className="lateral__fundo" onClick={() => setMenuAberto(false)} />
      )}
      <div className="conteudo" data-cabecalho={cabecalho.titulo ? "sim" : "nao"}>
        <Topo
          titulo={cabecalho.titulo}
          legenda={cabecalho.legenda}
          aoAlternarMenu={() => setMenuAberto((v) => !v)}
        />
        <main className="pagina">
          <Outlet context={{ definirCabecalho: setCabecalho }} />
        </main>
      </div>
    </div>
  );
}
