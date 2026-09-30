-- ============================================================================
-- 030 - OS de manutencao: registro completo e fechamento
-- ============================================================================
-- A tela de Manutencoes virou HISTORICO: a gestao nao faz a manutencao, ela
-- registra a OS que foi para a oficina e, quando o servico volta, registra o
-- fechamento. Esta migracao guarda o que as duas janelas pedem e que ate
-- aqui era digitado e jogado fora (telefone da oficina, prazo, pecas, itens).
--
-- `custo` continua sendo o custo REAL (e o que os relatorios e a ficha do
-- veiculo somam); o valor previsto no registro vai para `custo_estimado`.
-- Idempotente, como as demais.

ALTER TABLE ordem_servico
  ADD COLUMN IF NOT EXISTS responsavel_oficina    VARCHAR(150),
  ADD COLUMN IF NOT EXISTS telefone_oficina       VARCHAR(30),
  ADD COLUMN IF NOT EXISTS prazo_previsto         DATE,
  ADD COLUMN IF NOT EXISTS pecas_necessarias      TEXT,
  ADD COLUMN IF NOT EXISTS custo_estimado         DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS data_fechamento        DATE,
  ADD COLUMN IF NOT EXISTS km_fechamento          INT,
  ADD COLUMN IF NOT EXISTS pecas_trocadas         TEXT,
  ADD COLUMN IF NOT EXISTS observacoes_fechamento TEXT,
  ADD COLUMN IF NOT EXISTS fechada_por            BIGINT;

ALTER TABLE ordem_servico DROP CONSTRAINT IF EXISTS fk_os_fechada_por;
ALTER TABLE ordem_servico
  ADD CONSTRAINT fk_os_fechada_por FOREIGN KEY (fechada_por) REFERENCES usuario (id_usuario);

ALTER TABLE ordem_servico DROP CONSTRAINT IF EXISTS chk_os_custo_estimado;
ALTER TABLE ordem_servico
  ADD CONSTRAINT chk_os_custo_estimado CHECK (custo_estimado IS NULL OR custo_estimado >= 0);

ALTER TABLE ordem_servico DROP CONSTRAINT IF EXISTS chk_os_km_fechamento;
ALTER TABLE ordem_servico
  ADD CONSTRAINT chk_os_km_fechamento CHECK (km_fechamento IS NULL OR km_fechamento >= 0);

-- Itens verificados / servicos da OS. O registro lista o que a oficina deve
-- olhar; o fechamento substitui pela lista do que foi feito.
CREATE TABLE IF NOT EXISTS os_item (
  id_os_item BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_os      BIGINT NOT NULL REFERENCES ordem_servico (id_os),
  ordem      INT NOT NULL DEFAULT 0,
  descricao  VARCHAR(200) NOT NULL,
  observacao TEXT
);
CREATE INDEX IF NOT EXISTS idx_os_item_os ON os_item (id_os);

-- O registro e o fechamento guardam cada um a SUA lista: o que a oficina
-- deveria olhar (REGISTRO) e o que foi feito de fato (FECHAMENTO). A ficha
-- da OS mostra as duas, uma em cada aba.
ALTER TABLE os_item ADD COLUMN IF NOT EXISTS momento VARCHAR(12) NOT NULL DEFAULT 'REGISTRO';
ALTER TABLE os_item DROP CONSTRAINT IF EXISTS chk_os_item_momento;
ALTER TABLE os_item
  ADD CONSTRAINT chk_os_item_momento CHECK (momento IN ('REGISTRO', 'FECHAMENTO'));

-- Numero da OS: OS-2026-00001, no mesmo padrao da inspecao (INS-2026-00001).
-- Sequencial do ano pelo MAIOR numero ja usado, e nao pela contagem: contando,
-- apagar uma OS fazia a proxima repetir o numero de outra.
CREATE OR REPLACE FUNCTION proximo_numero_os() RETURNS TEXT AS $$
  SELECT 'OS-' || to_char(CURRENT_DATE, 'YYYY') || '-' || LPAD(
           (COALESCE(MAX(regexp_replace(numero, '^.*-', '')::int), 0) + 1)::text, 5, '0')
    FROM ordem_servico
   WHERE numero ~ ('^OS-' || to_char(CURRENT_DATE, 'YYYY') || '-[0-9]+$');
$$ LANGUAGE sql;

