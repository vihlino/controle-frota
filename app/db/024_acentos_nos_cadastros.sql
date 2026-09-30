-- ============================================================
-- 024 - Acentos nos cadastros da instalacao
-- ============================================================
--
-- O PROBLEMA
--
-- Os setores, cargos e perfis criados pela instalacao foram gravados sem
-- acento, porque os arquivos de codigo evitam acento de proposito. Mas eles
-- nao sao nomes internos: aparecem na tela. Em "Novo Cargo" a pessoa escolhe
-- entre "Fiscalizacao", "Gestao de Frotas" e "Tecnologia da Informacao", e o
-- sistema parece mal escrito - com razao, porque esta.
--
-- Isto conserta o que ja esta no banco. As origens (initDatabase.js, seed.js,
-- seedDemo.js) tambem foram corrigidas, para uma instalacao nova ja nascer
-- certa.
--
-- POR QUE E SEGURO RENOMEAR
--
-- Nada no sistema decide coisa alguma comparando o nome ao pe da letra:
--
--   - a marca de viatura vem de unaccent_simples(setor.nome) LIKE
--     '%FISCALIZACAO%' (migracao 016), que ja enxerga as duas grafias, e um
--     gatilho reaplica a marca quando o setor e renomeado;
--   - o cargo tem indice unico sobre unaccent_simples(nome), entao acentuar
--     NAO cria um cargo novo nem colide com o que existe;
--   - as permissoes dos perfis passaram a ser procuradas por
--     unaccent_simples(perfil.nome) nas migracoes 002, 010, 013 e 019.
--
-- Sem essa ultima mudanca, renomear o perfil aqui faria as migracoes seguintes
-- nao encontrarem mais "Gestor Fiscalizacao" - e o perfil perderia as
-- permissoes em silencio, sem erro nenhum no log.

-- ------------------------------------------------------------
-- Uma correcao por vez, so quando faz falta
-- ------------------------------------------------------------
-- Todo UPDATE aqui e guardado por duas condicoes:
--
--   1. unaccent_simples(nome) = <grafia sem acento>  -> e esta linha mesmo,
--      escrita de qualquer jeito;
--   2. nome <> <grafia certa>                        -> ainda nao foi corrigida.
--
-- A segunda evita reescrever a linha a cada subida da API (as migracoes sao
-- reaplicadas sempre), e com isso evita disparar gatilhos e encher a auditoria
-- de alteracao que nao houve.
--
-- Se a CMTT renomear um setor para outra coisa qualquer, o unaccent_simples
-- deixa de casar e o UPDATE simplesmente nao acha nada: a escolha deles fica
-- de pe.

DO $$
DECLARE
    -- grafia sem acento (chave)      | grafia correta
    correcoes_setor TEXT[][] := ARRAY[
        ['FISCALIZACAO',              'Fiscalização'],
        ['GESTAO DE FROTAS',          'Gestão de Frotas'],
        ['TECNOLOGIA DA INFORMACAO',  'Tecnologia da Informação']
    ];
    correcoes_cargo TEXT[][] := ARRAY[
        ['FISCAL DE TRANSITO',        'Fiscal de Trânsito'],
        ['GESTOR DE FISCALIZACAO',    'Gestor de Fiscalização'],
        ['AGENTE ADMINISTRATIVO',     'Agente Administrativo'],
        ['MECANICO',                  'Mecânico'],
        ['TECNICO',                   'Técnico']
    ];
    correcoes_perfil TEXT[][] := ARRAY[
        ['GESTOR FISCALIZACAO',       'Gestor Fiscalização']
    ];
    i INT;
BEGIN
    FOR i IN 1 .. array_length(correcoes_setor, 1) LOOP
        UPDATE setor
           SET nome = correcoes_setor[i][2]
         WHERE unaccent_simples(nome) = correcoes_setor[i][1]
           AND nome <> correcoes_setor[i][2]
           -- UNIQUE(nome): se alguem ja criou o setor com a grafia certa,
           -- renomear aqui estouraria a restricao e derrubaria a subida da API.
           AND NOT EXISTS (SELECT 1 FROM setor x WHERE x.nome = correcoes_setor[i][2]);
    END LOOP;

    FOR i IN 1 .. array_length(correcoes_cargo, 1) LOOP
        UPDATE cargo
           SET nome = correcoes_cargo[i][2]
         WHERE unaccent_simples(nome) = correcoes_cargo[i][1]
           AND nome <> correcoes_cargo[i][2];
    END LOOP;

    FOR i IN 1 .. array_length(correcoes_perfil, 1) LOOP
        UPDATE perfil
           SET nome = correcoes_perfil[i][2]
         WHERE unaccent_simples(nome) = correcoes_perfil[i][1]
           AND nome <> correcoes_perfil[i][2]
           AND NOT EXISTS (SELECT 1 FROM perfil x WHERE x.nome = correcoes_perfil[i][2]);
    END LOOP;
END
$$;

-- ------------------------------------------------------------
-- Descricoes, que tambem aparecem na tela
-- ------------------------------------------------------------
UPDATE setor SET descricao = 'Setor responsável pelo SITRA'
 WHERE unaccent_simples(descricao) = 'SETOR RESPONSAVEL PELO SITRA'
   AND descricao <> 'Setor responsável pelo SITRA';

UPDATE perfil SET descricao = 'Acesso completo ao módulo de Frotas'
 WHERE unaccent_simples(descricao) = 'ACESSO COMPLETO AO MODULO DE FROTAS'
   AND descricao <> 'Acesso completo ao módulo de Frotas';

UPDATE perfil SET descricao = 'Acesso completo ao módulo de Fiscalização'
 WHERE unaccent_simples(descricao) = 'ACESSO COMPLETO AO MODULO DE FISCALIZACAO'
   AND descricao <> 'Acesso completo ao módulo de Fiscalização';

-- ------------------------------------------------------------
-- cargo_funcao: o texto solto que sobrou antes de cargo virar cadastro
-- ------------------------------------------------------------
-- A coluna continua valendo (aparece em vw_perfil_usuario e nos relatorios de
-- rota), entao a grafia dela tambem chega na tela. Alinha com o cargo de
-- verdade em vez de repetir a lista de correcoes.
UPDATE servidor s
   SET cargo_funcao = c.nome
  FROM cargo c
 WHERE c.id_cargo = s.id_cargo
   AND s.cargo_funcao IS DISTINCT FROM c.nome;
