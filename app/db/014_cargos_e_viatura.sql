-- ============================================================
-- SITRA - viatura no cadastro do veiculo e cargos como cadastro
-- Aplicar depois do 013_atestar_relatorio.sql.
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================
BEGIN;

-- ------------------------------------------------------------
-- 0. COMPARAR TEXTO SEM DEPENDER DE ACENTO E MAIUSCULA
-- ------------------------------------------------------------
-- Precisamos reconhecer "Fiscalizacao", "Fiscalização" e "FISCALIZAÇÃO" como a
-- mesma palavra. A extensao unaccent do Postgres faria isso, mas instalar
-- extensao exige superusuario - e o SITRA vai rodar num servidor da CMTT, onde
-- o banco pode nao ser nosso para instalar nada. translate() resolve com o que
-- ja existe em qualquer Postgres.
CREATE OR REPLACE FUNCTION unaccent_simples(texto TEXT) RETURNS TEXT AS $$
    SELECT upper(translate(
        btrim(coalesce($1, '')),
        'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
    ));
$$ LANGUAGE sql IMMUTABLE;

-- ------------------------------------------------------------
-- 1. QUEM E VIATURA
-- ------------------------------------------------------------
-- Ate aqui, "viatura da fiscalizacao" era deducao: o sistema mostrava para a
-- Fiscalizacao todo veiculo lotado no setor Fiscalizacao. Lotacao e viatura,
-- porem, sao coisas diferentes - um carro pode estar lotado no setor sem ser
-- viatura, e uma viatura pode estar lotada em outro lugar. Agora e uma
-- resposta explicita de quem cadastra.
-- O ajuste inicial roda UMA VEZ SO, no momento em que a coluna nasce.
--
-- Isto nao e detalhe: o SITRA reaplica todas as migracoes a cada vez que a API
-- sobe. Uma marcacao solta aqui fora remarcaria, a cada reinicio, todo veiculo
-- do setor Fiscalizacao como viatura - desfazendo em silencio o "Nao" que
-- alguem tivesse escolhido no cadastro. Foi exatamente o que aconteceu no
-- teste: um veiculo cadastrado como "Nao e viatura" voltou marcado depois de
-- reiniciar a API.
DO $$
DECLARE
    ja_existia BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_name = 'veiculo' AND column_name = 'viatura'
    ) INTO ja_existia;

    IF NOT ja_existia THEN
        ALTER TABLE veiculo
            ADD COLUMN viatura BOOLEAN NOT NULL DEFAULT FALSE;

        -- Os veiculos que ATE ENTAO apareciam para a Fiscalizacao (os do setor
        -- Fiscalizacao) ja nascem marcados. Sem isto, a tela de Viaturas
        -- amanheceria vazia no dia da mudanca e alguem teria de remarcar tudo
        -- na mao.
        UPDATE veiculo v
           SET viatura = TRUE
          FROM setor s
         WHERE s.id_setor = v.id_setor
           AND unaccent_simples(s.nome) LIKE '%FISCALIZACAO%';
    END IF;
END
$$;

COMMENT ON COLUMN veiculo.viatura IS
    'Se TRUE, o veiculo aparece para os usuarios da Fiscalizacao.';

-- ------------------------------------------------------------
-- 2. CARGOS VIRAM CADASTRO
-- ------------------------------------------------------------
-- cargo_funcao era texto livre. Isso produz "Motorista", "motorista" e
-- "MOTORISTA" como se fossem cargos diferentes, e impede qualquer regra que
-- dependa do cargo - inclusive a que a Fiscalizacao precisa.
--
-- id_setor NULO E DE PROPOSITO, e e o ponto principal desta tabela:
--
--   id_setor = NULL  ->  o cargo serve a QUALQUER setor. E o caso da maioria:
--                        gestor, assistente, motorista existem em varios
--                        setores ao mesmo tempo.
--   id_setor = X     ->  o cargo so existe naquele setor. E o caso de Fiscal
--                        de Transito, que so faz sentido na Fiscalizacao.
--
-- Uma lista unica com essa marca resolve os dois casos sem obrigar a cadastrar
-- "assistente" uma vez para cada setor da prefeitura.
CREATE TABLE IF NOT EXISTS cargo (
    id_cargo BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    id_setor BIGINT,
    descricao TEXT,
    status BOOLEAN NOT NULL DEFAULT TRUE,
    data_criacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_cargo_setor
        FOREIGN KEY (id_setor)
        REFERENCES setor (id_setor)
);

