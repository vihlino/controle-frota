/**
 * Documentos.jsx - Documentos dos veiculos e seus vencimentos.
 *
 * Cada linha mostra quantos dias faltam para vencer, com cor: verde acima de
 * 30 dias, laranja dentro dos 30 e vermelho quando ja venceu.
 *
 * Um documento pode ser marcado para BLOQUEAR o veiculo quando vencer.
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
  { valor: "VALIDO", rotulo: "Valido" },
  { valor: "VENCENDO", rotulo: "Vencendo" },
  { valor: "VENCIDO", rotulo: "Vencido" },
  { valor: "INATIVO", rotulo: "Inativo" },
];
const CATEGORIAS = ["Licenciamento", "Seguro", "Imposto", "Inspecao", "Manual", "Outro"];

const VAZIO = {
  id_veiculo: "", tipo_documento: "", numero_documento: "", categoria: "Licenciamento",
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
  const [parametros] = useSearchParams();
  const lista = useLista("frotas/documentos", {
    busca: "", veiculo: parametros.get("veiculo") || "", status: "", categoria: "",
  });
  const [veiculos, setVeiculos] = useState([]);
  const [servidores, setServidores] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [editando, setEditando] = useState(null);
  const [formulario, setFormulario] = useState(VAZIO);
  const [erroForm, setErroForm] = useState("");
  const [salvando, setSalvando] = useState(false);

  const podeGerenciar = podeVer("FROTAS_GERENCIAR_DOCUMENTOS");

  useEffect(() => {
    api("/frotas/veiculos/opcoes").then(setVeiculos).catch(() => {});
    api("/admin/servidores/opcoes").then(setServidores).catch(() => {});
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
        id_veiculo: Number(formulario.id_veiculo),
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
    if (!confirm(`Excluir o documento ${d.tipo_documento} do veiculo ${d.placa}?`)) return;
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
      chave: "placa", rotulo: "Veiculo", ordenavel: true,
      render: (d) => (
        <span className="celula-dupla">
          <strong>{d.placa}</strong>
          <span>{`${d.marca} ${d.modelo}`}</span>
        </span>
      ),
    },
    { chave: "numero_documento", rotulo: "No / Referencia", render: (d) => d.numero_documento || "-" },
    { chave: "data_emissao", rotulo: "Emissao", ordenavel: true, render: (d) => data(d.data_emissao) },
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
    { chave: "responsavel", rotulo: "Responsavel", render: (d) => d.responsavel || "-" },
    { chave: "status", rotulo: "Situacao", ordenavel: true, render: (d) => <Selo valor={d.status} /> },
    {
      chave: "bloqueia_veiculo", rotulo: "Bloqueia",
      render: (d) => (d.bloqueia_veiculo ? <Selo texto="Bloqueia" tom="vermelho" /> : "-"),
    },
    {
      chave: "acoes", rotulo: "Acoes",
      render: (d) => (
        <Acoes
          acoes={[
            { rotulo: "Ver veiculo", aoClicar: () => navegar(`/frotas/veiculos/${d.id_veiculo}`) },
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
      descricao="Gerencie todos os documentos da frota em um unico lugar."
      acao={
        podeGerenciar && (
          <button className="botao botao--primario" onClick={abrirNovo}>
            <Icone nome="minus" tamanho={16} /> Novo documento
          </button>
        )
      }
      kpis={
        resumo && [
          { icone: "nav-gestao", rotulo: "Total de documentos", valor: resumo.total, nota: "Todos", tom: "azul" },
          { icone: "calendar", rotulo: "Vencendo em breve", valor: resumo.vencendo, nota: "Proximos 30 dias", tom: "laranja" },
          { icone: "alert-triangle", rotulo: "Vencidos", valor: resumo.vencidos, nota: "Requerem atencao", tom: "vermelho" },
          { icone: "checklist", rotulo: "Categorias", valor: resumo.categorias, nota: "Tipos de documento", tom: "verde" },
        ]
      }
      lista={lista}
      colunas={colunas}
      chaveDe={(d) => d.id_documento}
      unidade="documentos"
      vazio="Nenhum documento encontrado com esses filtros."
      filtros={
        <>
          <Texto rotulo="Buscar" id="busca" placeholder="Placa, tipo ou numero"
                 value={lista.filtros.busca}
                 onChange={(e) => lista.alterarFiltro("busca", e.target.value)} />
          <Selecao rotulo="Veiculo" id="veiculo" vazio="Todos os veiculos"
                   opcoes={veiculos.map((v) => ({ valor: v.id_veiculo, rotulo: `${v.placa} - ${v.modelo}` }))}
                   value={lista.filtros.veiculo}
                   onChange={(e) => lista.alterarFiltro("veiculo", e.target.value)} />
          <Selecao rotulo="Categoria" id="categoria" vazio="Todas as categorias"
                   opcoes={CATEGORIAS.map((c) => ({ valor: c, rotulo: c }))}
                   value={lista.filtros.categoria}
                   onChange={(e) => lista.alterarFiltro("categoria", e.target.value)} />
          <Selecao rotulo="Situacao" id="status" vazio="Todas" opcoes={SITUACOES}
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
                {salvando ? "Salvando..." : "Salvar documento"}
              </button>
            </>
          }
        >
          {erroForm && <div className="login__erro">{erroForm}</div>}
          <form id="form-doc" className="formulario-grade" onSubmit={salvar}>
            <Selecao rotulo="Veiculo *" id="id_veiculo" required vazio="Selecione"
                     opcoes={veiculos.map((v) => ({
                       valor: v.id_veiculo, rotulo: `${v.placa} - ${v.marca} ${v.modelo}`,
                     }))}
                     {...campo("id_veiculo")} />
            <Texto rotulo="Tipo de documento *" id="tipo_documento" required
                   placeholder="Ex.: CRLV" {...campo("tipo_documento")} />
            <Selecao rotulo="Categoria" id="categoria"
                     opcoes={CATEGORIAS.map((c) => ({ valor: c, rotulo: c }))}
                     {...campo("categoria")} />
            <Texto rotulo="No / Referencia" id="numero_documento" {...campo("numero_documento")} />
            <Data rotulo="Data de emissao" id="data_emissao" {...campo("data_emissao")} />
            <Data rotulo="Data de vencimento" id="data_validade" {...campo("data_validade")} />
            <Selecao rotulo="Responsavel" id="id_responsavel" vazio="Sem responsavel"
                     opcoes={servidores.map((s) => ({ valor: s.id_servidor, rotulo: s.nome }))}
                     {...campo("id_responsavel")} />
            <Selecao rotulo="Situacao" id="status" opcoes={SITUACOES} {...campo("status")} />
            <div className="campo campo--marcavel" data-largo="sim">
              <label>
                <input
                  type="checkbox"
                  checked={!!formulario.bloqueia_veiculo}
                  onChange={(e) =>
                    setFormulario((f) => ({ ...f, bloqueia_veiculo: e.target.checked }))
                  }
                />
                Este documento bloqueia o uso do veiculo quando estiver vencido
              </label>
            </div>
            <Area rotulo="Observacoes" id="observacoes" largo {...campo("observacoes")} />
          </form>
        </Modal>
      )}
    </PaginaLista>
  );
}
