/**
 * CampoDinheiro.jsx - Campo de valor em reais: "R$ 1.234,56".
 *
 * Digita-se livre ("350", "350,5", "1.234,56") e, ao sair do campo, o valor
 * fica no formato brasileiro com duas casas - "350" vira "R$ 350,00". O "R$"
 * fica fixo dentro da caixa.
 *
 * Para fora (aoMudar) vai o numero em texto com ponto ("1234.56"), que e o que
 * a API entende; vazio vai como "".
 */
import { useEffect, useState } from "react";
import { Campo } from "./Campos.jsx";

/** "1.234,56" / "350,5" / "350" / "12.5" -> numero, ou null. */
export function lerDinheiro(texto) {
  let s = String(texto ?? "").replace(/[^\d.,]/g, "");
  if (!s) return null;
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, ""); // "1.234" e mil duzentos e trinta e quatro
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** 350.5 -> "350,50"; 1234 -> "1.234,00". */
export function formatarDinheiro(n) {
  if (n === null || n === undefined || n === "" || !Number.isFinite(Number(n))) return "";
  return Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CampoDinheiro({ rotulo, id, valor, aoMudar, largo, ajuda, required }) {
  const [texto, setTexto] = useState(() => formatarDinheiro(valor));

  // Valor trocado por fora (ex.: a janela reaberta com outra OS).
  useEffect(() => {
    const atual = lerDinheiro(texto);
    const novo = valor === "" || valor === null || valor === undefined ? null : Number(valor);
    if (atual !== novo) setTexto(formatarDinheiro(novo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  function mudar(e) {
    const limpo = e.target.value.replace(/[^\d.,]/g, "");
    setTexto(limpo);
    const n = lerDinheiro(limpo);
    aoMudar(n === null ? "" : n.toFixed(2));
  }

  function sair() {
    const n = lerDinheiro(texto);
    setTexto(formatarDinheiro(n));
  }

  return (
    <Campo rotulo={rotulo} htmlFor={id} largo={largo} ajuda={ajuda}>
      <div className="campo-dinheiro">
        <span className="campo-dinheiro__moeda" aria-hidden="true">R$</span>
        <input id={id} type="text" inputMode="decimal" autoComplete="off"
               placeholder="0,00" required={required}
               value={texto} onChange={mudar} onBlur={sair} />
      </div>
    </Campo>
  );
}
