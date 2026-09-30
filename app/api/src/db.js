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
/*
 * ---------------------------------------------------------------------------
 * Fuso horario
 * ---------------------------------------------------------------------------
 * O SITRA e usado no Brasil, mas o Postgres do Render roda em UTC. Sem ajuste,
 * CURRENT_DATE, CURRENT_TIME e CURRENT_TIMESTAMP gravam tres horas adiantados.
 *
 * O efeito nao e so um relogio errado: um checklist enviado as 22h de um dia
 * seria gravado como 1h do dia SEGUINTE. O relatorio diario perderia o
 * registro, e a comparacao entre o horario declarado e o horario do envio
 * (a coluna "Fechado em") acusaria 3h de atraso onde nao houve nenhum.
 *
 * Sao 38 usos de CURRENT_* no banco e 33 na API. Ajustar a CONEXAO conserta
 * todos de uma vez; editar cada chamada seria interminavel e fatalmente
 * incompleto.
 */
const FUSO = process.env.TZ || "America/Sao_Paulo";

/*
 * SSL so quando pedido, por PGSSL=true no .env.
 *
 * O banco local roda sem TLS; o do Render EXIGE. Quem quiser rodar a API na
 * propria maquina apontando para o banco do Render precisa dos dois: as
 * credenciais de la e PGSSL=true. Sem isso a conexao cai antes de autenticar.
 *
 * rejectUnauthorized: false porque o Render usa certificado proprio, que a
 * lista de autoridades do Node nao reconhece.
 */
export const pool = new pg.Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "sitra",
  user: process.env.PGUSER || "sitra",
  password: process.env.PGPASSWORD,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
  keepAlive: true,
  /*
   * O pool FECHA a conexao parada antes de o Render fechar.
   *
   * O banco do Render derruba conexao ociosa sem avisar o cliente. O pool
   * continuava com ela na prateleira e a emprestava na consulta seguinte: a
   * requisicao que pegasse essa conexao morta falhava com erro de conexao -
   * um 500 em qualquer tela, sem relacao com o que a pessoa estava fazendo, e
   * sem se repetir na tentativa seguinte (que pegava outra conexao). E o pior
   * tipo de bug: intermitente e aparentemente aleatorio.
   *
   * Dez segundos e bem abaixo do limite do Render, entao o pool sempre
   * descarta primeiro. Abrir conexao nova custa poucos milissegundos.
   */
  idleTimeoutMillis: 10_000,

  /*
   * Cada conexao nova nasce no fuso do Brasil - e o pool ESPERA por isso.
   *
   * "verify" e o unico gancho do pool que roda uma vez por conexao FISICA e
   * segura a conexao ate terminar: quem pediu a conexao so a recebe depois do
   * "pronto()". O evento "connect" NAO serve para isso - ele e disparado de
   * forma sincrona e a conexao e entregue no mesmo instante, entao o SET
   * disparado ali corria junto com a primeira consulta de quem pediu. O driver
   * avisava ("Calling client.query() when the client is already executing a
   * query") e a partir do pg 9 isso passa a ser erro.
   */
  verify(cliente, pronto) {
    cliente.query(`SET TIME ZONE '${FUSO}'`, (erro) => {
      if (erro) {
        console.error(
          "Nao foi possivel aplicar o fuso horario na conexao:",
          erro.message,
        );
      }
      /*
       * O erro do fuso NAO invalida a conexao: passar "erro" aqui faria o pool
       * descartar a conexao e devolver falha para a tela. Melhor uma conexao
       * em UTC com o aviso no log do que a API inteira fora do ar.
       */
      pronto();
    });
  },
});

/*
 * Conexao ociosa que cai nao pode derrubar a API.
 *
 * O Postgres do Render encerra conexoes paradas. Quando isso acontece, o
 * driver emite "error" no pool. Sem ninguem escutando, o Node trata como
 * excecao nao capturada e MATA o processo - o navegador ve ECONNRESET e a
 * tela inteira para de responder. Escutando aqui, a conexao morta e
 * descartada em silencio e o pool abre outra na proxima consulta.
 */
pool.on("error", (erro) => {
  console.error("Conexao ociosa do banco caiu (descartada):", erro.message);
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
  return pool.query(text, params).catch((erro) => {
    /*
     * Uma segunda chance, SO para erro de conexao.
     *
     * Se a conexao morreu entre o emprestimo e a consulta, a consulta nunca
     * chegou ao banco - repetir nao duplica nada. Erro de dado (restricao
     * violada, campo obrigatorio) NAO entra aqui: repetir daria o mesmo erro e
     * esconderia a causa real de quem precisa dela.
     */
    const deConexao =
      erro.code === "ECONNRESET" ||
      erro.code === "EPIPE" ||
      erro.code === "ETIMEDOUT" ||
      erro.code === "57P01" || // servidor encerrou a conexao
      /Connection terminated|connection closed/i.test(erro.message || "");
    if (!deConexao) throw erro;
    console.warn("Conexao do banco caiu no meio da consulta; tentando de novo.");
    return pool.query(text, params);
  });
}
