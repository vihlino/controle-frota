/**
 * ChecklistDetalhe.jsx - Um checklist por inteiro.
 *
 * Separa saida e chegada em dois quadros. Checklist ainda aberto mostra um
 * aviso no lugar da chegada, lembrando que ela e registrada pelo QR Code.
 */
import { useEffect, useState } from "react";
import { useOutletContext, useParams, useNavigate, Link } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import Selo from "../../components/Selo.jsx";
import { api } from "../../lib/api.js";
import { data, dataHora, hora, numero, rotulo } from "../../lib/formato.js";

export default function ChecklistDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const [checklist, setChecklist] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    definirCabecalho({
      titulo: "Detalhes do checklist",
      legenda: "Saida, chegada e conferencia de equipamentos.",
    });
  }, [definirCabecalho]);

  useEffect(() => {
    api(`/frotas/checklists/${id}`).then(setChecklist).catch((e) => setErro(e.message));
  }, [id]);

  if (erro) return <Cartao><div className="vazio">{erro}</div></Cartao>;
  if (!checklist) return <div className="carregando">Carregando o checklist...</div>;

  const saida = [
    ["Data de saida", data(checklist.data_abertura)],
    ["Hora de saida", hora(checklist.hora_saida)],
    ["KM de saida", `${numero(checklist.odometro_saida)} km`],
    ["Local de saida", checklist.local_saida || "-"],
    ["Percurso / atividade", checklist.percurso || "-"],
  ];

  const chegada = [
    ["Data de devolucao", data(checklist.data_devolucao)],
    ["Hora de chegada", hora(checklist.hora_chegada)],
    [
      "KM de chegada",
      checklist.odometro_chegada === null ? "-" : `${numero(checklist.odometro_chegada)} km`,
    ],
    ["KM rodado", checklist.km_rodado === null ? "-" : `${numero(checklist.km_rodado)} km`],
    ["Finalizado em", dataHora(checklist.data_finalizacao)],
  ];

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <Trilha
            itens={[
              { rotulo: "Frotas" },
              { rotulo: "Checklists", para: "/frotas/checklists" },
              { rotulo: `Checklist ${checklist.placa}` },
            ]}
          />
          <h1>Checklist do veículo {checklist.placa}</h1>
          <p>
            {checklist.marca} {checklist.modelo} - Condutor {checklist.condutor} (matrícula{" "}
            {checklist.matricula}) - <Selo valor={checklist.status} />
          </p>
        </div>
        <div className="cabecalho-pagina__acoes">
          <button className="botao" onClick={() => navegar("/frotas/checklists")}>Voltar</button>
          <Link className="botao" to={`/frotas/veiculos/${checklist.id_veiculo}`}>
            Ver veículo
          </Link>
          <button className="botao" onClick={() => window.print()}>
            <Icone nome="arrow-up" tamanho={15} /> Imprimir
          </button>
        </div>
      </div>

      <div className="grade-2">
        <Cartao titulo="Saida do veículo">
          <dl className="lista-dados">
            {saida.map(([r, v]) => (
              <div className="lista-dados__linha" key={r}>
                <dt>{r}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </Cartao>

        <Cartao titulo="Chegada do veículo">
          {checklist.status === "ABERTO" ? (
            <div className="vazio">
              Este checklist ainda esta aberto. A chegada e registrada pela leitura do
              QR Code do veículo.
            </div>
          ) : (
            <dl className="lista-dados">
              {chegada.map(([r, v]) => (
                <div className="lista-dados__linha" key={r}>
                  <dt>{r}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </Cartao>
      </div>

      <Cartao titulo="Equipamentos obrigatorios">
        <div className="qr-equipamentos">
          {(checklist.equipamentos || []).map((e) => (
            <div className="qr-equipamento" key={e.equipamento} data-ausente={!e.conforme}>
              <strong>{rotulo("equipamento", e.equipamento)}</strong>
              <Selo
                texto={e.conforme ? "Presente" : "Ausente"}
                tom={e.conforme ? "verde" : "vermelho"}
              />
              {e.observacao && <p className="texto-corrido">{e.observacao}</p>}
            </div>
          ))}
        </div>
        {(checklist.equipamentos || []).length === 0 && (
          <div className="vazio">Nenhum equipamento registrado neste checklist.</div>
        )}
      </Cartao>

      <Cartao titulo="Observações">
        <p className="texto-corrido">{checklist.observacoes || "Nenhuma observacao registrada."}</p>
      </Cartao>
    </>
  );
}
