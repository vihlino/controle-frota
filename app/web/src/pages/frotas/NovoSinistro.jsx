import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import Trilha from "../../components/Trilha.jsx";
import { Texto, Selecao, Data, Area } from "../../components/Campos.jsx";
import { api } from "../../lib/api.js";
import { useSessao } from "../../lib/sessao.jsx";

const TIPOS = [
  { valor: "COLISAO", rotulo: "Colisão" },
  { valor: "DANO_MATERIAL", rotulo: "Dano material" },
  { valor: "ROUBO_FURTO", rotulo: "Roubo / Furto" },
  { valor: "INCENDIO", rotulo: "Incêndio" },
  { valor: "OUTRO", rotulo: "Outro" },
];
const PARTES_VEICULO = [
  { valor: "FRENTE", rotulo: "Frente" },
  { valor: "TRASEIRA", rotulo: "Traseira" },
  { valor: "LATERAL_ESQ", rotulo: "Lateral esquerda" },
  { valor: "LATERAL_DIR", rotulo: "Lateral direita" },
  { valor: "TETO", rotulo: "Teto" },
  { valor: "OUTRO", rotulo: "Outro" },
];
const GRAVIDADES = [
  { valor: "LEVE", rotulo: "Leve" },
  { valor: "MODERADO", rotulo: "Moderado" },
  { valor: "GRAVE", rotulo: "Grave" },
  { valor: "PERDA_TOTAL", rotulo: "Perda total" },
];

