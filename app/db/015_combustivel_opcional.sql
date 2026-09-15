-- ============================================================
-- SITRA - o combustivel do veiculo deixa de ser obrigatorio
-- Aplicar depois do 014_cargos_e_viatura.sql.
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================
BEGIN;

-- Esta e a irma da 012_veiculo_cor_opcional.sql, que resolveu o mesmo problema
-- so para a cor.
--
-- A tela de veiculo diz "Combustivel (opcional)", mas a coluna era NOT NULL e
-- a API ainda exigia o campo: cadastrar sem informar devolvia
-- "Preencha: tipo_combustivel" - uma mensagem sobre um campo que a propria
-- tela chama de opcional. Apareceu ao testar o campo novo "E viatura?", com um
-- veiculo preenchido como qualquer pessoa preencheria.
--
-- Como na cor, a decisao e alinhar o banco a tela: nem todo veiculo chega ao
-- cadastro com essa informacao a mao, e obrigar leva a inventar valor - pior
-- do que campo vazio, porque parece dado.
ALTER TABLE veiculo ALTER COLUMN tipo_combustivel DROP NOT NULL;

-- Texto em branco e "nao informado" escrito de outro jeito. Guardar os dois
-- faz a mesma pergunta ter duas respostas diferentes no banco.
UPDATE veiculo SET tipo_combustivel = NULL WHERE btrim(tipo_combustivel) = '';
UPDATE veiculo SET cor              = NULL WHERE btrim(cor) = '';

COMMIT;
