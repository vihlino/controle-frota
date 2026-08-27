/**
 * InspeçãoDetalhe.jsx - Uma inspeção por inteiro.
 *
 * Mostra os itens verificados em tres colunas - Conforme, Atencao e Nao
 * conforme - alem das observações e do historico.
 */
import { useEffect, useState } from "react";
import { useOutletContext, useParams, useNavigate } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import Selo from "../../components/Selo.jsx";
import { api } from "../../lib/api.js";
import { data, hora, numero, rotulo, ROTULOS } from "../../lib/formato.js";

// Marcador das tres colunas de resultado: Conforme, Atencao e Nao conforme.
function Marca({ ativo, tom }) {
  if (!ativo) return <span className="marca marca--vazia">-</span>;
  return <span className="marca" data-tom={tom}>*</span>;
}

export default function InspeçãoDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const [inspeção, setInspeção] = useState(null);
  const [itens, setItens] = useState([]);
  const [erro, setErro] = useState("");

  useEffect(() => {
    definirCabecalho({
      titulo: "Detalhes da inspeção",
      legenda: "Itens verificados, resultado e historico.",
    });
  }, [definirCabecalho]);

  useEffect(() => {
    api(`/frotas/inspecoes/${id}`).then(setInspeção).catch((e) => setErro(e.message));
    api(`/frotas/inspecoes/${id}/itens`).then(setItens).catch(() => {});
  }, [id]);

  if (erro) return <Cartao><div className="vazio">{erro}</div></Cartao>;
  if (!inspeção) return <div className="carregando">Carregando a inspeção...</div>;

  const cabecalho = [
    { rotulo: "Veículo", valor: inspeção.placa, nota: `${inspeção.marca} ${inspeção.modelo}`, icone: "kpi-car" },
    { rotulo: "Frequencia", valor: rotulo("tipoInspeção", inspeção.tipo), icone: "calendar" },
    {
      rotulo: "Data da inspeção", valor: data(inspeção.data_realizacao),
      nota: hora(inspeção.hora_inicio), icone: "calendar",
    },
    { rotulo: "Responsavel", valor: inspeção.responsavel, icone: "user" },
    {
      rotulo: "Situação",
      valor: inspeção.status === "ABERTA" ? "Pendente" : "Concluida",
      icone: "checklist",
    },
    {
      rotulo: "Resultado",
      valor: !inspeção.resultado
        ? "-"
        : inspeção.resultado === "CONFORME" ? "Aprovado" : "Reprovado",
      icone: "chart-line",
    },
  ];

  const secundarios = [
    ["Proxima inspeção", data(inspeção.proxima_inspeção)],
    ["Quilometragem no momento", inspeção.quilometragem ? `${numero(inspeção.quilometragem)} km` : "-"],
    ["Local da inspeção", inspeção.local || "-"],
    ["Hora de finalizacao", hora(inspeção.hora_finalizacao)],
    ["No da inspeção", inspeção.numero || "-"],
    ["Itens com ressalva", numero(inspeção.itens_com_ressalva || 0)],
  ];

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <Trilha
            itens={[
              { rotulo: "Frotas" },
              { rotulo: "Inspeções", para: "/frotas/inspecoes" },
              { rotulo: "Detalhes da inspeção" },
            ]}
          />
          <h1>Detalhes da inspeção</h1>
          <p>{inspeção.numero || `Inspeção do veículo ${inspeção.placa}`}</p>
        </div>
        <div className="cabecalho-pagina__ações">
          <button className="botao" onClick={() => navegar("/frotas/inspecoes")}>
            Voltar para inspeções
          </button>
          <button className="botao" onClick={() => window.print()}>
            <Icone nome="arrow-up" tamanho={15} /> Imprimir / PDF
          </button>
        </div>
      </div>

      <div className="faixa-resumo">
        {cabecalho.map((c) => (
          <div className="faixa-resumo__item" key={c.rotulo}>
            <span className="faixa-resumo__icone"><Icone nome={c.icone} tamanho={18} /></span>
            <div>
              <div className="faixa-resumo__rotulo">{c.rotulo}</div>
              <div className="faixa-resumo__valor">{c.valor}</div>
              {c.nota && <div className="faixa-resumo__nota">{c.nota}</div>}
            </div>
          </div>
        ))}
      </div>

      <Cartao titulo="Informações complementares">
        <dl className="lista-dados lista-dados--grade">
          {secundarios.map(([r, v]) => (
            <div className="lista-dados__linha" key={r}>
              <dt>{r}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </Cartao>

      <Cartao titulo="Itens verificados">
        <div className="rolagem-x">
          <table className="tabela">
            <thead>
              <tr>
                <th>Item verificado</th>
                <th className="coluna-marca">Conforme</th>
                <th className="coluna-marca">Atencao</th>
                <th className="coluna-marca">Nao conforme</th>
                <th>Observacao</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((i) => (
                <tr key={i.id_inspeção_item}>
                  <td>{i.item}</td>
                  <td className="coluna-marca">
                    <Marca ativo={i.resultado === "NORMAL"} tom="verde" />
                  </td>
                  <td className="coluna-marca">
                    <Marca ativo={i.resultado === "ATENCAO"} tom="amarelo" />
                  </td>
                  <td className="coluna-marca">
                    <Marca ativo={i.resultado === "AVARIA"} tom="vermelho" />
                  </td>
                  <td>{i.observacao || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {itens.length === 0 && (
            <div className="vazio">Nenhum item registrado nesta inspeção.</div>
          )}
        </div>
      </Cartao>

      <div className="grade-2">
        <Cartao titulo="Observações gerais">
          <p className="texto-corrido">
            {inspeção.observações || "Nenhuma observacao registrada."}
          </p>
        </Cartao>

        <Cartao titulo="Historico da inspeção">
          <ol className="linha-tempo">
            <li>
              <span className="linha-tempo__ponto" data-tom="verde" />
              <div>
                <strong>Inspeção criada</strong>
                <span>{data(inspeção.data_realizacao)} {hora(inspeção.hora_inicio)}</span>
              </div>
            </li>
            {inspeção.status === "FINALIZADA" && (
              <li>
                <span className="linha-tempo__ponto" data-tom="verde" />
                <div>
                  <strong>Inspeção concluida</strong>
                  <span>
                    {data(inspeção.data_finalizacao)} {hora(inspeção.hora_finalizacao)} -{" "}
                    {inspeção.responsavel}
                  </span>
                </div>
              </li>
            )}
            {inspeção.proxima_inspeção && (
              <li>
                <span className="linha-tempo__ponto" data-tom="amarelo" />
                <div>
                  <strong>Proxima inspeção prevista</strong>
                  <span>{data(inspeção.proxima_inspeção)}</span>
                </div>
              </li>
            )}
          </ol>
        </Cartao>
      </div>
    </>
  );
}
