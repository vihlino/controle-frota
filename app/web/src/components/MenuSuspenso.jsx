/**
 * MenuSuspenso.jsx - Menu que abre ancorado a um botao e NUNCA e recortado.
 *
 * O PROBLEMA QUE ELE RESOLVE
 * --------------------------
 * O menu dos tres pontinhos das tabelas ficava cortado pela metade. A causa
 * nao e z-index: qualquer ancestral com `overflow` diferente de `visible`
 * RECORTA seus descendentes posicionados, por maior que seja o z-index. E a
 * tabela vive dentro de `.rolagem-x { overflow-x: auto }`, que existe para a
 * tabela larga poder rolar.
 *
 * A SOLUCAO
 * ---------
 * O menu e desenhado fora da arvore da tabela, direto no <body>, com
 * createPortal. Sem ancestral com overflow, nao ha o que o recorte. A posicao
 * vem do retangulo do botao e e aplicada com position: fixed.
 *
 * COMPORTAMENTO AO ROLAR
 * ----------------------
 * position: fixed nao acompanha a rolagem, entao o menu precisa ser
 * REPOSICIONADO a cada rolagem - inclusive a horizontal da propria tabela.
 * Fechar na rolagem seria mais simples, mas fecharia sozinho em situacoes
 * banais (o navegador rola a linha para a vista ao receber o clique).
 * So fecha quando o botao sai de vista de verdade.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MARGEM = 8;   // respiro entre o botao e o menu
const BORDA = 8;    // respiro minimo ate a borda da janela

export default function MenuSuspenso({ aberto, aoFechar, ancora, largura, children }) {
  const menu = useRef(null);
  const [pos, setPos] = useState(null);

  const posicionar = useCallback(() => {
    const alvo = ancora?.current;
    if (!alvo) return;

    const b = alvo.getBoundingClientRect();

    // Botao saiu inteiramente da area visivel: nao ha mais a que se ancorar.
    if (b.bottom < 0 || b.top > window.innerHeight ||
        b.right < 0 || b.left > window.innerWidth) {
      aoFechar();
      return;
    }

    const alturaMenu = menu.current?.offsetHeight ?? 0;
    const larguraMenu = menu.current?.offsetWidth ?? largura ?? 240;

    const espacoAbaixo = window.innerHeight - b.bottom;
    const espacoAcima = b.top;
    // Vira para cima so quando nao cabe embaixo E cabe melhor em cima.
    const paraCima =
      espacoAbaixo < alturaMenu + MARGEM + BORDA && espacoAcima > espacoAbaixo;

    let topo = paraCima ? b.top - alturaMenu - MARGEM : b.bottom + MARGEM;
    topo = Math.max(BORDA, Math.min(topo, window.innerHeight - alturaMenu - BORDA));

    // Alinha pela direita do botao, que e onde o menu costuma ficar.
    let esquerda = b.right - larguraMenu;
    esquerda = Math.max(BORDA, Math.min(esquerda, window.innerWidth - larguraMenu - BORDA));

    setPos({ top: Math.round(topo), left: Math.round(esquerda) });
  }, [ancora, largura, aoFechar]);

  // useLayoutEffect (e nao useEffect) para medir e posicionar ANTES de o
  // navegador pintar - com useEffect o menu piscaria no lugar errado.
  useLayoutEffect(() => {
    if (!aberto) {
      setPos(null);
      return;
    }
    posicionar();
    // De novo no quadro seguinte: na primeira passada o menu ainda nao tem
    // altura medida, entao a decisao de virar para cima sairia com altura 0.
    const id = requestAnimationFrame(posicionar);
    return () => cancelAnimationFrame(id);
  }, [aberto, posicionar]);

  useEffect(() => {
    if (!aberto) return;

    function aoClicarFora(e) {
      if (menu.current?.contains(e.target)) return;
      if (ancora?.current?.contains(e.target)) return;
      aoFechar();
    }
    function aoTeclar(e) {
      if (e.key === "Escape") aoFechar();
    }

    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    // `true` na captura: pega a rolagem de QUALQUER contêiner, nao so da
    // janela - a tabela rola dentro do proprio cartao.
    window.addEventListener("scroll", posicionar, true);
    window.addEventListener("resize", posicionar);

    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
      window.removeEventListener("scroll", posicionar, true);
      window.removeEventListener("resize", posicionar);
    };
  }, [aberto, aoFechar, ancora, posicionar]);

  if (!aberto) return null;

  return createPortal(
    <div
      ref={menu}
      className="menu-suspenso"
      role="menu"
      style={{
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        minWidth: largura,
        // Enquanto a posicao nao foi medida o menu fica invisivel, para nao
        // piscar por um quadro no canto da tela.
        visibility: pos ? "visible" : "hidden",
      }}
    >
      {children}
    </div>,
    document.body
  );
}
