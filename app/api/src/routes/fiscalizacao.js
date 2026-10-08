/**
 * fiscalizacao.js - Recursos do modulo de Fiscalizacao.
 *
 * Mesma ideia de frotas.js: so configuracoes para a fabrica em crud.js.
 *
 *   /api/fiscalizacao/servico-diario  escala do dia, por turno
 *   /api/fiscalizacao/equipes         equipes e seus integrantes
 *   /api/fiscalizacao/apoios          apoios extras acionados no turno
 *   /api/fiscalizacao/ocorrencias     ocorrencias atendidas
 *   /api/fiscalizacao/checklists      checklists das viaturas
 *   /api/fiscalizacao/pontuacao       itens de pontuacao (so o gestor ve)
 *
 * A Pontuacao usa a MESMA permissao para ver e para gerenciar, de proposito:
 * e a tela restrita ao gestor da Fiscalizacao.
 */
import { Router } from "express";
import { criarCrud } from "../crud.js";
import { query } from "../db.js";
import { autenticar, exigePermissao } from "../auth.js";

const VER = "FISCALIZACAO_VISUALIZAR";

export const servicoDiario = criarCrud({
  tabela: "servico_diario",
  id: "id_servico_diario",
  entidade: "servico_diario",
  select: `servico_diario.*,
           coordenador.nome AS coordenador,
           (SELECT COUNT(*)::int FROM servico_equipe se
             WHERE se.id_servico_diario = servico_diario.id_servico_diario) AS equipes,
           (SELECT COUNT(*)::int FROM ocorrencia o
             WHERE o.id_servico_diario = servico_diario.id_servico_diario) AS ocorrencias`,
  from: `servico_diario
         JOIN servidor coordenador ON coordenador.id_servidor = servico_diario.id_coordenador`,
  busca: ["coordenador.nome", "servico_diario.turno"],
  filtros: {
    status: "servico_diario.status", turno: "servico_diario.turno",
    coordenador: "servico_diario.id_coordenador",
    dataDe: "servico_diario.data", dataAte: "servico_diario.data",
  },
  ordenaveis: {
    data: "servico_diario.data", turno: "servico_diario.turno",
    status: "servico_diario.status", coordenador: "coordenador.nome",
  },
  ordemPadrao: "servico_diario.data DESC",
  campos: [
    "data", "turno", "id_coordenador", "criado_por", "hora_inicio",
    "hora_encerramento", "status", "encerrado_por",
  ],
  obrigatorios: ["data", "turno", "id_coordenador", "criado_por"],
  permissoes: { ver: VER, gerenciar: "FISCALIZACAO_GERENCIAR_SERVICO" },
});

export const equipes = criarCrud({
  tabela: "equipe",
  id: "id_equipe",
  entidade: "equipe",
  select: `equipe.*,
           (SELECT COUNT(*)::int FROM equipe_servidor es
             WHERE es.id_equipe = equipe.id_equipe) AS integrantes`,
  from: "equipe",
  busca: ["equipe.numero", "equipe.tipo", "equipe.observacoes"],
  filtros: { status: "equipe.status", tipo: "equipe.tipo" },
  ordenaveis: { numero: "equipe.numero", tipo: "equipe.tipo", status: "equipe.status" },
  ordemPadrao: "equipe.numero",
  campos: ["numero", "tipo", "status", "observacoes"],
  obrigatorios: ["numero", "tipo"],
  permissoes: { ver: VER, gerenciar: "FISCALIZACAO_GERENCIAR_EQUIPES" },
});

