-- ============================================================
-- SITRA - viatura passa a ser consequencia do setor, nao pergunta
-- Aplicar depois do 015_combustivel_opcional.sql.
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================
BEGIN;

-- POR QUE A PERGUNTA SAIU DO CADASTRO
--
-- A 014 criou "E viatura?" como campo proprio, respondido a mao. Na tela ficou
-- uma pergunta a mais num formulario ja longo, e uma pergunta cuja resposta o
-- sistema ja sabia: se o veiculo esta vinculado a Fiscalizacao, ele e viatura.
-- Duas informacoes dizendo a mesma coisa e um convite a divergencia - alguem
-- muda o setor e esquece de mudar a marca, e as duas telas passam a discordar.
--
-- A coluna CONTINUA existindo, e de proposito: a tela de Viaturas filtra por
-- ela com um indice simples, em vez de juntar setor e comparar texto a cada
-- consulta. O que muda e quem a preenche - agora e o banco, a partir do setor,
-- e nao mais quem cadastra.

CREATE OR REPLACE FUNCTION sitra_viatura_pelo_setor() RETURNS TRIGGER AS $$
BEGIN
    SELECT unaccent_simples(s.nome) LIKE '%FISCALIZACAO%'
      INTO NEW.viatura
      FROM setor s
     WHERE s.id_setor = NEW.id_setor;

    -- Setor inexistente nao deveria acontecer (ha chave estrangeira), mas
    -- SELECT sem linha deixaria NEW.viatura nulo, e a coluna e NOT NULL.
    NEW.viatura := COALESCE(NEW.viatura, FALSE);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_veiculo_viatura ON veiculo;
CREATE TRIGGER trg_veiculo_viatura
    BEFORE INSERT OR UPDATE OF id_setor ON veiculo
    FOR EACH ROW EXECUTE FUNCTION sitra_viatura_pelo_setor();

-- Renomear o setor tem de alcancar os veiculos dele.
--
-- Nao e hipotese remota: os setores da instalacao estao gravados sem acento
-- ("Fiscalizacao"), e arrumar isso para "Fiscalização" e uma edicao provavel.
-- Sem este gatilho, a marca ficaria congelada no que valia antes da correcao.
CREATE OR REPLACE FUNCTION sitra_setor_renomeado() RETURNS TRIGGER AS $$
BEGIN
    IF unaccent_simples(NEW.nome) IS DISTINCT FROM unaccent_simples(OLD.nome) THEN
        UPDATE veiculo
           SET viatura = (unaccent_simples(NEW.nome) LIKE '%FISCALIZACAO%')
         WHERE id_setor = NEW.id_setor;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_setor_renomeado ON setor;
CREATE TRIGGER trg_setor_renomeado
    AFTER UPDATE OF nome ON setor
    FOR EACH ROW EXECUTE FUNCTION sitra_setor_renomeado();

-- Acerta o que ja esta gravado.
--
-- Diferente das migracoes anteriores, ESTE trecho pode rodar sempre: a coluna
-- deixou de ser uma escolha de quem cadastra e passou a ser calculada, entao
-- nao existe mais decisao humana para preservar aqui. Recalcular a cada
-- reaplicacao so reafirma o que os gatilhos ja garantem.
UPDATE veiculo v
   SET viatura = (unaccent_simples(s.nome) LIKE '%FISCALIZACAO%')
  FROM setor s
 WHERE s.id_setor = v.id_setor
   AND v.viatura IS DISTINCT FROM (unaccent_simples(s.nome) LIKE '%FISCALIZACAO%');

COMMENT ON COLUMN veiculo.viatura IS
    'Calculada pelo banco a partir do setor: TRUE quando o setor e a Fiscalizacao. Nao preencher a mao.';

COMMIT;
