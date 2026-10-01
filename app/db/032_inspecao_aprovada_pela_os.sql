-- ============================================================================
-- 032 - Inspecao aprovada quando a OS dela e fechada
-- ============================================================================
-- Inspecao com ressalva gera OS; quando a oficina devolve o veiculo e a OS e
-- FECHADA, o problema esta resolvido - a inspecao passa a "Aprovado".
-- `aprovada_em` guarda quando isso aconteceu. Se a inspecao gerou mais de uma
-- OS, so aprova quando todas estiverem fechadas (ou canceladas).
-- Idempotente, como as demais.

ALTER TABLE inspecao ADD COLUMN IF NOT EXISTS aprovada_em TIMESTAMP;

-- Mesma regra da 029, com a aprovacao pela OS. A versao de 3 argumentos fica
-- para quem ainda a chama.
CREATE OR REPLACE FUNCTION analise_inspecao(
  p_status TEXT, p_resultado TEXT, p_analisada_em TIMESTAMP, p_aprovada_em TIMESTAMP
) RETURNS TEXT AS $$
  SELECT CASE
           WHEN p_status IS DISTINCT FROM 'FINALIZADA' THEN NULL
           WHEN p_resultado = 'CONFORME' OR p_aprovada_em IS NOT NULL THEN 'APROVADO'
           WHEN p_analisada_em IS NULL THEN 'EM_ANALISE'
           ELSE 'ANALISADO'
         END;
$$ LANGUAGE sql IMMUTABLE;

-- Inspecoes cujas OS ja estao todas fechadas: aprovadas na data do ultimo
-- fechamento.
UPDATE inspecao i
   SET aprovada_em = x.quando
  FROM (
    SELECT os.id_registro_origem AS id_inspecao,
           MAX(COALESCE(os.data_fechamento::timestamp, os.data_conclusao, os.data_abertura)) AS quando
      FROM ordem_servico os
     WHERE os.origem = 'INSPECAO' AND os.id_registro_origem IS NOT NULL
     GROUP BY os.id_registro_origem
    HAVING BOOL_AND(os.status IN ('RESOLVIDA', 'CANCELADA'))
       AND BOOL_OR(os.status = 'RESOLVIDA')
  ) x
 WHERE i.id_inspecao = x.id_inspecao
   AND i.aprovada_em IS NULL
   AND i.status = 'FINALIZADA';
