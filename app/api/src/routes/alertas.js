/**
 * alertas.js - Os alertas do sininho no topo.
 *
 * DUAS ORIGENS
 * ------------
 * 1. A tabela `alerta`, para avisos gravados por alguem.
 * 2. Alertas CALCULADOS na hora da leitura (CNH vencendo, documento de veiculo
 *    vencendo). Estes nao ficam gravados.
 *
 * POR QUE CALCULAR EM VEZ DE GRAVAR
 * ---------------------------------
 * Um alerta de "vence em 30 dias" precisa nascer sozinho quando a data chega,
 * o que normalmente exige um agendador rodando todo dia. O sistema nao tem
 * agendador, e a tabela `alerta` nunca recebeu uma linha sequer - nenhum
 * gatilho ou codigo escrevia nela, entao o sininho estava permanentemente
 * vazio.
 *
 * Calcular na leitura resolve isso sem infraestrutura nova: a consulta e
 * barata (indice em cnh_data_validade e em data_validade), o aviso aparece no
 * dia certo sozinho e some sozinho quando o documento e renovado - sem sobrar
 * alerta velho para alguem limpar na mao.
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
    const calculados = await alertasCalculados();
    const itens = [...calculados, ...rows];

    res.json({ itens, naoLidos: itens.length });
  } catch (e) {
    next(e);
  }
});

/**
 * Avisos que nascem de uma data chegando perto, montados na hora.
 * @returns {Promise<Array>} no mesmo formato das linhas da tabela `alerta`.
 */
async function alertasCalculados() {
  const itens = [];

  // --- CNH de condutor ---
  const cnh = await query(
    `SELECT id_servidor, nome, matricula, cnh_data_validade,
            (cnh_data_validade - CURRENT_DATE) AS dias
       FROM servidor
      WHERE status = TRUE
        AND cnh_data_validade IS NOT NULL
        AND cnh_data_validade <= CURRENT_DATE + 30
      ORDER BY cnh_data_validade
      LIMIT 20`
  );

  for (const s of cnh.rows) {
    const vencida = s.dias < 0;
    itens.push({
      id_alerta: `cnh-${s.id_servidor}`,
      modulo: "FROTAS",
      tipo: "CNH_VENCENDO",
      // CNH vencida e critica: o condutor nao pode dirigir hoje.
      prioridade: vencida ? "CRITICA" : s.dias <= 7 ? "ALTA" : "MEDIA",
      titulo: vencida ? "CNH vencida" : "CNH vencendo",
      mensagem: vencida
        ? `A CNH de ${s.nome} (matricula ${s.matricula}) venceu ha ${Math.abs(s.dias)} dia(s).`
        : `A CNH de ${s.nome} (matricula ${s.matricula}) vence em ${s.dias} dia(s).`,
      entidade: "servidor",
      id_registro: s.id_servidor,
      status: "PENDENTE",
      data_criacao: new Date().toISOString(),
    });
  }

  // --- Documento de veiculo ---
  const doc = await query(
    `SELECT d.id_documento, d.tipo_documento, d.data_validade, v.placa,
            (d.data_validade - CURRENT_DATE) AS dias
       FROM documento_veiculo d
       JOIN veiculo v ON v.id_veiculo = d.id_veiculo
      WHERE d.status <> 'INATIVO'
        AND d.data_validade IS NOT NULL
        AND d.data_validade <= CURRENT_DATE + 30
      ORDER BY d.data_validade
      LIMIT 20`
  );

  for (const d of doc.rows) {
    const vencido = d.dias < 0;
    itens.push({
      id_alerta: `doc-${d.id_documento}`,
      modulo: "FROTAS",
      tipo: "DOCUMENTO_VENCENDO",
      prioridade: vencido ? "CRITICA" : d.dias <= 7 ? "ALTA" : "MEDIA",
      titulo: vencido ? "Documento vencido" : "Documento vencendo",
      mensagem: vencido
        ? `${d.tipo_documento} do veiculo ${d.placa} venceu ha ${Math.abs(d.dias)} dia(s).`
        : `${d.tipo_documento} do veiculo ${d.placa} vence em ${d.dias} dia(s).`,
      entidade: "documento_veiculo",
      id_registro: d.id_documento,
      status: "PENDENTE",
      data_criacao: new Date().toISOString(),
    });
  }

  const ordem = { CRITICA: 1, ALTA: 2, MEDIA: 3, BAIXA: 4 };
  return itens.sort((a, b) => ordem[a.prioridade] - ordem[b.prioridade]);
}

export default router;
