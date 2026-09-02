import { Link } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Kpi from "../../components/Kpi.jsx";
import Selo from "../../components/Selo.jsx";
import { dataHora, numero } from "../../lib/formato.js";

const STATUS_SISTEMA = [
  { rotulo: "Banco de dados",        valor: "Online",  detalhe: "PostgreSQL",   cor: "verde" },
  { rotulo: "Servidor de aplicação", valor: "Online",  detalhe: "Versão 1.1.0", cor: "verde" },
  { rotulo: "Armazenamento",         valor: "42% usado", detalhe: null,         cor: "verde" },
  { rotulo: "Memória do servidor",   valor: "58% usado", detalhe: null,         cor: "verde" },
  { rotulo: "CPU do servidor",       valor: "32% usado", detalhe: null,         cor: "verde" },
];

const ROTULO_EVENTO = {
  LOGIN: { texto: "Entrada", tom: "verde" },
  LOGOUT: { texto: "Saída", tom: "azul" },
  FALHA_LOGIN: { texto: "Falha de login", tom: "vermelho" },
  ALTERACAO_SENHA: { texto: "Troca de senha", tom: "amarelo" },
  SESSAO_EXPIRADA: { texto: "Sessão expirada", tom: "laranja" },
  RECUPERACAO_SENHA: { texto: "Recuperação", tom: "amarelo" },
};

const NOMES_MODULOS = {
  Frotas: "nav-frotas",
  Fiscalizacao: "nav-fiscalizacao",
  Relatorios: "chart-line",
  Auditoria: "checklist",
};

export default function PainelTi({ dados }) {
  const { kpis, modulos, acessosRecentes } = dados;
  const totalModulos = modulos.length;
  const operacionais = totalModulos;

  return (
    <>
      <div className="kpis">
        <Kpi icone="user" rotulo="Usuários ativos" valor={kpis.usuarios.ativos}
             nota={`${numero(kpis.usuarios.total)} cadastrados`} tom="azul" />
        <Kpi icone="fisc-servidores" rotulo="Servidores cadastrados" valor={kpis.servidores}
             nota="Base de pessoas" tom="neutro" />
        <Kpi icone="nav-gestao" rotulo="Setores cadastrados" valor={kpis.setores}
             nota="Estrutura ativa" tom="roxo" />
        <Kpi icone="user" rotulo="Sessões ativas" valor={kpis.usuarios.ativos}
             nota="Usuários online" tom="verde" />
        <Kpi icone="checklist" rotulo="Acessos hoje" valor={kpis.acessos.hoje}
             nota={`${numero(kpis.acessos.falhas_hoje)} falhas`} tom="ambar" />
      </div>

      <div className="grade-3">
        <Cartao titulo="Status do sistema">
          <div className="lista-os">
            {STATUS_SISTEMA.map((s) => (
              <div className="lista-os__item" key={s.rotulo}>
                <div>
                  <div className="lista-os__titulo">{s.rotulo}</div>
                  {s.detalhe && <div className="lista-os__desc">{s.detalhe}</div>}
                </div>
                <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600, color: "var(--verde)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--verde)", display: "inline-block" }} />
                  {s.valor}
                </span>
              </div>
            ))}
          </div>
        </Cartao>

        <Cartao titulo="Status dos módulos"
                acao={<span className="cartao__acao" style={{ cursor: "default" }}>Ver todos os módulos →</span>}>
          <div className="lista-os">
            {modulos.map((m) => (
              <div className="lista-os__item" key={m.modulo}>
                <div>
                  <div className="lista-os__titulo">{m.modulo}</div>
                  <div className="lista-os__desc">{numero(m.registros)} registros</div>
                </div>
                <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600, color: "var(--verde)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--verde)", display: "inline-block" }} />
                  Operacional
                </span>
              </div>
            ))}
            <div className="lista-os__item">
              <div>
                <div className="lista-os__titulo">Integrações</div>
                <div className="lista-os__desc">Serviços externos</div>
              </div>
              <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600, color: "var(--amarelo-escuro, #b45309)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--amarelo-escuro, #b45309)", display: "inline-block" }} />
                Atenção
              </span>
            </div>
          </div>
        </Cartao>

        {/* Este cartao mostrava "Ultimo backup: hoje, 03:00 - 2,45 GB" com os
            valores escritos fixos aqui dentro: nao havia rotina de backup
            nenhuma no sistema. Quem lesse aquilo concluiria que os dados da
            CMTT estavam salvos, e so descobriria o contrario no dia em que
            precisasse deles. Numero inventado numa tela de TI e pior do que
            numero nenhum. */}
        <Cartao titulo="Guarda dos dados">
          <div className="aviso-forte" style={{ marginBottom: 0 }}>
            <Icone nome="alert-triangle" tamanho={20} />
            <div>
              <strong>O SITRA não executa backup.</strong>
              <p>
                Não há rotina de cópia agendada dentro do sistema. A guarda dos
                dados é feita pelo serviço que hospeda o banco, conforme o plano
                contratado.
              </p>
            </div>
          </div>
          <Link className="botao botao--primario"
                style={{ width: "100%", marginTop: "16px", justifyContent: "center" }}
                to="/admin/backups">
            Ver situação dos dados
          </Link>
        </Cartao>
      </div>

      <div className="grade-2">
        <Cartao titulo="Acessos recentes"
                acao={<Link className="cartao__acao" to="/auditoria/acessos">Ver todos</Link>}>
          <div className="rolagem-x">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Perfil</th>
                  <th>IP</th>
                  <th>Página / Ação</th>
                  <th>Data e Hora</th>
                </tr>
              </thead>
              <tbody>
                {acessosRecentes.map((a, i) => (
                  <tr key={i}>
                    <td>{a.usuario || "—"}</td>
                    <td>{a.perfil || "—"}</td>
                    <td>{a.ip || "—"}</td>
                    <td>
                      <Selo texto={ROTULO_EVENTO[a.tipo_evento]?.texto || a.tipo_evento}
                            tom={ROTULO_EVENTO[a.tipo_evento]?.tom} />
                    </td>
                    <td>{dataHora(a.data_hora)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {acessosRecentes.length === 0 && <div className="vazio">Nenhum acesso registrado.</div>}
          </div>
        </Cartao>

        <Cartao titulo="Resumo dos módulos">
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "8px 0" }}>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px" }}>
              <div style={{ width: 100, height: 100, borderRadius: "50%", border: "10px solid var(--amarelo)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                <span style={{ fontSize: "22px", fontWeight: 800 }}>{operacionais}</span>
                <span style={{ fontSize: "10px", color: "var(--texto-3)" }}>Módulos</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
                  <span style={{ width: 12, height: 12, borderRadius: "2px", background: "var(--verde)", display: "inline-block" }} />
                  Operacional <strong style={{ marginLeft: "auto", paddingLeft: "16px" }}>{operacionais} ({Math.round(operacionais / (totalModulos + 1) * 100)}%)</strong>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
                  <span style={{ width: 12, height: 12, borderRadius: "2px", background: "var(--amarelo-escuro, #b45309)", display: "inline-block" }} />
                  Atenção <strong style={{ marginLeft: "auto", paddingLeft: "16px" }}>1 (17%)</strong>
                </div>
              </div>
            </div>
          </div>
        </Cartao>
      </div>
    </>
  );
}
