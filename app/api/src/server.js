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
import { appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { urlPublica, ipsDaRedeLocal } from "./urlPublica.js";

/*
 * Toda falha inesperada tambem vai para app/api/erros.log.
 *
 * Escrita SINCRONA de proposito: numa excecao nao capturada o processo pode
 * morrer no instante seguinte, e uma escrita assincrona nao chegaria ao disco.
 * Sao poucos bytes e acontece so quando algo deu errado.
 */
const ARQUIVO_ERROS = join(dirname(fileURLToPath(import.meta.url)), "..", "erros.log");

function registrarErro(titulo, erro) {
  try {
    const quando = new Date().toISOString();
    const detalhe = erro?.stack || erro?.message || String(erro);
    const extra = erro?.code ? `\ncode: ${erro.code}` : "";
    const restricao = erro?.constraint ? `\nconstraint: ${erro.constraint}` : "";
    appendFileSync(
      ARQUIVO_ERROS,
      `\n=== ${quando} ${titulo}${extra}${restricao}\n${detalhe}\n`
    );
  } catch {
    // Nao poder gravar o log nao pode ser mais um problema.
  }
}

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
import cargos from "./routes/cargos.js";
import alertas from "./routes/alertas.js";
import sistema from "./routes/sistema.js";

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
   * req.ip precisa do IP real quando a API roda atras de proxy.
   *
   * O NUMERO importa. Com `true`, o Express confia em TODA a cadeia de
   * X-Forwarded-For - e esse cabecalho e escrito pelo cliente. Qualquer um
   * podia mandar um IP falso diferente a cada requisicao e os dois limites
   * abaixo viravam decoracao, inclusive o do login: as 10 tentativas por 15
   * minutos passariam a ser ilimitadas, e a forca bruta de senha ficaria
   * livre.
   *
   * No Render a API fica atras de UM proxy, entao o certo e confiar em um
   * salto so e ler o IP real dali.
   */

  app.set("trust proxy", 1);

  /*
   * Middlewares globais.
   */

  app.use(helmet());

  const origens = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
    : ["http://localhost:5173"];
  app.use(cors({ origin: origens, credentials: true }));

  // Rate limit geral: 200 req/min por IP. A resposta vai em JSON com o campo
  // "erro" porque e o formato que o front sabe ler: em texto puro ele caia na
  // mensagem generica e ninguem entendia que era so esperar.
  app.use(rateLimit({
    windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false,
    message: { erro: "Muitas requisições em pouco tempo. Espere um instante." },
  }));

  /*
   * Rate limit do login: 10 tentativas ERRADAS por 15 minutos, por IP.
   *
   * skipSuccessfulRequests e o detalhe que faz diferenca. Sem ele, o login que
   * DEU CERTO tambem gastava uma das 10 vagas - e quem entra e sai do sistema
   * algumas vezes (trocar de usuario para conferir permissao, a API reiniciando
   * e derrubando a sessao) ficava trancado do lado de fora por 15 minutos com a
   * senha certa na mao. O limite existe para travar quem fica CHUTANDO senha, e
   * chute errado continua contando normalmente.
   *
   * A chave e o IP. Atencao para quando o SITRA sair do Render e for para o
   * servidor da CMTT: se a API ficar atras de um proxy que NAO preenche
   * X-Forwarded-For, todo mundo chega com o mesmo IP, dividindo as 10 vagas
   * entre a empresa inteira - as 8h da manha, com varios servidores entrando
   * juntos, a maioria levaria bloqueio. Ou o proxy preenche o cabecalho, ou o
   * "trust proxy" logo acima precisa ser revisto junto com a configuracao dele.
   */
  app.use("/api/sessao/login", rateLimit({
    windowMs: 15 * 60_000, max: 10, standardHeaders: true, legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { erro: "Muitas tentativas de login. Tente novamente em 15 minutos." },
  }));

  // A confirmacao de senha (pedida antes de editar e de excluir) tambem
  // responde "certa ou errada" - e um oraculo de senha tao bom quanto o login.
  // Quem tivesse um token emprestado ou roubado podia descobrir a senha ali,
  // sem limite nenhum. Poucas tentativas bastam para o uso legitimo: a pessoa
  // esta confirmando a PROPRIA senha, que ela sabe.
  app.use("/api/sessao/confirmar", rateLimit({
    windowMs: 15 * 60_000, max: 10, standardHeaders: true, legacyHeaders: false,
    // Mesmo motivo do login: so a tentativa ERRADA conta. Quem confirma a
    // propria senha varias vezes num dia de cadastro nao esta atacando nada.
    skipSuccessfulRequests: true,
    message: { erro: "Muitas tentativas. Tente novamente em 15 minutos." },
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
  app.use("/api/cargos", cargos);

  app.use("/api/alertas", alertas);
  app.use("/api/sistema", sistema);

  /*
   * -------------------------------------------------------------------------
   * Rota nao encontrada
   * -------------------------------------------------------------------------
   *
   * Este middleware precisa ficar depois de todas as rotas.
   */

  app.use((_req, res) =>
    res.status(404).json({
      erro: "Rota não encontrada.",
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

    // O detalhe fica no log do servidor, onde so a equipe ve.
    console.error(`[500] ${req.method} ${req.path}`, err);

    // ... e tambem em ARQUIVO.
    //
    // O terminal rola e se perde: quando o erro acontece, a janela da API
    // costuma estar atras do navegador, e o que chega para analise e o log do
    // NAVEGADOR - que sobre um 500 sabe apenas que houve um 500. Gravando em
    // erros.log fica o motivo exato, com a pilha, para ser lido depois.
    //
    // O arquivo esta no .gitignore: e diagnostico local, nao codigo.
    registrarErro(`[500] ${req.method} ${req.path}`, err);

    // E NAO vai para o cliente. A mensagem crua do Postgres entrega nome de
    // tabela, de coluna e de restricao - um mapa do banco entregue a quem
    // estiver sondando. Em desenvolvimento ela continua aparecendo, porque ali
    // quem le e quem esta consertando.
    const emProducao = process.env.NODE_ENV === "production";
    res.status(500).json({
      erro: emProducao
        ? "Erro interno no servidor. Tente novamente."
        : err.message || "Erro interno no servidor",
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

    /*
     * Diz, na subida, qual endereco vai gravado dentro dos QR Codes.
     *
     * Sem isso o erro so aparecia no fim da linha: o adesivo impresso abria
     * "localhost" no celular do motorista, que e o proprio celular. Dito aqui,
     * da para conferir antes de mandar imprimir.
     */
    const base = urlPublica();
    if (base) {
      console.log(`QR Codes vao apontar para ${base}`);
      if (!process.env.URL_PUBLICA) {
        console.log(
          "  (deduzido do IP desta maquina na rede; abra este endereco no " +
          "celular para testar. Para fixar, use URL_PUBLICA no .env)"
        );
        // Com mais de uma placa de rede, mostra todas: se a escolhida nao for a
        // do Wi-Fi, a certa esta aqui para copiar para o URL_PUBLICA.
        const todas = ipsDaRedeLocal();
        if (todas.length > 1) {
          console.log("  Outras placas de rede encontradas:");
          for (const { ip, placa } of todas.slice(1)) console.log(`    ${ip}  (${placa})`);
        }
      }
    } else {
      console.warn(
        "ATENCAO: URL_PUBLICA nao esta definida. Os QR Codes vao sair com " +
        "endereco vazio e nao abrirao em nenhum celular."
      );
    }

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

/*
 * ---------------------------------------------------------------------------
 * Rede de seguranca: erro solto nao derruba a API
 * ---------------------------------------------------------------------------
 * Uma promessa rejeitada sem catch, ou uma excecao fora de qualquer rota,
 * mata o processo do Node sem dizer onde foi. Do lado do navegador isso
 * aparece como ECONNRESET e a tela inteira para de responder.
 *
 * Aqui o erro e IMPRESSO COM A PILHA e o servidor continua de pe, para que a
 * causa apareca no terminal em vez de sumir junto com o processo.
 */
process.on("unhandledRejection", (erro) => {
  console.error("[erro solto] promessa rejeitada sem tratamento:", erro);
  registrarErro("[erro solto] promessa rejeitada sem tratamento", erro);
});

process.on("uncaughtException", (erro) => {
  console.error("[erro solto] excecao nao capturada:", erro);
  registrarErro("[erro solto] excecao nao capturada", erro);
});

iniciarServidor().catch((erro) => {

  console.error(
    "Falha ao iniciar a API do SITRA:",
    erro
  );

  // Vai para o arquivo tambem.
  //
  // A falha de INICIALIZACAO e a mais dificil de investigar depois: a API nao
  // chega a escutar a porta, entao o navegador so recebe "conexao recusada" -
  // uma mensagem que nao distingue "nao subiu por causa de um erro" de "nao
  // foi aberta". O motivo ficava so no terminal, que rola e se perde.
  registrarErro("[inicializacao] a API nao subiu", erro);

  process.exit(1);

});