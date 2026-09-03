/**
 * Documentos.jsx - Documentos dos veículos e seus vencimentos.
 *
 * Cada linha mostra quantos dias faltam para vencer, com cor: verde acima de
 * 30 dias, laranja dentro dos 30 e vermelho quando ja venceu.
 *
 * Um documento pode ser marcado para BLOQUEAR o veículo quando vencer.
 */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PaginaLista from "../../components/PaginaLista.jsx";
import Icone from "../../components/Icone.jsx";
import Selo from "../../components/Selo.jsx";
import Acoes from "../../components/Acoes.jsx";
import Modal from "../../components/Modal.jsx";
import { Texto, Selecao, Data, Area } from "../../components/Campos.jsx";
import { useLista } from "../../components/useLista.js";
import { api } from "../../lib/api.js";
import { data, numero } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";

const SITUACOES = [
  { valor: "VALIDO", rotulo: "Válido" },
  { valor: "VENCENDO", rotulo: "Vencendo" },
  { valor: "VENCIDO", rotulo: "Vencido" },
  { valor: "INATIVO", rotulo: "Inativo" },
];
const CATEGORIAS = ["Licenciamento", "Seguro", "Imposto", "Inspeção", "Manual", "Outro"];

const VAZIO = {
  id_veículo: "", tipo_documento: "", numero_documento: "", categoria: "Licenciamento",
  data_emissao: "", data_validade: "", status: "VALIDO", id_responsavel: "",
  bloqueia_veiculo: false, observacoes: "",
};

// Traduz os dias restantes na frase que aparece embaixo da data.
function prazo(dias) {
  if (dias === null || dias === undefined) return null;
  if (dias < 0) return { texto: `Vencido ha ${Math.abs(dias)} dias`, tom: "vermelho" };
  if (dias === 0) return { texto: "Vence hoje", tom: "vermelho" };
  if (dias <= 30) return { texto: `Em ${dias} dias`, tom: "laranja" };
  return { texto: `Em ${dias} dias`, tom: "verde" };
}

