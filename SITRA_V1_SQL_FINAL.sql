-- ============================================================
-- SITRA V1 - SQL CONSOLIDADO
-- PostgreSQL
-- Versão: 1.0
--
-- Escopo:
--   Administração
--   Frotas
--   Fiscalização
--   Relatórios
--   Atestação
--   Anexos
--   Auditoria
--
-- Fora da V1 por enquanto:
--   Item / Pontuação / Bonificação
--   GRU
--
-- Observação:
--   Regras de negócio que dependem de contexto operacional
--   específico continuam também na camada de aplicação.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ADMINISTRAÇÃO
-- ============================================================

CREATE TABLE setor (
    id_setor BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome VARCHAR(150) NOT NULL UNIQUE,
    descricao TEXT,
    status BOOLEAN NOT NULL DEFAULT TRUE,
    data_criacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE servidor (
    id_servidor BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome VARCHAR(200) NOT NULL,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    data_nascimento DATE NOT NULL,
    telefone VARCHAR(30) NOT NULL,
    email VARCHAR(200) NOT NULL,
    matricula VARCHAR(50) NOT NULL UNIQUE,
    cnh VARCHAR(30),
    categoria_cnh VARCHAR(10),
    cargo_funcao VARCHAR(150) NOT NULL,
    id_setor BIGINT NOT NULL,
    status BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT fk_servidor_setor
        FOREIGN KEY (id_setor)
        REFERENCES setor (id_setor)
);

CREATE TABLE perfil (
    id_perfil BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome VARCHAR(50) NOT NULL UNIQUE,
    descricao TEXT,
    status BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE area_gestao (
    id_area_gestao BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome VARCHAR(50) NOT NULL UNIQUE,
    descricao TEXT,
    status BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE usuario (
    id_usuario BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_servidor BIGINT NOT NULL UNIQUE,
    id_perfil BIGINT NOT NULL,
    login VARCHAR(100) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    status BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_acesso TIMESTAMP,

    CONSTRAINT fk_usuario_servidor
        FOREIGN KEY (id_servidor)
        REFERENCES servidor (id_servidor),

    CONSTRAINT fk_usuario_perfil
        FOREIGN KEY (id_perfil)
        REFERENCES perfil (id_perfil)
);

CREATE TABLE usuario_area_gestao (
    id_usuario BIGINT NOT NULL,
    id_area_gestao BIGINT NOT NULL,

    PRIMARY KEY (id_usuario, id_area_gestao),

    CONSTRAINT fk_usuario_area_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuario (id_usuario)
        ON DELETE CASCADE,

    CONSTRAINT fk_usuario_area_area
        FOREIGN KEY (id_area_gestao)
        REFERENCES area_gestao (id_area_gestao)
        ON DELETE CASCADE
);

CREATE TABLE permissao (
    id_permissao BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo VARCHAR(100) NOT NULL UNIQUE,
    nome VARCHAR(150) NOT NULL,
    descricao TEXT,
    modulo VARCHAR(50) NOT NULL,
    status BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE perfil_permissao (
    id_perfil BIGINT NOT NULL,
    id_permissao BIGINT NOT NULL,

    PRIMARY KEY (id_perfil, id_permissao),

    CONSTRAINT fk_perfil_permissao_perfil
        FOREIGN KEY (id_perfil)
        REFERENCES perfil (id_perfil)
        ON DELETE CASCADE,

    CONSTRAINT fk_perfil_permissao_permissao
        FOREIGN KEY (id_permissao)
        REFERENCES permissao (id_permissao)
        ON DELETE CASCADE
);

-- Dados iniciais
INSERT INTO perfil (nome, descricao) VALUES
    ('Administrador', 'Acesso completo ao sistema'),
    ('Gestor', 'Acesso de gestão conforme permissões e área de gestão');

INSERT INTO area_gestao (nome, descricao) VALUES
    ('FROTAS', 'Gestão do módulo de Frotas'),
    ('FISCALIZACAO', 'Gestão do módulo de Fiscalização');

INSERT INTO permissao (codigo, nome, descricao, modulo) VALUES
    ('ADMIN_VISUALIZAR', 'Visualizar administração',
     'Permite visualizar informações administrativas', 'ADMINISTRACAO'),
    ('ADMIN_GERENCIAR_USUARIOS', 'Gerenciar usuários',
     'Permite criar, editar e inativar usuários', 'ADMINISTRACAO'),
    ('ADMIN_GERENCIAR_SETORES', 'Gerenciar setores',
     'Permite criar, editar e inativar setores', 'ADMINISTRACAO'),
    ('ADMIN_GERENCIAR_SERVIDORES', 'Gerenciar servidores',
     'Permite criar, editar e inativar servidores', 'ADMINISTRACAO'),

    ('FROTAS_VISUALIZAR', 'Visualizar Frotas',
     'Permite acessar o módulo de Frotas', 'FROTAS'),
    ('FROTAS_GERENCIAR_VEICULOS', 'Gerenciar veículos',
     'Permite cadastrar, editar e inativar veículos', 'FROTAS'),
    ('FROTAS_GERENCIAR_DOCUMENTOS', 'Gerenciar documentação',
     'Permite gerenciar documentação dos veículos', 'FROTAS'),
    ('FROTAS_REALIZAR_INSPECAO', 'Realizar inspeção',
     'Permite realizar inspeções semanais e mensais', 'FROTAS'),
    ('FROTAS_GERENCIAR_OS', 'Gerenciar ordens de serviço',
     'Permite abrir, assumir, gerenciar e finalizar OS', 'FROTAS'),
    ('FROTAS_GERENCIAR_SINISTROS', 'Gerenciar sinistros',
     'Permite criar e gerenciar sinistros', 'FROTAS'),
    ('FROTAS_GERAR_RELATORIOS', 'Gerar relatórios de Frotas',
     'Permite gerar relatórios do módulo de Frotas', 'FROTAS'),

    ('FISCALIZACAO_VISUALIZAR', 'Visualizar Fiscalização',
     'Permite acessar o módulo de Fiscalização', 'FISCALIZACAO'),
    ('FISCALIZACAO_GERENCIAR_EQUIPES', 'Gerenciar equipes',
     'Permite gerenciar equipes da Fiscalização', 'FISCALIZACAO'),
    ('FISCALIZACAO_GERENCIAR_SERVICO', 'Gerenciar Serviço Diário',
     'Permite criar e gerenciar Serviços Diários', 'FISCALIZACAO'),
    ('FISCALIZACAO_GERENCIAR_OCORRENCIAS', 'Gerenciar ocorrências',
     'Permite criar e gerenciar ocorrências', 'FISCALIZACAO'),
    ('FISCALIZACAO_DISTRIBUIR_OCORRENCIAS', 'Distribuir ocorrências',
     'Permite atribuir e reatribuir ocorrências', 'FISCALIZACAO'),
    ('FISCALIZACAO_GERAR_RELATORIOS', 'Gerar relatórios de Fiscalização',
     'Permite gerar relatórios da Fiscalização', 'FISCALIZACAO'),

    ('RELATORIOS_VISUALIZAR', 'Visualizar relatórios',
     'Permite consultar relatórios', 'RELATORIOS'),
    ('RELATORIOS_GERAR', 'Gerar relatórios',
     'Permite gerar relatórios', 'RELATORIOS'),
    ('RELATORIOS_ATESTAR', 'Atestar relatórios',
     'Permite atestar relatórios', 'RELATORIOS'),

    ('AUDITORIA_VISUALIZAR', 'Visualizar auditoria',
     'Permite consultar registros de auditoria', 'AUDITORIA'),
    ('AUDITORIA_EXPORTAR', 'Exportar auditoria',
     'Permite exportar registros de auditoria', 'AUDITORIA');

INSERT INTO perfil_permissao (id_perfil, id_permissao)
SELECT p.id_perfil, pe.id_permissao
FROM perfil p
CROSS JOIN permissao pe
WHERE p.nome = 'Administrador';

-- ============================================================
-- 2. FROTAS
-- ============================================================

CREATE TABLE veiculo (
    id_veiculo BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    placa VARCHAR(10) NOT NULL UNIQUE,
    marca VARCHAR(100) NOT NULL,
    modelo VARCHAR(100) NOT NULL,
    ano_fabricacao SMALLINT NOT NULL,
    ano_modelo SMALLINT NOT NULL,
    cor VARCHAR(50) NOT NULL,
    tipo_veiculo VARCHAR(100) NOT NULL,
    renavam VARCHAR(20) UNIQUE,
    chassi VARCHAR(30) UNIQUE,
    tipo_combustivel VARCHAR(50) NOT NULL,
    capacidade VARCHAR(50),
    quilometragem_atual INT NOT NULL DEFAULT 0,
    id_setor BIGINT NOT NULL,
    observacoes TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'DISPONIVEL',

    CONSTRAINT fk_veiculo_setor
        FOREIGN KEY (id_setor)
        REFERENCES setor (id_setor),

    CONSTRAINT chk_veiculo_status
        CHECK (
            status IN (
                'DISPONIVEL',
                'EM_USO',
                'EM_MANUTENCAO',
                'INATIVO'
            )
        ),

    CONSTRAINT chk_veiculo_ano
        CHECK (
            ano_fabricacao >= 1900
            AND ano_modelo >= ano_fabricacao
        ),

    CONSTRAINT chk_veiculo_odometro
        CHECK (quilometragem_atual >= 0)
);

CREATE TABLE qr_code (
    id_qr_code BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_veiculo BIGINT NOT NULL UNIQUE,
    codigo VARCHAR(100) NOT NULL UNIQUE,
    token VARCHAR(255) NOT NULL UNIQUE,
    status BOOLEAN NOT NULL DEFAULT TRUE,
    data_geracao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_qr_code_veiculo
        FOREIGN KEY (id_veiculo)
        REFERENCES veiculo (id_veiculo)
);

CREATE TABLE documento_veiculo (
    id_documento BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_veiculo BIGINT NOT NULL,
    tipo_documento VARCHAR(100) NOT NULL,
    numero_documento VARCHAR(100),
    data_emissao DATE,
    data_validade DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'VALIDO',
    observacoes TEXT,

    CONSTRAINT fk_documento_veiculo
        FOREIGN KEY (id_veiculo)
        REFERENCES veiculo (id_veiculo),

    CONSTRAINT chk_documento_status
        CHECK (
            status IN (
                'VALIDO',
                'VENCENDO',
                'VENCIDO',
                'INATIVO'
            )
        ),

    CONSTRAINT chk_documento_datas
        CHECK (
            data_validade IS NULL
            OR data_emissao IS NULL
            OR data_validade >= data_emissao
        )
);

CREATE TABLE equipamento (
    id_equipamento BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    descricao TEXT,
    status BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO equipamento (nome, descricao) VALUES
    ('Rádio', 'Rádio utilizado pela Fiscalização'),
    ('Cone', 'Cone utilizado pela Fiscalização'),
    ('Pantográfica', 'Pantográfica utilizada pela Fiscalização'),
    ('Outros', 'Outros equipamentos da Fiscalização');

CREATE TABLE veiculo_equipamento (
    id_veiculo BIGINT NOT NULL,
    id_equipamento BIGINT NOT NULL,
    quantidade INT NOT NULL DEFAULT 0,

    PRIMARY KEY (id_veiculo, id_equipamento),

    CONSTRAINT fk_veiculo_equipamento_veiculo
        FOREIGN KEY (id_veiculo)
        REFERENCES veiculo (id_veiculo),

    CONSTRAINT fk_veiculo_equipamento_equipamento
        FOREIGN KEY (id_equipamento)
        REFERENCES equipamento (id_equipamento),

    CONSTRAINT chk_veiculo_equipamento_quantidade
        CHECK (quantidade >= 0)
);

CREATE TABLE checklist_frotas (
    id_checklist BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_veiculo BIGINT NOT NULL,
    id_servidor BIGINT NOT NULL,
    data_abertura DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_saida TIME NOT NULL DEFAULT CURRENT_TIME,
    data_devolucao DATE,
    hora_chegada TIME,
    odometro_saida INT NOT NULL,
    odometro_chegada INT,
    observacoes TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'ABERTO',
    data_finalizacao TIMESTAMP,

    CONSTRAINT fk_checklist_frotas_veiculo
        FOREIGN KEY (id_veiculo)
        REFERENCES veiculo (id_veiculo),

    CONSTRAINT fk_checklist_frotas_servidor
        FOREIGN KEY (id_servidor)
        REFERENCES servidor (id_servidor),

    CONSTRAINT chk_checklist_frotas_status
        CHECK (status IN ('ABERTO', 'FINALIZADO')),

    CONSTRAINT chk_checklist_frotas_odometro
        CHECK (
            odometro_chegada IS NULL
            OR odometro_chegada >= odometro_saida
        ),

    CONSTRAINT chk_checklist_frotas_devolucao
        CHECK (
            status = 'ABERTO'
            OR (
                data_devolucao IS NOT NULL
                AND hora_chegada IS NOT NULL
                AND data_finalizacao IS NOT NULL
            )
        )
);

CREATE TABLE checklist_frotas_equipamento (
    id_checklist BIGINT NOT NULL,
    equipamento VARCHAR(30) NOT NULL,
    conforme BOOLEAN NOT NULL,
    observacao TEXT,

    PRIMARY KEY (id_checklist, equipamento),

    CONSTRAINT fk_checklist_frotas_equipamento_checklist
        FOREIGN KEY (id_checklist)
        REFERENCES checklist_frotas (id_checklist),

    CONSTRAINT chk_checklist_frotas_equipamento_tipo
        CHECK (
            equipamento IN (
                'MACACO',
                'ESTEPE',
                'CHAVE_RODA'
            )
        ),

    CONSTRAINT chk_checklist_frotas_equipamento_observacao
        CHECK (
            conforme = TRUE
            OR observacao IS NOT NULL
        )
);

CREATE TABLE configuracao_inspecao (
    id_configuracao BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo VARCHAR(20) NOT NULL,
    dia_semana SMALLINT,
    dia_mes SMALLINT,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    atualizado_por BIGINT,
    atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_config_inspecao_tipo
        CHECK (tipo IN ('SEMANAL', 'MENSAL')),

    CONSTRAINT chk_config_inspecao_dia_semana
        CHECK (
            (tipo = 'SEMANAL' AND dia_semana BETWEEN 0 AND 6 AND dia_mes IS NULL)
            OR
            (tipo = 'MENSAL' AND dia_mes BETWEEN 1 AND 31 AND dia_semana IS NULL)
        ),

    CONSTRAINT fk_config_inspecao_usuario
        FOREIGN KEY (atualizado_por)
        REFERENCES usuario (id_usuario)
);

CREATE UNIQUE INDEX uq_config_inspecao_tipo_ativo
ON configuracao_inspecao (tipo)
WHERE ativo = TRUE;

CREATE TABLE configuracao_alerta_documento (
    id_configuracao BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dias_antecedencia SMALLINT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    atualizado_por BIGINT,
    atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_config_alerta_documento_dias
        CHECK (dias_antecedencia > 0),

    CONSTRAINT fk_config_alerta_documento_usuario
        FOREIGN KEY (atualizado_por)
        REFERENCES usuario (id_usuario)
);

CREATE UNIQUE INDEX uq_config_alerta_documento_dias_ativo
ON configuracao_alerta_documento (dias_antecedencia)
WHERE ativo = TRUE;

-- Configuração inicial conforme regra definida para a V1.
INSERT INTO configuracao_alerta_documento (dias_antecedencia) VALUES
    (90),
    (30),
    (15);

CREATE TABLE inspecao (
    id_inspecao BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_veiculo BIGINT NOT NULL,
    id_gestor BIGINT NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    data_programada DATE,
    data_realizacao DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_inicio TIME NOT NULL DEFAULT CURRENT_TIME,
    hora_finalizacao TIME,
    status VARCHAR(30) NOT NULL DEFAULT 'ABERTA',
    resultado VARCHAR(30),
    observacoes TEXT,
    data_finalizacao TIMESTAMP,

    CONSTRAINT fk_inspecao_veiculo
        FOREIGN KEY (id_veiculo)
        REFERENCES veiculo (id_veiculo),

    CONSTRAINT fk_inspecao_gestor
        FOREIGN KEY (id_gestor)
        REFERENCES usuario (id_usuario),

    CONSTRAINT chk_inspecao_tipo
        CHECK (tipo IN ('SEMANAL', 'MENSAL')),

    CONSTRAINT chk_inspecao_status
        CHECK (status IN ('ABERTA', 'FINALIZADA')),

    CONSTRAINT chk_inspecao_resultado
        CHECK (
            resultado IS NULL
            OR resultado IN ('CONFORME', 'COM_AVARIAS')
        ),

    CONSTRAINT chk_inspecao_finalizacao
        CHECK (
            status = 'ABERTA'
            OR (
                data_finalizacao IS NOT NULL
                AND hora_finalizacao IS NOT NULL
                AND resultado IS NOT NULL
            )
        )
);

CREATE TABLE inspecao_item (
    id_inspecao_item BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_inspecao BIGINT NOT NULL,
    item VARCHAR(100) NOT NULL,
    resultado VARCHAR(20) NOT NULL,
    observacao TEXT,

    CONSTRAINT fk_inspecao_item_inspecao
        FOREIGN KEY (id_inspecao)
        REFERENCES inspecao (id_inspecao),

    CONSTRAINT chk_inspecao_item_resultado
        CHECK (
            resultado IN ('NORMAL', 'AVARIA')
        ),

    CONSTRAINT chk_inspecao_item_observacao
        CHECK (
            resultado = 'NORMAL'
            OR observacao IS NOT NULL
        )
);

CREATE TABLE ordem_servico (
    id_os BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_veiculo BIGINT NOT NULL,
    origem VARCHAR(50) NOT NULL,
    id_registro_origem BIGINT,
    gravidade VARCHAR(20) NOT NULL,
    id_solicitante BIGINT NOT NULL,
    id_responsavel BIGINT,
    data_abertura TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_inicio TIMESTAMP,
    data_conclusao TIMESTAMP,
    status VARCHAR(30) NOT NULL DEFAULT 'EM_ANALISE',
    servico_realizado TEXT,
    oficina VARCHAR(200),
    custo DECIMAL(12,2),
    houve_troca BOOLEAN NOT NULL DEFAULT FALSE,
    observacoes TEXT,

    CONSTRAINT fk_os_veiculo
        FOREIGN KEY (id_veiculo)
        REFERENCES veiculo (id_veiculo),

    CONSTRAINT fk_os_solicitante
        FOREIGN KEY (id_solicitante)
        REFERENCES usuario (id_usuario),

    CONSTRAINT fk_os_responsavel
        FOREIGN KEY (id_responsavel)
        REFERENCES usuario (id_usuario),

    CONSTRAINT chk_os_origem
        CHECK (
            origem IN (
                'FROTAS',
                'FISCALIZACAO',
                'CHECKLIST_FROTAS',
                'CHECKLIST_FISCALIZACAO',
                'INSPECAO',
                'SINISTRO'
            )
        ),

    CONSTRAINT chk_os_gravidade
        CHECK (
            gravidade IN (
                'BAIXA',
                'MEDIA',
                'ALTA'
            )
        ),

    CONSTRAINT chk_os_status
        CHECK (
            status IN (
                'EM_ANALISE',
                'EM_MANUTENCAO',
                'RESOLVIDA',
                'CANCELADA'
            )
        ),

    CONSTRAINT chk_os_custo
        CHECK (
            custo IS NULL OR custo >= 0
        ),

    CONSTRAINT chk_os_datas
        CHECK (
            (data_inicio IS NULL OR data_inicio >= data_abertura)
            AND
            (
                data_conclusao IS NULL
                OR data_conclusao >= COALESCE(data_inicio, data_abertura)
            )
        ),

    CONSTRAINT chk_os_resolvida
        CHECK (
            status <> 'RESOLVIDA'
            OR (
                data_conclusao IS NOT NULL
                AND servico_realizado IS NOT NULL
            )
        )
);

CREATE TABLE os_peca (
    id_os_peca BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_os BIGINT NOT NULL,
    descricao VARCHAR(200) NOT NULL,
    quantidade INT NOT NULL,
    observacao TEXT,

    CONSTRAINT fk_os_peca_os
        FOREIGN KEY (id_os)
        REFERENCES ordem_servico (id_os),

    CONSTRAINT chk_os_peca_quantidade
        CHECK (quantidade > 0)
);

CREATE TABLE sinistro (
    id_sinistro BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_veiculo BIGINT NOT NULL,
    id_servidor BIGINT NOT NULL,
    data DATE NOT NULL,
    hora TIME NOT NULL,
    local VARCHAR(255) NOT NULL,
    descricao TEXT NOT NULL,
    bo VARCHAR(100),
    observacoes TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'ABERTO',
    id_responsavel BIGINT NOT NULL,
    id_os BIGINT,

    CONSTRAINT fk_sinistro_veiculo
        FOREIGN KEY (id_veiculo)
        REFERENCES veiculo (id_veiculo),

    CONSTRAINT fk_sinistro_servidor
        FOREIGN KEY (id_servidor)
        REFERENCES servidor (id_servidor),

    CONSTRAINT fk_sinistro_responsavel
        FOREIGN KEY (id_responsavel)
        REFERENCES usuario (id_usuario),

    CONSTRAINT fk_sinistro_os
        FOREIGN KEY (id_os)
        REFERENCES ordem_servico (id_os),

    CONSTRAINT chk_sinistro_status
        CHECK (
            status IN (
                'ABERTO',
                'EM_ANALISE',
                'RESOLVIDO',
                'ENCERRADO'
            )
        )
);

-- ============================================================
-- 3. FISCALIZAÇÃO
-- ============================================================

CREATE TABLE equipe (
    id_equipe BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    numero VARCHAR(30) NOT NULL UNIQUE,
    tipo VARCHAR(20) NOT NULL,
    status BOOLEAN NOT NULL DEFAULT TRUE,
    observacoes TEXT,

    CONSTRAINT chk_equipe_tipo
        CHECK (tipo IN ('FIXA', 'TEMPORARIA'))
);

CREATE TABLE equipe_servidor (
    id_equipe BIGINT NOT NULL,
    id_servidor BIGINT NOT NULL,
    data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    data_fim DATE,
    status BOOLEAN NOT NULL DEFAULT TRUE,

    PRIMARY KEY (id_equipe, id_servidor, data_inicio),

    CONSTRAINT fk_equipe_servidor_equipe
        FOREIGN KEY (id_equipe)
        REFERENCES equipe (id_equipe),

    CONSTRAINT fk_equipe_servidor_servidor
        FOREIGN KEY (id_servidor)
        REFERENCES servidor (id_servidor),

    CONSTRAINT chk_equipe_servidor_datas
        CHECK (
            data_fim IS NULL
            OR data_fim >= data_inicio
        )
);

CREATE TABLE equipe_turno (
    id_equipe_turno BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_equipe BIGINT NOT NULL,
    turno VARCHAR(20) NOT NULL,
    data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    data_fim DATE,
    motivo TEXT,
    alterado_por BIGINT NOT NULL,

    CONSTRAINT fk_equipe_turno_equipe
        FOREIGN KEY (id_equipe)
        REFERENCES equipe (id_equipe),

    CONSTRAINT fk_equipe_turno_usuario
        FOREIGN KEY (alterado_por)
        REFERENCES usuario (id_usuario),

    CONSTRAINT chk_equipe_turno_tipo
        CHECK (turno IN ('DIURNO', 'NOTURNO')),

    CONSTRAINT chk_equipe_turno_datas
        CHECK (
            data_fim IS NULL
            OR data_fim >= data_inicio
        )
);

CREATE TABLE servico_diario (
    id_servico_diario BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    data DATE NOT NULL,
    turno VARCHAR(20) NOT NULL,
    id_coordenador BIGINT NOT NULL,
    criado_por BIGINT NOT NULL,
    hora_criacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    hora_inicio TIME NOT NULL,
    hora_encerramento TIME,
    status VARCHAR(30) NOT NULL DEFAULT 'PLANEJADO',
    encerrado_por BIGINT,

    CONSTRAINT fk_servico_coordenador
        FOREIGN KEY (id_coordenador)
        REFERENCES servidor (id_servidor),

    CONSTRAINT fk_servico_criado_por
        FOREIGN KEY (criado_por)
        REFERENCES usuario (id_usuario),

    CONSTRAINT fk_servico_encerrado_por
        FOREIGN KEY (encerrado_por)
        REFERENCES usuario (id_usuario),

    CONSTRAINT chk_servico_turno
        CHECK (turno IN ('DIURNO', 'NOTURNO')),

    CONSTRAINT chk_servico_status
        CHECK (status IN ('PLANEJADO', 'EM_SERVICO', 'ENCERRADO'))
);

CREATE UNIQUE INDEX uq_servico_diario_data_turno
ON servico_diario (data, turno);

CREATE OR REPLACE FUNCTION validar_horario_servico_diario()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.turno = 'DIURNO' AND NEW.hora_inicio <> TIME '07:00' THEN
        RAISE EXCEPTION 'Serviço Diário diurno deve iniciar às 07:00.';
    END IF;

    IF NEW.turno = 'NOTURNO' AND NEW.hora_inicio <> TIME '19:00' THEN
        RAISE EXCEPTION 'Serviço Diário noturno deve iniciar às 19:00.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_horario_servico_diario
BEFORE INSERT OR UPDATE OF turno, hora_inicio
ON servico_diario
FOR EACH ROW
EXECUTE FUNCTION validar_horario_servico_diario();

CREATE TABLE servico_equipe (
    id_servico_equipe BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_servico_diario BIGINT NOT NULL,
    id_equipe BIGINT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ATIVA',

    CONSTRAINT fk_servico_equipe_servico
        FOREIGN KEY (id_servico_diario)
        REFERENCES servico_diario (id_servico_diario),

    CONSTRAINT fk_servico_equipe_equipe
        FOREIGN KEY (id_equipe)
        REFERENCES equipe (id_equipe),

    CONSTRAINT uq_servico_equipe
        UNIQUE (id_servico_diario, id_equipe),

    CONSTRAINT chk_servico_equipe_status
        CHECK (status IN ('ATIVA', 'FINALIZADA', 'CANCELADA'))
);

CREATE TABLE apoio_extra (
    id_apoio BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_servico_diario BIGINT NOT NULL,
    id_equipe BIGINT NOT NULL,
    id_veiculo BIGINT NOT NULL,
    id_servidor BIGINT NOT NULL,
    motivo TEXT NOT NULL,
    hora_inicio TIMESTAMP NOT NULL,
    hora_fim TIMESTAMP,
    observacoes TEXT,

    CONSTRAINT fk_apoio_servico
        FOREIGN KEY (id_servico_diario)
        REFERENCES servico_diario (id_servico_diario),

    CONSTRAINT fk_apoio_equipe
        FOREIGN KEY (id_equipe)
        REFERENCES equipe (id_equipe),

    CONSTRAINT fk_apoio_veiculo
        FOREIGN KEY (id_veiculo)
        REFERENCES veiculo (id_veiculo),

    CONSTRAINT fk_apoio_servidor
        FOREIGN KEY (id_servidor)
        REFERENCES servidor (id_servidor),

    CONSTRAINT chk_apoio_horario
        CHECK (
            hora_fim IS NULL
            OR hora_fim >= hora_inicio
        )
);

CREATE TABLE ocorrencia (
    id_ocorrencia BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    protocolo VARCHAR(100),
    tipo VARCHAR(20) NOT NULL,
    descricao TEXT NOT NULL,
    data DATE NOT NULL,
    hora TIME NOT NULL,
    endereco VARCHAR(255) NOT NULL,
    observacoes TEXT,
    id_servico_diario BIGINT NOT NULL,
    criado_por BIGINT NOT NULL,
    data_criacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDENTE',
    descricao_atendimento TEXT,
    data_finalizacao TIMESTAMP,

    CONSTRAINT fk_ocorrencia_servico
        FOREIGN KEY (id_servico_diario)
        REFERENCES servico_diario (id_servico_diario),

    CONSTRAINT fk_ocorrencia_criado_por
        FOREIGN KEY (criado_por)
        REFERENCES usuario (id_usuario),

    CONSTRAINT chk_ocorrencia_tipo
        CHECK (
            tipo IN ('PROGRAMADA', 'QRU')
        ),

    CONSTRAINT chk_ocorrencia_status
        CHECK (
            status IN (
                'PENDENTE',
                'ATRIBUIDA',
                'EM_ANDAMENTO',
                'FINALIZADA',
                'INTERCORRENCIA'
            )
        ),

    CONSTRAINT chk_ocorrencia_finalizacao
        CHECK (
            status <> 'FINALIZADA'
            OR (
                descricao_atendimento IS NOT NULL
                AND data_finalizacao IS NOT NULL
            )
        )
);

CREATE TABLE distribuicao_ocorrencia (
    id_distribuicao BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_ocorrencia BIGINT NOT NULL,
    id_servico_diario BIGINT NOT NULL,
    id_equipe BIGINT NOT NULL,
    id_veiculo BIGINT NOT NULL,
    id_coordenador BIGINT NOT NULL,
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    hora TIME NOT NULL DEFAULT CURRENT_TIME,
    tipo VARCHAR(30) NOT NULL DEFAULT 'ATRIBUICAO',
    motivo_reatribuicao TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ATIVA',

    CONSTRAINT fk_distribuicao_ocorrencia
        FOREIGN KEY (id_ocorrencia)
        REFERENCES ocorrencia (id_ocorrencia),

    CONSTRAINT fk_distribuicao_servico
        FOREIGN KEY (id_servico_diario)
        REFERENCES servico_diario (id_servico_diario),

    CONSTRAINT fk_distribuicao_equipe
        FOREIGN KEY (id_equipe)
        REFERENCES equipe (id_equipe),

    CONSTRAINT fk_distribuicao_veiculo
        FOREIGN KEY (id_veiculo)
        REFERENCES veiculo (id_veiculo),

    CONSTRAINT fk_distribuicao_coordenador
        FOREIGN KEY (id_coordenador)
        REFERENCES servidor (id_servidor),

    CONSTRAINT chk_distribuicao_tipo
        CHECK (
            tipo IN ('ATRIBUICAO', 'REATRIBUICAO')
        ),

    CONSTRAINT chk_distribuicao_status
        CHECK (
            status IN ('ATIVA', 'FINALIZADA', 'CANCELADA')
        ),

    CONSTRAINT chk_reatribuicao_motivo
        CHECK (
            tipo <> 'REATRIBUICAO'
            OR motivo_reatribuicao IS NOT NULL
        )
);

CREATE UNIQUE INDEX uq_distribuicao_ocorrencia_ativa
ON distribuicao_ocorrencia (id_ocorrencia)
WHERE status = 'ATIVA';

CREATE TABLE checklist_fiscalizacao (
    id_checklist BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_veiculo BIGINT NOT NULL,
    id_servico_diario BIGINT NOT NULL,
    id_equipe BIGINT NOT NULL,
    data_abertura DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_saida TIME NOT NULL DEFAULT CURRENT_TIME,
    hora_chegada TIME,
    odometro_saida INT NOT NULL,
    odometro_chegada INT,
    observacoes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ABERTO',
    data_finalizacao TIMESTAMP,

    CONSTRAINT fk_checklist_fiscal_veiculo
        FOREIGN KEY (id_veiculo)
        REFERENCES veiculo (id_veiculo),

    CONSTRAINT fk_checklist_fiscal_servico
        FOREIGN KEY (id_servico_diario)
        REFERENCES servico_diario (id_servico_diario),

    CONSTRAINT fk_checklist_fiscal_equipe
        FOREIGN KEY (id_equipe)
        REFERENCES equipe (id_equipe),

    CONSTRAINT chk_checklist_fiscal_status
        CHECK (status IN ('ABERTO', 'FINALIZADO')),

    CONSTRAINT chk_checklist_fiscal_odometro
        CHECK (
            odometro_chegada IS NULL
            OR odometro_chegada >= odometro_saida
        ),

    CONSTRAINT chk_checklist_fiscal_finalizacao
        CHECK (
            status = 'ABERTO'
            OR (
                hora_chegada IS NOT NULL
                AND odometro_chegada IS NOT NULL
                AND data_finalizacao IS NOT NULL
            )
        )
);

CREATE UNIQUE INDEX uq_checklist_fiscal_ativo
ON checklist_fiscalizacao (id_veiculo)
WHERE status = 'ABERTO';

CREATE TABLE checklist_fiscal_servidor (
    id_checklist BIGINT NOT NULL,
    id_servidor BIGINT NOT NULL,
    tipo VARCHAR(20) NOT NULL,

    PRIMARY KEY (id_checklist, id_servidor),

    CONSTRAINT fk_checklist_fiscal_servidor_checklist
        FOREIGN KEY (id_checklist)
        REFERENCES checklist_fiscalizacao (id_checklist),

    CONSTRAINT fk_checklist_fiscal_servidor_servidor
        FOREIGN KEY (id_servidor)
        REFERENCES servidor (id_servidor),

    CONSTRAINT chk_checklist_fiscal_servidor_tipo
        CHECK (tipo IN ('FISCAL_1', 'FISCAL_2'))
);

CREATE UNIQUE INDEX uq_checklist_fiscal_fiscal1
ON checklist_fiscal_servidor (id_checklist)
WHERE tipo = 'FISCAL_1';

CREATE UNIQUE INDEX uq_checklist_fiscal_fiscal2
ON checklist_fiscal_servidor (id_checklist)
WHERE tipo = 'FISCAL_2';

CREATE OR REPLACE FUNCTION validar_dois_fiscais_checklist()
RETURNS TRIGGER AS $$
DECLARE
    total_fiscais INT;
    fiscal_1 INT;
    fiscal_2 INT;
BEGIN
    IF NEW.status = 'FINALIZADO' THEN
        SELECT COUNT(*),
               COUNT(*) FILTER (WHERE tipo = 'FISCAL_1'),
               COUNT(*) FILTER (WHERE tipo = 'FISCAL_2')
        INTO total_fiscais, fiscal_1, fiscal_2
        FROM checklist_fiscal_servidor
        WHERE id_checklist = NEW.id_checklist;

        IF total_fiscais <> 2 OR fiscal_1 <> 1 OR fiscal_2 <> 1 THEN
            RAISE EXCEPTION
                'O Checklist da Fiscalização exige exatamente dois fiscais: Fiscal 1 e Fiscal 2.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_dois_fiscais_checklist
BEFORE UPDATE OF status
ON checklist_fiscalizacao
FOR EACH ROW
EXECUTE FUNCTION validar_dois_fiscais_checklist();

CREATE TABLE checklist_fiscal_equipamento (
    id_checklist BIGINT NOT NULL,
    id_equipamento BIGINT NOT NULL,
    etapa VARCHAR(20) NOT NULL,
    quantidade INT NOT NULL,
    observacao TEXT,

    PRIMARY KEY (id_checklist, id_equipamento, etapa),

    CONSTRAINT fk_checklist_fiscal_equipamento_checklist
        FOREIGN KEY (id_checklist)
        REFERENCES checklist_fiscalizacao (id_checklist),

    CONSTRAINT fk_checklist_fiscal_equipamento_equipamento
        FOREIGN KEY (id_equipamento)
        REFERENCES equipamento (id_equipamento),

    CONSTRAINT chk_checklist_fiscal_equipamento_etapa
        CHECK (
            etapa IN ('SAIDA', 'CHEGADA')
        ),

    CONSTRAINT chk_checklist_fiscal_equipamento_quantidade
        CHECK (
            quantidade >= 0
        )
);

-- ============================================================
-- 4. RELATÓRIOS / ANEXOS / ATESTAÇÃO
-- ============================================================

CREATE TABLE relatorio (
    id_relatorio BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    modulo VARCHAR(30) NOT NULL,
    periodo_inicio DATE,
    periodo_fim DATE,
    filtros JSONB,
    gerado_por BIGINT NOT NULL,
    data_geracao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    formato VARCHAR(10) NOT NULL,

    CONSTRAINT fk_relatorio_usuario
        FOREIGN KEY (gerado_por)
        REFERENCES usuario (id_usuario),

    CONSTRAINT chk_relatorio_modulo
        CHECK (
            modulo IN ('FROTAS', 'FISCALIZACAO')
        ),

    CONSTRAINT chk_relatorio_formato
        CHECK (
            formato IN ('PDF', 'EXCEL')
        ),

    CONSTRAINT chk_relatorio_periodo
        CHECK (
            periodo_fim IS NULL
            OR periodo_inicio IS NULL
            OR periodo_fim >= periodo_inicio
        )
);

CREATE TABLE anexo (
    id_anexo BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo_entidade VARCHAR(50) NOT NULL,
    id_registro BIGINT NOT NULL,
    nome_arquivo VARCHAR(255) NOT NULL,
    tipo_arquivo VARCHAR(100) NOT NULL,
    tamanho BIGINT NOT NULL,
    caminho TEXT NOT NULL,
    enviado_por BIGINT NOT NULL,
    data_envio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT fk_anexo_usuario
        FOREIGN KEY (enviado_por)
        REFERENCES usuario (id_usuario),

    CONSTRAINT chk_anexo_tamanho
        CHECK (tamanho > 0),

    CONSTRAINT chk_anexo_tipo
        CHECK (
            LOWER(tipo_arquivo) IN (
                'application/pdf',
                'image/jpeg',
                'image/png',
                'image/webp'
            )
        )
);

CREATE TABLE atestacao (
    id_atestacao BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_relatorio BIGINT NOT NULL,
    id_usuario BIGINT NOT NULL,
    ordem SMALLINT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDENTE',
    data_solicitacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_atestacao TIMESTAMP,
    observacao TEXT,

    CONSTRAINT fk_atestacao_relatorio
        FOREIGN KEY (id_relatorio)
        REFERENCES relatorio (id_relatorio),

    CONSTRAINT fk_atestacao_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuario (id_usuario),

    CONSTRAINT uq_atestacao_ordem
        UNIQUE (id_relatorio, ordem),

    CONSTRAINT chk_atestacao_ordem
        CHECK (ordem BETWEEN 1 AND 3),

    CONSTRAINT chk_atestacao_status
        CHECK (
            status IN ('PENDENTE', 'ATESTADO', 'RECUSADO')
        ),

    CONSTRAINT chk_atestacao_data
        CHECK (
            status = 'PENDENTE'
            OR data_atestacao IS NOT NULL
        )
);

-- ============================================================
-- 5. AUDITORIA
-- ============================================================

CREATE TABLE auditoria (
    id_auditoria BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario BIGINT NOT NULL,
    acao VARCHAR(50) NOT NULL,
    entidade VARCHAR(100) NOT NULL,
    id_registro BIGINT NOT NULL,
    data_hora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    justificativa TEXT,
    dados_anteriores JSONB,
    dados_novos JSONB,

    CONSTRAINT fk_auditoria_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuario (id_usuario)
);

-- ============================================================
-- 6. ÍNDICES
-- ============================================================

CREATE INDEX idx_veiculo_status
    ON veiculo (status);

CREATE INDEX idx_documento_veiculo_validade
    ON documento_veiculo (data_validade);

CREATE INDEX idx_checklist_frotas_veiculo
    ON checklist_frotas (id_veiculo);

CREATE INDEX idx_checklist_frotas_servidor
    ON checklist_frotas (id_servidor);

CREATE UNIQUE INDEX uq_checklist_frotas_ativo
    ON checklist_frotas (id_veiculo)
    WHERE status = 'ABERTO';

CREATE INDEX idx_inspecao_veiculo_data
    ON inspecao (id_veiculo, data_realizacao);

CREATE INDEX idx_os_veiculo_status
    ON ordem_servico (id_veiculo, status);

CREATE INDEX idx_sinistro_veiculo_data
    ON sinistro (id_veiculo, data);

CREATE INDEX idx_servico_diario_data
    ON servico_diario (data);

CREATE INDEX idx_ocorrencia_status
    ON ocorrencia (status);

CREATE INDEX idx_ocorrencia_servico
    ON ocorrencia (id_servico_diario);

CREATE INDEX idx_anexo_entidade_registro
    ON anexo (tipo_entidade, id_registro);

CREATE INDEX idx_atestacao_usuario_status
    ON atestacao (id_usuario, status);

-- ============================================================
-- 7. FUNÇÃO: VALIDAR ODÔMETRO
-- ============================================================

CREATE OR REPLACE FUNCTION validar_odometro_checklist()
RETURNS TRIGGER AS $$
DECLARE
    ultimo_odometro INT;
BEGIN
    SELECT GREATEST(
        COALESCE(
            (
                SELECT v.quilometragem_atual
                FROM veiculo v
                WHERE v.id_veiculo = NEW.id_veiculo
            ),
            0
        ),
        COALESCE(
            (
                SELECT MAX(x.odometro)
                FROM (
                    SELECT cf.odometro_saida AS odometro
                    FROM checklist_frotas cf
                    WHERE cf.id_veiculo = NEW.id_veiculo

                    UNION ALL

                    SELECT cf.odometro_chegada AS odometro
                    FROM checklist_frotas cf
                    WHERE cf.id_veiculo = NEW.id_veiculo
                      AND cf.odometro_chegada IS NOT NULL

                    UNION ALL

                    SELECT cfx.odometro_saida AS odometro
                    FROM checklist_fiscalizacao cfx
                    WHERE cfx.id_veiculo = NEW.id_veiculo

                    UNION ALL

                    SELECT cfx.odometro_chegada AS odometro
                    FROM checklist_fiscalizacao cfx
                    WHERE cfx.id_veiculo = NEW.id_veiculo
                      AND cfx.odometro_chegada IS NOT NULL
                ) x
            ),
            0
        )
    )
    INTO ultimo_odometro;

    IF NEW.odometro_saida < ultimo_odometro THEN
        RAISE EXCEPTION
            'Odômetro inválido. O valor informado (%) é menor que o último registrado (%).',
            NEW.odometro_saida,
            ultimo_odometro;
    END IF;

    IF NEW.odometro_chegada IS NOT NULL
       AND NEW.odometro_chegada < NEW.odometro_saida THEN
        RAISE EXCEPTION
            'Odômetro de chegada não pode ser menor que o odômetro de saída.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_odometro_frotas
BEFORE INSERT OR UPDATE OF odometro_saida, odometro_chegada
ON checklist_frotas
FOR EACH ROW
EXECUTE FUNCTION validar_odometro_checklist();

CREATE TRIGGER trg_validar_odometro_fiscalizacao
BEFORE INSERT OR UPDATE OF odometro_saida, odometro_chegada
ON checklist_fiscalizacao
FOR EACH ROW
EXECUTE FUNCTION validar_odometro_checklist();

-- ============================================================
-- 8. FUNÇÃO: VALIDAR VEÍCULO PARA CHECKLIST
-- ============================================================

CREATE OR REPLACE FUNCTION validar_veiculo_para_checklist()
RETURNS TRIGGER AS $$
DECLARE
    situacao VARCHAR(30);
BEGIN
    SELECT status
    INTO situacao
    FROM veiculo
    WHERE id_veiculo = NEW.id_veiculo;

    IF situacao IS NULL THEN
        RAISE EXCEPTION 'Veículo não encontrado.';
    END IF;

    IF situacao IN ('EM_MANUTENCAO', 'INATIVO') THEN
        RAISE EXCEPTION
            'Veículo não pode iniciar checklist. Situação atual: %.',
            situacao;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_veiculo_checklist_frotas
BEFORE INSERT ON checklist_frotas
FOR EACH ROW
EXECUTE FUNCTION validar_veiculo_para_checklist();

CREATE TRIGGER trg_validar_veiculo_checklist_fiscalizacao
BEFORE INSERT ON checklist_fiscalizacao
FOR EACH ROW
EXECUTE FUNCTION validar_veiculo_para_checklist();

-- ============================================================
-- 9. FUNÇÃO: STATUS DO VEÍCULO NO CHECKLIST FROTAS
-- ============================================================

CREATE OR REPLACE FUNCTION atualizar_status_veiculo_checklist_frotas()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'ABERTO' THEN
        UPDATE veiculo
        SET status = 'EM_USO'
        WHERE id_veiculo = NEW.id_veiculo
          AND status = 'DISPONIVEL';

    ELSIF NEW.status = 'FINALIZADO' THEN
        UPDATE veiculo
        SET
            status = 'DISPONIVEL',
            quilometragem_atual = GREATEST(
                quilometragem_atual,
                COALESCE(NEW.odometro_chegada, quilometragem_atual)
            )
        WHERE id_veiculo = NEW.id_veiculo
          AND status = 'EM_USO';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_status_veiculo_checklist_frotas
AFTER INSERT OR UPDATE OF status
ON checklist_frotas
FOR EACH ROW
EXECUTE FUNCTION atualizar_status_veiculo_checklist_frotas();

-- ============================================================
-- 10. FUNÇÃO: ODÔMETRO E STATUS DA VIATURA FISCALIZAÇÃO
-- ============================================================

CREATE OR REPLACE FUNCTION atualizar_veiculo_checklist_fiscalizacao()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'ABERTO' THEN
        UPDATE veiculo
        SET status = 'EM_USO'
        WHERE id_veiculo = NEW.id_veiculo
          AND status = 'DISPONIVEL';

    ELSIF NEW.status = 'FINALIZADO' THEN
        UPDATE veiculo
        SET
            status = 'DISPONIVEL',
            quilometragem_atual = GREATEST(
                quilometragem_atual,
                COALESCE(NEW.odometro_chegada, quilometragem_atual)
            )
        WHERE id_veiculo = NEW.id_veiculo
          AND status = 'EM_USO';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_veiculo_checklist_fiscalizacao
AFTER INSERT OR UPDATE OF status
ON checklist_fiscalizacao
FOR EACH ROW
EXECUTE FUNCTION atualizar_veiculo_checklist_fiscalizacao();

-- ============================================================
-- 11. FUNÇÃO: FINALIZAÇÃO DE INSPEÇÃO
-- ============================================================

CREATE OR REPLACE FUNCTION validar_finalizacao_inspecao()
RETURNS TRIGGER AS $$
DECLARE
    total_itens INT;
    itens_completos INT;
    itens_com_avaria INT;
BEGIN
    IF NEW.status = 'FINALIZADA' THEN

        SELECT COUNT(*)
        INTO total_itens
        FROM inspecao_item
        WHERE id_inspecao = NEW.id_inspecao;

        SELECT COUNT(*)
        INTO itens_completos
        FROM inspecao_item
        WHERE id_inspecao = NEW.id_inspecao
          AND resultado IN ('NORMAL', 'AVARIA');

        SELECT COUNT(*)
        INTO itens_com_avaria
        FROM inspecao_item
        WHERE id_inspecao = NEW.id_inspecao
          AND resultado = 'AVARIA';

        IF total_itens = 0 OR total_itens <> itens_completos THEN
            RAISE EXCEPTION
                'A inspeção não pode ser finalizada sem todos os itens registrados.';
        END IF;

        NEW.resultado :=
            CASE
                WHEN itens_com_avaria > 0 THEN 'COM_AVARIAS'
                ELSE 'CONFORME'
            END;

        IF NEW.data_finalizacao IS NULL THEN
            NEW.data_finalizacao := CURRENT_TIMESTAMP;
        END IF;

        IF NEW.hora_finalizacao IS NULL THEN
            NEW.hora_finalizacao := CURRENT_TIME;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_finalizacao_inspecao
BEFORE UPDATE OF status
ON inspecao
FOR EACH ROW
EXECUTE FUNCTION validar_finalizacao_inspecao();

-- ============================================================
-- 12. FUNÇÃO: STATUS DE DOCUMENTO
-- ============================================================

CREATE OR REPLACE FUNCTION atualizar_status_documento()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'INATIVO' THEN
        RETURN NEW;
    END IF;

    IF NEW.data_validade IS NULL THEN
        NEW.status := 'VALIDO';

    ELSIF NEW.data_validade < CURRENT_DATE THEN
        NEW.status := 'VENCIDO';

    ELSIF NEW.data_validade <= CURRENT_DATE + 15 THEN
        NEW.status := 'VENCENDO';

    ELSIF NEW.data_validade <= CURRENT_DATE + 30 THEN
        NEW.status := 'VENCENDO';

    ELSIF NEW.data_validade <= CURRENT_DATE + 90 THEN
        NEW.status := 'VENCENDO';

    ELSE
        NEW.status := 'VALIDO';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_status_documento
BEFORE INSERT OR UPDATE OF data_validade, status
ON documento_veiculo
FOR EACH ROW
EXECUTE FUNCTION atualizar_status_documento();

-- ============================================================
-- 13. FUNÇÃO: VALIDAÇÃO DE ATESTAÇÃO
-- ============================================================

CREATE OR REPLACE FUNCTION validar_atestacao()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'ATESTADO' AND NEW.data_atestacao IS NULL THEN
        NEW.data_atestacao := CURRENT_TIMESTAMP;
    END IF;

    IF NEW.status = 'RECUSADO' AND NEW.observacao IS NULL THEN
        RAISE EXCEPTION
            'Uma atestação recusada deve possuir uma observação.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_atestacao
BEFORE INSERT OR UPDATE OF status
ON atestacao
FOR EACH ROW
EXECUTE FUNCTION validar_atestacao();

-- ============================================================
-- 14. AUDITORIA
-- ============================================================

CREATE OR REPLACE FUNCTION registrar_auditoria(
    p_id_usuario BIGINT,
    p_acao VARCHAR,
    p_entidade VARCHAR,
    p_id_registro BIGINT,
    p_justificativa TEXT DEFAULT NULL,
    p_dados_anteriores JSONB DEFAULT NULL,
    p_dados_novos JSONB DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    novo_id BIGINT;
BEGIN
    INSERT INTO auditoria (
        id_usuario,
        acao,
        entidade,
        id_registro,
        justificativa,
        dados_anteriores,
        dados_novos
    )
    VALUES (
        p_id_usuario,
        p_acao,
        p_entidade,
        p_id_registro,
        p_justificativa,
        p_dados_anteriores,
        p_dados_novos
    )
    RETURNING id_auditoria INTO novo_id;

    RETURN novo_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 15. FINALIZAÇÃO
-- ============================================================

COMMIT;

-- ============================================================
-- FIM DO SCRIPT SITRA V1
-- ============================================================
