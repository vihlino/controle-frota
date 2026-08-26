/**
 * alertas.js - Os alertas do sininho no topo.
 *
 * Traz os alertas pendentes destinados ao usuario ou a todos (id_usuario nulo),
 * ordenados por prioridade. O CASE no ORDER BY forca a ordem
 * CRITICA > ALTA > MEDIA > BAIXA, que a ordem alfabetica nao daria.
 */
import { Router } from "express";
import { query } from "../db.js";
import { autenticar } from "../auth.js";

const router = Router();

router.get("/", autenticar, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id_alerta, modulo, tipo, prioridade, titulo, mensagem,
              status, data_criacao
         FROM alerta
        WHERE status = 'PENDENTE'
          AND (id_usuario IS NULL OR id_usuario = $1)
        ORDER BY
          CASE prioridade
            WHEN 'CRITICA' THEN 1 WHEN 'ALTA' THEN 2
            WHEN 'MEDIA' THEN 3 ELSE 4
          END,
          data_criacao DESC
        LIMIT 20`,
      [req.usuario.id_usuario]
    );
    res.json({ itens: rows, naoLidos: rows.length });
  } catch (e) {
    next(e);
  }
});

export default router;
