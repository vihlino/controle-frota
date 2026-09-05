/**
 * api.js - O unico lugar do front que fala com o servidor.
 *
 * Toda tela usa a função api() daqui. Concentrar isso num arquivo so resolve
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
 * Erro vindo da API, carregando o código HTTP junto.
 *
 * Existe para a tela poder diferenciar os casos quando precisa (403 = sem
 * permissão, 409 = conflito, 404 = não encontrado). Na maioria das vezes basta
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
 * @param {object} [opcoes.body]    Objeto JavaScript - a função converte para
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
 * espalhada pelo código nem problema de CORS.
 */
// Em producao (Vercel), VITE_API_URL aponta para a URL da API no Render.
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
    // 401 no login e na confirmacao de senha significa SENHA ERRADA, nao
    // sessao expirada. Apagar o token ali derrubava a pessoa para a tela de
    // entrada por causa de um erro de digitacao - e ainda por cima perdendo o
    // formulario que ela estava salvando.
    const senhaErrada =
      caminho.startsWith("/sessao/login") || caminho.startsWith("/sessao/confirmar");
    if (resposta.status === 401 && !senhaErrada) {
      gravarToken(null);
    }
    throw new ErroApi(dados.erro || "Não foi possivel completar a operação.", resposta.status);
  }

  return dados;
}

/**
 * Baixa um ARQUIVO da API (foto, PDF) e devolve um endereco local para o
 * navegador exibir.
 *
 * Existe porque essas rotas exigem o token no cabecalho, e um <img src="/api/..">
 * nao manda cabecalho nenhum - a imagem voltaria 401. Aqui a resposta vem como
 * blob e vira uma URL de memoria.
 *
 * Quem chama deve liberar com URL.revokeObjectURL quando a tela sair, senao o
 * navegador segura a imagem na memoria ate recarregar a pagina.
 *
 * @param {string} caminho  Rota sem o prefixo /api.
 * @returns {Promise<string>} URL local (blob:) pronta para o src da imagem.
 */
export async function apiArquivo(caminho) {
  const token = lerToken();
  const resposta = await fetch(`${BASE}/api${caminho}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resposta.ok) throw new ErroApi("Não foi possivel carregar o arquivo.", resposta.status);
  return URL.createObjectURL(await resposta.blob());
}
