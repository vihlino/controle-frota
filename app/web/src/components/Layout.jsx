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
import { aplicarTema, temaAtual } from "../lib/tema.js";

// O titulo e a legenda do topo mudam por pagina; cada pagina publica os seus
// atraves do contexto do Outlet.
export default function Layout() {
  const [recolhida, setRecolhida] = useState(false);
  const [tema, setTema] = useState(temaAtual);
  const [cabecalho, setCabecalho] = useState({ titulo: "SITRA", legenda: "" });

  function alternarTema() {
    const novo = tema === "escuro" ? "claro" : "escuro";
    aplicarTema(novo);
    setTema(novo);
  }

  return (
    <div className="app" data-lateral={recolhida ? "recolhida" : "aberta"}>
      <Lateral recolhida={recolhida} tema={tema} alternarTema={alternarTema} />
      <div className="conteudo">
        <Topo
          titulo={cabecalho.titulo}
          legenda={cabecalho.legenda}
          aoAlternarMenu={() => setRecolhida((v) => !v)}
        />
        <main className="pagina">
          <Outlet context={{ definirCabecalho: setCabecalho }} />
        </main>
      </div>
    </div>
  );
}
