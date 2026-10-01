/**
 * Servidores.jsx - A base de pessoas do SITRA.
 * Um servidor existe antes de qualquer acesso. A coluna "Acesso" mostra
 * quem ja tem login.
 */
import criarPagina from "../../components/criarPagina.jsx";
import Selo from "../../components/Selo.jsx";
import { data, diasAte } from "../../lib/formato.js";
import { telefone } from "../../lib/mascaras.js";

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
  rotuloSalvar: "Salvar",
  iconeAcao: "fisc-servidores",
  permissaoGerenciar: "ADMIN_GERENCIAR_SERVIDORES",
  mapaOpcoes: {
    setores: (s) => ({ valor: s.id_setor, rotulo: s.nome }),
  },
  // A lista de cargos vem inteira e e filtrada na tela conforme o setor
  // escolhido (ver o campo id_cargo abaixo). Por isso ela nao esta em
  // mapaOpcoes: quem monta as opcoes dela e a funcao do proprio campo.
  opcoes: { setores: "/setores", cargos: "/cargos" },
  colunas: [
    { chave: "nome", cortar: true, rotulo: "Nome", ordenavel: true },
    { chave: "matricula", rotulo: "Matrícula", ordenavel: true },
    { chave: "data_nascimento", classe: "col-oculta-notebook", rotulo: "Nascimento",
      render: (s) => data(s.data_nascimento) },
    { chave: "cargo_funcao", cortar: true, rotulo: "Cargo / Função", ordenavel: true,
      render: (s) => s.cargo || s.cargo_funcao || <span className="texto-fraco">—</span> },
    { chave: "setor", cortar: true, rotulo: "Setor", ordenavel: true },
    // O banco guarda so os digitos; a pontuacao e desenhada na hora de
    // mostrar, pela mesma funcao que o formulario usa.
    { chave: "telefone", classe: "col-oculta-notebook", rotulo: "Telefone", render: (s) => telefone(s.telefone) || "—" },
    { chave: "email", cortar: true, rotulo: "E-mail" },
    {
      chave: "cnh", classe: "col-oculta-pequena", rotulo: "CNH",
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
    { nome: "nome", rotulo: "Nome completo *", obrigatorio: true, largo: true,
      dica: "Ex.: João Carlos da Silva Pereira" },
    { nome: "matricula", rotulo: "Matrícula *", obrigatorio: true, dica: "Ex.: 12548" },
    // A mascara trava em 11 digitos e desenha os pontos e o hifen enquanto a
    // pessoa digita.
    { nome: "cpf", rotulo: "CPF *", obrigatorio: true, mascara: "cpf",
      dica: "000.000.000-00" },
    { nome: "data_nascimento", rotulo: "Data de nascimento *", tipo: "data", obrigatorio: true },
    { nome: "email", rotulo: "E-mail corporativo", html: "email",
      dica: "Ex.: joao.silva@cmtt.gov.br" },
    { nome: "telefone", rotulo: "Telefone", mascara: "telefone",
      dica: "Ex.: (62) 99274-7830" },

    { secao: "CNH" },
    {
      // Esta tela e a base de TODOS os servidores, nao so dos motoristas. A
      // CNH so e exigida de quem dirige - senao nao daria para cadastrar um
      // auxiliar administrativo.
      nome: "condutor", rotulo: "É condutor? *", tipo: "selecao", obrigatorio: true,
      padrao: "false",
      opcoes: [
        { valor: "true", rotulo: "Sim" },
        { valor: "false", rotulo: "Não" },
      ],
    },
    {
      nome: "cnh", rotulo: "Nº da CNH / Nº de registro *", obrigatorio: true,
      mostrarSe: ehCondutor, dica: "Ex.: 12345678901",
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
    },

    { secao: "Vinculação" },
    { nome: "id_setor", rotulo: "Setor *", tipo: "selecao", opcoes: "setores", obrigatorio: true },
    {
      // O cargo deixou de ser texto livre. Digitado, ele virava "Motorista",
      // "motorista" e "MOTORISTA" como se fossem tres cargos - e nenhuma regra
      // podia depender dele. Agora vem do cadastro de Setores e Cargos.
      //
      // A lista mostra os cargos que valem para TODOS os setores mais os
      // exclusivos do setor escolhido. E o que faz "Fiscal de Trânsito"
      // aparecer so para quem esta na Fiscalizacao, enquanto "Assistente"
      // aparece em qualquer setor.
      nome: "id_cargo", rotulo: "Cargo / Função", tipo: "selecao",
      // "Selecione", e nao "Escolha o setor primeiro": os cargos que valem
      // para todos os setores ja aparecem antes de o setor ser escolhido, e
      // avisar o contrario seria mentira.
      vazio: "Selecione",
      opcoes: (valores, listas) =>
        (listas.cargos || [])
          .filter(
            (c) =>
              c.id_setor === null ||
              String(c.id_setor) === String(valores.id_setor ?? "")
          )
          .map((c) => ({
            valor: c.id_cargo,
            rotulo: c.id_setor ? `${c.nome} (exclusivo do setor)` : c.nome,
          })),
    },
    {
      nome: "status", rotulo: "Status *", tipo: "selecao", obrigatorio: true, padrao: "true",
      opcoes: [{ valor: "true", rotulo: "Ativo" }, { valor: "false", rotulo: "Inativo" }],
    },
  ],
  // Trocar o setor pode deixar para tras um cargo exclusivo do setor anterior.
  // Sem esta limpeza, o formulario continuaria com ele escolhido - invisivel na
  // lista, mas gravado assim mesmo.
  //
  // So limpa quando o cargo REALMENTE deixou de servir: cargo que vale para
  // todos os setores continua escolhido, senao quem so corrige o setor de um
  // servidor perderia o cargo dele sem motivo.
  aoMudarCampo: (nome, valor, f, listas) => {
    if (nome !== "id_setor" || !f.id_cargo) return null;
    const cargo = (listas?.cargos || []).find(
      (c) => String(c.id_cargo) === String(f.id_cargo)
    );
    const aindaServe =
      !cargo || cargo.id_setor === null || String(cargo.id_setor) === String(valor);
    return aindaServe ? null : { id_cargo: "" };
  },

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
    // cargo_funcao nao vai mais daqui: o banco a preenche a partir do cargo
    // escolhido, e ela segue existindo porque os relatorios, a lista de
    // usuarios e o topo da tela leem essa coluna.
    id_cargo: f.id_cargo ? Number(f.id_cargo) : null,
  }),
};

export default criarPagina(CONFIG_SERVIDOR);
