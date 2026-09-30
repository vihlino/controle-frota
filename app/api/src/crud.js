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
 * @param {Array<{tabela: string, chave: string}>} [config.filhos]  Linhas que
 *   PERTENCEM ao registro e nao existem sem ele (os itens de uma inspecao, os
 *   equipamentos conferidos num checklist). Sao apagadas junto, na mesma
 *   transacao, e guardadas na auditoria dentro do registro excluido.
 * @param {boolean} [config.exigeJustificativa]  Na EDICAO, obriga o motivo e
 *                                    grava-o na auditoria. Para o registro que
 *                                    e prova de um fato (o checklist), a
 *                                    pergunta "por que isto mudou?" precisa ter
 *                                    resposta guardada.
 * @param {object} config.normalizacoes  Mapa {coluna: regra} aplicado ao
 *                                    gravar. Regras: "primeiraMaiuscula"
 *                                    (Chevrolet) e "maiusculas" (ABC1D23).
 * @param {string[]} config.obrigatorios  Campos exigidos no POST.
 * @param {object} config.permissoes  {ver, gerenciar} - codigos de permissao.
 * @param {string} config.entidade    Nome usado nos registros de auditoria.
 * @param {boolean} config.somenteLeitura  Se true, nao cria POST/PUT/DELETE.
 * @param {string} config.condicaoFixa     Condicao SQL sempre aplicada.
 * @param {Function} config.escopo    Recorte que depende de QUEM pediu:
 *                                    recebe req e devolve {coluna, valor} ou
 *                                    null. Vale em TODAS as rotas do recurso -
 *                                    listar, abrir por id, editar e excluir -
 *                                    para que nao exista o caso de um registro
 *                                    sumir da lista mas abrir pela URL.
 * @returns {Router} Roteador do Express pronto para montar no server.
 */
/**
 * Traduz erro do Postgres em mensagem que serve para quem esta na tela.
 *
 * 23505 e "ja existe um registro com esse valor unico". Sem tratamento, a API
 * devolvia o texto cru do banco - com nome de indice e de coluna - e em
 * producao nem isso: o tratador de erros esconde a mensagem e sobra "erro
 * interno", que nao diz a quem cadastra que o problema e so o nome repetido.
 *
 * @param {Error} e         O erro vindo do driver.
 * @param {string} entidade Nome amigavel do registro. Ex.: "cargo".
 * @returns {string|null} A mensagem, ou null se nao for esse tipo de erro.
 */
/*
 * Restricoes do banco com nome tecnico, traduzidas para o que a pessoa fez.
 *
 * A restricao diz "chk_veiculo_vinculo"; quem esta na tela quer saber qual
 * campo recusou o valor. Sem isto a tela mostra "o servidor falhou", que joga
 * a culpa no servidor por um dado que so o banco sabe julgar.
 */
const RESTRICOES = {
  chk_veiculo_vinculo:
    "O vínculo informado não é aceito pelo banco. Se você acabou de escolher " +
    "uma opção nova, a API precisa ser reiniciada para a atualização do banco " +
    "ser aplicada.",
  chk_veiculo_status: "A situação informada não é uma das opções aceitas.",
  chk_os_tem_solicitante: "A ordem de serviço precisa de um solicitante.",
  chk_inspecao_tipo:
    "A frequência informada não é aceita pelo banco. Se você escolheu uma " +
    "opção nova (quinzenal, personalizada ou sem periodicidade), a API precisa " +
    "ser reiniciada para a atualização do banco ser aplicada.",
  chk_inspecao_finalizacao:
    "Inspeção finalizada precisa de data, hora e resultado do encerramento.",
};

function mensagemDeConflito(e, entidade) {
  if (e.code === "23505") {
    return `Já existe outro ${entidade || "registro"} com esses dados. Confira se o nome já não está cadastrado.`;
  }
  // 23514 = CHECK violado: o valor nao esta na lista que a coluna aceita.
  if (e.code === "23514") {
    return (
      RESTRICOES[e.constraint] ||
      `Um dos valores enviados não é aceito para este ${entidade || "registro"} (${e.constraint}).`
    );
  }
  // 23502 = NOT NULL violado: faltou preencher.
  if (e.code === "23502") {
    return `O campo "${e.column}" é obrigatório.`;
  }
  /*
   * P0001 = RAISE EXCEPTION de um gatilho do proprio SITRA.
   *
   * Essas mensagens sao escritas em portugues, para quem esta na tela ("O
   * odômetro de chegada não pode ser menor que o de saída"). Cair no 500
   * generico desperdicava um texto que ja explicava o problema - e em producao
   * ele era escondido, porque o tratador de erros esconde a mensagem crua do
   * banco. Aqui ela e tratada como o que e: uma regra de negocio recusando o
   * dado, nao uma falha do servidor.
   */
  if (e.code === "P0001") return e.message;
  return null;
}

