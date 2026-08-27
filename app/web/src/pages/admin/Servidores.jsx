/**
 * Servidores.jsx - A base de pessoas do SITRA.
 * Um servidor existe antes de qualquer acesso. A coluna "Acesso" mostra
 * quem ja tem login.
 */
import criarPagina from "../../components/criarPagina.jsx";
import Selo from "../../components/Selo.jsx";
import { data } from "../../lib/formato.js";

const CATEGORIAS_CNH = ["A", "B", "AB", "C", "D", "E", "AC", "AD", "AE"];

export default criarPagina({
  recurso: "admin/servidores",
  id: "id_servidor",
  singular: "servidor",
  titulo: "Servidores",
  descricao: "Base de pessoas do SITRA. Um servidor pode virar usuário do sistema.",
  trilha: [{ rotulo: "Administração" }, { rotulo: "Servidores" }],
  unidade: "servidores",
  vazio: "Nenhum servidor cadastrado.",
  rotuloAcao: "Novo servidor",
  iconeAcao: "fisc-servidores",
  permissaoGerenciar: "ADMIN_GERENCIAR_SERVIDORES",
  larguraFormulario: 760,
  mapaOpcoes: {
    setores: (s) => ({ valor: s.id_setor, rotulo: s.nome }),
  },
  opcoes: { setores: "/setores" },
  colunas: [
    { chave: "nome", rotulo: "Nome", ordenavel: true },
    { chave: "matricula", rotulo: "Matrícula", ordenavel: true },
    { chave: "cargo_funcao", rotulo: "Cargo / Função", ordenavel: true },
    { chave: "setor", rotulo: "Setor", ordenavel: true },
    { chave: "telefone", rotulo: "Telefone" },
    { chave: "email", rotulo: "E-mail" },
    {
      chave: "cnh", rotulo: "CNH",
      render: (s) => (s.cnh ? `${s.cnh} (${s.categoria_cnh || "-"})` : "-"),
    },
    {
      chave: "tem_usuario", rotulo: "Acesso",
      render: (s) =>
        s.tem_usuário ? (
          <Selo texto="Tem usuário" tom="azul" />
        ) : (
          <Selo texto="Sem acesso" tom="cinza" />
        ),
    },
    {
      chave: "status", rotulo: "Situação",
      render: (s) => (
        <Selo texto={s.status ? "Ativo" : "Inativo"} tom={s.status ? "verde" : "vermelho"} />
      ),
    },
  ],
  filtros: [
    { nome: "busca", rotulo: "Buscar", dica: "Nome, matrícula, CPF ou e-mail" },
    { nome: "setor", rotulo: "Setor", tipo: "selecao", opcoes: "setores", vazio: "Todos" },
    {
      nome: "status", rotulo: "Situação", tipo: "selecao", vazio: "Todos",
      opcoes: [{ valor: "true", rotulo: "Ativo" }, { valor: "false", rotulo: "Inativo" }],
    },
  ],
  formulario: [
    { nome: "nome", rotulo: "Nome completo *", obrigatorio: true, largo: true },
    { nome: "cpf", rotulo: "CPF *", obrigatorio: true, dica: "000.000.000-00" },
    { nome: "matricula", rotulo: "Matrícula *", obrigatorio: true },
    { nome: "data_nascimento", rotulo: "Data de nascimento *", tipo: "data", obrigatorio: true },
    { nome: "telefone", rotulo: "Telefone *", obrigatorio: true },
    { nome: "email", rotulo: "E-mail *", html: "email", obrigatorio: true },
    { nome: "cargo_funcao", rotulo: "Cargo / Função *", obrigatorio: true },
    { nome: "id_setor", rotulo: "Setor *", tipo: "selecao", opcoes: "setores", obrigatorio: true },
    { nome: "cnh", rotulo: "CNH" },
    {
      nome: "categoria_cnh", rotulo: "Categoria da CNH", tipo: "selecao", vazio: "Sem CNH",
      opcoes: CATEGORIAS_CNH.map((c) => ({ valor: c, rotulo: c })),
    },
  ],
  aoSalvar: (f) => ({ ...f, id_setor: Number(f.id_setor), status: true }),
});
