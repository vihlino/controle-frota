-- 041_servico_turno_0600.sql (18/10/2026)
-- O turno diurno passou a ser das 06:00 as 19:00 (definicao do Cesar para as
-- equipes, 18/10). O servico diario segue o mesmo horario: o diurno comeca as
-- 06:00 e o noturno as 19:00. Servicos antigos (diurno as 07:00) continuam
-- valendo - a regra so e conferida quando o turno ou a hora mudam.
CREATE OR REPLACE FUNCTION validar_horario_servico_diario()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.turno = OLD.turno
       AND NEW.hora_inicio IS NOT DISTINCT FROM OLD.hora_inicio THEN
        RETURN NEW;
    END IF;

    IF NEW.turno = 'DIURNO' AND NEW.hora_inicio <> TIME '06:00' THEN
        RAISE EXCEPTION 'Serviço Diário diurno deve iniciar às 06:00.';
    END IF;

    IF NEW.turno = 'NOTURNO' AND NEW.hora_inicio <> TIME '19:00' THEN
        RAISE EXCEPTION 'Serviço Diário noturno deve iniciar às 19:00.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
