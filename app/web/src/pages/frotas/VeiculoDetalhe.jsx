/**
 * VeículoDetalhe.jsx - A ficha completa de um veículo.
 *
 * Junta tres consultas: os dados do veículo, um resumo em numeros e a linha do
 * tempo com checklists, inspeções, manutenções e sinistros misturados em ordem
 * cronologica.
 */
import { useEffect, useState } from "react";
import { useOutletContext, useParams, useNavigate, Link } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import Selo from "../../components/Selo.jsx";
import Kpi from "../../components/Kpi.jsx";
import { api } from "../../lib/api.js";
import { data, dinheiro, numero } from "../../lib/formato.js";

const ROTULO_ORIGEM = {
  CHECKLIST: { texto: "Checklist", tom: "azul", icone: "checklist" },
  INSPECAO: { texto: "Inspeção", tom: "amarelo", icone: "calendar" },
  MANUTENCAO: { texto: "Manutenção", tom: "laranja", icone: "kpi-wrench" },
  SINISTRO: { texto: "Sinistro", tom: "vermelho", icone: "alert-triangle" },
};

export default function VeículoDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const [veículo, setVeículo] = useState(null);
  const [resumo, setResumo] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [erro, setErro] = useState("");

  useEffect(() => {
    definirCabecalho({ titulo: "Detalhes do veículo", legenda: "Ficha completa e historico." });
  }, [definirCabecalho]);

  useEffect(() => {
    api(`/frotas/veiculos/${id}`).then(setVeículo).catch((e) => setErro(e.message));
    api(`/frotas/veiculos/${id}/resumo`).then(setResumo).catch(() => {});
    api(`/frotas/veiculos/${id}/historico`).then(setHistorico).catch(() => {});
  }, [id]);

  if (erro) return <Cartao><div className="vazio">{erro}</div></Cartao>;
  if (!veículo) return <div className="carregando">Carregando o veículo...</div>;

  const ficha = [
    ["Placa", veículo.placa],
    ["Marca", veículo.marca],
    ["Modelo", veículo.modelo],
    ["Renavam", veículo.renavam || "-"],
    ["Chassi", veículo.chassi || "-"],
    ["Ano de fabricacao", veículo.ano_fabricacao],
    ["Ano modelo", veículo.ano_modelo],
    ["Cor", veículo.cor],
    ["Tipo de veículo", veículo.tipo_veiculo],
    ["Combustivel", veículo.tipo_combustivel],
    ["Capacidade", veículo.capacidade || "-"],
    ["Setor", veículo.setor],
    ["Quilometragem atual", `${numero(veículo.quilometragem_atual)} km`],
    ["QR Code", veículo.qr_codigo || "Ainda nao gerado"],
  ];

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <Trilha
            itens={[
              { rotulo: "Frotas" },
              { rotulo: "Veículos", para: "/frotas/veiculos" },
              { rotulo: veículo.placa },
            ]}
          />
          <h1>
            {veículo.marca} {veículo.modelo}
          </h1>
          <p>
            Placa {veículo.placa} - {veículo.setor} - <Selo valor={veículo.status} />
          </p>
        </div>
        <div className="cabecalho-pagina__ações">
          <button className="botao" onClick={() => navegar("/frotas/veiculos")}>Voltar</button>
          <Link className="botao botao--primario" to={`/frotas/veiculos/${id}/qrcode`}>
            <Icone nome="checklist" tamanho={15} /> QR Code
          </Link>
        </div>
      </div>

      {resumo && (
        <div className="kpis">
          <Kpi icone="checklist" rotulo="Checklists" valor={resumo.checklists}
               nota="Registros de uso" tom="azul" />
          <Kpi icone="calendar" rotulo="Inspeções" valor={resumo.inspecoes}
               nota="Realizadas" tom="amarelo" />
          <Kpi icone="kpi-wrench" rotulo="OS em aberto" valor={resumo.os_abertas}
               nota={dinheiro(resumo.custo_manutencao)} tom="laranja" />
          <Kpi icone="alert-triangle" rotulo="Sinistros" valor={resumo.sinistros}
               nota={`${numero(resumo.documentos_vencidos)} doc. vencidos`} tom="vermelho" />
        </div>
      )}

      <div className="grade-2">
        <Cartao titulo="Ficha do veículo">
          <dl className="lista-dados">
            {ficha.map(([r, v]) => (
              <div className="lista-dados__linha" key={r}>
                <dt>{r}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </Cartao>

        <Cartao titulo="Historico do veículo">
          <ol className="linha-tempo linha-tempo--rolagem">
            {historico.map((h, i) => {
              const origem = ROTULO_ORIGEM[h.origem] || { texto: h.origem, tom: "azul" };
              return (
                <li key={`${h.origem}-${h.id_registro}-${i}`}>
                  <span className="linha-tempo__ponto" data-tom={origem.tom} />
                  <div>
                    <strong>{h.titulo}</strong>
                    <span>
                      {data(h.data)} - {origem.texto} - {h.pessoa}
                    </span>
                  </div>
                  <Selo valor={h.status} />
                </li>
              );
            })}
          </ol>
          {historico.length === 0 && (
            <div className="vazio">Este veículo ainda não tem movimentacao registrada.</div>
          )}
        </Cartao>
      </div>

      <Cartao titulo="Observações">
        <p className="texto-corrido">{veículo.observacoes || "Nenhuma observacao registrada."}</p>
      </Cartao>

      <Cartao titulo="Atalhos deste veículo">
        <div className="ações-rapidas">
          <Link className="acao-rapida" to={`/frotas/checklists?veículo=${id}`}>
            <Icone nome="checklist" tamanho={20} /> Checklists
          </Link>
          <Link className="acao-rapida" to={`/frotas/documentos?veículo=${id}`}>
            <Icone nome="nav-gestao" tamanho={20} /> Documentos
          </Link>
          <Link className="acao-rapida" to="/frotas/inspecoes">
            <Icone nome="calendar" tamanho={20} /> Inspeções
          </Link>
          <Link className="acao-rapida" to="/frotas/manutencoes">
            <Icone nome="kpi-wrench" tamanho={20} /> Manutenções
          </Link>
        </div>
      </Cartao>
    </>
  );
}
