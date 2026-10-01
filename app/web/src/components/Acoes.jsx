/**
 * Acoes.jsx - O menu dos tres pontinhos das tabelas.
 *
 * Recebe uma lista de acoes e desenha o menu. A acao marcada com perigo: true
 * aparece em vermelho (exclusoes).
 *
 * O menu em si vive no MenuSuspenso, que o desenha fora da tabela para nao
 * ser recortado pela rolagem horizontal - ver o comentario la.
 */
import { useCallback, useRef, useState } from "react";
import Icone from "./Icone.jsx";
import MenuSuspenso from "./MenuSuspenso.jsx";

// acoes: [{rotulo, aoClicar, perigo, icone}]
//
// O icone e opcional: a acao que nao declara nenhum continua desenhada so com
// o texto, e o alinhamento nao quebra. O tamanho dele nao vem daqui - e o da
// LETRA do item, definido no CSS, como no resto do sistema.
/*
 * ORDEM PADRAO DO MENU, em todas as telas:
 *   1. Visualizar
 *   2. Ver veiculo
 *   3. o que mais a tela tiver (Fechar OS, QR Code, Trocar senha...), na
 *      ordem em que a tela declarou
 *   4. Editar
 *   5. Excluir (e qualquer acao de perigo)
 * A ordem e garantida AQUI, e nao em cada tela: tela nova ja nasce no padrao,
 * e ninguem precisa lembrar de onde por cada item.
 */
function pesoDaAcao(a) {
  const r = String(a.rotulo || "").trim().toLowerCase();
  if (r === "visualizar") return 0;
  if (r.startsWith("ver veículo") || r.startsWith("ver veiculo")) return 1;
  if (a.perigo || r.startsWith("excluir")) return 4;
  if (r.startsWith("editar")) return 3;
  return 2;
}

function ordenarAcoes(acoes) {
  return acoes
    .map((a, i) => ({ a, i }))
    .sort((x, y) => pesoDaAcao(x.a) - pesoDaAcao(y.a) || x.i - y.i)
    .map(({ a }) => a);
}

export default function Acoes({ acoes }) {
  const [aberto, setAberto] = useState(false);
  const botao = useRef(null);

  // useCallback para a identidade da funcao nao mudar a cada render: o
  // MenuSuspenso a usa em addEventListener e removeEventListener, e uma
  // funcao nova a cada render faria os ouvintes serem trocados sem parar.
  const fechar = useCallback(() => setAberto(false), []);

  return (
    <>
      <button
        ref={botao}
        className="acoes__botao"
        onClick={() => setAberto((v) => !v)}
        aria-label="Ações do registro"
        aria-haspopup="menu"
        aria-expanded={aberto}
      >
        <Icone nome="menu-pontos-vertical" tamanho={18} />
      </button>

      <MenuSuspenso aberto={aberto} aoFechar={fechar} ancora={botao} largura={200}>
        {ordenarAcoes(acoes.filter(Boolean)).map((a) => (
          <button
            key={a.rotulo}
            role="menuitem"
            data-perigo={a.perigo ? "sim" : undefined}
            onClick={() => {
              setAberto(false);
              a.aoClicar();
            }}
          >
            {a.icone && <Icone nome={a.icone} monocromatico />}
            {a.rotulo}
          </button>
        ))}
      </MenuSuspenso>
    </>
  );
}
