/**
 * db.js - Conexao com o PostgreSQL.
 *
 * Este arquivo faz duas coisas:
 *   1. Cria a "piscina" (pool) de conexoes que o resto do sistema usa.
 *   2. Ajusta como o driver traduz alguns tipos do banco para JavaScript,
 *      porque os padroes dele causam bugs sutis (datas com um dia a menos,
 *      dinheiro perdendo centavos).
 */
import pg from "pg";
import "dotenv/config";

/*
 * ---------------------------------------------------------------------------
 * Tradutores de tipo (type parsers)
 * ---------------------------------------------------------------------------
 * O driver do Postgres recebe tudo como texto e converte para tipos do
 * JavaScript. Alguns desses padroes nao servem para o SITRA:
 */

// BIGINT (oid 20) chega como string, porque um BIGINT pode ser maior do que o
// JavaScript aguenta em Number. No SITRA os ids nunca chegam perto disso, e o
// front espera numero (para comparar com === e usar em <option value>).
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

// DATE (oid 1082) e TIMESTAMP (oid 1114) virariam objeto Date, e o driver faz
// essa conversao usando o fuso horario do processo. Resultado: a data
// "2026-08-26" gravada no banco voltava como 25/08 as 23h no Brasil, e a tela
// mostrava o dia errado. Guardando o texto puro que o banco mandou, a data que
// aparece na tela e exatamente a que esta gravada.
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(1114, (v) => v);

// NUMERIC (oid 1700) tambem chega como string, para nao perder precisao. Os
// valores do SITRA sao custos de manutencao, que cabem em Number sem problema,
// e o front precisa deles como numero para formatar em reais.
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

/**
 * A piscina de conexoes.
 *
 * Em vez de abrir e fechar uma conexao a cada consulta (que e lento), o pool
 * mantem algumas abertas e vai emprestando. Todas as credenciais vem do
 * arquivo .env, nunca escritas aqui no codigo.
 */
export const pool = new pg.Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "sitra",
  user: process.env.PGUSER || "sitra",
  password: process.env.PGPASSWORD,
});

/**
 * Atalho para uma consulta avulsa.
 *
 * @param {string} text   SQL com marcadores $1, $2... (NUNCA concatene valores
 *                        direto no texto: isso abre porta para SQL injection).
 * @param {Array} params  Os valores que substituem os marcadores.
 * @returns {Promise<{rows: Array, rowCount: number}>}
 *
 * Para varias consultas que precisam ir juntas (tudo ou nada), nao use esta
 * funcao: pegue uma conexao com pool.connect() e use BEGIN/COMMIT/ROLLBACK.
 * Exemplo disso em routes/qrcode.js.
 */
export function query(text, params) {
  return pool.query(text, params);
}
