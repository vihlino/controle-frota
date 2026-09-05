-- ============================================================
-- SITRA - permite invalidar uma sessao antes do prazo do token
-- Aplicar depois do 010_frotas_gerencia_servidores.sql.
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================
BEGIN;

-- O TOKEN SOBREVIVIA A DESATIVACAO DO USUARIO
--
-- O SITRA usa JWT: o servidor nao guarda sessao, so confere a assinatura do
-- token. A consequencia e que um token emitido vale ate expirar, e o prazo e
-- de 8 horas. Um servidor demitido as 9h da manha continuava entrando no
-- sistema ate as 17h, mesmo depois de desativado no cadastro. O mesmo valia
-- para troca de senha: quem tivesse copiado o token seguia dentro.
--
-- Esta coluna registra QUANDO a senha mudou. A autenticacao passa a recusar
-- token emitido antes dessa data - trocar a senha derruba as sessoes abertas,
-- que e o que qualquer pessoa espera ao trocar a senha por suspeita.
ALTER TABLE usuario
    ADD COLUMN IF NOT EXISTS senha_alterada_em TIMESTAMP;

-- Os usuarios que ja existem nao tem data de troca: ficam em NULL, e NULL
-- significa "nunca trocou, nao ha nada para invalidar". Preencher com a data
-- de hoje derrubaria todo mundo que esta logado agora, sem necessidade.

COMMENT ON COLUMN usuario.senha_alterada_em IS
    'Momento da ultima troca de senha. Token emitido antes disto e recusado.';

COMMIT;
