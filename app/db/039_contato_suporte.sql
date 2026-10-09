-- ============================================================================
-- 039 - Contato do suporte na tela de Ajuda (09/10)
-- ============================================================================
-- O cartao "Precisa de mais ajuda?" da Central de Ajuda mostra o e-mail, o
-- telefone e o horario do suporte. Os valores ficam em Parametros do Sistema
-- (Configuracoes Gerais) para a TI trocar sem mexer no codigo. Comecam vazios:
-- vazio, a tela orienta a procurar o administrador do sistema.
-- Idempotente: nao sobrescreve o que ja foi preenchido.

INSERT INTO parametro_sistema (chave, modulo, nome, descricao, valor, tipo_valor) VALUES
    ('suporte.email', 'SISTEMA', 'E-mail do suporte',
     'Aparece na tela de Ajuda, com o botão Enviar e-mail. Ex.: "suporte@cmtt.go.gov.br".',
     '""'::jsonb, 'TEXT'),
    ('suporte.telefone', 'SISTEMA', 'Telefone do suporte',
     'Aparece na tela de Ajuda, com o botão Ligar. Ex.: "(64) 3000-0000".',
     '""'::jsonb, 'TEXT'),
    ('suporte.horario', 'SISTEMA', 'Horário de atendimento do suporte',
     'Aparece na tela de Ajuda. Ex.: "Das 8h às 18h, de segunda a sexta".',
     '""'::jsonb, 'TEXT')
ON CONFLICT (chave) DO NOTHING;
