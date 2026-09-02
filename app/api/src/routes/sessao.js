/**
 * sessao.js - Login, logout e "quem sou eu".
 *
 * Rotas:
 *   POST /api/sessao/login   confere senha e devolve o token
 *   GET  /api/sessao/eu      devolve o usuario do token (usado ao abrir o app)
 *   POST /api/sessao/logout  registra a saida
 *
 * A senha nunca e comparada em texto puro: o banco guarda so o hash bcrypt, e
 * bcrypt.compare() confere sem nunca reverter o hash.
 *
 * Todo evento de acesso (entrada, saida e tentativa falha) vai para a tabela
 * log_acesso, que alimenta a tela de Logs de Acesso.
 */
import { Router } from "express";
import bcrypt from "bcryptjs";
import { query } from "../db.js";
import { assinarToken, autenticar } from "../auth.js";

// A coluna endereco_ip e INET: o prefixo "::ffff:" que o Node poe em IPv4
// mapeado quebraria o INSERT.
function enderecoIp(req) {
  const ip = req.ip || "";
  const limpo = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  return limpo || null;
}

// O log de acesso nunca pode derrubar o login: falha aqui e so registrada.
async function registrarAcesso({ idUsuario, login, tipo, sucesso, req }) {
  try {
    await query(
      `INSERT INTO log_acesso
         (id_usuario, login_informado, tipo_evento, sucesso, endereco_ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [idUsuario, login, tipo, sucesso, enderecoIp(req), req.headers["user-agent"] || null]
    );
  } catch (e) {
    console.error("Falha ao gravar log_acesso:", e.message);
  }
}

// O V1.3 removeu as areas de gestao (o proprio SQL dropa area_gestao e
// usuario_area_gestao) e criou a view vw_perfil_usuario, que ja junta servidor,
// setor, perfil e as permissoes do perfil.
async function carregarUsuario(idUsuario) {
  const { rows } = await query(
    `SELECT id_usuario, login, usuario_ativo, ultimo_acesso,
            id_servidor, nome, email, telefone, matricula, cargo_funcao,
            setor, perfil, permissoes
       FROM vw_perfil_usuario
      WHERE id_usuario = $1`,
    [idUsuario]
  );
  if (!rows[0]) return null;

  const usuario = rows[0];
  return {
    ...usuario,
    // A view devolve objetos completos; o front so precisa dos codigos.
    permissoes: (usuario.permissoes || []).map((p) => p.codigo),
  };
}

const router = Router();

router.post("/login", async (req, res, next) => {
  try {
    const login = String(req.body?.login || "").trim();
    const senha = String(req.body?.senha || "");
    if (!login || !senha) {
      return res.status(400).json({ erro: "Informe login e senha." });
    }

    const { rows } = await query(
      "SELECT id_usuario, senha_hash, status FROM usuario WHERE login = $1",
      [login]
    );
    const encontrado = rows[0];

    // Mesma mensagem para login inexistente e senha errada, para nao revelar
    // quais logins existem.
    const senhaConfere =
      encontrado && (await bcrypt.compare(senha, encontrado.senha_hash));
    if (!senhaConfere) {
      await registrarAcesso({
        idUsuario: encontrado?.id_usuario ?? null,
        login,
        tipo: "FALHA_LOGIN",
        sucesso: false,
        req,
      });
      return res.status(401).json({ erro: "Login ou senha invalidos." });
    }
    if (!encontrado.status) {
      return res
        .status(403)
        .json({ erro: "Usuario inativo. Procure a administracao." });
    }

    await query(
      "UPDATE usuario SET ultimo_acesso = CURRENT_TIMESTAMP WHERE id_usuario = $1",
      [encontrado.id_usuario]
    );
    await registrarAcesso({
      idUsuario: encontrado.id_usuario,
      login,
      tipo: "LOGIN",
      sucesso: true,
      req,
    });

    const usuario = await carregarUsuario(encontrado.id_usuario);
    const token = assinarToken({
      id_usuario: usuario.id_usuario,
      login: usuario.login,
      perfil: usuario.perfil,
      permissoes: usuario.permissoes,
    });

    res.json({ token, usuario });
  } catch (e) {
    next(e);
  }
});

router.get("/eu", autenticar, async (req, res, next) => {
  try {
    const usuario = await carregarUsuario(req.usuario.id_usuario);
    if (!usuario) return res.status(401).json({ erro: "Usuario nao encontrado" });
    res.json({ usuario });
  } catch (e) {
    next(e);
  }
});

/**
 * Confirma a senha de quem esta logado.
 *
 * Usada antes de acoes destrutivas ou que alteram cadastro (salvar edicao,
 * excluir). Nao emite token novo nem muda a sessao: so responde se a senha
 * confere.
 *
 * POR QUE ISTO EXISTE
 * -------------------
 * O login prova quem entrou; nao prova quem esta na frente do computador
 * AGORA. Numa sala compartilhada, uma sessao aberta e esquecida permite que
 * qualquer pessoa apague um cadastro em nome de outra - e a auditoria
 * registraria o nome errado. Pedir a senha no momento da acao fecha essa
 * brecha.
 */
router.post("/confirmar", autenticar, async (req, res, next) => {
  try {
    const { senha } = req.body || {};
    if (!senha) return res.status(400).json({ erro: "Informe a senha." });

    const { rows } = await query(
      "SELECT senha_hash, status FROM usuario WHERE id_usuario = $1",
      [req.usuario.id_usuario]
    );
    const u = rows[0];
    const confere = u && u.status && (await bcrypt.compare(senha, u.senha_hash));

    if (!confere) {
      // Fica na auditoria: varias tentativas seguidas indicam alguem tentando
      // agir numa sessao que nao e sua.
      await registrarAcesso({
        idUsuario: req.usuario.id_usuario,
        login: req.usuario.login,
        tipo: "CONFIRMACAO_SENHA",
        sucesso: false,
        req,
      }).catch(() => {});
      return res.status(401).json({ erro: "Senha incorreta." });
    }

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.post("/logout", autenticar, async (req, res) => {
  await registrarAcesso({
    idUsuario: req.usuario.id_usuario,
    login: req.usuario.login,
    tipo: "LOGOUT",
    sucesso: true,
    req,
  });
  res.json({ ok: true });
});

export default router;
