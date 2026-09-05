/**
 * initDatabase.js - Inicializacao automatica do banco do SITRA.
 *
 * Este arquivo prepara o banco de dados antes de a API comecar
 * a receber requisicoes.
 *
 * O processo funciona assim:
 *
 *   1. Verifica se a estrutura principal do banco ja existe.
 *   2. Se o banco estiver vazio:
 *
 *        - Executa 001_sitra_v1.sql
 *        - Executa 002_sitra_telas.sql
 *
 *   3. Verifica se existe o usuario administrador inicial.
 *   4. Se nao existir, cria:
 *
 *        - Setor de Tecnologia da Informacao
 *        - Servidor administrador
 *        - Usuario administrador
 *
 * Dessa forma, um banco PostgreSQL novo pode ser preparado
 * automaticamente durante o primeiro deploy no Render.
 *
 * Os arquivos SQL ficam em:
 *
 *   /app/db/001_sitra_v1.sql
 *   /app/db/002_sitra_telas.sql
 */

import "dotenv/config";

import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import bcrypt from "bcryptjs";

import { pool } from "./db.js";

/*
 * ---------------------------------------------------------------------------
 * Configuracoes do administrador inicial
 * ---------------------------------------------------------------------------
 *
 * O login pode ser definido pela variavel SEED_LOGIN.
 *
 * Caso ela nao exista, usamos "admin".
 *
 * A senha pode ser definida pela variavel SEED_SENHA.
 *
 * Caso ela nao exista, usamos a senha padrao definida abaixo.
 *
 * IMPORTANTE:
 *
 * Em producao, recomendamos configurar SEED_LOGIN e SEED_SENHA
 * nas variaveis de ambiente do Render.
 */

const LOGIN = process.env.SEED_LOGIN || "admin";

const SENHA = process.env.SEED_SENHA || "sitra@2026";

/*
 * ---------------------------------------------------------------------------
 * Caminhos dos arquivos SQL
 * ---------------------------------------------------------------------------
 *
 * O arquivo atual fica em:
 *
 *   /app/src/initDatabase.js
 *
 * Os arquivos SQL ficam em:
 *
 *   /app/db/
 *
 * Usamos o diretorio do modulo para montar os caminhos de forma segura,
 * sem depender do diretorio onde o Node foi iniciado.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// No Docker do Render a pasta db e copiada para dentro de api/ (../db a partir
// de src/). Na maquina de quem desenvolve ela fica ao lado, em app/db
// (../../db). Procurar nos dois lugares deixa o mesmo codigo rodar nos dois
// ambientes - antes, rodar a API local dava "no such file or directory".
const pastaDb = [
  path.resolve(__dirname, "../db"),
  path.resolve(__dirname, "../../db"),
].find((caminho) => existsSync(path.join(caminho, "001_sitra_v1.sql")))
  ?? path.resolve(__dirname, "../db");

const caminhoSqlPrincipal = path.join(pastaDb, "001_sitra_v1.sql");

/**
 * Lista as migracoes na ordem, lendo a pasta em vez de manter uma lista
 * escrita a mao - antes, cada migracao nova exigia lembrar de editar este
 * arquivo, e foi assim que a 003 a 006 ficaram de fora.
 *
 * Entram so os arquivos no padrao NNN_nome.sql. Isso deixa de fora atalhos
 * como `aplicar_003_a_006.sql`, que repetem migracoes ja listadas.
 *
 * @param {number} apartirDe  Numero minimo. 2 pula o 001, que so roda em
 *                            banco vazio (ele nao e idempotente).
 */
async function listarMigracoes(apartirDe = 2) {
  const arquivos = await fs.readdir(pastaDb);
  return arquivos
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .filter((f) => Number(f.slice(0, 3)) >= apartirDe)
    .sort()
    .map((f) => ({ nome: f, caminho: path.join(pastaDb, f) }));
}

