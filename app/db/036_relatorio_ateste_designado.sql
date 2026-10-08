-- ============================================================
-- SITRA - ateste encaminhado para pessoas escolhidas (07/10)
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================
-- Ao gerar o relatorio, quem gera responde se ele precisa de ateste e, se
-- precisa, escolhe de 1 a 3 usuarios. Cada um vira uma linha PENDENTE em
-- `atestacao` (a tabela ja aceitava esse status) e recebe o aviso no sino.
-- So os escolhidos atestam aquele relatorio; quando o ultimo atesta, o
-- relatorio passa a ATESTADO. Sem ateste, o relatorio nasce GERADO.
--
-- `ateste_designado` separa esses relatorios dos antigos, que continuam com
-- a regra de antes (qualquer pessoa com a permissao, ate tres atestos).
BEGIN;

ALTER TABLE relatorio
  ADD COLUMN IF NOT EXISTS ateste_designado BOOLEAN NOT NULL DEFAULT FALSE;

-- Os avisos do sino procuram "o que esta pendente para mim".
CREATE INDEX IF NOT EXISTS ix_atestacao_pendente_usuario
  ON atestacao (id_usuario) WHERE status = 'PENDENTE';

-- A mesma pessoa nao aparece duas vezes no mesmo relatorio. So cria se os
-- dados antigos ja respeitam a regra, para nunca travar a subida da API.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM atestacao GROUP BY id_relatorio, id_usuario HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_atestacao_relatorio_usuario
      ON atestacao (id_relatorio, id_usuario);
  END IF;
END $$;

COMMIT;
