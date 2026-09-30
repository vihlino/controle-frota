/**
 * AjudaTela.jsx - O (?) no fim do titulo da tela.
 *
 * Passando o mouse (ou focando pelo teclado, ou tocando no celular) abre uma
 * janelinha com a explicacao da tela. O texto vem de lib/ajudaTelas.js pelo
 * endereco atual; `texto` sobrepoe quando a pagina quiser dizer outra coisa.
 */
import { useId, useState } from "react";
import { useLocation } from "react-router-dom";
import Icone from "./Icone.jsx";
import { ajudaDaTela } from "../lib/ajudaTelas.js";

export default function AjudaTela({ texto }) {
  const { pathname } = useLocation();
  const conteudo = ajudaDaTela(pathname) || texto;
  const id = useId();
  const [aberto, setAberto] = useState(false);
  if (!conteudo) return null;

  return (
    <span className="ajuda-tela" data-aberto={aberto}
          onMouseEnter={() => setAberto(true)} onMouseLeave={() => setAberto(false)}>
      <button type="button" className="ajuda-tela__botao" aria-label="Sobre esta tela"
              aria-describedby={id}
              // Abre, nao alterna: no toque do celular o navegador dispara
              // "mouse entrou" e "foco" antes do clique, e alternar fechava
              // o balao no mesmo instante. Fecha ao tocar fora (perde o foco).
              onClick={() => setAberto(true)}
              onFocus={() => setAberto(true)} onBlur={() => setAberto(false)}>
        <Icone nome="ajuda" tamanho={16} />
      </button>
      <span role="tooltip" id={id} className="ajuda-tela__balao">{conteudo}</span>
    </span>
  );
}