export const apoios = criarCrud({
  tabela: "apoio_extra",
  id: "id_apoio",
  entidade: "apoio_extra",
  select: `apoio_extra.*, equipe.numero AS equipe, veiculo.placa, servidor.nome AS servidor`,
  from: `apoio_extra
         LEFT JOIN equipe   ON equipe.id_equipe     = apoio_extra.id_equipe
         LEFT JOIN veiculo  ON veiculo.id_veiculo   = apoio_extra.id_veiculo
         LEFT JOIN servidor ON servidor.id_servidor = apoio_extra.id_servidor`,
  busca: ["apoio_extra.motivo", "equipe.numero", "servidor.nome"],
  filtros: { servico: "apoio_extra.id_servico_diario", equipe: "apoio_extra.id_equipe" },
  ordenaveis: { hora_inicio: "apoio_extra.hora_inicio", equipe: "equipe.numero" },
  ordemPadrao: "apoio_extra.hora_inicio DESC",
  campos: [
    "id_servico_diario", "id_equipe", "id_veiculo", "id_servidor",
    "motivo", "hora_inicio", "hora_fim", "observacoes",
  ],
  obrigatorios: ["id_servico_diario", "motivo"],
  permissoes: { ver: VER, gerenciar: "FISCALIZACAO_GERENCIAR_EQUIPES" },
});

export const ocorrencias = criarCrud({
  tabela: "ocorrencia",
  id: "id_ocorrencia",
  entidade: "ocorrencia",
  select: `ocorrencia.*,
           criador.nome AS criado_por_nome,
           servico_diario.data AS data_servico, servico_diario.turno`,
  from: `ocorrencia
         JOIN usuario  u_cri ON u_cri.id_usuario = ocorrencia.criado_por
         JOIN servidor criador ON criador.id_servidor = u_cri.id_servidor
         LEFT JOIN servico_diario ON servico_diario.id_servico_diario = ocorrencia.id_servico_diario`,
  busca: ["ocorrencia.protocolo", "ocorrencia.tipo", "ocorrencia.endereco", "ocorrencia.descricao"],
  filtros: {
    status: "ocorrencia.status", tipo: "ocorrencia.tipo",
    servico: "ocorrencia.id_servico_diario",
    dataDe: "ocorrencia.data", dataAte: "ocorrencia.data",
  },
  ordenaveis: {
    data: "ocorrencia.data", protocolo: "ocorrencia.protocolo",
    tipo: "ocorrencia.tipo", status: "ocorrencia.status",
  },
  ordemPadrao: "ocorrencia.data DESC, ocorrencia.hora DESC",
  campos: [
    "protocolo", "tipo", "descricao", "data", "hora", "endereco", "observacoes",
    "id_servico_diario", "criado_por", "status", "descricao_atendimento",
    "data_finalizacao",
  ],
  obrigatorios: ["tipo", "descricao", "data", "hora", "endereco", "criado_por"],
  permissoes: { ver: VER, gerenciar: "FISCALIZACAO_GERENCIAR_OCORRENCIAS" },
});

