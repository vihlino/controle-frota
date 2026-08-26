/**
 * PainelFrotas.jsx - O painel de Frotas do Dashboard.
 * KPIs da frota, ultimos checklists, veiculos em uso hoje, vencimentos
 * proximos e ordens de servico em aberto.
 */
import { Link } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Kpi from "../../components/Kpi.jsx";
import Selo from "../../components/Selo.jsx";
import { data, hora, numero, porcentagem } from "../../lib/formato.js";

// A tela do mockup lista "Aguardando pecas/aprovacao", mas ordem_servico so tem
// EM_ANALISE e EM_MANUTENCAO em aberto. Mostramos o que o banco guarda.
const ROTULOS_OS = {
  EM_ANALISE: { titulo: "Em analise", descricao: "Aguardando avaliacao" },
  EM_MANUTENCAO: { titulo: "Em manutencao", descricao: "Servico em andamento" },
};

export default function PainelFrotas({ dados }) {
  const { kpis, ultimosChecklists, veiculosEmUso, vencimentos, ordensServico } = dados;

  return (
    <>
      <div className="kpis">
        <Kpi icone="kpi-car" rotulo="Total de veiculos" valor={kpis.total} nota="100% da frota" />
        <Kpi icone="kpi-car-front" rotulo="Disponiveis" valor={kpis.disponiveis.valor}
             nota={porcentagem(kpis.disponiveis.percentual)} />
        <Kpi icone="kpi-steering" rotulo="Em operacao" valor={kpis.emOperacao.valor}
             nota={porcentagem(kpis.emOperacao.percentual)} />
        <Kpi icone="kpi-wrench" rotulo="Em manutencao" valor={kpis.emManutencao.valor}
             nota={porcentagem(kpis.emManutencao.percentual)} />
        <Kpi icone="alert-triangle" rotulo="Indisponiveis" valor={kpis.indisponiveis.valor}
             nota={porcentagem(kpis.indisponiveis.percentual)} />
        <Kpi icone="checklist" rotulo="Checklists de hoje" valor={kpis.checklistsHoje.valor}
             nota={`${numero(kpis.checklistsHoje.ontem)} ontem`} />
      </div>

      <div className="grade-2">
        <Cartao titulo="Ultimos checklists"
                acao={<Link className="cartao__acao" to="/frotas/checklists">Ver todos</Link>}>
          <div className="rolagem-x">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Data</th><th>Saida</th><th>Condutor</th><th>Veiculo</th>
                  <th>Placa</th><th>Percurso</th><th>KM rodado</th><th>Situacao</th>
                </tr>
              </thead>
              <tbody>
                {ultimosChecklists.map((c) => (
                  <tr key={c.id_checklist}>
                    <td>{data(c.data_abertura)}</td>
                    <td>{hora(c.hora_saida)}</td>
                    <td>{c.condutor}</td>
                    <td>{`${c.marca} ${c.modelo}`}</td>
                    <td>{c.placa}</td>
                    <td>{c.percurso || "-"}</td>
                    <td>{c.km_rodado === null ? "-" : `${numero(c.km_rodado)} km`}</td>
                    <td><Selo valor={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ultimosChecklists.length === 0 && <div className="vazio">Nenhum checklist registrado.</div>}
          </div>
        </Cartao>

        <Cartao titulo="Veiculos em uso hoje"
                acao={<Link className="cartao__acao" to="/frotas/checklists">Ver todos</Link>}>
          <div className="rolagem-x">
            <table className="tabela">
              <thead>
                <tr><th>Veiculo</th><th>Motorista</th><th>Placa</th><th>Saida</th><th>Situacao</th></tr>
              </thead>
              <tbody>
                {veiculosEmUso.map((m) => (
                  <tr key={m.id_checklist}>
                    <td>{`${m.marca} ${m.modelo}`}</td>
                    <td>{m.motorista}</td>
                    <td>{m.placa}</td>
                    <td>{hora(m.hora_saida)}</td>
                    <td><Selo valor={m.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {veiculosEmUso.length === 0 && <div className="vazio">Nenhuma saida registrada hoje.</div>}
          </div>
        </Cartao>
      </div>

      <div className="grade-2">
        <Cartao titulo="Proximos vencimentos"
                acao={<Link className="cartao__acao" to="/frotas/documentos">Ver todos</Link>}>
          <div className="vencimentos">
            {vencimentos.map((f) => (
              <div className="vencimento" key={f.dias} data-faixa={f.dias}>
                <div className="vencimento__faixa">Ate {f.dias} dias</div>
                <div className="vencimento__total">{numero(f.total)}</div>
                <div className="vencimento__unidade">documentos</div>
                {f.porTipo.map((t) => (
                  <div className="vencimento__linha" key={t.tipo}>
                    <span>{t.tipo}</span>
                    <strong>{numero(t.quantidade)}</strong>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Cartao>

        <Cartao titulo="Manutencoes / OS em aberto"
                acao={<Link className="cartao__acao" to="/frotas/manutencoes">Ver todas</Link>}>
          <div className="lista-os">
            {ordensServico.map((os) => {
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
            {ordensServico.length === 0 && <div className="vazio">Nenhuma OS em aberto.</div>}
          </div>
        </Cartao>
      </div>

      <Cartao titulo="Acoes rapidas">
        <div className="acoes-rapidas">
          <Link className="acao-rapida" to="/frotas/veiculos">
            <Icone nome="kpi-car" tamanho={20} /> Cadastrar veiculo
          </Link>
          <Link className="acao-rapida" to="/frotas/inspecoes">
            <Icone nome="calendar" tamanho={20} /> Agendar inspecao
          </Link>
          <Link className="acao-rapida" to="/frotas/manutencoes">
            <Icone nome="kpi-wrench" tamanho={20} /> Agendar manutencao
          </Link>
          <Link className="acao-rapida" to="/frotas/documentos">
            <Icone nome="nav-gestao" tamanho={20} /> Novo documento
          </Link>
          <Link className="acao-rapida" to="/frotas/sinistros">
            <Icone nome="alert-triangle" tamanho={20} /> Registrar sinistro
          </Link>
          <Link className="acao-rapida" to="/frotas/relatorios">
            <Icone nome="chart-line" tamanho={20} /> Gerar relatorio
          </Link>
        </div>
      </Cartao>
    </>
  );
}
