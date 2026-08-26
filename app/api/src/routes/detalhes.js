/**
 * detalhes.js - Consultas das telas de detalhe.
 *
 * Sao consultas que nao cabem no padrao da fabrica crud.js, porque juntam
 * varias tabelas ou montam formatos proprios.
 *
 *   /api/frotas/inspecoes/:id/itens      itens verificados de uma inspecao
 *   /api/frotas/veiculos/:id/historico   linha do tempo do veiculo, com
 *                                        checklists, inspecoes, OS e sinistros
 *                                        reunidos num UNION
 *   /api/frotas/veiculos/:id/resumo      contagens para os cartoes do topo
 */
import { Router } from "express";
import { query } from "../db.js";
import { autenticar, exigePermissao } from "../auth.js";

const router = Router();
const verFrotas = exigePermissao("FROTAS_VISUALIZAR");

// Itens verificados de uma inspecao, na ordem em que foram registrados.
router.get("/inspecoes/:id/itens", autenticar, verFrotas, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id_inspecao_item, item, resultado, observacao
         FROM inspecao_item
        WHERE id_inspecao = $1
        ORDER BY id_inspecao_item`,
      [Number(req.params.id)]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Historico completo de um veiculo: checklists, inspecoes, OS e sinistros
// reunidos numa linha do tempo unica.
router.get("/veiculos/:id/historico", autenticar, verFrotas, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await query(
      `SELECT * FROM (
         SELECT 'CHECKLIST' AS origem, c.id_checklist AS id_registro,
                c.data_abertura AS data, c.status,
                COALESCE(c.percurso, 'Checklist do veiculo') AS titulo,
                s.nome AS pessoa
           FROM checklist_frotas c
           JOIN servidor s ON s.id_servidor = c.id_servidor
          WHERE c.id_veiculo = $1

         UNION ALL
         SELECT 'INSPECAO', i.id_inspecao, i.data_realizacao, i.status,
                COALESCE(i.numero, 'Inspecao ' || i.tipo), s.nome
           FROM inspecao i
           JOIN usuario u  ON u.id_usuario  = i.id_gestor
           JOIN servidor s ON s.id_servidor = u.id_servidor
          WHERE i.id_veiculo = $1

         UNION ALL
         SELECT 'MANUTENCAO', os.id_os, os.data_abertura::date, os.status,
                COALESCE(os.descricao, os.servico_realizado, 'Ordem de servico'), s.nome
           FROM ordem_servico os
           JOIN usuario u  ON u.id_usuario  = os.id_solicitante
           JOIN servidor s ON s.id_servidor = u.id_servidor
          WHERE os.id_veiculo = $1

         UNION ALL
         SELECT 'SINISTRO', si.id_sinistro, si.data, si.status,
                COALESCE(si.numero, 'Sinistro') || ' - ' || si.local, s.nome
           FROM sinistro si
           JOIN servidor s ON s.id_servidor = si.id_servidor
          WHERE si.id_veiculo = $1
       ) linha
       ORDER BY data DESC
       LIMIT 60`,
      [id]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Resumo do veiculo para a tela de detalhes: contagens de cada modulo.
router.get("/veiculos/:id/resumo", autenticar, verFrotas, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await query(
      `SELECT
         (SELECT COUNT(*)::int FROM checklist_frotas WHERE id_veiculo = $1) AS checklists,
         (SELECT COUNT(*)::int FROM inspecao WHERE id_veiculo = $1) AS inspecoes,
         (SELECT COUNT(*)::int FROM ordem_servico
           WHERE id_veiculo = $1 AND status NOT IN ('RESOLVIDA','CANCELADA')) AS os_abertas,
         (SELECT COUNT(*)::int FROM sinistro WHERE id_veiculo = $1) AS sinistros,
         (SELECT COUNT(*)::int FROM documento_veiculo
           WHERE id_veiculo = $1 AND status = 'VENCIDO') AS documentos_vencidos,
         (SELECT COALESCE(SUM(custo), 0) FROM ordem_servico WHERE id_veiculo = $1) AS custo_manutencao`,
      [id]
    );
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

export default router;
