/**
 * Motoristas.jsx - Os servidores que dirigem.
 *
 * E a MESMA base de Servidores, filtrada por `condutor = true`. Antes as duas
 * rotas mostravam exatamente a lista completa: a tela chamada "Motoristas"
 * trazia tambem o auxiliar administrativo, o que confunde na hora de escolher
 * quem vai pegar o veiculo.
 *
 * Reaproveitar a configuracao (e nao copiar) garante que um campo novo no
 * cadastro de servidor aparece aqui sozinho.
 */
import criarPagina from "../components/criarPagina.jsx";
import { CONFIG_SERVIDOR } from "./admin/Servidores.jsx";

export default criarPagina({
  ...CONFIG_SERVIDOR,
  titulo: "Motoristas",
  descricao: "Servidores habilitados a dirigir veículos da frota.",
  trilha: [{ rotulo: "Frotas" }, { rotulo: "Motoristas" }],
  unidade: "motoristas",
  vazio: "Nenhum motorista cadastrado.",
  rotuloAcao: "Novo motorista",
  rotuloSalvar: "Salvar motorista",
  iconeAcao: "cnh",

  // Quem gerencia a frota cadastra motorista sem precisar da permissao de
  // Administracao. CONFIG_SERVIDOR exige ADMIN_GERENCIAR_SERVIDORES, o que
  // fazia o gestor de frotas nao ver sequer o botao "Novo motorista" nesta
  // tela - que e a tela dele.
  permissaoGerenciar: "FROTAS_GERENCIAR_SERVIDORES",

  // Trava a lista em quem dirige. O filtro vai na consulta, nao na tela: assim
  // a contagem e a paginacao tambem batem.
  filtrosFixos: { condutor: "true" },

  // Quem entra por aqui ja e condutor por definicao.
  formulario: CONFIG_SERVIDOR.formulario.map((c) =>
    c.nome === "condutor" ? { ...c, padrao: "true" } : c
  ),
});
