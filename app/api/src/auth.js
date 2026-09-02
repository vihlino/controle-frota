/**
 * auth.js - Autenticacao e controle de acesso.
 *
 * O SITRA usa JWT (JSON Web Token). Funciona assim:
 *
 *   1. O usuario faz login (routes/sessao.js confere a senha).
 *   2. O servidor devolve um token assinado, contendo quem e o usuario e
 *      quais permissoes ele tem.
 *   3. O front guarda esse token e o manda em toda requisicao, no cabecalho
 *      Authorization: Bearer <token>.
 *   4. Este arquivo confere a assinatura e libera (ou nao) a rota.
 *
 * A vantagem do JWT: o servidor nao precisa guardar sessao nenhuma. A
 * desvantagem: um token emitido vale ate expirar, mesmo que o usuario seja
 * desativado no meio do caminho. Por isso o prazo e curto (8h por padrao).
 */
import jwt from "jsonwebtoken";

// A chave que assina os tokens. Se ela vazar, qualquer um consegue forjar um
// token de administrador - por isso ela vive no .env e nunca no codigo.
const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 32) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET nao definido ou muito curto. Configure no painel do Render.");
  }
  console.warn("[AVISO] JWT_SECRET nao definido — usando chave fraca so para desenvolvimento.");
}
const _SECRET = SECRET || "dev_secret_apenas_para_desenvolvimento_local";

/**
 * Cria um token assinado com os dados do usuario.
 *
 * @param {object} payload  O que vai dentro do token: id, login, perfil e a
 *                          lista de permissoes. ATENCAO: o conteudo de um JWT
 *                          e apenas codificado, nao criptografado - qualquer um
 *                          consegue ler. Nunca coloque senha ou dado sigiloso
 *                          aqui. A assinatura garante que ninguem ALTEROU o
 *                          conteudo, nao que ninguem o leu.
 * @returns {string} O token pronto para o front guardar.
 */
export function assinarToken(payload) {
  return jwt.sign(payload, _SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  });
}

/**
 * Middleware que exige usuario autenticado.
 *
 * "Middleware" e uma funcao que roda ANTES do handler da rota e decide se a
 * requisicao continua (chamando next()) ou para ali (respondendo com erro).
 *
 * Uso:  router.get("/algo", autenticar, (req, res) => { ... })
 *
 * Quando passa, deixa os dados do token em req.usuario, e o handler pode usar
 * req.usuario.id_usuario, req.usuario.permissoes etc.
 */
export function autenticar(req, res, next) {
  const header = req.headers.authorization || "";
  // O formato combinado e "Bearer <token>"; separamos o prefixo.
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ erro: "Nao autenticado" });

  try {
    // verify() confere a assinatura E a validade. Se qualquer uma falhar,
    // ele lanca excecao.
    req.usuario = jwt.verify(token, _SECRET);
    next();
  } catch {
    // Nao distinguimos "token invalido" de "token expirado" na mensagem: para
    // o usuario, os dois significam "entre de novo".
    res.status(401).json({ erro: "Sessao expirada. Entre novamente." });
  }
}

/**
 * Middleware que exige uma permissao especifica.
 *
 * Precisa vir DEPOIS de autenticar(), porque le req.usuario.
 *
 * Uso:  router.post("/x", autenticar, exigePermissao("FROTAS_GERENCIAR_VEICULOS"), handler)
 *
 * As permissoes vem do perfil do usuario (tabela perfil_permissao) e foram
 * gravadas dentro do token no momento do login.
 *
 * @param {string} codigo  O codigo da permissao, ex.: "FROTAS_VISUALIZAR".
 * @returns {Function} O middleware pronto para usar na rota.
 */
// Aceita mais de um codigo: basta ter UM deles. Existe porque alguns dados
// pertencem a mais de um modulo. A base de servidores e o caso claro: e da
// Administracao, mas o gestor de Frotas precisa dela para saber quem pode
// dirigir. Exigir a permissao de Administracao para isso obrigaria a dar ao
// gestor de frotas acesso a usuarios, perfis e parametros do sistema - muito
// mais do que ele precisa, so para conseguir ver uma lista de motoristas.
export function exigePermissao(...codigos) {
  const aceitos = codigos.flat();
  return (req, res, next) => {
    const permissoes = req.usuario?.permissoes || [];
    if (aceitos.some((c) => permissoes.includes(c))) return next();
    // 403 (proibido) e diferente de 401 (nao autenticado): aqui o sistema sabe
    // quem e a pessoa, ela simplesmente nao tem direito a esta acao.
    res.status(403).json({ erro: "Sem permissao para esta acao" });
  };
}
