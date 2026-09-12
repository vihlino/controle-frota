import { Link } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Kpi from "../../components/Kpi.jsx";
import Selo from "../../components/Selo.jsx";
import VeiculoCel from "../../components/VeiculoCel.jsx";
import { data, hora, numero } from "../../lib/formato.js";

const ROTULOS_OS = {
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
      <div className="kpis">
        <Kpi icone="fisc-servidores" rotulo="Equipes em serviço"
             valor={kpis.equipesEmServico}
             nota={`${pctEquipes}% do total`} tom="verde" />
        <Kpi icone="fisc-viatura" rotulo="Viaturas em uso"
             valor={kpis.viaturasEmUso}
             nota="Em campo agora" tom="azul" />
        <Kpi icone="fisc-ocorrencias" rotulo="Ocorrências hoje"
             valor={kpis.ocorrenciasHoje.hoje}
             nota={`${numero(kpis.ocorrenciasHoje.em_andamento)} em andamento`} tom="ambar" />
        <Kpi icone="checklist" rotulo="Checklists de hoje"
             valor={kpis.checklistsHoje}
             nota="Enviados" tom="roxo" />
      </div>

      <div className="grade-2">
        <Cartao titulo="Serviço diário — em andamento"
                acao={<Link className="cartao__acao" to="/fiscalizacao/servico-diario">Ver todos</Link>}>
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
                    <td>{s.turno}</td>
                    <td>{hora(s.hora_inicio)}</td>
                    <td>{s.coordenador}</td>
                    <td>{s.n_equipes}</td>
                    <td><Selo valor={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!servicosHoje || servicosHoje.length === 0) && (
              <div className="vazio">Nenhum serviço em andamento hoje.</div>
            )}
          </div>
        </Cartao>

        <Cartao titulo="Ocorrências de hoje"
                acao={<Link className="cartao__acao" to="/fiscalizacao/ocorrencias">Ver todas</Link>}>
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
              <div className="vazio">Nenhuma ocorrência registrada hoje.</div>
            )}
          </div>
        </Cartao>
      </div>

      <div className="grade-2">
        <Cartao titulo="Últimos checklists"
                acao={<Link className="cartao__acao" to="/fiscalizacao/checklists">Ver todos</Link>}>
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
              <div className="vazio">Nenhum checklist registrado.</div>
            )}
          </div>
        </Cartao>

        <Cartao titulo="Manutenções em aberto"
                acao={
                  <Link className="cartao__acao" to="/frotas/manutencoes">
                    Ver todas as OS <span aria-hidden="true">→</span>
                  </Link>
                }>
          <div className="lista-os">
            {(ordensServico || []).map((os) => {
              const rotulo = ROTULOS_OS[os.status] || { titulo: os.status, descricao: "" };
              return (
                <div className="lista-os__item" key={os.status}>
                  <span className="lista-os__icone"><Icone nome="kpi-wrench" tamanho={20} /></span>
                  <div>
                    <div className="lista-os__titulo">{rotulo.titulo}</div>
                    <div className="lista-os__desc">{rotulo.descricao}</div>
                  </div>
                  <span className="lista-os__valor">{numero(os.quantidade)}</span>
                </div>
              );
            })}
            {(!ordensServico || ordensServico.length === 0) && (
              <div className="vazio">Nenhuma OS em aberto.</div>
            )}
          </div>
        </Cartao>
      </div>

      <Cartao titulo="Ações rápidas">
        <div className="acoes-rapidas">
          <Link className="acao-rapida" to="/fiscalizacao/servico-diario?novo=1">
            + Serviço Diário
          </Link>
          <Link className="acao-rapida" to="/fiscalizacao/ocorrencias?novo=1">
            + Ocorrência
          </Link>
          {/* Sem "+": esta tela so LISTA os checklists, que nascem no celular
              pelo QR Code do veiculo. Um "+" prometeria um cadastro que nao
              existe aqui. */}
          <Link className="acao-rapida" to="/fiscalizacao/checklists">
            <Icone nome="checklist" tamanho={20} /> Ver Checklists
          </Link>
          <Link className="acao-rapida" to="/fiscalizacao/equipes">
            <Icone nome="fisc-servidores" tamanho={20} /> Ver Equipes
          </Link>
          <Link className="acao-rapida" to="/fiscalizacao/viaturas">
            <Icone nome="fisc-viatura" tamanho={20} /> Ver Viaturas
          </Link>
          <Link className="acao-rapida" to="/frotas/relatorios">
            <Icone nome="chart-line" tamanho={20} /> Relatórios
          </Link>
        </div>
      </Cartao>
    </>
  );
}