/**
 * Le uma migracao e RETIRA o BEGIN/COMMIT dela.
 *
 * Por que: a inicializacao inteira roda dentro de uma transacao (ver
 * inicializarBanco). Um COMMIT no meio do arquivo confirmaria a transacao de
 * FORA antes da hora - e ai um erro numa migracao seguinte nao desfaria mais
 * as anteriores, que e justamente a protecao que a transacao existe para dar.
 */
async function lerMigracao(caminho) {
  const sql = await fs.readFile(caminho, "utf8");
  return sql.replace(/^\s*(BEGIN|COMMIT)\s*;\s*$/gim, "");
}

/*
 * ---------------------------------------------------------------------------
 * Inicializacao da estrutura do banco
 * ---------------------------------------------------------------------------
 *
 * Esta funcao verifica se a tabela "usuario" existe.
 *
 * Se ela nao existir, consideramos que o banco ainda nao possui
 * a estrutura principal do SITRA e executamos os dois arquivos SQL.
 */

async function inicializarEstrutura(cliente) {

  const { rows } = await cliente.query(
    "SELECT to_regclass('public.usuario') AS tabela"
  );

  /*
   * Se a tabela ja existe, a estrutura principal ja foi criada.
   */

  if (rows[0].tabela) {

    console.log("Banco SITRA ja possui a estrutura principal.");

    // Reaplica TODAS as migracoes da 002 em diante. Todas sao idempotentes
    // (IF NOT EXISTS, DROP CONSTRAINT IF EXISTS, CREATE OR REPLACE), entao
    // rodar de novo nao duplica nada - e a que faltava e aplicada sozinha.
    // E isto que dispensa rodar psql na mao a cada deploy.
    const migracoes = await listarMigracoes(2);
    for (const m of migracoes) {
      console.log(`Aplicando ${m.nome} (idempotente)...`);
      await cliente.query(await lerMigracao(m.caminho));
    }

    return;

  }

  console.log(
    "Banco vazio detectado. Inicializando estrutura do SITRA..."
  );

  /*
   * -------------------------------------------------------------------------
   * Le os arquivos SQL
   * -------------------------------------------------------------------------
   */

  // lerMigracao (e nao readFile) tambem aqui: o 001 tem BEGIN na linha 26 e
  // COMMIT na 1925. Lido cru, aquele COMMIT encerrava a transacao de FORA no
  // meio da inicializacao - e dali em diante nada mais seria desfeito por um
  // erro. O Postgres avisava com "there is already a transaction in progress"
  // e "there is no transaction in progress", que so aparecem no log.
  const sqlPrincipal = await lerMigracao(caminhoSqlPrincipal);

  /*
   * -------------------------------------------------------------------------
   * Executa 001_sitra_v1.sql
   * -------------------------------------------------------------------------
   *
   * Este arquivo contem a estrutura principal do banco:
   *
   * - Tabelas
   * - Relacionamentos
   * - Perfis
   * - Permissoes
   * - Outras configuracoes iniciais
   */

  console.log("Executando 001_sitra_v1.sql...");

  await cliente.query(sqlPrincipal);

  /*
   * -------------------------------------------------------------------------
   * Executa 002_sitra_telas.sql
   * -------------------------------------------------------------------------
   *
   * Este arquivo contem as alteracoes e complementos adicionados
   * posteriormente para acompanhar as telas do SITRA.
   */

  for (const m of await listarMigracoes(2)) {
    console.log(`Executando ${m.nome}...`);
    await cliente.query(await lerMigracao(m.caminho));
  }

  console.log(
    "Estrutura principal do banco criada com sucesso."
  );

}

/*
 * ---------------------------------------------------------------------------
 * Criacao do administrador inicial
 * ---------------------------------------------------------------------------
 *
 * Esta funcao verifica se o login configurado em SEED_LOGIN ja existe.
 *
 * Se o usuario existir, nenhuma alteracao sera feita.
 *
 * Caso contrario, sao criados:
 *
 *   1. Setor de Tecnologia da Informacao
 *   2. Servidor administrador
 *   3. Usuario administrador
 */

