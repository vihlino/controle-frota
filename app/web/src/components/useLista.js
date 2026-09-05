/**
 * useLista.js - O "cerebro" de toda tela de listagem.
 *
 * O QUE E UM HOOK
 * ---------------
 * No React, um hook e uma função que guarda estado e comportamento para ser
 * reaproveitada entre telas. Toda função que comeca com "use" e um hook.
 *
 * O QUE ESTE AQUI RESOLVE
 * -----------------------
 * Toda tela de listagem do SITRA precisa de: filtros, ordenacao, pagina atual,
 * quantos itens por página, chamar a API quando qualquer um desses muda,
 * mostrar "carregando", tratar erro e recarregar depois de salvar algo.
 *
 * Em vez de repetir isso em 20 telas, elas chamam:
 *
 *     const lista = useLista("frotas/veiculos", { busca: "", setor: "" });
 *
 * e recebem tudo pronto.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";

/**
 * @param {string} recurso          Caminho na API, sem a barra inicial.
 *                                  Ex.: "frotas/veiculos"
 * @param {object} filtrosIniciais  Os filtros e seus valores de partida.
 *                                  Ex.: { busca: "", setor: "", status: "" }
 * @returns {object} Tudo o que a tela precisa - veja o return no fim.
 */
export function useLista(recurso, filtrosIniciais = {}, fixos = {}) {
  const [filtros, setFiltros] = useState(filtrosIniciais);
  const [ordem, setOrdem] = useState({ campo: "", direcao: "ASC" });
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const [resultado, setResultado] = useState(null);   // resposta da API
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  // Contador que serve so para forcar uma nova busca: mudar o numero faz o
  // useEffect abaixo rodar de novo.
  const [recarga, setRecarga] = useState(0);
  // useRef guarda um valor que sobrevive entre renderizações SEM causar nova
  // renderizacao quando muda. Aqui ele guarda os filtros originais para o
  // botao "Limpar" saber para onde voltar.
  const iniciais = useRef(filtrosIniciais);
  // Os filtros fixos tambem ficam numa ref: eles nao mudam durante a vida da
  // tela, e assim o `limpar` nao precisa ser recriado a cada render.
  const fixosRef = useRef(fixos);
  const navegar = useNavigate();
  const location = useLocation();

  /**
   * Este useEffect e o coracao do hook: ele roda toda vez que algo que afeta a
   * consulta muda (filtros, ordem, pagina, porPagina ou recarga) e busca os
   * dados de novo.
   */
  useEffect(() => {
    // Monta a query string da URL a partir do estado atual.
    const parâmetros = new URLSearchParams({
      pagina: String(pagina),
      porPagina: String(porPagina),
    });
    for (const [chave, valor] of Object.entries(filtros)) {
      // Filtro vazio nao vai para a URL - senao a API receberia "setor=" e
      // tentaria filtrar por setor nenhum.
      if (valor !== "" && valor !== null && valor !== undefined) {
        parâmetros.set(chave, String(valor).trim());
      }
    }
    if (ordem.campo) {
      parâmetros.set("ordenarPor", ordem.campo);
      parâmetros.set("direcao", ordem.direcao);
    }

    setCarregando(true);

    // ESPERA DE 300ms (o "debounce"):
    // Sem isso, digitar "GOL" no campo de busca dispararia 3 requisicoes (G,
    // GO, GOL). Com a espera, so a ultima sobrevive - as anteriores sao
    // canceladas pelo clearTimeout na limpeza abaixo.
    const temporizador = setTimeout(() => {
      api(`/${recurso}?${parâmetros}`)
        .then((r) => {
          setResultado(r);
          setErro("");
        })
        .catch((e) => setErro(e.message))
        .finally(() => setCarregando(false));
    }, 300);

    // Função de limpeza: o React a chama antes de rodar o efeito de novo (ou
    // quando a tela e fechada). E ela que cancela a busca anterior.
    return () => clearTimeout(temporizador);
  }, [recurso, filtros, ordem, pagina, porPagina, recarga]);

  /**
   * Muda um filtro e volta para a primeira pagina.
   * (Sem esse reset, filtrar estando na pagina 5 poderia mostrar uma lista
   * vazia, porque o resultado filtrado tem menos de 5 paginas.)
   */
  const alterarFiltro = useCallback((campo, valor) => {
    setFiltros((f) => ({ ...f, [campo]: valor }));
    setPagina(1);
  }, []);

  /**
   * Zera os filtros. Usado pelo botao "Limpar".
   *
   * ANTES ele devolvia os filtros INICIAIS, e isso escondia um problema: quem
   * chega em /frotas/documentos?status=VENCENDO pelo painel comeca com esse
   * filtro ligado, entao ele fazia parte dos "iniciais" - e o Limpar o trazia
   * de volta. A pessoa clicava em Limpar, via os outros campos zerarem e a
   * lista continuar filtrada, sem entender por que.
   *
   * Agora limpar e limpar: todo campo volta a vazio. A unica excecao sao os
   * filtros FIXOS, que nao tem controle na tela (Motoristas = servidores com
   * condutor=true) - zerar aquilo mudaria a tela, nao o filtro.
   *
   * O parametro tambem sai da URL: se ficasse la, um F5 traria o filtro de
   * volta depois de a pessoa ter pedido para limpar.
   */
  const limpar = useCallback(() => {
    setFiltros(
      Object.fromEntries(
        Object.keys(iniciais.current).map((campo) => [campo, fixosRef.current[campo] ?? ""])
      )
    );
    setOrdem({ campo: "", direcao: "ASC" });
    setPagina(1);
    if (location.search) navegar(location.pathname, { replace: true });
  }, [navegar, location.pathname, location.search]);

  /**
   * Ordena por uma coluna. Clicar de novo na mesma coluna inverte a direcao;
   * clicar em outra comeca crescente.
   */
  const ordenarPor = useCallback((campo) => {
    setOrdem((o) =>
      o.campo === campo
        ? { campo, direcao: o.direcao === "ASC" ? "DESC" : "ASC" }
        : { campo, direcao: "ASC" }
    );
  }, []);

  /**
   * Busca os dados de novo sem mexer em filtro nenhum.
   * As telas chamam isso depois de salvar ou excluir, para a tabela refletir
   * a mudanca.
   */
  const recarregar = useCallback(() => setRecarga((n) => n + 1), []);

  return {
    filtros, alterarFiltro, limpar,   // estado e controle dos filtros
    ordem, ordenarPor,                // estado e controle da ordenacao
    pagina, setPagina, porPagina, setPorPagina,  // paginacao
    resultado, carregando, erro,      // o que veio da API
    recarregar,                       // forcar nova busca
  };
}