COMMENT ON COLUMN cargo.id_setor IS
    'NULL = cargo vale para todos os setores. Preenchido = exclusivo daquele setor.';

-- Nome repetido no mesmo escopo nao entra. Sao dois indices porque, em SQL,
-- NULL nunca e igual a NULL: um UNIQUE (nome, id_setor) deixaria cadastrar
-- "Assistente" global quantas vezes se quisesse.
--
-- A comparacao ignora acento e maiuscula. Sem isso, "Fiscal de Transito" e
-- "Fiscal de Trânsito" entrariam como dois cargos diferentes - exatamente a
-- bagunca que esta tabela existe para acabar. (Foi o que aconteceu no teste
-- desta migracao antes desta correcao.)
CREATE UNIQUE INDEX IF NOT EXISTS ux_cargo_nome_setor
    ON cargo (unaccent_simples(nome), id_setor)
 WHERE id_setor IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_cargo_nome_global
    ON cargo (unaccent_simples(nome))
 WHERE id_setor IS NULL;

ALTER TABLE servidor
    ADD COLUMN IF NOT EXISTS id_cargo BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_servidor_cargo'
    ) THEN
        ALTER TABLE servidor
            ADD CONSTRAINT fk_servidor_cargo
            FOREIGN KEY (id_cargo) REFERENCES cargo (id_cargo);
    END IF;
END
$$;

-- ------------------------------------------------------------
-- 3. O QUE JA ESTAVA DIGITADO VIRA CARGO
-- ------------------------------------------------------------
-- Tambem roda UMA VEZ SO, e pelo mesmo motivo da secao 1: as migracoes sao
-- reaplicadas a cada subida da API. Solto aqui fora, este trecho voltaria a
-- ligar ao cargo antigo, todo reinicio, o servidor de quem alguem tivesse
-- APAGADO o cargo de proposito - porque a coluna de texto continua guardando o
-- valor anterior. A marca de "ja fiz isso" e a existencia de qualquer cargo
-- cadastrado: se ha cargo, a conversao ja aconteceu.
--
-- Cada texto distinto ja gravado vira um cargo GLOBAL (id_setor NULL). Global,
-- e nao preso ao setor onde aparece, por um motivo pratico: se hoje so um
-- servidor do Transporte esta como "Assistente", prender o cargo ao Transporte
-- impediria cadastrar um assistente na Fiscalizacao amanha - uma restricao que
-- ninguem pediu, nascida de uma coincidencia dos dados.
--
-- O agrupamento ignora acento e maiuscula: "Motorista", "motorista " e
-- "MOTORISTA" viram UM cargo so, que e justamente a bagunca que o texto livre
-- criou.
--
-- QUAL GRAFIA SOBREVIVE. Agrupar e facil; escolher como o cargo passa a se
-- chamar e que exige criterio. A regra, em ordem:
--   1. a grafia usada por mais servidores - e a que a equipe de fato adotou;
--   2. no empate, a que tem maiuscula E minuscula, porque "Motorista" e nome
--      proprio de cargo e "MOTORISTA" e so alguem com o Caps Lock ligado;
--   3. no empate restante, a que tem acento, que e a escrita correta.
-- Sem isso o teste desta migracao devolveu "MOTORISTA" como nome oficial.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cargo) THEN
        RETURN;  -- ja convertido numa execucao anterior
    END IF;

    WITH grafias AS (
        SELECT unaccent_simples(s.cargo_funcao) AS chave,
               btrim(s.cargo_funcao) AS grafia,
               COUNT(*) AS quantos
          FROM servidor s
         WHERE s.cargo_funcao IS NOT NULL
           AND btrim(s.cargo_funcao) <> ''
         GROUP BY 1, 2
    ), melhor AS (
        SELECT DISTINCT ON (chave) chave, grafia
          FROM grafias
         ORDER BY chave,
                  quantos DESC,
                  (grafia <> upper(grafia) AND grafia <> lower(grafia)) DESC,
                  (grafia <> unaccent_simples(grafia)) DESC,
                  grafia
    )
    INSERT INTO cargo (nome, id_setor)
    SELECT m.grafia, NULL FROM melhor m;

    -- Liga cada servidor ao seu cargo. Quando existe um cargo com aquele nome
    -- preso ao setor DELE, esse tem preferencia sobre o global de mesmo nome.
    UPDATE servidor s
       SET id_cargo = (
           SELECT c.id_cargo
             FROM cargo c
            WHERE unaccent_simples(c.nome) = unaccent_simples(s.cargo_funcao)
              AND (c.id_setor IS NULL OR c.id_setor = s.id_setor)
            ORDER BY (c.id_setor IS NOT NULL) DESC
            LIMIT 1
       )
     WHERE s.id_cargo IS NULL
       AND s.cargo_funcao IS NOT NULL
       AND btrim(s.cargo_funcao) <> '';

    -- A unica excecao combinada: Fiscal de Transito e cargo exclusivo da
    -- Fiscalizacao. Se ele ja existia como texto, passa a ser preso ao setor.
    UPDATE cargo c
       SET id_setor = s.id_setor
      FROM setor s
     WHERE c.id_setor IS NULL
       AND unaccent_simples(c.nome) = 'FISCAL DE TRANSITO'
       AND unaccent_simples(s.nome) LIKE '%FISCALIZACAO%';
