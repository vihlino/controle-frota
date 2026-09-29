-- ============================================================
-- SITRA - permissao propria para corrigir um checklist enviado
-- Aplicar depois do 018_cpf_telefone_digitos.sql.
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================
BEGIN;

-- POR QUE UMA PERMISSAO NOVA, E NAO "GERENCIAR VEICULOS"
--
-- O checklist e a prova de que um veiculo saiu e voltou: hora, quilometragem,
-- equipamentos, quem dirigia. Ele nasce no celular do condutor e ninguem
-- digita duas vezes - entao quando o condutor erra o odometro, a correcao tem
-- de acontecer aqui, por alguem da gestao.
--
-- Isso NAO e a mesma coisa que cadastrar veiculo. Quem monta a frota nao
-- precisa do poder de reescrever o historico dela, e quem confere as saidas do
-- dia nao precisa mexer no cadastro. Duas permissoes separadas deixam a
-- gestao decidir - e, no dia em que uma edicao for questionada, a auditoria
-- mostra quem tinha esse poder.
INSERT INTO permissao (codigo, nome, descricao, modulo) VALUES
    ('FROTAS_EDITAR_CHECKLIST', 'Corrigir checklist da frota',
     'Permite corrigir um checklist já enviado pelo condutor. Toda alteração fica na auditoria.',
     'FROTAS'),
    ('FISCALIZACAO_EDITAR_CHECKLIST', 'Corrigir checklist de viatura',
     'Permite corrigir um checklist já enviado pela equipe. Toda alteração fica na auditoria.',
     'FISCALIZACAO')
ON CONFLICT (codigo) DO NOTHING;

-- Quem ja responde pelo modulo recebe a permissao; os demais perfis ficam sem
-- ela e a tela nem mostra o botao. O Administrador entra pelos dois porque ele
-- responde pelo sistema todo.
INSERT INTO perfil_permissao (id_perfil, id_permissao)
SELECT p.id_perfil, pe.id_permissao
  FROM perfil p
  JOIN permissao pe ON pe.codigo = 'FROTAS_EDITAR_CHECKLIST'
 WHERE p.nome IN ('Administrador', 'Gestor Frotas')
ON CONFLICT DO NOTHING;

INSERT INTO perfil_permissao (id_perfil, id_permissao)
SELECT p.id_perfil, pe.id_permissao
  FROM perfil p
  JOIN permissao pe ON pe.codigo = 'FISCALIZACAO_EDITAR_CHECKLIST'
 WHERE p.nome IN ('Administrador', 'Gestor Fiscalizacao')
ON CONFLICT DO NOTHING;

COMMIT;
