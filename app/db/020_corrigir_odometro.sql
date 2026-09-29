-- ============================================================
-- SITRA - a validacao de odometro deixa de impedir a CORRECAO
-- Aplicar depois do 019_editar_checklist.sql.
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================
BEGIN;

-- O QUE ESTAVA ERRADO
--
-- A regra "o odometro nao pode ser menor que o ultimo registrado" existe por
-- um bom motivo: no momento em que o condutor ABRE um checklist, um numero
-- menor que a ultima leitura da frota so pode ser erro de digitacao - km de
-- carro nao anda para tras.
--
-- Mas o gatilho valia tambem no UPDATE, e ai a mesma regra virava o contrario
-- de si mesma. Quem abria a tela de correcao justamente para consertar um
-- odometro digitado errado era barrado - e comparado contra o QUE? Contra o
-- maior valor ja registrado do veiculo, que INCLUI a propria linha sendo
-- corrigida e a quilometragem do veiculo, que foi gravada a partir dela.
--
-- Ou seja: o numero errado se tornava a prova de que a correcao estava errada.
-- Corrigir 25 para 20 era recusado porque 20 e menor que 25 - e 25 era
-- exatamente o valor que se queria apagar. Nem mexer em outro campo passava:
-- o gatilho dispara quando a coluna aparece no UPDATE, mesmo com o valor
-- igual.
--
-- O QUE PASSA A VALER
--
--   INSERT (checklist nascendo do QR Code): a regra continua inteira. E ali
--   que ela protege - o condutor digita 10 onde e 100, e o sistema recusa na
--   hora, antes de o numero errado entrar no historico.
--
--   UPDATE (correcao pela gestao): fica so a regra que e sempre verdadeira
--   sobre a propria linha - a chegada nao pode ser menor que a saida, senao o
--   veiculo teria rodado uma distancia negativa. Quem corrige esta olhando o
--   documento, a foto do painel ou o proprio veiculo; o banco nao tem como
--   saber mais do que essa pessoa, e a alteracao fica registrada na auditoria
--   com o valor anterior, que e o controle de verdade.
CREATE OR REPLACE FUNCTION validar_odometro_checklist()
RETURNS TRIGGER AS $$
DECLARE
    ultimo_odometro INT;
BEGIN
    -- A chegada nunca pode ser menor que a saida. Vale na criacao e na
    -- correcao: e uma afirmacao sobre esta viagem, nao sobre o historico.
    IF NEW.odometro_chegada IS NOT NULL
       AND NEW.odometro_chegada < NEW.odometro_saida THEN
        RAISE EXCEPTION
            'O odômetro de chegada (%) não pode ser menor que o de saída (%).',
            NEW.odometro_chegada,
            NEW.odometro_saida;
    END IF;

    -- Correcao para aqui: o resto e regra de checklist NOVO.
    IF TG_OP = 'UPDATE' THEN
        RETURN NEW;
    END IF;

    SELECT GREATEST(
        COALESCE((SELECT v.quilometragem_atual FROM veiculo v
                   WHERE v.id_veiculo = NEW.id_veiculo), 0),
        COALESCE((
            SELECT MAX(x.odometro) FROM (
                SELECT cf.odometro_saida AS odometro FROM checklist_frotas cf
                 WHERE cf.id_veiculo = NEW.id_veiculo
                UNION ALL
                SELECT cf.odometro_chegada FROM checklist_frotas cf
                 WHERE cf.id_veiculo = NEW.id_veiculo AND cf.odometro_chegada IS NOT NULL
                UNION ALL
                SELECT cfx.odometro_saida FROM checklist_fiscalizacao cfx
                 WHERE cfx.id_veiculo = NEW.id_veiculo
                UNION ALL
                SELECT cfx.odometro_chegada FROM checklist_fiscalizacao cfx
                 WHERE cfx.id_veiculo = NEW.id_veiculo AND cfx.odometro_chegada IS NOT NULL
            ) x
        ), 0)
    )
    INTO ultimo_odometro;

    IF NEW.odometro_saida < ultimo_odometro THEN
        RAISE EXCEPTION
            'Odômetro inválido. O valor informado (%) é menor que o último registrado (%).',
            NEW.odometro_saida,
            ultimo_odometro;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- A quilometragem do veiculo acompanha a correcao
-- ============================================================
--
-- A quilometragem do veiculo e gravada a partir do checklist. Corrigido o
-- checklist, ela ficava com o numero antigo - e o PROXIMO checklist do
-- condutor seria validado contra esse numero errado, recusando um valor
-- correto. A correcao precisa alcancar as duas pontas.
--
-- O valor e RECALCULADO (a maior leitura que o veiculo tem), e nao simplesmente
-- copiado: se a correcao baixou o odometro desta viagem, a quilometragem do
-- veiculo pode continuar vindo de outro checklist, mais recente.
CREATE OR REPLACE FUNCTION sitra_km_veiculo_apos_correcao()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE veiculo v
       SET quilometragem_atual = COALESCE((
           SELECT MAX(x.odometro) FROM (
               SELECT cf.odometro_saida AS odometro FROM checklist_frotas cf
                WHERE cf.id_veiculo = NEW.id_veiculo
               UNION ALL
               SELECT cf.odometro_chegada FROM checklist_frotas cf
                WHERE cf.id_veiculo = NEW.id_veiculo AND cf.odometro_chegada IS NOT NULL
               UNION ALL
               SELECT cfx.odometro_saida FROM checklist_fiscalizacao cfx
                WHERE cfx.id_veiculo = NEW.id_veiculo
               UNION ALL
               SELECT cfx.odometro_chegada FROM checklist_fiscalizacao cfx
                WHERE cfx.id_veiculo = NEW.id_veiculo AND cfx.odometro_chegada IS NOT NULL
           ) x
       ), v.quilometragem_atual)
     WHERE v.id_veiculo = NEW.id_veiculo;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_km_veiculo_frotas ON checklist_frotas;
CREATE TRIGGER trg_km_veiculo_frotas
    AFTER UPDATE OF odometro_saida, odometro_chegada ON checklist_frotas
    FOR EACH ROW EXECUTE FUNCTION sitra_km_veiculo_apos_correcao();

DROP TRIGGER IF EXISTS trg_km_veiculo_fiscalizacao ON checklist_fiscalizacao;
CREATE TRIGGER trg_km_veiculo_fiscalizacao
    AFTER UPDATE OF odometro_saida, odometro_chegada ON checklist_fiscalizacao
    FOR EACH ROW EXECUTE FUNCTION sitra_km_veiculo_apos_correcao();

COMMIT;
