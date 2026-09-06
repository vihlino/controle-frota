-- ============================================================
-- SITRA - a cor do veiculo deixa de ser obrigatoria
-- Aplicar depois do 011_chamado_checklist.sql.
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================
BEGIN;

-- A tela sempre disse "Cor (opcional)", mas a coluna era NOT NULL: quem
-- deixava em branco recebia um erro do banco no meio do cadastro, sem
-- entender por que - o campo dizia que podia ficar vazio.
--
-- Cor nao identifica veiculo (placa, renavam e chassi fazem isso) e nao entra
-- em regra nenhuma do sistema. Quem souber preenche; quem nao souber cadastra
-- assim mesmo e completa depois.
ALTER TABLE veiculo ALTER COLUMN cor DROP NOT NULL;

COMMIT;
