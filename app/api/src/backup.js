/**
 * backup.js - Copia o banco inteiro do SITRA para um arquivo no computador.
 *
 * Roda com: npm run backup
 *
 * POR QUE EXISTE
 * --------------
 * Um mes de testes se perdeu quando o Postgres gratuito do Render expirou: o
 * banco foi suspenso e nao havia copia nenhuma fora dele. Este script e essa
 * copia - um arquivo que fica no computador, independente de onde o banco
 * esteja hospedado.
 *
 * Na CMTT o backup e do servidor PostgreSQL deles (pg_dump, rotina da TI).
 * Este script serve para os ambientes de teste - o principal (Vercel) e o
 * secundario (localhost) - e para levar dados de um banco para outro.
 *
 * O QUE GRAVA
 * -----------
 * Todas as tabelas, com todas as linhas (fotos inclusive), e a posicao de
 * todos os contadores (sequencias). Grava em backups/, compactado.
 *
 * ATENCAO: o arquivo tem CPF, telefone e o hash das senhas. Trate como
 * documento sigiloso. A pasta backups/ esta no .gitignore e nao sobe para o
 * GitHub.
 */
import "dotenv/config";
import { gzipSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";
import { VERSAO_FORMATO, ordemDasTabelas, colunasDa, rotuloDoBanco, q } from "./backupComum.js";

const PASTA = join(dirname(fileURLToPath(import.meta.url)), "..", "backups");

const cliente = await pool.connect();
try {
  console.log(`Copiando o banco ${process.env.PGHOST || "localhost"} / ${process.env.PGDATABASE || "sitra"}...`);

  /*
   * Uma "fotografia" so do banco inteiro.
   *
   * Sem isto, cada tabela seria lida num instante diferente: um checklist
   * gravado entre a copia de veiculo e a de checklist_frotas entraria no
   * arquivo apontando para um veiculo que o arquivo nao tem - e a restauracao
   * falharia exatamente no dia em que alguem precisasse dela.
   */
  await cliente.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");

  const ordem = await ordemDasTabelas(cliente);
  const tabelas = [];
  const linhas = [];
  let total = 0;

  for (const tabela of ordem) {
    const colunas = await colunasDa(cliente, tabela);
    /*
     * row_to_json: quem converte cada valor para texto e o PROPRIO Postgres,
     * nao o driver. Data continua data, foto (BYTEA) vira hexadecimal, e a
     * restauracao faz a conversao inversa com a mesma regra. Passando pelo
     * JavaScript, datas mudariam de fuso e fotos viriam como Buffer.
     */
    const { rows } = await cliente.query(
      `SELECT row_to_json(x)::text AS j FROM public.${q(tabela)} x`
    );
    tabelas.push({ nome: tabela, colunas, linhas: rows.length });
    for (const { j } of rows) linhas.push(`{"t":${JSON.stringify(tabela)},"r":${j}}`);
    total += rows.length;
  }

  const { rows: sequencias } = await cliente.query(
    `SELECT sequencename AS nome, last_value AS ultimo
       FROM pg_sequences WHERE schemaname = 'public'`
  );

  await cliente.query("COMMIT");

  const cabecalho = {
    sitra_backup: VERSAO_FORMATO,
    criado_em: new Date().toISOString(),
    origem: `${process.env.PGHOST || "localhost"} / ${process.env.PGDATABASE || "sitra"}`,
    tabelas,
    sequencias,
  };
  const conteudo = JSON.stringify(cabecalho) + "\n" + linhas.join("\n") + "\n";
  const compactado = gzipSync(Buffer.from(conteudo, "utf8"));

  // Data e hora no nome, no fuso de quem roda: dois backups no mesmo dia nao
  // se sobrescrevem, e a lista de arquivos ja sai em ordem cronologica.
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const carimbo = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  const arquivo = join(PASTA, `sitra-${rotuloDoBanco()}-${carimbo}.json.gz`);

  mkdirSync(PASTA, { recursive: true });
  writeFileSync(arquivo, compactado);

  const mb = (compactado.length / 1024 / 1024).toFixed(2);
  console.log(`${tabelas.length} tabelas, ${total} linhas.`);
  console.log(`Backup gravado: ${arquivo} (${mb} MB)`);
} catch (e) {
  await cliente.query("ROLLBACK").catch(() => {});
  console.error("Falha no backup:", e.message);
  process.exitCode = 1;
} finally {
  cliente.release();
  await pool.end();
}
