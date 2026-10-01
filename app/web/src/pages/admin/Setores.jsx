/**
 * Setores.jsx - A estrutura organizacional: setores e os cargos dentro deles.
 *
 * Sao dois cadastros na MESMA tela, em abas, porque sao a mesma decisao
 * administrativa: quem cria o setor Fiscalizacao e quem diz que existe o cargo
 * de Fiscal de Transito nele. Separar em dois itens de menu obrigaria a ir e
 * voltar para montar uma estrutura que se pensa de uma vez so.
 *
 * Setor com vinculos nao pode ser excluido - a API devolve mensagem propria.
 */
import { useState } from "react";
import criarPagina from "../../components/criarPagina.jsx";
import Selo from "../../components/Selo.jsx";
import { numero } from "../../lib/formato.js";

const TITULO = "Setores e Cargos";
const TRILHA = [{ rotulo: "Administração" }, { rotulo: "Setores e Cargos" }];

const PaginaSetores = criarPagina({
  recurso: "admin/setores",
  id: "id_setor",
  singular: "setor",
  titulo: TITULO,
  descricao: "Estrutura organizacional que vincula servidores e veículos.",
  trilha: TRILHA,
  unidade: "setores",
  vazio: "Nenhum setor cadastrado.",
  rotuloAcao: "Novo setor",
  iconeAcao: "nav-gestao",
  permissaoGerenciar: "ADMIN_GERENCIAR_SETORES",
  permiteExcluir: true,
  descreverExclusao: (s) => `o setor ${s.nome}`,
  mapaOpcoes: {},
  colunas: [
    { chave: "nome", cortar: true, rotulo: "Setor", ordenavel: true },
    { chave: "descricao", cortar: true, rotulo: "Descrição", render: (s) => s.descricao || "-" },
    { chave: "servidores", rotulo: "Servidores", render: (s) => numero(s.servidores) },
    { chave: "veiculos", rotulo: "Veículos", render: (s) => numero(s.veiculos) },
    {
      chave: "status", rotulo: "Situação", ordenavel: true,
      render: (s) => (
        <Selo texto={s.status ? "Ativo" : "Inativo"} tom={s.status ? "verde" : "vermelho"} />
      ),
    },
  ],
  filtros: [
    { nome: "busca", rotulo: "Buscar", dica: "Nome ou descrição" },
    {
      nome: "status", rotulo: "Situação", tipo: "selecao", vazio: "Todos",
      opcoes: [{ valor: "true", rotulo: "Ativo" }, { valor: "false", rotulo: "Inativo" }],
    },
  ],
  formulario: [
    { nome: "nome", rotulo: "Nome do setor *", obrigatorio: true, largo: true,
      dica: "Ex.: Transporte" },
    { nome: "descricao", rotulo: "Descrição", tipo: "area", largo: true,
      dica: "Ex.: Setor responsável pela frota administrativa" },
  ],
  aoSalvar: (f) => ({ ...f, status: true }),
});

const PaginaCargos = criarPagina({
  recurso: "admin/cargos",
  id: "id_cargo",
  singular: "cargo",
  titulo: TITULO,
  descricao: "Cargos e funções que podem ser atribuídos aos servidores.",
  trilha: TRILHA,
  unidade: "cargos",
  vazio: "Nenhum cargo cadastrado.",
  rotuloAcao: "Novo cargo",
  iconeAcao: "fisc-servidores",
  rotuloSalvar: "Salvar",
  permissaoGerenciar: "ADMIN_GERENCIAR_SETORES",
  permiteExcluir: true,
  descreverExclusao: (c) => `o cargo ${c.nome}`,
  mapaOpcoes: {
    setores: (s) => ({ valor: s.id_setor, rotulo: s.nome }),
  },
  opcoes: { setores: "/setores" },
  colunas: [
    { chave: "nome", cortar: true, rotulo: "Cargo", ordenavel: true },
    {
      chave: "setor", rotulo: "Onde vale", ordenavel: true,
      // A coluna responde a pergunta que decide este cadastro: o cargo serve em
      // qualquer setor ou so num? Deixar a celula vazia para os cargos gerais
      // faria parecer dado faltando, entao os dois casos sao ditos por escrito.
      render: (c) =>
        c.id_setor
          ? <Selo texto={`Só em ${c.setor}`} tom="azul" />
          : <span className="texto-fraco">Todos os setores</span>,
    },
    { chave: "descricao", cortar: true, rotulo: "Descrição", render: (c) => c.descricao || "-" },
    { chave: "servidores", rotulo: "Servidores", render: (c) => numero(c.servidores) },
    {
      chave: "status", rotulo: "Situação", ordenavel: true,
      render: (c) => (
        <Selo texto={c.status ? "Ativo" : "Inativo"} tom={c.status ? "verde" : "vermelho"} />
      ),
    },
  ],
  filtros: [
    { nome: "busca", rotulo: "Buscar", dica: "Nome ou descrição" },
    { nome: "setor", rotulo: "Setor", tipo: "selecao", opcoes: "setores", vazio: "Todos" },
  ],
  formulario: [
    { nome: "nome", rotulo: "Nome do cargo *", obrigatorio: true, largo: true,
      dica: "Ex.: Fiscal de Trânsito" },
    {
      // O campo central deste cadastro. Deixado em branco, o cargo serve a
      // qualquer setor - e o caso da maioria (gestor, assistente, motorista
      // existem em varios setores ao mesmo tempo). Preenchido, o cargo passa a
      // existir so naquele setor, como Fiscal de Transito na Fiscalizacao.
      nome: "id_setor", rotulo: "Setor", tipo: "selecao",
      opcoes: "setores", vazio: "Todos os setores",
    },
    { nome: "descricao", rotulo: "Descrição", tipo: "area", largo: true,
      dica: "Ex.: Responsável pela fiscalização de trânsito em via pública" },
  ],
  aoSalvar: (f) => ({
    ...f,
    // "" no seletor significa "todos os setores", que no banco e NULL.
    id_setor: f.id_setor ? Number(f.id_setor) : null,
    status: f.status === undefined ? true : f.status,
  }),
});

export default function SetoresECargos() {
  const [aba, setAba] = useState("setores");

  const abas = (
    <div className="abas" role="tablist">
      <button type="button" role="tab" className="aba"
              data-ativa={aba === "setores"} aria-selected={aba === "setores"}
              onClick={() => setAba("setores")}>
        Setores
      </button>
      <button type="button" role="tab" className="aba"
              data-ativa={aba === "cargos"} aria-selected={aba === "cargos"}
              onClick={() => setAba("cargos")}>
        Cargos
      </button>
    </div>
  );

  // Cada aba e uma pagina completa (lista, filtros, formulario), e so uma fica
  // montada por vez. Assim a troca de aba zera filtro e pagina, em vez de
  // deixar a lista de cargos herdando a busca que estava nos setores.
  return aba === "setores"
    ? <PaginaSetores secao={abas} />
    : <PaginaCargos secao={abas} />;
}
