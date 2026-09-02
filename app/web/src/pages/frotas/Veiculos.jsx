/**
 * Veículos.jsx - O cadastro da frota, nucleo do módulo.
 *
 * Escrita a mao (e nao pela fabrica criarPagina) por causa do menu de ações,
 * que leva para detalhes, historico, documentos e QR Code do veículo.
 *
 * As situações seguem as cores definidas: Regular (verde), Em manutenção
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
  { valor: "EM_MANUTENCAO", rotulo: "Em manutenção" },
  { valor: "INATIVO", rotulo: "Indisponivel" },
];
const TIPOS = [
  { valor: "AUTOMOVEL", rotulo: "Carro" },
  { valor: "MOTOCICLETA", rotulo: "Motocicleta" },
  { valor: "CAMINHONETE", rotulo: "Caminhonete" },
  { valor: "CAMINHAO", rotulo: "Caminhão" },
];
const COMBUSTIVEIS = ["FLEX", "GASOLINA", "ETANOL", "DIESEL", "GNV", "ELETRICO", "HIBRIDO"];

const VAZIO = {
  placa: "", marca: "", modelo: "", ano_fabricacao: "", ano_modelo: "", cor: "",
  tipo_veiculo: "AUTOMOVEL", renavam: "", chassi: "", tipo_combustivel: "FLEX",
  capacidade: "", quilometragem_atual: 0, id_setor: "", observacoes: "",
  status: "DISPONIVEL",
};

export default function Veículos() {
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
    if (!confirm(`Excluir o veículo ${v.placa}? Esta acao nao pode ser desfeita.`)) return;
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
    { chave: "ano_fabricacao", rotulo: "Ano fabricação" },
    { chave: "vinculo", rotulo: "Vínculo", render: (v) => v.vinculo || "Próprio" },
    { chave: "setor", rotulo: "Setor", ordenavel: true },
    { chave: "status", rotulo: "Situação", ordenavel: true, render: (v) => <Selo valor={v.status} /> },
    {
      chave: "qrcode", rotulo: "QR Code",
      render: (v) => (
        <button
          className="botao-icone"
          title="QR Code do veículo"
          onClick={() => navegar(`/frotas/veiculos/${v.id_veiculo}/qrcode`)}
        >
          <Icone nome="checklist" tamanho={18} />
        </button>
      ),
    },
    {
      chave: "ações", rotulo: "Ações",
      render: (v) => (
        <Acoes
          ações={[
            { rotulo: "Visualizar detalhes", aoClicar: () => navegar(`/frotas/veiculos/${v.id_veiculo}`) },
            ...(podeGerenciar ? [{ rotulo: "Editar veículo", aoClicar: () => abrirEdicao(v) }] : []),
            { rotulo: "Historico", aoClicar: () => navegar(`/frotas/checklists?veículo=${v.id_veiculo}`) },
            { rotulo: "Documentos", aoClicar: () => navegar(`/frotas/documentos?veículo=${v.id_veiculo}`) },
            { rotulo: "QR Code", aoClicar: () => navegar(`/frotas/veiculos/${v.id_veiculo}/qrcode`) },
            ...(podeGerenciar
              ? [{ rotulo: "Excluir veículo", perigo: true, aoClicar: () => excluir(v) }]
              : []),
          ]}
        />
      ),
    },
  ];

  return (
    <PaginaLista
      trilha={[{ rotulo: "Frotas" }, { rotulo: "Veículos" }]}
      titulo="Veículos"
      descricao="Gerencie os veículos da frota."
      acao={
        podeGerenciar && (
          <button className="botao botao--primario" onClick={abrirNovo}>
            <Icone nome="mais" tamanho={16} /> Novo veículo
          </button>
        )
      }
      lista={lista}
      colunas={colunas}
      chaveDe={(v) => v.id_veiculo}
      unidade="veículos"
      vazio="Nenhum veículo encontrado com esses filtros."
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
            rotulo="Situação" id="situação" vazio="Todas"
            opcoes={SITUACOES}
            value={lista.filtros.status}
            onChange={(e) => lista.alterarFiltro("status", e.target.value)}
          />
        </>
      }
    >
      {editando && (
        <Modal
          titulo={editando === "novo" ? "Novo veículo" : "Editar veículo"}
          legenda="Os campos marcados são obrigatórios."
          largura={760}
          aoFechar={() => setEditando(null)}
          rodape={
            <>
              <button className="botao" onClick={() => setEditando(null)}>Cancelar</button>
              <button className="botao botao--primario" form="form-veículo" disabled={salvando}>
                {salvando ? "Salvando..." : "Salvar veículo"}
              </button>
            </>
          }
        >
          {erroForm && <div className="login__erro">{erroForm}</div>}
          <form id="form-veículo" className="formulario-grade" onSubmit={salvar}>
            <Texto rotulo="Placa *" id="placa" required maxLength={10} {...campo("placa")}  placeholder="Ex.: ABC-1D23"/>
            <Texto rotulo="Marca *" id="marca" required {...campo("marca")}  placeholder="Ex.: Chevrolet"/>
            <Texto rotulo="Modelo *" id="modelo" required {...campo("modelo")}  placeholder="Ex.: S10 LS 2.8"/>
            <Texto rotulo="Renavam" id="renavam" {...campo("renavam")}  placeholder="Ex.: 01234567890"/>
            <Texto rotulo="Chassi" id="chassi" {...campo("chassi")}  placeholder="Ex.: 9BG1489NK0JC123456"/>
            <Texto rotulo="Ano de fabricação *" id="ano_fabricacao" type="number"
                   min="1900" max="2100" required {...campo("ano_fabricacao")}  placeholder="Ex.: 2022"/>
            <Texto rotulo="Ano modelo *" id="ano_modelo" type="number"
                   min="1900" max="2100" required {...campo("ano_modelo")}  placeholder="Ex.: 2022"/>
            <Texto rotulo="Cor *" id="cor" required {...campo("cor")}  placeholder="Ex.: Branco"/>
            <Selecao rotulo="Tipo de veículo *" id="tipo_veiculo" required
                     opcoes={TIPOS} {...campo("tipo_veiculo")} />
            <Selecao rotulo="Combustível *" id="tipo_combustivel" required
                     opcoes={COMBUSTIVEIS.map((c) => ({ valor: c, rotulo: c }))}
                     {...campo("tipo_combustivel")} />
            <Texto rotulo="Capacidade" id="capacidade" placeholder="Ex.: 5 lugares"
                   {...campo("capacidade")} />
            <Texto rotulo="Quilometragem atual" id="quilometragem_atual" type="number" min="0"
                   {...campo("quilometragem_atual")}  placeholder="Ex.: 45230"/>
            <Selecao rotulo="Setor *" id="id_setor" required vazio="Selecione"
                     opcoes={setores.map((s) => ({ valor: s.id_setor, rotulo: s.nome }))}
                     {...campo("id_setor")} />
            <Selecao rotulo="Situação" id="status" opcoes={SITUACOES} {...campo("status")} />
            <Area rotulo="Observações" id="observacoes" largo {...campo("observacoes")}  placeholder="Ex.: Veículo com adesivagem da CMTT"/>
          </form>
        </Modal>
      )}
    </PaginaLista>
  );
}
