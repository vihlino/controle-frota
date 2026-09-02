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
    api("/admin/servidores/opcoes")
      // Array.isArray: uma resposta fora do formato esperado faria
      // `servidores.map` derrubar a tela inteira, e o .catch abaixo nao pega
      // isso - ele so ve falha de rede.
      .then((r) => setServidores(Array.isArray(r) ? r : []))
      .catch(() => {});
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
        <button type="button" className="botao" onClick={() => navegar("/frotas/documentos")}>← Voltar</button>
      </div>

      <form onSubmit={salvar}>
        {/* Seção 1 */}
        <div className="form-secao">
          <h2 className="form-secao__titulo">
            <span className="form-secao__numero">1</span>
            Informações do documento
          </h2>
          {erro && <div className="login__erro" style={{ marginBottom: "16px" }}>{erro}</div>}
          <div className="formulario-grade">
            <Selecao rotulo="Categoria do documento *" id="categoria" required vazio="Selecione a categoria"
                     opcoes={CATEGORIAS.map((c) => ({ valor: c, rotulo: c }))} {...campo("categoria")} />
            <Texto rotulo="Tipo de documento *" id="tipo_documento" required
                   placeholder="Ex.: CRLV, Seguro" {...campo("tipo_documento")} />
            <Texto rotulo="Nº / Referência" id="numero_documento"
                   placeholder="Número ou referência" {...campo("numero_documento")} />
            <Selecao rotulo="Veículo *" id="id_veiculo" required vazio="Selecione o veículo"
                     opcoes={veiculos.map((v) => ({ valor: v.id_veiculo, rotulo: `${v.placa} - ${v.marca} ${v.modelo}` }))}
                     {...campo("id_veiculo")} />
            <Texto rotulo="Órgão / Emissor" id="orgao_emissor"
                   placeholder="Ex.: DETRAN, Seguradora" {...campo("orgao_emissor")} />
            <Selecao rotulo="Responsável" id="id_responsavel" vazio="Selecione o responsável"
                     opcoes={servidores.map((s) => ({ valor: s.id_servidor, rotulo: s.nome }))}
                     {...campo("id_responsavel")} />
            <Data rotulo="Data de emissão *" id="data_emissao" required {...campo("data_emissao")} />
            <Data rotulo="Data de vencimento *" id="data_validade" required {...campo("data_validade")} />
            <Selecao rotulo="Validade" id="validade" vazio="Selecione a validade"
                     opcoes={TIPOS_VALIDADE} {...campo("validade")} />
            <Area rotulo="Observações" id="observacoes" largo
                  placeholder="Observações adicionais (opcional)..."
                  {...campo("observacoes")} />
          </div>
        </div>

        {/* Seção 2 — Upload */}
        <div className="form-secao">
          <h2 className="form-secao__titulo">
            <span className="form-secao__numero">2</span>
            Arquivo do documento
          </h2>
          <div className="upload-area">
            <div className="upload-area__icone">☁</div>
            <p className="upload-area__titulo">Arraste e solte o arquivo aqui</p>
            <p className="upload-area__sub">ou</p>
            <button type="button" className="botao">Selecionar arquivo</button>
            <p className="upload-area__info">Formatos permitidos: PDF, JPG, PNG &nbsp;•&nbsp; Tamanho máximo: 10MB</p>
          </div>
        </div>

        {/* Seção 3 — Notificações */}
        <div className="form-secao">
          <h2 className="form-secao__titulo">
            <span className="form-secao__numero">3</span>
            Notificações de vencimento
          </h2>
          <div className="campo campo--marcavel">
            <label>
              <input type="checkbox" checked={formulario.alerta_vencimento}
                     onChange={(e) => setFormulario((f) => ({ ...f, alerta_vencimento: e.target.checked }))} />
              Receber alerta antes do vencimento
            </label>
          </div>
          {formulario.alerta_vencimento && (
            <div style={{ marginTop: "16px", display: "grid", gridTemplateColumns: "220px 1fr", gap: "16px", alignItems: "start" }}>
              <Selecao rotulo="Dias de antecedência" id="dias_antecedencia"
                       opcoes={DIAS_ANTECEDENCIA} {...campo("dias_antecedencia")} />
              <div className="card-info" style={{ marginBottom: 0, alignSelf: "end" }}>
                Você receberá um alerta com antecedência do vencimento deste documento.
              </div>
            </div>
          )}
        </div>

        <div className="pagina-acoes">
          <button type="button" className="botao" onClick={() => navegar("/frotas/documentos")}>Cancelar</button>
          <button type="submit" className="botao botao--primario" disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar documento"}
          </button>
        </div>
      </form>
    </>
  );
}
