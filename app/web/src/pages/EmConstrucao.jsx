/**
 * EmConstrucao.jsx - Pagina para rotas que ainda nao existem.
 *
 * Rede de seguranca: se um item do menu apontar para uma rota que ninguem
 * criou, o usuário ve um aviso claro em vez de uma tela em branco.
 */
import { useEffect } from "react";
import { useLocation, useOutletContext } from "react-router-dom";
import Cartao from "../components/Cartao.jsx";
import Icone from "../components/Icone.jsx";
import { MENU } from "../components/menu.js";

function rotuloDaRota(caminho) {
  for (const bloco of MENU) {
    const item = bloco.itens.find((i) => i.para === caminho);
    if (item) return item.rotulo;
  }
  return "Tela";
}

export default function EmConstrucao() {
  const { definirCabecalho } = useOutletContext();
  const { pathname } = useLocation();
  const rotulo = rotuloDaRota(pathname);

  useEffect(() => {
    definirCabecalho({ titulo: rotulo, legenda: "Tela ainda não construida" });
  }, [definirCabecalho, rotulo]);

  return (
    <Cartao>
      <div className="vazio">
        <Icone nome="alert-triangle" tamanho={30} />
        <p>
          <strong>{rotulo}</strong> ainda não foi construida.
        </p>
        <p>A base (login, layout e o padrão de tela) já esta pronta para receber ela.</p>
      </div>
    </Cartao>
  );
}
