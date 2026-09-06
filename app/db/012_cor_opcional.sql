-- ============================================================
-- SITRA - a cor do veiculo passa a ser opcional de verdade
-- Aplicar depois do 011_chamado_checklist.sql.
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================
BEGIN;

-- A tela sempre ofereceu "Cor (opcional)" e a API deixou de exigi-la, mas a
-- COLUNA continuava NOT NULL: quem salvava um veiculo sem cor levava o erro
-- cru do Postgres, sem entender o que faltava - o campo dizia que era
-- opcional. Ou tudo e opcional, ou nada e; aqui o certo e a coluna ceder,
-- porque cor nao identifica veiculo nenhum (a placa faz isso) e o cadastro
-- nao pode travar por causa dela.
ALTER TABLE veiculo ALTER COLUMN cor DROP NOT NULL;

COMMIT;
