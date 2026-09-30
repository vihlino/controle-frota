/**
 * RegrasSenha.jsx - A lista de regras da senha, que vai ficando verde enquanto
 * a pessoa digita.
 *
 * Mostrar as regras ANTES de salvar evita a tentativa e erro: cada regra
 * cumprida ganha o sinal de conferido, e a que falta continua cinza dizendo o
 * que falta.
 */
import Icone from "./Icone.jsx";
import { conferirSenha } from "../lib/regrasSenha.js";

export default function RegrasSenha({ senha, login }) {
  const regras = conferirSenha(senha, login);
  return (
    <ul className="regras-senha" aria-live="polite">
      {regras.map((r, i) => (
        <li key={i} data-ok={r.ok ? "sim" : undefined}>
          {r.ok
            ? <Icone nome="check" tamanho={12} monocromatico />
            : <span className="regras-senha__marca" aria-hidden="true" />}
          <span>{r.texto}</span>
        </li>
      ))}
    </ul>
  );
}
