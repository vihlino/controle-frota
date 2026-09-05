/**
 * setores.js - Lista simples de setores ativos.
 *
 * Existe separado do CRUD completo (que esta em admin.js) porque quase toda
 * tela precisa preencher um <select> de setores, e para isso basta id e nome.
 * Exige apenas estar logado, sem permissao especifica.
 */
import { Router } from "express";
import { query } from "../db.js";
import { autenticar } from "../auth.js";

const router = Router();

router.get("/", autenticar, async (_req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT id_setor, nome FROM setor WHERE status = TRUE ORDER BY nome"
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

export default router;
