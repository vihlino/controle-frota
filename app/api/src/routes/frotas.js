/**
 * frotas.js - Recursos do modulo de Frotas.
 *
 * Este arquivo nao tem logica: ele so DECLARA como cada recurso funciona, e a
 * fabrica em crud.js transforma isso em rotas. Leia crud.js antes, para
 * entender o que cada campo da configuracao faz.
 *
 * Recursos declarados aqui:
 *   /api/frotas/veiculos      cadastro da frota
 *   /api/frotas/checklists    registros de saida e chegada (criados via QR Code)
 *   /api/frotas/inspecoes     inspecoes periodicas
 *   /api/frotas/manutencoes   ordens de servico
 *   /api/frotas/documentos    documentos dos veiculos e vencimentos
 *   /api/frotas/sinistros     ocorrencias com veiculos
 *
 * ATENCAO AOS JOINs: algumas colunas do banco (id_gestor, id_solicitante,
 * id_responsavel) apontam para USUARIO, nao para SERVIDOR. Para chegar ao nome
 * da pessoa e preciso passar por usuario -> servidor. Ja foi motivo de bug.
 */
import { Router } from "express";
import { criarCrud } from "../crud.js";
import { pool } from "../db.js";
import { autenticar, exigePermissao } from "../auth.js";
import { registrarAuditoria } from "../auditoria.js";

const VER = "FROTAS_VISUALIZAR";

// ---------- Veiculos ----------
export const veiculos = criarCrud({
  tabela: "veiculo",
  id: "id_veiculo",
  entidade: "veiculo",
  select: `veiculo.*, setor.nome AS setor,
           (SELECT codigo FROM qr_code q WHERE q.id_veiculo = veiculo.id_veiculo) AS qr_codigo`,
  from: "veiculo JOIN setor ON setor.id_setor = veiculo.id_setor",
  busca: ["veiculo.placa", "veiculo.marca", "veiculo.modelo", "veiculo.renavam", "veiculo.chassi"],
  filtros: {
    setor: "veiculo.id_setor", status: "veiculo.status", tipo: "veiculo.tipo_veiculo",
    vinculo: "veiculo.vinculo",
    // A tela de Viaturas da Fiscalizacao usa este filtro.
    viatura: "veiculo.viatura",
  },
  ordenaveis: {
    placa: "veiculo.placa", marca: "veiculo.marca", modelo: "veiculo.modelo",
    ano_modelo: "veiculo.ano_modelo", setor: "setor.nome", status: "veiculo.status",
  },
  ordemPadrao: "veiculo.placa",
  campos: [
    "placa", "marca", "modelo", "ano_fabricacao", "ano_modelo", "cor", "tipo_veiculo",
    "renavam", "chassi", "tipo_combustivel", "capacidade", "quilometragem_atual",
    "id_setor", "vinculo", "observacoes", "status",
    // "viatura" NAO entra: a coluna e calculada pelo banco a partir do setor
    // (migracao 016). Aceita-la aqui deixaria a tela gravar um valor que o
    // gatilho sobrescreve no mesmo instante - o pior tipo de campo, o que
    // parece funcionar e nao funciona.
  ],
  // Cor e combustivel NAO entram aqui: a tela sempre ofereceu os dois como
  // opcionais. A cor ja tinha sido tirada; o combustivel continuava exigido, e
  // era a razao de "Preencha: tipo_combustivel" ao cadastrar um veiculo sem
  // informar o combustivel - uma mensagem sobre um campo que a propria tela
  // diz ser opcional. A migracao 014 tirou o NOT NULL das duas colunas.
  obrigatorios: [
    "placa", "marca", "modelo", "ano_fabricacao", "ano_modelo",
    "tipo_veiculo", "id_setor",
  ],
  // Placa e codigo: sempre em caixa alta. Marca e cor sao nomes, e ficam com a
  // primeira letra maiuscula - assim a lista ordena certo e o mesmo veiculo
  // nao aparece escrito de tres jeitos.
  //
  // MODELO fica de fora de proposito: nome de versao e cheio de sigla
  // ("S10 LS 2.8", "ONIX 10TMT LT1"), e forcar a primeira letra maiuscula
  // estragava justamente essas ("S10 ls 2.8"). Aqui o certo e respeitar o que
  // a pessoa digitou, que e quem esta lendo o documento do veiculo.
  normalizacoes: {
    placa: "maiusculas",
    marca: "primeiraMaiuscula",
    cor: "primeiraMaiuscula",
  },
  // A tela de Viaturas, na Fiscalizacao, e ESTE mesmo cadastro filtrado - uma
  // viatura e um veiculo da frota vinculado ao setor de Fiscalizacao, nao um
  // cadastro a parte. Exigindo so FROTAS_VISUALIZAR, o gestor de fiscalizacao
  // abria "Viaturas" e recebia 403 numa tela do proprio modulo dele.
  // Gerenciar continua exigindo a permissao de Frotas: quem manda no cadastro
  // do veiculo e a frota, mesmo quando o veiculo esta na fiscalizacao.
  permissoes: {
    ver: [VER, "FISCALIZACAO_VISUALIZAR"],
    gerenciar: ["FROTAS_GERENCIAR_VEICULOS", "FISCALIZACAO_GERENCIAR_VIATURAS"],
  },
});

