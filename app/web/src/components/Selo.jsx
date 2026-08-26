/**
 * Selo.jsx - A etiqueta colorida de situacao.
 *
 * Duas formas de usar:
 *   <Selo valor="EM_USO" />                 traduz o codigo do banco sozinho
 *   <Selo texto="Aprovado" tom="verde" />   texto e cor definidos na hora
 *
 * A traducao dos codigos fica em lib/formato.js, num lugar so.
 */
import { status as rotuloStatus } from "../lib/formato.js";

export default function Selo({ valor, texto, tom }) {
  const rotulo = valor ? rotuloStatus(valor) : { texto, tom };
  return (
    <span className="selo" data-tom={rotulo.tom}>
      {rotulo.texto}
    </span>
  );
}
