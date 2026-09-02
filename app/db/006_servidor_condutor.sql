-- ============================================================
-- SITRA - marca quem e condutor
-- Aplicar depois do 005_servidor_cnh.sql.
-- Tudo idempotente: pode rodar de novo sem quebrar.
-- ============================================================
BEGIN;

-- A mesma tabela guarda o motorista e o auxiliar administrativo. Sem esta
-- marca nao dava para (a) exigir CNH so de quem dirige, nem (b) fazer a tela
-- "Motoristas" mostrar motoristas - ela repetia a lista inteira de servidores.
ALTER TABLE servidor
    ADD COLUMN IF NOT EXISTS condutor BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN servidor.condutor IS
    'TRUE quando a pessoa dirige veiculo da frota. Quem e condutor precisa de CNH com validade.';

-- Quem ja tem CNH cadastrada e condutor: e a unica razao de alguem ter
-- registrado a habilitacao dessa pessoa.
UPDATE servidor SET condutor = TRUE
 WHERE condutor = FALSE AND cnh IS NOT NULL AND btrim(cnh) <> '';

CREATE INDEX IF NOT EXISTS idx_servidor_condutor
    ON servidor (condutor) WHERE condutor = TRUE;

COMMIT;
