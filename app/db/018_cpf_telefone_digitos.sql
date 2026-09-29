-- ============================================================
-- SITRA - CPF e telefone passam a ser guardados so com digitos
-- Aplicar depois do 017_veiculo_vinculo.sql.
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================
BEGIN;

-- A PONTUACAO E DESENHO DE TELA, NAO DADO
--
-- Os cadastros feitos ate aqui guardaram o que a pessoa digitou: um CPF veio
-- "000.000.000-00", outro "00000000000", e um telefone veio "(62) 99274-7830"
-- e outro "62992747830". Isso tem tres consequencias praticas:
--
--   1. a restricao de unicidade do CPF nao impede a mesma pessoa de entrar
--      duas vezes, bastando digitar com e sem pontos;
--   2. a busca por "00000000000" nao acha quem esta gravado com pontos;
--   3. cada tela precisa adivinhar o formato antes de mostrar.
--
-- Tirando a pontuacao, sobra o numero - que e o dado. A tela desenha os pontos
-- e o hifen na hora de mostrar, e o formulario na hora de digitar.
UPDATE servidor
   SET cpf = regexp_replace(cpf, '[^0-9]', '', 'g')
 WHERE cpf ~ '[^0-9]';

UPDATE servidor
   SET telefone = regexp_replace(telefone, '[^0-9]', '', 'g')
 WHERE telefone ~ '[^0-9]';

COMMIT;
