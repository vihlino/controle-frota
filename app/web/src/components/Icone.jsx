/**
 * Icone.jsx - Mostra um icone SVG da pasta public/icons.
 *
 * A COR VEM DO ARQUIVO
 * --------------------
 * Os simbolos entregues pelo Cesar tem cor propria e ela e informacao: o
 * relogio de "Atrasados" e vermelho, o visto de "Concluidas" e verde, o resto
 * e preto. Antes o componente trocava tudo isso por currentColor, e os tres
 * viravam a mesma cor do texto ao redor - o vermelho de atraso sumia junto.
 * Agora o arquivo manda.
 *
 * QUANDO O FUNDO E ESCURO
 * -----------------------
 * Um icone preto desaparece no menu lateral, que e preto. Para esses lugares
 * existe `monocromatico`: ai sim os pretos do arquivo cedem lugar a
 * currentColor e o icone acompanha a cor do texto - claro sobre o preto do
 * menu, escuro sobre o amarelo do item ativo. E a excecao, pedida caso a
 * caso, e nao mais a regra para o sistema inteiro.
 *
 * USO:  <Icone nome="kpi-car" tamanho={20} />
 *       <Icone nome="kpi-car" monocromatico />   (menu lateral, login)
 */
import { useEffect, useState } from "react";

/**
 * Cache no nivel do módulo (fora do componente, entao compartilhado por todos).
 *
 * Guarda a PROMESSA da leitura, nao o texto. Assim, se dez icones iguais
 * aparecerem ao mesmo tempo na tela, todos esperam a mesma unica requisicao,
 * em vez de dispararem dez.
 *
 * @type {Map<string, Promise<string>>}
 */
const cache = new Map();

/**
 * A cor deve virar currentColor?
 *
 * Sim em dois casos:
 *
 *  1. E um preto, ou quase. Os SVGs exportados do editor nao usam #000000
 *     limpo: aparecem #020202, #030303, #0A0A0A, #0F0F0F, "black". Todos
 *     precisam ceder o controle da cor para o CSS.
 *
 *  2. E uma cor de ESTADO cravada no arquivo (o vermelho de "Atrasados", o
 *     verde de "Concluidas"). O significado esta certo, mas quem deve pintar
 *     e o contexto - o tom do KPI, o selo - usando a paleta de tokens. Um
 *     #FF0000 solto no arquivo briga com o --vermelho do sistema.
 *
 * Tudo o mais fica como esta: o amarelo da logo, por exemplo, e da marca e
 * nao deve seguir a cor do texto ao redor.
 *
 * @param {string} cor  O valor do atributo fill ou stroke.
 */
function ehPreto(cor) {
  const c = cor.trim().toLowerCase();
  if (c === "none" || c === "currentcolor") return false;
  if (c === "black") return true;

  // Os arquivos exportados do editor nao usam #000000 limpo: aparecem
  // #010101, #020202, #0A0A0A, #0F0F0F. Todos sao preto para o olho.
  const m = /^#([0-9a-f]{6})$/.exec(c);
  if (!m) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  return r < 0x30 && g < 0x30 && b < 0x30;
}

/**
 * Busca o arquivo SVG e prepara o conteudo.
 * @param {string} nome  Nome do arquivo sem extensao. Ex.: "nav-frotas"
 * @returns {Promise<string>} O SVG pronto, ou string vazia se falhar.
 */
async function carregar(nome) {
  if (cache.has(nome)) return cache.get(nome);

  const promessa = fetch(`/icons/${nome}.svg`)
    .then((r) => (r.ok ? r.text() : ""))
    .then((texto) =>
      // Remove width/height do arquivo, para o tamanho ser decidido aqui pela
      // prop `tamanho`, e nao pelo que veio do editor de imagem. As CORES
      // ficam como estao: elas sao do simbolo.
      texto.replace(/\swidth="[\d.]+"/i, "").replace(/\sheight="[\d.]+"/i, "")
    )
    .catch(() => ""); // icone que nao existe nao quebra a tela, so nao aparece

  cache.set(nome, promessa);
  return promessa;
}

/**
 * @param {object} props
 * @param {string} props.nome        Nome do arquivo em public/icons, sem .svg
 * @param {number} [props.tamanho]   Lado do quadrado em pixels (padrao 20)
 * @param {string} [props.className] Classe CSS extra
 */
export default function Icone({ nome, tamanho = 20, className = "", monocromatico = false }) {
  // Se o icone ja esta em cache RESOLVIDO, comeca com ele - evita o "pisca"
  // de um espaco vazio antes de aparecer.
  const [svg, setSvg] = useState(() => {
    const emCache = cache.get(nome);
    return typeof emCache === "string" ? emCache : "";
  });

  useEffect(() => {
    // Trava contra atualizar um componente que ja saiu da tela: se o usuário
    // trocar de pagina antes do fetch terminar, `ativo` vira false e o setSvg
    // nao roda. Sem isso, o React avisa sobre vazamento de memoria.
    let ativo = true;
    carregar(nome).then((texto) => {
      if (ativo) setSvg(texto);
    });
    return () => {
      ativo = false;
    };
  }, [nome]);

  // So aqui os pretos do arquivo cedem para currentColor, e apenas nas telas
  // que pediram - fundo escuro. Feito na hora de desenhar, e nao no cache,
  // para o MESMO icone poder aparecer colorido numa tela e monocromatico na
  // outra sem precisar de dois arquivos.
  const conteudo = monocromatico
    ? svg.replace(/(stroke|fill)="([^"]+)"/gi, (todo, attr, cor) =>
        ehPreto(cor) ? `${attr}="currentColor"` : todo
      )
    : svg;

  return (
    <span
      className={`icone ${className}`}
      style={{ width: tamanho, height: tamanho }}
      // aria-hidden esconde o icone de leitores de tela: ele e decorativo, o
      // texto ao lado ja diz o que a coisa faz.
      aria-hidden="true"
      // dangerouslySetInnerHTML injeta HTML puro. O nome assusta de proposito,
      // porque injetar HTML de fonte desconhecida abre porta para XSS. Aqui e
      // seguro: o conteudo vem de arquivos nossos, da nossa propria pasta
      // public/, nunca de dado digitado por usuário.
      dangerouslySetInnerHTML={{ __html: conteudo }}
    />
  );
}
