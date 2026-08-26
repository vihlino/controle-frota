/**
 * api.js - O unico lugar do front que fala com o servidor.
 *
 * Toda tela usa a funcao api() daqui. Concentrar isso num arquivo so resolve
 * de uma vez: o token de autenticacao, o cabecalho JSON, o tratamento de erro
 * e o que fazer quando a sessao expira.
 */

// Nome da "gaveta" onde o token fica guardado no navegador.
const CHAVE_TOKEN = "sitra.token";

/**
 * Le o token guardado no navegador.
 *
 * localStorage e um armazenamento do proprio navegador que sobrevive a fechar
 * a aba e desligar o computador. E por isso que voce continua logado ao voltar.
 *
 * @returns {string|null} O token, ou null se ninguem esta logado.
 */
export function lerToken() {
  return localStorage.getItem(CHAVE_TOKEN);
}

/**
 * Guarda ou apaga o token.
 * @param {string|null} token  Passar null faz logout (apaga o token).
 */
export function gravarToken(token) {
  if (token) localStorage.setItem(CHAVE_TOKEN, token);
  else localStorage.removeItem(CHAVE_TOKEN);
}

/**
 * Erro vindo da API, carregando o codigo HTTP junto.
 *
 * Existe para a tela poder diferenciar os casos quando precisa (403 = sem
 * permissao, 409 = conflito, 404 = nao encontrado). Na maioria das vezes basta
 * mostrar e.message, que ja vem em portugues do servidor.
 */
export class ErroApi extends Error {
  constructor(mensagem, status) {
    super(mensagem);
    this.status = status;
  }
}

/**
 * Faz uma requisicao para a API.
 *
 * @param {string} caminho    Rota sem o prefixo /api. Ex.: "/frotas/veiculos"
 * @param {object} [opcoes]
 * @param {string} [opcoes.method]  "GET" (padrao), "POST", "PUT", "DELETE"
 * @param {object} [opcoes.body]    Objeto JavaScript - a funcao converte para
 *                                  JSON sozinha, nao passe string.
 * @returns {Promise<any>} O JSON da resposta (ou null quando a resposta e 204).
 * @throws {ErroApi} Quando o servidor responde com erro.
 *
 * Exemplos:
 *   const lista = await api("/frotas/veiculos?pagina=1");
 *   await api("/frotas/veiculos", { method: "POST", body: { placa: "ABC1D23" } });
 *   await api("/frotas/veiculos/5", { method: "DELETE" });
 *
 * Sobre o endereco: o caminho fica relativo ("/api/..."), sem servidor nenhum
 * escrito. Em desenvolvimento o Vite repassa para localhost:3333; em producao
 * o front e a API ficam no mesmo dominio. Assim nao existe URL de servidor
 * espalhada pelo codigo nem problema de CORS.
 */
// Em producao (Netlify), VITE_API_URL aponta para a URL do Render.
// Em desenvolvimento, fica vazio e o proxy do Vite cuida do /api.
const BASE = (typeof __API_URL__ !== "undefined" && __API_URL__) ? __API_URL__ : "";

export async function api(caminho, opcoes = {}) {
  const token = lerToken();

  const resposta = await fetch(`${BASE}/api${caminho}`, {
    ...opcoes,
    headers: {
      "Content-Type": "application/json",
      // O token so entra se existir - as rotas publicas (checklist via QR Code)
      // funcionam sem ele.
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opcoes.headers,
    },
    body: opcoes.body ? JSON.stringify(opcoes.body) : undefined,
  });

  // 204 = "deu certo, sem conteudo". E o que o DELETE devolve. Tentar ler JSON
  // de uma resposta vazia daria erro.
  if (resposta.status === 204) return null;

  // O .catch aqui cobre o caso de o servidor devolver algo que nao e JSON
  // (uma pagina de erro do proxy, por exemplo).
  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    // 401 fora da tela de login significa sessao expirada: limpamos o token
    // para o app perceber que ninguem esta logado e voltar para a entrada.
    // A excecao e o proprio login, onde 401 e so "senha errada".
    if (resposta.status === 401 && !caminho.startsWith("/sessao/login")) {
      gravarToken(null);
    }
    throw new ErroApi(dados.erro || "Nao foi possivel completar a operacao.", resposta.status);
  }

  return dados;
}