END
$$;

-- ------------------------------------------------------------
-- 4. cargo_funcao CONTINUA VALENDO, MAS DEIXA DE SER DIGITADO
-- ------------------------------------------------------------
-- A coluna nao sai: ela aparece em vw_perfil_usuario, nos relatorios de rota,
-- na lista de usuarios e no topo da tela - oito lugares que nao precisam saber
-- que o cargo virou tabela. Ela passa a ser ESPELHO de cargo.nome, mantido
-- pelo banco.
--
-- O espelho e feito por gatilho, e nao pela API, porque assim vale para
-- qualquer caminho que escreva na tabela: a tela, uma carga futura, uma
-- correcao feita a mao no psql. Nao existe como as duas colunas discordarem.
CREATE OR REPLACE FUNCTION sitra_espelhar_cargo() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.id_cargo IS NULL THEN
        -- Servidor sem cargo escolhido: mantem o texto antigo, se houver.
        RETURN NEW;
    END IF;
    SELECT btrim(nome) INTO NEW.cargo_funcao FROM cargo WHERE id_cargo = NEW.id_cargo;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_servidor_espelhar_cargo ON servidor;
CREATE TRIGGER trg_servidor_espelhar_cargo
    BEFORE INSERT OR UPDATE OF id_cargo ON servidor
    FOR EACH ROW EXECUTE FUNCTION sitra_espelhar_cargo();

-- Renomear o cargo tem de alcancar quem ja esta com ele.
CREATE OR REPLACE FUNCTION sitra_renomear_cargo() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.nome IS DISTINCT FROM OLD.nome THEN
        UPDATE servidor SET cargo_funcao = btrim(NEW.nome) WHERE id_cargo = NEW.id_cargo;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cargo_renomear ON cargo;
CREATE TRIGGER trg_cargo_renomear
    AFTER UPDATE OF nome ON cargo
    FOR EACH ROW EXECUTE FUNCTION sitra_renomear_cargo();

-- Os vinculos da secao 3 foram feitos ANTES de o gatilho existir, entao quem
-- estava escrito "MOTORISTA" continuaria assim no espelho. Um acerto final
-- deixa as duas colunas iguais desde o primeiro dia.
UPDATE servidor s
   SET cargo_funcao = btrim(c.nome)
  FROM cargo c
 WHERE c.id_cargo = s.id_cargo
   AND s.cargo_funcao IS DISTINCT FROM btrim(c.nome);

COMMIT;
