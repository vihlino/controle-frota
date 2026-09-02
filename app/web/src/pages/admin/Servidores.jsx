/**
 * Servidores.jsx - A base de pessoas do SITRA.
 * Um servidor existe antes de qualquer acesso. A coluna "Acesso" mostra
 * quem ja tem login.
 */
import criarPagina from "../../components/criarPagina.jsx";
import Selo from "../../components/Selo.jsx";
import { data, diasAte } from "../../lib/formato.js";

/**
 * Mostra a validade da CNH com a cor certa. E o mesmo criterio do alerta
 * que a API calcula: 30 dias e o limiar em que a gestao precisa agir.
 */
function ValidadeCnh({ ate }) {
  if (!ate) return <span className="texto-fraco">Sem validade</span>;
  const dias = diasAte(ate);
  const tom = dias < 0 ? "vermelho" : dias <= 30 ? "ambar" : "verde";
  const texto =
    dias < 0 ? `Vencida em ${data(ate)}`
    : dias === 0 ? "Vence hoje"
    : dias <= 30 ? `Vence em ${dias} dia${dias > 1 ? "s" : ""}`
    : `Válida até ${data(ate)}`;
  return <span className="atraso" data-tom={tom}>{texto}</span>;
}


/** O <select> devolve "true"/"false"; o banco guarda boolean. */
const ehCondutor = (f) => f.condutor === true || f.condutor === "true";

const CATEGORIAS_CNH = ["A", "B", "AB", "C", "D", "E", "AC", "AD", "AE"];

export const CONFIG_SERVIDOR = {
  recurso: "admin/servidores",
  id: "id_servidor",
  singular: "servidor",
  titulo: "Servidores",
  descricao: "Base de pessoas do SITRA. Um servidor pode virar usuário do sistema.",
  trilha: [{ rotulo: "Administração" }, { rotulo: "Servidores" }],
  unidade: "servidores",
  vazio: "Nenhum servidor cadastrado.",
  rotuloAcao: "Novo servidor",
  rotuloSalvar: "Salvar servidor",
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
      render: (s) =>
        s.cnh ? (
          <span className="celula-dupla">
            <strong>{`${s.cnh} (${s.categoria_cnh || "-"})`}</strong>
            <ValidadeCnh ate={s.cnh_data_validade} />
          </span>
        ) : (
          <span className="texto-fraco">—</span>
        ),
    },
    {
      chave: "tem_usuario", rotulo: "Acesso",
      render: (s) =>
        s.tem_usuario ? (
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
    { secao: "Dados pessoais" },
    { nome: "nome", rotulo: "Nome completo *", obrigatorio: true, largo: true },
    { nome: "matricula", rotulo: "Matrícula *", obrigatorio: true },
    { nome: "cpf", rotulo: "CPF *", obrigatorio: true, dica: "000.000.000-00" },
    { nome: "data_nascimento", rotulo: "Data de nascimento *", tipo: "data", obrigatorio: true },
    { nome: "email", rotulo: "E-mail corporativo", html: "email" },
    { nome: "telefone", rotulo: "Telefone" },

    { secao: "CNH" },
    {
      // Esta tela e a base de TODOS os servidores, nao so dos motoristas. A
      // CNH so e exigida de quem dirige - senao nao daria para cadastrar um
      // auxiliar administrativo.
      nome: "condutor", rotulo: "É condutor? *", tipo: "selecao", obrigatorio: true,
      padrao: "false",
      opcoes: [
        { valor: "true", rotulo: "Sim — dirige veículo da frota" },
        { valor: "false", rotulo: "Não" },
      ],
      ajuda: "Só condutores precisam de CNH cadastrada.",
    },
    {
      nome: "cnh", rotulo: "Nº da CNH / Nº de registro *", obrigatorio: true,
      mostrarSe: ehCondutor,
    },
    {
      nome: "categoria_cnh", rotulo: "Categoria *", tipo: "selecao", obrigatorio: true,
      vazio: "Selecione", opcoes: CATEGORIAS_CNH.map((c) => ({ valor: c, rotulo: c })),
      mostrarSe: ehCondutor,
    },
    {
      nome: "cnh_data_emissao", rotulo: "Data de emissão *", tipo: "data", obrigatorio: true,
      mostrarSe: ehCondutor,
    },
    {
      nome: "cnh_data_validade", rotulo: "Data de validade *", tipo: "data", obrigatorio: true,
      mostrarSe: ehCondutor,
      ajuda: "Usada para avisar a gestão quando a habilitação está vencendo.",
    },

    { secao: "Vinculação" },
    { nome: "id_setor", rotulo: "Setor *", tipo: "selecao", opcoes: "setores", obrigatorio: true },
    { nome: "cargo_funcao", rotulo: "Cargo / Função" },
    {
      nome: "status", rotulo: "Status *", tipo: "selecao", obrigatorio: true, padrao: "true",
      opcoes: [{ valor: "true", rotulo: "Ativo" }, { valor: "false", rotulo: "Inativo" }],
    },
  ],
  aoSalvar: (f) => ({
    ...f,
    id_setor: Number(f.id_setor),
    // O <select> devolve texto; a coluna e boolean.
    status: f.status === true || f.status === "true",
    condutor: ehCondutor(f),
    // Quem deixou de ser condutor nao pode manter a CNH antiga pendurada -
    // ela continuaria alimentando o alerta de validade.
    ...(ehCondutor(f)
      ? {}
      : { cnh: null, categoria_cnh: null, cnh_data_emissao: null, cnh_data_validade: null }),
    // Campo opcional vazio vai como null, nao como "" - "nao informado" e
    // diferente de "vazio".
    email: f.email?.trim() || null,
    telefone: f.telefone?.trim() || null,
    cargo_funcao: f.cargo_funcao?.trim() || null,
  }),
};

export default criarPagina(CONFIG_SERVIDOR);
