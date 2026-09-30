-- ============================================================
-- 029 - A inspecao com ressalva precisa ser ANALISADA
-- ============================================================
--
-- O resultado da inspecao era "Aprovado" ou "Reprovado". Isso dizia o que o
-- condutor marcou, mas nao dizia o que a gestao fez com isso. Uma inspecao
-- "Reprovada" por oleo baixo continuava igual depois de alguem completar o
-- oleo, e uma com pneu careca continuava igual se ninguem olhasse. Para quem
-- gerencia, as duas eram a mesma palavra vermelha na lista.
--
-- Agora o resultado tem tres estados, e o que importa e o do MEIO:
--
--   Aprovado    - nenhum item com ressalva. Nao precisa de ninguem.
--   Em analise  - tem item com Atencao ou Avaria, e NINGUEM olhou ainda.
--                 E isto que a gestao procura: o que esta esperando decisao.
--   Analisado   - alguem da gestao olhou e decidiu: abriu OS de manutencao
--                 ou registrou que nao precisa.
--
-- A analise e registrada com quem e quando, e uma observacao do que foi
-- decidido - para daqui a seis meses dar para saber por que aquele pneu nao
-- virou OS.
--
-- As inspecoes com ressalva que ja existem entram como "Em analise": ninguem
-- as analisou, e e justamente isso que a gestao precisa ver.
ALTER TABLE inspecao ADD COLUMN IF NOT EXISTS analisada_em TIMESTAMP;
ALTER TABLE inspecao ADD COLUMN IF NOT EXISTS analisada_por BIGINT;
ALTER TABLE inspecao ADD COLUMN IF NOT EXISTS analise_observacao TEXT;

ALTER TABLE inspecao DROP CONSTRAINT IF EXISTS fk_inspecao_analisada_por;
ALTER TABLE inspecao
    ADD CONSTRAINT fk_inspecao_analisada_por
    FOREIGN KEY (analisada_por) REFERENCES usuario (id_usuario);

-- ------------------------------------------------------------
-- A regra, num lugar so
-- ------------------------------------------------------------
-- Usada na listagem (coluna e filtro) e na ficha da inspecao. NULL enquanto a
-- inspecao nao foi feita: ainda nao ha resultado para analisar.
CREATE OR REPLACE FUNCTION analise_inspecao(p_status TEXT, p_resultado TEXT, p_analisada_em TIMESTAMP)
RETURNS TEXT AS $$
    SELECT CASE
        WHEN p_status IS DISTINCT FROM 'FINALIZADA' THEN NULL
        WHEN p_resultado = 'CONFORME'               THEN 'APROVADO'
        WHEN p_analisada_em IS NULL                 THEN 'EM_ANALISE'
        ELSE 'ANALISADO'
    END;
$$ LANGUAGE sql IMMUTABLE;
