-- ============================================================
-- SITRA - registra a confirmacao de senha na auditoria de acesso
-- Aplicar depois do 007_fuso_horario.sql.
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================
BEGIN;

-- Acoes que alteram ou apagam cadastro passam a pedir a senha de quem esta
-- logado (POST /api/sessao/confirmar). A tentativa que FALHA precisa ficar
-- registrada: varias seguidas indicam alguem tentando agir numa sessao que
-- nao e sua - numa sala compartilhada isso acontece.
--
-- Sem este ajuste o INSERT quebraria no CHECK e o registro se perderia em
-- silencio, porque a gravacao do log e protegida por try/catch para nunca
-- derrubar a operacao principal.
ALTER TABLE log_acesso DROP CONSTRAINT IF EXISTS chk_log_acesso_evento;
ALTER TABLE log_acesso
    ADD CONSTRAINT chk_log_acesso_evento
    CHECK (
        tipo_evento IN (
            'LOGIN',
            'LOGOUT',
            'FALHA_LOGIN',
            'RECUPERACAO_SENHA',
            'ALTERACAO_SENHA',
            'SESSAO_EXPIRADA',
            'CONFIRMACAO_SENHA'
        )
    );

COMMIT;