export const checklistsFiscalizacao = criarCrud({
  tabela: "checklist_fiscalizacao",
  // Equipamentos e os dois fiscais que assinaram saem junto com o checklist.
  filhos: [
    { tabela: "checklist_fiscal_equipamento", chave: "id_checklist" },
    { tabela: "checklist_fiscal_servidor", chave: "id_checklist" },
  ],
  id: "id_checklist",
  entidade: "checklist_fiscalizacao",
  select: `checklist_fiscalizacao.*,
           veiculo.placa, veiculo.marca, veiculo.modelo,
           equipe.numero AS equipe,
           (checklist_fiscalizacao.odometro_chegada - checklist_fiscalizacao.odometro_saida) AS km_rodado`,
  from: `checklist_fiscalizacao
         JOIN veiculo ON veiculo.id_veiculo = checklist_fiscalizacao.id_veiculo
         LEFT JOIN equipe ON equipe.id_equipe = checklist_fiscalizacao.id_equipe`,
  busca: ["veiculo.placa", "equipe.numero"],
  filtros: {
    veiculo: "checklist_fiscalizacao.id_veiculo",
    equipe: "checklist_fiscalizacao.id_equipe",
    status: "checklist_fiscalizacao.status",
    dataDe: "checklist_fiscalizacao.data_abertura",
    dataAte: "checklist_fiscalizacao.data_abertura",
  },
  ordenaveis: {
    data_abertura: "checklist_fiscalizacao.data_abertura",
    placa: "veiculo.placa", equipe: "equipe.numero",
  },
  ordemPadrao: "checklist_fiscalizacao.data_abertura DESC",
  campos: [
    "id_veiculo", "id_servico_diario", "id_equipe", "data_abertura", "hora_saida",
    "hora_chegada", "odometro_saida", "odometro_chegada", "observacoes",
    "status", "data_finalizacao",
  ],
  obrigatorios: ["id_veiculo", "odometro_saida"],
  // Corrigir checklist tem permissao PROPRIA (migracao 019): quem gerencia as
  // viaturas nao ganha de brinde o poder de reescrever o historico delas.
  permissoes: { ver: VER, gerenciar: "FISCALIZACAO_EDITAR_CHECKLIST" },
  // O checklist e prova de um fato. Alterar um numero dele exige dizer por
  // que, e o motivo fica na auditoria junto do antes e do depois.
  exigeJustificativa: true,
});

// Pontuacao: tela restrita ao gestor da Fiscalizacao. A permissao de leitura
// aqui e a mesma de gerenciar, de proposito.
export const pontuacaoItens = criarCrud({
  tabela: "pontuacao_item",
  id: "id_item",
  entidade: "pontuacao_item",
  select: `pontuacao_item.*,
           (SELECT COUNT(*)::int FROM pontuacao_registro r
             WHERE r.id_item = pontuacao_item.id_item) AS registros`,
  from: "pontuacao_item",
  busca: ["pontuacao_item.codigo", "pontuacao_item.nome", "pontuacao_item.descricao"],
  filtros: { ativo: "pontuacao_item.ativo" },
  ordenaveis: {
    codigo: "pontuacao_item.codigo", nome: "pontuacao_item.nome",
    valor_pontos: "pontuacao_item.valor_pontos",
  },
  ordemPadrao: "pontuacao_item.codigo",
  campos: ["codigo", "nome", "descricao", "valor_pontos", "ativo", "criado_por"],
  obrigatorios: ["codigo", "nome", "valor_pontos"],
  permissoes: {
    ver: "FISCALIZACAO_GERENCIAR_PONTUACAO",
    gerenciar: "FISCALIZACAO_GERENCIAR_PONTUACAO",
  },
});

const router = Router();

/*
 * Ficha do fiscal (08/10) - mesma tela de Detalhes do Motorista, com o que
 * e da Fiscalizacao: ocorrencias atendidas pelas equipes dele, checklists de
 * viatura que ele assinou, pontuacao (so para quem gerencia a pontuacao),
 * equipes, servicos que coordenou e o historico de atividades.
 *
 * Ocorrencia e pontuacao sao registradas por EQUIPE: entram as da equipe em
 * que o fiscal estava NAQUELE dia (data_inicio/data_fim do equipe_servidor).
 * Pontuacao lancada direto para o servidor tambem entra.
 */
