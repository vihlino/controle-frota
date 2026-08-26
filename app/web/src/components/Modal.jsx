/**
 * Modal.jsx - A janela sobreposta dos formularios.
 *
 * Fecha de tres formas: no X, na tecla Esc e clicando no fundo escuro.
 *
 * O clique no fundo usa onMouseDown e compara e.target com e.currentTarget
 * para fechar so quando o clique comecou no fundo mesmo - senao, arrastar para
 * selecionar um texto de dentro e soltar fora fecharia a janela junto.
 *
 * Enquanto aberto, trava a rolagem da pagina de tras.
 */
import { useEffect } from "react";
import Icone from "./Icone.jsx";

export default function Modal({ titulo, legenda, largura = 640, aoFechar, rodape, children }) {
  // Esc fecha, e a rolagem da pagina de tras trava enquanto o modal esta aberto.
  useEffect(() => {
    function aoTeclar(e) {
      if (e.key === "Escape") aoFechar();
    }
    document.addEventListener("keydown", aoTeclar);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = anterior;
    };
  }, [aoFechar]);

  return (
    <div className="modal__fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="modal" style={{ maxWidth: largura }} role="dialog" aria-modal="true">
        <header className="modal__topo">
          <div>
            <h2 className="modal__titulo">{titulo}</h2>
            {legenda && <p className="modal__legenda">{legenda}</p>}
          </div>
          <button className="modal__fechar" onClick={aoFechar} aria-label="Fechar">
            <Icone nome="minus" tamanho={18} />
          </button>
        </header>
        <div className="modal__corpo">{children}</div>
        {rodape && <footer className="modal__rodape">{rodape}</footer>}
      </div>
    </div>
  );
}
