-- 046_coordenador_estoque.sql (21/10/2026)
--
-- 1) Coordenador do servico diario (Cesar, 21/10: "precisa que peca o
--    coordenador sim, porque todo dia ira mudar"). Fica no servico de cada
--    equipe; o servico do dia/turno guarda o primeiro, como antes.
ALTER TABLE servico_equipe ADD COLUMN IF NOT EXISTS id_coordenador BIGINT REFERENCES servidor (id_servidor);
UPDATE servico_equipe se SET id_coordenador = sd.id_coordenador
  FROM servico_diario sd
 WHERE sd.id_servico_diario = se.id_servico_diario AND se.id_coordenador IS NULL;

-- 2) Estoque dos equipamentos (Cesar, 21/10: "anda sumindo muito cone, entao
--    e para ter o controle de estoque mesmo"). Entradas (o que foi cadastrado,
--    no dia) e baixas (descarte, perda reconhecida). Retiradas e devolucoes
--    vem dos checklists da viatura: saiu 50, voltou 45 = faltam 5, com os
--    fiscais daquele checklist como responsaveis.
CREATE TABLE IF NOT EXISTS equipamento_movimento (
    id_movimento    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_equipamento  BIGINT NOT NULL REFERENCES equipamento (id_equipamento),
    tipo            VARCHAR(10) NOT NULL,
    quantidade      INT NOT NULL,
    data            DATE NOT NULL DEFAULT CURRENT_DATE,
    observacao      TEXT,
    registrado_por  BIGINT REFERENCES usuario (id_usuario),
    criado_em       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_equip_mov_tipo CHECK (tipo IN ('ENTRADA', 'BAIXA')),
    CONSTRAINT chk_equip_mov_qtd CHECK (quantidade > 0)
);
CREATE INDEX IF NOT EXISTS idx_equip_mov_item ON equipamento_movimento (id_equipamento, data DESC);
