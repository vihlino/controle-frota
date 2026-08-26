/**
 * Trilha.jsx - As migalhas de navegacao (Frotas > Veiculos > ...).
 *
 * O ultimo item fica em negrito e sem link, porque e a pagina atual.
 */
import { Link } from "react-router-dom";
import Icone from "./Icone.jsx";

// Trilha de navegacao: [{rotulo, para}] - o ultimo item fica em negrito, sem link.
export default function Trilha({ itens }) {
  return (
    <nav className="trilha">
      {itens.map((item, i) => (
        <span key={item.rotulo} className="trilha__item">
          {i > 0 && <Icone nome="chevron-right" tamanho={14} />}
          {item.para && i < itens.length - 1 ? (
            <Link to={item.para}>{item.rotulo}</Link>
          ) : (
            <strong>{item.rotulo}</strong>
          )}
        </span>
      ))}
    </nav>
  );
}
