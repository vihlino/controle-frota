-- ============================================================================
-- 033 - Documento: arquivo anexado e historico de versoes
-- ============================================================================
-- 1. ANEXO: o PDF ou a foto do documento (CRLV, apolice...) fica guardado no
--    proprio banco, como as fotos do checklist - o disco do servidor da API e
--    efemero. Ate 10 MB por arquivo.
-- 2. HISTORICO: "Atualizar" um documento (renovacao do licenciamento, do
--    seguro...) cria um documento NOVO, ligado ao anterior; o anterior nao e
--    apagado - fica INATIVO e marcado como substituido. Como as contagens do
--    sistema (alertas, painel, ficha do veiculo) ja ignoram INATIVO, a versao
--    antiga sai dos avisos sozinha, mas continua consultavel.
-- Idempotente, como as demais.

ALTER TABLE documento_veiculo
  ADD COLUMN IF NOT EXISTS id_documento_anterior BIGINT,
  ADD COLUMN IF NOT EXISTS substituido_em        TIMESTAMP,
  ADD COLUMN IF NOT EXISTS substituido_por       BIGINT,
  ADD COLUMN IF NOT EXISTS orgao_emissor         VARCHAR(150),
  ADD COLUMN IF NOT EXISTS criado_em             TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE documento_veiculo DROP CONSTRAINT IF EXISTS fk_documento_anterior;
ALTER TABLE documento_veiculo
  ADD CONSTRAINT fk_documento_anterior FOREIGN KEY (id_documento_anterior)
  REFERENCES documento_veiculo (id_documento) ON DELETE SET NULL;

ALTER TABLE documento_veiculo DROP CONSTRAINT IF EXISTS fk_documento_substituido_por;
ALTER TABLE documento_veiculo
  ADD CONSTRAINT fk_documento_substituido_por FOREIGN KEY (substituido_por)
  REFERENCES usuario (id_usuario);

CREATE INDEX IF NOT EXISTS idx_documento_anterior ON documento_veiculo (id_documento_anterior);

CREATE TABLE IF NOT EXISTS documento_arquivo (
  id_arquivo   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_documento BIGINT NOT NULL REFERENCES documento_veiculo (id_documento) ON DELETE CASCADE,
  nome         VARCHAR(255) NOT NULL,
  tipo         VARCHAR(100) NOT NULL,
  bytes        INT NOT NULL,
  conteudo     BYTEA NOT NULL,
  enviado_por  BIGINT REFERENCES usuario (id_usuario),
  criado_em    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_documento_arquivo_bytes CHECK (bytes > 0 AND bytes <= 10485760)
);
CREATE INDEX IF NOT EXISTS idx_documento_arquivo_doc ON documento_arquivo (id_documento);
