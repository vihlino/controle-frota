/**
 * restaurar.js - Devolve ao banco o conteudo de um arquivo de backup.
 *
 * Roda com:  npm run restaurar -- backups\arquivo.json.gz
 *   (so mostra o que vai fazer; nao muda nada)
 *
 * e, conferido o banco de destino:
 *            node src/restaurar.js backups\arquivo.json.gz --confirmar
 *
 * ATENCAO: APAGA TUDO o que esta no banco de destino e poe no lugar o que esta
 * no arquivo. E para recuperar um banco perdido ou copiar um banco para
 * outro - nao para "juntar" dados.
 *
 * O banco de destino precisa ter a estrutura do SITRA: suba a API nele uma vez
 * (npm run dev) antes de restaurar, para as migracoes criarem as tabelas.
 */
import "dotenv/config";
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { pool } from "./db.js";
import { VERSAO_FORMATO, ordemDasTabelas, colunasDa, q } from "./backupComum.js";

const arquivo = process.argv.slice(2).find((a) => !a.startsWith("--"));
const confirmado = process.argv.includes("--confirmar");

if (!arquivo) {
  console.error("Informe o arquivo: node src/restaurar.js backups\\sitra-....json.gz");
  process.exit(1);
}

// --- le e confere o arquivo ANTES de encostar no banco ---
let cabecalho;
const porTabela = new Map();
try {
  const texto = gunzipSync(readFileSync(arquivo)).toString("utf8");
  const [primeira, ...resto] = texto.split("\n");
  cabecalho = JSON.parse(primeira);
  if (cabecalho.sitra_backup !== VERSAO_FORMATO) {
    throw new Error("este arquivo nao e um backup do SITRA (ou e de uma versao que este script nao conhece)");
  }
  for (const linha of resto) {
    if (!linha) continue;
    const { t, r } = JSON.parse(linha);
    if (!porTabela.has(t)) porTabela.set(t, []);
    porTabela.get(t).push(r);
  }
  // O arquivo diz quantas linhas cada tabela tinha. Se o que foi lido nao
  // bate, o arquivo esta cortado (copia interrompida, pen drive removido) - e
  // e melhor saber AGORA do que depois de apagar o banco.
  for (const t of cabecalho.tabelas) {
    const lidas = porTabela.get(t.nome)?.length ?? 0;
    if (lidas !== t.linhas) {
      throw new Error(`arquivo incompleto: a tabela ${t.nome} deveria ter ${t.linhas} linhas e tem ${lidas}`);
    }
  }
} catch (e) {
  console.error("Nao foi possivel ler o backup:", e.message);
  process.exit(1);
}

const destino = `${process.env.PGHOST || "localhost"} / ${process.env.PGDATABASE || "sitra"}`;
const total = cabecalho.tabelas.reduce((s, t) => s + t.linhas, 0);
const contar = (nome) => cabecalho.tabelas.find((t) => t.nome === nome)?.linhas ?? 0;

console.log("");
console.log(`Arquivo:  ${arquivo}`);
console.log(`Feito em: ${new Date(cabecalho.criado_em).toLocaleString("pt-BR")}, a partir de ${cabecalho.origem}`);
console.log(`Conteudo: ${total} linhas - ${contar("veiculo")} veiculos, ${contar("servidor")} servidores, ` +
            `${contar("checklist_frotas")} checklists, ${contar("usuario")} usuarios`);
console.log("");
console.log(`DESTINO:  ${destino}`);
console.log("Tudo o que existe hoje neste banco sera APAGADO e substituido pelo arquivo.");
console.log("");

if (!confirmado) {
  console.log("Nada foi feito. Conferido o destino acima, rode de novo com --confirmar no final.");
  process.exit(0);
}

// Ultima chance: dez segundos para um Ctrl+C.
for (let s = 10; s > 0; s--) {
  process.stdout.write(`\rRestaurando em ${s}s... (Ctrl+C cancela) `);
  await new Promise((r) => setTimeout(r, 1000));
}
console.log("");

