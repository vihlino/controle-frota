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
import Icone from "./Icone.jsx";
import TituloSecao from "./TituloSecao.jsx";

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
/** Icone de cada grupo (o mesmo dos Detalhes da Inspecao). */
export const ICONE_GRUPO_INSPECAO = {
  "Níveis de fluidos (com o motor frio)": ["aviso-oleo", "azul", "Verifique os níveis e informe o status de cada item."],
  "Pneus e rodas": ["pneu", "roxo", "Verifique as condições dos pneus e rodas."],
  "Sistema elétrico e iluminação": ["lampada", "amarelo", "Verifique o funcionamento dos itens de iluminação."],
  "Visibilidade e itens de emergência": ["alert-triangle", "vermelho", "Verifique a visibilidade e os itens obrigatórios."],
  "Conservação e higiene": ["limpeza", "verde", "Verifique a limpeza e a conservação."],
  "Testes dinâmicos e interior": ["kpi-steering", "laranja", "Verifique os comandos e o interior."],
};

/*
 * `cartoes` (29/10, desenho do Cesar para o Editar inspecao da gestao): o
 * titulo do grupo vira faixa colorida com icone e os itens ficam em cartoes,
 * dois por linha. O QR Code continua com a lista simples, feita para celular.
 */
export default function ItensInspecao({ itens, aoMudar, cartoes = false }) {
  if (cartoes) {
    return (
      <div className="ii">
        {itens.map((it, i) => {
          const [ic, tom, desc] = ICONE_GRUPO_INSPECAO[it.grupo] || ["checklist", "azul", null];
          return (
            <Fragment key={`${it.grupo || ""}-${it.item}-${i}`}>
              {it.grupo && it.grupo !== itens[i - 1]?.grupo && (
                <TituloSecao icone={ic} tom={tom} descricao={desc}>{it.grupo}</TituloSecao>
              )}
              <div className="ii__item" data-resultado={it.resultado}>
                <span className="ii__icone"><Icone nome={ic} tamanho={26} /></span>
                <div className="ii__corpo">
                  <span className="ii__nome">{it.item}</span>
                  <div className="ii__opcoes">
                    {OPCOES.map((o) => (
                      <button key={o.valor} type="button" className="ii__opcao" data-tom={o.tom}
                              data-ativo={it.resultado === o.valor ? "sim" : undefined}
                              onClick={() => aoMudar(i, { resultado: o.valor })}>
                        {o.rotulo}
                      </button>
                    ))}
                  </div>
                </div>
                {it.resultado !== "NORMAL" && (
                  <input className="ii__obs" placeholder="O que foi observado?" value={it.observacao || ""}
                         onChange={(e) => aoMudar(i, { observacao: e.target.value })} />
                )}
              </div>
            </Fragment>
          );
        })}
      </div>
    );
  }
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
