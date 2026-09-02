import { Link } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Kpi from "../../components/Kpi.jsx";
import Selo from "../../components/Selo.jsx";
import { hora, numero } from "../../lib/formato.js";

export default function PainelFiscalizacao({ dados }) {
  const { kpis, ultimasOcorrencias, servicosHoje } = dados;
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

      <Cartao titulo="Equipes e viaturas"
              acao={<Link className="cartao__acao" to="/fiscalizacao/equipes">Ver detalhes</Link>}>
        <div className="grade-4" style={{ gap: "16px" }}>
          <div className="kpi-mini">
            <div className="kpi-mini__icone" style={{ background: "var(--amarelo)" }}>
              <Icone nome="fisc-servidores" tamanho={22} />
            </div>
            <div className="kpi-mini__dados">
              <div className="kpi-mini__valor">{ativas}</div>
              <div className="kpi-mini__rotulo">Equipes ativas</div>
              <div className="kpi-mini__nota">{pctEquipes}% do total</div>
            </div>
          </div>
          <div className="kpi-mini">
            <div className="kpi-mini__icone" style={{ background: "var(--verde)" }}>
              <Icone nome="fisc-servidores" tamanho={22} />
            </div>
            <div className="kpi-mini__dados">
              <div className="kpi-mini__valor">{totalEquipes - ativas}</div>
              <div className="kpi-mini__rotulo">Equipes inativas</div>
              <div className="kpi-mini__nota">Fora de serviço</div>
            </div>
          </div>
          <div className="kpi-mini">
            <div className="kpi-mini__icone" style={{ background: "var(--amarelo)" }}>
              <Icone nome="fisc-viatura" tamanho={22} />
            </div>
            <div className="kpi-mini__dados">
              <div className="kpi-mini__valor">{kpis.viaturasEmUso}</div>
              <div className="kpi-mini__rotulo">Viaturas em uso</div>
              <div className="kpi-mini__nota">Em campo</div>
            </div>
          </div>
          <div className="kpi-mini">
            <div className="kpi-mini__icone" style={{ background: "var(--laranja, #f97316)" }}>
              <Icone nome="checklist" tamanho={22} />
            </div>
            <div className="kpi-mini__dados">
              <div className="kpi-mini__valor">{kpis.checklistsHoje}</div>
              <div className="kpi-mini__rotulo">Checklists hoje</div>
              <div className="kpi-mini__nota">Enviados</div>
            </div>
          </div>
        </div>
      </Cartao>

      <Cartao titulo="Ações rápidas">
        <div className="acoes-rapidas">
          <Link className="acao-rapida" to="/fiscalizacao/servico-diario?novo=1">
            <Icone nome="calendar" tamanho={20} /> + Serviço Diário
          </Link>
          <Link className="acao-rapida" to="/fiscalizacao/ocorrencias?novo=1">
            <Icone nome="fisc-ocorrencias" tamanho={20} /> + Ocorrência
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
