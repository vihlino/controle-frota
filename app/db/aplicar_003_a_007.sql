-- ============================================================================
-- SITRA - migracoes 003 a 007, em um arquivo so
-- ============================================================================
--
-- COMO RODAR
--
--   psql "<sua string de conexao>" -f aplicar_003_a_007.sql
--
--   ou, com o banco em Docker:
--     docker cp aplicar_003_a_007.sql sitra-postgres:/tmp/m.sql
--     docker exec sitra-postgres psql -U sitra -d sitra -f /tmp/m.sql
--
-- O QUE ESPERAR
--
--   Tudo roda numa transacao unica: ou as quatro migracoes entram, ou
--   nenhuma entra. Se algo falhar no meio, o banco volta ao estado anterior
--   e nenhuma mudanca fica pela metade.
--
--   Tudo e idempotente (IF NOT EXISTS, DROP CONSTRAINT IF EXISTS). Rodar de
--   novo nao quebra nem duplica nada.
--
-- PRE-REQUISITO
--
--   O 001_sitra_v1.sql e o 002_sitra_telas.sql ja devem estar aplicados.
--
-- O QUE MUDA
--
--   003  observacoes_chegada no checklist; equipamento passa a registrar o
--        momento (SAIDA/CHEGADA), o que antes era impossivel pela chave
--        primaria.
--   004  criado_em no checklist (o instante do ENVIO, que faltava) e a
--        tabela de fotos.
--   005  datas da CNH no servidor; telefone, email e cargo deixam de ser
--        obrigatorios.
--   006  coluna `condutor`, marcando quem dirige.
--   007  fuso horario do banco em America/Sao_Paulo.
--
-- ============================================================================

BEGIN;

-- ==========================================================================
-- 003_checklist_qr.sql  |  Checklist do QR Code: saida e chegada separadas
-- ==========================================================================
-- 1. OBSERVACOES SEPARADAS
-- Havia uma coluna `observacoes` so. Como a chegada gravava por cima, a
-- observacao da saida se perdia. Agora cada momento tem a sua.
ALTER TABLE checklist_frotas
    ADD COLUMN IF NOT EXISTS observacoes_chegada TEXT;

COMMENT ON COLUMN checklist_frotas.observacoes IS
    'Observacoes da SAIDA. As da chegada ficam em observacoes_chegada.';

-- 2. EQUIPAMENTO CONFERIDO NOS DOIS MOMENTOS
-- A chave primaria era (id_checklist, equipamento), entao so cabia UMA
-- conferencia por checklist. O condutor confere na saida e de novo na
-- chegada, e as duas precisam ficar registradas: e assim que se sabe se um
-- item sumiu durante o uso.
ALTER TABLE checklist_frotas_equipamento
    ADD COLUMN IF NOT EXISTS momento VARCHAR(10) NOT NULL DEFAULT 'SAIDA';

ALTER TABLE checklist_frotas_equipamento
    DROP CONSTRAINT IF EXISTS chk_checklist_frotas_equipamento_momento;
ALTER TABLE checklist_frotas_equipamento
    ADD CONSTRAINT chk_checklist_frotas_equipamento_momento
    CHECK (momento IN ('SAIDA', 'CHEGADA'));

-- Troca a chave primaria para incluir o momento.
ALTER TABLE checklist_frotas_equipamento
    DROP CONSTRAINT IF EXISTS checklist_frotas_equipamento_pkey;
ALTER TABLE checklist_frotas_equipamento
    ADD CONSTRAINT checklist_frotas_equipamento_pkey
    PRIMARY KEY (id_checklist, equipamento, momento);

-- ==========================================================================
-- 004_fotos_e_registro.sql  |  Fotos do checklist e carimbo de tempo do envio
-- ==========================================================================
-- ------------------------------------------------------------
-- 1. QUANDO O REGISTRO FOI ENVIADO (nao quando o condutor diz que saiu)
-- ------------------------------------------------------------
-- O banco ja guardava:
--   data_abertura / hora_saida    o que o condutor DECLARA como saida
--   data_devolucao / hora_chegada o que o condutor DECLARA como chegada
--   data_finalizacao              o instante em que a chegada foi enviada
--
-- Faltava o par da saida: o instante em que a saida foi enviada. Sem ele nao
-- da para saber se o checklist foi preenchido na hora ou horas depois - que e
-- justamente o que se quer fiscalizar.
ALTER TABLE checklist_frotas
    ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

