-- ============================================================================
-- 040 - OS solicitada pela Fiscalizacao (18/10)
-- ============================================================================
-- A Fiscalizacao nao fecha nem completa OS: ela SOLICITA o servico da viatura.
-- A OS nasce "PENDENTE" (sem oficina, responsavel, custo, pecas) e o Frotas
-- completa o registro - so entao ela passa para "Em analise" e segue o
-- caminho normal ate o fechamento.
--   - status PENDENTE na lista de situacoes da OS;
--   - data_ocorrido: o dia em que o problema aconteceu (pedido pela
--     Fiscalizacao junto com a solicitacao).
-- Idempotente, como as demais.

ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS data_ocorrido DATE;

ALTER TABLE ordem_servico DROP CONSTRAINT IF EXISTS chk_os_status;
ALTER TABLE ordem_servico ADD CONSTRAINT chk_os_status CHECK (
  status IN ('PENDENTE', 'EM_ANALISE', 'EM_MANUTENCAO', 'RESOLVIDA', 'CANCELADA')
);
