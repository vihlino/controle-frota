-- ============================================================
-- SITRA - o banco passa a aceitar as frequencias que a tela oferece
-- Aplicar depois do 020_corrigir_odometro.sql.
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================
BEGIN;

-- A TELA OFERECIA CINCO OPCOES; O BANCO ACEITAVA DUAS
--
-- A tela de inspecao (e a de agendamento) sempre listaram Semanal,
-- Quinzenal, Mensal, Personalizada e Sem periodicidade. A coluna, desde a
-- primeira versao, so aceitava 'SEMANAL' e 'MENSAL'.
--
-- Resultado: escolher qualquer uma das outras tres gravava o pedido, o banco
-- recusava pela restricao e a pessoa levava um erro tecnico - sobre uma opcao
-- que o proprio sistema colocou na lista dela. Nao e a tela que esta errada:
-- inspecao sem periodicidade (a avulsa, feita por demanda) e justamente o caso
-- mais comum fora da rotina programada.
ALTER TABLE inspecao DROP CONSTRAINT IF EXISTS chk_inspecao_tipo;
ALTER TABLE inspecao
    ADD CONSTRAINT chk_inspecao_tipo
    CHECK (tipo IN ('SEMANAL', 'QUINZENAL', 'MENSAL',
                    'PERSONALIZADA', 'SEM_PERIODICIDADE'));

-- A tabela de CONFIGURACAO da inspecao programada e outra coisa: ela define o
-- calendario automatico, e "sem periodicidade" nao tem calendario. Aqui entra
-- so a quinzenal, que e periodica de verdade; personalizada e sem
-- periodicidade continuam de fora, porque nao ha dia para agendar.
ALTER TABLE configuracao_inspecao DROP CONSTRAINT IF EXISTS chk_config_inspecao_tipo;
ALTER TABLE configuracao_inspecao
    ADD CONSTRAINT chk_config_inspecao_tipo
    CHECK (tipo IN ('SEMANAL', 'QUINZENAL', 'MENSAL'));

-- A regra do dia acompanha: a quinzenal marca dia da semana, como a semanal.
ALTER TABLE configuracao_inspecao DROP CONSTRAINT IF EXISTS chk_config_inspecao_dia_semana;
ALTER TABLE configuracao_inspecao
    ADD CONSTRAINT chk_config_inspecao_dia_semana
    CHECK (
        (tipo IN ('SEMANAL', 'QUINZENAL') AND dia_semana BETWEEN 0 AND 6 AND dia_mes IS NULL)
        OR
        (tipo = 'MENSAL' AND dia_mes BETWEEN 1 AND 31 AND dia_semana IS NULL)
    );

COMMIT;