export default function NovoSinistro() {
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const { usuario } = useSessao();
  const [veiculos, setVeiculos] = useState([]);
  const [servidores, setServidores] = useState([]);
  const [formulario, setFormulario] = useState({
    id_veiculo: "", id_servidor: "", data: "", hora: "",
    tipo: "COLISAO", local: "", id_responsavel: "",
    descricao: "", houve_terceiros: false, tem_bo: false,
    parte_danificada: "", gravidade_danos: "", descricao_danos: "",
    providencias: "", observacoes: "", status: "ABERTO",
  });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    definirCabecalho({ titulo: "Novo sinistro", legenda: "Registre um novo sinistro ocorrido com veículo da frota." });
    api("/frotas/veiculos/opcoes").then(setVeiculos).catch(() => {});
    api("/admin/servidores/opcoes").then(setServidores).catch(() => {});
  }, [definirCabecalho]);

  const campo = (nome) => ({
    value: formulario[nome] ?? "",
    onChange: (e) => setFormulario((f) => ({ ...f, [nome]: e.target.value })),
  });

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      await api("/frotas/sinistros", {
        method: "POST",
        body: {
          ...formulario,
          id_veiculo: Number(formulario.id_veiculo),
          id_servidor: Number(formulario.id_servidor),
          id_responsavel: usuario.id_usuario,
          houve_terceiros: !!formulario.houve_terceiros,
        },
      });
      navegar("/frotas/sinistros");
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  const SimNao = ({ nome, rotulo: label }) => (
    <div className="campo">
      <label>{label}</label>
      <div style={{ display: "flex", gap: "16px", marginTop: "6px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
          <input type="radio" name={nome} value="true" checked={!!formulario[nome]}
                 onChange={() => setFormulario((f) => ({ ...f, [nome]: true }))} /> Sim
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
          <input type="radio" name={nome} value="false" checked={!formulario[nome]}
                 onChange={() => setFormulario((f) => ({ ...f, [nome]: false }))} /> Não
        </label>
      </div>
    </div>
  );

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <Trilha itens={[{ rotulo: "Frotas" }, { rotulo: "Sinistros", para: "/frotas/sinistros" }, { rotulo: "Novo sinistro" }]} />
          <h1>Novo sinistro</h1>
          <p>Registre um novo sinistro ocorrido com veículo da frota.</p>
        </div>
      </div>

      <form onSubmit={salvar}>
        {/* Seção 1 */}
        <div className="cartao" style={{ padding: "28px", marginBottom: "20px" }}>
          <h2 style={{ margin: "0 0 20px", fontSize: "15px", fontWeight: 600 }}>1. Informações gerais</h2>
          {erro && <div className="login__erro" style={{ marginBottom: "16px" }}>{erro}</div>}
          <div className="formulario-grade">
            <Selecao rotulo="Veículo *" id="id_veiculo" required vazio="Selecione o veículo"
                     opcoes={veiculos.map((v) => ({ valor: v.id_veiculo, rotulo: `${v.placa} - ${v.marca} ${v.modelo}` }))}
                     {...campo("id_veiculo")} />
            <Data rotulo="Data / Hora do sinistro *" id="data" required {...campo("data")} />
            <Selecao rotulo="Tipo de sinistro *" id="tipo" required opcoes={TIPOS} {...campo("tipo")} />
            <Texto rotulo="Local do sinistro *" id="local" required
                   placeholder="Informe o local" {...campo("local")} />
            <Selecao rotulo="Responsável pelo veículo *" id="id_responsavel" required vazio="Selecione o responsável"
                     opcoes={servidores.map((s) => ({ valor: s.id_servidor, rotulo: s.nome }))}
                     {...campo("id_responsavel")} />
            <Selecao rotulo="Condutor no momento do sinistro *" id="id_servidor" required vazio="Selecione o condutor"
                     opcoes={servidores.map((s) => ({ valor: s.id_servidor, rotulo: s.nome }))}
                     {...campo("id_servidor")} />
            <SimNao nome="houve_terceiros" rotulo="Houve terceiros envolvidos? *" />
            <SimNao nome="tem_bo" rotulo="Possui registro policial? *" />
            <Area rotulo="Descrição do sinistro *" id="descricao" largo required
                  placeholder="Descreva como ocorreu o sinistro..."
                  {...campo("descricao")} />
          </div>
        </div>

        {/* Seção 2 */}
        <div className="cartao" style={{ padding: "28px", marginBottom: "20px" }}>
          <h2 style={{ margin: "0 0 20px", fontSize: "15px", fontWeight: 600 }}>2. Danos e avaliação inicial</h2>
          <div className="formulario-grade">
            <Selecao rotulo="Parte do veículo danificada *" id="parte_danificada" required
                     vazio="Selecione a parte" opcoes={PARTES_VEICULO} {...campo("parte_danificada")} />
            <Selecao rotulo="Gravidade dos danos *" id="gravidade_danos" required
                     vazio="Selecione a gravidade" opcoes={GRAVIDADES} {...campo("gravidade_danos")} />
            <Area rotulo="Descrição dos danos" id="descricao_danos" largo
                  placeholder="Descreva os danos identificados no veículo..."
                  {...campo("descricao_danos")} />
          </div>
          <div style={{ border: "2px dashed var(--borda-forte)", borderRadius: "var(--raio)", padding: "32px", textAlign: "center", color: "var(--texto-2)", marginTop: "16px" }}>
            <div style={{ fontSize: "28px", marginBottom: "8px" }}>☁</div>
            <p style={{ margin: "0 0 8px", fontWeight: 500 }}>Arraste e solte as fotos aqui</p>
            <p style={{ margin: "0 0 10px", fontSize: "13px" }}>ou</p>
            <button type="button" className="botao">Selecionar arquivos</button>
            <p style={{ margin: "10px 0 0", fontSize: "12px" }}>Formatos: JPG, PNG &nbsp;•&nbsp; Máximo: 10MB por arquivo</p>
          </div>
        </div>

        {/* Seção 3 */}
        <div className="cartao" style={{ padding: "28px", marginBottom: "20px" }}>
          <h2 style={{ margin: "0 0 20px", fontSize: "15px", fontWeight: 600 }}>3. Encaminhamentos e observações (opcional)</h2>
          <div className="formulario-grade">
            <Area rotulo="Providências tomadas imediatamente" id="providencias" largo
                  placeholder="Informe as providências tomadas no momento do sinistro..."
                  {...campo("providencias")} />
            <Area rotulo="Observações adicionais" id="observacoes" largo
                  placeholder="Informe observações adicionais..."
                  {...campo("observacoes")} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          <button type="button" className="botao" onClick={() => navegar("/frotas/sinistros")}>✕ Cancelar</button>
          <button type="submit" className="botao botao--primario" disabled={salvando}>
            💾 {salvando ? "Salvando..." : "Salvar sinistro"}
          </button>
        </div>
      </form>
    </>
  );
}
