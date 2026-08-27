import { Link } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Kpi from "../../components/Kpi.jsx";
import Selo from "../../components/Selo.jsx";
import { data, hora, numero, porcentagem } from "../../lib/formato.js";

const ROTULOS_OS = {
  EM_ANALISE:    { titulo: "OS em aberto",       descricao: "Ordens de serviço abertas" },
  EM_MANUTENCAO: { titulo: "Em execução",        descricao: "Serviços em andamento" },
  AGUARDANDO_PECAS:    { titulo: "Aguardando peças",   descricao: "Aguardando chegada de peças" },
  AGUARDANDO_APROVACAO:{ titulo: "Aguardando aprovação", descricao: "Aguardando aprovação" },
};

export default function PainelFrotas({ dados }) {
  const { kpis, ultimosChecklists, veiculosEmUso, vencimentos, ordensServico } = dados;
  const difChecklists = kpis.checklistsHoje.valor - kpis.checklistsHoje.ontem;

  return (
    <>
      <div className="kpis">
        <Kpi icone="kpi-car"       rotulo="Total de Veículos"  valor={kpis.total}
             nota="100% da frota" />
        <Kpi icone="kpi-car-front" rotulo="Disponível"         valor={kpis.disponiveis.valor}
             nota={`${porcentagem(kpis.disponiveis.percentual)} da frota`} />
        <Kpi icone="kpi-steering"  rotulo="Em Operação"        valor={kpis.emOperacao.valor}
             nota={`${porcentagem(kpis.emOperacao.percentual)} da frota`} />
        <Kpi icone="kpi-wrench"    rotulo="Em manutenção"      valor={kpis.emManutencao.valor}
             nota={`${porcentagem(kpis.emManutencao.percentual)} da frota`} />
        <Kpi icone="alert-triangle" rotulo="Indisponível"      valor={kpis.indisponiveis.valor}
             nota={`${porcentagem(kpis.indisponiveis.percentual)} da frota`} />
        <Kpi icone="checklist"     rotulo="Checklists de hoje" valor={kpis.checklistsHoje.valor}
             nota={difChecklists >= 0
               ? `↑ ${numero(Math.abs(difChecklists))} em relação a ontem`
               : `↓ ${numero(Math.abs(difChecklists))} em relação a ontem`} />
      </div>

      <div className="grade-2">
        <Cartao titulo="Últimos checklists"
                acao={<Link className="cartao__acao" to="/frotas/checklists">Ver todos</Link>}>
          <div className="rolagem-x">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Enviado em</th><th>Data do Registro</th><th>Condutor</th>
                  <th>Veículo</th><th>Placa</th><th>Percurso</th><th>Km Rodado</th><th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {ultimosChecklists.map((c) => (
                  <tr key={c.id_checklist}>
                    <td>{hora(c.hora_saida)}</td>
                    <td>{data(c.data_abertura)}</td>
                    <td>{c.condutor}</td>
                    <td>{`${c.marca} ${c.modelo}`}</td>
                    <td>{c.placa}</td>
                    <td>{c.percurso || "—"}</td>
                    <td>{c.km_rodado === null ? "—" : `${numero(c.km_rodado)} km`}</td>
                    <td><Selo valor={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ultimosChecklists.length === 0 && <div className="vazio">Nenhum checklist registrado.</div>}
          </div>
        </Cartao>

        <Cartao titulo="Movimentações de hoje"
                acao={<Link className="cartao__acao" to="/frotas/checklists">Ver todas</Link>}>
          <div className="rolagem-x">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Veículo</th><th>Motorista</th><th>Placa</th><th>Retirada</th><th>Status</th>
                </tr>
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
            {veiculosEmUso.length === 0 && <div className="vazio">Nenhuma saída registrada hoje.</div>}
          </div>
        </Cartao>
      </div>

      <div className="grade-2">
        <Cartao titulo="Próximos vencimentos"
                acao={<Link className="cartao__acao" to="/frotas/documentos">Ver todos</Link>}>
          <div className="vencimentos">
            {vencimentos.map((f) => (
              <div className="vencimento" key={f.dias} data-faixa={f.dias}>
                <div className="vencimento__faixa">
                  {f.dias === 120 ? "Até 150 dias" : `Até ${f.dias} dias`}
                </div>
                <div className="vencimento__total">{numero(f.total)}</div>
                <div className="vencimento__unidade">documentos</div>
                {f.porTipo.map((t) => (
                  <div className="vencimento__linha" key={t.tipo}>
                    <span>{t.tipo}</span>
                    <strong>{numero(t.quantidade)}</strong>
                  </div>
                ))}
                {f.porTipo.length === 0 && (
                  <div className="vencimento__linha" style={{ color: "var(--texto-leve)" }}>
                    <span>Nenhum</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Cartao>

        <Cartao titulo="Manutenções / OS em aberto"
                acao={<Link className="cartao__acao" to="/frotas/manutencoes">Ver todas as OS</Link>}>
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

      <Cartao titulo="Ações rápidas">
        <div className="acoes-rapidas">
          <Link className="acao-rapida" to="/frotas/veiculos">
            <Icone nome="kpi-car" tamanho={20} /> + Cadastrar veículo
          </Link>
          <Link className="acao-rapida" to="/frotas/inspecoes">
            <Icone nome="calendar" tamanho={20} /> + Nova inspeção
          </Link>
          <Link className="acao-rapida" to="/frotas/manutencoes">
            <Icone nome="kpi-wrench" tamanho={20} /> + Nova OS
          </Link>
          <Link className="acao-rapida" to="/frotas/documentos">
            <Icone nome="nav-gestao" tamanho={20} /> + Adicionar documento
          </Link>
          <Link className="acao-rapida" to="/frotas/checklists">
            <Icone nome="kpi-steering" tamanho={20} /> Movimentação
          </Link>
          <Link className="acao-rapida" to="/frotas/relatorios">
            <Icone nome="chart-line" tamanho={20} /> Ver veículos
          </Link>
        </div>
      </Cartao>
    </>
  );
}
