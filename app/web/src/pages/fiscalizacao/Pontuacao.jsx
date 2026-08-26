/**
 * Pontuacao.jsx - Itens de pontuacao da fiscalizacao.
 * Tela RESTRITA ao gestor da Fiscalizacao. A restricao vale nos dois lados:
 * o item some do menu e a rota e barrada no App.jsx.
 */
import criarPagina from "../../components/criarPagina.jsx";
import Selo from "../../components/Selo.jsx";
import { numero } from "../../lib/formato.js";

// Tela restrita ao gestor da Fiscalizacao: e aqui que fica a documentacao dos
// itens de pontuacao vinda do documento de Goiania.
export default criarPagina({
  recurso: "fiscalizacao/pontuacao",
  id: "id_item",
  singular: "item de pontuacao",
  titulo: "Pontuacao",
  descricao: "Itens de pontuacao da fiscalizacao e seus valores. Tela restrita ao gestor.",
  trilha: [{ rotulo: "Fiscalizacao" }, { rotulo: "Pontuacao" }],
  unidade: "itens",
  vazio: "Nenhum item de pontuacao cadastrado.",
  rotuloAcao: "Novo item",
  iconeAcao: "fisc-bolt",
  permissaoGerenciar: "FISCALIZACAO_GERENCIAR_PONTUACAO",
  permiteExcluir: true,
  confirmarExclusao: (i) => `Excluir o item ${i.codigo}?`,
  larguraFormulario: 700,
  mapaOpcoes: {},
  colunas: [
    { chave: "codigo", rotulo: "Codigo", ordenavel: true },
    { chave: "nome", rotulo: "Item", ordenavel: true },
    { chave: "descricao", rotulo: "Documentacao", render: (i) => i.descricao || "-" },
    {
      chave: "valor_pontos", rotulo: "Pontos", ordenavel: true,
      render: (i) => <Selo texto={`${numero(i.valor_pontos)} pts`} tom="amarelo" />,
    },
    { chave: "registros", rotulo: "Registros", render: (i) => numero(i.registros) },
    {
      chave: "ativo", rotulo: "Situacao",
      render: (i) => (
        <Selo texto={i.ativo ? "Ativo" : "Inativo"} tom={i.ativo ? "verde" : "vermelho"} />
      ),
    },
  ],
  filtros: [
    { nome: "busca", rotulo: "Buscar", dica: "Codigo, nome ou descricao" },
    {
      nome: "ativo", rotulo: "Situacao", tipo: "selecao", vazio: "Todos",
      opcoes: [{ valor: "true", rotulo: "Ativo" }, { valor: "false", rotulo: "Inativo" }],
    },
  ],
  formulario: [
    { nome: "codigo", rotulo: "Codigo *", obrigatorio: true },
    { nome: "nome", rotulo: "Nome do item *", obrigatorio: true },
    { nome: "valor_pontos", rotulo: "Valor em pontos *", html: "number", obrigatorio: true },
    { nome: "descricao", rotulo: "Documentacao do item", tipo: "area", largo: true },
  ],
  aoSalvar: (f, usuario) => ({
    ...f,
    valor_pontos: Number(f.valor_pontos),
    ativo: true,
    criado_por: usuario.id_usuario,
  }),
});