COMMENT ON COLUMN checklist_frotas.criado_em IS
    'Instante em que a SAIDA foi enviada. Comparar com data_abertura+hora_saida mostra atraso no preenchimento.';
COMMENT ON COLUMN checklist_frotas.data_finalizacao IS
    'Instante em que a CHEGADA foi enviada. Comparar com data_devolucao+hora_chegada mostra atraso no fechamento.';

-- Registros antigos nao tem esse instante. Usar a data/hora declarada e a
-- melhor aproximacao disponivel - e deixa claro que nao houve atraso medido.
UPDATE checklist_frotas
   SET criado_em = (data_abertura + hora_saida)
 WHERE criado_em IS NULL
    OR criado_em > (data_abertura + hora_saida) + INTERVAL '1 day';

-- ------------------------------------------------------------
-- 2. FOTOS
-- ------------------------------------------------------------
-- O binario fica no proprio Postgres, e nao em disco. Motivo: o servico da
-- API no Render usa disco efemero - arquivo gravado ali some no proximo
-- deploy. O banco tem persistencia e backup.
--
-- Para o peso nao virar problema, o navegador reduz a imagem antes de enviar
-- (lado maior 1600px, JPEG). Uma foto de celular sai de ~4 MB para ~300 KB.
CREATE TABLE IF NOT EXISTS checklist_frotas_foto (
    id_foto BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_checklist BIGINT NOT NULL,
    momento VARCHAR(10) NOT NULL,
    tipo VARCHAR(60) NOT NULL,
    bytes INT NOT NULL,
    conteudo BYTEA NOT NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_checklist_foto_checklist
        FOREIGN KEY (id_checklist)
        REFERENCES checklist_frotas (id_checklist)
        ON DELETE CASCADE,

    CONSTRAINT chk_checklist_foto_momento
        CHECK (momento IN ('SAIDA', 'CHEGADA')),

    -- 3 MB por foto ja e folgado para uma imagem reduzida. O limite existe
    -- para um envio malformado nao encher o banco.
    CONSTRAINT chk_checklist_foto_bytes
        CHECK (bytes > 0 AND bytes <= 3145728)
);

CREATE INDEX IF NOT EXISTS idx_checklist_foto_checklist
    ON checklist_frotas_foto (id_checklist, momento);

-- ==========================================================================
-- 005_servidor_cnh.sql  |  CNH do servidor e campos opcionais
-- ==========================================================================
-- ------------------------------------------------------------
-- 1. DATAS DA CNH
-- ------------------------------------------------------------
-- A tabela tinha `cnh` e `categoria_cnh`, mas nenhuma data. Sem a validade
-- nao ha como avisar o gestor que a habilitacao de um condutor esta vencendo
-- - e um condutor com CNH vencida dirigindo veiculo publico e problema serio.
ALTER TABLE servidor ADD COLUMN IF NOT EXISTS cnh_data_emissao  DATE;
ALTER TABLE servidor ADD COLUMN IF NOT EXISTS cnh_data_validade DATE;

ALTER TABLE servidor DROP CONSTRAINT IF EXISTS chk_servidor_cnh_datas;
ALTER TABLE servidor
    ADD CONSTRAINT chk_servidor_cnh_datas
    CHECK (
        cnh_data_emissao IS NULL
        OR cnh_data_validade IS NULL
        OR cnh_data_validade >= cnh_data_emissao
    );

-- O alerta consulta por validade; sem indice isso varre a tabela inteira.
CREATE INDEX IF NOT EXISTS idx_servidor_cnh_validade
    ON servidor (cnh_data_validade)
    WHERE cnh_data_validade IS NOT NULL;

-- ------------------------------------------------------------
-- 2. CAMPOS QUE DEIXAM DE SER OBRIGATORIOS
-- ------------------------------------------------------------
-- telefone, email e cargo_funcao eram NOT NULL. Na pratica nem todo servidor
-- tem e-mail corporativo, e exigir isso obriga quem cadastra a inventar um
-- valor - o que suja a base com dados falsos.
ALTER TABLE servidor ALTER COLUMN telefone      DROP NOT NULL;
ALTER TABLE servidor ALTER COLUMN email         DROP NOT NULL;
ALTER TABLE servidor ALTER COLUMN cargo_funcao  DROP NOT NULL;

