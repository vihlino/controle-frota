-- ============================================================
-- SITRA - CNH do servidor e campos que deixam de ser obrigatorios
-- Aplicar depois do 004_fotos_e_registro.sql.
-- Tudo idempotente: pode rodar de novo sem quebrar.
-- ============================================================
BEGIN;

-- ------------------------------------------------------------
-- 1. DATAS DA CNH
-- ------------------------------------------------------------
-- A tabela tinha `cnh` e `categoria_cnh`, mas nenhuma data. Sem a validade
-- nao ha como avisar o gestor que a habilitacao de um condutor esta vencendo
-- - e um condutor com CNH vencida dirigindo veiculo publico e problema serio.
ALTER TABLE servidor ADD COLUMN IF NOT EXISTS cnh_data_emissao  DATE;
ALTER TABLE servidor ADD COLUMN IF NOT EXISTS cnh_data_validade DATE;

ALTER TABLE servidor DROP CONSTRAINT IF EXISTS chk_servidor_cnh_datas;
ALTER TABLE servidor
    ADD CONSTRAINT chk_servidor_cnh_datas
    CHECK (
        cnh_data_emissao IS NULL
        OR cnh_data_validade IS NULL
        OR cnh_data_validade >= cnh_data_emissao
    );

-- O alerta consulta por validade; sem indice isso varre a tabela inteira.
CREATE INDEX IF NOT EXISTS idx_servidor_cnh_validade
    ON servidor (cnh_data_validade)
    WHERE cnh_data_validade IS NOT NULL;

-- ------------------------------------------------------------
-- 2. CAMPOS QUE DEIXAM DE SER OBRIGATORIOS
-- ------------------------------------------------------------
-- telefone, email e cargo_funcao eram NOT NULL. Na pratica nem todo servidor
-- tem e-mail corporativo, e exigir isso obriga quem cadastra a inventar um
-- valor - o que suja a base com dados falsos.
ALTER TABLE servidor ALTER COLUMN telefone      DROP NOT NULL;
ALTER TABLE servidor ALTER COLUMN email         DROP NOT NULL;
ALTER TABLE servidor ALTER COLUMN cargo_funcao  DROP NOT NULL;

-- Cadastros antigos que receberam texto vazio para satisfazer o NOT NULL
-- passam a ser nulos de verdade: "nao informado" e diferente de "vazio".
UPDATE servidor SET telefone     = NULL WHERE btrim(telefone) = '';
UPDATE servidor SET email        = NULL WHERE btrim(email) = '';
UPDATE servidor SET cargo_funcao = NULL WHERE btrim(cargo_funcao) = '';

COMMIT;
