/**
 * ocorrencias.js - Listas da ocorrencia completa (desenho "Nova Ocorrencia",
 * 21/10, migracao 044): tipo da ocorrencia (com o icone padrao de cada um),
 * tipo de envolvido e sentido da via. Usadas no QR Code da viatura, no
 * cadastro e nos detalhes da ocorrencia.
 */
export const CATEGORIAS_OCORRENCIA = [
  { valor: "INFRACAO_TRANSITO", rotulo: "Infração de trânsito", icone: "kpi-car" },
  { valor: "VEICULO_IRREGULAR", rotulo: "Veículo irregular", icone: "kpi-car-front" },
  { valor: "TRANSPORTE_IRREGULAR", rotulo: "Transporte irregular", icone: "oc-onibus" },
  { valor: "CONDUTOR_PASSAGEIRO", rotulo: "Condutor/Passageiro", icone: "equipe" },
  { valor: "VIA_SINALIZACAO", rotulo: "Via/Sinalização", icone: "alert-triangle" },
  { valor: "TERCEIROS", rotulo: "Ocorrência com terceiros", icone: "oc-terceiros" },
  { valor: "APOIO", rotulo: "Apoio solicitado", icone: "oc-apoio" },
  { valor: "OUTRO", rotulo: "Outro", icone: "oc-outro" },
];
export const rotuloCategoria = (v) => CATEGORIAS_OCORRENCIA.find((c) => c.valor === v)?.rotulo || "—";
export const iconeCategoria = (v) => CATEGORIAS_OCORRENCIA.find((c) => c.valor === v)?.icone || "fisc-ocorrencias";

export const TIPOS_ENVOLVIDO = [
  { valor: "VEICULO", rotulo: "Veículo" },
  { valor: "CONDUTOR", rotulo: "Condutor" },
  { valor: "PASSAGEIRO", rotulo: "Passageiro" },
  { valor: "PEDESTRE", rotulo: "Pedestre" },
  { valor: "TESTEMUNHA", rotulo: "Testemunha" },
  { valor: "TERCEIRO", rotulo: "Terceiro" },
  { valor: "OUTRO", rotulo: "Outro" },
];
export const rotuloEnvolvido = (v) => TIPOS_ENVOLVIDO.find((t) => t.valor === v)?.rotulo || v;

export const SENTIDOS_VIA = [
  "Centro → Bairro", "Bairro → Centro", "Norte → Sul", "Sul → Norte",
  "Leste → Oeste", "Oeste → Leste", "Ambos os sentidos",
].map((s) => ({ valor: s, rotulo: s }));