// ---------- Checklists ----------
// Nao existe POST pela tela administrativa: o checklist nasce da leitura do
// QR Code do veiculo, na rota /api/checklist-qr.
export const checklists = criarCrud({
  tabela: "checklist_frotas",
  // Os equipamentos conferidos saem junto com o checklist. As fotos ja saem
  // sozinhas (ON DELETE CASCADE) e ficam FORA da auditoria de proposito: um
  // registro de exclusao com as fotos dentro pesaria megabytes.
  filhos: [{ tabela: "checklist_frotas_equipamento", chave: "id_checklist" }],
  id: "id_checklist",
  entidade: "checklist",
  select: `checklist_frotas.*,
           servidor.nome AS condutor, servidor.matricula,
           veiculo.placa, veiculo.marca, veiculo.modelo,
           veiculo.ano_fabricacao, veiculo.ano_modelo, veiculo.cor,
           veiculo.tipo_veiculo, setor.nome AS setor,
           (checklist_frotas.odometro_chegada - checklist_frotas.odometro_saida) AS km_rodado,
           (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                     'equipamento', e.equipamento, 'conforme', e.conforme,
                     'momento', e.momento, 'observacao', e.observacao)), '[]'::jsonb)
              FROM checklist_frotas_equipamento e
             WHERE e.id_checklist = checklist_frotas.id_checklist) AS equipamentos,
           (SELECT COUNT(*) FROM checklist_frotas_foto f
             WHERE f.id_checklist = checklist_frotas.id_checklist) AS total_fotos,
           (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                     'id_os', os.id_os, 'numero', os.numero,
                     'parte_veiculo', os.parte_veiculo, 'gravidade', os.gravidade,
                     'descricao', os.descricao, 'status', os.status,
                     'momento', os.momento, 'data_abertura', os.data_abertura)
                     ORDER BY os.data_abertura), '[]'::jsonb)
              FROM ordem_servico os
             WHERE os.origem = 'CHECKLIST_FROTAS'
               AND os.id_registro_origem = checklist_frotas.id_checklist) AS chamados`,
  from: `checklist_frotas
         JOIN servidor ON servidor.id_servidor = checklist_frotas.id_servidor
         JOIN veiculo  ON veiculo.id_veiculo   = checklist_frotas.id_veiculo
         JOIN setor    ON setor.id_setor       = veiculo.id_setor`,
  busca: ["veiculo.placa", "servidor.nome", "checklist_frotas.percurso"],
  filtros: {
    veiculo: "checklist_frotas.id_veiculo",
    status: "checklist_frotas.status",
    dataDe: "checklist_frotas.data_abertura",
    dataAte: "checklist_frotas.data_abertura",
  },
  ordenaveis: {
    data_abertura: "checklist_frotas.data_abertura",
    criado_em: "checklist_frotas.criado_em",
    data_finalizacao: "checklist_frotas.data_finalizacao",
    placa: "veiculo.placa",
    condutor: "servidor.nome",
    km_rodado: "(checklist_frotas.odometro_chegada - checklist_frotas.odometro_saida)",
  },
  ordemPadrao: "checklist_frotas.criado_em DESC",
  campos: [
    "id_veiculo", "id_servidor", "data_abertura", "hora_saida", "data_devolucao",
    "hora_chegada", "odometro_saida", "odometro_chegada", "observacoes", "status",
    "percurso", "local_saida", "data_finalizacao", "observacoes_chegada",
  ],
  obrigatorios: ["id_veiculo", "id_servidor", "odometro_saida"],
  // Corrigir checklist tem permissao PROPRIA (migracao 019). Quem cadastra
  // veiculo nao ganha de brinde o poder de reescrever o historico de saidas.
  permissoes: { ver: VER, gerenciar: "FROTAS_EDITAR_CHECKLIST" },
  // O checklist e prova de um fato. Alterar um numero dele exige dizer por
  // que, e o motivo fica na auditoria junto do antes e do depois.
  exigeJustificativa: true,
});

/*
 * PUT /checklists/:id/equipamentos  -  corrige a conferencia de equipamentos.
 *
 * POR QUE UMA ROTA SEPARADA
 * -------------------------
 * Os equipamentos nao sao colunas do checklist: sao linhas de outra tabela,
 * uma por item e por momento (saida e chegada conferem os mesmos quatro
 * itens). O CRUD generico sabe gravar colunas, nao filhos - e ensina-lo a
 * fazer isso deixaria toda tela do sistema carregando um caso que so o
 * checklist tem.
 *
 * A gravacao SUBSTITUI as linhas daquele momento, em transacao. Atualizar uma
 * por uma deixaria o registro pela metade se a segunda falhasse, e o checklist
 * mostraria macaco conferido e estepe nao - sem ninguem ter escolhido isso.
 */
