/**
 * sistema.js - Fatos verificaveis sobre a instalacao, para a tela de TI.
 *
 * TUDO AQUI E MEDIDO, NADA E ESTIMADO
 * -----------------------------------
 * A tela de TI existe para alguem decidir se precisa agir. Numero inventado
 * ali e pior do que numero nenhum: o cartao "Ultimo backup" do painel dizia
 * "Hoje, 03:00 - 2,45 GB" com os valores escritos fixos na tela, sem nenhuma
 * rotina de backup por tras. Quem lesse aquilo concluiria que os dados da CMTT
 * estavam salvos.
 *
 * Por isso esta rota so devolve o que da para perguntar ao Postgres na hora.
 * O que o SITRA nao sabe, ele diz que nao sabe.
 */
import { Router } from "express";
import { query } from "../db.js";
import { autenticar, exigePermissao } from "../auth.js";

const router = Router();

router.get("/", autenticar, exigePermissao("ADMIN_VISUALIZAR"), async (req, res, next) => {
  try {
    const geral = await query(
      `SELECT current_database()                        AS banco,
              pg_database_size(current_database())      AS tamanho_bytes,
              pg_size_pretty(pg_database_size(current_database())) AS tamanho,
              current_setting('TimeZone')               AS fuso,
              current_timestamp                         AS agora,
              version()                                 AS versao,
              pg_postmaster_start_time()                AS banco_no_ar_desde`
    );

    // Contagem das tabelas que representam o trabalho de verdade. Serve para
    // notar uma perda: se "checklists" cair de um dia para o outro, algo houve.
    const volumes = await query(
      `SELECT 'Veiculos'   AS entidade, count(*) AS total FROM veiculo
       UNION ALL SELECT 'Servidores',   count(*) FROM servidor
       UNION ALL SELECT 'Usuarios',     count(*) FROM usuario
       UNION ALL SELECT 'Checklists',   count(*) FROM checklist_frotas
       UNION ALL SELECT 'Documentos',   count(*) FROM documento_veiculo
       UNION ALL SELECT 'Ocorrencias',  count(*) FROM ocorrencia
       UNION ALL SELECT 'Logs de acesso', count(*) FROM log_acesso`
    );

    // As dez maiores tabelas, para saber o que ocupa espaco antes de ele faltar.
    const maiores = await query(
      `SELECT relname AS tabela,
              pg_size_pretty(pg_total_relation_size(c.oid)) AS tamanho,
              pg_total_relation_size(c.oid) AS bytes
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY pg_total_relation_size(c.oid) DESC
        LIMIT 10`
    );

    const g = geral.rows[0];
    res.json({
      banco: {
        nome: g.banco,
        tamanho: g.tamanho,
        tamanhoBytes: Number(g.tamanho_bytes),
        fuso: g.fuso,
        agora: g.agora,
        versao: String(g.versao).split(" on ")[0],
        noArDesde: g.banco_no_ar_desde,
      },
      volumes: volumes.rows.map((v) => ({ ...v, total: Number(v.total) })),
      maioresTabelas: maiores.rows.map((t) => ({ ...t, bytes: Number(t.bytes) })),
      // O SITRA nao executa backup. Dizer isso e o unico relato honesto que
      // esta rota pode dar sobre o assunto - e a tela mostra exatamente isto.
      backup: {
        rotinaNoSitra: false,
        responsavel: process.env.BACKUP_RESPONSAVEL || "Hospedagem do banco (Render)",
        observacao:
          "O SITRA nao executa nem agenda backup. A copia de seguranca e feita " +
          "pelo servico que hospeda o banco, conforme o plano contratado.",
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
