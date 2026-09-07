/**
 * diagnostico_relatorios.mjs — testa as consultas dos relatorios.
 *
 * Roda cada modelo contra o banco configurado no .env e diz qual quebra e
 * por que. Nao grava nada: so consulta.
 *
 * Uso (na pasta app/api):  node diagnostico_relatorios.mjs
 */
import "dotenv/config";
import { MODELOS } from "./src/relatorios.js";
import { pool } from "./src/db.js";

const inicio = process.argv[2] || "2026-01-01";
const fim = process.argv[3] || "2026-12-31";

console.log(`Periodo testado: ${inicio} a ${fim}`);
console.log(`Banco: ${process.env.PGHOST} / ${process.env.PGDATABASE}\n`);

let quebrados = 0;
for (const [tipo, modelo] of Object.entries(MODELOS)) {
  try {
    const r = await pool.query(modelo.sql, [inicio, fim]);
    console.log(`OK    ${tipo.padEnd(16)} ${r.rows.length} registro(s)`);
  } catch (e) {
    quebrados++;
    console.log(`FALHA ${tipo.padEnd(16)} ${e.message}`);
    if (e.position) console.log(`      posicao ${e.position} do SQL`);
  }
}

// A gravacao tambem entra no teste: o INSERT pode quebrar por causa de uma
// restricao (CHECK, NOT NULL) mesmo com a consulta funcionando.
try {
  const u = await pool.query("SELECT id_usuario FROM usuario LIMIT 1");
  await pool.query("BEGIN");
  await pool.query(
    `INSERT INTO relatorio (nome, tipo, modulo, periodo_inicio, periodo_fim,
       gerado_por, formato, snapshot, hash_sha256, status)
     VALUES ('teste', 'CHECKLISTS', 'FROTAS', $1, $2, $3, 'PDF', '{}'::jsonb,
             'x', 'AGUARDANDO_ATESTE')`,
    [inicio, fim, u.rows[0].id_usuario]
  );
  await pool.query("ROLLBACK");
  console.log("\nOK    gravacao na tabela relatorio");
} catch (e) {
  quebrados++;
  await pool.query("ROLLBACK").catch(() => {});
  console.log(`\nFALHA gravacao na tabela relatorio: ${e.message}`);
}

console.log(quebrados ? `\n${quebrados} problema(s) encontrado(s).` : "\nNenhum problema encontrado.");
await pool.end();
