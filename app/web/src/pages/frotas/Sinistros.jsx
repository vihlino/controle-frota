/**
 * Sinistros.jsx - Ocorrências envolvendo veículos da frota.
 *
 * Registra tipo, local, condutor, envolvimento de terceiros e numero do B.O.
 * Depois do registro, a situação do veículo pode ser mudada na tela de
 * Veículos, se ele ficar indisponivel.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PaginaLista from "../../components/PaginaLista.jsx";
import Icone from "../../components/Icone.jsx";
import Selo from "../../components/Selo.jsx";
import Acoes from "../../components/Acoes.jsx";
import Modal from "../../components/Modal.jsx";
import { Texto, Selecao, Data, Area } from "../../components/Campos.jsx";
import { useLista } from "../../components/useLista.js";
import { api } from "../../lib/api.js";
import { data, hora, rotulo, simNao } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";

const TIPOS = [
  { valor: "COLISAO", rotulo: "Colisao" },
  { valor: "DANO_MATERIAL", rotulo: "Dano material" },
  { valor: "ROUBO_FURTO", rotulo: "Roubo / Furto" },
  { valor: "INCENDIO", rotulo: "Incendio" },
  { valor: "OUTRO", rotulo: "Outro" },
];
const SITUACOES = [
  { valor: "ABERTO", rotulo: "Aberto" },
  { valor: "EM_ANALISE", rotulo: "Em analise" },
  { valor: "RESOLVIDO", rotulo: "Resolvido" },
  { valor: "ENCERRADO", rotulo: "Encerrado" },
];
const TOM_TIPO = {
  COLISAO: "vermelho", DANO_MATERIAL: "amarelo",
  ROUBO_FURTO: "azul", INCENDIO: "laranja", OUTRO: "verde",
};

const VAZIO = {
  id_veículo: "", id_servidor: "", data: "", hora: "", local: "", tipo: "COLISAO",
  descricao: "", bo: "", houve_terceiros: false, status: "ABERTO", observações: "",
};

export default function Sinistros() {
  const navegar = useNavigate();
  const { podeVer, usuario } = useSessao();
  const lista = useLista("frotas/sinistros", {
    busca: "", veículo: "", status: "", tipo: "", dataDe: "", dataAte: "",
  });
  const [veículos, setVeículos] = useState([]);
  const [servidores, setServidores] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [registrando, setRegistrando] = useState(false);
  const [formulario, setFormulario] = useState(VAZIO);
  const [erroForm, setErroForm] = useState("");
  const [salvando, setSalvando] = useState(false);

  const podeGerenciar = podeVer("FROTAS_GERENCIAR_SINISTROS");

  useEffect(() => {
    api("/frotas/veiculos/opcoes").then(setVeículos).catch(() => {});
    api("/admin/servidores/opcoes").then(setServidores).catch(() => {});
  }, []);

  useEffect(() => {
    api("/frotas/sinistros?porPagina=200").then((r) => {
      const itens = r.itens;
      setResumo({
        total: r.total,
        andamento: itens.filter((s) => ["ABERTO", "EM_ANALISE"].includes(s.status)).length,
        resolvidos: itens.filter((s) => s.status === "RESOLVIDO").length,
        encerrados: itens.filter((s) => s.status === "ENCERRADO").length,
      });
    }).catch(() => {});
  }, [lista.resultado]);

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErroForm("");
    try {
      await api("/frotas/sinistros", {
        method: "POST",
        body: {
          ...formulario,
          id_veiculo: Number(formulario.id_veículo),
          id_servidor: Number(formulario.id_servidor),
          id_responsavel: usuario.id_usuario,
          houve_terceiros: !!formulario.houve_terceiros,
        },
      });
      setRegistrando(false);
      setFormulario(VAZIO);
      lista.recarregar();
    } catch (e) {
      setErroForm(e.message);
    } finally {
      setSalvando(false);
    }
  }

  const campo = (nome) => ({
    value: formulario[nome] ?? "",
    onChange: (e) => setFormulario((f) => ({ ...f, [nome]: e.target.value })),
  });

  const colunas = [
    { chave: "numero", rotulo: "No do sinistro", ordenavel: true, render: (s) => s.numero || "-" },
    {
      chave: "data", rotulo: "Data / Hora", ordenavel: true,
      render: (s) => (
        <span className="celula-dupla">
          <strong>{data(s.data)}</strong>
          <span>{hora(s.hora)}</span>
        </span>
      ),
    },
    {
      chave: "placa", rotulo: "Veículo", ordenavel: true,
      render: (s) => (
        <span className="celula-dupla">
          <strong>{s.placa}</strong>
          <span>{`${s.marca} ${s.modelo}`}</span>
        </span>
      ),
    },
    {
      chave: "tipo", rotulo: "Tipo de sinistro", ordenavel: true,
      render: (s) => <Selo texto={rotulo("tipoSinistro", s.tipo)} tom={TOM_TIPO[s.tipo]} />,
    },
    { chave: "local", rotulo: "Local" },
    {
      chave: "condutor", rotulo: "Condutor",
      render: (s) => (
        <span className="celula-dupla">
          <strong>{s.condutor}</strong>
          <span>Responsavel: {s.responsavel}</span>
        </span>
      ),
    },
    { chave: "houve_terceiros", rotulo: "Houve terceiros?", render: (s) => simNao(s.houve_terceiros) },
    { chave: "bo", rotulo: "B.O.", render: (s) => s.bo || "-" },
    { chave: "status", rotulo: "Situação", ordenavel: true, render: (s) => <Selo valor={s.status} /> },
    {
      chave: "ações", rotulo: "Ações",
      render: (s) => (
        <Acoes
          ações={[
            { rotulo: "Visualizar detalhes", aoClicar: () => navegar(`/frotas/sinistros/${s.id_sinistro}`) },
            { rotulo: "Ver veículo", aoClicar: () => navegar(`/frotas/veiculos/${s.id_veículo}`) },
          ]}
        />
      ),
    },
  ];

  return (
    <PaginaLista
      trilha={[{ rotulo: "Frotas" }, { rotulo: "Sinistros" }]}
      titulo="Sinistros"
      descricao="Gerencie e acompanhe todos os sinistros registrados na frota."
      acao={
        podeGerenciar && (
          <button className="botao botao--primario" onClick={() => navegar("/frotas/sinistros/novo")}>
            <Icone nome="alert-triangle" tamanho={16} /> Registrar sinistro
          </button>
        )
      }
      kpis={
        resumo && [
          { icone: "alert-triangle", rotulo: "Total de sinistros", valor: resumo.total, nota: "Todos os registros", tom: "azul" },
          { icone: "calendar", rotulo: "Em andamento", valor: resumo.andamento, nota: "Aguardando conclusao", tom: "amarelo" },
          { icone: "checklist", rotulo: "Resolvidos", valor: resumo.resolvidos, nota: "Sinistros finalizados", tom: "verde" },
          { icone: "minus", rotulo: "Cancelados", valor: resumo.encerrados, nota: "Registros cancelados", tom: "vermelho" },
        ]
      }
      lista={lista}
      colunas={colunas}
      chaveDe={(s) => s.id_sinistro}
      unidade="sinistros"
      vazio="Nenhum sinistro encontrado com esses filtros."
      filtros={
        <>
          <Texto rotulo="Buscar" id="busca" placeholder="Placa, local, numero ou B.O."
                 value={lista.filtros.busca}
                 onChange={(e) => lista.alterarFiltro("busca", e.target.value)} />
          <Selecao rotulo="Veículo" id="veículo" vazio="Todos os veículos"
                   opcoes={veículos.map((v) => ({ valor: v.id_veículo, rotulo: `${v.placa} - ${v.modelo}` }))}
                   value={lista.filtros.veículo}
                   onChange={(e) => lista.alterarFiltro("veículo", e.target.value)} />
          <Selecao rotulo="Tipo de sinistro" id="tipo" vazio="Todos" opcoes={TIPOS}
                   value={lista.filtros.tipo}
                   onChange={(e) => lista.alterarFiltro("tipo", e.target.value)} />
          <Selecao rotulo="Situação" id="status" vazio="Todas" opcoes={SITUACOES}
                   value={lista.filtros.status}
                   onChange={(e) => lista.alterarFiltro("status", e.target.value)} />
          <Data rotulo="De" id="dataDe" value={lista.filtros.dataDe}
                onChange={(e) => lista.alterarFiltro("dataDe", e.target.value)} />
          <Data rotulo="Ate" id="dataAte" value={lista.filtros.dataAte}
                onChange={(e) => lista.alterarFiltro("dataAte", e.target.value)} />
        </>
      }
    >
      {registrando && (
        <Modal
          titulo="Registrar sinistro"
          legenda="Quando necessario, mude a situação do veículo depois do registro."
          largura={720}
          aoFechar={() => setRegistrando(false)}
          rodape={
            <>
              <button className="botao" onClick={() => setRegistrando(false)}>Cancelar</button>
              <button className="botao botao--primario" form="form-sinistro" disabled={salvando}>
                {salvando ? "Salvando..." : "Registrar sinistro"}
              </button>
            </>
          }
        >
          {erroForm && <div className="login__erro">{erroForm}</div>}
          <form id="form-sinistro" className="formulario-grade" onSubmit={salvar}>
            <Selecao rotulo="Veículo *" id="id_veículo" required vazio="Selecione"
                     opcoes={veículos.map((v) => ({
                       valor: v.id_veículo, rotulo: `${v.placa} - ${v.marca} ${v.modelo}`,
                     }))}
                     {...campo("id_veículo")} />
            <Selecao rotulo="Condutor *" id="id_servidor" required vazio="Selecione"
                     opcoes={servidores.map((s) => ({ valor: s.id_servidor, rotulo: s.nome }))}
                     {...campo("id_servidor")} />
            <Selecao rotulo="Tipo de sinistro *" id="tipo" required opcoes={TIPOS} {...campo("tipo")} />
            <Data rotulo="Data *" id="data" required {...campo("data")} />
            <Texto rotulo="Hora *" id="hora" type="time" required {...campo("hora")} />
            <Texto rotulo="Numero do B.O." id="bo" {...campo("bo")} />
            <Selecao rotulo="Situação" id="status" opcoes={SITUACOES} {...campo("status")} />
            <Texto rotulo="Local *" id="local" required largo
                   placeholder="Ex.: Av. Brasil, 1250 - Centro" {...campo("local")} />
            <div className="campo campo--marcavel" data-largo="sim">
              <label>
                <input
                  type="checkbox"
                  checked={!!formulario.houve_terceiros}
                  onChange={(e) =>
                    setFormulario((f) => ({ ...f, houve_terceiros: e.target.checked }))
                  }
                />
                Houve envolvimento de terceiros
              </label>
            </div>
            <Area rotulo="Descricao do sinistro *" id="descricao" largo required
                  {...campo("descricao")} />
            <Area rotulo="Observações" id="observações" largo {...campo("observações")} />
          </form>
        </Modal>
      )}
    </PaginaLista>
  );
}