export default function Documentos() {
  const navegar = useNavigate();
  const { podeVer } = useSessao();
  const [parâmetros] = useSearchParams();
  const lista = useLista("frotas/documentos", {
    busca: "",
    veiculo: parâmetros.get("veiculo") || "",
    // O cartao "Proximos vencimentos" do painel manda ?status=VENCENDO, para
    // a lista ja abrir mostrando exatamente o que o cartao contou.
    status: parâmetros.get("status") || "",
    categoria: "",
  });
  const [veículos, setVeículos] = useState([]);
  const [servidores, setServidores] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [editando, setEditando] = useState(null);
  const [formulario, setFormulario] = useState(VAZIO);
  const [erroForm, setErroForm] = useState("");
  const [salvando, setSalvando] = useState(false);

  const podeGerenciar = podeVer("FROTAS_GERENCIAR_DOCUMENTOS");

  useEffect(() => {
    api("/frotas/veiculos/opcoes").then(setVeículos).catch(() => {});
    api("/admin/servidores/opcoes")
      // Array.isArray: uma resposta fora do formato esperado faria
      // `servidores.map` derrubar a tela inteira, e o .catch abaixo nao pega
      // isso - ele so ve falha de rede.
      .then((r) => setServidores(Array.isArray(r) ? r : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    api("/frotas/documentos?porPagina=200").then((r) => {
      const itens = r.itens;
      setResumo({
        total: r.total,
        vencendo: itens.filter((d) => d.dias_para_vencer >= 0 && d.dias_para_vencer <= 30).length,
        vencidos: itens.filter((d) => d.dias_para_vencer < 0).length,
        categorias: new Set(itens.map((d) => d.categoria).filter(Boolean)).size,
      });
    }).catch(() => {});
  }, [lista.resultado]);

  function abrirNovo() {
    setFormulario(VAZIO);
    setErroForm("");
    setEditando("novo");
  }
  function abrirEdicao(d) {
    setFormulario({ ...VAZIO, ...d });
    setErroForm("");
    setEditando(d.id_documento);
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErroForm("");
    try {
      const corpo = {
        ...formulario,
        id_veiculo: Number(formulario.id_veículo),
        id_responsavel: formulario.id_responsavel ? Number(formulario.id_responsavel) : null,
        bloqueia_veiculo: !!formulario.bloqueia_veiculo,
      };
      if (editando === "novo") await api("/frotas/documentos", { method: "POST", body: corpo });
      else await api(`/frotas/documentos/${editando}`, { method: "PUT", body: corpo });
      setEditando(null);
      lista.recarregar();
    } catch (e) {
      setErroForm(e.message);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(d) {
    if (!confirm(`Excluir o documento ${d.tipo_documento} do veículo ${d.placa}?`)) return;
    try {
      await api(`/frotas/documentos/${d.id_documento}`, { method: "DELETE" });
      lista.recarregar();
    } catch (e) {
      alert(e.message);
    }
  }

  const campo = (nome) => ({
    value: formulario[nome] ?? "",
    onChange: (e) => setFormulario((f) => ({ ...f, [nome]: e.target.value })),
  });

  const colunas = [
    { chave: "tipo_documento", rotulo: "Documento", ordenavel: true },
    {
      chave: "categoria", rotulo: "Categoria",
      render: (d) => (d.categoria ? <Selo texto={d.categoria} tom="azul" /> : "-"),
    },
    {
      chave: "placa", rotulo: "Veículo", ordenavel: true,
      render: (d) => (
        <span className="celula-dupla">
          <strong>{d.placa}</strong>
          <span>{`${d.marca} ${d.modelo}`}</span>
        </span>
      ),
    },
    { chave: "numero_documento", rotulo: "No / Referência", render: (d) => d.numero_documento || "-" },
    { chave: "data_emissao", rotulo: "Emissão", ordenavel: true, render: (d) => data(d.data_emissao) },
    {
      chave: "data_validade", rotulo: "Vencimento", ordenavel: true,
      render: (d) => {
        const p = prazo(d.dias_para_vencer);
        return (
          <span className="celula-dupla">
            <strong>{data(d.data_validade)}</strong>
            {p && <span className={`prazo prazo--${p.tom}`}>{p.texto}</span>}
          </span>
        );
      },
    },
    { chave: "responsavel", rotulo: "Responsável", render: (d) => d.responsavel || "-" },
    { chave: "status", rotulo: "Situação", ordenavel: true, render: (d) => <Selo valor={d.status} /> },
    {
      chave: "bloqueia_veiculo", rotulo: "Bloqueia",
      render: (d) => (d.bloqueia_veículo ? <Selo texto="Bloqueia" tom="vermelho" /> : "-"),
    },
    {
      chave: "ações", rotulo: "Ações",
      render: (d) => (
        <Acoes
          acoes={[
            { rotulo: "Ver veículo", aoClicar: () => navegar(`/frotas/veiculos/${d.id_veiculo}`) },
            ...(podeGerenciar
              ? [
                  { rotulo: "Editar documento", aoClicar: () => abrirEdicao(d) },
                  { rotulo: "Excluir documento", perigo: true, aoClicar: () => excluir(d) },
                ]
              : []),
          ]}
        />
      ),
    },
  ];

  return (
    <PaginaLista
      trilha={[{ rotulo: "Frotas" }, { rotulo: "Documentos" }]}
      titulo="Documentos"
      descricao="Gerencie todos os documentos da frota em um único lugar."
      acao={
        podeGerenciar && (
          <button className="botao botao--primario" onClick={() => navegar("/frotas/documentos/novo")}>
            <Icone nome="mais" tamanho={16} /> Novo documento
          </button>
        )
      }
      kpis={
        resumo && [
          { icone: "nav-gestao", rotulo: "Total de documentos", valor: resumo.total, nota: "Todos", tom: "neutro" },
          { icone: "calendar", rotulo: "Vencendo em breve", valor: resumo.vencendo, nota: "Próximos 30 dias", tom: "ambar" },
          { icone: "alert-triangle", rotulo: "Vencidos", valor: resumo.vencidos, nota: "Requerem atenção", tom: "vermelho" },
          { icone: "checklist", rotulo: "Categorias", valor: resumo.categorias, nota: "Tipos de documento", tom: "roxo" },
        ]
      }
      lista={lista}
      colunas={colunas}
      chaveDe={(d) => d.id_documento}
      unidade="documentos"
      vazio="Nenhum documento encontrado com esses filtros."
      filtros={
        <>
          <Texto rotulo="Buscar" id="busca" placeholder="Placa, tipo ou número"
                 value={lista.filtros.busca}
                 onChange={(e) => lista.alterarFiltro("busca", e.target.value)} />
          <Selecao rotulo="Veículo" id="veículo" vazio="Todos os veículos"
                   opcoes={veículos.map((v) => ({ valor: v.id_veiculo, rotulo: `${v.placa} - ${v.modelo}` }))}
                   value={lista.filtros.veiculo}
                   onChange={(e) => lista.alterarFiltro("veiculo", e.target.value)} />
          <Selecao rotulo="Categoria" id="categoria" vazio="Todas as categorias"
                   opcoes={CATEGORIAS.map((c) => ({ valor: c, rotulo: c }))}
                   value={lista.filtros.categoria}
                   onChange={(e) => lista.alterarFiltro("categoria", e.target.value)} />
          <Selecao rotulo="Situação" id="status" vazio="Todas" opcoes={SITUACOES}
                   value={lista.filtros.status}
                   onChange={(e) => lista.alterarFiltro("status", e.target.value)} />
        </>
      }
    >
      {editando && (
        <Modal
          titulo={editando === "novo" ? "Novo documento" : "Editar documento"}
          largura={720}
          aoFechar={() => setEditando(null)}
          rodape={
            <>
              <button className="botao" onClick={() => setEditando(null)}>Cancelar</button>
              <button className="botao botao--primario" form="form-doc" disabled={salvando}>
                <Icone nome="salvar" tamanho={16} monocromatico /> {salvando ? "Salvando..." : "Salvar documento"}
              </button>
            </>
          }
        >
          {erroForm && <div className="login__erro">{erroForm}</div>}
          <form id="form-doc" className="formulario-grade" onSubmit={salvar}>
            <Selecao rotulo="Veículo *" id="id_veículo" required vazio="Selecione"
                     opcoes={veículos.map((v) => ({
                       valor: v.id_veiculo, rotulo: `${v.placa} - ${v.marca} ${v.modelo}`,
                     }))}
                     {...campo("id_veículo")} />
            <Texto rotulo="Tipo de documento *" id="tipo_documento" required
                   placeholder="Ex.: CRLV" {...campo("tipo_documento")} />
            <Selecao rotulo="Categoria" id="categoria"
                     opcoes={CATEGORIAS.map((c) => ({ valor: c, rotulo: c }))}
                     {...campo("categoria")} />
            <Texto rotulo="Nº / Referência" id="numero_documento" {...campo("numero_documento")}  placeholder="Ex.: 01567890123"/>
            <Data rotulo="Data de emissão" id="data_emissao" {...campo("data_emissao")} />
            <Data rotulo="Data de vencimento" id="data_validade" {...campo("data_validade")} />
            <Selecao rotulo="Responsável" id="id_responsavel" vazio="Sem responsável"
                     opcoes={servidores.map((s) => ({ valor: s.id_servidor, rotulo: s.nome }))}
                     {...campo("id_responsavel")} />
            <Selecao rotulo="Situação" id="status" opcoes={SITUACOES} {...campo("status")} />
            <Area rotulo="Observações" id="observacoes" largo {...campo("observacoes")}  placeholder="Ex.: Renovação anual do licenciamento"/>
          </form>
        </Modal>
      )}
    </PaginaLista>
  );
}
