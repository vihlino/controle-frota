-- ============================================================================
-- 038 - Fiscalizacao: gerenciar fiscais e OS das viaturas (09/10)
-- ============================================================================
-- 1. FISCALIZACAO_GERENCIAR_FISCAIS: cadastrar e editar os fiscais (servidores
--    do proprio setor - o recorte por setor ja existe na API de servidores).
-- 2. As OS das viaturas passam a ser abertas e fechadas pela Fiscalizacao com
--    a permissao que ja existia para as viaturas (FISCALIZACAO_GERENCIAR_VIATURAS);
--    quem so tem a Fiscalizacao ve apenas as OS de viaturas.
-- Idempotente, como as demais.

INSERT INTO permissao (codigo, nome, descricao, modulo) VALUES
    ('FISCALIZACAO_GERENCIAR_FISCAIS', 'Gerenciar fiscais',
     'Permite cadastrar e editar os fiscais do setor de Fiscalização.',
     'FISCALIZACAO')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO perfil_permissao (id_perfil, id_permissao)
SELECT p.id_perfil, pe.id_permissao
  FROM perfil p
  JOIN permissao pe ON pe.codigo = 'FISCALIZACAO_GERENCIAR_FISCAIS'
 WHERE unaccent_simples(p.nome) IN ('ADMINISTRADOR', 'GESTOR FISCALIZACAO')
ON CONFLICT DO NOTHING;
