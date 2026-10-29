-- ============================================================
-- SITRA - fotos e documentos da inspecao e da OS (manutencao)
-- Aplicar depois do 052_cnh_dados_arquivo.sql.
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================
-- Desenho do Cesar (29/10) para as abas Inspecoes e Manutencoes dos
-- Detalhes do Veiculo: embaixo da lista, "Fotos da Inspecao/Manutencao" e
-- "Documentos" do registro aberto. Mesmas regras do anexo do sinistro
-- (migracao 034): PDF, JPG ou PNG, ate 10 MB, guardado no banco.
BEGIN;

CREATE TABLE IF NOT EXISTS inspecao_arquivo (
  id_arquivo   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_inspecao  BIGINT NOT NULL REFERENCES inspecao (id_inspecao) ON DELETE CASCADE,
  nome         VARCHAR(255) NOT NULL,
  tipo         VARCHAR(100) NOT NULL,
  bytes        INT NOT NULL,
  conteudo     BYTEA NOT NULL,
  enviado_por  BIGINT REFERENCES usuario (id_usuario),
  criado_em    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_inspecao_arquivo_bytes CHECK (bytes > 0 AND bytes <= 10485760)
);
CREATE INDEX IF NOT EXISTS idx_inspecao_arquivo_insp ON inspecao_arquivo (id_inspecao);

CREATE TABLE IF NOT EXISTS ordem_servico_arquivo (
  id_arquivo   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_os        BIGINT NOT NULL REFERENCES ordem_servico (id_os) ON DELETE CASCADE,
  nome         VARCHAR(255) NOT NULL,
  tipo         VARCHAR(100) NOT NULL,
  bytes        INT NOT NULL,
  conteudo     BYTEA NOT NULL,
  enviado_por  BIGINT REFERENCES usuario (id_usuario),
  criado_em    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_os_arquivo_bytes CHECK (bytes > 0 AND bytes <= 10485760)
);
CREATE INDEX IF NOT EXISTS idx_os_arquivo_os ON ordem_servico_arquivo (id_os);

COMMIT;
