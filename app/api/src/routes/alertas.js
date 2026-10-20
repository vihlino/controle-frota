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
    const calculados = await alertasCalculados(req.usuario.id_usuario, req.usuario?.permissoes || []);
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
async function alertasCalculados(idUsuario, permissoes = []) {
  const itens = [];

  // --- Multa vencendo (18/10) ---
  // Multa ainda em aberto (Pendente ou Em recurso) com vencimento nos
  // proximos 30 dias, ou ja vencida. O clique abre a aba Multas da ficha da
  // pessoa: Fiscais para quem e fiscal, Motoristas para condutor, Servidores
  // (Administracao) para o resto.
  const multas = await query(
    `SELECT m.id_multa, m.vencimento, m.valor, m.numero_auto, v.placa,
            s.id_servidor, s.nome, s.condutor,
            (unaccent_simples(COALESCE(c.nome, '')) = 'FISCAL DE TRANSITO') AS fiscal,
            (m.vencimento - CURRENT_DATE) AS dias
       FROM multa m
       JOIN servidor s ON s.id_servidor = m.id_servidor
       JOIN veiculo v  ON v.id_veiculo  = m.id_veiculo
       LEFT JOIN cargo c ON c.id_cargo = s.id_cargo
      WHERE m.status IN ('PENDENTE', 'EM_RECURSO')
        AND m.vencimento IS NOT NULL
        AND m.vencimento <= CURRENT_DATE + 30
      ORDER BY m.vencimento
      LIMIT 20`
  );
  const ve = (p) => permissoes.includes(p);
  for (const m of multas.rows) {
    const vencida = m.dias < 0;
    const base = m.fiscal && ve("FISCALIZACAO_VISUALIZAR") ? "/fiscalizacao/fiscais"
      : m.condutor && ve("FROTAS_VISUALIZAR") ? "/frotas/motoristas"
        : ve("ADMIN_VISUALIZAR") ? "/admin/servidores"
          : ve("FROTAS_VISUALIZAR") ? "/frotas/motoristas" : "/fiscalizacao/fiscais";
    const valor = m.valor !== null ? ` (R$ ${Number(m.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })})` : "";
    itens.push({
      id_alerta: `multa-${m.id_multa}`,
      modulo: "FROTAS",
      tipo: "MULTA_VENCENDO",
      prioridade: vencida ? "CRITICA" : m.dias <= 7 ? "ALTA" : "MEDIA",
      titulo: vencida ? "Multa vencida" : "Multa vencendo",
      mensagem: vencida
        ? `A multa de ${m.nome} no veículo ${m.placa}${valor} venceu há ${Math.abs(m.dias)} dia(s).`
        : m.dias === 0
          ? `A multa de ${m.nome} no veículo ${m.placa}${valor} vence hoje.`
          : `A multa de ${m.nome} no veículo ${m.placa}${valor} vence em ${m.dias} dia(s).`,
      entidade: "multa",
      id_registro: m.id_multa,
      link: `${base}/${m.id_servidor}?aba=multas`,
      status: "PENDENTE",
      data_criacao: new Date().toISOString(),
    });
  }

  // --- OS solicitada pela Fiscalizacao esperando o Frotas completar (18/10) ---
  if (permissoes.includes("FROTAS_GERENCIAR_OS")) {
    const pend = await query(
      `SELECT o.id_os, o.numero, o.data_abertura, v.placa
         FROM ordem_servico o JOIN veiculo v ON v.id_veiculo = o.id_veiculo
        WHERE o.status = 'PENDENTE'
        ORDER BY o.data_abertura LIMIT 20`
    );
    for (const o of pend.rows) {
      itens.push({
        id_alerta: `os-pendente-${o.id_os}`,
        modulo: "FROTAS",
        tipo: "OS_PENDENTE",
        prioridade: "ALTA",
        titulo: "OS solicitada",
        mensagem: `${o.numero || "Uma OS"} da viatura ${o.placa} foi solicitada pela Fiscalização e espera oficina, responsável e custo.`,
        entidade: "ordem_servico",
        id_registro: o.id_os,
        link: `/frotas/manutencoes/${o.id_os}`,
        status: "PENDENTE",
        data_criacao: o.data_abertura,
      });
    }
  }

  // --- Relatorio encaminhado para eu atestar (migracao 036) ---
  // Some sozinho quando a pessoa atesta: a linha deixa de ser PENDENTE.
  const atestes = await query(
    `SELECT r.id_relatorio, r.nome, r.modulo, a.data_solicitacao, s.nome AS gerado_por,
            to_char(r.periodo_inicio, 'DD/MM/YYYY') AS de,
            to_char(r.periodo_fim, 'DD/MM/YYYY') AS ate
       FROM atestacao a
       JOIN relatorio r ON r.id_relatorio = a.id_relatorio
       JOIN usuario u   ON u.id_usuario  = r.gerado_por
       JOIN servidor s  ON s.id_servidor = u.id_servidor
      WHERE a.id_usuario = $1 AND a.status = 'PENDENTE' AND r.status <> 'CANCELADO'
      ORDER BY a.data_solicitacao DESC
      LIMIT 20`,
    [idUsuario]
  );
  for (const r of atestes.rows) {
    itens.push({
      id_alerta: `ateste-${r.id_relatorio}`,
      modulo: "RELATORIOS",
      tipo: "ATESTE_PENDENTE",
      prioridade: "ALTA",
      titulo: "Relatório para atestar",
      mensagem: `${r.gerado_por} encaminhou o ${r.nome} (${r.de} a ${r.ate}) para você atestar.`,
      entidade: "relatorio",
      id_registro: r.id_relatorio,
      link: `/${r.modulo === "FISCALIZACAO" ? "fiscalizacao" : "frotas"}/relatorios/${r.id_relatorio}`,
      status: "PENDENTE",
      data_criacao: r.data_solicitacao,
    });
  }

  // --- CNH de condutor ---
  // condutor = TRUE porque o aviso existe para o gestor de FROTAS: a CNH
  // vencida de quem nao dirige nao impede nada, e so tiraria a atencao de
  // quem impede. A migracao 006 marcou como condutor todo mundo que ja tinha
  // CNH cadastrada, entao ninguem some daqui por causa deste filtro - so nao
  // entra quem foi marcado explicitamente como "nao e condutor".
  const cnh = await query(
    `SELECT id_servidor, nome, matricula, cnh_data_validade,
            (cnh_data_validade - CURRENT_DATE) AS dias
       FROM servidor
      WHERE status = TRUE
        AND condutor = TRUE
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
        ? `A CNH de ${s.nome} (matrícula ${s.matricula}) venceu há ${Math.abs(s.dias)} dia(s).`
        : `A CNH de ${s.nome} (matrícula ${s.matricula}) vence em ${s.dias} dia(s).`,
      entidade: "servidor",
      id_registro: s.id_servidor,
      // Para onde o clique leva: a lista de motoristas JA PESQUISADA pelo
      // nome. Sem isso o alerta dizia quem era, mas abria a lista inteira e a
      // pessoa tinha de procurar de novo o que o proprio alerta acabou de dizer.
      link: `/frotas/motoristas?busca=${encodeURIComponent(s.nome)}`,
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
        ? `${d.tipo_documento} do veículo ${d.placa} venceu há ${Math.abs(d.dias)} dia(s).`
        : `${d.tipo_documento} do veículo ${d.placa} vence em ${d.dias} dia(s).`,
      entidade: "documento_veiculo",
      id_registro: d.id_documento,
      // A lista de documentos pesquisada pela placa: aparecem os documentos
      // daquele veiculo, com o que vence destacado pela situacao.
      link: `/frotas/documentos/${d.id_documento}`,
      status: "PENDENTE",
      data_criacao: new Date().toISOString(),
    });
  }

  const ordem = { CRITICA: 1, ALTA: 2, MEDIA: 3, BAIXA: 4 };
  // O que esta parado esperando a propria pessoa (atestar) vem primeiro.
  const primeiro = (i) => (i.tipo === "ATESTE_PENDENTE" ? 0 : 1);
  return itens.sort((a, b) => primeiro(a) - primeiro(b) || ordem[a.prioridade] - ordem[b.prioridade]);
}

export default router;
