-- ============================================================
-- SITRA - Triangulo nos equipamentos obrigatorios da viatura
-- Aplicar depois do 046_coordenador_estoque.sql.
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================
-- Pedido do Cesar (26/10): os equipamentos obrigatorios sao os MESMOS nos
-- checklists de Frotas e da Fiscalizacao - Macaco, Estepe, Triangulo e Chave
-- de roda. O de Frotas ja conferia o triangulo; o da viatura nao tinha o item.
BEGIN;

INSERT INTO equipamento (nome, descricao, status, conferencia, ordem)
VALUES ('Triângulo', 'Triângulo de sinalização (equipamento obrigatório do veículo)', TRUE, 'OBRIGATORIO', 8)
ON CONFLICT (nome) DO NOTHING;

-- Ordem do checklist: Macaco, Estepe, Triangulo, Chave de roda. A Chave de
-- roda so muda de lugar se ainda estiver na posicao padrao (8) - quem mudou
-- a ordem pela tela fica como esta.
UPDATE equipamento SET ordem = 9
 WHERE nome = 'Chave de roda' AND ordem = 8
   AND EXISTS (SELECT 1 FROM equipamento WHERE nome = 'Triângulo' AND ordem = 8);

COMMIT;
