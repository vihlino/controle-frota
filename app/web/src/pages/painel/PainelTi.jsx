import { Link } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
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

        <Cartao titulo="Último backup">
          <div style={{ padding: "8px 0" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", textAlign: "center", padding: "16px 0" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--amarelo)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
                ☁
              </div>
              <div style={{ fontWeight: 700, fontSize: "15px" }}>Hoje, 03:00</div>
              <div style={{ fontSize: "12px", color: "var(--texto-3)" }}>21/08/2026 03:00:15</div>
            </div>
            <div className="lista-os">
              <div className="lista-os__item">
                <span className="lista-os__desc">Tipo</span>
                <span className="lista-os__valor">Backup automático</span>
              </div>
              <div className="lista-os__item">
                <span className="lista-os__desc">Tamanho</span>
                <span className="lista-os__valor">2,45 GB</span>
              </div>
              <div className="lista-os__item">
                <span className="lista-os__desc">Próximo backup</span>
                <span className="lista-os__valor">Amanhã, 03:00</span>
              </div>
            </div>
            <button className="botao botao--primario" style={{ width: "100%", marginTop: "16px" }}>
              Gerenciar Backups
            </button>
          </div>
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
