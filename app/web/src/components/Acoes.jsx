/**
 * Ações.jsx - O menu dos tres pontinhos das tabelas.
 *
 * Recebe uma lista de ações e desenha o menu. A acao marcada com perigo: true
 * aparece em vermelho (exclusoes).
 *
 * Fecha ao clicar fora, com um listener no documento que e sempre removido na
 * limpeza do useEffect.
 */
import { useEffect, useRef, useState } from "react";
import Icone from "./Icone.jsx";

// Menu dos tres pontinhos das tabelas.
// ações: [{rotulo, aoClicar, perigo}]
export default function Ações({ ações }) {
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
    <div className="relativo ações" ref={caixa}>
      <button
        className="ações__botao"
        onClick={() => setAberto((v) => !v)}
        aria-label="Ações do registro"
      >
        <Icone nome="chevron-down" tamanho={18} />
      </button>
      {aberto && (
        <div className="menu-suspenso menu-suspenso--ações">
          {ações.map((a) => (
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
