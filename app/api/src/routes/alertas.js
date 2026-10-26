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
 *
 * DE QUAL PAINEL E CADA AVISO (26/10)
 * -----------------------------------
 * Cada aviso traz `modulos`: os paineis em que ele aparece. O painel da
 * Fiscalizacao mostra so o que e dela (documento das viaturas, CNH e multa dos
 * fiscais, relatorio da Fiscalizacao para atestar, viatura sem devolucao,
 * equipamento faltando); o de Frotas mostra o que e de Frotas. O sininho
 * continua mostrando tudo. `link_fisc`, quando existe, e o destino do clique
 * dentro do painel da Fiscalizacao (a ficha da viatura em vez da tela de
 * documentos do Frotas).
 */
import { Router } from "express";
import { query } from "../db.js";
import { autenticar } from "../auth.js";

const router = Router();

router.get("/", autenticar, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id_alerta, modulo, tipo, prioridade, titulo, mensagem,
              entidade, id_registro, status, data_criacao
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
    // Os avisos gravados na tabela `alerta` nao traziam para onde ir: o clique
    // nao levava a lugar nenhum (26/10). Cada um ganha o link pelo registro
    // que aponta ou, sem registro, pela lista do tipo.
    const itens = [...calculados, ...rows.map((a) => ({
      ...a,
      link: a.link || linkDoAlerta(a),
      modulos: a.modulo === "FISCALIZACAO" ? ["FISCALIZACAO"] : ["FROTAS"],
    }))];

    res.json({ itens, naoLidos: itens.length });
  } catch (e) {
    next(e);
  }
});