router.get("/fiscais/:id/ficha", autenticar,
  exigePermissao(VER, "ADMIN_VISUALIZAR"),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const permissoes = req.usuario?.permissoes || [];
      const s = await query(
        `SELECT s.*, st.nome AS setor, c.nome AS cargo,
                (s.cnh_data_validade - CURRENT_DATE) AS cnh_dias
           FROM servidor s
           LEFT JOIN setor st ON st.id_setor = s.id_setor
           LEFT JOIN cargo c  ON c.id_cargo  = s.id_cargo
          WHERE s.id_servidor = $1`,
        [id]
      );
      const fiscal = s.rows[0];
      if (!fiscal) return res.status(404).json({ erro: "Fiscal não encontrado." });
      // Mesmo recorte da lista de servidores: quem so ve a Fiscalizacao
      // enxerga apenas o proprio setor.
      const amplo = permissoes.includes("ADMIN_VISUALIZAR") || permissoes.includes("FROTAS_VISUALIZAR");
      if (!amplo && String(fiscal.id_setor) !== String(req.usuario?.id_setor ?? -1)) {
        return res.status(403).json({ erro: "Este servidor é de outro setor." });
      }
      const vePontos = permissoes.includes("FISCALIZACAO_GERENCIAR_PONTUACAO");

      const usuario = await query(
        `SELECT u.login, u.status, u.ultimo_acesso, p.nome AS perfil
           FROM usuario u JOIN perfil p ON p.id_perfil = u.id_perfil
          WHERE u.id_servidor = $1`,
        [id]
      );

      const equipes = await query(
        `SELECT e.id_equipe, e.numero, e.tipo, es.data_inicio, es.data_fim,
                (es.status AND es.data_fim IS NULL) AS atual,
                (SELECT t.turno FROM equipe_turno t
                  WHERE t.id_equipe = e.id_equipe AND t.data_inicio <= CURRENT_DATE
                    AND (t.data_fim IS NULL OR t.data_fim >= CURRENT_DATE)
                  ORDER BY t.data_inicio DESC LIMIT 1) AS turno,
                (SELECT string_agg(sx.nome, ', ' ORDER BY sx.nome)
                   FROM equipe_servidor ex JOIN servidor sx ON sx.id_servidor = ex.id_servidor
                  WHERE ex.id_equipe = e.id_equipe AND ex.id_servidor <> $1
                    AND ex.status AND ex.data_fim IS NULL) AS colegas
           FROM equipe_servidor es
           JOIN equipe e ON e.id_equipe = es.id_equipe
          WHERE es.id_servidor = $1
          ORDER BY atual DESC, es.data_inicio DESC`,
        [id]
      );

      // Equipe do fiscal NAQUELE dia.
      const NA_EQUIPE = (dataCol, equipeCol) => `EXISTS (
        SELECT 1 FROM equipe_servidor es
         WHERE es.id_servidor = $1 AND es.id_equipe = ${equipeCol}
           AND es.data_inicio <= ${dataCol}
           AND (es.data_fim IS NULL OR es.data_fim >= ${dataCol}))`;

      const ocorrencias = await query(
        `SELECT DISTINCT ON (o.id_ocorrencia)
                o.id_ocorrencia, o.protocolo, o.tipo, o.data, o.hora, o.endereco,
                o.descricao, o.status, eq.numero AS equipe
           FROM ocorrencia o
           JOIN distribuicao_ocorrencia d ON d.id_ocorrencia = o.id_ocorrencia
           JOIN equipe eq ON eq.id_equipe = d.id_equipe
          WHERE ${NA_EQUIPE("d.data", "d.id_equipe")}
          ORDER BY o.id_ocorrencia, d.data DESC, d.hora DESC`,
        [id]
      );
      ocorrencias.rows.sort((a, b) =>
        String(b.data).localeCompare(String(a.data)) || String(b.hora).localeCompare(String(a.hora)));

      const checklists = await query(
        `SELECT c.id_checklist, c.data_abertura, c.hora_saida, c.hora_chegada, c.status,
                (c.odometro_chegada - c.odometro_saida) AS km_rodado, cs.tipo AS papel,
                v.placa, v.marca, v.modelo, eq.numero AS equipe
           FROM checklist_fiscal_servidor cs
           JOIN checklist_fiscalizacao c ON c.id_checklist = cs.id_checklist
           JOIN veiculo v ON v.id_veiculo = c.id_veiculo
           LEFT JOIN equipe eq ON eq.id_equipe = c.id_equipe
          WHERE cs.id_servidor = $1
          ORDER BY c.data_abertura DESC, c.hora_saida DESC
          LIMIT 200`,
        [id]
      );

      const pontuacao = vePontos ? await query(
        `SELECT r.id_pontuacao, r.data_registro, r.quantidade, r.pontos_aplicados, r.observacao,
                r.entidade_origem, i.codigo, i.nome AS item, eq.numero AS equipe,
                (r.id_servidor IS NOT NULL) AS individual
           FROM pontuacao_registro r
           JOIN pontuacao_item i ON i.id_item = r.id_item
           LEFT JOIN equipe eq ON eq.id_equipe = r.id_equipe
          WHERE r.id_servidor = $1
             OR (r.id_servidor IS NULL AND r.id_equipe IS NOT NULL
                 AND ${NA_EQUIPE("r.data_registro::date", "r.id_equipe")})
          ORDER BY r.data_registro DESC
          LIMIT 300`,
        [id]
      ) : null;

      const servicos = await query(
        `SELECT id_servico_diario, data, turno, status
           FROM servico_diario WHERE id_coordenador = $1
          ORDER BY data DESC LIMIT 100`,
        [id]
      );

      const cadastro = await query(
        `SELECT a.data_hora, a.acao, a.entidade, a.justificativa, COALESCE(sa.nome, ua.login) AS pessoa
           FROM auditoria a
           LEFT JOIN usuario ua ON ua.id_usuario = a.id_usuario
           LEFT JOIN servidor sa ON sa.id_servidor = ua.id_servidor
          WHERE (a.entidade = 'servidor' AND a.id_registro = $1)
             OR (a.entidade = 'usuario'
                 AND a.id_registro IN (SELECT id_usuario FROM usuario WHERE id_servidor = $1))
          ORDER BY a.data_hora DESC LIMIT 50`,
        [id]
      );

      const multasResumo = await query(
        `SELECT COUNT(*) FILTER (WHERE status <> 'CANCELADA')::int AS multas,
                COUNT(*) FILTER (WHERE status IN ('PENDENTE', 'EM_RECURSO'))::int AS multas_abertas,
                COALESCE(SUM(pontos) FILTER (WHERE status <> 'CANCELADA'
                  AND data >= CURRENT_DATE - INTERVAL '12 months'), 0)::int AS pontos_12m
           FROM multa WHERE id_servidor = $1`,
        [id]
      );

      const seisMeses = new Date();
      seisMeses.setMonth(seisMeses.getMonth() - 6);
      const recente = (d) => d && new Date(d) >= seisMeses;
      const soma = (lista) => lista.reduce((t, r) => t + Number(r.pontos_aplicados || 0), 0);

      res.json({
        ...fiscal,
        usuario: usuario.rows[0] || null,
        equipes: equipes.rows,
        ocorrencias: ocorrencias.rows,
        checklists: checklists.rows,
        pontuacao: pontuacao ? pontuacao.rows : null,
        servicos: servicos.rows,
        cadastro: cadastro.rows,
        resumo: {
          ocorrencias: ocorrencias.rows.length,
          ocorrencias_6m: ocorrencias.rows.filter((o) => recente(o.data)).length,
          checklists: checklists.rows.length,
          checklists_6m: checklists.rows.filter((c) => recente(c.data_abertura)).length,
          servicos: servicos.rows.length,
          pontos: pontuacao ? soma(pontuacao.rows) : null,
          pontos_6m: pontuacao ? soma(pontuacao.rows.filter((r) => recente(r.data_registro))) : null,
          ...multasResumo.rows[0],
        },
      });
    } catch (e) {
      next(e);
    }
  });

router.use("/servico-diario", servicoDiario);
router.use("/equipes", equipes);
router.use("/apoios", apoios);
router.use("/ocorrencias", ocorrencias);
router.use("/checklists", checklistsFiscalizacao);
router.use("/pontuacao", pontuacaoItens);

export default router;