/*
 * ---------------------------------------------------------------------------
 * Normalizacao de texto digitado
 * ---------------------------------------------------------------------------
 * A mesma marca chegava como "CHEVROLET", "chevrolet" e "Chevrolet",
 * dependendo de quem cadastrou. Isso nao e so feio: quebra a ordenacao da
 * lista (maiuscula vem antes de minuscula), faz o mesmo veiculo parecer dois
 * na conferencia e obriga cada tela a arrumar o texto na hora de mostrar.
 *
 * Arrumar AQUI, na gravacao, conserta de uma vez: o banco passa a guardar uma
 * forma so, e toda tela - inclusive relatorio e exportacao - mostra igual.
 */
const NORMALIZADORES = {
  // "chevrolet" e "CHEVROLET" viram "Chevrolet".
  primeiraMaiuscula: (t) => {
    const limpo = String(t).trim().replace(/\s+/g, " ");
    return limpo ? limpo[0].toUpperCase() + limpo.slice(1).toLowerCase() : limpo;
  },
  // Placa e codigo, nao nome: sempre em caixa alta.
  maiusculas: (t) => String(t).trim().replace(/\s+/g, " ").toUpperCase(),

  /*
   * Nome de pessoa: maiuscula em cada palavra, menos as particulas.
   *
   * "JOAO CARLOS DA SILVA" e "joao carlos da silva" viram "João Carlos da
   * Silva". As particulas ficam minusculas porque e assim que se escreve nome
   * em portugues - "Da Silva" esta tecnicamente em caixa certa e ainda assim
   * errado.
   */
  palavras: (t) => {
    const particulas = new Set(["da", "de", "do", "das", "dos", "e", "d"]);
    return String(t)
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase()
      .split(" ")
      .map((palavra, i) =>
        i > 0 && particulas.has(palavra)
          ? palavra
          : palavra.charAt(0).toUpperCase() + palavra.slice(1)
      )
      .join(" ");
  },

  /*
   * CPF e telefone guardados SO com os digitos.
   *
   * A pontuacao e enfeite de leitura, e a tela sabe desenhar. Guardada, ela
   * viraria o problema de sempre: o mesmo CPF gravado como "000.000.000-00" e
   * "00000000000" passa pela restricao de unicidade como se fossem duas
   * pessoas, e a busca por um dos formatos nao acha o outro.
   */
  digitos: (t) => String(t).replace(/\D/g, ""),
};

function normalizar(valor, regra) {
  const fn = NORMALIZADORES[regra];
  // So texto passa por aqui. null, numero e booleano seguem intactos.
  if (!fn || typeof valor !== "string") return valor;
  return fn(valor);
}

