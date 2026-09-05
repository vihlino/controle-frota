-- ============================================================
-- SITRA - o condutor abre chamado de manutencao pelo checklist
-- Aplicar depois do 010_frotas_gerencia_servidores.sql.
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================
BEGIN;

-- O QUE MUDA
-- Ate aqui a ordem de servico so nascia de dentro do sistema, por um USUARIO
-- logado (id_solicitante). O chamado do checklist nasce no patio, pelo QR
-- Code, de quem nao tem login nenhum: o condutor. Ele e um SERVIDOR, nao um
-- usuario - dai a coluna nova.
--
-- O vinculo com o checklist ja existia e nao precisa de coluna: origem =
-- 'CHECKLIST_FROTAS' com id_registro_origem = id_checklist. O que faltava era
-- dizer QUAL parte do veiculo e EM QUE MOMENTO (saida ou chegada), que e o
-- que a tela de detalhes mostra.
ALTER TABLE ordem_servico
  ADD COLUMN IF NOT EXISTS id_servidor_solicitante BIGINT,
  ADD COLUMN IF NOT EXISTS parte_veiculo VARCHAR(40),
  ADD COLUMN IF NOT EXISTS momento VARCHAR(10);

ALTER TABLE ordem_servico DROP CONSTRAINT IF EXISTS fk_os_servidor_solicitante;
ALTER TABLE ordem_servico
  ADD CONSTRAINT fk_os_servidor_solicitante
  FOREIGN KEY (id_servidor_solicitante) REFERENCES servidor (id_servidor);

-- id_solicitante deixa de ser obrigatorio, porque o chamado do condutor nao
-- tem usuario. Em compensacao, UM DOS DOIS tem de estar preenchido: nenhuma
-- OS pode ficar sem responder "quem abriu".
ALTER TABLE ordem_servico ALTER COLUMN id_solicitante DROP NOT NULL;

ALTER TABLE ordem_servico DROP CONSTRAINT IF EXISTS chk_os_tem_solicitante;
ALTER TABLE ordem_servico
  ADD CONSTRAINT chk_os_tem_solicitante
  CHECK (id_solicitante IS NOT NULL OR id_servidor_solicitante IS NOT NULL);

ALTER TABLE ordem_servico DROP CONSTRAINT IF EXISTS chk_os_momento;
ALTER TABLE ordem_servico
  ADD CONSTRAINT chk_os_momento
  CHECK (momento IS NULL OR momento IN ('SAIDA', 'CHEGADA'));

-- A tela de detalhes do checklist busca sempre pelo par origem + registro.
CREATE INDEX IF NOT EXISTS idx_os_origem_registro
  ON ordem_servico (origem, id_registro_origem);

COMMIT;
