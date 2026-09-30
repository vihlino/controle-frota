/**
 * usuarios.js - Cadastro de acessos ao sistema.
 *
 * Nao usa a fabrica crud.js porque senha nao pode ser tratada como um campo
 * qualquer: ela precisa virar hash antes de ir para o banco, nunca volta numa
 * consulta e nunca entra na auditoria.
 *
 * Um usuario sempre nasce a partir de um SERVIDOR ja cadastrado - a pessoa
 * existe primeiro, o acesso vem depois.
 *
 * Rotas:
 *   GET  /api/usuarios      lista com perfil, setor e ultimo acesso
 *   POST /api/usuarios      cria o acesso
 *   PUT  /api/usuarios/:id  troca perfil, ativa/desativa ou define nova senha
 */
import { Router } from "express";
import bcrypt from "bcryptjs";

// As regras de senha moram em ../regrasSenha.js: o primeiro acesso (sessao.js)
// usa as mesmas.
import { query } from "../db.js";
import { autenticar, exigePermissao, esquecerUsuario } from "../auth.js";
import { problemaNaSenha } from "../regrasSenha.js";
import { registrarAuditoria } from "../auditoria.js";

const router = Router();
const gerenciar = exigePermissao("ADMIN_GERENCIAR_USUARIOS");

const SELECT = `usuario.id_usuario, usuario.login, usuario.status, usuario.ultimo_acesso,
                servidor.id_servidor, servidor.nome, servidor.matricula, servidor.email,
                servidor.cargo_funcao,
                perfil.id_perfil, perfil.nome AS perfil,
                setor.nome AS setor`;
const FROM = `usuario
              JOIN servidor ON servidor.id_servidor = usuario.id_servidor
              JOIN perfil   ON perfil.id_perfil     = usuario.id_perfil
              JOIN setor    ON setor.id_setor       = servidor.id_setor`;

router.get("/", autenticar, exigePermissao("ADMIN_VISUALIZAR"), async (req, res, next) => {
  try {
    const pagina = Math.max(1, Number(req.query.pagina) || 1);
    const porPagina = Math.min(200, Math.max(5, Number(req.query.porPagina) || 10));

    const condicoes = [];
    const valores = [];
    if (req.query.perfil) {
      valores.push(Number(req.query.perfil));
      condicoes.push(`usuario.id_perfil = $${valores.length}`);
    }
    if (req.query.status !== undefined && req.query.status !== "") {
      valores.push(req.query.status === "true");
      condicoes.push(`usuario.status = $${valores.length}`);
    }
    if (req.query.setor) {
      valores.push(Number(req.query.setor));
      condicoes.push(`servidor.id_setor = $${valores.length}`);
    }
    if (req.query.busca) {
      valores.push(`%${String(req.query.busca).trim()}%`);
      const i = valores.length;
      condicoes.push(
        `(usuario.login ILIKE $${i} OR servidor.nome ILIKE $${i} OR servidor.matricula ILIKE $${i})`
      );
    }
    const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";

    const ORDENAVEIS = {
      login: "usuario.login", nome: "servidor.nome",
      perfil: "perfil.nome", ultimo_acesso: "usuario.ultimo_acesso",
    };
    const coluna = ORDENAVEIS[req.query.ordenarPor] || "servidor.nome";
    const direcao = String(req.query.direcao).toUpperCase() === "DESC" ? "DESC" : "ASC";

    const total = await query(`SELECT COUNT(*)::int AS total FROM ${FROM} ${where}`, valores);
    const pagVal = [...valores, porPagina, (pagina - 1) * porPagina];
    const { rows } = await query(
      `SELECT ${SELECT} FROM ${FROM} ${where}
        ORDER BY ${coluna} ${direcao}
        LIMIT $${pagVal.length - 1} OFFSET $${pagVal.length}`,
      pagVal
    );

    res.json({
      itens: rows,
      total: total.rows[0].total,
      pagina,
      porPagina,
      paginas: Math.max(1, Math.ceil(total.rows[0].total / porPagina)),
    });
  } catch (e) {
    next(e);
  }
});

/**
 * Cria o acesso de um servidor.
 *
 * A SENHA INICIAL E O CPF do servidor, so os numeros. Nao vem da tela: quem
 * cria o usuario nao escolhe nem digita senha nenhuma - e a pessoa sabe o
 * proprio CPF, entao o administrador nao precisa combinar senha com ninguem.
 *
 * Por ser um dado que outras pessoas tambem conhecem, ela vale so ate o
 * primeiro acesso: o usuario nasce com trocar_senha = TRUE, e o sistema nao
 * libera nada antes de a pessoa criar a propria senha (auth.js).
 *
 * As regras de senha (regrasSenha.js) nao se aplicam ao CPF - ele e so
 * numeros, e seria recusado. Elas valem para a senha que a pessoa cria.
 */
