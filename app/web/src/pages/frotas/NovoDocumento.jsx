import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import Trilha from "../../components/Trilha.jsx";
import { Texto, Selecao, Data, Area } from "../../components/Campos.jsx";
import { api } from "../../lib/api.js";

const CATEGORIAS = ["Licenciamento", "Seguro", "Imposto", "Inspeção", "Manual", "Outro"];
const TIPOS_VALIDADE = [
  { valor: "1_ANO", rotulo: "1 ano" },
  { valor: "2_ANOS", rotulo: "2 anos" },
  { valor: "INDETERMINADO", rotulo: "Indeterminado" },
];
const DIAS_ANTECEDENCIA = [
  { valor: "7", rotulo: "7 dias" },
  { valor: "15", rotulo: "15 dias" },
  { valor: "30", rotulo: "30 dias" },
  { valor: "60", rotulo: "60 dias" },
  { valor: "90", rotulo: "90 dias" },
];

export default function NovoDocumento() {
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const [veiculos, setVeiculos] = useState([]);
  const [servidores, setServidores] = useState([]);
  const [formulario, setFormulario] = useState({
    categoria: "", tipo_documento: "", numero_documento: "",
    id_veiculo: "", orgao_emissor: "", id_responsavel: "",
    data_emissao: "", data_validade: "", validade: "",
    observacoes: "", alerta_vencimento: false, dias_antecedencia: "30",
    status: "VALIDO",
  });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    definirCabecalho({ titulo: "Novo documento", legenda: "Cadastre um novo documento para a frota." });
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
      await api("/frotas/documentos", {
        method: "POST",
        body: {
          ...formulario,
          id_veiculo: Number(formulario.id_veiculo),
          id_responsavel: formulario.id_responsavel ? Number(formulario.id_responsavel) : null,
          bloqueia_veiculo: false,
        },
      });
      navegar("/frotas/documentos");
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
          <Trilha itens={[{ rotulo: "Frotas" }, { rotulo: "Documentos", para: "/frotas/documentos" }, { rotulo: "Novo documento" }]} />
          <h1>Novo documento</h1>
          <p>Cadastre um novo documento para a frota.</p>
        </div>
      </div>

      <form onSubmit={salvar}>
        {/* Seção 1 */}
        <div className="cartao" style={{ padding: "28px", marginBottom: "20px" }}>
          <h2 style={{ margin: "0 0 20px", fontSize: "15px", fontWeight: 600 }}>1. Informações do documento</h2>
          {erro && <div className="login__erro" style={{ marginBottom: "16px" }}>{erro}</div>}
          <div className="formulario-grade">
            <Selecao rotulo="Categoria do documento *" id="categoria" required vazio="Selecione a categoria"
                     opcoes={CATEGORIAS.map((c) => ({ valor: c, rotulo: c }))} {...campo("categoria")} />
            <Texto rotulo="Tipo de documento *" id="tipo_documento" required
                   placeholder="Selecione o tipo" {...campo("tipo_documento")} />
            <Texto rotulo="Nº / Referência" id="numero_documento"
                   placeholder="Informe o número ou referência" {...campo("numero_documento")} />
            <Selecao rotulo="Veículo *" id="id_veiculo" required vazio="Selecione o veículo"
                     opcoes={veiculos.map((v) => ({ valor: v.id_veiculo, rotulo: `${v.placa} - ${v.marca} ${v.modelo}` }))}
                     {...campo("id_veiculo")} />
            <Texto rotulo="Órgão / Emissor" id="orgao_emissor"
                   placeholder="Informe o órgão ou emissor" {...campo("orgao_emissor")} />
            <Selecao rotulo="Responsável *" id="id_responsavel" required vazio="Selecione o responsável"
                     opcoes={servidores.map((s) => ({ valor: s.id_servidor, rotulo: s.nome }))}
                     {...campo("id_responsavel")} />
            <Data rotulo="Data de emissão *" id="data_emissao" required {...campo("data_emissao")} />
            <Data rotulo="Data de vencimento *" id="data_validade" required {...campo("data_validade")} />
            <Selecao rotulo="Validade" id="validade" vazio="Selecione a validade"
                     opcoes={TIPOS_VALIDADE} {...campo("validade")} />
            <Area rotulo="Descrição / Observações" id="observacoes" largo
                  placeholder="Informe observações adicionais sobre o documento (opcional)..."
                  {...campo("observacoes")} />
          </div>
        </div>

        {/* Seção 2 */}
        <div className="cartao" style={{ padding: "28px", marginBottom: "20px" }}>
          <h2 style={{ margin: "0 0 20px", fontSize: "15px", fontWeight: 600 }}>2. Arquivo do documento</h2>
          <div style={{ border: "2px dashed var(--borda-forte)", borderRadius: "var(--raio)", padding: "48px", textAlign: "center", color: "var(--texto-2)", cursor: "pointer" }}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>☁</div>
            <p style={{ margin: "0 0 4px", fontWeight: 500 }}>Arraste e solte o arquivo aqui</p>
            <p style={{ margin: "0 0 12px", fontSize: "13px" }}>ou</p>
            <button type="button" className="botao">Selecionar arquivo</button>
            <p style={{ margin: "12px 0 0", fontSize: "12px" }}>Formatos permitidos: PDF, JPG, PNG &nbsp;•&nbsp; Tamanho máximo: 10MB</p>
          </div>
        </div>

        {/* Seção 3 */}
        <div className="cartao" style={{ padding: "28px", marginBottom: "20px" }}>
          <h2 style={{ margin: "0 0 20px", fontSize: "15px", fontWeight: 600 }}>3. Notificações</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
              <input type="checkbox" checked={formulario.alerta_vencimento}
                     onChange={(e) => setFormulario((f) => ({ ...f, alerta_vencimento: e.target.checked }))} />
              <span>Receber alerta antes do vencimento</span>
            </label>
            {formulario.alerta_vencimento && (
              <>
                <Selecao rotulo="Dias de antecedência *" id="dias_antecedencia" required
                         opcoes={DIAS_ANTECEDENCIA} {...campo("dias_antecedencia")} />
                <div style={{ background: "var(--amarelo-suave)", border: "1px solid var(--amarelo)", borderRadius: "var(--raio-sm)", padding: "12px 16px", fontSize: "13px", flex: 1 }}>
                  Você receberá um alerta com antecedência do vencimento deste documento.
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          <button type="button" className="botao" onClick={() => navegar("/frotas/documentos")}>✕ Cancelar</button>
          <button type="submit" className="botao botao--primario" disabled={salvando}>
            💾 {salvando ? "Salvando..." : "Salvar documento"}
          </button>
        </div>
      </form>
    </>
  );
}
