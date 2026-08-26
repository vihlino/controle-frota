/**
 * crud.js - Fabrica de rotas.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * ---------------------------
 * O SITRA tem umas 20 telas de listagem que fazem exatamente a mesma coisa:
 * buscar, filtrar, ordenar, paginar, criar, editar e excluir. Escrever esse
 * codigo 20 vezes seria 20 lugares para ter bug e 20 lugares para corrigir.
 *
 * Entao aqui existe UMA implementacao, e cada recurso (veiculos, sinistros,
 * setores...) so declara uma configuracao dizendo qual tabela usar e quais
 * colunas podem ser buscadas, filtradas e ordenadas. Veja routes/frotas.js
 * para exemplos dessas configuracoes.
 *
 * ROTAS QUE ELA CRIA
 * ------------------
 *   GET    /          lista paginada, com busca, filtros e ordenacao
 *   GET    /opcoes    lista completa sem paginacao (alimenta os <select>)
 *   GET    /:id       um registro
 *   POST   /          cria
 *   PUT    /:id       edita
 *   DELETE /:id       exclui
 *
 * As tres ultimas nao sao criadas quando a configuracao traz somenteLeitura,
 * como acontece com a auditoria (ninguem edita rastro).
 */
import { Router } from "express";
import { query, pool } from "./db.js";
import { autenticar, exigePermissao } from "./auth.js";
import { registrarAuditoria } from "./auditoria.js";

/**
 * Monta o conjunto de rotas de um recurso.
 *
 * @param {object} config
 * @param {string} config.tabela      Nome da tabela. Ex.: "veiculo"
 * @param {string} config.id          Coluna de chave. Ex.: "id_veiculo"
 * @param {string} config.select      O que vai depois do SELECT. Pode trazer
 *                                    colunas de tabelas juntadas e subconsultas.
 * @param {string} config.from        O FROM completo, com os JOINs.
 * @param {string[]} config.busca     Colunas varridas pelo parametro ?busca.
 * @param {object} config.filtros     Mapa {parametroDaUrl: "coluna"}. Parametros
 *                                    terminados em "De" viram >= e em "Ate"
 *                                    viram <=, o que da faixas de data sem
 *                                    precisar de rota extra.
 * @param {object} config.ordenaveis  Mapa {chaveDoFront: "coluna"}. So o que
 *                                    esta aqui pode ordenar - e essa lista
 *                                    branca que impede injecao de SQL pelo
 *                                    parametro de ordenacao.
 * @param {string} config.ordemPadrao Ordenacao usada quando o front nao pede
 *                                    nenhuma. Pode ja incluir DESC.
 * @param {string[]} config.campos    Colunas aceitas em POST/PUT. Campo fora
 *                                    dessa lista e ignorado, mesmo que venha no
 *                                    corpo da requisicao.
 * @param {string[]} config.obrigatorios  Campos exigidos no POST.
 * @param {object} config.permissoes  {ver, gerenciar} - codigos de permissao.
 * @param {string} config.entidade    Nome usado nos registros de auditoria.
 * @param {boolean} config.somenteLeitura  Se true, nao cria POST/PUT/DELETE.
 * @param {string} config.condicaoFixa     Condicao SQL sempre aplicada.
 * @returns {Router} Roteador do Express pronto para montar no server.
 */
