import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import Trilha from "../../components/Trilha.jsx";
import { Texto, Selecao, Data, Area } from "../../components/Campos.jsx";
import { api } from "../../lib/api.js";
import { dinheiro } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";

const TIPOS = [
  { valor: "PREVENTIVA", rotulo: "Preventiva" },
  { valor: "CORRETIVA", rotulo: "Corretiva" },
];
const PRIORIDADES = [
  { valor: "BAIXA", rotulo: "Baixa" },
  { valor: "MEDIA", rotulo: "Média" },
  { valor: "ALTA", rotulo: "Alta" },
];

export default function AgendarManutencao() {
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const { usuario } = useSessao();
  const [veiculos, setVeiculos] = useState([]);
  const [formulario, setFormulario] = useState({
    id_veiculo: "", tipo: "PREVENTIVA", gravidade: "MEDIA",
    data_agendada: "", oficina: "", responsavel_oficina: "", telefone_oficina: "",
    descricao: "", custo: "", prazo_previsto: "", pecas: "", observacoes: "",
  });
  const [itens, setItens] = useState([
    { descricao: "Revisão completa", observacao: "Verificar itens conforme manual do fabricante" },
    { descricao: "Troca de óleo e filtros", observacao: "Óleo SW30 / Filtro de óleo, ar e combustível" },
    { descricao: "Alinhamento e balanceamento", observacao: "Verificar desgaste dos pneus" },
  ]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    definirCabecalho({ titulo: "Agendar manutenção", legenda: "Preencha as informações para agendar uma nova manutenção." });
    api("/frotas/veiculos/opcoes").then(setVeiculos).catch(() => {});
  }, [definirCabecalho]);

  const campo = (nome) => ({
    value: formulario[nome] ?? "",
    onChange: (e) => setFormulario((f) => ({ ...f, [nome]: e.target.value })),
  });

  const veiculoSelecionado = veiculos.find((v) => String(v.id_veiculo) === String(formulario.id_veiculo));

  function adicionarItem() {
    setItens((prev) => [...prev, { descricao: "", observacao: "" }]);
  }
  function removerItem(i) {
    setItens((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      await api("/frotas/manutencoes", {
        method: "POST",
        body: {
          ...formulario,
          id_veiculo: Number(formulario.id_veiculo),
          id_solicitante: usuario.id_usuario,
          origem: "FROTAS",
          status: "EM_ANALISE",
          custo: formulario.custo ? Number(formulario.custo) : null,
        },
      });
      navegar("/frotas/manutencoes");
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  const PRIORIDADE_COR = { BAIXA: "var(--verde)", MEDIA: "var(--amarelo)", ALTA: "var(--vermelho)" };

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <Trilha itens={[{ rotulo: "Frotas" }, { rotulo: "Manutenções", para: "/frotas/manutencoes" }, { rotulo: "Agendar manutenção" }]} />
          <h1>Agendar manutenção</h1>
          <p>Preencha as informações para agendar uma nova manutenção.</p>
        </div>
      </div>

      <form onSubmit={salvar}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "20px", alignItems: "start" }}>
          <div>
            {/* Seção 1 */}
            <div className="cartao" style={{ padding: "28px", marginBottom: "20px" }}>
              <h2 style={{ margin: "0 0 20px", fontSize: "15px", fontWeight: 600 }}>1. Informações gerais</h2>
              {erro && <div className="login__erro" style={{ marginBottom: "16px" }}>{erro}</div>}
              <div className="formulario-grade">
                <Selecao rotulo="Veículo *" id="id_veiculo" required vazio="Selecione"
                         opcoes={veiculos.map((v) => ({ valor: v.id_veiculo, rotulo: `${v.placa} - ${v.marca} ${v.modelo}` }))}
                         {...campo("id_veiculo")} />
                <Data rotulo="Data agendada *" id="data_agendada" required {...campo("data_agendada")} />
                <Selecao rotulo="Prioridade *" id="gravidade" required opcoes={PRIORIDADES} {...campo("gravidade")} />
                <Texto rotulo="Quilometragem atual" id="quilometragem" type="number" min="0"
                       placeholder="km" readOnly value={veiculoSelecionado?.quilometragem_atual || ""} />
                <Selecao rotulo="Tipo de manutenção *" id="tipo" required opcoes={TIPOS} {...campo("tipo")} />
                <Texto rotulo="Oficina / Fornecedor *" id="oficina" required
                       placeholder="Selecione a oficina" {...campo("oficina")} />
                <Texto rotulo="Responsável pela oficina" id="responsavel_oficina"
                       placeholder="Nome do responsável" {...campo("responsavel_oficina")} />
                <Texto rotulo="Telefone da oficina" id="telefone_oficina"
                       placeholder="(00) 00000-0000" {...campo("telefone_oficina")} />
                <Area rotulo="Descrição / Serviço a ser realizado *" id="descricao" largo required
                      placeholder="Descreva o serviço ou manutenção a ser realizado..."
                      {...campo("descricao")} />
              </div>
            </div>

            {/* Seção 2 */}
            <div className="cartao" style={{ padding: "28px", marginBottom: "20px" }}>
              <h2 style={{ margin: "0 0 20px", fontSize: "15px", fontWeight: 600 }}>2. Informações complementares (opcional)</h2>
              <div className="formulario-grade">
                <Texto rotulo="Custo estimado" id="custo" type="number" min="0" step="0.01"
                       placeholder="R$ 0,00" {...campo("custo")} />
                <Data rotulo="Prazo previsto" id="prazo_previsto" {...campo("prazo_previsto")} />
                <Area rotulo="Peças necessárias" id="pecas"
                      placeholder="Liste as peças necessárias (se houver)..."
                      {...campo("pecas")} />
                <Area rotulo="Observações" id="observacoes"
                      placeholder="Observações adicionais..."
                      {...campo("observacoes")} />
              </div>
            </div>

            {/* Seção 3 */}
            <div className="cartao" style={{ padding: "28px", marginBottom: "20px" }}>
              <h2 style={{ margin: "0 0 20px", fontSize: "15px", fontWeight: 600 }}>3. Itens a serem verificados / serviços</h2>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 36px", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--texto-2)" }}>#</span>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--texto-2)" }}>Item / Serviço</span>
                <span />
              </div>
              {itens.map((item, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "28px 1fr 1fr 36px", gap: "8px", marginBottom: "10px", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", color: "var(--texto-2)", textAlign: "center" }}>{idx + 1}</span>
                  <input className="campo__input" placeholder="Item ou serviço" value={item.descricao}
                         onChange={(e) => setItens((p) => p.map((it, i) => i === idx ? { ...it, descricao: e.target.value } : it))} />
                  <input className="campo__input" placeholder="Observação (opcional)" value={item.observacao}
                         onChange={(e) => setItens((p) => p.map((it, i) => i === idx ? { ...it, observacao: e.target.value } : it))} />
                  <button type="button" className="botao-icone" title="Remover" onClick={() => removerItem(idx)}>✕</button>
                </div>
              ))}
              <button type="button" className="botao" style={{ marginTop: "4px" }} onClick={adicionarItem}>+ Adicionar item</button>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button type="button" className="botao" onClick={() => navegar("/frotas/manutencoes")}>✕ Cancelar</button>
              <button type="submit" className="botao botao--primario" disabled={salvando}>
                📅 {salvando ? "Agendando..." : "Agendar manutenção"}
              </button>
            </div>
          </div>

          {/* Sidebar de resumo */}
          <div className="cartao" style={{ padding: "24px", position: "sticky", top: "20px" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "14px", fontWeight: 600 }}>Resumo do agendamento</h3>
            <div style={{ fontSize: "13px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <div style={{ color: "var(--texto-2)", fontSize: "11px", marginBottom: "2px" }}>Veículo</div>
                <strong>{veiculoSelecionado ? `${veiculoSelecionado.placa} — ${veiculoSelecionado.marca} ${veiculoSelecionado.modelo}` : "—"}</strong>
              </div>
              <div>
                <div style={{ color: "var(--texto-2)", fontSize: "11px", marginBottom: "2px" }}>Tipo de manutenção</div>
                <strong>{TIPOS.find((t) => t.valor === formulario.tipo)?.rotulo || "—"}</strong>
              </div>
              <div>
                <div style={{ color: "var(--texto-2)", fontSize: "11px", marginBottom: "2px" }}>Data agendada</div>
                <strong>{formulario.data_agendada || "—"}</strong>
              </div>
              <div>
                <div style={{ color: "var(--texto-2)", fontSize: "11px", marginBottom: "2px" }}>Prioridade</div>
                <strong style={{ color: PRIORIDADE_COR[formulario.gravidade] }}>
                  {PRIORIDADES.find((p) => p.valor === formulario.gravidade)?.rotulo || "—"}
                </strong>
              </div>
              {veiculoSelecionado && (
                <div>
                  <div style={{ color: "var(--texto-2)", fontSize: "11px", marginBottom: "2px" }}>Quilometragem atual</div>
                  <strong>{veiculoSelecionado.quilometragem_atual?.toLocaleString("pt-BR") || "—"} km</strong>
                </div>
              )}
              <div>
                <div style={{ color: "var(--texto-2)", fontSize: "11px", marginBottom: "2px" }}>Oficina</div>
                <strong>{formulario.oficina || "—"}</strong>
              </div>
              <div>
                <div style={{ color: "var(--texto-2)", fontSize: "11px", marginBottom: "2px" }}>Custo estimado</div>
                <strong>{formulario.custo ? dinheiro(formulario.custo) : "R$ 0,00"}</strong>
              </div>
              <div>
                <div style={{ color: "var(--texto-2)", fontSize: "11px", marginBottom: "2px" }}>Prazo previsto</div>
                <strong>{formulario.prazo_previsto || "Não informado"}</strong>
              </div>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
