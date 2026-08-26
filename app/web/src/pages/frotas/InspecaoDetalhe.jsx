/**
 * InspecaoDetalhe.jsx - Uma inspecao por inteiro.
 *
 * Mostra os itens verificados em tres colunas - Conforme, Atencao e Nao
 * conforme - alem das observacoes e do historico.
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

export default function InspecaoDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const [inspecao, setInspecao] = useState(null);
  const [itens, setItens] = useState([]);
  const [erro, setErro] = useState("");

  useEffect(() => {
    definirCabecalho({
      titulo: "Detalhes da inspecao",
      legenda: "Itens verificados, resultado e historico.",
    });
  }, [definirCabecalho]);

  useEffect(() => {
    api(`/frotas/inspecoes/${id}`).then(setInspecao).catch((e) => setErro(e.message));
    api(`/frotas/inspecoes/${id}/itens`).then(setItens).catch(() => {});
  }, [id]);

  if (erro) return <Cartao><div className="vazio">{erro}</div></Cartao>;
  if (!inspecao) return <div className="carregando">Carregando a inspecao...</div>;

  const cabecalho = [
    { rotulo: "Veiculo", valor: inspecao.placa, nota: `${inspecao.marca} ${inspecao.modelo}`, icone: "kpi-car" },
    { rotulo: "Frequencia", valor: rotulo("tipoInspecao", inspecao.tipo), icone: "calendar" },
    {
      rotulo: "Data da inspecao", valor: data(inspecao.data_realizacao),
      nota: hora(inspecao.hora_inicio), icone: "calendar",
    },
    { rotulo: "Responsavel", valor: inspecao.responsavel, icone: "user" },
    {
      rotulo: "Situacao",
      valor: inspecao.status === "ABERTA" ? "Pendente" : "Concluida",
      icone: "checklist",
    },
    {
      rotulo: "Resultado",
      valor: !inspecao.resultado
        ? "-"
        : inspecao.resultado === "CONFORME" ? "Aprovado" : "Reprovado",
      icone: "chart-line",
    },
  ];

  const secundarios = [
    ["Proxima inspecao", data(inspecao.proxima_inspecao)],
    ["Quilometragem no momento", inspecao.quilometragem ? `${numero(inspecao.quilometragem)} km` : "-"],
    ["Local da inspecao", inspecao.local || "-"],
    ["Hora de finalizacao", hora(inspecao.hora_finalizacao)],
    ["No da inspecao", inspecao.numero || "-"],
    ["Itens com ressalva", numero(inspecao.itens_com_ressalva || 0)],
  ];

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <Trilha
            itens={[
              { rotulo: "Frotas" },
              { rotulo: "Inspecoes", para: "/frotas/inspecoes" },
              { rotulo: "Detalhes da inspecao" },
            ]}
          />
          <h1>Detalhes da inspecao</h1>
          <p>{inspecao.numero || `Inspecao do veiculo ${inspecao.placa}`}</p>
        </div>
        <div className="cabecalho-pagina__acoes">
          <button className="botao" onClick={() => navegar("/frotas/inspecoes")}>
            Voltar para inspecoes
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

      <Cartao titulo="Informacoes complementares">
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
                <tr key={i.id_inspecao_item}>
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
            <div className="vazio">Nenhum item registrado nesta inspecao.</div>
          )}
        </div>
      </Cartao>

      <div className="grade-2">
        <Cartao titulo="Observacoes gerais">
          <p className="texto-corrido">
            {inspecao.observacoes || "Nenhuma observacao registrada."}
          </p>
        </Cartao>

        <Cartao titulo="Historico da inspecao">
          <ol className="linha-tempo">
            <li>
              <span className="linha-tempo__ponto" data-tom="verde" />
              <div>
                <strong>Inspecao criada</strong>
                <span>{data(inspecao.data_realizacao)} {hora(inspecao.hora_inicio)}</span>
              </div>
            </li>
            {inspecao.status === "FINALIZADA" && (
              <li>
                <span className="linha-tempo__ponto" data-tom="verde" />
                <div>
                  <strong>Inspecao concluida</strong>
                  <span>
                    {data(inspecao.data_finalizacao)} {hora(inspecao.hora_finalizacao)} -{" "}
                    {inspecao.responsavel}
                  </span>
                </div>
              </li>
            )}
            {inspecao.proxima_inspecao && (
              <li>
                <span className="linha-tempo__ponto" data-tom="amarelo" />
                <div>
                  <strong>Proxima inspecao prevista</strong>
                  <span>{data(inspecao.proxima_inspecao)}</span>
                </div>
              </li>
            )}
          </ol>
        </Cartao>
      </div>
    </>
  );
}
