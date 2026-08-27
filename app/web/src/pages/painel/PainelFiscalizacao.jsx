/**
 * PainelFiscalização.jsx - O painel de Fiscalização do Dashboard.
 */
import { Link } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Kpi from "../../components/Kpi.jsx";
import Selo from "../../components/Selo.jsx";
import { hora, numero } from "../../lib/formato.js";

export default function PainelFiscalização({ dados }) {
  const { kpis, ultimasOcorrências } = dados;

  return (
    <>
      <div className="kpis">
        <Kpi icone="fisc-servidores" rotulo="Equipes em serviço"
             valor={kpis.serviçosEmAndamento}
             nota={`${numero(kpis.equipes.ativas)} equipes ativas`} />
        <Kpi icone="fisc-viatura" rotulo="Checklists de viatura hoje"
             valor={kpis.checklistsHoje} nota="Enviados hoje" />
        <Kpi icone="fisc-ocorrencias" rotulo="Ocorrências hoje"
             valor={kpis.ocorrênciasHoje.hoje}
             nota={`${numero(kpis.ocorrênciasHoje.em_andamento)} em andamento`} />
        <Kpi icone="alert-triangle" rotulo="Ocorrências ontem"
             valor={kpis.ocorrênciasHoje.ontem} nota="Para comparacao" />
      </div>

      <Cartao titulo="Ocorrências de hoje"
              acao={<Link className="cartao__acao" to="/fiscalizacao/ocorrências">Ver todas</Link>}>
        <div className="rolagem-x">
          <table className="tabela">
            <thead>
              <tr>
                <th>Protocolo</th><th>Tipo</th><th>Local</th><th>Hora</th><th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {ultimasOcorrências.map((o) => (
                <tr key={o.id_ocorrência}>
                  <td>{o.protocolo || "-"}</td>
                  <td>{o.tipo}</td>
                  <td>{o.endereco}</td>
                  <td>{hora(o.hora)}</td>
                  <td><Selo valor={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {ultimasOcorrências.length === 0 && (
            <div className="vazio">Nenhuma ocorrência registrada hoje.</div>
          )}
        </div>
      </Cartao>

      <Cartao titulo="Ações rapidas">
        <div className="ações-rapidas">
          <Link className="acao-rapida" to="/fiscalizacao/servico-diario">
            <Icone nome="calendar" tamanho={20} /> Novo serviço diário
          </Link>
          <Link className="acao-rapida" to="/fiscalizacao/ocorrências">
            <Icone nome="fisc-ocorrencias" tamanho={20} /> Nova ocorrência
          </Link>
          <Link className="acao-rapida" to="/fiscalizacao/equipes">
            <Icone nome="fisc-servidores" tamanho={20} /> Ver equipes
          </Link>
          <Link className="acao-rapida" to="/fiscalizacao/viaturas">
            <Icone nome="fisc-viatura" tamanho={20} /> Ver viaturas
          </Link>
          <Link className="acao-rapida" to="/fiscalizacao/checklists">
            <Icone nome="checklist" tamanho={20} /> Checklists
          </Link>
          <Link className="acao-rapida" to="/fiscalizacao/relatórios">
            <Icone nome="chart-line" tamanho={20} /> Relatórios
          </Link>
        </div>
      </Cartao>
    </>
  );
}