checklists.put(
  "/:id/equipamentos",
  autenticar,
  exigePermissao("FROTAS_EDITAR_CHECKLIST"),
  async (req, res, next) => {
    const cliente = await pool.connect();
    try {
      const idChecklist = Number(req.params.id);
      const { momento, itens } = req.body || {};
      const justificativa = String(req.body?.justificativa || "").trim();
      if (momento !== "SAIDA" && momento !== "CHEGADA") {
        return res.status(400).json({ erro: "Momento inválido." });
      }
      if (!Array.isArray(itens)) {
        return res.status(400).json({ erro: "Informe os itens conferidos." });
      }

      await cliente.query("BEGIN");

      const existe = await cliente.query(
        "SELECT id_checklist FROM checklist_frotas WHERE id_checklist = $1",
        [idChecklist]
      );
      if (!existe.rows[0]) {
        await cliente.query("ROLLBACK");
        return res.status(404).json({ erro: "Checklist não encontrado." });
      }

      const antes = await cliente.query(
        `SELECT equipamento, conforme, observacao FROM checklist_frotas_equipamento
          WHERE id_checklist = $1 AND COALESCE(momento, 'SAIDA') = $2`,
        [idChecklist, momento]
      );

      await cliente.query(
        `DELETE FROM checklist_frotas_equipamento
          WHERE id_checklist = $1 AND COALESCE(momento, 'SAIDA') = $2`,
        [idChecklist, momento]
      );

      for (const item of itens) {
        await cliente.query(
          `INSERT INTO checklist_frotas_equipamento
             (id_checklist, equipamento, conforme, observacao, momento)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            idChecklist,
            item.equipamento,
            item.conforme === true || item.conforme === "true",
            item.observacao || null,
            momento,
          ]
        );
      }

      await cliente.query("COMMIT");

      await registrarAuditoria({
        idUsuario: req.usuario.id_usuario,
        acao: "EDITAR",
        entidade: "checklist_equipamento",
        idRegistro: idChecklist,
        justificativa: justificativa || null,
        dadosAnteriores: { momento, itens: antes.rows },
        dadosNovos: { momento, itens },
      });

      res.json({ ok: true });
    } catch (e) {
      await cliente.query("ROLLBACK").catch(() => {});
      next(e);
    } finally {
      cliente.release();
    }
  }
);

// ---------- Inspecoes ----------
export const inspecoes = criarCrud({
  tabela: "inspecao",
  // Os itens conferidos pertencem a inspecao: saem junto e ficam guardados
  // na auditoria dentro dela.
  filhos: [{ tabela: "inspecao_item", chave: "id_inspecao" }],
  id: "id_inspecao",
  entidade: "inspecao",
  select: `inspecao.*,
           veiculo.placa, veiculo.marca, veiculo.modelo,
           servidor.nome AS responsavel,
           (SELECT COUNT(*)::int FROM inspecao_item i
             WHERE i.id_inspecao = inspecao.id_inspecao
               AND i.resultado <> 'NORMAL') AS itens_com_ressalva,
           -- Aprovado / Em analise / Analisado (migracao 029). E o que a lista
           -- mostra no lugar de "Aprovado / Reprovado".
           analise_inspecao(inspecao.status, inspecao.resultado, inspecao.analisada_em) AS analise,
           (SELECT s2.nome FROM usuario u2 JOIN servidor s2 ON s2.id_servidor = u2.id_servidor
             WHERE u2.id_usuario = inspecao.analisada_por) AS analisada_por_nome,
           -- As OS abertas a partir desta inspecao, para a ficha mostrar o que
           -- ja foi encaminhado e levar direto a cada uma.
           (SELECT COALESCE(json_agg(json_build_object(
                     'id_os', os.id_os, 'numero', os.numero, 'status', os.status,
                     'descricao', os.descricao) ORDER BY os.id_os), '[]'::json)
              FROM ordem_servico os
             WHERE os.origem = 'INSPECAO'
               AND os.id_registro_origem = inspecao.id_inspecao) AS ordens_servico`,
  from: `inspecao
         JOIN veiculo ON veiculo.id_veiculo = inspecao.id_veiculo
         JOIN usuario  u_gestor ON u_gestor.id_usuario  = inspecao.id_gestor
         JOIN servidor          ON servidor.id_servidor = u_gestor.id_servidor`,
  busca: ["veiculo.placa", "servidor.nome", "inspecao.numero"],
  filtros: {
    veiculo: "inspecao.id_veiculo", tipo: "inspecao.tipo", status: "inspecao.status",
    resultado: "inspecao.resultado",
    analise: "analise_inspecao(inspecao.status, inspecao.resultado, inspecao.analisada_em)",
    dataDe: "inspecao.data_realizacao", dataAte: "inspecao.data_realizacao",
  },
  ordenaveis: {
    data_realizacao: "inspecao.data_realizacao", placa: "veiculo.placa",
    tipo: "inspecao.tipo", status: "inspecao.status",
    proxima_inspecao: "inspecao.proxima_inspecao", responsavel: "servidor.nome",
    analise: "analise_inspecao(inspecao.status, inspecao.resultado, inspecao.analisada_em)",
  },
  ordemPadrao: "inspecao.data_realizacao DESC",
  campos: [
    "id_veiculo", "id_gestor", "tipo", "data_programada", "data_realizacao",
    "hora_inicio", "hora_finalizacao", "status", "resultado", "observacoes",
    "data_finalizacao", "local", "numero", "proxima_inspecao", "quilometragem",
  ],
  obrigatorios: ["id_veiculo", "id_gestor", "tipo"],
  permissoes: { ver: VER, gerenciar: "FROTAS_REALIZAR_INSPECAO" },
  // Inspecao tambem e prova de um fato: alterar ou apagar exige dizer por que,
  // e o motivo fica na auditoria junto do antes e do depois.
  exigeJustificativa: true,
  /*
   * Veiculo, responsavel, frequencia, data e hora so mudam enquanto a
   * inspecao esta PENDENTE (reagendar). Depois de feita, o que se corrige sao
   * os itens marcados - rota PUT /:id/itens, mais abaixo.
   */
  bloquearEdicao: (atual) =>
    atual.status !== "ABERTA"
      ? "Esta inspeção já foi feita: veículo, responsável, frequência, data e hora não mudam mais. Para corrigir o que foi marcado, use Editar na inspeção concluída."
      : null,
});

/*
 * ===========================================================================
 * Depois da inspecao: analisar, abrir OS, corrigir os itens
 * ===========================================================================
 * A inspecao nao termina quando o condutor aperta "Concluir". Se ele marcou
 * oleo baixo ou pneu murcho, alguem da gestao precisa ver e decidir - e as
 * rotas abaixo sao essa segunda metade.
 */

/** A inspecao, com o que as rotas abaixo precisam conferir. */
async function carregarInspecao(cliente, id) {
  const { rows } = await cliente.query(
    `SELECT i.id_inspecao, i.id_veiculo, i.status, i.resultado, i.analisada_em,
            i.observacoes, i.numero, v.placa
       FROM inspecao i JOIN veiculo v ON v.id_veiculo = i.id_veiculo
      WHERE i.id_inspecao = $1
      FOR UPDATE OF i`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Marca a inspecao como analisada, com o que foi decidido.
 *
 * Para quando olhar basta: "oleo completado na garagem", "pneu calibrado".
 * Quando o problema precisa de oficina, o caminho e abrir a OS (rota
 * seguinte), que marca a analise sozinha.
 */
inspecoes.post(
  "/:id/analise",
  autenticar,
  exigePermissao("FROTAS_REALIZAR_INSPECAO"),
  async (req, res, next) => {
    const cliente = await pool.connect();
    try {
      const id = Number(req.params.id);
      const observacao = String(req.body?.observacao || "").trim();
      if (observacao.length < 5) {
        return res.status(400).json({
          erro: "Escreva o que foi decidido (ex.: óleo completado na garagem, sem necessidade de OS).",
        });
      }
      await cliente.query("BEGIN");
      const insp = await carregarInspecao(cliente, id);
      if (!insp) {
        await cliente.query("ROLLBACK");
        return res.status(404).json({ erro: "Inspeção não encontrada." });
      }
      if (insp.status !== "FINALIZADA" || insp.resultado === "CONFORME") {
        await cliente.query("ROLLBACK");
        return res.status(409).json({
          erro: "Só inspeção concluída e com ressalva precisa de análise.",
        });
      }
      await cliente.query(
        `UPDATE inspecao
            SET analisada_em = CURRENT_TIMESTAMP, analisada_por = $2, analise_observacao = $3
          WHERE id_inspecao = $1`,
        [id, req.usuario.id_usuario, observacao]
      );
      await cliente.query("COMMIT");

      await registrarAuditoria({
        idUsuario: req.usuario.id_usuario,
        acao: "ANALISAR",
        entidade: "inspecao",
        idRegistro: id,
        dadosNovos: { analise_observacao: observacao },
      });
      res.json({ ok: true });
    } catch (e) {
      await cliente.query("ROLLBACK").catch(() => {});
      next(e);
    } finally {
      cliente.release();
    }
  }
);

/**
 * Abre uma OS de manutencao a partir da inspecao.
 *
 * A OS ja nasce ligada a inspecao (origem INSPECAO + id da inspecao): na tela
 * de manutencoes da para ver de onde ela veio, e na ficha da inspecao
 * aparecem as OS que ela gerou. E a abertura conta como analise - quem abriu
 * a OS olhou a inspecao e decidiu.
 */
inspecoes.post(
  "/:id/os",
  autenticar,
  exigePermissao("FROTAS_GERENCIAR_OS"),
  async (req, res, next) => {
    const cliente = await pool.connect();
    try {
      const id = Number(req.params.id);
      const descricao = String(req.body?.descricao || "").trim();
      const gravidade = String(req.body?.gravidade || "MEDIA");
      const tipo = req.body?.tipo === "PREVENTIVA" ? "PREVENTIVA" : "CORRETIVA";
      if (descricao.length < 5) {
        return res.status(400).json({ erro: "Descreva o que a manutenção precisa resolver." });
      }
      if (!["BAIXA", "MEDIA", "ALTA"].includes(gravidade)) {
        return res.status(400).json({ erro: "Prioridade inválida." });
      }

      await cliente.query("BEGIN");
      const insp = await carregarInspecao(cliente, id);
      if (!insp) {
        await cliente.query("ROLLBACK");
        return res.status(404).json({ erro: "Inspeção não encontrada." });
      }

      // OS-2026-00001: sequencial do ano, pelo maior numero ja usado (migracao 030).
      const { rows: seq } = await cliente.query("SELECT proximo_numero_os() AS numero");
      const numeroOs = seq[0].numero;

      const { rows } = await cliente.query(
        `INSERT INTO ordem_servico
           (id_veiculo, origem, id_registro_origem, gravidade, id_solicitante,
            tipo, status, descricao, numero, quilometragem)
         VALUES ($1, 'INSPECAO', $2, $3, $4, $5, 'EM_ANALISE', $6, $7,
                 (SELECT COALESCE(i.quilometragem, v.quilometragem_atual)
                    FROM inspecao i JOIN veiculo v ON v.id_veiculo = i.id_veiculo
                   WHERE i.id_inspecao = $2))
         RETURNING id_os, numero`,
        [insp.id_veiculo, id, gravidade, req.usuario.id_usuario, tipo, descricao, numeroOs]
      );

      // A abertura da OS conta como analise, se ainda nao houver uma.
      if (!insp.analisada_em && insp.status === "FINALIZADA" && insp.resultado !== "CONFORME") {
        await cliente.query(
          `UPDATE inspecao
              SET analisada_em = CURRENT_TIMESTAMP, analisada_por = $2, analise_observacao = $3
            WHERE id_inspecao = $1`,
          [id, req.usuario.id_usuario, `${rows[0].numero} aberta para manutenção.`]
        );
      }
      await cliente.query("COMMIT");

      await registrarAuditoria({
        idUsuario: req.usuario.id_usuario,
        acao: "CRIAR",
        entidade: "ordem_servico",
        idRegistro: rows[0].id_os,
        dadosNovos: { origem: "INSPECAO", id_inspecao: id, descricao, gravidade, tipo },
      });
      res.status(201).json(rows[0]);
    } catch (e) {
      await cliente.query("ROLLBACK").catch(() => {});
      next(e);
    } finally {
      cliente.release();
    }
  }
);

/**
 * Corrige o que foi marcado na inspecao: os itens (Conforme / Atencao /
 * Avaria e a observacao de cada um) e a observacao geral.
 *
 * Veiculo, responsavel, frequencia, data e hora NAO mudam por aqui: sao o
 * registro de QUANDO e DE QUE a inspecao foi feita. Corrigir e sobre o que
 * foi encontrado.
 *
 * O resultado e recalculado dos itens. Se uma correcao cria uma ressalva onde
 * nao havia, a inspecao volta para "Em analise" - alguem precisa olhar a
 * novidade. Senha e justificativa sao conferidas na tela; a justificativa
 * chega aqui e vai para a auditoria com o antes e o depois.
 */
inspecoes.put(
  "/:id/itens",
  autenticar,
  exigePermissao("FROTAS_REALIZAR_INSPECAO"),
  async (req, res, next) => {
    const cliente = await pool.connect();
    try {
      const id = Number(req.params.id);
      const { itens, observacoes } = req.body || {};
      const justificativa = String(req.body?.justificativa || "").trim();
      if (justificativa.length < 5) {
        return res.status(400).json({
          erro: "Escreva a justificativa da alteração (o motivo fica registrado na auditoria).",
        });
      }
      if (!Array.isArray(itens) || !itens.length) {
        return res.status(400).json({ erro: "Informe os itens conferidos." });
      }
      const RESULTADOS = ["NORMAL", "ATENCAO", "AVARIA"];
      for (const it of itens) {
        if (!it?.item || !RESULTADOS.includes(it.resultado)) {
          return res.status(400).json({ erro: "Há item sem resultado válido." });
        }
        // O banco exige observacao em item com ressalva; a mensagem aqui diz
        // QUAL item, em vez do erro de restricao do Postgres.
        if (it.resultado !== "NORMAL" && !String(it.observacao || "").trim()) {
          return res.status(400).json({ erro: `Escreva o que foi observado em "${it.item}".` });
        }
      }

      await cliente.query("BEGIN");
      const insp = await carregarInspecao(cliente, id);
      if (!insp) {
        await cliente.query("ROLLBACK");
        return res.status(404).json({ erro: "Inspeção não encontrada." });
      }
      if (insp.status !== "FINALIZADA") {
        await cliente.query("ROLLBACK");
        return res.status(409).json({ erro: "A inspeção ainda não foi feita: não há itens para corrigir." });
      }

      const antes = await cliente.query(
        `SELECT item, grupo, resultado, observacao FROM inspecao_item
          WHERE id_inspecao = $1 ORDER BY id_inspecao_item`,
        [id]
      );
      await cliente.query("DELETE FROM inspecao_item WHERE id_inspecao = $1", [id]);
      for (const it of itens) {
        await cliente.query(
          `INSERT INTO inspecao_item (id_inspecao, item, grupo, resultado, observacao)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, it.item, it.grupo || null, it.resultado,
           it.resultado === "NORMAL" ? null : String(it.observacao).trim()]
        );
      }

      const resultado = itens.some((i) => i.resultado !== "NORMAL") ? "COM_AVARIAS" : "CONFORME";
      // Ressalva nova onde nao havia: volta para a fila de analise.
      const reabrir = insp.resultado === "CONFORME" && resultado === "COM_AVARIAS";
      await cliente.query(
        `UPDATE inspecao
            SET resultado = $2,
                observacoes = $3,
                analisada_em       = CASE WHEN $4 THEN NULL ELSE analisada_em END,
                analisada_por      = CASE WHEN $4 THEN NULL ELSE analisada_por END,
                analise_observacao = CASE WHEN $4 THEN NULL ELSE analise_observacao END
          WHERE id_inspecao = $1`,
        [id, resultado, String(observacoes ?? insp.observacoes ?? "").trim() || null, reabrir]
      );
      await cliente.query("COMMIT");

      await registrarAuditoria({
        idUsuario: req.usuario.id_usuario,
        acao: "EDITAR",
        entidade: "inspecao_item",
        idRegistro: id,
        justificativa,
        dadosAnteriores: { resultado: insp.resultado, observacoes: insp.observacoes, itens: antes.rows },
        dadosNovos: { resultado, observacoes: observacoes ?? insp.observacoes, itens },
      });
      res.json({ ok: true, resultado });
    } catch (e) {
      await cliente.query("ROLLBACK").catch(() => {});
      next(e);
    } finally {
      cliente.release();
    }
  }
);

