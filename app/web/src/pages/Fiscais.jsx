/**
 * Fiscais.jsx - Os servidores da Fiscalizacao.
 *
 * Mesma base de Servidores, com o nome que a Fiscalizacao usa. Antes o menu
 * dela abria a tela "Motoristas", titulada com a trilha de Frotas: o fiscal
 * procurava a propria equipe e encontrava uma tela de outro modulo.
 *
 * A LISTA e a mesma de antes (servidores habilitados a dirigir), so o nome e a
 * trilha mudaram. Se a Fiscalizacao quiser aqui TODOS os servidores do setor,
 * e nao so quem dirige, basta tirar filtrosFixos - mas isso muda o que a tela
 * responde, e nao e uma decisao de quem escreve o codigo.
 */
import criarPagina from "../components/criarPagina.jsx";
import { CONFIG_SERVIDOR } from "./admin/Servidores.jsx";

export default criarPagina({
  ...CONFIG_SERVIDOR,
  titulo: "Fiscais",
  descricao: "Servidores da Fiscalização habilitados a dirigir viaturas.",
  trilha: [{ rotulo: "Fiscalização" }, { rotulo: "Fiscais" }],
  unidade: "fiscais",
  vazio: "Nenhum fiscal cadastrado.",
  rotuloAcao: "Novo fiscal",
  iconeAcao: "mais",
  rotuloSalvar: "Salvar",
  permissaoGerenciar: "FROTAS_GERENCIAR_SERVIDORES",
  filtrosFixos: { condutor: "true" },
  colunas: CONFIG_SERVIDOR.colunas.filter((c) => c.chave !== "tem_usuario"),
  formulario: CONFIG_SERVIDOR.formulario.map((c) =>
    c.nome === "condutor" ? { ...c, padrao: "true" } : c
  ),
});
