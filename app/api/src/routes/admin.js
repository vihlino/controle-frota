/**
 * admin.js - Recursos da Administracao.
 *
 *   /api/admin/setores      estrutura organizacional
 *   /api/admin/servidores   base de pessoas
 *   /api/admin/perfis       perfis de acesso
 *   /api/admin/parametros   configuracoes do sistema
 *
 * Usuarios NAO esta aqui: tem arquivo proprio (usuarios.js), porque senha
 * exige tratamento separado.
 */
import { Router } from "express";
import { criarCrud } from "../crud.js";

const VER = "ADMIN_VISUALIZAR";

export const setores = criarCrud({
  tabela: "setor",
  id: "id_setor",
  entidade: "setor",
  select: `setor.*,
           (SELECT COUNT(*)::int FROM servidor s WHERE s.id_setor = setor.id_setor) AS servidores,
           (SELECT COUNT(*)::int FROM veiculo v WHERE v.id_setor = setor.id_setor) AS veiculos`,
  from: "setor",
  busca: ["setor.nome", "setor.descricao"],
  filtros: { status: "setor.status" },
  ordenaveis: { nome: "setor.nome", status: "setor.status" },
  ordemPadrao: "setor.nome",
  campos: ["nome", "descricao", "status"],
  obrigatorios: ["nome"],
  permissoes: { ver: VER, gerenciar: "ADMIN_GERENCIAR_SETORES" },
});

export const servidores = criarCrud({
  tabela: "servidor",
  id: "id_servidor",
  entidade: "servidor",
  select: `servidor.*, setor.nome AS setor,
           (SELECT COUNT(*)::int FROM usuario u WHERE u.id_servidor = servidor.id_servidor) AS tem_usuario`,
  from: "servidor JOIN setor ON setor.id_setor = servidor.id_setor",
  busca: ["servidor.nome", "servidor.matricula", "servidor.cpf", "servidor.email"],
  filtros: { setor: "servidor.id_setor", status: "servidor.status" },
  ordenaveis: {
    nome: "servidor.nome", matricula: "servidor.matricula",
    setor: "setor.nome", cargo_funcao: "servidor.cargo_funcao",
  },
  ordemPadrao: "servidor.nome",
  campos: [
    "nome", "cpf", "data_nascimento", "telefone", "email", "matricula",
    "cnh", "categoria_cnh", "cargo_funcao", "id_setor", "status",
  ],
  obrigatorios: [
    "nome", "cpf", "data_nascimento", "telefone", "email",
    "matricula", "cargo_funcao", "id_setor",
  ],
  permissoes: { ver: VER, gerenciar: "ADMIN_GERENCIAR_SERVIDORES" },
});

export const perfis = criarCrud({
  tabela: "perfil",
  id: "id_perfil",
  entidade: "perfil",
  select: `perfil.*,
           (SELECT COUNT(*)::int FROM perfil_permissao pp
             WHERE pp.id_perfil = perfil.id_perfil) AS permissoes,
           (SELECT COUNT(*)::int FROM usuario u
             WHERE u.id_perfil = perfil.id_perfil) AS usuarios`,
  from: "perfil",
  busca: ["perfil.nome", "perfil.descricao"],
  filtros: { status: "perfil.status" },
  ordenaveis: { nome: "perfil.nome" },
  ordemPadrao: "perfil.nome",
  campos: ["nome", "descricao", "status"],
  obrigatorios: ["nome"],
  permissoes: { ver: "PERFIL_VISUALIZAR", gerenciar: "PERFIL_EDITAR" },
});

export const parametros = criarCrud({
  tabela: "parametro_sistema",
  id: "id_parametro",
  entidade: "parametro",
  select: "parametro_sistema.*",
  from: "parametro_sistema",
  busca: ["parametro_sistema.chave", "parametro_sistema.nome", "parametro_sistema.descricao"],
  filtros: { modulo: "parametro_sistema.modulo", ativo: "parametro_sistema.ativo" },
  ordenaveis: { chave: "parametro_sistema.chave", nome: "parametro_sistema.nome", modulo: "parametro_sistema.modulo" },
  ordemPadrao: "parametro_sistema.modulo, parametro_sistema.nome",
  campos: ["chave", "modulo", "nome", "descricao", "valor", "tipo_valor", "ativo"],
  obrigatorios: ["chave", "nome", "valor"],
  permissoes: { ver: VER, gerenciar: "ADMIN_GERENCIAR_PARAMETROS" },
});

const router = Router();
router.use("/setores", setores);
router.use("/servidores", servidores);
router.use("/perfis", perfis);
router.use("/parametros", parametros);

export default router;