// ---------- Manutencoes / Ordens de servico ----------
export const manutencoes = criarCrud({
  tabela: "ordem_servico",
  id: "id_os",
  entidade: "ordem_servico",
  // O solicitante pode vir de dois lugares: um USUARIO logado, quando a OS
  // nasce nas telas administrativas, ou um SERVIDOR, quando o condutor abre o
  // chamado pelo checklist do QR Code - ali nao existe login. Os JOINs sao
  // LEFT por isso: com INNER, todo chamado aberto no patio sumia da lista.
  select: `ordem_servico.*,
           veiculo.placa, veiculo.marca, veiculo.modelo,
           veiculo.quilometragem_atual,
           COALESCE(solicitante.nome, condutor.nome) AS solicitante,
           responsavel.nome AS responsavel,
           (SELECT s3.nome FROM usuario u3 JOIN servidor s3 ON s3.id_servidor = u3.id_servidor
             WHERE u3.id_usuario = ordem_servico.fechada_por) AS fechada_por_nome,
           -- Itens (migracao 030), na ordem digitada: os do registro (o que
           -- a oficina deve olhar) e os do fechamento (o que foi feito).
           (SELECT COALESCE(json_agg(json_build_object(
                     'descricao', it.descricao, 'observacao', it.observacao)
                     ORDER BY it.ordem, it.id_os_item), '[]'::json)
              FROM os_item it
             WHERE it.id_os = ordem_servico.id_os AND it.momento = 'REGISTRO') AS itens,
           (SELECT COALESCE(json_agg(json_build_object(
                     'descricao', it.descricao, 'observacao', it.observacao)
                     ORDER BY it.ordem, it.id_os_item), '[]'::json)
              FROM os_item it
             WHERE it.id_os = ordem_servico.id_os AND it.momento = 'FECHAMENTO') AS itens_fechamento`,
  from: `ordem_servico
         JOIN veiculo ON veiculo.id_veiculo = ordem_servico.id_veiculo
         LEFT JOIN usuario  u_sol ON u_sol.id_usuario = ordem_servico.id_solicitante
         LEFT JOIN servidor solicitante ON solicitante.id_servidor = u_sol.id_servidor
         LEFT JOIN servidor condutor ON condutor.id_servidor = ordem_servico.id_servidor_solicitante
         LEFT JOIN usuario  u_resp ON u_resp.id_usuario = ordem_servico.id_responsavel
         LEFT JOIN servidor responsavel ON responsavel.id_servidor = u_resp.id_servidor`,
  busca: ["veiculo.placa", "ordem_servico.descricao", "ordem_servico.oficina", "ordem_servico.numero"],
  filtros: {
    veiculo: "ordem_servico.id_veiculo", status: "ordem_servico.status",
    tipo: "ordem_servico.tipo", gravidade: "ordem_servico.gravidade",
    origem: "ordem_servico.origem",
    dataDe: "ordem_servico.data_abertura", dataAte: "ordem_servico.data_abertura",
  },
  ordenaveis: {
    data_abertura: "ordem_servico.data_abertura", placa: "veiculo.placa",
    status: "ordem_servico.status", gravidade: "ordem_servico.gravidade",
    custo: "ordem_servico.custo", data_agendada: "ordem_servico.data_agendada",
  },
  ordemPadrao: "ordem_servico.data_abertura DESC",
  campos: [
    "id_veiculo", "origem", "id_registro_origem", "gravidade", "id_solicitante",
    "id_responsavel", "data_inicio", "data_conclusao", "status", "servico_realizado",
    "oficina", "custo", "houve_troca", "observacoes", "tipo", "data_agendada",
    "proxima_manutencao", "quilometragem", "descricao", "numero",
    "id_servidor_solicitante", "parte_veiculo", "momento",
  ],
  obrigatorios: ["id_veiculo", "origem", "gravidade", "id_solicitante", "tipo"],
  permissoes: { ver: VER, gerenciar: "FROTAS_GERENCIAR_OS" },
  // Apagar a OS leva junto os itens e pecas dela (ficam na auditoria).
  filhos: [
    { tabela: "os_item", chave: "id_os" },
    { tabela: "os_peca", chave: "id_os" },
  ],
});

