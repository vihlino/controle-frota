/**
 * permissoes.js - Catalogo de permissoes e vinculo com os perfis.
 *
 * O modelo de acesso do SITRA e:
 *
 *     Usuario -> Perfil -> Permissoes -> Modulos e acoes
 *
 * O usuario nao recebe permissao direta: ele herda as do perfil. Mudar o perfil
 * muda o acesso no proximo login, quando o token e emitido de novo.
 *
 *   GET /api/permissoes             catalogo, agrupado por modulo
 *   GET /api/permissoes/perfil/:id  ids das permissoes de um perfil
 *   PUT /api/permissoes/perfil/:id  substitui todas de uma vez, em transacao
 */
import { Router } from "express";
import { query, pool } from "../db.js";
import { autenticar, exigePermissao } from "../auth.js";
import { registrarAuditoria } from "../auditoria.js";

const router = Router();

// Catalogo de permissoes, agrupado por modulo para a tela de Perfis.
router.get("/", autenticar, exigePermissao("PERFIL_VISUALIZAR"), async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id_permissao, codigo, nome, descricao, modulo
         FROM permissao WHERE status = TRUE
        ORDER BY modulo, nome`
    );
    const porModulo = {};
    for (const p of rows) (porModulo[p.modulo] ||= []).push(p);
    res.json({ itens: rows, porModulo });
  } catch (e) {
    next(e);
  }
});

router.get("/perfil/:id", autenticar, exigePermissao("PERFIL_VISUALIZAR"), async (req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT id_permissao FROM perfil_permissao WHERE id_perfil = $1",
      [Number(req.params.id)]
    );
    res.json(rows.map((r) => r.id_permissao));
  } catch (e) {
    next(e);
  }
});

// Substitui de uma vez as permissoes do perfil: apaga as antigas e grava as
// enviadas, tudo na mesma transacao para o perfil nunca ficar sem permissao
// nenhuma no meio do caminho.
router.put("/perfil/:id", autenticar, exigePermissao("PERFIL_EDITAR"), async (req, res, next) => {
  const cliente = await pool.connect();
  try {
    const idPerfil = Number(req.params.id);
    const permissoes = Array.isArray(req.body.permissoes) ? req.body.permissoes : [];

    await cliente.query("BEGIN");

    const anterior = await cliente.query(
      "SELECT id_permissao FROM perfil_permissao WHERE id_perfil = $1",
      [idPerfil]
    );

    await cliente.query("DELETE FROM perfil_permissao WHERE id_perfil = $1", [idPerfil]);

    if (permissoes.length) {
      await cliente.query(
        `INSERT INTO perfil_permissao (id_perfil, id_permissao)
         SELECT $1, unnest($2::bigint[])`,
        [idPerfil, permissoes]
      );
    }

    await cliente.query("COMMIT");

    await registrarAuditoria({
      idUsuario: req.usuario.id_usuario,
      acao: "EDITAR_PERMISSOES",
      entidade: "perfil",
      idRegistro: idPerfil,
      dadosAnteriores: { permissoes: anterior.rows.map((r) => r.id_permissao) },
      dadosNovos: { permissoes },
    });

    res.json({ ok: true, total: permissoes.length });
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    next(e);
  } finally {
    cliente.release();
  }
});

export default router;
