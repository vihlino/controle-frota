/**
 * Acoes.jsx - O menu dos tres pontinhos das tabelas.
 *
 * Recebe uma lista de acoes e desenha o menu. A acao marcada com perigo: true
 * aparece em vermelho (exclusoes).
 *
 * O menu em si vive no MenuSuspenso, que o desenha fora da tabela para nao
 * ser recortado pela rolagem horizontal - ver o comentario la.
 */
import { useCallback, useRef, useState } from "react";
import Icone from "./Icone.jsx";
import MenuSuspenso from "./MenuSuspenso.jsx";

// acoes: [{rotulo, aoClicar, perigo}]
export default function Acoes({ acoes }) {
  const [aberto, setAberto] = useState(false);
  const botao = useRef(null);

  // useCallback para a identidade da funcao nao mudar a cada render: o
  // MenuSuspenso a usa em addEventListener e removeEventListener, e uma
  // funcao nova a cada render faria os ouvintes serem trocados sem parar.
  const fechar = useCallback(() => setAberto(false), []);

  return (
    <>
      <button
        ref={botao}
        className="acoes__botao"
        onClick={() => setAberto((v) => !v)}
        aria-label="Ações do registro"
        aria-haspopup="menu"
        aria-expanded={aberto}
      >
        <Icone nome="chevron-down" tamanho={18} />
      </button>

      <MenuSuspenso aberto={aberto} aoFechar={fechar} ancora={botao} largura={200}>
        {acoes.map((a) => (
          <button
            key={a.rotulo}
            role="menuitem"
            data-perigo={a.perigo ? "sim" : undefined}
            onClick={() => {
              setAberto(false);
              a.aoClicar();
            }}
          >
            {a.rotulo}
          </button>
        ))}
      </MenuSuspenso>
    </>
  );
}
