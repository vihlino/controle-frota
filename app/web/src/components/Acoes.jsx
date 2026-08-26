/**
 * Acoes.jsx - O menu dos tres pontinhos das tabelas.
 *
 * Recebe uma lista de acoes e desenha o menu. A acao marcada com perigo: true
 * aparece em vermelho (exclusoes).
 *
 * Fecha ao clicar fora, com um listener no documento que e sempre removido na
 * limpeza do useEffect.
 */
import { useEffect, useRef, useState } from "react";
import Icone from "./Icone.jsx";

// Menu dos tres pontinhos das tabelas.
// acoes: [{rotulo, aoClicar, perigo}]
export default function Acoes({ acoes }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef(null);

  useEffect(() => {
    function aoClicarFora(e) {
      if (caixa.current && !caixa.current.contains(e.target)) setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  return (
    <div className="relativo acoes" ref={caixa}>
      <button
        className="acoes__botao"
        onClick={() => setAberto((v) => !v)}
        aria-label="Acoes do registro"
      >
        <Icone nome="chevron-down" tamanho={18} />
      </button>
      {aberto && (
        <div className="menu-suspenso menu-suspenso--acoes">
          {acoes.map((a) => (
            <button
              key={a.rotulo}
              data-perigo={a.perigo ? "sim" : undefined}
              onClick={() => {
                setAberto(false);
                a.aoClicar();
              }}
            >
              {a.rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
