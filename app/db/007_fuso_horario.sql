-- ============================================================
-- SITRA - fuso horario do banco
-- Aplicar depois do 006_servidor_condutor.sql.
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================
BEGIN;

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

COMMIT;

-- Vale a partir da PROXIMA conexao: ALTER DATABASE nao muda a sessao atual.
-- Para conferir, reconecte e rode:
--     SHOW timezone;              -> America/Sao_Paulo
--     SELECT CURRENT_TIMESTAMP;   -> horario de Brasilia
