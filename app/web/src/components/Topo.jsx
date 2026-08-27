/**
 * Topo.jsx - A barra superior.
 *
 * Traz o botao de recolher o menu, o titulo da tela, a busca (com atalho
 * Ctrl+K), o sininho de alertas e o menu do usuário com a saida.
 *
 * Dois detalhes de comportamento: o menu do usuário fecha ao clicar fora, e o
 * Ctrl+K joga o foco na busca. Os dois usam listeners no documento, sempre
 * removidos na limpeza do useEffect para nao acumular.
 */
import { useEffect, useRef, useState } from "react";
import Icone from "./Icone.jsx";
import { useSessao } from "../lib/sessao.jsx";
import { api } from "../lib/api.js";

export default function Topo({ titulo, legenda, aoAlternarMenu }) {
  const { usuario, sair } = useSessao();
  const [menuAberto, setMenuAberto] = useState(false);
  const [alertas, setAlertas] = useState(0);
  const caixa = useRef(null);

  useEffect(() => {
    api("/alertas")
      .then((r) => setAlertas(r.naoLidos))
      .catch(() => {});
  }, []);

  // Fecha o menu do usuário ao clicar fora dele.
  useEffect(() => {
    function aoClicar(e) {
      if (caixa.current && !caixa.current.contains(e.target)) setMenuAberto(false);
    }
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, []);


  const iniciais = (usuario?.nome || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");

  return (
    <header className="topo">
      <button className="topo__botao-menu" onClick={aoAlternarMenu} aria-label="Alternar menu">
        <Icone nome="menu" tamanho={24} />
      </button>

      <div>
        <div className="topo__titulo">{titulo}</div>
        {legenda && <div className="topo__legenda">{legenda}</div>}
      </div>

      <button className="topo__sino" aria-label="Alertas">
        <Icone nome="bell" tamanho={22} />
        {alertas > 0 && <span className="topo__contador">{alertas}</span>}
      </button>

      <div className="relativo" ref={caixa}>
        <button className="topo__usuario" onClick={() => setMenuAberto((v) => !v)}>
          <span className="avatar">{iniciais}</span>
          <span>
            <span className="topo__usuario-nome">{usuario?.nome}</span>
            <br />
            <span className="topo__usuario-perfil">{usuario?.perfil}</span>
          </span>
          <Icone nome="chevron-down" tamanho={18} />
        </button>

        {menuAberto && (
          <div className="menu-suspenso">
            <div className="menu-suspenso__cabecalho">
              <div className="topo__usuario-nome">{usuario?.nome}</div>
              <div className="topo__usuario-perfil">
                {usuario?.cargo_funcao} - {usuario?.setor}
              </div>
              <div className="topo__usuario-perfil">Matrícula {usuario?.matricula}</div>
            </div>
            <button onClick={sair}>Sair do sistema</button>
          </div>
        )}
      </div>
    </header>
  );
}
