/**
 * Icone.jsx - Mostra um icone SVG da pasta public/icons.
 *
 * O PROBLEMA QUE ELE RESOLVE
 * --------------------------
 * Os SVGs entregues pelo Cesar vem com a cor fixa no arquivo:
 *
 *     <svg ... stroke="#0d0d0d">
 *
 * Um icone preto fixo some na barra lateral, que e preta. Usar <img> nao
 * ajuda, porque CSS nao alcanca o conteudo de uma imagem.
 *
 * A SOLUCAO
 * ---------
 * Ler o arquivo, trocar o preto por "currentColor" e injetar o SVG direto na
 * pagina. "currentColor" faz o icone assumir a cor do texto ao redor - entao
 * ele fica claro na lateral escura, escuro no fundo claro, e preto dentro de
 * um botao amarelo, sem nenhuma regra extra.
 *
 * USO:  <Icone nome="nav-frotas" tamanho={20} />
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
function ehPretoOuEstado(cor) {
  const c = cor.trim().toLowerCase();
  if (c === "none" || c === "currentcolor") return false;
  if (c === "black") return true;
  if (c === "#ff0000" || c === "#11ce00") return true;

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
      texto
        // Troca as cores fixas por currentColor. A regra antiga so cobria
        // #0d0d0d e #000000; os arquivos exportados do editor vem com pretos
        // "sujos" - #020202, #0A0A0A, black - que passavam batido e ficavam
        // pretos fixos, sumindo na lateral escura.
        .replace(/(stroke|fill)="([^"]+)"/gi, (todo, attr, cor) =>
          ehPretoOuEstado(cor) ? `${attr}="currentColor"` : todo
        )
        // Remove width/height do arquivo, para o tamanho ser decidido aqui
        // pela prop `tamanho`, e nao pelo que veio do editor de imagem.
        .replace(/\swidth="[\d.]+"/i, "")
        .replace(/\sheight="[\d.]+"/i, "")
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
export default function Icone({ nome, tamanho = 20, className = "" }) {
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
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
