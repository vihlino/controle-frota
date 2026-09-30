/**
 * redefinirSenha.js - Define uma senha nova para um usuario, pelo terminal.
 *
 * Para quando ninguem consegue entrar (ex.: a senha do admin se perdeu) e nao
 * da para usar a tela de Usuarios. A senha e digitada ESCONDIDA, duas vezes,
 * e nunca aparece na tela nem em log.
 *
 * USO (na pasta app/api):
 *   node src/redefinirSenha.js admin
 *
 * O banco e o do .env (ou o que PGHOST/PGDATABASE apontarem nesta janela). O
 * script mostra qual e antes de pedir a senha - confira antes de continuar.
 * Segue as mesmas regras de senha da tela (minimo 8, sem o login...).
 * Sessoes abertas com a senha antiga deixam de valer. Fica na auditoria.
 */
import "dotenv/config";
import readline from "node:readline";
import bcrypt from "bcryptjs";
import { pool } from "./db.js";
import { problemaNaSenha } from "./regrasSenha.js";
import { registrarAuditoria } from "./auditoria.js";

function perguntar(texto, { escondido = false } = {}) {
  return new Promise((resolver) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (escondido) {
      // Mostra o texto da pergunta, mas nao o que for digitado.
      rl._writeToOutput = (s) => {
        if (s.includes(texto)) rl.output.write(texto);
        else if (s === "\r\n" || s === "\n") rl.output.write(s);
      };
    }
    rl.question(texto, (resposta) => {
      if (escondido) process.stdout.write("\n");
      rl.close();
      resolver(resposta);
    });
  });
}

async function principal() {
  const login = String(process.argv[2] || "").trim();
  if (!login) {
    console.log("Uso: node src/redefinirSenha.js <login>   (ex.: node src/redefinirSenha.js admin)");
    process.exitCode = 1;
    return;
  }

  const { rows: banco } = await pool.query("SELECT current_database() AS nome, inet_server_addr() AS ip");
  console.log(`Banco: ${banco[0].nome}  (servidor ${process.env.PGHOST || banco[0].ip || "local"})`);

  const { rows } = await pool.query(
    `SELECT u.id_usuario, u.login, u.status, s.nome
       FROM usuario u JOIN servidor s ON s.id_servidor = u.id_servidor
      WHERE u.login = $1`,
    [login]
  );
  if (!rows[0]) {
    const { rows: parecidos } = await pool.query(
      "SELECT login FROM usuario WHERE login ILIKE $1 ORDER BY login LIMIT 5", [`%${login}%`]
    );
    console.log(`Nenhum usuario com o login "${login}".` +
      (parecidos.length ? ` Parecidos: ${parecidos.map((p) => p.login).join(", ")}` : ""));
    process.exitCode = 1;
    return;
  }
  const u = rows[0];
  console.log(`Usuario: ${u.nome} (login "${u.login}")${u.status ? "" : "  ** INATIVO: nao vai conseguir entrar **"}`);

  const confirma = await perguntar('Digite SIM para definir uma senha nova: ');
  if (confirma.trim().toUpperCase() !== "SIM") {
    console.log("Cancelado. Nada foi alterado.");
    return;
  }

  const senha = await perguntar("Senha nova (nao aparece ao digitar): ", { escondido: true });
  const problema = problemaNaSenha(senha, u.login);
  if (problema) {
    console.log(`Senha recusada: ${problema} Nada foi alterado.`);
    process.exitCode = 1;
    return;
  }
  const repetida = await perguntar("Repita a senha nova: ", { escondido: true });
  if (repetida !== senha) {
    console.log("As duas senhas nao conferem. Nada foi alterado.");
    process.exitCode = 1;
    return;
  }

  const instante = new Date(Math.floor(Date.now() / 1000) * 1000);
  await pool.query(
    `UPDATE usuario
        SET senha_hash = $1, senha_alterada_em = $2::timestamptz, trocar_senha = FALSE
      WHERE id_usuario = $3`,
    [await bcrypt.hash(senha, 10), instante.toISOString(), u.id_usuario]
  );
  await registrarAuditoria({
    idUsuario: u.id_usuario,
    acao: "ALTERAR_SENHA",
    entidade: "usuario",
    idRegistro: u.id_usuario,
    justificativa: "Senha redefinida pelo terminal (redefinirSenha.js).",
  });
  console.log(`Pronto: senha de "${u.login}" alterada. Entre no sistema com a senha nova.`);
}

try {
  await principal();
} catch (e) {
  console.error("Erro:", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
