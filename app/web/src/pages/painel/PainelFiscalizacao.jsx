/**
 * PainelFiscalizacao.jsx - O painel de Fiscalizacao do Dashboard.
 */
import { Link } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Kpi from "../../components/Kpi.jsx";
import Selo from "../../components/Selo.jsx";
import { hora, numero } from "../../lib/formato.js";

export default function PainelFiscalizacao({ dados }) {
  const { kpis, ultimasOcorrencias } = dados;

  return (
    <>
      <div className="kpis">
        <Kpi icone="fisc-servidores" rotulo="Equipes em servico"
             valor={kpis.servicosEmAndamento}
             nota={`${numero(kpis.equipes.ativas)} equipes ativas`} />
        <Kpi icone="fisc-viatura" rotulo="Checklists de viatura hoje"
             valor={kpis.checklistsHoje} nota="Enviados hoje" />
        <Kpi icone="fisc-ocorrencias" rotulo="Ocorrencias hoje"
             valor={kpis.ocorrenciasHoje.hoje}
             nota={`${numero(kpis.ocorrenciasHoje.em_andamento)} em andamento`} />
        <Kpi icone="alert-triangle" rotulo="Ocorrencias ontem"
             valor={kpis.ocorrenciasHoje.ontem} nota="Para comparacao" />
      </div>

      <Cartao titulo="Ocorrencias de hoje"
              acao={<Link className="cartao__acao" to="/fiscalizacao/ocorrencias">Ver todas</Link>}>
        <div className="rolagem-x">
          <table className="tabela">
            <thead>
              <tr>
                <th>Protocolo</th><th>Tipo</th><th>Local</th><th>Hora</th><th>Situacao</th>
              </tr>
            </thead>
            <tbody>
              {ultimasOcorrencias.map((o) => (
                <tr key={o.id_ocorrencia}>
                  <td>{o.protocolo || "-"}</td>
                  <td>{o.tipo}</td>
                  <td>{o.endereco}</td>
                  <td>{hora(o.hora)}</td>
                  <td><Selo valor={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {ultimasOcorrencias.length === 0 && (
            <div className="vazio">Nenhuma ocorrencia registrada hoje.</div>
          )}
        </div>
      </Cartao>

      <Cartao titulo="Acoes rapidas">
        <div className="acoes-rapidas">
          <Link className="acao-rapida" to="/fiscalizacao/servico-diario">
            <Icone nome="calendar" tamanho={20} /> Novo servico diario
          </Link>
          <Link className="acao-rapida" to="/fiscalizacao/ocorrencias">
            <Icone nome="fisc-ocorrencias" tamanho={20} /> Nova ocorrencia
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
          <Link className="acao-rapida" to="/fiscalizacao/relatorios">
            <Icone nome="chart-line" tamanho={20} /> Relatorios
          </Link>
        </div>
      </Cartao>
    </>
  );
}
