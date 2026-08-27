/**
 * PainelTi.jsx - O painel de TI e Sistema do Dashboard.
 * Usuários, servidores, setores, acessos do dia e os ultimos acessos -
 * a visao de quem administra o SITRA.
 */
import { Link } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Kpi from "../../components/Kpi.jsx";
import Selo from "../../components/Selo.jsx";
import { dataHora, numero } from "../../lib/formato.js";

const ROTULO_EVENTO = {
  LOGIN: { texto: "Entrada", tom: "verde" },
  LOGOUT: { texto: "Saida", tom: "azul" },
  FALHA_LOGIN: { texto: "Falha de login", tom: "vermelho" },
  ALTERACAO_SENHA: { texto: "Troca de senha", tom: "amarelo" },
  SESSAO_EXPIRADA: { texto: "Sessao expirada", tom: "laranja" },
  RECUPERACAO_SENHA: { texto: "Recuperacao", tom: "amarelo" },
};

export default function PainelTi({ dados }) {
  const { kpis, modulos, acessosRecentes } = dados;

  return (
    <>
      <div className="kpis">
        <Kpi icone="user" rotulo="Usuários ativos" valor={kpis.usuarios.ativos}
             nota={`${numero(kpis.usuarios.total)} cadastrados`} tom="azul" />
        <Kpi icone="fisc-servidores" rotulo="Servidores cadastrados" valor={kpis.servidores}
             nota="Base de pessoas" tom="verde" />
        <Kpi icone="nav-gestao" rotulo="Setores ativos" valor={kpis.setores}
             nota="Estrutura organizacional" tom="amarelo" />
        <Kpi icone="checklist" rotulo="Acessos hoje" valor={kpis.acessos.hoje}
             nota={`${numero(kpis.acessos.falhas_hoje)} falhas`} tom="laranja" />
      </div>

      <div className="grade-2">
        <Cartao titulo="Registros por módulo">
          <div className="lista-os">
            {modulos.map((m) => (
              <div className="lista-os__item" key={m.módulo}>
                <div>
                  <div className="lista-os__titulo">{m.módulo}</div>
                  <div className="lista-os__desc">Registros no banco</div>
                </div>
                <span className="lista-os__valor lista-os__valor--neutro">
                  {numero(m.registros)}
                </span>
              </div>
            ))}
          </div>
        </Cartao>

        <Cartao titulo="Acessos recentes"
                acao={<Link className="cartao__acao" to="/auditoria/acessos">Ver todos</Link>}>
          <div className="rolagem-x">
            <table className="tabela">
              <thead>
                <tr><th>Usuário</th><th>Perfil</th><th>IP</th><th>Evento</th><th>Data e hora</th></tr>
              </thead>
              <tbody>
                {acessosRecentes.map((a, i) => (
                  <tr key={i}>
                    <td>{a.usuário || "-"}</td>
                    <td>{a.perfil || "-"}</td>
                    <td>{a.ip || "-"}</td>
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
      </div>
    </>
  );
}
