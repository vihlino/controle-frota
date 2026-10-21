/**
 * relatorios.js - Os modelos de relatorio.
 *
 * Cada tipo de relatorio e um modelo fixo: as colunas que ele mostra e a
 * consulta que as alimenta. O usuario escolhe apenas periodo e tipo - nada de
 * montar colunas ou filtros na mao, como foi decidido para o SITRA.
 *
 * Toda consulta recebe exatamente dois parametros: $1 = inicio, $2 = fim.
 *
 * PARA ACRESCENTAR UM TIPO NOVO: adicione uma entrada em MODELOS com nome,
 * descricao, modulo, colunas e sql. A tela de geracao passa a oferecer o novo
 * tipo automaticamente, sem mexer no front.
 *
 * O campo "tipo" de cada coluna diz ao front como formatar o valor: data, hora,
 * numero, dinheiro ou sim_nao.
 *
 * FROTAS x FISCALIZACAO (18/10): cada modulo tem os seus tipos e os seus
 * dados. Os de FROTAS veem todos os veiculos, viaturas inclusive, em
 * Manutencoes, Inspecoes, Documentos, Sinistros e Indicadores (pedido do
 * Cesar, 21/10: o Frotas cuida de toda a frota); os de checklist e de entrada
 * e saida sao do checklist da frota, onde viatura nao entra. Os da
 * FISCALIZACAO trazem so viaturas, ocorrencias, servicos e pontuacao. Quem
 * tem os dois modulos escolhe na tela de qual quer o relatorio.
 */
import crypto from "node:crypto";

