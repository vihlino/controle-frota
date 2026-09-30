/**
 * backupComum.js - O que o backup e a restauracao precisam saber igual.
 *
 * Os dois lados tem de concordar em DUAS coisas, senao a restauracao falha
 * no meio: a ordem das tabelas e o formato do arquivo. Por isso moram aqui, e
 * nao repetidas em cada script.
 */

/** Versao do formato do arquivo. Sobe se o formato mudar. */
export const VERSAO_FORMATO = 1;

/**
 * As tabelas na ordem em que podem ser GRAVADAS: toda tabela vem depois das
 * que ela referencia (a mae antes da filha).
 *
 * A restauracao desliga os gatilhos do SITRA, mas NAO as chaves estrangeiras -
 * elas continuam conferindo cada linha. Gravar um checklist antes do veiculo
 * dele seria recusado. A ordem vem do proprio banco (pg_constraint), e nao de
 * uma lista escrita a mao: tabela nova de uma migracao futura entra sozinha.
 *
 * @param {import("pg").PoolClient} cliente
 * @returns {Promise<string[]>}
 */
export async function ordemDasTabelas(cliente) {
  const { rows: tabelas } = await cliente.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  );
  const { rows: fks } = await cliente.query(
    `SELECT DISTINCT f.relname AS filha, m.relname AS mae
       FROM pg_constraint c
       JOIN pg_class f ON f.oid = c.conrelid
       JOIN pg_class m ON m.oid = c.confrelid
       JOIN pg_namespace n ON n.oid = f.relnamespace
      WHERE c.contype = 'f' AND n.nspname = 'public'
        AND c.conrelid <> c.confrelid`
  );

  // Ordenacao topologica (algoritmo de Kahn).
  const nomes = tabelas.map((t) => t.tablename);
  const faltam = new Map(nomes.map((t) => [t, new Set()]));
  for (const { filha, mae } of fks) faltam.get(filha)?.add(mae);

  const ordem = [];
  while (faltam.size) {
    const prontas = [...faltam].filter(([, maes]) => maes.size === 0).map(([t]) => t).sort();
    if (!prontas.length) {
      throw new Error(
        "As tabelas se referenciam em circulo e nao ha ordem possivel para gravar: " +
        [...faltam.keys()].join(", ")
      );
    }
    for (const t of prontas) {
      ordem.push(t);
      faltam.delete(t);
      for (const maes of faltam.values()) maes.delete(t);
    }
  }
  return ordem;
}

/** Colunas da tabela, na ordem do banco. */
export async function colunasDa(cliente, tabela) {
  const { rows } = await cliente.query(
    `SELECT attname FROM pg_attribute
      WHERE attrelid = $1::regclass AND attnum > 0 AND NOT attisdropped
        AND attgenerated = ''
      ORDER BY attnum`,
    [`public."${tabela}"`]
  );
  return rows.map((r) => r.attname);
}

/** Nome curto do banco, para o nome do arquivo e para os avisos. */
export function rotuloDoBanco() {
  const host = process.env.PGHOST || "localhost";
  // So letras, numeros e hifen: o rotulo vira nome de arquivo, e um PGHOST
  // com barra ou dois-pontos quebraria o caminho no Windows.
  return host.split(".")[0].replace(/[^A-Za-z0-9-]+/g, "") || "banco";
}

/** Aspas de identificador do Postgres. */
export const q = (nome) => `"${String(nome).replace(/"/g, '""')}"`;