router.post("/", autenticar, gerenciar, async (req, res, next) => {
  try {
    const { id_servidor, id_perfil, login } = req.body;
    if (!id_servidor || !id_perfil || !login) {
      return res.status(400).json({ erro: "Informe servidor, perfil e login." });
    }

    const serv = await query(
      "SELECT nome, cpf, matricula FROM servidor WHERE id_servidor = $1",
      [Number(id_servidor)]
    );
    if (!serv.rows[0]) return res.status(404).json({ erro: "Servidor não encontrado." });
    const cpf = String(serv.rows[0].cpf || "").replace(/\D/g, "");
    if (cpf.length !== 11) {
      return res.status(400).json({
        erro: "Este servidor não tem CPF completo no cadastro, e a senha inicial é o CPF. " +
              "Corrija o CPF em Administração → Servidores e tente de novo.",
      });
    }

    const { rows } = await query(
      `INSERT INTO usuario (id_servidor, id_perfil, login, senha_hash, trocar_senha)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id_usuario, login, status`,
      [id_servidor, id_perfil, String(login).trim(), await bcrypt.hash(cpf, 10)]
    );

    await registrarAuditoria({
      idUsuario: req.usuario.id_usuario,
      acao: "CRIAR",
      entidade: "usuario",
      idRegistro: rows[0].id_usuario,
      // A senha nunca entra na auditoria, nem como hash.
      dadosNovos: { login: rows[0].login, id_servidor, id_perfil },
    });

    // Devolve o que a tela mostra no resumo "Novo usuario SITRA". O CPF volta
    // aqui porque e a senha inicial que o administrador vai informar - so para
    // quem acabou de criar o acesso, e nunca na listagem.
    res.status(201).json({
      ...rows[0],
      nome: serv.rows[0].nome,
      cpf,
      matricula: serv.rows[0].matricula,
    });
  } catch (e) {
    if (e.code === "23505") {
      return res.status(409).json({ erro: "Já existe usuário com esse login ou servidor." });
    }
    next(e);
  }
});

router.put("/:id", autenticar, gerenciar, async (req, res, next) => {
  try {
    const idUsuario = Number(req.params.id);
    if (!Number.isInteger(idUsuario)) return res.status(400).json({ erro: "Usuário inválido." });
    const { id_perfil, status, senha } = req.body;

    const atribuicoes = [];
    const valores = [];
    if (id_perfil !== undefined) {
      valores.push(id_perfil);
      atribuicoes.push(`id_perfil = $${valores.length}`);
    }
    if (status !== undefined) {
      valores.push(status);
      atribuicoes.push(`status = $${valores.length}`);
    }
    if (senha) {
      // O login entra na conferencia tambem na TROCA de senha. Antes so o
      // cadastro olhava isso, e trocar a senha para o proprio login passava.
      const dono = await query("SELECT login FROM usuario WHERE id_usuario = $1", [idUsuario]);
      const problema = problemaNaSenha(senha, dono.rows[0]?.login);
      if (problema) return res.status(400).json({ erro: problema });
      valores.push(await bcrypt.hash(String(senha), 10));
      atribuicoes.push(`senha_hash = $${valores.length}`);
      // Marca a troca: a autenticacao recusa token emitido antes disto, entao
      // trocar a senha derruba as sessoes que estavam abertas.
      atribuicoes.push("senha_alterada_em = NOW()");
      /*
       * Senha definida pelo administrador PARA OUTRA PESSOA vale so ate o
       * proximo acesso dela: e uma senha que duas pessoas conhecem. Quando o
       * administrador troca a PROPRIA senha por esta tela, nao faz sentido
       * obriga-lo a trocar de novo.
       */
      valores.push(idUsuario !== Number(req.usuario.id_usuario));
      atribuicoes.push(`trocar_senha = $${valores.length}`);
    }
    if (!atribuicoes.length) return res.status(400).json({ erro: "Nada para alterar." });

    valores.push(idUsuario);
    const { rows } = await query(
      `UPDATE usuario SET ${atribuicoes.join(", ")}
        WHERE id_usuario = $${valores.length}
        RETURNING id_usuario, login, status, id_perfil`,
      valores
    );
    if (!rows[0]) return res.status(404).json({ erro: "Usuário não encontrado." });

    // O estado deste usuario esta guardado por 30s na autenticacao; sem isto,
    // desativar alguem so faria efeito no fim desse prazo.
    esquecerUsuario(idUsuario);

    await registrarAuditoria({
      idUsuario: req.usuario.id_usuario,
      acao: senha ? "ALTERAR_SENHA" : "EDITAR",
      entidade: "usuario",
      idRegistro: idUsuario,
      dadosNovos: { id_perfil: rows[0].id_perfil, status: rows[0].status },
    });

    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

export default router;
