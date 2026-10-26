import { Link } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Kpi from "../../components/Kpi.jsx";
import PainelAlertas from "../../components/PainelAlertas.jsx";
import Selo from "../../components/Selo.jsx";
import { dataHora, hora, numero, porcentagem } from "../../lib/formato.js";

const ROTULOS_OS = {
  // OS pedida pela Fiscalizacao esperando o Frotas completar (18/10).
  PENDENTE:      { titulo: "Solicitadas", descricao: "Pedidas pela Fiscalização, para completar" },
  EM_ANALISE:    { titulo: "OS em aberto",       descricao: "Ordens de serviço abertas" },
  EM_MANUTENCAO: { titulo: "Em execução",        descricao: "Serviços em andamento" },
  AGUARDANDO_PECAS:    { titulo: "Aguardando peças",   descricao: "Aguardando chegada de peças" },
  AGUARDANDO_APROVACAO:{ titulo: "Aguardando aprovação", descricao: "Aguardando aprovação" },
};

export default function PainelFrotas({ dados }) {
  const { kpis, ultimosChecklists, veiculosEmUso, vencimentos, ordensServico } = dados;
  // Data de hoje no formato do filtro (aaaa-mm-dd), pelo relogio de quem
  // esta olhando a tela - e o mesmo dia que o cartao mostra.
  const hoje = new Date().toLocaleDateString("sv-SE");
  const difChecklists = kpis.checklistsHoje.valor - kpis.checklistsHoje.ontem;

  return (
    <>
      {/* kpis--esticar: no painel os cartoes dividem a linha inteira. Com a
          largura maxima fixa da .kpis eles ficavam colados a esquerda e
          sobrava um vazio enorme nas telas grandes. */}
      <div className="kpis kpis--esticar">
        <Kpi icone="kpi-car"       rotulo="Total de Veículos"  valor={kpis.total}
             nota="100% da frota" tom="neutro" />
        <Kpi icone="kpi-car-front" rotulo="Disponível"         valor={kpis.disponiveis.valor}
             nota={`${porcentagem(kpis.disponiveis.percentual)} da frota`} tom="verde" />
        <Kpi icone="kpi-steering"  rotulo="Em Operação"        valor={kpis.emOperacao.valor}
             nota={`${porcentagem(kpis.emOperacao.percentual)} da frota`} tom="azul" />
        <Kpi icone="kpi-wrench"    rotulo="Em manutenção"      valor={kpis.emManutencao.valor}
             nota={`${porcentagem(kpis.emManutencao.percentual)} da frota`} tom="ambar" />
        <Kpi icone="checklist"     rotulo="Checklists de hoje" valor={kpis.checklistsHoje.valor}
             nota={`${difChecklists >= 0 ? "↑" : "↓"} ${numero(Math.abs(difChecklists))} relação a ontem`}
             tom="roxo" />
      </div>

      {/* Alertas e Acoes rapidas numa coluna vertical a direita (pedido de
          26/10); o resto do painel fica na coluna principal. */}
      <div className="painel-frotas">
        <div className="painel-frotas__principal">
      {/* Ultimos checklists mais largo que Movimentacoes de hoje (26/10): e o
          cartao mais importante e precisa mostrar todas as colunas. Em tela
          menor os dois ficam um embaixo do outro, cada um na largura toda. */}
      <div className="grade-2 painel-frotas__linha1">
        <Cartao titulo="Últimos checklists"
                acao={<Link className="cartao__acao" to="/frotas/checklists">Ver todos</Link>}>
          <div className="rolagem-x">
            <table className="tabela">
              {/* As MESMAS colunas da tela de Checklists, na mesma ordem. O
                  painel mostrava outra combinacao - hora de saida chamada de
                  "enviado em", data do registro, percurso - e quem clicava em
                  "Ver todos" caia numa tabela diferente da que acabara de ler.
                  Percurso saiu: e texto longo e aqui ele espremia o resto. */}
              <thead>
                <tr>
                  <th>Enviado em</th><th>Placa / Veículo</th><th>Condutor</th>
                  <th>Fechado em</th><th>KM rodado</th><th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {ultimosChecklists.map((c) => (
                  <tr key={c.id_checklist}>
                    <td><strong>{dataHora(c.criado_em)}</strong></td>
                    <td>
                      <span className="celula-dupla">
                        <strong>{c.placa}</strong>
                        {/* Modelo longo cortado com "...": nao empurra a
                            Situacao para fora do cartao. */}
                        <span className="painel-modelo" title={`${c.marca} ${c.modelo}`}>{`${c.marca} ${c.modelo}`}</span>
                      </span>
                    </td>
                    <td>{c.condutor}</td>
                    <td>
                      {!c.data_finalizacao
                        ? <span className="texto-fraco">Em aberto</span>
                        : <strong>{dataHora(c.data_finalizacao)}</strong>}
                    </td>
                    <td>{c.km_rodado === null ? "—" : `${numero(c.km_rodado)} km`}</td>
                    <td><Selo valor={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ultimosChecklists.length === 0 && <div className="vazio">Nenhum checklist registrado.</div>}
          </div>
        </Cartao>

        {/* O "Ver todas" leva para a lista JA no dia de hoje: o cartao fala de
            hoje, e cair na lista inteira obrigava a refazer o filtro na mao. */}
        <Cartao titulo="Movimentações de hoje"
                acao={
                  <Link className="cartao__acao"
                        to={`/frotas/checklists?dataDe=${hoje}&dataAte=${hoje}`}>
                    Ver todas
                  </Link>
                }>
          <div className="rolagem-x">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Placa / Veículo</th><th>Motorista</th><th>Retirada</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {veiculosEmUso.map((m) => (
                  <tr key={m.id_checklist}>
                    {/* Sem o icone do veiculo (26/10): placa e, embaixo, o modelo
                        - como no Ultimos checklists. */}
                    <td>
                      <span className="celula-dupla">
                        <strong>{m.placa}</strong>
                        <span className="painel-modelo" title={`${m.marca} ${m.modelo}`}>{`${m.marca} ${m.modelo}`}</span>
                      </span>
                    </td>
                    <td>{m.motorista}</td>
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
        {/* O link ja leva a lista FILTRADA por Vencendo. Mandar para a lista
            inteira obrigaria a refazer na mao o filtro que o cartao acabou de
            aplicar - e quem clica aqui quer justamente esses documentos. */}
        <Cartao titulo="Próximos vencimentos"
                acao={
                  <Link className="cartao__acao" to="/frotas/documentos?status=VENCENDO">
                    Ver documentos <span aria-hidden="true">→</span>
                  </Link>
                }>
          <div className="vencimentos">
            {vencimentos.map((f) => (
              <div className="vencimento" key={f.dias} data-faixa={f.dias}>
                <div className="vencimento__faixa">
                  {`Até ${f.dias} dias`}
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
                  <div className="vencimento__linha" style={{ color: "var(--texto-3)" }}>
                    <span>Nenhum</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Cartao>

        <Cartao titulo="Manutenções em aberto"
                acao={
                  <Link className="cartao__acao" to="/frotas/manutencoes">
                    Ver todas as OS <span aria-hidden="true">→</span>
                  </Link>
                }>
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

        </div>

        <aside className="painel-frotas__lateral">
        <PainelAlertas modulo="FROTAS" />

        <Cartao titulo="Ações rápidas">
          {/* Cada atalho abre o FORMULARIO, nao a lista. As telas que cadastram
              por janela recebem ?novo=1, lido pelo gerador de paginas. */}
          <div className="lista-lateral">
            <Link className="acao-rapida" to="/frotas/veiculos?novo=1">
              + Cadastrar veículo
            </Link>
            <Link className="acao-rapida" to="/frotas/inspecoes?agendar=1">
              + Nova inspeção
            </Link>
            <Link className="acao-rapida" to="/frotas/manutencoes?registrar=1">
              + Registrar OS
            </Link>
            <Link className="acao-rapida" to="/frotas/documentos?novo=1">
              + Adicionar documento
            </Link>
            <Link className="acao-rapida acao-rapida--icone" to="/frotas/relatorios">
              <Icone nome="chart-line" tamanho={12} /> Relatórios
            </Link>
          </div>
        </Cartao>
        </aside>
      </div>
    </>
  );
}
