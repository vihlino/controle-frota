import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import Trilha from "../../components/Trilha.jsx";
import { Texto, Selecao, Data, Area } from "../../components/Campos.jsx";
import { api } from "../../lib/api.js";
import { data } from "../../lib/formato.js";

const FREQUENCIAS = [
  { valor: "SEMANAL", rotulo: "Semanal" },
  { valor: "QUINZENAL", rotulo: "Quinzenal" },
  { valor: "MENSAL", rotulo: "Mensal" },
  { valor: "PERSONALIZADA", rotulo: "Personalizada" },
  { valor: "SEM_PERIODICIDADE", rotulo: "Sem periodicidade" },
];
const DIAS_POR_FREQUENCIA = { SEMANAL: 7, QUINZENAL: 15, MENSAL: 30 };

export default function NovaInspecao() {
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const [veiculos, setVeiculos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [formulario, setFormulario] = useState({
    id_veiculo: "", id_gestor: "", tipo: "MENSAL",
    data_realizacao: "", hora_inicio: "08:00",
    local: "", quilometragem: "", observacoes: "",
  });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    definirCabecalho({ titulo: "Nova inspeção", legenda: "Agende uma nova inspeção periódica para o veículo." });
    api("/frotas/veiculos/opcoes").then(setVeiculos).catch(() => {});
    api("/usuarios?porPagina=200").then((r) => setUsuarios(r.itens)).catch(() => {});
  }, [definirCabecalho]);

  const campo = (nome) => ({
    value: formulario[nome] ?? "",
    onChange: (e) => setFormulario((f) => ({ ...f, [nome]: e.target.value })),
  });

  function calcularProxima() {
    const dias = DIAS_POR_FREQUENCIA[formulario.tipo];
    if (!dias || !formulario.data_realizacao) return null;
    const d = new Date(`${formulario.data_realizacao}T12:00:00`);
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      const proxima = calcularProxima();
      await api("/frotas/inspecoes", {
        method: "POST",
        body: {
          ...formulario,
          id_veiculo: Number(formulario.id_veiculo),
          id_gestor: Number(formulario.id_gestor),
          data_programada: formulario.data_realizacao || null,
          proxima_inspecao: proxima,
          quilometragem: formulario.quilometragem ? Number(formulario.quilometragem) : null,
          status: "ABERTA",
        },
      });
      navegar("/frotas/inspecoes");
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  const proxima = calcularProxima();
  const diasIntervalo = DIAS_POR_FREQUENCIA[formulario.tipo];

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <Trilha itens={[{ rotulo: "Frotas" }, { rotulo: "Inspeções", para: "/frotas/inspecoes" }, { rotulo: "Nova inspeção" }]} />
          <h1>Nova inspeção</h1>
          <p>Agende uma nova inspeção periódica para o veículo.</p>
        </div>
        <button className="botao" onClick={() => navegar("/frotas/inspecoes")}>← Voltar para inspeções</button>
      </div>

      <form onSubmit={salvar}>
        <div className="cartao" style={{ padding: "28px", marginBottom: "20px" }}>
          <h2 style={{ margin: "0 0 20px", fontSize: "16px", fontWeight: 600 }}>Dados do agendamento</h2>

          {formulario.tipo === "PERSONALIZADA" && (
            <div style={{ background: "var(--amarelo-suave)", border: "1px solid var(--amarelo)", borderRadius: "var(--raio-sm)", padding: "12px 16px", marginBottom: "20px", fontSize: "13px" }}>
              <strong>Sobre a frequência personalizada</strong>
              <p style={{ margin: "4px 0 0", color: "var(--texto-2)" }}>Será necessário informar o intervalo em dias para definir a próxima inspeção.</p>
            </div>
          )}

          {erro && <div className="login__erro" style={{ marginBottom: "16px" }}>{erro}</div>}

          <div className="formulario-grade">
            <Selecao rotulo="Veículo *" id="id_veiculo" required vazio="Selecione o veículo"
                     opcoes={veiculos.map((v) => ({ valor: v.id_veiculo, rotulo: `${v.placa} - ${v.marca} ${v.modelo}` }))}
                     {...campo("id_veiculo")} />
            <Selecao rotulo="Frequência *" id="tipo" required opcoes={FREQUENCIAS} {...campo("tipo")} />
            <Data rotulo="Data da inspeção *" id="data_realizacao" required {...campo("data_realizacao")} />
            <Texto rotulo="Hora da inspeção" id="hora_inicio" type="time" {...campo("hora_inicio")} />
            <Selecao rotulo="Responsável pela inspeção *" id="id_gestor" required vazio="Selecione o responsável"
                     opcoes={usuarios.map((u) => ({ valor: u.id_usuario, rotulo: u.nome }))}
                     {...campo("id_gestor")} />
            <Texto rotulo="Quilometragem prevista (opcional)" id="quilometragem" type="number" min="0"
                   placeholder="Informe a quilometragem prevista" {...campo("quilometragem")} />
            <Texto rotulo="Local da inspeção (opcional)" id="local"
                   placeholder="Informe o local onde será realizada a inspeção" largo {...campo("local")} />
            <Area rotulo="Observações (opcional)" id="observacoes" largo
                  placeholder="Adicione informações relevantes sobre o agendamento da inspeção..."
                  {...campo("observacoes")} />
          </div>
        </div>

        <div className="cartao" style={{ padding: "28px", marginBottom: "20px" }}>
          <h2 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: 600 }}>Próxima inspeção</h2>
          <p style={{ margin: "0 0 20px", fontSize: "13px", color: "var(--texto-2)" }}>Com base na frequência selecionada, a próxima inspeção será calculada automaticamente.</p>
          <div className="grade-2">
            <div style={{ background: "var(--superficie-2)", border: "1px solid var(--borda)", borderRadius: "var(--raio-sm)", padding: "20px" }}>
              <div style={{ fontSize: "12px", color: "var(--texto-2)", marginBottom: "6px" }}>📅 Próxima inspeção estimada</div>
              <strong style={{ fontSize: "18px" }}>{proxima ? data(proxima) : "--/--/----"}</strong>
            </div>
            <div style={{ background: "var(--superficie-2)", border: "1px solid var(--borda)", borderRadius: "var(--raio-sm)", padding: "20px" }}>
              <div style={{ fontSize: "12px", color: "var(--texto-2)", marginBottom: "6px" }}>🔄 Intervalo</div>
              <strong style={{ fontSize: "18px" }}>{diasIntervalo ? `${diasIntervalo} dias` : "--"}</strong>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          <button type="button" className="botao" onClick={() => navegar("/frotas/inspecoes")}>Cancelar</button>
          <button type="submit" className="botao botao--primario" disabled={salvando}>
            📅 {salvando ? "Agendando..." : "Agendar inspeção"}
          </button>
        </div>
      </form>
    </>
  );
}
