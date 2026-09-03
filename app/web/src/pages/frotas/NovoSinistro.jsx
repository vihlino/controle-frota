import { useEffect, useState } from "react";
import Icone from "../../components/Icone.jsx";
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

function SimNao({ nome, rotulo: label, valor, onChange }) {
  return (
    <div className="campo">
      <label>{label}</label>
      <div className="sim-nao">
        <label className="sim-nao__opcao">
          <input type="radio" name={nome} value="true" checked={!!valor}
                 onChange={() => onChange(true)} /> Sim
        </label>
        <label className="sim-nao__opcao">
          <input type="radio" name={nome} value="false" checked={!valor}
                 onChange={() => onChange(false)} /> Não
        </label>
      </div>
    </div>
  );
}

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
    definirCabecalho({ titulo: "", legenda: "" });
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

  const setBool = (nome) => (val) => setFormulario((f) => ({ ...f, [nome]: val }));

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

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <Trilha itens={[{ rotulo: "Frotas" }, { rotulo: "Sinistros", para: "/frotas/sinistros" }, { rotulo: "Novo sinistro" }]} />
          <h1>Novo sinistro</h1>
          <p>Registre um novo sinistro ocorrido com veículo da frota.</p>
        </div>
        <button type="button" className="botao" onClick={() => navegar("/frotas/sinistros")}>← Voltar</button>
      </div>

      <form onSubmit={salvar}>
        {/* Seção 1 */}
        <div className="form-secao">
          <h2 className="form-secao__titulo">
            <span className="form-secao__numero">1</span>
            Informações gerais
          </h2>
          {erro && <div className="login__erro" style={{ marginBottom: "16px" }}>{erro}</div>}
          <div className="formulario-grade">
            <Selecao rotulo="Veículo *" id="id_veiculo" required vazio="Selecione o veículo"
                     opcoes={veiculos.map((v) => ({ valor: v.id_veiculo, rotulo: `${v.placa} - ${v.marca} ${v.modelo}` }))}
                     {...campo("id_veiculo")} />
            <Data rotulo="Data do sinistro *" id="data" required {...campo("data")} />
            <Texto rotulo="Hora do sinistro" id="hora" type="time" {...campo("hora")}  placeholder="Ex.: 08:30"/>
            <Selecao rotulo="Tipo de sinistro *" id="tipo" required opcoes={TIPOS} {...campo("tipo")} />
            <Texto rotulo="Local do sinistro *" id="local" required
                   placeholder="Ex.: Av. Brasil, 1250 - Centro" {...campo("local")} />
            <Selecao rotulo="Condutor no momento *" id="id_servidor" required vazio="Selecione o condutor"
                     opcoes={servidores.map((s) => ({ valor: s.id_servidor, rotulo: s.nome }))}
                     {...campo("id_servidor")} />
            <SimNao nome="houve_terceiros" rotulo="Houve terceiros envolvidos? *"
                    valor={formulario.houve_terceiros} onChange={setBool("houve_terceiros")} />
            <SimNao nome="tem_bo" rotulo="Possui registro policial (B.O.)? *"
                    valor={formulario.tem_bo} onChange={setBool("tem_bo")} />
            <Area rotulo="Descrição do sinistro *" id="descricao" largo required
                  placeholder="Descreva como ocorreu o sinistro..."
                  {...campo("descricao")} />
          </div>
        </div>

        {/* Seção 2 */}
        <div className="form-secao">
          <h2 className="form-secao__titulo">
            <span className="form-secao__numero">2</span>
            Danos e avaliação inicial
          </h2>
          <div className="formulario-grade">
            <Selecao rotulo="Parte do veículo danificada *" id="parte_danificada" required
                     vazio="Selecione a parte" opcoes={PARTES_VEICULO} {...campo("parte_danificada")} />
            <Selecao rotulo="Gravidade dos danos *" id="gravidade_danos" required
                     vazio="Selecione a gravidade" opcoes={GRAVIDADES} {...campo("gravidade_danos")} />
            <Area rotulo="Descrição dos danos" id="descricao_danos" largo
                  placeholder="Descreva os danos identificados no veículo..."
                  {...campo("descricao_danos")} />
          </div>
          <div className="upload-area" style={{ marginTop: "16px" }}>
            <div className="upload-area__icone">☁</div>
            <p className="upload-area__titulo">Arraste e solte as fotos aqui</p>
            <p className="upload-area__sub">ou</p>
            <button type="button" className="botao">Selecionar arquivos</button>
            <p className="upload-area__info">Formatos: JPG, PNG &nbsp;•&nbsp; Máximo: 10MB por arquivo</p>
          </div>
        </div>

        {/* Seção 3 */}
        <div className="form-secao">
          <h2 className="form-secao__titulo">
            <span className="form-secao__numero">3</span>
            Encaminhamentos e observações (opcional)
          </h2>
          <div className="formulario-grade">
            <Area rotulo="Providências tomadas imediatamente" id="providencias" largo
                  placeholder="Informe as providências tomadas no momento do sinistro..."
                  {...campo("providencias")} />
            <Area rotulo="Observações adicionais" id="observacoes" largo
                  placeholder="Observações adicionais..."
                  {...campo("observacoes")} />
          </div>
        </div>

        <div className="pagina-acoes">
          <button type="button" className="botao" onClick={() => navegar("/frotas/sinistros")}>Cancelar</button>
          <button type="submit" className="botao botao--primario" disabled={salvando}>
            <Icone nome="salvar" tamanho={16} monocromatico /> {salvando ? "Salvando..." : "Registrar sinistro"}
          </button>
        </div>
      </form>
    </>
  );
}
