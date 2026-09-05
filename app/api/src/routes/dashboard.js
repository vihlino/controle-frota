/**
 * dashboard.js - Os numeros da tela inicial.
 *
 * Existe UM endpoint (/api/dashboard) que devolve os paineis que as permissoes
 * do usuario liberam. O Administrador recebe os tres (Frotas, Fiscalizacao e
 * TI); um gestor de frotas recebe so o de Frotas.
 *
 * Cada painel e montado por uma funcao propria abaixo. Elas usam Promise.all
 * para disparar todas as consultas ao mesmo tempo, em vez de uma esperar a
 * outra - o painel de Frotas faz 6 consultas e responde em cerca de 30ms.
 */
import { Router } from "express";
import { query } from "../db.js";
import { autenticar } from "../auth.js";

const router = Router();

async function painelFrotas() {
  const [frota, checklists, ultimos, emUso, vencimentos, os] = await Promise.all([
    query(`SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE status = 'DISPONIVEL')::int    AS disponiveis,
                  COUNT(*) FILTER (WHERE status = 'EM_USO')::int         AS em_operacao,
                  COUNT(*) FILTER (WHERE status = 'EM_MANUTENCAO')::int  AS em_manutencao,
                  COUNT(*) FILTER (WHERE status = 'INATIVO')::int        AS indisponiveis
             FROM veiculo`),
    query(`SELECT COUNT(*) FILTER (WHERE data_abertura = CURRENT_DATE)::int     AS hoje,
                  COUNT(*) FILTER (WHERE data_abertura = CURRENT_DATE - 1)::int AS ontem
             FROM checklist_frotas WHERE data_abertura >= CURRENT_DATE - 1`),
    query(`SELECT c.id_checklist, c.data_abertura, c.hora_saida, c.status, c.percurso,
                  (c.odometro_chegada - c.odometro_saida) AS km_rodado,
                  s.nome AS condutor, v.placa, v.marca, v.modelo
             FROM checklist_frotas c
             JOIN servidor s ON s.id_servidor = c.id_servidor
             JOIN veiculo  v ON v.id_veiculo  = c.id_veiculo
            ORDER BY c.data_abertura DESC, c.hora_saida DESC LIMIT 5`),
    query(`SELECT c.id_checklist, c.hora_saida, c.status, s.nome AS motorista,
                  v.placa, v.marca, v.modelo
             FROM checklist_frotas c
             JOIN servidor s ON s.id_servidor = c.id_servidor
             JOIN veiculo  v ON v.id_veiculo  = c.id_veiculo
            WHERE c.data_abertura = CURRENT_DATE
            ORDER BY c.hora_saida DESC LIMIT 5`),
    query(`SELECT faixa, tipo_documento, COUNT(*)::int AS quantidade
             FROM (SELECT tipo_documento,
                          CASE WHEN data_validade <= CURRENT_DATE + 30 THEN 30
                               WHEN data_validade <= CURRENT_DATE + 90 THEN 90
                               ELSE 120 END AS faixa
                     FROM documento_veiculo
                    WHERE status <> 'INATIVO' AND data_validade IS NOT NULL
                      AND data_validade BETWEEN CURRENT_DATE AND CURRENT_DATE + 120) d
            GROUP BY faixa, tipo_documento ORDER BY faixa, quantidade DESC`),
    query(`SELECT status, COUNT(*)::int AS quantidade FROM ordem_servico
            WHERE status NOT IN ('RESOLVIDA', 'CANCELADA') GROUP BY status`),
  ]);

  const f = frota.rows[0];
  const pct = (n) => (f.total ? Number(((n / f.total) * 100).toFixed(1)) : 0);
  const faixa = (limite) => {
    const linhas = vencimentos.rows.filter((r) => r.faixa <= limite);
    const porTipo = {};
    for (const l of linhas) porTipo[l.tipo_documento] = (porTipo[l.tipo_documento] || 0) + l.quantidade;
    return {
      dias: limite,
      total: linhas.reduce((s, l) => s + l.quantidade, 0),
      porTipo: Object.entries(porTipo)
        .map(([tipo, quantidade]) => ({ tipo, quantidade }))
        .sort((a, b) => b.quantidade - a.quantidade),
    };
  };

  return {
    kpis: {
      total: f.total,
      disponiveis: { valor: f.disponiveis, percentual: pct(f.disponiveis) },
      emOperacao: { valor: f.em_operacao, percentual: pct(f.em_operacao) },
      emManutencao: { valor: f.em_manutencao, percentual: pct(f.em_manutencao) },
      indisponiveis: { valor: f.indisponiveis, percentual: pct(f.indisponiveis) },
      checklistsHoje: { valor: checklists.rows[0].hoje, ontem: checklists.rows[0].ontem },
    },
    ultimosChecklists: ultimos.rows,
    veiculosEmUso: emUso.rows,
    vencimentos: [faixa(120), faixa(90), faixa(30)],
    ordensServico: os.rows,
  };
}

