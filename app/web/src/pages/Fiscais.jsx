/**
 * Fiscais.jsx - Os fiscais de transito.
 *
 * Mesma base de Servidores, com o nome que a Fiscalizacao usa. Antes o menu
 * dela abria a tela "Motoristas", titulada com a trilha de Frotas: o fiscal
 * procurava a propria equipe e encontrava uma tela de outro modulo.
 *
 * A LISTA e por CARGO: fiscal de transito, e mais ninguem. Antes era "quem
 * esta habilitado a dirigir" (heranca da tela de Motoristas), o que trazia o
 * motorista e o gestor da Fiscalizacao para uma tela chamada "Fiscais" e ao
 * mesmo tempo escondia o fiscal que nao dirige.
 *
 * O cargo "Fiscal de Transito" e exclusivo do setor Fiscalizacao (migracao
 * 014), entao filtrar pelo cargo ja garante o setor - nao precisa das duas
 * condicoes.
 */
import criarPagina from "../components/criarPagina.jsx";
import { CONFIG_SERVIDOR } from "./admin/Servidores.jsx";

export default criarPagina({
  ...CONFIG_SERVIDOR,
  titulo: "Fiscais",
  descricao: "Servidores com cargo de Fiscal de Trânsito.",
  trilha: [{ rotulo: "Fiscalização" }, { rotulo: "Fiscais" }],
  unidade: "fiscais",
  vazio: "Nenhum fiscal de trânsito cadastrado.",
  rotuloAcao: "Novo fiscal",
  iconeAcao: "mais",
  rotuloSalvar: "Salvar",
  permissaoGerenciar: "FROTAS_GERENCIAR_SERVIDORES",
  /*
   * "FISCAL DE TRANSITO" sem acento e de proposito: e a chave que
   * unaccent_simples() produz no banco (ver o filtro cargo_nome em
   * routes/admin.js). Escrever "Fiscal de Trânsito" aqui nao acharia nada.
   */
  filtrosFixos: { cargo_nome: "FISCAL DE TRANSITO" },
  colunas: CONFIG_SERVIDOR.colunas.filter((c) => c.chave !== "tem_usuario"),
});