/** Para onde leva um aviso gravado na tabela `alerta`. */
function linkDoAlerta(a) {
  const id = a.id_registro;
  const fisc = a.modulo === "FISCALIZACAO";
  if (id) {
    const porEntidade = {
      documento_veiculo: `/frotas/documentos/${id}`,
      ordem_servico: `${fisc ? "/fiscalizacao" : "/frotas"}/manutencoes/${id}`,
      veiculo: `/frotas/veiculos/${id}`,
      servidor: `/frotas/motoristas/${id}`,
      relatorio: `${fisc ? "/fiscalizacao" : "/frotas"}/relatorios/${id}`,
      inspecao: `/frotas/inspecoes/${id}`,
      sinistro: `/frotas/sinistros/${id}`,
      ocorrencia: `/fiscalizacao/ocorrencias/${id}`,
      checklist_frotas: `/frotas/checklists/${id}`,
      checklist_fiscalizacao: `/fiscalizacao/checklists/${id}`,
    }[a.entidade];
    if (porEntidade) return porEntidade;
  }
  const tipo = String(a.tipo || "").toUpperCase();
  if (tipo.startsWith("DOCUMENTO")) return `/frotas/documentos?status=${tipo.includes("VENCIDO") ? "VENCIDO" : "VENCENDO"}`;
  if (tipo.includes("CNH")) return "/frotas/motoristas";
  if (tipo.includes("MULTA")) return "/frotas/motoristas";
  if (tipo.includes("ATESTE")) return `${fisc ? "/fiscalizacao" : "/frotas"}/relatorios?status=MEU_ATESTE`;
  if (tipo.includes("INSPECAO")) return "/frotas/inspecoes";
  if (tipo.includes("SINISTRO")) return "/frotas/sinistros";
  // OS em aberto: a lista ja filtrada nas Pendentes (26/10).
  if (tipo.includes("OS") || tipo.includes("MANUTENCAO")) return `${fisc ? "/fiscalizacao" : "/frotas"}/manutencoes?status=PENDENTE`;
  if (fisc) return "/fiscalizacao/servico-diario";
  return "/dashboard";
}

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
      // Multa de fiscal tambem e assunto da Fiscalizacao.
      modulos: m.fiscal ? ["FROTAS", "FISCALIZACAO"] : ["FROTAS"],
      link_fisc: m.fiscal ? `/fiscalizacao/fiscais/${m.id_servidor}?aba=multas` : undefined,
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
        // Quem completa a OS e o Frotas: nao vai para o painel da Fiscalizacao.
        modulos: ["FROTAS"],
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
      modulos: [r.modulo === "FISCALIZACAO" ? "FISCALIZACAO" : "FROTAS"],
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
    `SELECT s.id_servidor, s.nome, s.matricula, s.cnh_data_validade, s.condutor,
            (unaccent_simples(COALESCE(c.nome, '')) = 'FISCAL DE TRANSITO') AS fiscal,
            (s.cnh_data_validade - CURRENT_DATE) AS dias
       FROM servidor s
       LEFT JOIN cargo c ON c.id_cargo = s.id_cargo
      WHERE s.status = TRUE
        AND s.condutor = TRUE
        AND s.cnh_data_validade IS NOT NULL
        AND s.cnh_data_validade <= CURRENT_DATE + 30
      ORDER BY s.cnh_data_validade
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
      // Para onde o clique leva: a FICHA da pessoa, na aba CNH (26/10). O
      // link antigo (lista pesquisada pelo nome) abria a lista inteira, porque
      // a tela de Motoristas nao le a pesquisa do endereco. Fiscal vai para a
      // ficha do fiscal, como na multa.
      link: `${s.fiscal && ve("FISCALIZACAO_VISUALIZAR") ? "/fiscalizacao/fiscais"
        : ve("FROTAS_VISUALIZAR") ? "/frotas/motoristas"
          : ve("ADMIN_VISUALIZAR") ? "/admin/servidores" : "/frotas/motoristas"}/${s.id_servidor}?aba=cnh`,
      // CNH de fiscal: tambem no painel da Fiscalizacao (so a dos fiscais).
      modulos: s.fiscal ? ["FROTAS", "FISCALIZACAO"] : ["FROTAS"],
      link_fisc: s.fiscal ? `/fiscalizacao/fiscais/${s.id_servidor}?aba=cnh` : undefined,
      status: "PENDENTE",
      data_criacao: new Date().toISOString(),
    });
  }

  // --- Documento de veiculo ---
  const doc = await query(
    `SELECT d.id_documento, d.tipo_documento, d.data_validade, v.placa, v.id_veiculo, v.viatura,
            (d.data_validade - CURRENT_DATE) AS dias
       FROM documento_veiculo d
       JOIN veiculo v ON v.id_veiculo = d.id_veiculo
      WHERE d.status <> 'INATIVO'
        AND d.data_validade IS NOT NULL
        AND d.data_validade <= CURRENT_DATE + 30
      ORDER BY d.data_validade
      LIMIT 20`
  );
  // Os 20 primeiros sao quase sempre de veiculos do Frotas; quem ve a
  // Fiscalizacao recebe tambem os 20 primeiros so de viaturas (26/10), para o
  // painel dela nao ficar sem os documentos das viaturas.
  if (ve("FISCALIZACAO_VISUALIZAR")) {
    const ja = new Set(doc.rows.map((d) => d.id_documento));
    const dasViaturas = await query(
      `SELECT d.id_documento, d.tipo_documento, d.data_validade, v.placa, v.id_veiculo, v.viatura,
              (d.data_validade - CURRENT_DATE) AS dias
         FROM documento_veiculo d
         JOIN veiculo v ON v.id_veiculo = d.id_veiculo AND v.viatura
        WHERE d.status <> 'INATIVO'
          AND d.data_validade IS NOT NULL
          AND d.data_validade <= CURRENT_DATE + 30
        ORDER BY d.data_validade
        LIMIT 20`
    );
    doc.rows.push(...dasViaturas.rows.filter((d) => !ja.has(d.id_documento)));
  }

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
      link: ve("FROTAS_VISUALIZAR") || !d.viatura
        ? `/frotas/documentos/${d.id_documento}`
        : `/fiscalizacao/viaturas/${d.id_veiculo}?aba=documentos`,
      // Documento de viatura tambem e assunto da Fiscalizacao; no painel dela
      // o clique abre a ficha da viatura, na aba Documentos.
      modulos: d.viatura ? ["FROTAS", "FISCALIZACAO"] : ["FROTAS"],
      link_fisc: d.viatura ? `/fiscalizacao/viaturas/${d.id_veiculo}?aba=documentos` : undefined,
      status: "PENDENTE",
      data_criacao: new Date().toISOString(),
    });
  }

  // --- So da Fiscalizacao (26/10) ---
  if (ve("FISCALIZACAO_VISUALIZAR")) {
    // Viatura que saiu num dia anterior e ainda nao teve a chegada registrada.
    const abertos = await query(
      `SELECT c.id_checklist, c.data_abertura, v.placa, eq.numero AS equipe,
              (CURRENT_DATE - c.data_abertura) AS dias
         FROM checklist_fiscalizacao c
         JOIN veiculo v ON v.id_veiculo = c.id_veiculo
         LEFT JOIN equipe eq ON eq.id_equipe = c.id_equipe
        WHERE c.status = 'ABERTO' AND c.data_abertura < CURRENT_DATE
        ORDER BY c.data_abertura
        LIMIT 20`
    );
    for (const c of abertos.rows) {
      itens.push({
        id_alerta: `viatura-aberta-${c.id_checklist}`,
        modulo: "FISCALIZACAO",
        tipo: "CHECKLIST_FISC_ABERTO",
        prioridade: c.dias > 1 ? "ALTA" : "MEDIA",
        titulo: "Viatura sem devolução",
        mensagem: `A viatura ${c.placa}${c.equipe ? ` (equipe ${c.equipe})` : ""} saiu há ${c.dias} dia(s) e a chegada não foi registrada.`,
        entidade: "checklist_fiscalizacao",
        id_registro: c.id_checklist,
        link: `/fiscalizacao/checklists/${c.id_checklist}`,
        modulos: ["FISCALIZACAO"],
        status: "PENDENTE",
        data_criacao: c.data_abertura,
      });
    }

    // Equipamento que voltou faltando na chegada dos checklists de viatura.
    const faltas = await query(
      `SELECT e.id_equipamento, e.nome,
              SUM(s.quantidade - ch.quantidade)::int AS faltando,
              MAX(c.data_abertura) AS ultima
         FROM checklist_fiscal_equipamento s
         JOIN checklist_fiscal_equipamento ch
           ON ch.id_checklist = s.id_checklist AND ch.id_equipamento = s.id_equipamento AND ch.etapa = 'CHEGADA'
         JOIN checklist_fiscalizacao c ON c.id_checklist = s.id_checklist AND c.status = 'FINALIZADO'
         JOIN equipamento e ON e.id_equipamento = s.id_equipamento
        WHERE s.etapa = 'SAIDA' AND ch.quantidade < s.quantidade AND e.status = TRUE
          -- So os ultimos 30 dias: a falta antiga ja foi tratada (ou nunca vai
          -- ser) e o aviso nao pode ficar no painel para sempre.
          AND c.data_abertura >= CURRENT_DATE - 30
        GROUP BY e.id_equipamento, e.nome
        ORDER BY faltando DESC
        LIMIT 20`
    );
    for (const f of faltas.rows) {
      itens.push({
        id_alerta: `equip-falta-${f.id_equipamento}`,
        modulo: "FISCALIZACAO",
        tipo: "EQUIPAMENTO_FALTANDO",
        prioridade: "MEDIA",
        titulo: "Equipamento faltando",
        mensagem: `${f.nome}: ${f.faltando} unidade(s) não voltaram nas chegadas das viaturas nos últimos 30 dias.`,
        entidade: "equipamento",
        id_registro: f.id_equipamento,
        link: `/fiscalizacao/equipamentos/${f.id_equipamento}`,
        modulos: ["FISCALIZACAO"],
        status: "PENDENTE",
        data_criacao: f.ultima,
      });
    }
  }

  const ordem = { CRITICA: 1, ALTA: 2, MEDIA: 3, BAIXA: 4 };
  // O que esta parado esperando a propria pessoa (atestar) vem primeiro.
  const primeiro = (i) => (i.tipo === "ATESTE_PENDENTE" ? 0 : 1);
  return itens.sort((a, b) => primeiro(a) - primeiro(b) || ordem[a.prioridade] - ordem[b.prioridade]);
}

export default router;
