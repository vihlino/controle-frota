/**
 * cargos.js - Lista simples de cargos ativos.
 *
 * Igual ao setores.js, e pelo mesmo motivo: o cadastro completo de cargos vive
 * no CRUD da Administracao (admin.js), mas varias telas precisam apenas
 * preencher um <select>. Exige so estar logado.
 *
 * A rota devolve TODOS os cargos ativos, com o id_setor de cada um, e deixa a
 * tela filtrar pelo setor escolhido no formulario. Poderia receber ?setor= e
 * filtrar aqui, mas ai cada troca de setor no formulario viraria uma ida ao
 * servidor - e a lista de cargos de uma prefeitura cabe folgada numa resposta
 * so. Menos idas, e o campo responde na hora.
 */
import { Router } from "express";
import { query } from "../db.js";
import { autenticar } from "../auth.js";

const router = Router();

router.get("/", autenticar, async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id_cargo, nome, id_setor
         FROM cargo
        WHERE status = TRUE
        ORDER BY nome`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

export default router;
