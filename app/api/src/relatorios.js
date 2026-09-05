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
 */
import crypto from "node:crypto";

// Cada tipo de relatorio tem um modelo fixo: colunas definidas e a consulta que
// as alimenta. O usuario so escolhe periodo e tipo - nada de montar colunas na mao.
export const MODELOS = {
  ENTRADA_SAIDA: {
    nome: "Controle de Entrada e Saida de Veiculos",
    descricao: "Registro de entradas, saidas e quilometragem.",
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
        JOIN veiculo  v ON v.id_veiculo  = c.id_veiculo
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
    nome: "Relatorio de Manutencoes",
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
             COALESCE(r.nome, sol.nome) AS responsavel,
             os.proxima_manutencao, os.observacoes
        FROM ordem_servico os
        JOIN veiculo v ON v.id_veiculo = os.id_veiculo
        JOIN usuario  u_sol ON u_sol.id_usuario = os.id_solicitante
        JOIN servidor sol ON sol.id_servidor = u_sol.id_servidor
        LEFT JOIN usuario  u_r ON u_r.id_usuario = os.id_responsavel
        LEFT JOIN servidor r ON r.id_servidor = u_r.id_servidor
       WHERE os.data_abertura::date BETWEEN $1 AND $2
       ORDER BY os.data_abertura`,
  },
  CHECKLISTS: {
    nome: "Relatorio de Checklists",
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
        JOIN veiculo  v ON v.id_veiculo  = c.id_veiculo
       WHERE c.data_abertura BETWEEN $1 AND $2
       ORDER BY c.data_abertura, c.hora_saida`,
  },

  INSPECOES: {
    nome: "Relatorio de Inspecoes",
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
    nome: "Relatorio de Sinistros",
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
    nome: "Relatorio de Documentos",
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
       ORDER BY d.data_validade NULLS LAST`,
  },

  INDICADORES: {
    nome: "Relatorio de Indicadores",
    descricao: "Indicadores de desempenho da frota.",
    modulo: "FROTAS",
    colunas: [
      { chave: "indicador", rotulo: "Indicador" },
      { chave: "valor", rotulo: "Valor" },
    ],
    sql: `
      SELECT 'Veiculos cadastrados' AS indicador, COUNT(*)::text AS valor FROM veiculo
      UNION ALL SELECT 'Checklists no periodo',
        (SELECT COUNT(*)::text FROM checklist_frotas WHERE data_abertura BETWEEN $1 AND $2)
      UNION ALL SELECT 'KM rodados no periodo',
        (SELECT COALESCE(SUM(odometro_chegada - odometro_saida), 0)::text
           FROM checklist_frotas
          WHERE data_abertura BETWEEN $1 AND $2 AND odometro_chegada IS NOT NULL)
      UNION ALL SELECT 'Ordens de servico abertas no periodo',
        (SELECT COUNT(*)::text FROM ordem_servico WHERE data_abertura::date BETWEEN $1 AND $2)
      UNION ALL SELECT 'Custo total de manutencao (R$)',
        (SELECT COALESCE(SUM(custo), 0)::text FROM ordem_servico
          WHERE data_abertura::date BETWEEN $1 AND $2)
      UNION ALL SELECT 'Inspecoes realizadas no periodo',
        (SELECT COUNT(*)::text FROM inspecao WHERE data_realizacao BETWEEN $1 AND $2)
      UNION ALL SELECT 'Sinistros no periodo',
        (SELECT COUNT(*)::text FROM sinistro WHERE data BETWEEN $1 AND $2)
      UNION ALL SELECT 'Documentos vencidos',
        (SELECT COUNT(*)::text FROM documento_veiculo
          WHERE data_validade < CURRENT_DATE AND status <> 'INATIVO')`,
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
