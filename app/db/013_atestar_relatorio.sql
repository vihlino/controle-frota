-- ============================================================
-- SITRA - quem gera o relatorio tambem pode atesta-lo
-- Aplicar depois do 012_cor_opcional.sql.
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================
BEGIN;

-- O atesto e o que transforma o relatorio em documento: registra quem
-- conferiu, com cargo, data e hora, dentro do sistema. A permissao existia
-- desde a primeira versao, mas so o Administrador a tinha - entao o gestor
-- que gerava o relatorio nao via o botao de atestar no proprio modulo dele, e
-- o fluxo parava ali.
--
-- Ate TRES pessoas atestam o mesmo relatorio (a regra vive na API); dar a
-- permissao aos dois perfis de gestao e o que permite mais de uma assinatura.
INSERT INTO perfil_permissao (id_perfil, id_permissao)
SELECT p.id_perfil, pe.id_permissao
  FROM perfil p
  JOIN permissao pe ON pe.codigo = 'RELATORIOS_ATESTAR'
 WHERE p.nome IN ('Gestor Frotas', 'Gestor Fiscalizacao')
ON CONFLICT DO NOTHING;

COMMIT;
