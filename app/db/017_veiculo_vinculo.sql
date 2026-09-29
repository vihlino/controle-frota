-- ============================================================
-- SITRA - vinculo do veiculo: patrimonio proprio ou locado
-- Aplicar depois do 016_viatura_vem_do_setor.sql.
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================
BEGIN;

-- A frota da CMTT tem carro proprio e carro alugado. A diferenca nao e
-- decorativa: manutencao de locado vai para a locadora, o proprio vai para a
-- oficina; e o relatorio de custos precisa separar os dois. Sem esta coluna a
-- informacao ficava em "Observacoes", escrita de um jeito diferente por cada
-- pessoa - e por isso nao dava para somar, filtrar nem conferir.
ALTER TABLE veiculo ADD COLUMN IF NOT EXISTS vinculo VARCHAR(20);

-- Tres valores, escritos sempre igual:
--   PROPRIO    - da CMTT, sem numero de patrimonio (doado, cedido, antigo)
--   PATRIMONIO - da CMTT e tombado, com numero de patrimonio
--   LOCADO     - alugado de terceiro
--
-- Sem o CHECK, "LOCADO", "Locado" e "locado" viveriam juntos na mesma coluna.
ALTER TABLE veiculo DROP CONSTRAINT IF EXISTS chk_veiculo_vinculo;
ALTER TABLE veiculo
    ADD CONSTRAINT chk_veiculo_vinculo
    CHECK (vinculo IS NULL OR vinculo IN ('PROPRIO', 'PATRIMONIO', 'LOCADO'));

-- Fica NULL nos veiculos ja cadastrados, de proposito: ninguem sabe hoje
-- quais sao locados, e chutar 'PATRIMONIO' para todos criaria um dado errado
-- com cara de certo. A tela mostra "-" enquanto a informacao nao chegar.
COMMIT;
