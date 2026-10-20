-- 042_servico_numero_equipamentos.sql (20/10/2026)
--
-- 1) Codigo do servico diario (pedido do Cesar, 20/10): cada equipe no
--    servico ganha o seu codigo, SD-2026-00001, no mesmo padrao de OS-, INS-
--    e SIN- (cinco digitos). O codigo e da EQUIPE NO SERVICO (servico_equipe),
--    como no desenho: cada linha da lista e um servico com codigo proprio.
--    O ano e o da DATA do servico. Sequencial pelo MAIOR numero ja usado no
--    ano (contando, apagar uma linha repetiria um numero).
ALTER TABLE servico_equipe ADD COLUMN IF NOT EXISTS numero VARCHAR(20);
CREATE UNIQUE INDEX IF NOT EXISTS uq_servico_equipe_numero ON servico_equipe (numero);

CREATE OR REPLACE FUNCTION proximo_numero_servico(p_ano TEXT) RETURNS TEXT AS $$
  SELECT 'SD-' || p_ano || '-' || LPAD(
           (COALESCE(MAX(regexp_replace(numero, '^.*-', '')::int), 0) + 1)::text, 5, '0')
    FROM servico_equipe
   WHERE numero ~ ('^SD-' || p_ano || '-[0-9]+$');
$$ LANGUAGE sql;

-- Os que ja existem ganham codigo na ordem em que aconteceram.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT se.id_servico_equipe, to_char(sd.data, 'YYYY') AS ano
             FROM servico_equipe se
             JOIN servico_diario sd ON sd.id_servico_diario = se.id_servico_diario
             LEFT JOIN equipe eq ON eq.id_equipe = se.id_equipe
            WHERE se.numero IS NULL
            ORDER BY sd.data, CASE sd.turno WHEN 'DIURNO' THEN 0 ELSE 1 END, eq.numero, se.id_servico_equipe LOOP
    UPDATE servico_equipe SET numero = proximo_numero_servico(r.ano)
     WHERE id_servico_equipe = r.id_servico_equipe;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION fn_servico_equipe_numero() RETURNS TRIGGER AS $$
DECLARE
  v_ano TEXT;
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    SELECT to_char(data, 'YYYY') INTO v_ano FROM servico_diario WHERE id_servico_diario = NEW.id_servico_diario;
    NEW.numero := proximo_numero_servico(COALESCE(v_ano, to_char(CURRENT_DATE, 'YYYY')));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_servico_equipe_numero ON servico_equipe;
CREATE TRIGGER trg_servico_equipe_numero BEFORE INSERT ON servico_equipe
  FOR EACH ROW EXECUTE FUNCTION fn_servico_equipe_numero();

-- 2) Itens do checklist da viatura da Fiscalizacao (definidos pelo Cesar,
--    20/10): Radio, Cone, Pantografica, Macaco, Estepe e Chave de roda.
--    "Outros" sai da lista (fica inativo: nao se apaga o que pode ter
--    historico).
INSERT INTO equipamento (nome, descricao, status) VALUES
  ('Macaco', 'Macaco da viatura', TRUE),
  ('Estepe', 'Estepe da viatura', TRUE),
  ('Chave de roda', 'Chave de roda da viatura', TRUE)
ON CONFLICT (nome) DO NOTHING;
UPDATE equipamento SET status = FALSE WHERE nome = 'Outros' AND status;
