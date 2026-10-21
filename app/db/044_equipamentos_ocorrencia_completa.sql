-- 044_equipamentos_ocorrencia_completa.sql (21/10/2026)
--
-- 1) Equipamentos da Fiscalizacao (pedido do Cesar, 21/10)
--    - Itens novos: Cavalete e Barreira.
--    - Cada item diz como e conferido no checklist:
--        QUANTIDADE  - a quantidade salva para a viatura (Cone, Pantografica,
--                      Cavalete, Barreira);
--        POR_FISCAL  - fixo, um para cada fiscal (Radio);
--        OBRIGATORIO - presente ou ausente (Macaco, Estepe, Chave de roda).
--    - As quantidades por viatura (veiculo_equipamento) passam a ser salvas
--      na tela Fiscalizacao > Equipamentos, com historico.
ALTER TABLE equipamento ADD COLUMN IF NOT EXISTS conferencia VARCHAR(20) NOT NULL DEFAULT 'QUANTIDADE';
ALTER TABLE equipamento ADD COLUMN IF NOT EXISTS ordem INT;
ALTER TABLE equipamento DROP CONSTRAINT IF EXISTS chk_equipamento_conferencia;
ALTER TABLE equipamento
  ADD CONSTRAINT chk_equipamento_conferencia CHECK (conferencia IN ('QUANTIDADE', 'POR_FISCAL', 'OBRIGATORIO'));

INSERT INTO equipamento (nome, descricao, status) VALUES
  ('Cavalete', 'Cavalete de sinalização utilizado pela Fiscalização', TRUE),
  ('Barreira', 'Barreira de sinalização utilizada pela Fiscalização', TRUE)
ON CONFLICT (nome) DO NOTHING;

-- So acerta os itens que ainda estao no padrao (quem mudou pela tela fica).
UPDATE equipamento SET conferencia = 'POR_FISCAL'
 WHERE nome = 'Rádio' AND conferencia = 'QUANTIDADE' AND ordem IS NULL;
UPDATE equipamento SET conferencia = 'OBRIGATORIO'
 WHERE nome IN ('Macaco', 'Estepe', 'Chave de roda') AND conferencia = 'QUANTIDADE' AND ordem IS NULL;
UPDATE equipamento e SET ordem = o.ordem
  FROM (VALUES ('Rádio', 1), ('Cone', 2), ('Pantográfica', 3), ('Cavalete', 4), ('Barreira', 5),
               ('Macaco', 6), ('Estepe', 7), ('Chave de roda', 8), ('Outros', 99)) AS o (nome, ordem)
 WHERE e.nome = o.nome AND e.ordem IS NULL;
UPDATE equipamento SET ordem = 50 + id_equipamento::int WHERE ordem IS NULL;

-- Historico do que muda nos equipamentos: quantidade de uma viatura, item
-- criado, alterado, ativado ou inativado.
CREATE TABLE IF NOT EXISTS equipamento_historico (
    id_historico        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_equipamento      BIGINT NOT NULL REFERENCES equipamento (id_equipamento),
    id_veiculo          BIGINT REFERENCES veiculo (id_veiculo),
    tipo                VARCHAR(20) NOT NULL,
    quantidade_anterior INT,
    quantidade_nova     INT,
    descricao           TEXT,
    motivo              TEXT,
    alterado_por        BIGINT REFERENCES usuario (id_usuario),
    alterado_em         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_equipamento_historico_tipo
        CHECK (tipo IN ('QUANTIDADE', 'ITEM_CRIADO', 'ITEM_ALTERADO', 'ITEM_ATIVADO', 'ITEM_INATIVADO'))
);
CREATE INDEX IF NOT EXISTS idx_equip_hist_veiculo ON equipamento_historico (id_veiculo, alterado_em DESC);
CREATE INDEX IF NOT EXISTS idx_equip_hist_data ON equipamento_historico (alterado_em DESC);

-- 2) Ocorrencia completa (tela "Nova Ocorrencia" do desenho de 21/10)
ALTER TABLE ocorrencia
  ADD COLUMN IF NOT EXISTS categoria            VARCHAR(30),
  ADD COLUMN IF NOT EXISTS bairro               VARCHAR(120),
  ADD COLUMN IF NOT EXISTS referencia           VARCHAR(255),
  ADD COLUMN IF NOT EXISTS sentido_via          VARCHAR(60),
  ADD COLUMN IF NOT EXISTS latitude             NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS longitude            NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS id_ocorrencia_origem BIGINT;

ALTER TABLE ocorrencia DROP CONSTRAINT IF EXISTS chk_ocorrencia_categoria;
ALTER TABLE ocorrencia
  ADD CONSTRAINT chk_ocorrencia_categoria CHECK (categoria IS NULL OR categoria IN (
    'INFRACAO_TRANSITO', 'VEICULO_IRREGULAR', 'TRANSPORTE_IRREGULAR', 'CONDUTOR_PASSAGEIRO',
    'VIA_SINALIZACAO', 'TERCEIROS', 'APOIO', 'OUTRO'));
ALTER TABLE ocorrencia DROP CONSTRAINT IF EXISTS fk_ocorrencia_origem;
ALTER TABLE ocorrencia
  ADD CONSTRAINT fk_ocorrencia_origem FOREIGN KEY (id_ocorrencia_origem) REFERENCES ocorrencia (id_ocorrencia) ON DELETE SET NULL;

-- Envolvidos: outros veiculos, condutores, passageiros ou terceiros.
CREATE TABLE IF NOT EXISTS ocorrencia_envolvido (
    id_envolvido     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_ocorrencia    BIGINT NOT NULL REFERENCES ocorrencia (id_ocorrencia) ON DELETE CASCADE,
    tipo             VARCHAR(20) NOT NULL,
    identificacao    VARCHAR(150) NOT NULL,
    placa_documento  VARCHAR(60),
    CONSTRAINT chk_envolvido_tipo
        CHECK (tipo IN ('VEICULO', 'CONDUTOR', 'PASSAGEIRO', 'PEDESTRE', 'TESTEMUNHA', 'TERCEIRO', 'OUTRO'))
);
CREATE INDEX IF NOT EXISTS idx_envolvido_ocorrencia ON ocorrencia_envolvido (id_ocorrencia);

-- Fotos (ate 6, reduzidas no aparelho) e documentos (PDF/JPG/PNG ate 10 MB).
CREATE TABLE IF NOT EXISTS ocorrencia_arquivo (
    id_arquivo     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_ocorrencia  BIGINT NOT NULL REFERENCES ocorrencia (id_ocorrencia) ON DELETE CASCADE,
    categoria      VARCHAR(10) NOT NULL,
    nome           VARCHAR(255) NOT NULL,
    tipo           VARCHAR(100) NOT NULL,
    bytes          INT NOT NULL,
    conteudo       BYTEA NOT NULL,
    enviado_por    BIGINT REFERENCES usuario (id_usuario),
    criado_em      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_ocorrencia_arquivo_categoria CHECK (categoria IN ('FOTO', 'DOCUMENTO')),
    CONSTRAINT chk_ocorrencia_arquivo_bytes CHECK (bytes > 0 AND bytes <= 10485760)
);
CREATE INDEX IF NOT EXISTS idx_ocorrencia_arquivo ON ocorrencia_arquivo (id_ocorrencia, categoria);
