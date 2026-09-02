-- ============================================================
-- SITRA - ajustes exigidos pelo checklist do QR Code (saida e chegada)
-- Aplicar depois do 002_sitra_telas.sql.
-- Tudo idempotente: pode rodar de novo sem quebrar.
-- ============================================================
BEGIN;

-- 1. OBSERVACOES SEPARADAS
-- Havia uma coluna `observacoes` so. Como a chegada gravava por cima, a
-- observacao da saida se perdia. Agora cada momento tem a sua.
ALTER TABLE checklist_frotas
    ADD COLUMN IF NOT EXISTS observacoes_chegada TEXT;

COMMENT ON COLUMN checklist_frotas.observacoes IS
    'Observacoes da SAIDA. As da chegada ficam em observacoes_chegada.';

-- 2. EQUIPAMENTO CONFERIDO NOS DOIS MOMENTOS
-- A chave primaria era (id_checklist, equipamento), entao so cabia UMA
-- conferencia por checklist. O condutor confere na saida e de novo na
-- chegada, e as duas precisam ficar registradas: e assim que se sabe se um
-- item sumiu durante o uso.
ALTER TABLE checklist_frotas_equipamento
    ADD COLUMN IF NOT EXISTS momento VARCHAR(10) NOT NULL DEFAULT 'SAIDA';

ALTER TABLE checklist_frotas_equipamento
    DROP CONSTRAINT IF EXISTS chk_checklist_frotas_equipamento_momento;
ALTER TABLE checklist_frotas_equipamento
    ADD CONSTRAINT chk_checklist_frotas_equipamento_momento
    CHECK (momento IN ('SAIDA', 'CHEGADA'));

-- Troca a chave primaria para incluir o momento.
ALTER TABLE checklist_frotas_equipamento
    DROP CONSTRAINT IF EXISTS checklist_frotas_equipamento_pkey;
ALTER TABLE checklist_frotas_equipamento
    ADD CONSTRAINT checklist_frotas_equipamento_pkey
    PRIMARY KEY (id_checklist, equipamento, momento);

COMMIT;
