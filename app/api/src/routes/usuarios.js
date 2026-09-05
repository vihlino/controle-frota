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
import { query } from "../db.js";
import { autenticar, exigePermissao } from "../auth.js";
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

router.post("/", autenticar, gerenciar, async (req, res, next) => {
  try {
    const { id_servidor, id_perfil, login, senha } = req.body;
    if (!id_servidor || !id_perfil || !login || !senha) {
      return res.status(400).json({ erro: "Informe servidor, perfil, login e senha." });
    }
    if (String(senha).length < 8) {
      return res.status(400).json({ erro: "A senha precisa ter ao menos 8 caracteres." });
    }

    const { rows } = await query(
      `INSERT INTO usuario (id_servidor, id_perfil, login, senha_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id_usuario, login, status`,
      [id_servidor, id_perfil, String(login).trim(), await bcrypt.hash(String(senha), 10)]
    );

    await registrarAuditoria({
      idUsuario: req.usuario.id_usuario,
      acao: "CRIAR",
      entidade: "usuario",
      idRegistro: rows[0].id_usuario,
      // A senha nunca entra na auditoria, nem como hash.
      dadosNovos: { login: rows[0].login, id_servidor, id_perfil },
    });

    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === "23505") {
      return res.status(409).json({ erro: "Ja existe usuário com esse login ou servidor." });
    }
    next(e);
  }
});

router.put("/:id", autenticar, gerenciar, async (req, res, next) => {
  try {
    const idUsuario = Number(req.params.id);
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
      if (String(senha).length < 8) {
        return res.status(400).json({ erro: "A senha precisa ter ao menos 8 caracteres." });
      }
      valores.push(await bcrypt.hash(String(senha), 10));
      atribuicoes.push(`senha_hash = $${valores.length}`);
    }
    if (!atribuicoes.length) return res.status(400).json({ erro: "Nada para alterar." });

    valores.push(idUsuario);
    const { rows } = await query(
      `UPDATE usuario SET ${atribuicoes.join(", ")}
        WHERE id_usuario = $${valores.length}
        RETURNING id_usuario, login, status, id_perfil`,
      valores
    );
    if (!rows[0]) return res.status(404).json({ erro: "Usuário não encontrado" });

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
