/**
 * Checklists.jsx - Os registros de saida e chegada da frota.
 *
 * NAO tem botao de "novo checklist", de proposito: o registro sempre nasce da
 * leitura do QR Code do veículo.
 *
 * A coluna de equipamentos mostra as quatro iniciais de forma compacta; o item
 * que o condutor marcou como ausente fica vermelho.
 */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PaginaLista from "../../components/PaginaLista.jsx";
import Selo from "../../components/Selo.jsx";
import Acoes from "../../components/Acoes.jsx";
import { Texto, Selecao, Data } from "../../components/Campos.jsx";
import { useLista } from "../../components/useLista.js";
import { api } from "../../lib/api.js";
import { data, hora, numero, rotulo } from "../../lib/formato.js";

const ORDEM_EQUIPAMENTOS = ["MACACO", "ESTEPE", "TRIANGULO", "CHAVE_RODA"];

// Mostra os quatro equipamentos obrigatorios de forma compacta. O que o
// condutor marcou como ausente fica vermelho.
function Equipamentos({ itens }) {
  const porNome = Object.fromEntries((itens || []).map((e) => [e.equipamento, e]));
  return (
    <span className="equipamentos">
      {ORDEM_EQUIPAMENTOS.map((código) => {
        const item = porNome[código];
        const ausente = item && !item.conforme;
        return (
          <abbr
            key={código}
            className="equipamentos__item"
            data-ausente={ausente ? "sim" : undefined}
            title={`${rotulo("equipamento", código)}: ${
              !item ? "nao informado" : item.conforme ? "presente" : "ausente"
            }`}
          >
            {rotulo("equipamento", código)[0]}
          </abbr>
        );
      })}
    </span>
  );
}

export default function Checklists() {
  const navegar = useNavigate();
  const [parâmetros] = useSearchParams();
  const lista = useLista("frotas/checklists", {
    busca: "", veículo: parâmetros.get("veículo") || "", status: "", dataDe: "", dataAte: "",
  });
  const [veículos, setVeículos] = useState([]);

  useEffect(() => {
    api("/frotas/veiculos/opcoes").then(setVeículos).catch(() => {});
  }, []);

  const colunas = [
    {
      chave: "data_abertura", rotulo: "Data do registro", ordenavel: true,
      render: (c) => data(c.data_abertura),
    },
    { chave: "placa", rotulo: "Placa do veículo", ordenavel: true },
    {
      chave: "veículo", rotulo: "Veículo",
      render: (c) => `${c.marca} ${c.modelo}`,
    },
    { chave: "condutor", rotulo: "Condutor", ordenavel: true },
    { chave: "percurso", rotulo: "Percurso", render: (c) => c.percurso || "-" },
    {
      chave: "saida", rotulo: "Saida (hora / KM)",
      render: (c) => (
        <span className="celula-dupla">
          <strong>{hora(c.hora_saida)}</strong>
          <span>{numero(c.odometro_saida)} km</span>
        </span>
      ),
    },
    {
      chave: "chegada", rotulo: "Chegada (hora / KM)",
      render: (c) =>
        c.odometro_chegada === null ? (
          "-"
        ) : (
          <span className="celula-dupla">
            <strong>{hora(c.hora_chegada)}</strong>
            <span>{numero(c.odometro_chegada)} km</span>
          </span>
        ),
    },
    {
      chave: "km_rodado", rotulo: "KM rodado", ordenavel: true,
      render: (c) => (c.km_rodado === null ? "-" : `${numero(c.km_rodado)} km`),
    },
    {
      chave: "equipamentos", rotulo: "Equipamentos",
      render: (c) => <Equipamentos itens={c.equipamentos} />,
    },
    { chave: "status", rotulo: "Situação", render: (c) => <Selo valor={c.status} /> },
    {
      chave: "ações", rotulo: "Ações",
      render: (c) => (
        <Acoes
          ações={[
            {
              rotulo: "Visualizar detalhes",
              aoClicar: () => navegar(`/frotas/checklists/${c.id_checklist}`),
            },
            {
              rotulo: "Ver veículo",
              aoClicar: () => navegar(`/frotas/veiculos/${c.id_veículo}`),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <PaginaLista
      trilha={[{ rotulo: "Frotas" }, { rotulo: "Checklists" }]}
      titulo="Checklists"
      descricao="Checklists enviados pela frota. Novos registros nascem da leitura do QR Code do veículo."
      lista={lista}
      colunas={colunas}
      chaveDe={(c) => c.id_checklist}
      unidade="checklists"
      vazio="Nenhum checklist encontrado com esses filtros."
      filtros={
        <>
          <Texto
            rotulo="Buscar" id="busca" placeholder="Placa, condutor ou percurso"
            value={lista.filtros.busca}
            onChange={(e) => lista.alterarFiltro("busca", e.target.value)}
          />
          <Selecao
            rotulo="Veículo" id="veículo" vazio="Todos"
            opcoes={veículos.map((v) => ({ valor: v.id_veículo, rotulo: `${v.placa} - ${v.modelo}` }))}
            value={lista.filtros.veículo}
            onChange={(e) => lista.alterarFiltro("veículo", e.target.value)}
          />
          <Selecao
            rotulo="Situação" id="status" vazio="Todas"
            opcoes={[
              { valor: "ABERTO", rotulo: "Em aberto" },
              { valor: "FINALIZADO", rotulo: "Finalizado" },
            ]}
            value={lista.filtros.status}
            onChange={(e) => lista.alterarFiltro("status", e.target.value)}
          />
          <Data rotulo="De" id="dataDe" value={lista.filtros.dataDe}
                onChange={(e) => lista.alterarFiltro("dataDe", e.target.value)} />
          <Data rotulo="Ate" id="dataAte" value={lista.filtros.dataAte}
                onChange={(e) => lista.alterarFiltro("dataAte", e.target.value)} />
        </>
      }
    />
  );
}
