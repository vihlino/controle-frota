-- ============================================================================
-- 031 - Sinistro: danos, providencias e numero automatico
-- ============================================================================
-- A tela de registrar sinistro pedia a parte do veiculo danificada, a
-- gravidade, a descricao dos danos e as providencias tomadas - e a API jogava
-- tudo fora, porque as colunas nao existiam. E o numero (SIN-2026-00001) so
-- existia nos dados de exemplo: sinistro registrado pela tela ficava sem.
-- Idempotente, como as demais.

ALTER TABLE sinistro
  ADD COLUMN IF NOT EXISTS parte_danificada VARCHAR(40),
  ADD COLUMN IF NOT EXISTS gravidade_danos  VARCHAR(20),
  ADD COLUMN IF NOT EXISTS descricao_danos  TEXT,
  ADD COLUMN IF NOT EXISTS providencias     TEXT;

ALTER TABLE sinistro DROP CONSTRAINT IF EXISTS chk_sinistro_gravidade_danos;
ALTER TABLE sinistro
  ADD CONSTRAINT chk_sinistro_gravidade_danos
  CHECK (gravidade_danos IS NULL OR gravidade_danos IN ('LEVE', 'MODERADO', 'GRAVE', 'PERDA_TOTAL'));

-- SIN-2026-00001: sequencial do ano do sinistro, pelo maior numero ja usado.
CREATE OR REPLACE FUNCTION proximo_numero_sinistro(p_ano TEXT) RETURNS TEXT AS $$
  SELECT 'SIN-' || p_ano || '-' || LPAD(
           (COALESCE(MAX(regexp_replace(numero, '^.*-', '')::int), 0) + 1)::text, 5, '0')
    FROM sinistro
   WHERE numero ~ ('^SIN-' || p_ano || '-[0-9]+$');
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION fn_sinistro_numero() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := proximo_numero_sinistro(to_char(COALESCE(NEW.data, CURRENT_DATE), 'YYYY'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sinistro_numero ON sinistro;
CREATE TRIGGER trg_sinistro_numero BEFORE INSERT ON sinistro
  FOR EACH ROW EXECUTE FUNCTION fn_sinistro_numero();

-- Sinistros ja gravados sem numero ganham um, na ordem em que entraram.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id_sinistro, data FROM sinistro
            WHERE numero IS NULL OR numero = '' ORDER BY id_sinistro LOOP
    UPDATE sinistro
       SET numero = proximo_numero_sinistro(to_char(COALESCE(r.data, CURRENT_DATE), 'YYYY'))
     WHERE id_sinistro = r.id_sinistro;
  END LOOP;
END $$;