async function painelFiscalizacao() {
  const [servico, ocorrencias, equipes, checklists, ultimasOcorrencias, servicosHoje, viaturas] = await Promise.all([
    query(`SELECT COUNT(*) FILTER (WHERE status = 'EM_ANDAMENTO')::int AS em_andamento,
                  COUNT(*)::int AS hoje
             FROM servico_diario WHERE data = CURRENT_DATE`),
    query(`SELECT COUNT(*) FILTER (WHERE data = CURRENT_DATE)::int     AS hoje,
                  COUNT(*) FILTER (WHERE data = CURRENT_DATE - 1)::int AS ontem,
                  COUNT(*) FILTER (WHERE data = CURRENT_DATE
                                     AND status NOT IN ('FINALIZADA'))::int AS em_andamento
             FROM ocorrencia WHERE data >= CURRENT_DATE - 1`),
    query(`SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE status = TRUE)::int AS ativas FROM equipe`),
    query(`SELECT COUNT(*) FILTER (WHERE data_abertura = CURRENT_DATE)::int AS hoje
             FROM checklist_fiscalizacao`),
    query(`SELECT o.id_ocorrencia, o.protocolo, o.tipo, o.endereco, o.hora, o.status
             FROM ocorrencia o WHERE o.data = CURRENT_DATE
            ORDER BY o.hora DESC LIMIT 5`),
    query(`SELECT sd.id_servico_diario, sd.turno, sd.hora_inicio, sd.status,
                  s.nome AS coordenador,
                  (SELECT COUNT(*)::int FROM servico_equipe se
                    WHERE se.id_servico_diario = sd.id_servico_diario) AS n_equipes
             FROM servico_diario sd
             JOIN servidor s ON s.id_servidor = sd.id_coordenador
            WHERE sd.data = CURRENT_DATE
            ORDER BY sd.hora_inicio LIMIT 6`),
    query(`SELECT COUNT(*) FILTER (WHERE status = 'EM_USO')::int AS em_uso,
                  COUNT(*)::int AS total
             FROM veiculo`),
  ]);

  return {
    kpis: {
      equipesEmServico: equipes.rows[0].ativas,
      viaturasEmUso: viaturas.rows[0].em_uso,
      equipes: equipes.rows[0],
      ocorrenciasHoje: ocorrencias.rows[0],
      checklistsHoje: checklists.rows[0].hoje,
    },
    ultimasOcorrencias: ultimasOcorrencias.rows,
    servicosHoje: servicosHoje.rows,
  };
}

async function painelTi() {
  const [usuarios, servidores, setores, acessos, modulos] = await Promise.all([
    query(`SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE status = TRUE)::int AS ativos FROM usuario`),
    query(`SELECT COUNT(*)::int AS total FROM servidor`),
    query(`SELECT COUNT(*)::int AS total FROM setor WHERE status = TRUE`),
    query(`SELECT COUNT(*) FILTER (WHERE data_hora::date = CURRENT_DATE)::int AS hoje,
                  COUNT(*) FILTER (WHERE data_hora::date = CURRENT_DATE
                                     AND sucesso = FALSE)::int AS falhas_hoje
             FROM log_acesso WHERE data_hora >= CURRENT_DATE`),
    query(`SELECT 'Frotas' AS modulo, COUNT(*)::int AS registros FROM veiculo
            UNION ALL SELECT 'Fiscalizacao', COUNT(*)::int FROM ocorrencia
            UNION ALL SELECT 'Relatorios', COUNT(*)::int FROM relatorio
            UNION ALL SELECT 'Auditoria', COUNT(*)::int FROM auditoria`),
  ]);

  const recentes = await query(
    `SELECT l.data_hora, l.tipo_evento, l.sucesso, l.endereco_ip::text AS ip,
            COALESCE(s.nome, l.login_informado) AS usuario, p.nome AS perfil
       FROM log_acesso l
       LEFT JOIN usuario u  ON u.id_usuario  = l.id_usuario
       LEFT JOIN servidor s ON s.id_servidor = u.id_servidor
       LEFT JOIN perfil p   ON p.id_perfil   = u.id_perfil
      ORDER BY l.data_hora DESC LIMIT 5`
  );

  return {
    kpis: {
      usuarios: usuarios.rows[0],
      servidores: servidores.rows[0].total,
      setores: setores.rows[0].total,
      acessos: acessos.rows[0],
    },
    modulos: modulos.rows,
    acessosRecentes: recentes.rows,
  };
}

// Um endpoint so: devolve os paineis que as permissoes do usuario liberam.
// O Administrador recebe os tres.
router.get("/", autenticar, async (req, res, next) => {
  try {
    const permissoes = req.usuario.permissoes || [];
    const painel = {};

    if (permissoes.includes("FROTAS_VISUALIZAR")) painel.frotas = await painelFrotas();
    if (permissoes.includes("FISCALIZACAO_VISUALIZAR")) painel.fiscalizacao = await painelFiscalizacao();
    if (permissoes.includes("ADMIN_VISUALIZAR")) painel.ti = await painelTi();

    res.json(painel);
  } catch (e) {
    next(e);
  }
});

export default router;
