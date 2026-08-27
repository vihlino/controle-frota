-- ============================================================
-- SITRA - ajustes de banco exigidos pelas telas do padrao
-- Aplicar depois do 001_sitra_v1.sql do V1.3.
-- Tudo idempotente: pode rodar de novo sem quebrar.
-- ============================================================
BEGIN;

-- 1. CHECKLIST: o mockup e o fluxo do QR Code pedem percurso e local de saida.
ALTER TABLE checklist_frotas ADD COLUMN IF NOT EXISTS percurso VARCHAR(255);
ALTER TABLE checklist_frotas ADD COLUMN IF NOT EXISTS local_saida VARCHAR(255);

-- 2. INSPECAO: local, numero da inspecao e data da proxima.
ALTER TABLE inspecao ADD COLUMN IF NOT EXISTS local VARCHAR(255);
ALTER TABLE inspecao ADD COLUMN IF NOT EXISTS numero VARCHAR(30);
ALTER TABLE inspecao ADD COLUMN IF NOT EXISTS proxima_inspecao DATE;
ALTER TABLE inspecao ADD COLUMN IF NOT EXISTS quilometragem INT;

-- Numero legivel no padrao INS-2026-00001, gerado por sequencia.
CREATE SEQUENCE IF NOT EXISTS seq_numero_inspecao START 1;

-- 3. INSPECAO_ITEM: a tela classifica em Conforme / Atencao / Nao conforme.
--    O banco so aceitava NORMAL e AVARIA.
ALTER TABLE inspecao_item DROP CONSTRAINT IF EXISTS chk_inspecao_item_resultado;
ALTER TABLE inspecao_item
    ADD CONSTRAINT chk_inspecao_item_resultado
    CHECK (resultado IN ('NORMAL', 'ATENCAO', 'AVARIA'));

-- Observacao passa a ser exigida tambem em ATENCAO: se o item nao esta
-- conforme, alguem precisa dizer por que.
ALTER TABLE inspecao_item DROP CONSTRAINT IF EXISTS chk_inspecao_item_observacao;
ALTER TABLE inspecao_item
    ADD CONSTRAINT chk_inspecao_item_observacao
    CHECK (resultado = 'NORMAL' OR observacao IS NOT NULL);

-- 4. ORDEM DE SERVICO / MANUTENCAO: preventiva x corretiva, agendamento,
--    quilometragem e proxima manutencao.
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS tipo VARCHAR(20);
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS data_agendada DATE;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS proxima_manutencao DATE;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS quilometragem INT;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS numero VARCHAR(30);

UPDATE ordem_servico SET tipo = 'CORRETIVA' WHERE tipo IS NULL;
ALTER TABLE ordem_servico ALTER COLUMN tipo SET DEFAULT 'CORRETIVA';
ALTER TABLE ordem_servico ALTER COLUMN tipo SET NOT NULL;

ALTER TABLE ordem_servico DROP CONSTRAINT IF EXISTS chk_os_tipo;
ALTER TABLE ordem_servico
    ADD CONSTRAINT chk_os_tipo CHECK (tipo IN ('PREVENTIVA', 'CORRETIVA'));

CREATE SEQUENCE IF NOT EXISTS seq_numero_os START 1;

-- 5. SINISTRO: tipo do sinistro, envolvimento de terceiros e numero.
ALTER TABLE sinistro ADD COLUMN IF NOT EXISTS tipo VARCHAR(30);
ALTER TABLE sinistro ADD COLUMN IF NOT EXISTS houve_terceiros BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE sinistro ADD COLUMN IF NOT EXISTS numero VARCHAR(30);

UPDATE sinistro SET tipo = 'COLISAO' WHERE tipo IS NULL;
ALTER TABLE sinistro ALTER COLUMN tipo SET DEFAULT 'COLISAO';
ALTER TABLE sinistro ALTER COLUMN tipo SET NOT NULL;

ALTER TABLE sinistro DROP CONSTRAINT IF EXISTS chk_sinistro_tipo;
ALTER TABLE sinistro
    ADD CONSTRAINT chk_sinistro_tipo
    CHECK (tipo IN ('COLISAO', 'DANO_MATERIAL', 'ROUBO_FURTO', 'INCENDIO', 'OUTRO'));

