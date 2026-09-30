-- ============================================================
-- 028 - Troca de senha obrigatoria no primeiro acesso
-- ============================================================
--
-- Toda senha que o ADMINISTRADOR define - ao criar o usuario, ou ao trocar a
-- senha de alguem - e conhecida por duas pessoas. Enquanto ela valer, o que
-- for feito com aquele login fica na auditoria em nome de uma pessoa so, sem
-- que se possa dizer qual das duas fez.
--
-- trocar_senha = TRUE marca a senha como provisoria: no proximo acesso o
-- sistema mostra "Voce precisa alterar a sua senha" e nao deixa usar mais
-- nada ate a pessoa criar a propria. A trava de verdade esta na API
-- (auth.js), nao so na tela.
--
-- Quem ja existe fica com FALSE: essas pessoas ja usam o sistema com a senha
-- que tem, e obriga-las a trocar agora seria uma surpresa sem motivo novo. A
-- partir desta migracao, vale para os usuarios criados e as senhas
-- redefinidas daqui em diante.
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS trocar_senha BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN usuario.trocar_senha IS
    'TRUE quando a senha foi definida por outra pessoa (administrador ou instalacao). O dono precisa trocar no proximo acesso.';
