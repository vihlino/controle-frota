/**
 * Cria o primeiro acesso ao SITRA: um setor, um servidor e o usuario
 * administrador. Rode uma vez, depois do banco subir:
 *   npm run seed
 * Login e senha saem de SEED_LOGIN / SEED_SENHA no .env.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { pool } from "./db.js";

const LOGIN = process.env.SEED_LOGIN || "admin";

// SEM SENHA PADRAO NO CODIGO.
//
// Havia aqui um `|| "sitra@2026"`. O repositorio e publico: essa senha estava
// escrita, em texto puro, num arquivo que qualquer pessoa na internet le - e
// o render.yaml nao declara SEED_SENHA, entao era ELA que criava o
// administrador em producao. Login de administrador com senha conhecida.
//
// Agora o seed se recusa a rodar sem uma senha informada. Falhar e melhor do
// que criar uma conta que qualquer um abre.
const SENHA = process.env.SEED_SENHA;
if (!SENHA || SENHA.length < 12) {
  console.error(
    "SEED_SENHA nao definida (ou com menos de 12 caracteres).\n" +
    "Defina uma senha forte antes de criar o administrador:\n" +
    "  no Render, em Environment; localmente, no arquivo .env"
  );
  process.exit(1);
}

const cliente = await pool.connect();
try {
  await cliente.query("BEGIN");

  const { rows: jaExiste } = await cliente.query(
    "SELECT id_usuario FROM usuario WHERE login = $1",
    [LOGIN]
  );
  if (jaExiste[0]) {
    console.log(`Usuario "${LOGIN}" ja existe (id ${jaExiste[0].id_usuario}). Nada a fazer.`);
    await cliente.query("ROLLBACK");
    process.exit(0);
  }

  const { rows: setor } = await cliente.query(
    `INSERT INTO setor (nome, descricao)
     VALUES ('Tecnologia da Informacao', 'Setor responsavel pelo SITRA')
     ON CONFLICT (nome) DO UPDATE SET nome = EXCLUDED.nome
     RETURNING id_setor`
  );

  const { rows: servidor } = await cliente.query(
    `INSERT INTO servidor
       (nome, cpf, data_nascimento, telefone, email, matricula, cargo_funcao, id_setor)
     VALUES ('Administrador do Sistema', '000.000.000-00', '1990-01-01',
             '(00) 00000-0000', 'admin@sitra.local', 'ADM0001',
             'Administrador', $1)
     ON CONFLICT (matricula) DO UPDATE SET nome = EXCLUDED.nome
     RETURNING id_servidor`,
    [setor[0].id_setor]
  );

  const { rows: perfil } = await cliente.query(
    "SELECT id_perfil FROM perfil WHERE nome = 'Administrador'"
  );
  if (!perfil[0]) throw new Error("Perfil 'Administrador' nao existe. O SQL do banco foi aplicado?");

  await cliente.query(
    `INSERT INTO usuario (id_servidor, id_perfil, login, senha_hash)
     VALUES ($1, $2, $3, $4)`,
    [servidor[0].id_servidor, perfil[0].id_perfil, LOGIN, await bcrypt.hash(SENHA, 10)]
  );

  await cliente.query("COMMIT");
  // A SENHA NAO E IMPRESSA. O log do Render fica guardado e e visivel a quem
  // tem acesso ao painel - imprimir a senha ali a espalha para todo mundo que
  // um dia abrir o historico de deploy.
  console.log(`Usuario administrador criado. Login: ${LOGIN}`);
  console.log("A senha e a que voce definiu em SEED_SENHA. Troque-a apos o primeiro acesso.");
} catch (e) {
  await cliente.query("ROLLBACK");
  console.error("Falha no seed:", e.message);
  process.exitCode = 1;
} finally {
  cliente.release();
  await pool.end();
}
