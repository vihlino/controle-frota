-- ============================================================
-- SITRA - motivo da troca de CNH no historico
-- Aplicar depois do 050_veiculo_foto.sql.
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================
-- O botao "Atualizar CNH" (26/10) pergunta o motivo (renovacao, mudanca de
-- categoria, correcao...). O gatilho da 049 guarda a CNH antiga; a rota grava
-- o motivo nessa mesma linha logo depois.
BEGIN;

ALTER TABLE servidor_cnh_historico ADD COLUMN IF NOT EXISTS motivo VARCHAR(60);

COMMIT;
