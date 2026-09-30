-- ============================================================
-- 025 - O grupo de cada item da inspecao
-- ============================================================
--
-- A lista de itens da inspecao passou a ser AGRUPADA e a variar por frequencia:
-- a semanal confere 14 itens em 4 grupos, a mensal 21 em 6 (ver
-- web/src/lib/itensInspecao.js).
--
-- O grupo e gravado junto do item, e nao deduzido na hora de mostrar, por um
-- motivo simples: a lista vai mudar. Quando a CMTT acrescentar ou tirar um
-- item, a ficha de uma inspecao de 2026 tem de continuar contando o que foi
-- conferido DAQUELE jeito. Deduzir o grupo por uma tabela de hoje reescreveria
-- o passado a cada mudanca de lista.
--
-- Fica NULO para as inspecoes antigas, feitas com a lista unica sem grupo - e
-- isso e a informacao correta sobre elas, nao um dado faltando.
ALTER TABLE inspecao_item ADD COLUMN IF NOT EXISTS grupo VARCHAR(60);

COMMENT ON COLUMN inspecao_item.grupo IS
    'Secao da lista de inspecao ("Pneus e rodas"). Nulo nas inspecoes feitas antes de a lista ser agrupada.';
