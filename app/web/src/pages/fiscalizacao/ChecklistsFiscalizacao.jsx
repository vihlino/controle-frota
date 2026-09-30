/**
 * ChecklistsFiscalização.jsx - Checklists das viaturas em serviço.
 */
import criarPagina from "../../components/criarPagina.jsx";
import Selo from "../../components/Selo.jsx";
import { data, hora, numero } from "../../lib/formato.js";

export default criarPagina({
  recurso: "fiscalizacao/checklists",
  id: "id_checklist",
  singular: "checklist",
  descreverExclusao: (c) => `o checklist da viatura ${c.placa}`,
  titulo: "Checklists da Fiscalização",
  descricao: "Checklists das viaturas usadas em serviço.",
  trilha: [{ rotulo: "Fiscalização" }, { rotulo: "Checklists" }],
  unidade: "checklists",
  vazio: "Nenhum checklist de viatura registrado.",
  mapaOpcoes: {
    veículos: (v) => ({ valor: v.id_veiculo, rotulo: `${v.placa} - ${v.modelo}` }),
  },
  opcoes: { veículos: "/frotas/veiculos/opcoes" },
  colunas: [
    { chave: "data_abertura", rotulo: "Data", ordenavel: true, render: (c) => data(c.data_abertura) },
    { chave: "placa", rotulo: "Placa", ordenavel: true },
    { chave: "veiculo", rotulo: "Viatura", render: (c) => `${c.marca} ${c.modelo}` },
    { chave: "equipe", rotulo: "Equipe", ordenavel: true, render: (c) => c.equipe || "-" },
    { chave: "hora_saida", rotulo: "Saida", render: (c) => hora(c.hora_saida) },
    { chave: "hora_chegada", rotulo: "Chegada", render: (c) => hora(c.hora_chegada) },
    {
      chave: "km_rodado", rotulo: "KM rodado",
      render: (c) => (c.km_rodado === null ? "-" : `${numero(c.km_rodado)} km`),
    },
    { chave: "status", rotulo: "Situação", render: (c) => <Selo valor={c.status} /> },
  ],
  /*
   * A tela CORRIGE checklist, nao cria.
   *
   * O registro nasce da leitura do QR Code da viatura, em campo. Aqui a gestao
   * so conserta o que foi digitado errado - tipicamente um odometro trocado ou
   * uma hora que o servidor informou de memoria no fim do turno.
   *
   * Tres travas, e nenhuma delas e enfeite:
   *   - permissaoGerenciar: so o perfil com FISCALIZACAO_EDITAR_CHECKLIST ve
   *     o menu de acoes (migracao 019);
   *   - a senha e pedida antes de salvar, pelo proprio criarPagina;
   *   - excluir tambem exige a senha, e o registro sai do historico: e a
   *     unica acao aqui que nao tem volta.
   *
   * A alteracao fica na auditoria com o antes e o depois, entao uma correcao
   * questionada depois tem como ser conferida.
   */
  permissaoGerenciar: "FISCALIZACAO_EDITAR_CHECKLIST",
  permiteCriar: false,
  /*
   * A JUSTIFICATIVA NAO E CAMPO DO CHECKLIST
   *
   * Ela e pedida na MESMA caixa da senha, e nao no formulario: senha e motivo
   * sao o mesmo momento - assumir a alteracao e dizer por que.
   *
   * O texto nao existe como coluna da tabela; vai para a AUDITORIA, ao lado
   * do valor anterior, e aparece no Logs de ações.
   */
  exigeJustificativa: true,
  rotuloSalvar: "Salvar",
  formulario: [
    { secao: "Saída" },
    { nome: "data_abertura", rotulo: "Data da saída *", tipo: "data", obrigatorio: true },
    { nome: "hora_saida", rotulo: "Hora da saída", html: "time" },
    { nome: "odometro_saida", rotulo: "Odômetro na saída *", html: "number",
      obrigatorio: true, dica: "Ex.: 45230" },

    { secao: "Chegada" },
    { nome: "hora_chegada", rotulo: "Hora da chegada", html: "time" },
    { nome: "odometro_chegada", rotulo: "Odômetro na chegada", html: "number",
      dica: "Ex.: 45310" },
    {
      nome: "status", rotulo: "Situação *", tipo: "selecao", obrigatorio: true,
      opcoes: [
        { valor: "ABERTO", rotulo: "Em aberto" },
        { valor: "FINALIZADO", rotulo: "Finalizado" },
      ],
    },

    { secao: "Observações" },
    { nome: "observacoes", tipo: "area", largo: true,
      dica: "Ex.: viatura devolvida com o tanque cheio" },

  ],
  filtros: [
    { nome: "busca", rotulo: "Buscar", dica: "Placa ou equipe" },
    { nome: "veiculo", rotulo: "Viatura", tipo: "selecao", opcoes: "veículos", vazio: "Todas" },
    {
      nome: "status", rotulo: "Situação", tipo: "selecao", vazio: "Todas",
      opcoes: [
        { valor: "ABERTO", rotulo: "Em aberto" },
        { valor: "FINALIZADO", rotulo: "Finalizado" },
      ],
    },
    { nome: "periodo", rotulo: "Período", tipo: "periodo", de: "dataDe", ate: "dataAte" },
  ],
});