async function garantirAdministrador(cliente) {

  /*
   * Primeiro verificamos se o usuario ja existe.
   */

  const { rows: jaExiste } = await cliente.query(
    "SELECT id_usuario FROM usuario WHERE login = $1",
    [LOGIN]
  );

  if (jaExiste[0]) {

    console.log(
      `Usuario administrador "${LOGIN}" ja existe.`
    );

    return;

  }

  console.log(
    `Criando usuario administrador "${LOGIN}"...`
  );

  /*
   * -------------------------------------------------------------------------
   * Setor de Tecnologia da Informacao
   * -------------------------------------------------------------------------
   *
   * ON CONFLICT evita criar setores duplicados.
   */

  const { rows: setor } = await cliente.query(
    `INSERT INTO setor (nome, descricao)
     VALUES (
       'Tecnologia da Informacao',
       'Setor responsavel pelo SITRA'
     )
     ON CONFLICT (nome)
     DO UPDATE SET nome = EXCLUDED.nome
     RETURNING id_setor`
  );

  /*
   * -------------------------------------------------------------------------
   * Servidor administrador
   * -------------------------------------------------------------------------
   *
   * O cadastro utiliza uma matricula fixa para evitar duplicacao.
   */

  const { rows: servidor } = await cliente.query(
    `INSERT INTO servidor
       (
         nome,
         cpf,
         data_nascimento,
         telefone,
         email,
         matricula,
         cargo_funcao,
         id_setor
       )
     VALUES
       (
         'Administrador do Sistema',
         '000.000.000-00',
         '1990-01-01',
         '(00) 00000-0000',
         'admin@sitra.local',
         'ADM0001',
         'Administrador',
         $1
       )
     ON CONFLICT (matricula)
     DO UPDATE SET nome = EXCLUDED.nome
     RETURNING id_servidor`,
    [setor[0].id_setor]
  );

  /*
   * -------------------------------------------------------------------------
   * Perfil Administrador
   * -------------------------------------------------------------------------
   *
   * O perfil precisa existir no SQL principal.
   */

  const { rows: perfil } = await cliente.query(
    "SELECT id_perfil FROM perfil WHERE nome = 'Administrador'"
  );

  if (!perfil[0]) {

    throw new Error(
      "Perfil 'Administrador' nao existe. " +
      "Verifique se 001_sitra_v1.sql foi aplicado corretamente."
    );

  }

  /*
   * -------------------------------------------------------------------------
   * Criptografa a senha
   * -------------------------------------------------------------------------
   *
   * Nunca armazenamos a senha original diretamente no banco.
   */

  const senhaHash = await bcrypt.hash(
    SENHA,
    10
  );

  /*
   * -------------------------------------------------------------------------
   * Cria o usuario administrador
   * -------------------------------------------------------------------------
   */

  await cliente.query(
    `INSERT INTO usuario
       (
         id_servidor,
         id_perfil,
         login,
         senha_hash
       )
     VALUES ($1, $2, $3, $4)`,
    [
      servidor[0].id_servidor,
      perfil[0].id_perfil,
      LOGIN,
      senhaHash,
    ]
  );

  console.log(
    `Usuario administrador "${LOGIN}" criado com sucesso.`
  );

}

