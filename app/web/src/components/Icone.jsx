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
 * Deixa todo arquivo no MESMO ponto de partida, seja ele exportado a 24px ou
 * a 512px.
 *
 * Duas coisas acontecem aqui, e as duas so na TAG RAIZ:
 *
 *  1. width/height saem. Quem manda no tamanho e a prop `tamanho`; o numero
 *     que veio do editor de imagem nao interessa. Mexer so na raiz importa:
 *     ha arquivos com <rect width="..."> la dentro, e apagar aquilo
 *     desmontaria o desenho.
 *
 *  2. se nao houver viewBox, ele e criado a partir do width/height originais.
 *     Sem viewBox o SVG nao escala: um icone de 512 continuaria desenhando
 *     512px dentro da caixa de 20px e apareceria cortado.
 */
function normalizar(texto) {
  return texto.replace(/<svg\b[^>]*>/i, (tag) => {
    const largura = /\swidth="([\d.]+)[a-z%]*"/i.exec(tag)?.[1];
    const altura = /\sheight="([\d.]+)[a-z%]*"/i.exec(tag)?.[1];
    let nova = tag.replace(/\swidth="[^"]*"/i, "").replace(/\sheight="[^"]*"/i, "");
    if (!/\sviewBox=/i.test(nova) && largura && altura) {
      nova = nova.replace("<svg", `<svg viewBox="0 0 ${largura} ${altura}"`);
    }
    return nova;
  });
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
    .then(normalizar)
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
  //
  // O `fill="currentColor"` no <svg> raiz existe por causa dos arquivos que
  // NAO declaram cor nenhuma - varios dos icones novos sao assim. Um <path>
  // sem fill herda do pai; sem esse atributo o navegador usa o padrao dele,
  // que e PRETO CRAVADO, e o icone ficava invisivel no menu escuro (foi o que
  // aconteceu com Equipe e Ajuda). Com a heranca declarada, esses arquivos
  // acompanham a cor do texto: cinza no item comum, preto no item ativo.
  const conteudo = monocromatico
    ? svg
        // TODA cor cede - nao so o preto. Os arquivos novos vem em cinzas,
        // azuis e ate com gradiente; enquanto so o preto era trocado, esses
        // ficavam com a cor do arquivo no menu escuro e nao acompanhavam o
        // item ativo (foi o caso de Equipe e Ajuda). "none" fica como esta:
        // ali a ausencia de preenchimento e o desenho.
        .replace(/(stroke|fill)="([^"]+)"/gi, (todo, attr, cor) =>
          cor.trim().toLowerCase() === "none" ? todo : `${attr}="currentColor"`
        )
        .replace(/<svg\b[^>]*>/i, (tag) =>
          // So quando a raiz nao declara cor: um fill="none" ali e informacao
          // (icone de traco), e sobrescrever aquilo encheria o desenho.
          /\sfill=/i.test(tag) ? tag : tag.replace("<svg", '<svg fill="currentColor"')
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
