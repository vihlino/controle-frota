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
import { travar, destravar } from "../lib/travarRolagem.js";

/*
 * LARGURA UNICA PARA TODA JANELA DE FORMULARIO
 *
 * Cada tela vinha escolhendo a sua - 640, 680, 700, 720, 760 - e o resultado
 * era uma janela que crescia e encolhia conforme a pessoa passava de Veiculos
 * para Documentos e para Checklists, como se cada tela fosse de um sistema
 * diferente. O numero certo e o que serve o formulario mais largo do sistema
 * (o de correcao de checklist, com quatro campos por fileira); os demais
 * sobram espaco, e sobrar e melhor do que apertar.
 *
 * A prop `largura` continua existindo para o que NAO e formulario: a caixa de
 * confirmar senha e estreita de proposito, porque pede uma coisa so.
 */
export const LARGURA_FORMULARIO = 760;

export default function Modal({
  titulo, legenda, largura = LARGURA_FORMULARIO, aoFechar, rodape, children,
  compacto = false,
}) {
  // Esc fecha.
  useEffect(() => {
    function aoTeclar(e) {
      if (e.key === "Escape") aoFechar();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  // A trava da rolagem fica em EFEITO SEPARADO, com lista de dependencias
  // vazia: ela deve acontecer uma vez ao abrir e uma vez ao fechar. Junto com
  // o Esc, ela reagia a cada troca de `aoFechar` - que muda em todo render,
  // porque as telas passam uma funcao nova (`() => setEditando(null)`) - e
  // destravava e travava de novo sem motivo.
  useEffect(() => {
    travar();
    return destravar;
  }, []);

  return (
    <div className="modal__fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className={`modal${compacto ? " modal--compacto" : ""}`}
           style={{ maxWidth: largura }} role="dialog" aria-modal="true">
        <header className="modal__topo">
          <div>
            <h2 className="modal__titulo">{titulo}</h2>
            {legenda && <p className="modal__legenda">{legenda}</p>}
          </div>
          <button className="modal__fechar" onClick={aoFechar} aria-label="Fechar">
            <Icone nome="fechar" tamanho={18} />
          </button>
        </header>
        <div className="modal__corpo">{children}</div>
        {rodape && <footer className="modal__rodape">{rodape}</footer>}
      </div>
    </div>
  );
}
