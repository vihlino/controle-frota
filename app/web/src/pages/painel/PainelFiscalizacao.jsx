import { Link } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Kpi from "../../components/Kpi.jsx";
import PainelAlertas from "../../components/PainelAlertas.jsx";
import Selo from "../../components/Selo.jsx";
import VeiculoCel from "../../components/VeiculoCel.jsx";
import { TituloPainel, VazioPainel, ListaOsPainel, AcaoRapida } from "../../components/PainelUi.jsx";
import { data, hora, numero } from "../../lib/formato.js";

const ROTULOS_OS = {
  PENDENTE: { titulo: "Solicitadas", descricao: "Esperando o Frotas completar" },
  EM_ANALISE:           { titulo: "OS em aberto",        descricao: "Ordens de serviço abertas" },
  EM_MANUTENCAO:        { titulo: "Em execução",         descricao: "Serviços em andamento" },
  AGUARDANDO_PECAS:     { titulo: "Aguardando peças",    descricao: "Aguardando chegada de peças" },
  AGUARDANDO_APROVACAO: { titulo: "Aguardando aprovação", descricao: "Aguardando aprovação" },
};

export default function PainelFiscalizacao({ dados }) {
  const { kpis, ultimasOcorrencias, servicosHoje, ultimosChecklists, ordensServico } = dados;
  const totalEquipes = kpis.equipes?.total || 0;
  const ativas = kpis.equipes?.ativas || 0;
  const pctEquipes = totalEquipes ? Math.round((ativas / totalEquipes) * 100) : 0;

  return (
    <>
      {/* Cartoes dividindo a linha inteira, como no painel de Frotas (26/10). */}
      <div className="kpis kpis--esticar">
        <Kpi icone="fisc-servidores" rotulo="Equipes em serviço"
             valor={kpis.equipesEmServico}
             nota={`${pctEquipes}% do total`} tom="azul" para="/fiscalizacao/servico-diario" />
        <Kpi icone="fisc-viatura" rotulo="Viaturas em uso"
             valor={kpis.viaturasEmUso}
             nota="Em campo agora" tom="verde" para="/fiscalizacao/viaturas" />
        <Kpi icone="fisc-ocorrencias" rotulo="Ocorrências hoje"
             valor={kpis.ocorrenciasHoje.hoje}
             nota={`${numero(kpis.ocorrenciasHoje.em_andamento)} em andamento`} tom="laranja" para="/fiscalizacao/ocorrencias" />
        <Kpi icone="checklist" rotulo="Checklists de hoje"
             valor={kpis.checklistsHoje}
             nota="Enviados" tom="roxo" para="/fiscalizacao/checklists" />
      </div>

      {/* Alertas e Acoes rapidas na coluna vertical a direita, como no painel
          de Frotas (26/10). Os alertas sao so os da Fiscalizacao. */}
      <div className="painel-frotas">
        <div className="painel-frotas__principal">
      <div className="grade-2">
        <Cartao titulo={<TituloPainel icone="calendar" tom="laranja">Serviço diário — em andamento</TituloPainel>}
                acao={<Link className="cartao__acao" to="/fiscalizacao/servico-diario">Ver todos →</Link>}>
          <div className="rolagem-x">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Turno</th>
                  <th>Início</th>
                  <th>Coordenador</th>
                  <th>Equipes</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {(servicosHoje || []).map((s) => (
                  <tr key={s.id_servico_diario}>
                    <td>{{ DIURNO: "Diurno", NOTURNO: "Noturno" }[s.turno] || s.turno}</td>
                    <td>{hora(s.hora_inicio)}</td>
                    <td>{s.coordenador}</td>
                    <td>{s.n_equipes}</td>
                    <td><Selo valor={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!servicosHoje || servicosHoje.length === 0) && (
              <VazioPainel icone="checklist" titulo="Nenhum serviço em andamento hoje." texto="Quando houver serviços em andamento, eles serão exibidos aqui." />
            )}
          </div>
        </Cartao>

        <Cartao titulo={<TituloPainel icone="oc-local" tom="azul">Ocorrências de hoje</TituloPainel>}
                acao={<Link className="cartao__acao" to="/fiscalizacao/ocorrencias">Ver todas →</Link>}>
          <div className="rolagem-x">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Protocolo</th>
                  <th>Tipo</th>
                  <th>Local</th>
                  <th>Hora</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ultimasOcorrencias.map((o) => (
                  <tr key={o.id_ocorrencia}>
                    <td>{o.protocolo || "—"}</td>
                    <td>{o.tipo}</td>
                    <td>{o.endereco}</td>
                    <td>{hora(o.hora)}</td>
                    <td><Selo valor={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ultimasOcorrencias.length === 0 && (
              <VazioPainel icone="checklist" titulo="Nenhuma ocorrência registrada hoje." texto="Quando houver ocorrências, elas serão exibidas aqui." />
            )}
          </div>
        </Cartao>
      </div>

      <div className="grade-2">
        <Cartao titulo={<TituloPainel icone="checklist" tom="azul">Últimos checklists</TituloPainel>}
                acao={<Link className="cartao__acao" to="/fiscalizacao/checklists">Ver todos →</Link>}>
          <div className="rolagem-x">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Enviado em</th><th>Data do Registro</th><th>Equipe</th>
                  <th>Viatura</th><th>Placa</th><th>Km Rodado</th><th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {(ultimosChecklists || []).map((c) => (
                  <tr key={c.id_checklist}>
                    <td>{hora(c.hora_saida)}</td>
                    <td>{data(c.data_abertura)}</td>
                    <td>{c.equipe || "—"}</td>
                    <td><VeiculoCel marca={c.marca} modelo={c.modelo}
                                   tipo={c.tipo_veiculo} foto={c.foto} /></td>
                    <td>{c.placa}</td>
                    <td>{c.km_rodado === null ? "—" : `${numero(c.km_rodado)} km`}</td>
                    <td><Selo valor={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!ultimosChecklists || ultimosChecklists.length === 0) && (
              <VazioPainel icone="checklist" titulo="Nenhum checklist registrado." />
            )}
          </div>
        </Cartao>

        <Cartao titulo={<TituloPainel icone="kpi-wrench" tom="azul">Manutenções em aberto</TituloPainel>}
                acao={
                  <Link className="cartao__acao" to="/fiscalizacao/manutencoes">
                    Ver todas as OS <span aria-hidden="true">→</span>
                  </Link>
                }>
          <ListaOsPainel ordens={ordensServico} rotulos={ROTULOS_OS} base="/fiscalizacao/manutencoes" />
        </Cartao>
      </div>

        </div>

        <aside className="painel-frotas__lateral">
        <PainelAlertas modulo="FISCALIZACAO" />

        <Cartao titulo={<TituloPainel icone="fisc-bolt" tom="verde">Ações rápidas</TituloPainel>}>
          <div className="lista-ar">
            <AcaoRapida para="/fiscalizacao/servico-diario?novo=1" icone="calendar">+ Serviço Diário</AcaoRapida>
            <AcaoRapida para="/fiscalizacao/ocorrencias?novo=1" icone="oc-local">+ Ocorrência</AcaoRapida>
            <AcaoRapida para="/fiscalizacao/checklists" icone="checklist">Ver Checklists</AcaoRapida>
            <AcaoRapida para="/fiscalizacao/equipes" icone="equipe">Ver Equipes</AcaoRapida>
            <AcaoRapida para="/fiscalizacao/viaturas" icone="kpi-car">Ver Viaturas</AcaoRapida>
            <AcaoRapida para="/fiscalizacao/relatorios" icone="chart-line">Relatórios</AcaoRapida>
          </div>
        </Cartao>
        </aside>
      </div>
    </>
  );
}
