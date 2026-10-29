/**
 * ResumosLista.jsx - O que aparece no resumo ao lado da lista (ListaResumo)
 * para cada tipo de registro. Um lugar so, para o sinistro mostrar a mesma
 * coisa na ficha do Motorista, do Fiscal e do Veiculo (26/10). A ocorrencia
 * entrou em 29/10, para a aba Ocorrencias dos Detalhes da Viatura.
 */
import Selo from "./Selo.jsx";
import { data, dataHora, dinheiro, hora, numero, numeroOs, rotulo, ROTULOS } from "../lib/formato.js";

const vazio = (v) => (v === null || v === undefined || v === "" ? null : v);
const dataEHora = (d, h) => (d ? `${data(d)}${h ? ` às ${hora(h)}` : ""}` : null);

export const FREQUENCIA_INSPECAO = {
  SEMANAL: "Semanal", QUINZENAL: "Quinzenal", MENSAL: "Mensal",
  PERSONALIZADA: "Personalizada", SEM_PERIODICIDADE: "Sem periodicidade",
};

/** Situacao da inspecao como na lista de Inspecoes (Pendente / analise). */
export function SeloInspecao({ i }) {
  if (i.status === "ABERTA") return <Selo texto="Pendente" tom="amarelo" />;
  const a = ROTULOS.analiseInspecao?.[i.analise];
  return a ? <Selo texto={a.texto} tom={a.tom} /> : <Selo texto="Concluída" tom="verde" />;
}

export function resumoSinistro(x, { veiculo = true, condutor = true } = {}) {
  const custos = ["orcamento_pecas", "orcamento_mao_obra", "orcamento_outros"]
    .reduce((t, k) => t + (Number(x[k]) || 0), 0);
  return {
    rotulo: "Sinistro",
    titulo: x.numero || "Sinistro",
    selo: <Selo valor={x.status} />,
    linhas: [
      ["Data e hora", dataEHora(x.data, x.hora)],
      ...(veiculo ? [["Veículo", x.placa ? `${x.placa}${x.modelo ? ` · ${x.marca || ""} ${x.modelo}` : ""}` : null]] : []),
      ...(condutor ? [["Condutor", vazio(x.condutor)]] : []),
      ["Tipo", x.tipo ? rotulo("tipoSinistro", x.tipo) : null],
      ["Local", vazio(x.local)],
      ["Boletim de ocorrência", vazio(x.bo)],
      ["Houve terceiros", x.houve_terceiros === undefined || x.houve_terceiros === null ? null : x.houve_terceiros ? "Sim" : "Não"],
      ["Gravidade dos danos", x.gravidade_danos ? rotulo("gravidadeDanos", x.gravidade_danos) : null],
      ["Custos estimados", custos ? dinheiro(custos) : null],
      ["Responsável", vazio(x.responsavel)],
    ],
    texto: { rotulo: "O que aconteceu", valor: x.descricao },
  };
}

export function resumoInspecao(i) {
  return {
    rotulo: "Inspeção",
    titulo: i.numero || "Inspeção",
    selo: <SeloInspecao i={i} />,
    linhas: [
      ["Frequência", FREQUENCIA_INSPECAO[i.tipo] || i.tipo],
      [i.data_realizacao ? "Realizada em" : "Programada para", data(i.data_realizacao || i.data_programada)],
      ["Horário", i.hora_inicio ? `${hora(i.hora_inicio)}${i.hora_finalizacao ? ` às ${hora(i.hora_finalizacao)}` : ""}` : null],
      ["Responsável", vazio(i.responsavel)],
      ["Resultado", i.resultado ? (i.resultado === "CONFORME" ? "Conforme" : i.resultado === "NAO_CONFORME" ? "Não conforme" : i.resultado) : null],
      ["Itens com ressalva", i.status === "FINALIZADA" ? numero(i.itens_com_ressalva || 0) : null],
      ["KM na inspeção", i.quilometragem ? `${numero(i.quilometragem)} km` : null],
      ["Próxima inspeção", i.proxima_inspecao ? data(i.proxima_inspecao) : null],
    ],
    texto: { rotulo: "Observações", valor: i.observacoes },
  };
}

export function resumoOs(o) {
  return {
    rotulo: "Ordem de serviço",
    titulo: numeroOs(o.numero) || "OS",
    selo: <Selo valor={o.status} />,
    linhas: [
      ["Tipo", o.tipo ? rotulo("tipoOs", o.tipo) : null],
      ["Aberta em", o.data_abertura ? dataHora(o.data_abertura) : null],
      ["Agendada para", o.data_agendada ? data(o.data_agendada) : null],
      ["Concluída em", o.data_conclusao ? dataHora(o.data_conclusao) : null],
      ["Oficina", vazio(o.oficina)],
      ["Solicitante", vazio(o.solicitante)],
      ["Responsável", vazio(o.responsavel)],
      ["KM", o.quilometragem ? `${numero(o.quilometragem)} km` : null],
      ["Custo", o.custo !== null && o.custo !== undefined ? dinheiro(o.custo)
        : o.custo_estimado ? `${dinheiro(o.custo_estimado)} (estimado)` : null],
    ],
    texto: { rotulo: "Descrição", valor: o.servico_realizado || o.descricao },
  };
}

export function resumoDocumento(d) {
  const dias = d.dias_para_vencer;
  return {
    rotulo: "Documento",
    titulo: d.tipo_documento,
    selo: <Selo valor={d.status} />,
    linhas: [
      ["Categoria", vazio(d.categoria)],
      ["Nº / Referência", vazio(d.numero_documento)],
      ["Órgão emissor", vazio(d.orgao_emissor)],
      ["Emissão", d.data_emissao ? data(d.data_emissao) : null],
      ["Validade", d.data_validade ? data(d.data_validade) : "Não vence"],
      ["Prazo", dias === null || dias === undefined ? null : dias < 0 ? `Vencido há ${Math.abs(dias)} dias` : dias === 0 ? "Vence hoje" : `Em ${dias} dias`],
      ["Arquivos anexados", numero(d.arquivos || 0)],
      ["Responsável", vazio(d.responsavel)],
    ],
    texto: { rotulo: "Observações", valor: d.observacoes },
  };
}

/** Ocorrencia atendida pela viatura (Detalhes da Viatura, 29/10). */
export function resumoOcorrencia(o) {
  return {
    rotulo: "Ocorrência",
    titulo: o.protocolo || "Ocorrência",
    selo: <Selo valor={o.status} />,
    linhas: [
      ["Data e hora", dataEHora(o.data, o.hora)],
      ["Tipo", o.tipo === "QRU" ? "QRU" : o.tipo === "PROGRAMADA" ? "Programada" : vazio(o.tipo)],
      ["Local", vazio(o.endereco)],
      ["Equipe", vazio(o.equipe)],
    ],
    texto: { rotulo: "Descrição", valor: o.descricao },
  };
}