// Cada tipo de relatorio tem um modelo fixo: colunas definidas e a consulta que
// as alimenta. O usuario so escolhe periodo e tipo - nada de montar colunas na mao.
export const MODELOS = {
  ENTRADA_SAIDA: {
    nome: "Controle de Entrada e Saída de Veículos",
    descricao: "Registro de entradas, saídas e quilometragem.",
    modulo: "FROTAS",
    colunas: [
      { chave: "data", rotulo: "Data", tipo: "data" },
      { chave: "percurso", rotulo: "Percurso" },
      { chave: "condutor", rotulo: "Condutor" },
      { chave: "veiculo", rotulo: "Veículo" },
      { chave: "placa", rotulo: "Placa" },
      { chave: "hora_saida", rotulo: "Hora saida", tipo: "hora" },
      { chave: "odometro_saida", rotulo: "KM saida", tipo: "numero" },
      { chave: "hora_chegada", rotulo: "Hora chegada", tipo: "hora" },
      { chave: "odometro_chegada", rotulo: "KM chegada", tipo: "numero" },
      { chave: "km_rodado", rotulo: "KM rodado", tipo: "numero" },
      { chave: "macaco", rotulo: "Macaco" },
      { chave: "chave_roda", rotulo: "Chave de roda" },
      { chave: "estepe", rotulo: "Estepe" },
      { chave: "triangulo", rotulo: "Triângulo" },
    ],
    sql: `
      SELECT c.data_abertura AS data, c.percurso, s.nome AS condutor,
             (v.marca || ' ' || v.modelo) AS veiculo, v.placa,
             c.hora_saida, c.odometro_saida, c.hora_chegada, c.odometro_chegada,
             (c.odometro_chegada - c.odometro_saida) AS km_rodado,
             eq.macaco, eq.chave_roda, eq.estepe, eq.triangulo
        FROM checklist_frotas c
        JOIN servidor s ON s.id_servidor = c.id_servidor
        JOIN veiculo  v ON v.id_veiculo  = c.id_veiculo AND NOT v.viatura
        LEFT JOIN LATERAL (
          SELECT
            MAX(CASE WHEN e.equipamento ILIKE 'macaco%' THEN CASE WHEN e.conforme THEN 'Sim' ELSE 'Nao' END END) AS macaco,
            MAX(CASE WHEN e.equipamento ILIKE 'chave%' THEN CASE WHEN e.conforme THEN 'Sim' ELSE 'Nao' END END) AS chave_roda,
            MAX(CASE WHEN e.equipamento ILIKE 'estepe%' THEN CASE WHEN e.conforme THEN 'Sim' ELSE 'Nao' END END) AS estepe,
            MAX(CASE WHEN e.equipamento ILIKE 'triangulo%' THEN CASE WHEN e.conforme THEN 'Sim' ELSE 'Nao' END END) AS triangulo
          FROM checklist_frotas_equipamento e
          WHERE e.id_checklist = c.id_checklist
        ) eq ON TRUE
       WHERE c.data_abertura BETWEEN $1 AND $2
       ORDER BY c.data_abertura, c.hora_saida`,
  },

  MANUTENCOES: {
    nome: "Relatório de Manutenções",
    descricao: "Manutenções realizadas no período.",
    modulo: "FROTAS",
    colunas: [
      { chave: "data", rotulo: "Data", tipo: "data" },
      { chave: "veiculo", rotulo: "Veículo" },
      { chave: "placa", rotulo: "Placa" },
      { chave: "tipo", rotulo: "Tipo" },
      { chave: "descricao", rotulo: "Descrição do serviço" },
      { chave: "oficina", rotulo: "Oficina / Fornecedor" },
      { chave: "quilometragem", rotulo: "KM do veículo", tipo: "numero" },
      { chave: "custo", rotulo: "Custo", tipo: "dinheiro" },
      { chave: "responsavel", rotulo: "Responsável" },
      { chave: "proxima_manutencao", rotulo: "Próxima manutenção", tipo: "data" },
      { chave: "observacoes", rotulo: "Observações" },
    ],
    sql: `
      SELECT os.data_abertura::date AS data,
             (v.marca || ' ' || v.modelo) AS veiculo, v.placa,
             os.tipo, COALESCE(os.descricao, os.servico_realizado) AS descricao,
             os.oficina, os.quilometragem, os.custo,
             COALESCE(r.nome, sol.nome, cond.nome) AS responsavel,
             os.proxima_manutencao, os.observacoes
        FROM ordem_servico os
        JOIN veiculo v ON v.id_veiculo = os.id_veiculo
        LEFT JOIN usuario  u_sol ON u_sol.id_usuario = os.id_solicitante
        LEFT JOIN servidor sol ON sol.id_servidor = u_sol.id_servidor
        LEFT JOIN servidor cond ON cond.id_servidor = os.id_servidor_solicitante
        LEFT JOIN usuario  u_r ON u_r.id_usuario = os.id_responsavel
        LEFT JOIN servidor r ON r.id_servidor = u_r.id_servidor
       WHERE os.data_abertura::date BETWEEN $1 AND $2
       ORDER BY os.data_abertura`,
  },
  CHECKLISTS: {
    nome: "Relatório de Checklists",
    descricao: "Checklists realizados por motoristas.",
    modulo: "FROTAS",
    colunas: [
      { chave: "data", rotulo: "Data", tipo: "data" },
      { chave: "placa", rotulo: "Placa" },
      { chave: "condutor", rotulo: "Condutor" },
      { chave: "percurso", rotulo: "Percurso" },
      { chave: "hora_saida", rotulo: "Saida", tipo: "hora" },
      { chave: "hora_chegada", rotulo: "Chegada", tipo: "hora" },
      { chave: "km_rodado", rotulo: "KM rodado", tipo: "numero" },
      { chave: "situacao", rotulo: "Situação" },
    ],
    sql: `
      SELECT c.data_abertura AS data, v.placa, s.nome AS condutor, c.percurso,
             c.hora_saida, c.hora_chegada,
             (c.odometro_chegada - c.odometro_saida) AS km_rodado,
             c.status AS situacao
        FROM checklist_frotas c
        JOIN servidor s ON s.id_servidor = c.id_servidor
        JOIN veiculo  v ON v.id_veiculo  = c.id_veiculo AND NOT v.viatura
       WHERE c.data_abertura BETWEEN $1 AND $2
       ORDER BY c.data_abertura, c.hora_saida`,
  },

  INSPECOES: {
    nome: "Relatório de Inspeções",
    descricao: "Inspeções veiculares e conformidades.",
    modulo: "FROTAS",
    colunas: [
      { chave: "numero", rotulo: "No da inspeção" },
      { chave: "data", rotulo: "Data", tipo: "data" },
      { chave: "placa", rotulo: "Placa" },
      { chave: "veiculo", rotulo: "Veículo" },
      { chave: "tipo", rotulo: "Frequência" },
      { chave: "responsavel", rotulo: "Responsável" },
      { chave: "situacao", rotulo: "Situação" },
      { chave: "resultado", rotulo: "Resultado" },
      { chave: "ressalvas", rotulo: "Itens com ressalva", tipo: "numero" },
      { chave: "proxima_inspecao", rotulo: "Próxima inspeção", tipo: "data" },
    ],
    sql: `
      SELECT i.numero, i.data_realizacao AS data, v.placa,
             (v.marca || ' ' || v.modelo) AS veiculo, i.tipo, s.nome AS responsavel,
             i.status AS situacao, i.resultado,
             (SELECT COUNT(*)::int FROM inspecao_item it
               WHERE it.id_inspecao = i.id_inspecao AND it.resultado <> 'NORMAL') AS ressalvas,
             i.proxima_inspecao
        FROM inspecao i
        JOIN veiculo  v ON v.id_veiculo  = i.id_veiculo
        JOIN usuario  u_g ON u_g.id_usuario = i.id_gestor
        JOIN servidor s ON s.id_servidor = u_g.id_servidor
       WHERE i.data_realizacao BETWEEN $1 AND $2
       ORDER BY i.data_realizacao`,
  },

  SINISTROS: {
    nome: "Relatório de Sinistros",
    descricao: "Ocorrências, sinistros e acompanhamentos.",
    modulo: "FROTAS",
    colunas: [
      { chave: "numero", rotulo: "No do sinistro" },
      { chave: "data", rotulo: "Data", tipo: "data" },
      { chave: "hora", rotulo: "Hora", tipo: "hora" },
      { chave: "placa", rotulo: "Placa" },
      { chave: "veiculo", rotulo: "Veículo" },
      { chave: "tipo", rotulo: "Tipo" },
      { chave: "local", rotulo: "Local" },
      { chave: "condutor", rotulo: "Condutor" },
      { chave: "houve_terceiros", rotulo: "Terceiros", tipo: "sim_nao" },
      { chave: "situacao", rotulo: "Situação" },
      { chave: "bo", rotulo: "B.O." },
    ],
    sql: `
      SELECT si.numero, si.data, si.hora, v.placa,
             (v.marca || ' ' || v.modelo) AS veiculo, si.tipo, si.local,
             c.nome AS condutor, si.houve_terceiros, si.status AS situacao, si.bo
        FROM sinistro si
        JOIN veiculo  v ON v.id_veiculo  = si.id_veiculo
        JOIN servidor c ON c.id_servidor = si.id_servidor
       WHERE si.data BETWEEN $1 AND $2
       ORDER BY si.data`,
  },

  DOCUMENTOS: {
    nome: "Relatório de Documentos",
    descricao: "Documentos da frota e vencimentos.",
    modulo: "FROTAS",
    colunas: [
      { chave: "documento", rotulo: "Documento" },
      { chave: "categoria", rotulo: "Categoria" },
      { chave: "placa", rotulo: "Placa" },
      { chave: "veiculo", rotulo: "Veículo" },
      { chave: "numero_documento", rotulo: "No / Referência" },
      { chave: "data_emissao", rotulo: "Emissão", tipo: "data" },
      { chave: "data_validade", rotulo: "Vencimento", tipo: "data" },
      { chave: "situacao", rotulo: "Situação" },
      { chave: "responsavel", rotulo: "Responsável" },
    ],
    sql: `
      SELECT d.tipo_documento AS documento, d.categoria, v.placa,
             (v.marca || ' ' || v.modelo) AS veiculo, d.numero_documento,
             d.data_emissao, d.data_validade, d.status AS situacao,
             s.nome AS responsavel
        FROM documento_veiculo d
        JOIN veiculo v ON v.id_veiculo = d.id_veiculo
        LEFT JOIN servidor s ON s.id_servidor = d.id_responsavel
       WHERE COALESCE(d.data_validade, d.data_emissao) BETWEEN $1 AND $2
         AND d.substituido_em IS NULL -- versoes antigas ficam so no historico
       ORDER BY d.data_validade NULLS LAST`,
  },

  INDICADORES: {
    nome: "Relatório de Indicadores",
    descricao: "Indicadores de desempenho da frota.",
    modulo: "FROTAS",
    colunas: [
      { chave: "indicador", rotulo: "Indicador" },
      { chave: "valor", rotulo: "Valor" },
    ],
    sql: `
      SELECT 'Veiculos cadastrados' AS indicador, COUNT(*)::text AS valor FROM veiculo
      UNION ALL SELECT 'Checklists no periodo',
        (SELECT COUNT(*)::text FROM checklist_frotas c JOIN veiculo v ON v.id_veiculo = c.id_veiculo AND NOT v.viatura
          WHERE c.data_abertura BETWEEN $1 AND $2)
      UNION ALL SELECT 'KM rodados no periodo',
        (SELECT COALESCE(SUM(c.odometro_chegada - c.odometro_saida), 0)::text
           FROM checklist_frotas c JOIN veiculo v ON v.id_veiculo = c.id_veiculo AND NOT v.viatura
          WHERE c.data_abertura BETWEEN $1 AND $2 AND c.odometro_chegada IS NOT NULL)
      UNION ALL SELECT 'Ordens de servico abertas no periodo',
        (SELECT COUNT(*)::text FROM ordem_servico o JOIN veiculo v ON v.id_veiculo = o.id_veiculo
          WHERE o.data_abertura::date BETWEEN $1 AND $2)
      UNION ALL SELECT 'Custo total de manutencao (R$)',
        (SELECT COALESCE(SUM(o.custo), 0)::text FROM ordem_servico o JOIN veiculo v ON v.id_veiculo = o.id_veiculo
          WHERE o.data_abertura::date BETWEEN $1 AND $2)
      UNION ALL SELECT 'Inspecoes realizadas no periodo',
        (SELECT COUNT(*)::text FROM inspecao i JOIN veiculo v ON v.id_veiculo = i.id_veiculo
          WHERE i.data_realizacao BETWEEN $1 AND $2)
      UNION ALL SELECT 'Sinistros no periodo',
        (SELECT COUNT(*)::text FROM sinistro x JOIN veiculo v ON v.id_veiculo = x.id_veiculo
          WHERE x.data BETWEEN $1 AND $2)
      UNION ALL SELECT 'Documentos vencidos',
        (SELECT COUNT(*)::text FROM documento_veiculo d JOIN veiculo v ON v.id_veiculo = d.id_veiculo
          WHERE d.data_validade < CURRENT_DATE AND d.status <> 'INATIVO' AND d.substituido_em IS NULL)`,
  },

  // ======================= FISCALIZACAO (18/10) =======================
  FISC_CHECKLISTS: {
    nome: "Relatório de Checklists das Viaturas",
    descricao: "Checklists de viatura finalizados no período, com a equipe e os fiscais.",
    modulo: "FISCALIZACAO",
    colunas: [
      { chave: "data", rotulo: "Data", tipo: "data" },
      { chave: "placa", rotulo: "Viatura" },
      { chave: "veiculo", rotulo: "Modelo" },
      { chave: "equipe", rotulo: "Equipe" },
      { chave: "fiscal_1", rotulo: "Fiscal 1" },
      { chave: "fiscal_2", rotulo: "Fiscal 2" },
      { chave: "hora_saida", rotulo: "Saída", tipo: "hora" },
      { chave: "hora_chegada", rotulo: "Chegada", tipo: "hora" },
      { chave: "km_rodado", rotulo: "KM rodado", tipo: "numero" },
      { chave: "observacoes", rotulo: "Observações" },
    ],
    sql: `
      SELECT c.data_abertura AS data, v.placa, (v.marca || ' ' || v.modelo) AS veiculo,
             eq.numero AS equipe,
             (SELECT s.nome FROM checklist_fiscal_servidor cs JOIN servidor s ON s.id_servidor = cs.id_servidor
               WHERE cs.id_checklist = c.id_checklist AND cs.tipo = 'FISCAL_1' LIMIT 1) AS fiscal_1,
             (SELECT s.nome FROM checklist_fiscal_servidor cs JOIN servidor s ON s.id_servidor = cs.id_servidor
               WHERE cs.id_checklist = c.id_checklist AND cs.tipo = 'FISCAL_2' LIMIT 1) AS fiscal_2,
             c.hora_saida, c.hora_chegada,
             (c.odometro_chegada - c.odometro_saida) AS km_rodado, c.observacoes
        FROM checklist_fiscalizacao c
        JOIN veiculo v ON v.id_veiculo = c.id_veiculo
        LEFT JOIN equipe eq ON eq.id_equipe = c.id_equipe
       WHERE c.status = 'FINALIZADO' AND c.data_abertura BETWEEN $1 AND $2
       ORDER BY c.data_abertura, c.hora_saida`,
  },

  FISC_OCORRENCIAS: {
    nome: "Relatório de Ocorrências",
    descricao: "Ocorrências do período (QRU e programadas), com equipe, viatura e situação.",
    modulo: "FISCALIZACAO",
    colunas: [
      { chave: "protocolo", rotulo: "Nº da ocorrência" },
      { chave: "data", rotulo: "Data", tipo: "data" },
      { chave: "hora", rotulo: "Hora", tipo: "hora" },
      { chave: "tipo", rotulo: "Tipo" },
      { chave: "local", rotulo: "Local" },
      { chave: "equipe", rotulo: "Equipe" },
      { chave: "viatura", rotulo: "Viatura" },
      { chave: "situacao", rotulo: "Situação" },
      { chave: "atendimento", rotulo: "Atendimento" },
    ],
    sql: `
      SELECT o.protocolo, o.data, o.hora,
             CASE o.tipo WHEN 'QRU' THEN 'QRU' WHEN 'PROGRAMADA' THEN 'Programada' ELSE o.tipo END AS tipo,
             o.endereco AS local, d.equipe, d.viatura,
             CASE o.status WHEN 'PENDENTE' THEN 'Pendente' WHEN 'ATRIBUIDA' THEN 'Atribuída'
                  WHEN 'EM_ANDAMENTO' THEN 'Em andamento' WHEN 'FINALIZADA' THEN 'Finalizada'
                  WHEN 'INTERCORRENCIA' THEN 'Intercorrência' ELSE o.status END AS situacao,
             o.descricao_atendimento AS atendimento
        FROM ocorrencia o
        LEFT JOIN LATERAL (
          SELECT eq.numero AS equipe, v.placa AS viatura
            FROM distribuicao_ocorrencia di
            LEFT JOIN equipe eq ON eq.id_equipe = di.id_equipe
            LEFT JOIN veiculo v ON v.id_veiculo = di.id_veiculo
           WHERE di.id_ocorrencia = o.id_ocorrencia
           ORDER BY di.data DESC, di.hora DESC LIMIT 1
        ) d ON TRUE
       WHERE o.data BETWEEN $1 AND $2
       ORDER BY o.data, o.hora`,
  },

  FISC_SERVICOS: {
    nome: "Relatório de Serviços Diários",
    descricao: "Serviços diários do período: turno, coordenador, equipes e ocorrências.",
    modulo: "FISCALIZACAO",
    colunas: [
      { chave: "data", rotulo: "Data", tipo: "data" },
      { chave: "turno", rotulo: "Turno" },
      { chave: "coordenador", rotulo: "Coordenador" },
      { chave: "hora_inicio", rotulo: "Início", tipo: "hora" },
      { chave: "hora_encerramento", rotulo: "Encerramento", tipo: "hora" },
      { chave: "equipes", rotulo: "Equipes (código do serviço)" },
      { chave: "ocorrencias", rotulo: "Ocorrências", tipo: "numero" },
      { chave: "situacao", rotulo: "Situação" },
    ],
    sql: `
      SELECT sd.data,
             CASE sd.turno WHEN 'DIURNO' THEN 'Diurno' WHEN 'NOTURNO' THEN 'Noturno' ELSE sd.turno END AS turno,
             c.nome AS coordenador, sd.hora_inicio, sd.hora_encerramento,
             (SELECT string_agg(eq.numero || COALESCE(' (' || se.numero || ')', ''), ', ' ORDER BY eq.numero) FROM servico_equipe se
                JOIN equipe eq ON eq.id_equipe = se.id_equipe
               WHERE se.id_servico_diario = sd.id_servico_diario) AS equipes,
             (SELECT COUNT(*)::int FROM ocorrencia o WHERE o.id_servico_diario = sd.id_servico_diario) AS ocorrencias,
             CASE sd.status WHEN 'ABERTO' THEN 'Aberto' WHEN 'EM_SERVICO' THEN 'Em serviço'
                  WHEN 'ENCERRADO' THEN 'Encerrado' ELSE sd.status END AS situacao
        FROM servico_diario sd
        LEFT JOIN servidor c ON c.id_servidor = sd.id_coordenador
       WHERE sd.data BETWEEN $1 AND $2
       ORDER BY sd.data, sd.turno`,
  },

  FISC_PONTUACAO: {
    nome: "Relatório de Pontuação",
    descricao: "Pontos lançados no período, por equipe e por fiscal.",
    modulo: "FISCALIZACAO",
    colunas: [
      { chave: "data", rotulo: "Data", tipo: "data" },
      { chave: "codigo", rotulo: "Código" },
      { chave: "item", rotulo: "Item" },
      { chave: "equipe", rotulo: "Equipe" },
      { chave: "fiscal", rotulo: "Fiscal" },
      { chave: "quantidade", rotulo: "Quantidade", tipo: "numero" },
      { chave: "pontos", rotulo: "Pontos", tipo: "numero" },
      { chave: "observacao", rotulo: "Observação" },
    ],
    sql: `
      SELECT r.data_registro::date AS data, i.codigo, i.nome AS item, eq.numero AS equipe,
             s.nome AS fiscal, r.quantidade, r.pontos_aplicados AS pontos, r.observacao
        FROM pontuacao_registro r
        JOIN pontuacao_item i ON i.id_item = r.id_item
        LEFT JOIN equipe eq ON eq.id_equipe = r.id_equipe
        LEFT JOIN servidor s ON s.id_servidor = r.id_servidor
       WHERE r.data_registro::date BETWEEN $1 AND $2
       ORDER BY r.data_registro`,
  },

  FISC_VIATURAS: {
    nome: "Relatório de Uso das Viaturas",
    descricao: "Saídas e quilômetros rodados por viatura no período.",
    modulo: "FISCALIZACAO",
    colunas: [
      { chave: "placa", rotulo: "Viatura" },
      { chave: "veiculo", rotulo: "Modelo" },
      { chave: "saidas", rotulo: "Saídas", tipo: "numero" },
      { chave: "km_rodado", rotulo: "KM rodado", tipo: "numero" },
      { chave: "equipes", rotulo: "Equipes que usaram" },
      { chave: "primeira", rotulo: "Primeira saída", tipo: "data" },
      { chave: "ultima", rotulo: "Última saída", tipo: "data" },
      { chave: "situacao", rotulo: "Situação atual" },
    ],
    sql: `
      SELECT v.placa, (v.marca || ' ' || v.modelo) AS veiculo,
             COUNT(c.id_checklist)::int AS saidas,
             COALESCE(SUM(GREATEST(c.odometro_chegada - c.odometro_saida, 0)), 0)::int AS km_rodado,
             string_agg(DISTINCT eq.numero, ', ') AS equipes,
             MIN(c.data_abertura) AS primeira, MAX(c.data_abertura) AS ultima,
             CASE v.status WHEN 'DISPONIVEL' THEN 'Disponível' WHEN 'EM_USO' THEN 'Em uso'
                  WHEN 'EM_MANUTENCAO' THEN 'Em manutenção' WHEN 'INATIVO' THEN 'Indisponível' ELSE v.status END AS situacao
        FROM veiculo v
        LEFT JOIN checklist_fiscalizacao c ON c.id_veiculo = v.id_veiculo AND c.data_abertura BETWEEN $1 AND $2
        LEFT JOIN equipe eq ON eq.id_equipe = c.id_equipe
       WHERE v.viatura
       GROUP BY v.id_veiculo
       ORDER BY saidas DESC, v.placa`,
  },

  FISC_MANUTENCOES: {
    nome: "Relatório de Manutenções das Viaturas",
    descricao: "OS das viaturas abertas no período, com a situação de cada uma.",
    modulo: "FISCALIZACAO",
    colunas: [
      { chave: "numero", rotulo: "Nº da OS" },
      { chave: "data", rotulo: "Abertura", tipo: "data" },
      { chave: "data_ocorrido", rotulo: "Ocorrido em", tipo: "data" },
      { chave: "placa", rotulo: "Viatura" },
      { chave: "tipo", rotulo: "Tipo" },
      { chave: "descricao", rotulo: "Serviço" },
      { chave: "responsavel", rotulo: "Responsável pela OS" },
      { chave: "oficina", rotulo: "Oficina" },
      { chave: "custo", rotulo: "Custo", tipo: "dinheiro" },
      { chave: "situacao", rotulo: "Situação" },
    ],
    sql: `
      SELECT os.numero, os.data_abertura::date AS data, os.data_ocorrido, v.placa,
             CASE os.tipo WHEN 'PREVENTIVA' THEN 'Preventiva' WHEN 'CORRETIVA' THEN 'Corretiva' ELSE os.tipo END AS tipo,
             COALESCE(os.descricao, os.servico_realizado) AS descricao,
             COALESCE(sol.nome, cond.nome) AS responsavel, os.oficina, COALESCE(os.custo, os.custo_estimado) AS custo,
             CASE os.status WHEN 'PENDENTE' THEN 'Pendente (solicitada)' WHEN 'EM_ANALISE' THEN 'Em análise'
                  WHEN 'EM_MANUTENCAO' THEN 'Em manutenção' WHEN 'RESOLVIDA' THEN 'Resolvida'
                  WHEN 'CANCELADA' THEN 'Cancelada' ELSE os.status END AS situacao
        FROM ordem_servico os
        JOIN veiculo v ON v.id_veiculo = os.id_veiculo AND v.viatura
        LEFT JOIN usuario  u_sol ON u_sol.id_usuario = os.id_solicitante
        LEFT JOIN servidor sol ON sol.id_servidor = u_sol.id_servidor
        LEFT JOIN servidor cond ON cond.id_servidor = os.id_servidor_solicitante
       WHERE os.data_abertura::date BETWEEN $1 AND $2
       ORDER BY os.data_abertura`,
  },

  FISC_INDICADORES: {
    nome: "Relatório de Indicadores da Fiscalização",
    descricao: "Números da Fiscalização no período.",
    modulo: "FISCALIZACAO",
    colunas: [
      { chave: "indicador", rotulo: "Indicador" },
      { chave: "valor", rotulo: "Valor" },
    ],
    sql: `
      SELECT 'Viaturas cadastradas' AS indicador, COUNT(*)::text AS valor FROM veiculo WHERE viatura
      UNION ALL SELECT 'Servicos diarios no periodo',
        (SELECT COUNT(*)::text FROM servico_diario WHERE data BETWEEN $1 AND $2)
      UNION ALL SELECT 'Ocorrencias no periodo',
        (SELECT COUNT(*)::text FROM ocorrencia WHERE data BETWEEN $1 AND $2)
      UNION ALL SELECT 'Ocorrencias QRU',
        (SELECT COUNT(*)::text FROM ocorrencia WHERE data BETWEEN $1 AND $2 AND tipo = 'QRU')
      UNION ALL SELECT 'Ocorrencias finalizadas',
        (SELECT COUNT(*)::text FROM ocorrencia WHERE data BETWEEN $1 AND $2 AND status = 'FINALIZADA')
      UNION ALL SELECT 'Checklists de viatura finalizados',
        (SELECT COUNT(*)::text FROM checklist_fiscalizacao WHERE data_abertura BETWEEN $1 AND $2 AND status = 'FINALIZADO')
      UNION ALL SELECT 'KM rodados pelas viaturas',
        (SELECT COALESCE(SUM(odometro_chegada - odometro_saida), 0)::text FROM checklist_fiscalizacao
          WHERE data_abertura BETWEEN $1 AND $2 AND odometro_chegada IS NOT NULL)
      UNION ALL SELECT 'OS das viaturas abertas no periodo',
        (SELECT COUNT(*)::text FROM ordem_servico o JOIN veiculo v ON v.id_veiculo = o.id_veiculo AND v.viatura
          WHERE o.data_abertura::date BETWEEN $1 AND $2)
      UNION ALL SELECT 'Pontos lancados no periodo',
        (SELECT COALESCE(SUM(pontos_aplicados), 0)::text FROM pontuacao_registro WHERE data_registro::date BETWEEN $1 AND $2)`,
  },
};

// O hash sela o conteudo: se alguem mexer no snapshot depois do ateste, ele
// deixa de bater.
//
// O JSONB do Postgres nao preserva a ordem das chaves - o objeto volta do banco
// com os campos em outra ordem. Por isso o hash e calculado sobre uma forma
// canonica (chaves ordenadas em todos os niveis), senao a verificacao falharia
// em todo relatorio, mesmo sem ninguem ter mexido em nada.
function canonico(valor) {
  if (Array.isArray(valor)) return valor.map(canonico);
  if (valor && typeof valor === "object") {
    return Object.keys(valor)
      .sort()
      .reduce((saida, chave) => {
        saida[chave] = canonico(valor[chave]);
        return saida;
      }, {});
  }
  return valor;
}

export function calcularHash(conteudo) {
  return crypto.createHash("sha256").update(JSON.stringify(canonico(conteudo))).digest("hex");
}
