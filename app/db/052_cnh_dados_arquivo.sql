-- ============================================================
-- SITRA - mais dados da CNH e o arquivo (foto/PDF) da CNH
-- Aplicar depois do 051_cnh_historico_motivo.sql.
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================
-- Desenho do Cesar (29/10) para a aba CNH dos Detalhes do Motorista,
-- Servidor e Fiscal: orgao emissor, UF, registro RENACH e observacoes, e o
-- "Arquivo da CNH" (a foto ou o PDF da carteira), que aparece no cartao
-- "Dados da CNH".
BEGIN;

ALTER TABLE servidor ADD COLUMN IF NOT EXISTS cnh_orgao_emissor VARCHAR(60);
ALTER TABLE servidor ADD COLUMN IF NOT EXISTS cnh_uf            VARCHAR(2);
ALTER TABLE servidor ADD COLUMN IF NOT EXISTS cnh_renach        VARCHAR(20);
ALTER TABLE servidor ADD COLUMN IF NOT EXISTS cnh_observacoes   TEXT;

CREATE TABLE IF NOT EXISTS servidor_cnh_arquivo (
    id_arquivo   SERIAL PRIMARY KEY,
    id_servidor  BIGINT NOT NULL REFERENCES servidor(id_servidor) ON DELETE CASCADE,
    nome         VARCHAR(255) NOT NULL,
    tipo         VARCHAR(60) NOT NULL,
    bytes        INTEGER NOT NULL,
    conteudo     BYTEA NOT NULL,
    enviado_por  BIGINT,
    criado_em    TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cnh_arquivo_servidor ON servidor_cnh_arquivo (id_servidor, id_arquivo DESC);

COMMIT;
