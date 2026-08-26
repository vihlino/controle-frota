/**
 * Veiculos.jsx - O cadastro da frota, nucleo do modulo.
 *
 * Escrita a mao (e nao pela fabrica criarPagina) por causa do menu de acoes,
 * que leva para detalhes, historico, documentos e QR Code do veiculo.
 *
 * As situacoes seguem as cores definidas: Regular (verde), Em manutencao
 * (amarelo), Indisponivel (vermelho).
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PaginaLista from "../../components/PaginaLista.jsx";
import Icone from "../../components/Icone.jsx";
import Selo from "../../components/Selo.jsx";
import Acoes from "../../components/Acoes.jsx";
import Modal from "../../components/Modal.jsx";
import { Texto, Selecao, Area } from "../../components/Campos.jsx";
import { useLista } from "../../components/useLista.js";
import { api } from "../../lib/api.js";
import { numero } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";

const SITUACOES = [
  { valor: "DISPONIVEL", rotulo: "Regular" },
  { valor: "EM_USO", rotulo: "Em uso" },
  { valor: "EM_MANUTENCAO", rotulo: "Em manutencao" },
  { valor: "INATIVO", rotulo: "Indisponivel" },
];
const TIPOS = ["AUTOMOVEL", "CAMINHONETE", "FURGAO", "MOTOCICLETA", "CAMINHAO", "ONIBUS", "MAQUINA"];
const COMBUSTIVEIS = ["FLEX", "GASOLINA", "ETANOL", "DIESEL", "GNV", "ELETRICO", "HIBRIDO"];

const VAZIO = {
  placa: "", marca: "", modelo: "", ano_fabricacao: "", ano_modelo: "", cor: "",
  tipo_veiculo: "AUTOMOVEL", renavam: "", chassi: "", tipo_combustivel: "FLEX",
  capacidade: "", quilometragem_atual: 0, id_setor: "", observacoes: "",
  status: "DISPONIVEL",
};

export default function Veiculos() {
  const navegar = useNavigate();
  const { podeVer } = useSessao();
  const lista = useLista("frotas/veiculos", { busca: "", setor: "", status: "" });
  const [setores, setSetores] = useState([]);
  const [editando, setEditando] = useState(null);
  const [formulario, setFormulario] = useState(VAZIO);
  const [erroForm, setErroForm] = useState("");
  const [salvando, setSalvando] = useState(false);

  const podeGerenciar = podeVer("FROTAS_GERENCIAR_VEICULOS");

  useEffect(() => {
    api("/setores").then(setSetores).catch(() => {});
  }, []);

  function abrirNovo() {
    setFormulario(VAZIO);
    setErroForm("");
    setEditando("novo");
  }

  function abrirEdicao(v) {
    setFormulario({ ...VAZIO, ...v, id_setor: v.id_setor });
    setErroForm("");
    setEditando(v.id_veiculo);
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErroForm("");
    try {
      const corpo = {
        ...formulario,
        ano_fabricacao: Number(formulario.ano_fabricacao),
        ano_modelo: Number(formulario.ano_modelo),
        quilometragem_atual: Number(formulario.quilometragem_atual) || 0,
        id_setor: Number(formulario.id_setor),
      };
      if (editando === "novo") {
        await api("/frotas/veiculos", { method: "POST", body: corpo });
      } else {
        await api(`/frotas/veiculos/${editando}`, { method: "PUT", body: corpo });
      }
      setEditando(null);
      lista.recarregar();
    } catch (e) {
      setErroForm(e.message);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(v) {
    if (!confirm(`Excluir o veiculo ${v.placa}? Esta acao nao pode ser desfeita.`)) return;
    try {
      await api(`/frotas/veiculos/${v.id_veiculo}`, { method: "DELETE" });
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
    { chave: "placa", rotulo: "Placa", ordenavel: true },
    { chave: "marca", rotulo: "Marca", ordenavel: true },
    { chave: "modelo", rotulo: "Modelo", ordenavel: true },
    { chave: "renavam", rotulo: "Renavam" },
    { chave: "chassi", rotulo: "Chassi" },
    { chave: "ano_modelo", rotulo: "Ano modelo", ordenavel: true },
    { chave: "ano_fabricacao", rotulo: "Ano fabricacao" },
    { chave: "setor", rotulo: "Setor", ordenavel: true },
    {
      chave: "quilometragem_atual", rotulo: "KM atual",
      render: (v) => `${numero(v.quilometragem_atual)} km`,
    },
    { chave: "status", rotulo: "Situacao", ordenavel: true, render: (v) => <Selo valor={v.status} /> },
    {
      chave: "qrcode", rotulo: "QR Code",
      render: (v) => (
        <button
          className="botao-icone"
          title="QR Code do veiculo"
          onClick={() => navegar(`/frotas/veiculos/${v.id_veiculo}/qrcode`)}
        >
          <Icone nome="checklist" tamanho={18} />
        </button>
      ),
    },
    {
      chave: "acoes", rotulo: "Acoes",
      render: (v) => (
        <Acoes
          acoes={[
            { rotulo: "Visualizar detalhes", aoClicar: () => navegar(`/frotas/veiculos/${v.id_veiculo}`) },
            ...(podeGerenciar ? [{ rotulo: "Editar veiculo", aoClicar: () => abrirEdicao(v) }] : []),
            { rotulo: "Historico", aoClicar: () => navegar(`/frotas/checklists?veiculo=${v.id_veiculo}`) },
            { rotulo: "Documentos", aoClicar: () => navegar(`/frotas/documentos?veiculo=${v.id_veiculo}`) },
            { rotulo: "QR Code", aoClicar: () => navegar(`/frotas/veiculos/${v.id_veiculo}/qrcode`) },
            ...(podeGerenciar
              ? [{ rotulo: "Excluir veiculo", perigo: true, aoClicar: () => excluir(v) }]
              : []),
          ]}
        />
      ),
    },
  ];

  return (
    <PaginaLista
      trilha={[{ rotulo: "Frotas" }, { rotulo: "Veiculos" }]}
      titulo="Veiculos"
      descricao="Gerencie os veiculos da frota."
      acao={
        podeGerenciar && (
          <button className="botao botao--primario" onClick={abrirNovo}>
            <Icone nome="minus" tamanho={16} /> Novo veiculo
          </button>
        )
      }
      lista={lista}
      colunas={colunas}
      chaveDe={(v) => v.id_veiculo}
      unidade="veiculos"
      vazio="Nenhum veiculo encontrado com esses filtros."
      filtros={
        <>
          <Texto
            rotulo="Buscar" id="busca"
            placeholder="Placa, marca, modelo, renavam ou chassi"
            value={lista.filtros.busca}
            onChange={(e) => lista.alterarFiltro("busca", e.target.value)}
          />
          <Selecao
            rotulo="Setor" id="setor" vazio="Todos"
            opcoes={setores.map((s) => ({ valor: s.id_setor, rotulo: s.nome }))}
            value={lista.filtros.setor}
            onChange={(e) => lista.alterarFiltro("setor", e.target.value)}
          />
          <Selecao
            rotulo="Situacao" id="situacao" vazio="Todas"
            opcoes={SITUACOES}
            value={lista.filtros.status}
            onChange={(e) => lista.alterarFiltro("status", e.target.value)}
          />
        </>
      }
    >
      {editando && (
        <Modal
          titulo={editando === "novo" ? "Novo veiculo" : "Editar veiculo"}
          legenda="Os campos marcados sao obrigatorios."
          largura={760}
          aoFechar={() => setEditando(null)}
          rodape={
            <>
              <button className="botao" onClick={() => setEditando(null)}>Cancelar</button>
              <button className="botao botao--primario" form="form-veiculo" disabled={salvando}>
                {salvando ? "Salvando..." : "Salvar veiculo"}
              </button>
            </>
          }
        >
          {erroForm && <div className="login__erro">{erroForm}</div>}
          <form id="form-veiculo" className="formulario-grade" onSubmit={salvar}>
            <Texto rotulo="Placa *" id="placa" required maxLength={10} {...campo("placa")} />
            <Texto rotulo="Marca *" id="marca" required {...campo("marca")} />
            <Texto rotulo="Modelo *" id="modelo" required {...campo("modelo")} />
            <Texto rotulo="Renavam" id="renavam" {...campo("renavam")} />
            <Texto rotulo="Chassi" id="chassi" {...campo("chassi")} />
            <Texto rotulo="Ano de fabricacao *" id="ano_fabricacao" type="number"
                   min="1900" max="2100" required {...campo("ano_fabricacao")} />
            <Texto rotulo="Ano modelo *" id="ano_modelo" type="number"
                   min="1900" max="2100" required {...campo("ano_modelo")} />
            <Texto rotulo="Cor *" id="cor" required {...campo("cor")} />
            <Selecao rotulo="Tipo de veiculo *" id="tipo_veiculo" required
                     opcoes={TIPOS.map((t) => ({ valor: t, rotulo: t }))} {...campo("tipo_veiculo")} />
            <Selecao rotulo="Combustivel *" id="tipo_combustivel" required
                     opcoes={COMBUSTIVEIS.map((c) => ({ valor: c, rotulo: c }))}
                     {...campo("tipo_combustivel")} />
            <Texto rotulo="Capacidade" id="capacidade" placeholder="Ex.: 5 lugares"
                   {...campo("capacidade")} />
            <Texto rotulo="Quilometragem atual" id="quilometragem_atual" type="number" min="0"
                   {...campo("quilometragem_atual")} />
            <Selecao rotulo="Setor *" id="id_setor" required vazio="Selecione"
                     opcoes={setores.map((s) => ({ valor: s.id_setor, rotulo: s.nome }))}
                     {...campo("id_setor")} />
            <Selecao rotulo="Situacao" id="status" opcoes={SITUACOES} {...campo("status")} />
            <Area rotulo="Observacoes" id="observacoes" largo {...campo("observacoes")} />
          </form>
        </Modal>
      )}
    </PaginaLista>
  );
}
