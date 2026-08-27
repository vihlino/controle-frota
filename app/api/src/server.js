/**
 * server.js - Ponto de entrada da API.
 *
 * Liga tudo: primeiro inicializa o banco de dados, depois cria o servidor
 * Express, registra os middlewares globais e monta cada grupo de rotas num
 * caminho.
 *
 * A ordem importa:
 *
 *   1. Inicializa/verifica a estrutura do banco
 *   2. Cria e configura o Express
 *   3. Registra todas as rotas
 *   4. Inicia o servidor
 *
 * O tratador de 404 e o de erro precisam vir por ultimo, depois de todas
 * as rotas.
 *
 * Para subir localmente:
 *
 *   npm run dev
 *
 * Em producao, o Render executa:
 *
 *   node src/server.js
 */

import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import sessao from "./routes/sessao.js";
import dashboard from "./routes/dashboard.js";
import frotas from "./routes/frotas.js";
import fiscalizacao from "./routes/fiscalizacao.js";
import admin from "./routes/admin.js";
import usuarios from "./routes/usuarios.js";
import permissoes from "./routes/permissoes.js";
import auditoria from "./routes/auditoriaRotas.js";
import relatorios from "./routes/relatoriosRotas.js";
import qrcode from "./routes/qrcode.js";
import detalhes from "./routes/detalhes.js";
import setores from "./routes/setores.js";
import alertas from "./routes/alertas.js";

import { pool } from "./db.js";
import { inicializarBanco } from "./initDatabase.js";

/*
 * ---------------------------------------------------------------------------
 * Inicializacao da API
 * ---------------------------------------------------------------------------
 *
 * A inicializacao foi colocada dentro de uma funcao para garantir que o banco
 * esteja pronto antes de o servidor comecar a receber requisicoes.
 *
 * Isso evita, por exemplo, que uma tentativa de login aconteca enquanto as
 * tabelas ainda estao sendo criadas.
 */

async function iniciarServidor() {

  /*
   * -------------------------------------------------------------------------
   * Inicializa o banco de dados
   * -------------------------------------------------------------------------
   *
   * A funcao verifica se a estrutura principal do SITRA ja existe.
   *
   * Se o banco estiver vazio:
   *
   *   1. Executa 001_sitra_v1.sql
   *   2. Executa 002_sitra_telas.sql
   *
   * Se o banco ja estiver inicializado, nenhuma tabela e recriada.
   */

  await inicializarBanco();

  /*
   * -------------------------------------------------------------------------
   * Cria a aplicacao Express
   * -------------------------------------------------------------------------
   */

  const app = express();

  /*
   * req.ip precisa do IP real quando a API roda atras de proxy/nginx.
   */

  app.set("trust proxy", true);

  /*
   * Middlewares globais.
   */

  app.use(helmet());

  const origens = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
    : ["http://localhost:5173"];
  app.use(cors({ origin: origens, credentials: true }));

  // Rate limit geral: 200 req/min por IP
  app.use(rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false }));

  // Rate limit restrito no login: 10 tentativas/15min por IP
  app.use("/api/sessao/login", rateLimit({
    windowMs: 15 * 60_000, max: 10, standardHeaders: true, legacyHeaders: false,
    message: { erro: "Muitas tentativas de login. Tente novamente em 15 minutos." },
  }));

  app.use(express.json({ limit: "1mb" }));

  /*
   * -------------------------------------------------------------------------
   * Health check
   * -------------------------------------------------------------------------
   *
   * Esta rota e utilizada pelo Render para verificar se a API esta funcionando
   * e se a conexao com o PostgreSQL esta disponivel.
   */

  app.get("/api/saude", async (_req, res) => {

    try {

      await pool.query("SELECT 1");

      res.json({
        ok: true,
        banco: "conectado",
      });

    } catch (e) {

      res.status(503).json({
        ok: false,
        banco: "indisponivel",
        detalhe: e.message,
      });

    }

  });

  /*
   * -------------------------------------------------------------------------
   * Rotas da API
   * -------------------------------------------------------------------------
   */

  app.use("/api/sessao", sessao);

  app.use("/api/dashboard", dashboard);

  app.use("/api/frotas", frotas);

  app.use("/api/fiscalizacao", fiscalizacao);

  app.use("/api/admin", admin);

  app.use("/api/usuarios", usuarios);

  app.use("/api/permissoes", permissoes);

  app.use("/api/auditoria", auditoria);

  app.use("/api/relatorios", relatorios);

  app.use("/api/qrcode", qrcode);

  app.use("/api/frotas", detalhes);

  app.use("/api/setores", setores);

  app.use("/api/alertas", alertas);

  /*
   * -------------------------------------------------------------------------
   * Rota nao encontrada
   * -------------------------------------------------------------------------
   *
   * Este middleware precisa ficar depois de todas as rotas.
   */

  app.use((_req, res) =>
    res.status(404).json({
      erro: "Rota nao encontrada",
    })
  );

  /*
   * -------------------------------------------------------------------------
   * Tratador global de erros
   * -------------------------------------------------------------------------
   *
   * Qualquer erro que chegar a este middleware sera registrado no console
   * e retornara uma resposta generica para o cliente.
   */

  app.use((err, req, res, _next) => {

    console.error(`[500] ${req.method} ${req.path}`, err);

    res.status(500).json({
      erro: err.message || "Erro interno no servidor",
    });

  });

  /*
   * -------------------------------------------------------------------------
   * Inicializacao do servidor
   * -------------------------------------------------------------------------
   *
   * O Render injeta automaticamente a variavel PORT.
   *
   * Localmente, caso ela nao exista, usamos a porta 3333.
   */

  const porta = Number(process.env.PORT || 3333);

  app.listen(porta, () => {

    console.log(`SITRA API em http://localhost:${porta}`);

  });

}

/*
 * ---------------------------------------------------------------------------
 * Inicio da aplicacao
 * ---------------------------------------------------------------------------
 *
 * Se ocorrer um erro durante a inicializacao do banco, o servidor nao sera
 * iniciado. Isso evita que a API fique online apontando para um banco
 * incompleto.
 */

iniciarServidor().catch((erro) => {

  console.error(
    "Falha ao iniciar a API do SITRA:",
    erro
  );

  process.exit(1);

});