-- Havia dois formatos convivendo: os dados de exemplo em "OS-2026-00031" e
-- as OS abertas pelo sistema (QR Code, inspecao) em "2026-0031". Aqui as do
-- formato antigo ganham numero novo no padrao, DEPOIS do maior ja usado no
-- ano - converter so o texto ("2026-0005" -> "OS-2026-00005") podia repetir
-- o numero de uma OS de exemplo. A decisao gravada na inspecao ("OS 2026-0049
-- aberta para manutencao") acompanha. Idempotente: so pega o formato antigo.
DO $$
DECLARE
  r RECORD;
  ano TEXT;
  novo TEXT;
BEGIN
  FOR r IN SELECT id_os, numero FROM ordem_servico
            WHERE numero ~ '^[0-9]{4}-[0-9]+$' ORDER BY id_os LOOP
    ano := split_part(r.numero, '-', 1);
    SELECT 'OS-' || ano || '-' || LPAD((COALESCE(MAX(regexp_replace(numero, '^.*-', '')::int), 0) + 1)::text, 5, '0')
      INTO novo
      FROM ordem_servico WHERE numero ~ ('^OS-' || ano || '-[0-9]+$');
    UPDATE ordem_servico SET numero = novo WHERE id_os = r.id_os;
    UPDATE inspecao
       SET analise_observacao = replace(analise_observacao, 'OS ' || r.numero, novo)
     WHERE analise_observacao LIKE '%OS ' || r.numero || '%';
  END LOOP;
END $$;

-- Toda OS que entrar sem numero ganha um, venha de onde vier.
CREATE OR REPLACE FUNCTION fn_os_numero() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := proximo_numero_os();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_os_numero ON ordem_servico;
CREATE TRIGGER trg_os_numero BEFORE INSERT ON ordem_servico
  FOR EACH ROW EXECUTE FUNCTION fn_os_numero();

-- Como HISTORICO, a OS pode ser registrada DEPOIS do servico: o carro voltou
-- da oficina semana passada e so hoje alguem lancou. A regra antiga exigia a
-- conclusao depois do instante do registro (data_abertura) - e recusava ate
-- fechar no mesmo dia, porque a data de finalizacao vira meia-noite. Fica so
-- a regra que faz sentido: nao concluir antes de comecar.
ALTER TABLE ordem_servico DROP CONSTRAINT IF EXISTS chk_os_datas;
ALTER TABLE ordem_servico
  ADD CONSTRAINT chk_os_datas CHECK (
    data_inicio IS NULL OR data_conclusao IS NULL
    OR data_conclusao::date >= data_inicio::date
  );

-- KM da OS que nasceu sem ele. O chamado do QR Code e a OS aberta pela
-- inspecao nao gravavam o KM, e a pagina antiga de agendar tambem nao; a ficha
-- mostrava "KM no registro: -". Preenche pela melhor fonte que existe:
-- o odometro do checklist no momento do chamado, o KM da inspecao e, na falta
-- dos dois, o KM atual do veiculo. Idempotente: so toca o que esta vazio.
UPDATE ordem_servico os
   SET quilometragem = CASE WHEN os.momento = 'CHEGADA'
                            THEN COALESCE(c.odometro_chegada, c.odometro_saida)
                            ELSE c.odometro_saida END
  FROM checklist_frotas c
 WHERE os.quilometragem IS NULL
   AND os.origem = 'CHECKLIST_FROTAS'
   AND c.id_checklist = os.id_registro_origem;

UPDATE ordem_servico os
   SET quilometragem = i.quilometragem
  FROM inspecao i
 WHERE os.quilometragem IS NULL
   AND os.origem = 'INSPECAO'
   AND i.id_inspecao = os.id_registro_origem
   AND i.quilometragem IS NOT NULL;

UPDATE ordem_servico os
   SET quilometragem = v.quilometragem_atual
  FROM veiculo v
 WHERE os.quilometragem IS NULL
   AND v.id_veiculo = os.id_veiculo;

-- OS resolvidas antes desta migracao nao tinham os dados do fechamento
-- (data, quem fechou, KM). Preenche com o que ja estava gravado: a data de
-- conclusao, o responsavel da OS e o KM do registro.
UPDATE ordem_servico
   SET data_fechamento = COALESCE(data_conclusao, data_abertura)::date,
       fechada_por     = COALESCE(fechada_por, id_responsavel, id_solicitante),
       km_fechamento   = COALESCE(km_fechamento, quilometragem)
 WHERE status = 'RESOLVIDA'
   AND data_fechamento IS NULL;
