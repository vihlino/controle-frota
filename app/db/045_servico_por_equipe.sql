-- 045_servico_por_equipe.sql (21/10/2026)
--
-- Pedidos do Cesar de 21/10:
--
-- 1) Equipe com Fiscal 1 e Fiscal 2 (a lista de Equipes mostra os dois, com
--    a matricula). A posicao fica na composicao da equipe (equipe_servidor).
--    Quem ja esta na equipe ganha a posicao pela ordem do nome.
ALTER TABLE equipe_servidor ADD COLUMN IF NOT EXISTS posicao SMALLINT;
UPDATE equipe_servidor es SET posicao = o.n
  FROM (SELECT es2.id_equipe, es2.id_servidor, es2.data_inicio,
               ROW_NUMBER() OVER (PARTITION BY es2.id_equipe ORDER BY s.nome) AS n
          FROM equipe_servidor es2 JOIN servidor s ON s.id_servidor = es2.id_servidor
         WHERE es2.status AND es2.data_fim IS NULL) o
 WHERE es.id_equipe = o.id_equipe AND es.id_servidor = o.id_servidor AND es.data_inicio = o.data_inicio
   AND es.posicao IS NULL;

--    Equipe de APOIO: so na equipe temporaria, com o nome do policial.
ALTER TABLE equipe ADD COLUMN IF NOT EXISTS apoio BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE equipe ADD COLUMN IF NOT EXISTS policial VARCHAR(150);
ALTER TABLE equipe DROP CONSTRAINT IF EXISTS chk_equipe_apoio;
ALTER TABLE equipe ADD CONSTRAINT chk_equipe_apoio CHECK (NOT apoio OR tipo = 'TEMPORARIA');

-- 2) Servico diario POR EQUIPE: cada "Novo servico" e uma equipe, com a
--    viatura, a equipe de apoio (opcional), observacoes e fotos. O servico do
--    dia/turno (servico_diario) continua sendo o agrupador. Nao ha mais o
--    passo "Iniciar servico": a equipe entra em servico quando toca em
--    "Continuar" no checklist da viatura (QR Code) e sai quando finaliza.
ALTER TABLE servico_equipe
  ADD COLUMN IF NOT EXISTS id_veiculo      BIGINT REFERENCES veiculo (id_veiculo),
  ADD COLUMN IF NOT EXISTS id_equipe_apoio BIGINT REFERENCES equipe (id_equipe),
  ADD COLUMN IF NOT EXISTS observacoes     TEXT,
  ADD COLUMN IF NOT EXISTS criado_por      BIGINT REFERENCES usuario (id_usuario),
  ADD COLUMN IF NOT EXISTS criado_em       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS hora_inicio     TIME,
  ADD COLUMN IF NOT EXISTS hora_fim        TIME;
ALTER TABLE servico_equipe DROP CONSTRAINT IF EXISTS chk_servico_equipe_status;
ALTER TABLE servico_equipe ADD CONSTRAINT chk_servico_equipe_status
  CHECK (status IN ('ATIVA', 'EM_SERVICO', 'FINALIZADA', 'CANCELADA'));
ALTER TABLE servico_equipe DROP CONSTRAINT IF EXISTS chk_servico_equipe_apoio;
ALTER TABLE servico_equipe ADD CONSTRAINT chk_servico_equipe_apoio
  CHECK (id_equipe_apoio IS NULL OR id_equipe_apoio <> id_equipe);
CREATE INDEX IF NOT EXISTS idx_servico_equipe_veiculo ON servico_equipe (id_veiculo);

-- Fotos do servico (opcional, ate 6, reduzidas no navegador).
CREATE TABLE IF NOT EXISTS servico_equipe_foto (
    id_foto           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_servico_equipe BIGINT NOT NULL REFERENCES servico_equipe (id_servico_equipe) ON DELETE CASCADE,
    nome              VARCHAR(255),
    tipo              VARCHAR(40) NOT NULL,
    bytes             INTEGER NOT NULL,
    conteudo          BYTEA NOT NULL,
    enviado_por       BIGINT REFERENCES usuario (id_usuario),
    criado_em         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_servico_foto_bytes CHECK (bytes > 0 AND bytes <= 3145728)
);
CREATE INDEX IF NOT EXISTS idx_servico_foto ON servico_equipe_foto (id_servico_equipe);

-- 3) Viaturas: so o Frotas cadastra, edita e exclui veiculos (21/10). A
--    permissao da Fiscalizacao para as viaturas passa a ser so os
--    equipamentos (quantidades) e o pedido de OS.
UPDATE permissao
   SET nome = 'Gerenciar equipamentos das viaturas',
       descricao = 'Salvar as quantidades de equipamentos das viaturas e pedir OS. Cadastrar, editar e excluir veículos é do Frotas (Gerenciar veículos).'
 WHERE codigo = 'FISCALIZACAO_GERENCIAR_VIATURAS';
