/**
 * Kpi.jsx - O cartao de numero grande.
 *
 * Dois estilos, pelo tom: "marca" e o quadrado amarelo dos dashboards; os
 * demais (azul, verde, vermelho, laranja) sao os circulos suaves usados no topo
 * das telas de listagem.
 */
import Icone from "./Icone.jsx";
import { numero } from "../lib/formato.js";

// tom: "marca" (quadrado amarelo dos dashboards) ou azul/amarelo/verde/vermelho
// (circulo suave usado nas telas de listagem, como Manutenções e Documentos).
export default function Kpi({ icone, rotulo, valor, nota, tom = "marca" }) {
  return (
    <div className="cartao kpi">
      <span className="kpi__icone" data-tom={tom}>
        <Icone nome={icone} tamanho={22} />
      </span>
      <div>
        <div className="kpi__rotulo">{rotulo}</div>
        <div className="kpi__valor">{typeof valor === "number" ? numero(valor) : valor}</div>
        {nota && <div className="kpi__nota">{nota}</div>}
      </div>
    </div>
  );
}
