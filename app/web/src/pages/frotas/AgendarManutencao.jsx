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
const PRIORIDADE_COR = { BAIXA: "var(--verde)", MEDIA: "var(--amarelo-escuro)", ALTA: "var(--vermelho)" };

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
    definirCabecalho({ titulo: "", legenda: "" });
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

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <Trilha itens={[{ rotulo: "Frotas" }, { rotulo: "Manutenções", para: "/frotas/manutencoes" }, { rotulo: "Agendar manutenção" }]} />
          <h1>Agendar manutenção</h1>
          <p>Preencha as informações para agendar uma nova manutenção.</p>
        </div>
        <button type="button" className="botao" onClick={() => navegar("/frotas/manutencoes")}>← Voltar</button>
      </div>

      <form onSubmit={salvar}>
        <div className="pagina-form">
          <div className="pagina-form__corpo">
            {/* Seção 1 */}
            <div className="form-secao">
              <h2 className="form-secao__titulo">
                <span className="form-secao__numero">1</span>
                Informações gerais
              </h2>
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
                       placeholder="Nome da oficina" {...campo("oficina")} />
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
            <div className="form-secao">
              <h2 className="form-secao__titulo">
                <span className="form-secao__numero">2</span>
                Informações complementares (opcional)
              </h2>
              <div className="formulario-grade">
                <Texto rotulo="Custo estimado (R$)" id="custo" type="number" min="0" step="0.01"
                       placeholder="0,00" {...campo("custo")} />
                <Data rotulo="Prazo previsto" id="prazo_previsto" {...campo("prazo_previsto")} />
                <Area rotulo="Peças necessárias" id="pecas"
                      placeholder="Liste as peças necessárias (se houver)..."
                      {...campo("pecas")} />
                <Area rotulo="Observações" id="observacoes"
                      placeholder="Observações adicionais..."
                      {...campo("observacoes")} />
              </div>
            </div>

            {/* Seção 3 — itens a verificar */}
            <div className="form-secao">
              <h2 className="form-secao__titulo">
                <span className="form-secao__numero">3</span>
                Itens a serem verificados / serviços
              </h2>
              <div className="lista-itens">
                {itens.map((item, idx) => (
                  <div key={idx} className="lista-itens__linha" style={{ gridTemplateColumns: "28px 1fr 1fr 36px" }}>
                    <span className="lista-itens__numero">{idx + 1}</span>
                    <input className="campo__input" placeholder="Item ou serviço" value={item.descricao}
                           onChange={(e) => setItens((p) => p.map((it, i) => i === idx ? { ...it, descricao: e.target.value } : it))} />
                    <input className="campo__input" placeholder="Observação (opcional)" value={item.observacao}
                           onChange={(e) => setItens((p) => p.map((it, i) => i === idx ? { ...it, observacao: e.target.value } : it))} />
                    <button type="button" className="botao-icone" title="Remover" onClick={() => removerItem(idx)}>✕</button>
                  </div>
                ))}
              </div>
              <button type="button" className="botao botao--pequeno" style={{ marginTop: "14px" }} onClick={adicionarItem}>
                + Adicionar item
              </button>
            </div>

            <div className="pagina-acoes">
              <button type="button" className="botao" onClick={() => navegar("/frotas/manutencoes")}>Cancelar</button>
              <button type="submit" className="botao botao--primario" disabled={salvando}>
                {salvando ? "Agendando..." : "Agendar manutenção"}
              </button>
            </div>
          </div>

          {/* Sidebar de resumo */}
          <div className="pagina-form__sidebar">
            <div className="cartao" style={{ padding: "24px" }}>
              <div className="cartao__topo">
                <span className="cartao__titulo">Resumo do agendamento</span>
              </div>
              <div className="cartao__corpo">
                <div className="resumo-card">
                  <div className="resumo-card__linha">
                    <span className="resumo-card__rotulo">Veículo</span>
                    <span className="resumo-card__valor">
                      {veiculoSelecionado ? `${veiculoSelecionado.placa} — ${veiculoSelecionado.marca} ${veiculoSelecionado.modelo}` : "—"}
                    </span>
                  </div>
                  <div className="resumo-card__linha">
                    <span className="resumo-card__rotulo">Tipo de manutenção</span>
                    <span className="resumo-card__valor">{TIPOS.find((t) => t.valor === formulario.tipo)?.rotulo || "—"}</span>
                  </div>
                  <div className="resumo-card__linha">
                    <span className="resumo-card__rotulo">Data agendada</span>
                    <span className="resumo-card__valor">{formulario.data_agendada || "—"}</span>
                  </div>
                  <div className="resumo-card__linha">
                    <span className="resumo-card__rotulo">Prioridade</span>
                    <span className="resumo-card__valor" style={{ color: PRIORIDADE_COR[formulario.gravidade] }}>
                      {PRIORIDADES.find((p) => p.valor === formulario.gravidade)?.rotulo || "—"}
                    </span>
                  </div>
                  {veiculoSelecionado && (
                    <div className="resumo-card__linha">
                      <span className="resumo-card__rotulo">Quilometragem atual</span>
                      <span className="resumo-card__valor">{veiculoSelecionado.quilometragem_atual?.toLocaleString("pt-BR") || "—"} km</span>
                    </div>
                  )}
                  <div className="resumo-card__linha">
                    <span className="resumo-card__rotulo">Oficina</span>
                    <span className="resumo-card__valor">{formulario.oficina || "—"}</span>
                  </div>
                  <div className="resumo-card__linha">
                    <span className="resumo-card__rotulo">Custo estimado</span>
                    <span className="resumo-card__valor">{formulario.custo ? dinheiro(formulario.custo) : "R$ 0,00"}</span>
                  </div>
                  <div className="resumo-card__linha">
                    <span className="resumo-card__rotulo">Prazo previsto</span>
                    <span className="resumo-card__valor">{formulario.prazo_previsto || "Não informado"}</span>
                  </div>
                  <div className="resumo-card__linha">
                    <span className="resumo-card__rotulo">Itens a verificar</span>
                    <span className="resumo-card__valor">{itens.filter((i) => i.descricao).length} item(s)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
