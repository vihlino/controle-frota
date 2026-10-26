-- ============================================================
-- SITRA - historico das CNHs de cada servidor
-- Aplicar depois do 048_hora_registrada_checklist.sql.
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================
-- Pedido do Cesar (26/10): quando a CNH de alguem e alterada ou renovada, os
-- dados da CNH ANTIGA nao podem se perder. A aba CNH dos Detalhes do
-- Motorista/Servidor/Fiscal mostra o "Historico de renovacao".
--
-- Quem grava e um GATILHO no proprio banco: qualquer caminho que altere a CNH
-- (cadastro de servidor, tela de motoristas, importacao, ajuste manual) deixa
-- a versao anterior guardada, sem depender de cada tela lembrar de fazer isso.
BEGIN;

CREATE TABLE IF NOT EXISTS servidor_cnh_historico (
    id_historico      SERIAL PRIMARY KEY,
    id_servidor       INTEGER NOT NULL REFERENCES servidor(id_servidor) ON DELETE CASCADE,
    cnh               VARCHAR(30),
    categoria_cnh     VARCHAR(10),
    cnh_data_emissao  DATE,
    cnh_data_validade DATE,
    -- Quando esta CNH deixou de ser a atual (a hora da alteracao).
    substituida_em    TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cnh_historico_servidor
    ON servidor_cnh_historico (id_servidor, substituida_em DESC);

CREATE OR REPLACE FUNCTION fn_guardar_cnh_antiga() RETURNS trigger AS $$
BEGIN
    -- So guarda quando havia uma CNH antes e algum dado dela mudou.
    IF (OLD.cnh IS NOT NULL OR OLD.categoria_cnh IS NOT NULL
        OR OLD.cnh_data_emissao IS NOT NULL OR OLD.cnh_data_validade IS NOT NULL)
       AND (OLD.cnh, OLD.categoria_cnh, OLD.cnh_data_emissao, OLD.cnh_data_validade)
           IS DISTINCT FROM
           (NEW.cnh, NEW.categoria_cnh, NEW.cnh_data_emissao, NEW.cnh_data_validade)
    THEN
        INSERT INTO servidor_cnh_historico
               (id_servidor, cnh, categoria_cnh, cnh_data_emissao, cnh_data_validade)
        VALUES (OLD.id_servidor, OLD.cnh, OLD.categoria_cnh, OLD.cnh_data_emissao, OLD.cnh_data_validade);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guardar_cnh_antiga ON servidor;
CREATE TRIGGER trg_guardar_cnh_antiga
    AFTER UPDATE OF cnh, categoria_cnh, cnh_data_emissao, cnh_data_validade ON servidor
    FOR EACH ROW EXECUTE FUNCTION fn_guardar_cnh_antiga();

COMMIT;