-- Cadastros antigos que receberam texto vazio para satisfazer o NOT NULL
-- passam a ser nulos de verdade: "nao informado" e diferente de "vazio".
UPDATE servidor SET telefone     = NULL WHERE btrim(telefone) = '';
UPDATE servidor SET email        = NULL WHERE btrim(email) = '';
UPDATE servidor SET cargo_funcao = NULL WHERE btrim(cargo_funcao) = '';

-- ==========================================================================
-- 006_servidor_condutor.sql  |  Marca quem e condutor
-- ==========================================================================
-- A mesma tabela guarda o motorista e o auxiliar administrativo. Sem esta
-- marca nao dava para (a) exigir CNH so de quem dirige, nem (b) fazer a tela
-- "Motoristas" mostrar motoristas - ela repetia a lista inteira de servidores.
ALTER TABLE servidor
    ADD COLUMN IF NOT EXISTS condutor BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN servidor.condutor IS
    'TRUE quando a pessoa dirige veiculo da frota. Quem e condutor precisa de CNH com validade.';

-- Quem ja tem CNH cadastrada e condutor: e a unica razao de alguem ter
-- registrado a habilitacao dessa pessoa.
UPDATE servidor SET condutor = TRUE
 WHERE condutor = FALSE AND cnh IS NOT NULL AND btrim(cnh) <> '';

CREATE INDEX IF NOT EXISTS idx_servidor_condutor
    ON servidor (condutor) WHERE condutor = TRUE;

-- ==========================================================================
-- 007_fuso_horario.sql  |  Fuso horario do banco
-- ==========================================================================
-- O Postgres do Render roda em UTC. A API ja manda `SET TIME ZONE` em cada
-- conexao (ver api/src/db.js), mas isso so vale para a API.
--
-- Este ajuste e a rede de seguranca: vale para QUALQUER conexao - psql, um
-- cliente grafico, uma rotina de backup, um relatorio puxado direto do banco.
-- Sem ele, o mesmo registro apareceria com horas diferentes conforme a
-- ferramenta usada, que e o tipo de divergencia dificil de rastrear depois.
--
-- current_database() em vez do nome fixo: o banco se chama "sitra" no Docker
-- local, mas o Render gera outro nome.
DO $$
BEGIN
    EXECUTE format(
        'ALTER DATABASE %I SET timezone TO %L',
        current_database(),
        'America/Sao_Paulo'
    );
END
$$;


-- Vale a partir da PROXIMA conexao: ALTER DATABASE nao muda a sessao atual.
-- Para conferir, reconecte e rode:
--     SHOW timezone;              -> America/Sao_Paulo
--     SELECT CURRENT_TIMESTAMP;   -> horario de Brasilia

COMMIT;

-- ============================================================================
-- CONFERENCIA
-- ----------------------------------------------------------------------------
-- Rode isto depois. As sete linhas devem aparecer com "OK".
-- ============================================================================
SELECT 'checklist_frotas.observacoes_chegada' AS item,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name = 'checklist_frotas'
                            AND column_name = 'observacoes_chegada')
            THEN 'OK' ELSE 'FALTOU' END AS situacao
UNION ALL SELECT 'checklist_frotas.criado_em',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name = 'checklist_frotas'
                            AND column_name = 'criado_em')
            THEN 'OK' ELSE 'FALTOU' END
UNION ALL SELECT 'checklist_frotas_equipamento.momento',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name = 'checklist_frotas_equipamento'
                            AND column_name = 'momento')
            THEN 'OK' ELSE 'FALTOU' END
UNION ALL SELECT 'tabela checklist_frotas_foto',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables
                          WHERE table_name = 'checklist_frotas_foto')
            THEN 'OK' ELSE 'FALTOU' END
UNION ALL SELECT 'servidor.cnh_data_validade',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name = 'servidor'
                            AND column_name = 'cnh_data_validade')
            THEN 'OK' ELSE 'FALTOU' END
UNION ALL SELECT 'servidor.condutor',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name = 'servidor'
                            AND column_name = 'condutor')
            THEN 'OK' ELSE 'FALTOU' END
UNION ALL SELECT 'servidor.email aceita nulo',
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name = 'servidor'
                            AND column_name = 'email'
                            AND is_nullable = 'YES')
            THEN 'OK' ELSE 'FALTOU' END;