async function garantirGestores(cliente) {
  const gestores = [
    {
      login: "gestor.frotas",
      nome: "Gestor de Frotas",
      cpf: "111.111.111-11",
      matricula: "GF0001",
      email: "gestor.frotas@sitra.local",
      cargo: "Gestor de Frotas",
      setor: "Gestao de Frotas",
      perfil: "Gestor Frotas",
    },
    {
      login: "gestor.fiscalizacao",
      nome: "Gestor de Fiscalizacao",
      cpf: "222.222.222-22",
      matricula: "GFS0001",
      email: "gestor.fiscalizacao@sitra.local",
      cargo: "Gestor de Fiscalizacao",
      setor: "Fiscalizacao",
      perfil: "Gestor Fiscalizacao",
    },
  ];

  for (const g of gestores) {
    const { rows: jaExiste } = await cliente.query(
      "SELECT id_usuario FROM usuario WHERE login = $1",
      [g.login]
    );
    if (jaExiste[0]) {
      console.log(`Usuario "${g.login}" ja existe.`);
      continue;
    }

    const { rows: setor } = await cliente.query(
      `INSERT INTO setor (nome, descricao)
       VALUES ($1, $2)
       ON CONFLICT (nome) DO UPDATE SET nome = EXCLUDED.nome
       RETURNING id_setor`,
      [g.setor, g.setor]
    );

    const { rows: servidor } = await cliente.query(
      `INSERT INTO servidor (nome, cpf, data_nascimento, telefone, email, matricula, cargo_funcao, id_setor)
       VALUES ($1, $2, '1990-01-01', '(00) 00000-0000', $3, $4, $5, $6)
       ON CONFLICT (matricula) DO UPDATE SET nome = EXCLUDED.nome
       RETURNING id_servidor`,
      [g.nome, g.cpf, g.email, g.matricula, g.cargo, setor[0].id_setor]
    );

    const { rows: perfil } = await cliente.query(
      "SELECT id_perfil FROM perfil WHERE nome = $1",
      [g.perfil]
    );
    if (!perfil[0]) {
      console.log(`Perfil "${g.perfil}" nao encontrado, pulando ${g.login}.`);
      continue;
    }

    const senhaHash = await bcrypt.hash(SENHA, 10);
    await cliente.query(
      `INSERT INTO usuario (id_servidor, id_perfil, login, senha_hash)
       VALUES ($1, $2, $3, $4)`,
      [servidor[0].id_servidor, perfil[0].id_perfil, g.login, senhaHash]
    );
    console.log(`Usuario "${g.login}" criado com sucesso.`);
  }
}

/**
 * Inicializa o banco do SITRA.
 *
 * Esta e a funcao principal utilizada pelo server.js.
 *
 * Ela garante que:
 *
 *   - A estrutura do banco exista.
 *   - As atualizacoes das telas tenham sido aplicadas.
 *   - O usuario administrador inicial exista.
 *
 * A API somente continua sua inicializacao depois que todas essas
 * etapas forem concluidas com sucesso.
 */

export async function inicializarBanco() {

  const cliente = await pool.connect();

  try {

    /*
     * -----------------------------------------------------------------------
     * Transacao
     * -----------------------------------------------------------------------
     *
     * Todas as etapas sao executadas dentro de uma unica transacao.
     *
     * Se alguma etapa falhar, o banco volta ao estado anterior.
     */

    await cliente.query("BEGIN");

    /*
     * Primeiro garantimos que a estrutura exista.
     */

    await inicializarEstrutura(cliente);

    /*
     * Depois garantimos que o administrador exista.
     */

    await garantirAdministrador(cliente);
    await garantirGestores(cliente);

    /*
     * Confirma todas as alteracoes.
     */

    await cliente.query("COMMIT");

    console.log(
      "Inicializacao do banco SITRA concluida."
    );

  } catch (erro) {

    /*
     * Se alguma etapa falhar, desfazemos todas as alteracoes.
     */

    await cliente.query("ROLLBACK").catch(() => {});

    console.error(
      "Falha ao inicializar o banco SITRA:",
      erro.message
    );

    /*
     * Repassa o erro para o server.js.
     *
     * Dessa forma, a API nao inicia utilizando um banco incompleto.
     */

    throw erro;

  } finally {

    /*
     * Devolve a conexao ao pool.
     */

    cliente.release();

  }

}