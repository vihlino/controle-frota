-- ============================================================
-- SITRA - "Atenção" passa a contar como item conferido
-- Aplicar depois do 021_inspecao_frequencias.sql.
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================
BEGIN;

-- UM ITEM CONFERIDO QUE O BANCO NAO RECONHECIA
--
-- A primeira versao do sistema tinha dois resultados por item: NORMAL e
-- AVARIA. A migracao 002 acrescentou ATENCAO - o item que nao esta com defeito
-- mas precisa de acompanhamento (pneu gastando, farol fraco). A restricao da
-- tabela foi atualizada; ESTE GATILHO nao.
--
-- Com isso ele contava como "conferido" so os NORMAL e AVARIA, comparava com o
-- total e concluia que faltava item. Quem marcasse um unico "Atenção" na
-- inspecao recebia "A inspeção não pode ser finalizada sem todos os itens
-- registrados" - sobre uma inspecao com todos os itens registrados. A mensagem
-- estava certa para a regra e a regra estava velha.
--
-- O RESULTADO tambem muda: hoje "Atenção" cai em CONFORME, junto de quem nao
-- tem ressalva nenhuma. A inspecao com ressalva nao e igual a inspecao limpa,
-- e a diferenca importa em relatorio; ela passa a valer COM_AVARIAS, que e o
-- que o sistema tem para dizer "esta inspecao tem pendencia".
CREATE OR REPLACE FUNCTION validar_finalizacao_inspecao()
RETURNS TRIGGER AS $$
DECLARE
    total_itens INT;
    itens_completos INT;
    itens_com_ressalva INT;
BEGIN
    IF NEW.status = 'FINALIZADA' THEN

        SELECT COUNT(*)
        INTO total_itens
        FROM inspecao_item
        WHERE id_inspecao = NEW.id_inspecao;

        SELECT COUNT(*)
        INTO itens_completos
        FROM inspecao_item
        WHERE id_inspecao = NEW.id_inspecao
          AND resultado IN ('NORMAL', 'ATENCAO', 'AVARIA');

        SELECT COUNT(*)
        INTO itens_com_ressalva
        FROM inspecao_item
        WHERE id_inspecao = NEW.id_inspecao
          AND resultado IN ('ATENCAO', 'AVARIA');

        IF total_itens = 0 OR total_itens <> itens_completos THEN
            RAISE EXCEPTION
                'A inspeção não pode ser finalizada sem todos os itens registrados.';
        END IF;

        NEW.resultado :=
            CASE
                WHEN itens_com_ressalva > 0 THEN 'COM_AVARIAS'
                ELSE 'CONFORME'
            END;

        IF NEW.data_finalizacao IS NULL THEN
            NEW.data_finalizacao := CURRENT_TIMESTAMP;
        END IF;

        IF NEW.hora_finalizacao IS NULL THEN
            NEW.hora_finalizacao := CURRENT_TIME;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
