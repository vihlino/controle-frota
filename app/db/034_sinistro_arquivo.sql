-- ============================================================================
-- 034 - Sinistro: fotos e documentos anexados
-- ============================================================================
-- Fotos dos danos, B.O., orcamentos... guardados no proprio banco, como os
-- anexos de documento (033) e as fotos do checklist. Ate 10 MB por arquivo.
-- Idempotente, como as demais.

CREATE TABLE IF NOT EXISTS sinistro_arquivo (
  id_arquivo   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_sinistro  BIGINT NOT NULL REFERENCES sinistro (id_sinistro) ON DELETE CASCADE,
  nome         VARCHAR(255) NOT NULL,
  tipo         VARCHAR(100) NOT NULL,
  bytes        INT NOT NULL,
  conteudo     BYTEA NOT NULL,
  enviado_por  BIGINT REFERENCES usuario (id_usuario),
  criado_em    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_sinistro_arquivo_bytes CHECK (bytes > 0 AND bytes <= 10485760)
);
CREATE INDEX IF NOT EXISTS idx_sinistro_arquivo_sin ON sinistro_arquivo (id_sinistro);
