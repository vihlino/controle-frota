/**
 * ItensInspecao.jsx - A lista de itens da inspecao, com Conforme / Atencao /
 * Avaria em cada um.
 *
 * E a MESMA lista em dois lugares: no pop-up da inspecao do QR Code, onde o
 * condutor confere o veiculo, e na correcao da inspecao pela gestao. Um
 * componente so para os dois: a pessoa que corrige ve exatamente a tela que o
 * condutor viu, e uma mudanca no jeito de marcar vale para os dois lados.
 */
import { Fragment } from "react";

const OPCOES = [
  { valor: "NORMAL", rotulo: "Conforme", tom: "verde" },
  { valor: "ATENCAO", rotulo: "Atenção", tom: "amarelo" },
  { valor: "AVARIA", rotulo: "Avaria", tom: "vermelho" },
];

/**
 * @param {object} p
 * @param {Array<{item: string, grupo?: string, resultado: string, observacao?: string}>} p.itens
 * @param {(indice: number, mudanca: object) => void} p.aoMudar
 */
export default function ItensInspecao({ itens, aoMudar }) {
  return (
    <div className="qr-inspecao__itens">
      {itens.map((it, i) => (
        /*
         * O titulo do grupo entra quando o grupo MUDA em relacao ao item
         * anterior, como IRMAO do cartao do item - dentro dele ficaria cercado
         * pela borda, parecendo parte da conferencia. O Fragment mantem a
         * lista como um array simples: o indice `i` continua valendo para
         * aoMudar. Inspecao antiga, feita antes dos grupos, nao tem grupo e
         * sai como lista corrida.
         */
        <Fragment key={`${it.grupo || ""}-${it.item}-${i}`}>
          {it.grupo && it.grupo !== itens[i - 1]?.grupo && (
            <h4 className="qr-inspecao__grupo">{it.grupo}</h4>
          )}
          <div className="qr-inspecao__item">
            <span className="qr-inspecao__nome">{it.item}</span>
            <div className="qr-inspecao__opcoes">
              {OPCOES.map((o) => (
                <button
                  key={o.valor}
                  type="button"
                  className="botao botao--mini"
                  data-ativo={it.resultado === o.valor ? "sim" : undefined}
                  data-tom={o.tom}
                  onClick={() => aoMudar(i, { resultado: o.valor })}
                >
                  {o.rotulo}
                </button>
              ))}
            </div>
            {it.resultado !== "NORMAL" && (
              <input
                className="qr-inspecao__obs"
                placeholder="O que foi observado?"
                value={it.observacao || ""}
                onChange={(e) => aoMudar(i, { observacao: e.target.value })}
              />
            )}
          </div>
        </Fragment>
      ))}
    </div>
  );
}