CREATE SEQUENCE IF NOT EXISTS seq_numero_sinistro START 1;

-- 6. DOCUMENTO: categoria, responsavel e arquivo.
ALTER TABLE documento_veiculo ADD COLUMN IF NOT EXISTS categoria VARCHAR(50);
ALTER TABLE documento_veiculo ADD COLUMN IF NOT EXISTS id_responsavel BIGINT;
ALTER TABLE documento_veiculo ADD COLUMN IF NOT EXISTS arquivo_url TEXT;

ALTER TABLE documento_veiculo DROP CONSTRAINT IF EXISTS fk_documento_responsavel;
ALTER TABLE documento_veiculo
    ADD CONSTRAINT fk_documento_responsavel
    FOREIGN KEY (id_responsavel) REFERENCES servidor (id_servidor);

-- 7. RELATORIO: nome proprio e o status "aguardando ateste" do fluxo de
--    atestacao definido para o SITRA.
ALTER TABLE relatorio ADD COLUMN IF NOT EXISTS nome VARCHAR(200);
ALTER TABLE relatorio ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'GERADO';
ALTER TABLE relatorio ADD COLUMN IF NOT EXISTS snapshot JSONB;
ALTER TABLE relatorio ADD COLUMN IF NOT EXISTS hash_sha256 VARCHAR(64);

ALTER TABLE relatorio DROP CONSTRAINT IF EXISTS chk_relatorio_status_v12;
ALTER TABLE relatorio
    ADD CONSTRAINT chk_relatorio_status_v12
    CHECK (status IN ('GERADO', 'AGUARDANDO_ATESTE', 'ATESTADO', 'CANCELADO'));

COMMIT;

-- ============================================================
-- 8. EQUIPAMENTOS OBRIGATORIOS DO CHECKLIST
-- O banco so aceitava MACACO, ESTEPE e CHAVE_RODA. O triangulo faz parte
-- dos quatro itens obrigatorios definidos para a frota.
-- ============================================================
BEGIN;

ALTER TABLE checklist_frotas_equipamento
    DROP CONSTRAINT IF EXISTS chk_checklist_frotas_equipamento_tipo;
ALTER TABLE checklist_frotas_equipamento
    ADD CONSTRAINT chk_checklist_frotas_equipamento_tipo
    CHECK (equipamento IN ('MACACO', 'ESTEPE', 'TRIANGULO', 'CHAVE_RODA'));

COMMIT;

-- ============================================================
-- Atualiza a view vw_perfil_usuario para incluir permissoes.
-- A versao original (001) nao tinha essa coluna; o codigo da
-- API espera um array JSONB com { codigo } de cada permissao
-- do perfil do usuario.
-- ============================================================
BEGIN;

CREATE OR REPLACE VIEW vw_perfil_usuario AS
SELECT
    u.id_usuario,
    u.login,
    u.status AS usuario_ativo,
    u.ultimo_acesso,
    s.id_servidor,
    s.nome,
    s.email,
    s.telefone,
    s.matricula,
    s.cargo_funcao,
    st.nome AS setor,
    p.nome AS perfil,
    COALESCE(
        jsonb_agg(
            DISTINCT jsonb_build_object('codigo', pm.codigo)
        ) FILTER (WHERE pm.id_permissao IS NOT NULL),
        '[]'::jsonb
    ) AS permissoes
FROM usuario u
JOIN servidor s  ON s.id_servidor = u.id_servidor
JOIN setor st    ON st.id_setor   = s.id_setor
JOIN perfil p    ON p.id_perfil   = u.id_perfil
LEFT JOIN perfil_permissao pp ON pp.id_perfil    = p.id_perfil
LEFT JOIN permissao pm        ON pm.id_permissao = pp.id_permissao
GROUP BY
    u.id_usuario, u.login, u.status, u.ultimo_acesso,
    s.id_servidor, s.nome, s.email, s.telefone, s.matricula, s.cargo_funcao,
    st.nome, p.nome;

COMMIT;
