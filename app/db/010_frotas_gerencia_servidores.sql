-- ============================================================
-- SITRA - o perfil Gestor Frotas passa a alcancar os motoristas
-- Aplicar depois do 009_servico_status_aberto.sql.
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================
BEGIN;

-- O QUE ESTAVA ACONTECENDO
-- O usuario do gestor de frotas abria "Motoristas" e via uma lista vazia. A
-- tela le a base de servidores, que exigia ADMIN_VISUALIZAR - permissao que o
-- perfil nao tem, e nem deveria ter: ela abre tambem usuarios, perfis, setores
-- e parametros do sistema.
--
-- O mesmo 403 atingia, em silencio, os campos "responsavel" de Documentos e de
-- Sinistros: aquelas telas ignoram a falha da chamada, entao o seletor
-- simplesmente aparecia sem opcao nenhuma, sem mensagem de erro.
--
-- A permissao certa ja existia desde a primeira versao do banco:
-- FROTAS_GERENCIAR_SERVIDORES, descrita como "consultar e gerenciar servidores
-- utilizados no modulo de Frotas". Ela so nunca tinha sido dada a ninguem
-- alem do Administrador - e nenhuma linha de codigo chegava a consulta-la.
INSERT INTO perfil_permissao (id_perfil, id_permissao)
SELECT p.id_perfil, pe.id_permissao
  FROM perfil p
  JOIN permissao pe ON pe.codigo = 'FROTAS_GERENCIAR_SERVIDORES'
 WHERE p.nome = 'Gestor Frotas'
ON CONFLICT DO NOTHING;

-- O gestor de fiscalizacao tem o mesmo problema em Servico Diario, onde
-- precisa escolher o coordenador do turno. Para ele, VER a lista basta - quem
-- cadastra servidor da fiscalizacao continua sendo a Administracao. A leitura
-- e liberada pela API para FISCALIZACAO_VISUALIZAR, que o perfil ja tem;
-- nenhuma permissao nova precisa ser concedida para isso.

-- VIATURAS
-- A tela de Viaturas e o cadastro de veiculos filtrado pelo setor de
-- Fiscalizacao. FISCALIZACAO_GERENCIAR_VIATURAS existe no catalogo desde a
-- primeira versao, mas so o Administrador a tinha - entao o gestor de
-- fiscalizacao via a lista e nao podia corrigir uma placa errada na tela do
-- proprio modulo dele.
INSERT INTO perfil_permissao (id_perfil, id_permissao)
SELECT p.id_perfil, pe.id_permissao
  FROM perfil p
  JOIN permissao pe ON pe.codigo = 'FISCALIZACAO_GERENCIAR_VIATURAS'
 WHERE p.nome = 'Gestor Fiscalizacao'
ON CONFLICT DO NOTHING;

COMMIT;
