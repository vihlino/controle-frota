-- ============================================================
-- 023 - Situacao do documento calculada pela DATA, nao guardada
-- ============================================================
--
-- O PROBLEMA
--
-- A coluna documento_veiculo.status guardava a situacao (VALIDO, VENCENDO,
-- VENCIDO) e era escrita por um gatilho que so dispara em INSERT e UPDATE.
-- Ou seja: a situacao era congelada no dia do cadastro e nunca mais revista.
--
-- Um CRLV cadastrado em janeiro com validade em marco era gravado como
-- VENCENDO. Em abril ele estava vencido, mas a coluna continuava dizendo
-- VENCENDO - e a tela mostrava o absurdo "Vencido ha 10 dias" ao lado de um
-- selo amarelo "Vencendo". O dia passa; a linha do banco nao muda sozinha.
--
-- A SOLUCAO
--
-- Em vez de tentar manter a coluna sempre atualizada (o que exigiria uma
-- tarefa rodando todo dia - mais uma peca para dar errado), a situacao passa a
-- ser CALCULADA na hora da consulta, a partir de data_validade. Assim ela
-- nunca pode estar desatualizada: nao existe estado para envelhecer.
--
-- A coluna continua existindo e continua sendo preenchida pelo gatilho, por
-- dois motivos: o INATIVO (arquivado a mao) so existe ali, e as telas antigas
-- que leem a coluna direto continuam funcionando.

-- ------------------------------------------------------------
-- A regra, num lugar so
-- ------------------------------------------------------------
-- STABLE (e nao IMMUTABLE) porque o resultado depende de CURRENT_DATE: dentro
-- da mesma consulta o valor nao muda, mas amanha muda. Marcar como IMMUTABLE
-- permitiria ao Postgres guardar o resultado em indice e devolver a resposta
-- de ontem.
CREATE OR REPLACE FUNCTION situacao_documento(p_status TEXT, p_validade DATE)
RETURNS TEXT AS $$
BEGIN
    -- INATIVO e decisao de uma pessoa (documento arquivado), nao consequencia
    -- da data. Nenhuma conta de calendario pode desfazer isso.
    IF p_status = 'INATIVO' THEN
        RETURN 'INATIVO';
    END IF;

    -- Documento sem validade (numero de chassi, por exemplo) nao vence.
    IF p_validade IS NULL THEN
        RETURN 'VALIDO';
    END IF;

    IF p_validade < CURRENT_DATE THEN
        RETURN 'VENCIDO';
    END IF;

    -- Noventa dias e a janela de aviso: tempo suficiente para agendar
    -- vistoria, licenciamento ou renovacao de seguro sem correria.
    IF p_validade <= CURRENT_DATE + 90 THEN
        RETURN 'VENCENDO';
    END IF;

    RETURN 'VALIDO';
END;
$$ LANGUAGE plpgsql STABLE;

-- ------------------------------------------------------------
-- O gatilho agora usa a mesma regra
-- ------------------------------------------------------------
-- A versao anterior tinha tres ramos diferentes (15, 30 e 90 dias) que
-- devolviam todos 'VENCENDO' - sobra de uma ideia abandonada de ter tres
-- niveis de aviso. Lendo o codigo parecia haver distincao onde nao havia.
CREATE OR REPLACE FUNCTION atualizar_status_documento()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'INATIVO' THEN
        RETURN NEW;
    END IF;

    NEW.status := situacao_documento(NEW.status, NEW.data_validade);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- Conserta o que ja esta gravado errado
-- ------------------------------------------------------------
-- Roda a cada subida da API (as migracoes sao reaplicadas), entao as linhas
-- que envelheceram desde o ultimo deploy voltam para a situacao certa. O WHERE
-- evita reescrever linhas que ja estao corretas - sem ele, cada deploy faria
-- UPDATE em toda a tabela e dispararia o gatilho em cada linha.
UPDATE documento_veiculo
   SET status = situacao_documento(status, data_validade)
 WHERE status <> situacao_documento(status, data_validade);
