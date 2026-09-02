-- ============================================================
-- SITRA - fotos do checklist e carimbo de tempo do envio
-- Aplicar depois do 003_checklist_qr.sql.
-- Tudo idempotente: pode rodar de novo sem quebrar.
-- ============================================================
BEGIN;

-- ------------------------------------------------------------
-- 1. QUANDO O REGISTRO FOI ENVIADO (nao quando o condutor diz que saiu)
-- ------------------------------------------------------------
-- O banco ja guardava:
--   data_abertura / hora_saida    o que o condutor DECLARA como saida
--   data_devolucao / hora_chegada o que o condutor DECLARA como chegada
--   data_finalizacao              o instante em que a chegada foi enviada
--
-- Faltava o par da saida: o instante em que a saida foi enviada. Sem ele nao
-- da para saber se o checklist foi preenchido na hora ou horas depois - que e
-- justamente o que se quer fiscalizar.
ALTER TABLE checklist_frotas
    ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

COMMENT ON COLUMN checklist_frotas.criado_em IS
    'Instante em que a SAIDA foi enviada. Comparar com data_abertura+hora_saida mostra atraso no preenchimento.';
COMMENT ON COLUMN checklist_frotas.data_finalizacao IS
    'Instante em que a CHEGADA foi enviada. Comparar com data_devolucao+hora_chegada mostra atraso no fechamento.';

-- Registros antigos nao tem esse instante. Usar a data/hora declarada e a
-- melhor aproximacao disponivel - e deixa claro que nao houve atraso medido.
UPDATE checklist_frotas
   SET criado_em = (data_abertura + hora_saida)
 WHERE criado_em IS NULL
    OR criado_em > (data_abertura + hora_saida) + INTERVAL '1 day';

-- ------------------------------------------------------------
-- 2. FOTOS
-- ------------------------------------------------------------
-- O binario fica no proprio Postgres, e nao em disco. Motivo: o servico da
-- API no Render usa disco efemero - arquivo gravado ali some no proximo
-- deploy. O banco tem persistencia e backup.
--
-- Para o peso nao virar problema, o navegador reduz a imagem antes de enviar
-- (lado maior 1600px, JPEG). Uma foto de celular sai de ~4 MB para ~300 KB.
CREATE TABLE IF NOT EXISTS checklist_frotas_foto (
    id_foto BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_checklist BIGINT NOT NULL,
    momento VARCHAR(10) NOT NULL,
    tipo VARCHAR(60) NOT NULL,
    bytes INT NOT NULL,
    conteudo BYTEA NOT NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_checklist_foto_checklist
        FOREIGN KEY (id_checklist)
        REFERENCES checklist_frotas (id_checklist)
        ON DELETE CASCADE,

    CONSTRAINT chk_checklist_foto_momento
        CHECK (momento IN ('SAIDA', 'CHEGADA')),

    -- 3 MB por foto ja e folgado para uma imagem reduzida. O limite existe
    -- para um envio malformado nao encher o banco.
    CONSTRAINT chk_checklist_foto_bytes
        CHECK (bytes > 0 AND bytes <= 3145728)
);

CREATE INDEX IF NOT EXISTS idx_checklist_foto_checklist
    ON checklist_frotas_foto (id_checklist, momento);

COMMIT;
