-- ============================================================================
-- 037 - Multas de transito (08/10)
-- ============================================================================
-- Cada multa fica vinculada ao CONDUTOR (servidor) e ao veiculo. Aparece na
-- aba "Multas" dos detalhes do Motorista, do Servidor e do Fiscal, e a opcao
-- "Multas" do menu de acoes dessas listas leva direto para ela.
--
-- Pontos e valor vem sugeridos pela gravidade (CTB) mas podem ser corrigidos:
-- valem os do auto de infracao. Anexos (auto, notificacao, comprovante) ficam
-- no banco, como os do sinistro (034). Idempotente, como as demais.

CREATE TABLE IF NOT EXISTS multa (
  id_multa         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_servidor      BIGINT NOT NULL REFERENCES servidor (id_servidor),
  id_veiculo       BIGINT NOT NULL REFERENCES veiculo (id_veiculo),
  numero_auto      VARCHAR(50),
  orgao_autuador   VARCHAR(100),
  codigo_infracao  VARCHAR(20),
  data             DATE NOT NULL,
  hora             TIME,
  local            VARCHAR(255),
  descricao        TEXT NOT NULL,
  gravidade        VARCHAR(20) NOT NULL,
  pontos           SMALLINT,
  valor            NUMERIC(10, 2),
  vencimento       DATE,
  status           VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
  data_pagamento   DATE,
  observacoes      TEXT,
  criado_por       BIGINT REFERENCES usuario (id_usuario),
  criado_em        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_multa_gravidade CHECK (gravidade IN ('LEVE', 'MEDIA', 'GRAVE', 'GRAVISSIMA')),
  CONSTRAINT chk_multa_status CHECK (status IN ('PENDENTE', 'PAGA', 'EM_RECURSO', 'CANCELADA')),
  CONSTRAINT chk_multa_pontos CHECK (pontos IS NULL OR pontos BETWEEN 0 AND 40),
  CONSTRAINT chk_multa_valor CHECK (valor IS NULL OR valor >= 0)
);
CREATE INDEX IF NOT EXISTS idx_multa_servidor ON multa (id_servidor);
CREATE INDEX IF NOT EXISTS idx_multa_veiculo ON multa (id_veiculo);

CREATE TABLE IF NOT EXISTS multa_arquivo (
  id_arquivo   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_multa     BIGINT NOT NULL REFERENCES multa (id_multa) ON DELETE CASCADE,
  nome         VARCHAR(255) NOT NULL,
  tipo         VARCHAR(100) NOT NULL,
  bytes        INT NOT NULL,
  conteudo     BYTEA NOT NULL,
  enviado_por  BIGINT REFERENCES usuario (id_usuario),
  criado_em    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_multa_arquivo_bytes CHECK (bytes > 0 AND bytes <= 10485760)
);
CREATE INDEX IF NOT EXISTS idx_multa_arquivo_multa ON multa_arquivo (id_multa);

-- Quem registra e corrige multas: Administrador e os gestores de Frotas e da
-- Fiscalizacao (os fiscais tambem sao condutores).
INSERT INTO permissao (codigo, nome, descricao, modulo) VALUES
    ('FROTAS_GERENCIAR_MULTAS', 'Gerenciar multas',
     'Permite registrar, corrigir e anexar documentos das multas dos condutores.',
     'FROTAS')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO perfil_permissao (id_perfil, id_permissao)
SELECT p.id_perfil, pe.id_permissao
  FROM perfil p
  JOIN permissao pe ON pe.codigo = 'FROTAS_GERENCIAR_MULTAS'
 WHERE unaccent_simples(p.nome) IN ('ADMINISTRADOR', 'GESTOR FROTAS', 'GESTOR FISCALIZACAO')
ON CONFLICT DO NOTHING;
