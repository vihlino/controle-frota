-- ============================================================
-- SITRA - hora REAL do registro da saida e da chegada nos checklists
-- Aplicar depois do 047_triangulo_viatura.sql.
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================
-- Pedido do Cesar (26/10): nos checklists pelo QR Code (Frotas e
-- Fiscalizacao) o condutor/fiscal pode AJUSTAR o horario de saida e o de
-- chegada, mas o sistema continua gravando sozinho a hora em que o registro
-- foi feito de verdade.
--   hora_saida / hora_chegada                 -> a hora INFORMADA na tela
--   saida_registrada_em / chegada_registrada_em -> o momento REAL do envio,
--                                                gravado pelo servidor
BEGIN;

ALTER TABLE checklist_frotas       ADD COLUMN IF NOT EXISTS saida_registrada_em   TIMESTAMP;
ALTER TABLE checklist_frotas       ADD COLUMN IF NOT EXISTS chegada_registrada_em TIMESTAMP;
ALTER TABLE checklist_fiscalizacao ADD COLUMN IF NOT EXISTS saida_registrada_em   TIMESTAMP;
ALTER TABLE checklist_fiscalizacao ADD COLUMN IF NOT EXISTS chegada_registrada_em TIMESTAMP;

-- Os registros antigos: a melhor informacao que ja existia. O DEFAULT so e
-- ligado DEPOIS, senao o ALTER carimbaria todos os antigos com a hora de hoje.
UPDATE checklist_frotas SET saida_registrada_em = criado_em
 WHERE saida_registrada_em IS NULL AND criado_em IS NOT NULL;
UPDATE checklist_frotas SET chegada_registrada_em = data_finalizacao
 WHERE chegada_registrada_em IS NULL AND data_finalizacao IS NOT NULL;
UPDATE checklist_fiscalizacao SET saida_registrada_em = data_abertura + COALESCE(hora_saida, TIME '00:00')
 WHERE saida_registrada_em IS NULL AND data_abertura IS NOT NULL;
UPDATE checklist_fiscalizacao SET chegada_registrada_em = data_finalizacao
 WHERE chegada_registrada_em IS NULL AND data_finalizacao IS NOT NULL;

-- Daqui em diante toda saida nova ganha a hora real sozinha, por qualquer
-- caminho que o checklist seja criado.
ALTER TABLE checklist_frotas       ALTER COLUMN saida_registrada_em SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE checklist_fiscalizacao ALTER COLUMN saida_registrada_em SET DEFAULT CURRENT_TIMESTAMP;

COMMENT ON COLUMN checklist_frotas.saida_registrada_em IS
    'Momento real em que a saida foi registrada (automatico). hora_saida e a hora informada.';
COMMENT ON COLUMN checklist_frotas.chegada_registrada_em IS
    'Momento real em que a chegada foi registrada (automatico). hora_chegada e a hora informada.';
COMMENT ON COLUMN checklist_fiscalizacao.saida_registrada_em IS
    'Momento real em que a saida foi registrada (automatico). hora_saida e a hora informada.';
COMMENT ON COLUMN checklist_fiscalizacao.chegada_registrada_em IS
    'Momento real em que a chegada foi registrada (automatico). hora_chegada e a hora informada.';

COMMIT;
