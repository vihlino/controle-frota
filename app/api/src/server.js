/**
 * server.js - Ponto de entrada da API.
 *
 * Liga tudo: cria o servidor Express, registra os middlewares globais e monta
 * cada grupo de rotas num caminho. A ordem importa - o tratador de 404 e o de
 * erro precisam vir por ultimo, depois de todas as rotas.
 *
 * Para subir:  npm run dev   (reinicia sozinho quando um arquivo muda)
 */
import "dotenv/config";
import express from "express";
import cors from "cors";

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

const app = express();

// req.ip precisa do IP real quando a API roda atras de proxy/nginx.
app.set("trust proxy", true);
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/api/saude", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, banco: "conectado" });
  } catch (e) {
    res.status(503).json({ ok: false, banco: "indisponivel", detalhe: e.message });
  }
});

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

app.use((_req, res) => res.status(404).json({ erro: "Rota nao encontrada" }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ erro: "Erro interno no servidor" });
});

const porta = Number(process.env.PORT || 3333);
app.listen(porta, () => {
  console.log(`SITRA API em http://localhost:${porta}`);
});