export function criarCrud(config) {
  const router = Router();
  const {
    tabela, id, select, from, busca = [], filtros = {}, ordenaveis = {},
    ordemPadrao, campos = [], obrigatorios = [], permissoes = {}, entidade,
    somenteLeitura = false, condicaoFixa, escopo, normalizacoes = {},
    exigeJustificativa = false, filhos = [], bloquearEdicao,
  } = config;

  // Monta os middlewares de permissao uma vez so. Se a configuracao nao pediu
  // permissao, o array fica vazio e o spread (...) nao adiciona nada.
  // `ver` e `gerenciar` aceitam um codigo ou uma LISTA de codigos - basta ter
  // um deles. Serve para o dado que pertence a mais de um modulo.
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
  function montarFiltros(req) {
    const consulta = req.query || {};
    // condicaoFixa restringe o recurso inteiro (ex.: so registros que mudaram dados).
    const condicoes = condicaoFixa ? [condicaoFixa] : [];
    const valores = [];

    // ESCOPO: o recorte que depende de QUEM esta pedindo.
    //
    // Diferente dos filtros, que vem da tela e a pessoa pode tirar, este e
    // imposto pelo servidor - e como a Fiscalizacao passa a enxergar apenas os
    // servidores do proprio setor. Entra como qualquer outra condicao, com o
    // valor parametrizado, e por isso nao ha como driblar pela URL.
    const recorte = escopo ? escopo(req) : null;
    if (recorte) {
      valores.push(recorte.valor);
      condicoes.push(`${recorte.coluna} = $${valores.length}`);
    }

    for (const [parametro, coluna] of Object.entries(filtros)) {
      const valor = consulta[parametro];
      // Filtro nao informado ou vazio simplesmente nao entra no WHERE.
      if (valor === undefined || valor === "") continue;

      // Converte "true"/"false" string para boolean para colunas BOOLEAN do PostgreSQL.
      // O node-postgres envia strings como tipo TEXT, e PostgreSQL nao aceita
      // "boolean = text" sem conversao explicita.
      const valorFinal = valor === "true" ? true : valor === "false" ? false : valor;

      if (parametro.endsWith("De")) {
        valores.push(valorFinal);
        condicoes.push(`${coluna} >= $${valores.length}`);
      } else if (parametro.endsWith("Ate")) {
        valores.push(valorFinal);
        condicoes.push(`${coluna} <= $${valores.length}`);
      } else {
        valores.push(valorFinal);
        condicoes.push(`${coluna} = $${valores.length}`);
      }
    }

    // A busca livre varre varias colunas de uma vez, com OR entre elas.
    // O ::text converte colunas numericas para texto, para o ILIKE funcionar
    // (ILIKE e o LIKE que ignora maiuscula/minuscula, no Postgres).
    if (consulta.busca && busca.length) {
      const termo = String(consulta.busca).trim();
      valores.push(`%${termo}%`);
      const i = valores.length;
      const partes = busca.map((c) => `${c}::text ILIKE $${i}`);

      /*
       * Segunda passada, so com os digitos.
       *
       * CPF e telefone sao guardados SEM pontuacao (migracao 018) - a mascara
       * e desenhada pela tela. Quem procura um servidor, porem, copia o CPF do
       * documento do jeito que esta escrito la: "000.000.000-00". Comparado com
       * "00000000000" no banco, isso nao achava ninguem, e a tela respondia
       * "nenhum registro" para um CPF que existe.
       *
       * Entao, quando o que foi digitado parece um numero de documento, a busca
       * tambem compara so os digitos - dos dois lados, tirando a pontuacao da
       * coluna com regexp_replace.
       *
       * As duas condicoes que seguram isso:
       *
       *   - tres digitos no minimo: menos que isso acha quase tudo e a busca
       *     perde utilidade;
       *   - nenhuma letra no termo: sem isso, procurar "Maria 2" faria o "2"
       *     casar com quase todo CPF da tabela, e o nome deixaria de filtrar.
       */
      const digitos = termo.replace(/\D/g, "");
      const pareceDocumento = digitos.length >= 3 && !/[^\d.\-/()\s+]/.test(termo);
      if (pareceDocumento) {
        valores.push(`%${digitos}%`);
        const j = valores.length;
        for (const c of busca) {
          partes.push(`regexp_replace(${c}::text, '[^0-9]', '', 'g') ILIKE $${j}`);
        }
      }

      condicoes.push(`(${partes.join(" OR ")})`);
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

      const { where, valores } = montarFiltros(req);

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
      const { where, valores } = montarFiltros(req);
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
      // O MESMO recorte vale aqui. Sem isto, quem nao pode ver um registro na
      // lista ainda o abriria trocando o numero na barra de enderecos - o
      // filtro da listagem seria enfeite.
      const recorte = escopo ? escopo(req) : null;
      const extra = recorte ? ` AND ${recorte.coluna} = $2` : "";
      const { rows } = await query(
        `SELECT ${select} FROM ${from} WHERE ${tabela}.${id} = $1${extra}`,
        recorte ? [Number(req.params.id), recorte.valor] : [Number(req.params.id)]
      );
      if (!rows[0]) return res.status(404).json({ erro: "Registro não encontrado." });
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
      const valores = usados.map((c) =>
        req.body[c] === "" ? null : normalizar(req.body[c], normalizacoes[c])
      );
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
      const conflito = mensagemDeConflito(e, entidade || tabela);
      if (conflito) return res.status(409).json({ erro: conflito });
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

      // O recorte tambem vale para editar. Hoje quem tem escopo restrito nem
      // tem permissao de gerenciar, entao isto nunca chega a barrar ninguem -
      // esta aqui para que continue verdade no dia em que essa permissao for
      // concedida, em vez de virar um buraco silencioso.
      const recorte = escopo ? escopo(req) : null;
      const anterior = await cliente.query(
        `SELECT * FROM ${tabela}
          WHERE ${id} = $1${recorte ? ` AND ${recorte.coluna} = $2` : ""}
          FOR UPDATE`,
        recorte ? [idRegistro, recorte.valor] : [idRegistro]
      );
      if (!anterior.rows[0]) {
        await cliente.query("ROLLBACK");
        return res.status(404).json({ erro: "Registro não encontrado." });
      }

      /*
       * Regra da tabela sobre QUANDO o registro ainda pode ser editado (ex.: a
       * inspecao so muda veiculo, data e hora enquanto esta pendente). Devolve
       * a mensagem para o usuario, ou nada se pode.
       */
      const bloqueio = bloquearEdicao ? bloquearEdicao(anterior.rows[0], req.body) : null;
      if (bloqueio) {
        await cliente.query("ROLLBACK");
        return res.status(409).json({ erro: bloqueio });
      }

      /*
       * A justificativa NAO e coluna da tabela - por isso nem aparece em
       * `campos` e nao corre risco de ser gravada no registro. Ela vai para a
       * auditoria, que e onde a pergunta "por que este numero mudou?" tem de
       * ter resposta seis meses depois.
       */
      const justificativa = String(req.body.justificativa || "").trim();
      if (exigeJustificativa && justificativa.length < 5) {
        await cliente.query("ROLLBACK");
        return res.status(400).json({
          erro: "Escreva a justificativa da alteração (o motivo fica registrado na auditoria).",
        });
      }

      const usados = campos.filter((c) => req.body[c] !== undefined);
      if (!usados.length) {
        await cliente.query("ROLLBACK");
        return res.status(400).json({ erro: "Nada para alterar." });
      }

      const valores = usados.map((c) =>
        req.body[c] === "" ? null : normalizar(req.body[c], normalizacoes[c])
      );
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
        justificativa: justificativa || null,
        dadosAnteriores: anterior.rows[0],
        dadosNovos: rows[0],
      });

      res.json(rows[0]);
    } catch (e) {
      // Qualquer erro desfaz tudo: o registro fica como estava.
      await cliente.query("ROLLBACK").catch(() => {});
      const conflito = mensagemDeConflito(e, entidade || tabela);
      if (conflito) return res.status(409).json({ erro: conflito });
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
    const idRegistro = Number(req.params.id);

    /*
     * TODA exclusao pede o motivo - nao so as telas que ja pediam na edicao.
     *
     * O registro some das telas, e a auditoria e o unico lugar onde ele
     * continua existindo: guarda o registro inteiro (dados_anteriores) e o POR
     * QUE (justificativa). Sem o motivo, daqui a um ano ninguem sabe se o
     * veiculo excluido saiu da frota, foi cadastrado em dobro ou foi apagado
     * por engano. DELETE com corpo e incomum, mas legitimo - o fetch do
     * navegador envia, e a API le daqui.
     */
    const justificativa = String(req.body?.justificativa || "").trim();
    if (justificativa.length < 5) {
      return res.status(400).json({
        erro: "Escreva a justificativa da exclusão (o motivo fica registrado na auditoria).",
      });
    }

    const cliente = await pool.connect();
    try {
      await cliente.query("BEGIN");

      // Mesmo recorte do GET e do PUT: fora do escopo, o registro simplesmente
      // nao existe para quem pediu.
      const recorte = escopo ? escopo(req) : null;
      const alvo = await cliente.query(
        `SELECT * FROM ${tabela}
          WHERE ${id} = $1${recorte ? ` AND ${recorte.coluna} = $2` : ""}
          FOR UPDATE`,
        recorte ? [idRegistro, recorte.valor] : [idRegistro]
      );
      if (!alvo.rows[0]) {
        await cliente.query("ROLLBACK");
        return res.status(404).json({ erro: "Registro não encontrado." });
      }

      /*
       * As linhas que pertencem ao registro saem junto, e vao para a
       * auditoria DENTRO dele. Antes a exclusao de uma inspecao ja feita (que
       * tem itens) ou de um checklist (que tem os equipamentos conferidos)
       * esbarrava na chave estrangeira e respondia "vinculado a outros" - o
       * botao Excluir existia, mas so funcionava em registro vazio.
       */
      const guardados = {};
      for (const f of filhos) {
        const { rows } = await cliente.query(
          `DELETE FROM ${f.tabela} WHERE ${f.chave} = $1 RETURNING *`,
          [idRegistro]
        );
        if (rows.length) guardados[f.tabela] = rows;
      }

      await cliente.query(`DELETE FROM ${tabela} WHERE ${id} = $1`, [idRegistro]);

      await registrarAuditoria({
        idUsuario: req.usuario.id_usuario,
        acao: "EXCLUIR",
        entidade: entidade || tabela,
        idRegistro,
        justificativa,
        dadosAnteriores: { ...alvo.rows[0], ...guardados },
      });

      await cliente.query("COMMIT");
      res.status(204).end(); // 204 = deu certo e nao ha corpo para devolver
    } catch (e) {
      await cliente.query("ROLLBACK").catch(() => {});
      // 23503 e o codigo do Postgres para violacao de chave estrangeira:
      // alguem tentou excluir um setor que ainda tem veiculos, por exemplo.
      // Sem esse tratamento, a tela mostraria "erro interno", que nao ajuda.
      if (e.code === "23503") {
        return res.status(409).json({
          erro: "Este registro está vinculado a outros e não pode ser excluído.",
        });
      }
      next(e);
    } finally {
      cliente.release();
    }
  });

  return router;
}