const cliente = await pool.connect();
try {
  /*
   * TUDO numa transacao so. Se qualquer linha falhar - uma coluna que mudou,
   * a conexao que caiu no 4G - o banco volta exatamente como estava. Um banco
   * meio apagado e meio restaurado seria pior do que os dois.
   */
  await cliente.query("BEGIN");

  const ordem = await ordemDasTabelas(cliente);
  const existentes = new Set(ordem);
  const ausentes = cabecalho.tabelas.map((t) => t.nome).filter((t) => !existentes.has(t));
  if (ausentes.length) {
    throw new Error(
      `o banco de destino nao tem as tabelas ${ausentes.join(", ")}. ` +
      "Suba a API nele uma vez (npm run dev) para as migracoes criarem a estrutura."
    );
  }

  /*
   * Desliga os GATILHOS do SITRA durante a carga.
   *
   * Eles existem para validar o que uma pessoa digita - odometro menor que o
   * anterior, checklist de veiculo em manutencao, inspecao sem itens. Na
   * restauracao, o que entra ja foi validado quando foi digitado; conferido de
   * novo, fora de ordem, seria recusado (o veiculo "em manutencao" hoje tinha
   * checklist de ontem). As chaves estrangeiras NAO sao desligadas: elas
   * continuam garantindo que nada fica apontando para o vazio.
   */
  for (const t of ordem) {
    await cliente.query(`ALTER TABLE public.${q(t)} DISABLE TRIGGER USER`);
  }

  await cliente.query(
    `TRUNCATE ${ordem.map((t) => `public.${q(t)}`).join(", ")} RESTART IDENTITY CASCADE`
  );

  let gravadas = 0;
  for (const tabela of ordem) {
    const linhas = porTabela.get(tabela);
    if (!linhas?.length) continue;

    /*
     * So as colunas que existem NOS DOIS lados. Um backup antigo, de antes de
     * uma migracao, nao tem a coluna nova - ela fica com o valor padrao dela.
     * Mandar NULL de proposito derrubaria as colunas NOT NULL com padrao.
     */
    const doArquivo = new Set(cabecalho.tabelas.find((t) => t.nome === tabela).colunas);
    const colunas = (await colunasDa(cliente, tabela)).filter((c) => doArquivo.has(c));
    const lista = colunas.map(q).join(", ");

    // Em lotes, e pelo tamanho: uma tabela de fotos inteira num comando so
    // passaria de centenas de MB numa unica mensagem.
    let lote = [];
    let tamanho = 0;
    const gravar = async () => {
      if (!lote.length) return;
      await cliente.query(
        `INSERT INTO public.${q(tabela)} (${lista}) OVERRIDING SYSTEM VALUE
         SELECT ${lista} FROM json_populate_recordset(NULL::public.${q(tabela)}, $1::json)`,
        [JSON.stringify(lote)]
      );
      gravadas += lote.length;
      lote = [];
      tamanho = 0;
    };
    for (const r of linhas) {
      const json = JSON.stringify(r);
      if (lote.length && (lote.length >= 500 || tamanho + json.length > 4_000_000)) await gravar();
      lote.push(r);
      tamanho += json.length;
    }
    await gravar();
  }

  /*
   * Os contadores voltam para onde estavam.
   *
   * Sem isto, o proximo veiculo cadastrado pediria o id 1 - que ja esta em uso
   * pelo que acabou de ser restaurado - e a tela responderia com erro de
   * chave duplicada no primeiro cadastro depois da restauracao.
   */
  const { rows: seqAtuais } = await cliente.query(
    "SELECT sequencename FROM pg_sequences WHERE schemaname = 'public'"
  );
  const existeSeq = new Set(seqAtuais.map((s) => s.sequencename));
  for (const s of cabecalho.sequencias) {
    if (!existeSeq.has(s.nome)) continue;
    if (s.ultimo === null) {
      await cliente.query(`ALTER SEQUENCE public.${q(s.nome)} RESTART`);
    } else {
      await cliente.query("SELECT setval($1, $2, true)", [`public.${q(s.nome)}`, s.ultimo]);
    }
  }

  for (const t of ordem) {
    await cliente.query(`ALTER TABLE public.${q(t)} ENABLE TRIGGER USER`);
  }

  await cliente.query("COMMIT");
  console.log(`Restaurado: ${gravadas} linhas em ${destino}.`);
  console.log("Quem estava logado no sistema precisa entrar de novo.");
} catch (e) {
  await cliente.query("ROLLBACK").catch(() => {});
  console.error("Falha na restauracao - o banco ficou exatamente como estava:", e.message);
  process.exitCode = 1;
} finally {
  cliente.release();
  await pool.end();
}
