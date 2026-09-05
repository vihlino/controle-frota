/**
 * auditoriaRotas.js - Consulta dos rastros do sistema.
 *
 * Tudo aqui e SOMENTE LEITURA - por isso as configuracoes trazem
 * somenteLeitura: true, e a fabrica nao cria POST/PUT/DELETE. Rastro que pode
 * ser editado nao serve como rastro.
 *
 *   /api/auditoria/acoes       tudo que foi criado, editado ou excluido
 *   /api/auditoria/acessos     entradas, saidas e falhas de login
 *   /api/auditoria/alteracoes  so o que mudou dados, com antes e depois
 */
import { Router } from "express";
import { criarCrud } from "../crud.js";

// Auditoria e logs sao sempre somente leitura: ninguem edita ou apaga rastro.
export const acoes = criarCrud({
  tabela: "auditoria",
  id: "id_auditoria",
  select: `auditoria.*, servidor.nome AS usuario_nome, usuario.login`,
  from: `auditoria
         JOIN usuario  ON usuario.id_usuario   = auditoria.id_usuario
         JOIN servidor ON servidor.id_servidor = usuario.id_servidor`,
  busca: ["auditoria.entidade", "auditoria.acao", "servidor.nome", "usuario.login"],
  filtros: {
    usuario: "auditoria.id_usuario", acao: "auditoria.acao",
    entidade: "auditoria.entidade",
    dataDe: "auditoria.data_hora", dataAte: "auditoria.data_hora",
  },
  ordenaveis: {
    data_hora: "auditoria.data_hora", acao: "auditoria.acao",
    entidade: "auditoria.entidade", usuario_nome: "servidor.nome",
  },
  ordemPadrao: "auditoria.data_hora DESC",
  permissoes: { ver: "AUDITORIA_VISUALIZAR_ACOES" },
  somenteLeitura: true,
});

export const acessos = criarCrud({
  tabela: "log_acesso",
  id: "id_log_acesso",
  select: `log_acesso.*, servidor.nome AS usuario_nome`,
  from: `log_acesso
         LEFT JOIN usuario  ON usuario.id_usuario   = log_acesso.id_usuario
         LEFT JOIN servidor ON servidor.id_servidor = usuario.id_servidor`,
  busca: ["log_acesso.login_informado", "servidor.nome", "log_acesso.endereco_ip"],
  filtros: {
    usuario: "log_acesso.id_usuario", tipo: "log_acesso.tipo_evento",
    sucesso: "log_acesso.sucesso",
    dataDe: "log_acesso.data_hora", dataAte: "log_acesso.data_hora",
  },
  ordenaveis: {
    data_hora: "log_acesso.data_hora", tipo_evento: "log_acesso.tipo_evento",
    usuario_nome: "servidor.nome",
  },
  ordemPadrao: "log_acesso.data_hora DESC",
  permissoes: { ver: "AUDITORIA_VISUALIZAR_ACESSOS" },
  somenteLeitura: true,
});

// "Alteracoes de registros" e a auditoria filtrada no que mudou dados.
export const alteracoes = criarCrud({
  tabela: "auditoria",
  id: "id_auditoria",
  select: `auditoria.*, servidor.nome AS usuario_nome`,
  from: `auditoria
         JOIN usuario  ON usuario.id_usuario   = auditoria.id_usuario
         JOIN servidor ON servidor.id_servidor = usuario.id_servidor`,
  busca: ["auditoria.entidade", "servidor.nome"],
  filtros: {
    entidade: "auditoria.entidade", usuario: "auditoria.id_usuario",
    dataDe: "auditoria.data_hora", dataAte: "auditoria.data_hora",
  },
  ordenaveis: { data_hora: "auditoria.data_hora", entidade: "auditoria.entidade" },
  ordemPadrao: "auditoria.data_hora DESC",
  // So entra aqui o que de fato alterou dados de um registro.
  condicaoFixa: "auditoria.dados_anteriores IS NOT NULL",
  permissoes: { ver: "AUDITORIA_VISUALIZAR_ALTERACOES" },
  somenteLeitura: true,
});

const router = Router();
router.use("/acoes", acoes);
router.use("/acessos", acessos);
router.use("/alteracoes", alteracoes);

export default router;