/*
 * ===========================================================================
 * OS como HISTORICO: registrar, editar e fechar
 * ===========================================================================
 * A gestao nao executa a manutencao - registra a OS que foi para a oficina
 * e, quando o servico volta, registra o fechamento. As tres rotas abaixo
 * gravam a OS junto com os itens (tabela os_item) numa transacao so, o que o
 * CRUD generico nao faz.
 */

const TIPOS_OS = ["PREVENTIVA", "CORRETIVA"];
const PRIORIDADES_OS = ["BAIXA", "MEDIA", "ALTA"];

const textoOuNulo = (v) => {
  const t = String(v ?? "").trim();
  return t === "" ? null : t;
};
const numeroOuNulo = (v) => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};
const dataOuNula = (v) => {
  const t = String(v ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
};

/** Itens digitados: so os que tem descricao, na ordem da tela. */
function itensDaOs(lista) {
  if (!Array.isArray(lista)) return [];
  return lista
    .map((i) => ({
      descricao: String(i?.descricao ?? "").trim().slice(0, 200),
      observacao: textoOuNulo(i?.observacao),
    }))
    .filter((i) => i.descricao);
}

/** Substitui a lista de um momento (REGISTRO ou FECHAMENTO); a outra fica. */
async function gravarItensOs(cliente, idOs, itens, momento = "REGISTRO") {
  await cliente.query("DELETE FROM os_item WHERE id_os = $1 AND momento = $2", [idOs, momento]);
  for (const [ordem, item] of itens.entries()) {
    await cliente.query(
      "INSERT INTO os_item (id_os, ordem, descricao, observacao, momento) VALUES ($1, $2, $3, $4, $5)",
      [idOs, ordem, item.descricao, item.observacao, momento]
    );
  }
}

async function carregarOs(cliente, id) {
  const { rows } = await cliente.query(
    `SELECT os.*,
            (SELECT COALESCE(json_agg(json_build_object('descricao', it.descricao,
                     'observacao', it.observacao, 'momento', it.momento)
                     ORDER BY it.momento DESC, it.ordem, it.id_os_item), '[]'::json)
               FROM os_item it WHERE it.id_os = os.id_os) AS itens
       FROM ordem_servico os WHERE os.id_os = $1 FOR UPDATE`,
    [id]
  );
  return rows[0] || null;
}

/** Valida e monta os campos do REGISTRO. Devolve { erro } ou { dados }. */
function dadosDoRegistro(corpo) {
  const dados = {
    id_veiculo: Number(corpo.id_veiculo),
    tipo: String(corpo.tipo || ""),
    gravidade: String(corpo.gravidade || ""),
    data_agendada: dataOuNula(corpo.data_agendada),
    oficina: textoOuNulo(corpo.oficina),
    responsavel_oficina: textoOuNulo(corpo.responsavel_oficina),
    telefone_oficina: textoOuNulo(corpo.telefone_oficina),
    descricao: textoOuNulo(corpo.descricao),
    custo_estimado: numeroOuNulo(corpo.custo_estimado),
    prazo_previsto: dataOuNula(corpo.prazo_previsto),
    pecas_necessarias: textoOuNulo(corpo.pecas_necessarias),
    observacoes: textoOuNulo(corpo.observacoes),
    quilometragem: numeroOuNulo(corpo.quilometragem),
  };
  if (dados.quilometragem !== null && (!Number.isInteger(dados.quilometragem) || dados.quilometragem < 0)) {
    return { erro: "KM do registro inválido: use só números inteiros." };
  }
  if (!Number.isInteger(dados.id_veiculo) || dados.id_veiculo <= 0) return { erro: "Selecione o veículo." };
  if (!dados.data_agendada) return { erro: "Informe a data agendada." };
  if (!PRIORIDADES_OS.includes(dados.gravidade)) return { erro: "Selecione a prioridade." };
  if (!TIPOS_OS.includes(dados.tipo)) return { erro: "Selecione o tipo de manutenção." };
  if (!dados.oficina) return { erro: "Informe a oficina / fornecedor." };
  if (!dados.descricao || dados.descricao.length < 5) {
    return { erro: "Descreva o serviço a ser realizado (pelo menos 5 caracteres)." };
  }
  if (Number.isNaN(dados.custo_estimado) || dados.custo_estimado < 0) {
    return { erro: "Custo estimado inválido." };
  }
  return { dados };
}

/** Registrar OS: a OS e os itens a verificar, de uma vez. */
manutencoes.post(
  "/registro",
  autenticar,
  exigePermissao("FROTAS_GERENCIAR_OS"),
  async (req, res, next) => {
    const { erro, dados } = dadosDoRegistro(req.body || {});
    if (erro) return res.status(400).json({ erro });
    const itens = itensDaOs(req.body?.itens);
    const cliente = await pool.connect();
    try {
      await cliente.query("BEGIN");
      const { rows: v } = await cliente.query(
        "SELECT quilometragem_atual FROM veiculo WHERE id_veiculo = $1", [dados.id_veiculo]
      );
      if (!v[0]) {
        await cliente.query("ROLLBACK");
        return res.status(400).json({ erro: "Veículo não encontrado." });
      }
      const { rows } = await cliente.query(
        `INSERT INTO ordem_servico
           (id_veiculo, origem, gravidade, id_solicitante, tipo, status, data_agendada,
            oficina, responsavel_oficina, telefone_oficina, descricao, custo_estimado,
            prazo_previsto, pecas_necessarias, observacoes, quilometragem)
         VALUES ($1, 'FROTAS', $2, $3, $4, 'EM_ANALISE', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [dados.id_veiculo, dados.gravidade, req.usuario.id_usuario, dados.tipo, dados.data_agendada,
         dados.oficina, dados.responsavel_oficina, dados.telefone_oficina, dados.descricao,
         dados.custo_estimado, dados.prazo_previsto, dados.pecas_necessarias, dados.observacoes,
         dados.quilometragem ?? v[0].quilometragem_atual]
      );
      await gravarItensOs(cliente, rows[0].id_os, itens);
      await cliente.query("COMMIT");

      await registrarAuditoria({
        idUsuario: req.usuario.id_usuario,
        acao: "CRIAR",
        entidade: "ordem_servico",
        idRegistro: rows[0].id_os,
        dadosNovos: { ...rows[0], itens },
      });
      res.status(201).json(rows[0]);
    } catch (e) {
      await cliente.query("ROLLBACK").catch(() => {});
      next(e);
    } finally {
      cliente.release();
    }
  }
);

/** Editar o registro de uma OS ainda aberta. Pede justificativa. */
manutencoes.put(
  "/:id/registro",
  autenticar,
  exigePermissao("FROTAS_GERENCIAR_OS"),
  async (req, res, next) => {
    const id = Number(req.params.id);
    const { erro, dados } = dadosDoRegistro(req.body || {});
    if (erro) return res.status(400).json({ erro });
    const justificativa = String(req.body?.justificativa || "").trim();
    if (justificativa.length < 5) {
      return res.status(400).json({
        erro: "Escreva a justificativa da alteração (o motivo fica registrado na auditoria).",
      });
    }
    const itens = itensDaOs(req.body?.itens);
    const cliente = await pool.connect();
    try {
      await cliente.query("BEGIN");
      const antes = await carregarOs(cliente, id);
      if (!antes) {
        await cliente.query("ROLLBACK");
        return res.status(404).json({ erro: "OS não encontrada." });
      }
      // Os dados do REGISTRO continuam corrigiveis depois do fechamento (a
      // ficha tem uma aba para cada); so a OS cancelada nao muda mais.
      if (antes.status === "CANCELADA") {
        await cliente.query("ROLLBACK");
        return res.status(409).json({ erro: "OS cancelada não pode ser alterada." });
      }
      const { rows } = await cliente.query(
        `UPDATE ordem_servico
            SET id_veiculo = $2, gravidade = $3, tipo = $4, data_agendada = $5, oficina = $6,
                responsavel_oficina = $7, telefone_oficina = $8, descricao = $9,
                custo_estimado = $10, prazo_previsto = $11, pecas_necessarias = $12,
                observacoes = $13, quilometragem = COALESCE($14, quilometragem)
          WHERE id_os = $1
          RETURNING *`,
        [id, dados.id_veiculo, dados.gravidade, dados.tipo, dados.data_agendada, dados.oficina,
         dados.responsavel_oficina, dados.telefone_oficina, dados.descricao, dados.custo_estimado,
         dados.prazo_previsto, dados.pecas_necessarias, dados.observacoes, dados.quilometragem]
      );
      await gravarItensOs(cliente, id, itens);
      await cliente.query("COMMIT");

      await registrarAuditoria({
        idUsuario: req.usuario.id_usuario,
        acao: "EDITAR",
        entidade: "ordem_servico",
        idRegistro: id,
        justificativa,
        dadosAnteriores: antes,
        dadosNovos: { ...rows[0], itens },
      });
      res.json(rows[0]);
    } catch (e) {
      await cliente.query("ROLLBACK").catch(() => {});
      if (e.code === "23503") return res.status(400).json({ erro: "Veículo não encontrado." });
      next(e);
    } finally {
      cliente.release();
    }
  }
);

/**
 * Fechamento da OS: o que a oficina fez, quanto custou e o KM de volta.
 *
 * Serve tambem para CORRIGIR um fechamento ja feito - ai pede justificativa,
 * como toda alteracao de algo que ja virou historico.
 */
manutencoes.post(
  "/:id/fechamento",
  autenticar,
  exigePermissao("FROTAS_GERENCIAR_OS"),
  async (req, res, next) => {
    const id = Number(req.params.id);
    const corpo = req.body || {};
    const f = {
      data_fechamento: dataOuNula(corpo.data_fechamento),
      km_fechamento: numeroOuNulo(corpo.km_fechamento),
      oficina: textoOuNulo(corpo.oficina),
      telefone_oficina: textoOuNulo(corpo.telefone_oficina),
      servico_realizado: textoOuNulo(corpo.servico_realizado),
      custo: numeroOuNulo(corpo.custo_final),
      data_conclusao: dataOuNula(corpo.data_conclusao),
      pecas_trocadas: textoOuNulo(corpo.pecas_trocadas),
      observacoes_fechamento: textoOuNulo(corpo.observacoes_fechamento),
    };
    if (!f.data_fechamento) return res.status(400).json({ erro: "Informe a data de fechamento." });
    if (corpo.km_confirmado !== true) {
      return res.status(400).json({ erro: "Confirme se o KM atual está correto." });
    }
    if (f.km_fechamento === null || !Number.isInteger(f.km_fechamento) || f.km_fechamento < 0) {
      return res.status(400).json({ erro: "Informe o KM atual do veículo." });
    }
    if (!f.servico_realizado || f.servico_realizado.length < 5) {
      return res.status(400).json({ erro: "Descreva o serviço realizado (pelo menos 5 caracteres)." });
    }
    if (Number.isNaN(f.custo) || (f.custo !== null && f.custo < 0)) {
      return res.status(400).json({ erro: "Custo final inválido." });
    }
    if (f.data_conclusao && f.data_conclusao > f.data_fechamento) {
      return res.status(400).json({
        erro: "A data de finalização não pode ser depois da data de fechamento.",
      });
    }
    // OS resolvida precisa de data de conclusao (regra do banco). Sem a data
    // de finalizacao da oficina, vale a do fechamento.
    f.data_conclusao = f.data_conclusao || f.data_fechamento;
    const itens = itensDaOs(corpo.itens);
    const justificativa = String(corpo.justificativa || "").trim();

    const cliente = await pool.connect();
    try {
      await cliente.query("BEGIN");
      const antes = await carregarOs(cliente, id);
      if (!antes) {
        await cliente.query("ROLLBACK");
        return res.status(404).json({ erro: "OS não encontrada." });
      }
      if (antes.status === "CANCELADA") {
        await cliente.query("ROLLBACK");
        return res.status(409).json({ erro: "OS cancelada não pode ser fechada." });
      }
      const corrigindo = antes.status === "RESOLVIDA";
      if (corrigindo && justificativa.length < 5) {
        await cliente.query("ROLLBACK");
        return res.status(400).json({
          erro: "Escreva a justificativa da alteração (o motivo fica registrado na auditoria).",
        });
      }

      const { rows } = await cliente.query(
        `UPDATE ordem_servico
            SET status = 'RESOLVIDA', data_fechamento = $2, km_fechamento = $3,
                oficina = COALESCE($4, oficina), telefone_oficina = $5,
                servico_realizado = $6, custo = $7, data_conclusao = $8,
                pecas_trocadas = $9::text, houve_troca = ($9::text IS NOT NULL),
                observacoes_fechamento = $10,
                fechada_por = CASE WHEN status = 'RESOLVIDA' THEN fechada_por ELSE $11 END
          WHERE id_os = $1
          RETURNING *`,
        [id, f.data_fechamento, f.km_fechamento, f.oficina, f.telefone_oficina,
         f.servico_realizado, f.custo, f.data_conclusao, f.pecas_trocadas,
         f.observacoes_fechamento, req.usuario.id_usuario]
      );
      await gravarItensOs(cliente, id, itens, "FECHAMENTO");

      // O KM confirmado atualiza o veiculo - so para a frente, nunca para tras.
      await cliente.query(
        `UPDATE veiculo SET quilometragem_atual = $2
          WHERE id_veiculo = $1 AND quilometragem_atual < $2`,
        [antes.id_veiculo, f.km_fechamento]
      );
      await cliente.query("COMMIT");

      await registrarAuditoria({
        idUsuario: req.usuario.id_usuario,
        acao: corrigindo ? "EDITAR" : "FECHAR_OS",
        entidade: "ordem_servico",
        idRegistro: id,
        justificativa: justificativa || null,
        dadosAnteriores: antes,
        dadosNovos: { ...rows[0], itens_fechamento: itens },
      });
      res.json(rows[0]);
    } catch (e) {
      await cliente.query("ROLLBACK").catch(() => {});
      next(e);
    } finally {
      cliente.release();
    }
  }
);

// ---------- Documentos ----------
export const documentos = criarCrud({
  tabela: "documento_veiculo",
  id: "id_documento",
  entidade: "documento",
  /*
   * A situacao vem CALCULADA da data, nao da coluna gravada.
   *
   * documento_veiculo.status e escrito por gatilho, que so dispara quando a
   * linha muda - entao ele congela a situacao do dia do cadastro. Um CRLV
   * gravado como VENCENDO continuava VENCENDO meses depois de vencer, e a tela
   * mostrava "Vencido ha 10 dias" ao lado de um selo amarelo "Vencendo".
   *
   * Por isso as colunas estao listadas uma a uma em vez de
   * "documento_veiculo.*": e a unica forma de a situacao calculada OCUPAR o
   * lugar de status, sem duas colunas com o mesmo nome na resposta. Coluna
   * nova na tabela precisa ser acrescentada aqui tambem.
   *
   * A regra mora em situacao_documento() (migracao 023), usada tambem no
   * filtro e na ordenacao abaixo - as tres precisam concordar, senao a tela
   * filtra por uma situacao e mostra outra.
   */
  select: `documento_veiculo.id_documento, documento_veiculo.id_veiculo,
           documento_veiculo.tipo_documento, documento_veiculo.numero_documento,
           documento_veiculo.data_emissao, documento_veiculo.data_validade,
           documento_veiculo.observacoes, documento_veiculo.categoria,
           documento_veiculo.id_responsavel, documento_veiculo.arquivo_url,
           situacao_documento(documento_veiculo.status,
                              documento_veiculo.data_validade) AS status,
           veiculo.placa, veiculo.marca, veiculo.modelo,
           servidor.nome AS responsavel,
           (documento_veiculo.data_validade - CURRENT_DATE) AS dias_para_vencer`,
  from: `documento_veiculo
         JOIN veiculo ON veiculo.id_veiculo = documento_veiculo.id_veiculo
         LEFT JOIN servidor ON servidor.id_servidor = documento_veiculo.id_responsavel`,
  busca: ["veiculo.placa", "documento_veiculo.tipo_documento", "documento_veiculo.numero_documento"],
  filtros: {
    veiculo: "documento_veiculo.id_veiculo",
    status: "situacao_documento(documento_veiculo.status, documento_veiculo.data_validade)",
    categoria: "documento_veiculo.categoria", responsavel: "documento_veiculo.id_responsavel",
    validadeDe: "documento_veiculo.data_validade", validadeAte: "documento_veiculo.data_validade",
  },
  ordenaveis: {
    tipo_documento: "documento_veiculo.tipo_documento", placa: "veiculo.placa",
    data_validade: "documento_veiculo.data_validade",
    status: "situacao_documento(documento_veiculo.status, documento_veiculo.data_validade)",
    data_emissao: "documento_veiculo.data_emissao",
  },
  ordemPadrao: "documento_veiculo.data_validade",
  campos: [
    "id_veiculo", "tipo_documento", "numero_documento", "data_emissao",
    "data_validade", "status", "observacoes",
    "categoria", "id_responsavel", "arquivo_url",
  ],
  obrigatorios: ["id_veiculo", "tipo_documento"],
  permissoes: { ver: VER, gerenciar: "FROTAS_GERENCIAR_DOCUMENTOS" },
});

// ---------- Sinistros ----------
export const sinistros = criarCrud({
  tabela: "sinistro",
  id: "id_sinistro",
  entidade: "sinistro",
  select: `sinistro.*,
           veiculo.placa, veiculo.marca, veiculo.modelo,
           condutor.nome AS condutor,
           responsavel.nome AS responsavel`,
  from: `sinistro
         JOIN veiculo ON veiculo.id_veiculo = sinistro.id_veiculo
         JOIN servidor condutor ON condutor.id_servidor = sinistro.id_servidor
         JOIN usuario  u_resp ON u_resp.id_usuario = sinistro.id_responsavel
         JOIN servidor responsavel ON responsavel.id_servidor = u_resp.id_servidor`,
  busca: ["veiculo.placa", "sinistro.local", "sinistro.descricao", "sinistro.numero", "sinistro.bo"],
  filtros: {
    veiculo: "sinistro.id_veiculo", status: "sinistro.status", tipo: "sinistro.tipo",
    responsavel: "sinistro.id_responsavel",
    dataDe: "sinistro.data", dataAte: "sinistro.data",
  },
  ordenaveis: {
    data: "sinistro.data", placa: "veiculo.placa", status: "sinistro.status",
    tipo: "sinistro.tipo", numero: "sinistro.numero",
  },
  ordemPadrao: "sinistro.data DESC",
  campos: [
    "id_veiculo", "id_servidor", "data", "hora", "local", "descricao", "bo",
    "observacoes", "status", "id_responsavel", "id_os", "tipo",
    "houve_terceiros", "numero",
  ],
  obrigatorios: ["id_veiculo", "id_servidor", "data", "hora", "local", "descricao", "id_responsavel"],
  permissoes: { ver: VER, gerenciar: "FROTAS_GERENCIAR_SINISTROS" },
});

const router = Router();
router.use("/veiculos", veiculos);
router.use("/checklists", checklists);
router.use("/inspecoes", inspecoes);
router.use("/manutencoes", manutencoes);
router.use("/documentos", documentos);
router.use("/sinistros", sinistros);

export default router;