export function criarCrud(config) {
  const router = Router();
  const {
    tabela, id, select, from, busca = [], filtros = {}, ordenaveis = {},
    ordemPadrao, campos = [], obrigatorios = [], permissoes = {}, entidade,
    somenteLeitura = false, condicaoFixa,
  } = config;

  // Monta os middlewares de permissao uma vez so. Se a configuracao nao pediu
  // permissao, o array fica vazio e o spread (...) nao adiciona nada.
  const podeVer = permissoes.ver ? [exigePermissao(permissoes.ver)] : [];
  const podeGerenciar = permissoes.gerenciar ? [exigePermissao(permissoes.gerenciar)] : [];

  /**
   * Traduz os parametros da URL em um WHERE com valores parametrizados.
   *
   * O ponto central aqui e a seguranca: os VALORES nunca entram no texto do
   * SQL. Eles vao no array `valores` e o texto recebe apenas marcadores
   * ($1, $2...). O driver envia os dois separados, e o banco trata os valores
   * como dado puro - nunca como comando. E assim que se evita SQL injection.
   *
   * Os NOMES DE COLUNA, esses sim, entram no texto - mas so os que estao nas
   * listas `filtros`, `busca` e `ordenaveis` da configuracao, escritas por nos.
   * Nada que venha do usuario vira nome de coluna.
   *
   * @param {object} consulta  req.query
   * @returns {{where: string, valores: Array}}
   */
  function montarFiltros(consulta) {
    // condicaoFixa restringe o recurso inteiro (ex.: so registros que mudaram dados).
    const condicoes = condicaoFixa ? [condicaoFixa] : [];
    const valores = [];

    for (const [parametro, coluna] of Object.entries(filtros)) {
      const valor = consulta[parametro];
      // Filtro nao informado ou vazio simplesmente nao entra no WHERE.
      if (valor === undefined || valor === "") continue;

      if (parametro.endsWith("De")) {
        // "dataDe=2026-01-01" vira "coluna >= '2026-01-01'"
        valores.push(valor);
        condicoes.push(`${coluna} >= $${valores.length}`);
      } else if (parametro.endsWith("Ate")) {
        // "dataAte=2026-12-31" vira "coluna <= '2026-12-31'"
        valores.push(valor);
        condicoes.push(`${coluna} <= $${valores.length}`);
      } else {
        // Qualquer outro filtro e igualdade simples.
        valores.push(valor);
        condicoes.push(`${coluna} = $${valores.length}`);
      }
    }

    // A busca livre varre varias colunas de uma vez, com OR entre elas.
    // O ::text converte colunas numericas para texto, para o ILIKE funcionar
    // (ILIKE e o LIKE que ignora maiuscula/minuscula, no Postgres).
    if (consulta.busca && busca.length) {
      valores.push(`%${String(consulta.busca).trim()}%`);
      const i = valores.length;
      condicoes.push(`(${busca.map((c) => `${c}::text ILIKE $${i}`).join(" OR ")})`);
    }

    return { where: condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "", valores };
  }

  /**
   * GET /  -  Listagem paginada.
   *
   * Parametros aceitos na URL:
   *   ?pagina=1&porPagina=10          paginacao
   *   ?busca=texto                    busca livre
   *   ?ordenarPor=placa&direcao=ASC   ordenacao
   *   + qualquer filtro declarado na configuracao
   *
   * Devolve { itens, total, pagina, porPagina, paginas }.
   * Roda duas consultas: uma conta o total (para a paginacao saber quantas
   * paginas existem) e outra traz a fatia pedida.
   */
  router.get("/", autenticar, ...podeVer, async (req, res, next) => {
    try {
      // Limites defensivos: pagina nunca menor que 1, e porPagina no maximo 200
      // para ninguem derrubar o servidor pedindo um milhao de linhas.
      const pagina = Math.max(1, Number(req.query.pagina) || 1);
      const porPagina = Math.min(200, Math.max(5, Number(req.query.porPagina) || 10));

      // ordemPadrao pode ja trazer a direcao ("data DESC"); nesse caso nada
      // e colado depois, senao sai "DESC ASC".
      const escolhida = ordenaveis[req.query.ordenarPor];
      const direcao = String(req.query.direcao).toUpperCase() === "DESC" ? "DESC" : "ASC";
      const ordenacao = escolhida ? `${escolhida} ${direcao}` : ordemPadrao;

      const { where, valores } = montarFiltros(req.query);

      // Conta o total com os MESMOS filtros da listagem, senao a paginacao
      // mostraria um numero que nao corresponde ao que esta na tela.
      const total = await query(`SELECT COUNT(*)::int AS total FROM ${from} ${where}`, valores);

      // LIMIT/OFFSET tambem entram parametrizados. Como eles vao no fim do
      // array, seus marcadores sao os dois ultimos.
      const pagVal = [...valores, porPagina, (pagina - 1) * porPagina];
      const { rows } = await query(
        `SELECT ${select} FROM ${from} ${where}
          ORDER BY ${ordenacao}
          LIMIT $${pagVal.length - 1} OFFSET $${pagVal.length}`,
        pagVal
      );

      res.json({
        itens: rows,
        total: total.rows[0].total,
        pagina,
        porPagina,
        // Quantas paginas existem. O Math.max(1, ...) evita "pagina 1 de 0"
        // quando a lista esta vazia.
        paginas: Math.max(1, Math.ceil(total.rows[0].total / porPagina)),
      });
    } catch (e) {
      next(e); // manda para o tratador de erros do server.js
    }
  });

  /**
   * GET /opcoes  -  Lista completa, sem paginacao.
   *
   * Serve para preencher as caixas de selecao das telas (o <select> de veiculos
   * num formulario de manutencao, por exemplo). Tem teto de 500 registros: se
   * uma lista passar disso, a tela precisa de campo de busca, nao de um select
   * gigante.
   */
  router.get("/opcoes", autenticar, ...podeVer, async (req, res, next) => {
    try {
      const { where, valores } = montarFiltros(req.query);
      const { rows } = await query(
        `SELECT ${select} FROM ${from} ${where} ORDER BY ${ordemPadrao} LIMIT 500`,
        valores
      );
      res.json(rows);
    } catch (e) {
      next(e);
    }
  });

  /**
   * GET /:id  -  Um registro so, com os mesmos JOINs da listagem.
   */
  router.get("/:id", autenticar, ...podeVer, async (req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT ${select} FROM ${from} WHERE ${tabela}.${id} = $1`,
        [Number(req.params.id)]
      );
      if (!rows[0]) return res.status(404).json({ erro: "Registro nao encontrado" });
      res.json(rows[0]);
    } catch (e) {
      next(e);
    }
  });

  // A partir daqui sao as rotas de escrita. Recursos somente leitura
  // (auditoria, logs) param aqui e devolvem so as rotas de consulta.
  if (somenteLeitura) return router;

  /**
   * POST /  -  Cria um registro.
   *
   * So as colunas listadas em config.campos sao aceitas: se alguem mandar
   * {"id_usuario": 1, "status": true} num recurso que nao declarou essas
   * colunas, elas sao descartadas em silencio. Isso impede que o cliente
   * escreva em campos que a tela nao deveria mexer.
   */
  router.post("/", autenticar, ...podeGerenciar, async (req, res, next) => {
    try {
      // Validacao dos obrigatorios antes de tocar no banco, para devolver uma
      // mensagem util em vez do erro cru do Postgres.
      const faltando = obrigatorios.filter(
        (c) => req.body[c] === undefined || req.body[c] === "" || req.body[c] === null
      );
      if (faltando.length) {
        return res.status(400).json({ erro: `Preencha: ${faltando.join(", ")}` });
      }

      // Monta o INSERT so com os campos que realmente vieram.
      const usados = campos.filter((c) => req.body[c] !== undefined);
      // Campo em branco vira NULL: um <input> vazio manda "", e "" numa coluna
      // de data ou numero faria o banco reclamar.
      const valores = usados.map((c) => (req.body[c] === "" ? null : req.body[c]));
      const marcadores = usados.map((_, i) => `$${i + 1}`);

      const { rows } = await query(
        `INSERT INTO ${tabela} (${usados.join(", ")})
         VALUES (${marcadores.join(", ")})
         RETURNING *`,
        valores
      );

      // Todo cadastro fica registrado: quem criou, o que criou e quando.
      await registrarAuditoria({
        idUsuario: req.usuario.id_usuario,
        acao: "CRIAR",
        entidade: entidade || tabela,
        idRegistro: rows[0][id],
        dadosNovos: rows[0],
      });

      res.status(201).json(rows[0]); // 201 = criado
    } catch (e) {
      next(e);
    }
  });

  /**
   * PUT /:id  -  Edita um registro.
   *
   * Usa transacao porque precisa ler o estado ANTERIOR (para a auditoria
   * guardar o antes/depois) e so entao alterar, sem que outra pessoa mexa no
   * meio do caminho. O SELECT ... FOR UPDATE tranca a linha ate o COMMIT.
   */
  router.put("/:id", autenticar, ...podeGerenciar, async (req, res, next) => {
    // Aqui pegamos uma conexao dedicada: transacao precisa que todos os
    // comandos rodem na MESMA conexao.
    const cliente = await pool.connect();
    try {
      await cliente.query("BEGIN");
      const idRegistro = Number(req.params.id);

      const anterior = await cliente.query(
        `SELECT * FROM ${tabela} WHERE ${id} = $1 FOR UPDATE`,
        [idRegistro]
      );
      if (!anterior.rows[0]) {
        await cliente.query("ROLLBACK");
        return res.status(404).json({ erro: "Registro nao encontrado" });
      }

      const usados = campos.filter((c) => req.body[c] !== undefined);
      if (!usados.length) {
        await cliente.query("ROLLBACK");
        return res.status(400).json({ erro: "Nada para alterar." });
      }

      const valores = usados.map((c) => (req.body[c] === "" ? null : req.body[c]));
      const atribuicoes = usados.map((c, i) => `${c} = $${i + 1}`);

      const { rows } = await cliente.query(
        `UPDATE ${tabela} SET ${atribuicoes.join(", ")}
          WHERE ${id} = $${usados.length + 1}
          RETURNING *`,
        [...valores, idRegistro]
      );

      await cliente.query("COMMIT");

      // A auditoria vai depois do COMMIT de proposito: se ela falhar, a edicao
      // ja esta salva. O contrario (perder a edicao por causa do log) seria pior.
      await registrarAuditoria({
        idUsuario: req.usuario.id_usuario,
        acao: "EDITAR",
        entidade: entidade || tabela,
        idRegistro,
        dadosAnteriores: anterior.rows[0],
        dadosNovos: rows[0],
      });

      res.json(rows[0]);
    } catch (e) {
      // Qualquer erro desfaz tudo: o registro fica como estava.
      await cliente.query("ROLLBACK").catch(() => {});
      next(e);
    } finally {
      // Devolver a conexao para a piscina e OBRIGATORIO. Sem isso, o pool
      // esgota e o sistema trava depois de algumas dezenas de edicoes.
      cliente.release();
    }
  });

  /**
   * DELETE /:id  -  Exclui um registro.
   *
   * O RETURNING * traz a linha excluida, o que serve para dois fins: saber se
   * ela existia (se nao veio nada, era 404) e guardar o conteudo na auditoria.
   */
  router.delete("/:id", autenticar, ...podeGerenciar, async (req, res, next) => {
    try {
      const idRegistro = Number(req.params.id);
      const { rows } = await query(
        `DELETE FROM ${tabela} WHERE ${id} = $1 RETURNING *`,
        [idRegistro]
      );
      if (!rows[0]) return res.status(404).json({ erro: "Registro nao encontrado" });

      await registrarAuditoria({
        idUsuario: req.usuario.id_usuario,
        acao: "EXCLUIR",
        entidade: entidade || tabela,
        idRegistro,
        dadosAnteriores: rows[0],
      });

      res.status(204).end(); // 204 = deu certo e nao ha corpo para devolver
    } catch (e) {
      // 23503 e o codigo do Postgres para violacao de chave estrangeira:
      // alguem tentou excluir um setor que ainda tem veiculos, por exemplo.
      // Sem esse tratamento, a tela mostraria "erro interno", que nao ajuda.
      if (e.code === "23503") {
        return res.status(409).json({
          erro: "Este registro esta vinculado a outros e nao pode ser excluido.",
        });
      }
      next(e);
    }
  });

  return router;
}
