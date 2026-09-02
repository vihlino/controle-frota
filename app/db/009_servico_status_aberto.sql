-- ============================================================
-- SITRA - a situacao do servico diario passa a comecar em ABERTO
-- Aplicar depois do 008_confirmacao_senha.sql.
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================
BEGIN;

-- A tela sempre gravou 'ABERTO' ao criar um servico diario, mas o CHECK so
-- conhecia 'PLANEJADO' - entao NENHUM servico diario conseguia ser criado:
--
--   new row for relation "servico_diario" violates check constraint
--   "chk_servico_status"
--
-- Entre os dois nomes, 'ABERTO' e o que a fiscalizacao usa: o turno esta
-- aberto e recebendo lancamentos. 'PLANEJADO' descreveria uma escala montada
-- de antemao, que nao e como o servico nasce aqui.

-- ORDEM IMPORTA, e nao e a intuitiva. O DROP vem PRIMEIRO: enquanto a
-- restricao antiga estiver de pe, ela recusa justamente o valor 'ABERTO' para
-- o qual estamos convertendo, e o UPDATE morre no meio da migracao. Sem
-- restricao nenhuma, a conversao passa; a restricao nova entra depois, ja com
-- todas as linhas em valores que ela aceita.
ALTER TABLE servico_diario DROP CONSTRAINT IF EXISTS chk_servico_status;

UPDATE servico_diario SET status = 'ABERTO' WHERE status = 'PLANEJADO';

ALTER TABLE servico_diario
    ADD CONSTRAINT chk_servico_status
    CHECK (status IN ('ABERTO', 'EM_SERVICO', 'ENCERRADO'));

COMMIT;
