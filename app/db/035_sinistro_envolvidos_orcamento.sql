-- ============================================================================
-- 035 - Sinistro: envolvidos e orcamento
-- ============================================================================
-- Pedido do Cesar (06/10): a ficha do sinistro mostra os ENVOLVIDOS (o
-- condutor do veiculo da frota e as outras pessoas: condutor do outro
-- veiculo, passageiro, pedestre, testemunha) e os CUSTOS ESTIMADOS (o
-- orcamento da oficina: pecas, mao de obra e outros).
-- Idempotente, como as demais.

ALTER TABLE sinistro
  ADD COLUMN IF NOT EXISTS situacao_condutor  VARCHAR(20),
  ADD COLUMN IF NOT EXISTS orcamento_oficina  VARCHAR(150),
  ADD COLUMN IF NOT EXISTS orcamento_pecas    NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS orcamento_mao_obra NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS orcamento_outros   NUMERIC(12,2);

ALTER TABLE sinistro DROP CONSTRAINT IF EXISTS chk_sinistro_situacao_condutor;
ALTER TABLE sinistro ADD CONSTRAINT chk_sinistro_situacao_condutor CHECK (
  situacao_condutor IS NULL OR situacao_condutor IN ('SEM_LESOES', 'LESOES_LEVES', 'LESOES_GRAVES'));

ALTER TABLE sinistro DROP CONSTRAINT IF EXISTS chk_sinistro_orcamento;
ALTER TABLE sinistro ADD CONSTRAINT chk_sinistro_orcamento CHECK (
  COALESCE(orcamento_pecas, 0) >= 0 AND COALESCE(orcamento_mao_obra, 0) >= 0
  AND COALESCE(orcamento_outros, 0) >= 0);

CREATE TABLE IF NOT EXISTS sinistro_envolvido (
  id_envolvido BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_sinistro  BIGINT NOT NULL REFERENCES sinistro (id_sinistro) ON DELETE CASCADE,
  ordem        INT NOT NULL DEFAULT 0,
  tipo         VARCHAR(20) NOT NULL,
  nome         VARCHAR(150),
  documento    VARCHAR(40),
  placa        VARCHAR(10),
  modelo       VARCHAR(100),
  contato      VARCHAR(60),
  situacao     VARCHAR(20),
  observacao   TEXT,
  CONSTRAINT chk_envolvido_tipo CHECK (tipo IN ('OUTRO_VEICULO', 'PASSAGEIRO', 'PEDESTRE', 'TESTEMUNHA', 'OUTRO')),
  CONSTRAINT chk_envolvido_situacao CHECK (situacao IS NULL OR situacao IN ('SEM_LESOES', 'LESOES_LEVES', 'LESOES_GRAVES'))
);
CREATE INDEX IF NOT EXISTS idx_sinistro_envolvido_sin ON sinistro_envolvido (id_sinistro);
