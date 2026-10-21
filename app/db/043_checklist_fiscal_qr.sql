-- 043_checklist_fiscal_qr.sql (21/10/2026)
-- Checklist da viatura da Fiscalizacao pelo QR Code (desenho do Cesar, 21/10):
-- saida, ocorrencias/QRU durante o servico, chegada e finalizacao.

-- Fotos do checklist da viatura. Mesmo modelo das fotos do checklist da
-- frota (migracao 004), com um momento a mais: SERVICO, as fotos tiradas
-- durante o servico (ocorrencias, local).
CREATE TABLE IF NOT EXISTS checklist_fiscal_foto (
    id_foto      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_checklist BIGINT NOT NULL REFERENCES checklist_fiscalizacao (id_checklist) ON DELETE CASCADE,
    momento      VARCHAR(10) NOT NULL,
    tipo         VARCHAR(40) NOT NULL,
    bytes        INTEGER NOT NULL,
    conteudo     BYTEA NOT NULL,
    criado_em    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_fiscal_foto_momento CHECK (momento IN ('SAIDA', 'SERVICO', 'CHEGADA')),
    CONSTRAINT chk_fiscal_foto_bytes CHECK (bytes > 0 AND bytes <= 3145728)
);
CREATE INDEX IF NOT EXISTS idx_fiscal_foto_checklist ON checklist_fiscal_foto (id_checklist, momento);

-- Observacoes de cada etapa. A coluna observacoes (que ja existia) e a da
-- saida; durante o servico a equipe escreve as dela, e na chegada as do retorno.
ALTER TABLE checklist_fiscalizacao ADD COLUMN IF NOT EXISTS observacoes_equipe TEXT;
ALTER TABLE checklist_fiscalizacao ADD COLUMN IF NOT EXISTS observacoes_chegada TEXT;
