-- ============================================================
-- SITRA - foto do veiculo
-- Aplicar depois do 049_cnh_historico.sql.
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================
-- Pedido do Cesar (26/10): lugar para adicionar a foto no cadastro do
-- veiculo; a foto aparece no cartao do topo dos Detalhes do Veiculo.
-- Uma foto por veiculo, guardada no banco como os outros anexos do sistema.
BEGIN;

CREATE TABLE IF NOT EXISTS veiculo_foto (
    id_veiculo    BIGINT PRIMARY KEY REFERENCES veiculo(id_veiculo) ON DELETE CASCADE,
    tipo          VARCHAR(30) NOT NULL,
    bytes         INTEGER NOT NULL,
    conteudo      BYTEA NOT NULL,
    enviado_por   BIGINT,
    atualizado_em TIMESTAMP NOT NULL DEFAULT now()
);

COMMIT;
