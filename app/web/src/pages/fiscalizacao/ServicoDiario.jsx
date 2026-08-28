/**
 * ServiçoDiário.jsx - A escala diaria da fiscalização.
 * Cada linha e um turno, com o coordenador responsavel, e mostra quantas
 * equipes e quantas ocorrências aquele serviço teve.
 */
import { useEffect, useState } from "react";
import PaginaLista from "../../components/PaginaLista.jsx";
import Icone from "../../components/Icone.jsx";
import Selo from "../../components/Selo.jsx";
import Modal from "../../components/Modal.jsx";
import { Selecao, Data, Texto } from "../../components/Campos.jsx";
import { useLista } from "../../components/useLista.js";
import { api } from "../../lib/api.js";
import { data, hora, numero } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";

const TURNOS = [
  { valor: "MATUTINO", rotulo: "Matutino" },
  { valor: "VESPERTINO", rotulo: "Vespertino" },
  { valor: "NOTURNO", rotulo: "Noturno" },
];
const SITUACOES = [
  { valor: "ABERTO", rotulo: "Aberto" },
  { valor: "EM_ANDAMENTO", rotulo: "Em andamento" },
  { valor: "ENCERRADO", rotulo: "Encerrado" },
];

export default function ServiçoDiário() {
  const { podeVer, usuario } = useSessao();
  const lista = useLista("fiscalizacao/servico-diario", {
    busca: "", status: "", turno: "", dataDe: "", dataAte: "",
  });
  const [servidores, setServidores] = useState([]);
  const [criando, setCriando] = useState(false);
  const [formulario, setFormulario] = useState({
    data: "", turno: "MATUTINO", id_coordenador: "", hora_inicio: "07:00",
  });
  const [erroForm, setErroForm] = useState("");
  const [salvando, setSalvando] = useState(false);

  const podeGerenciar = podeVer("FISCALIZACAO_GERENCIAR_SERVICO");

  useEffect(() => {
    api("/admin/servidores/opcoes").then(setServidores).catch(() => {});
  }, []);

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErroForm("");
    try {
      await api("/fiscalizacao/servico-diario", {
        method: "POST",
        body: {
          ...formulario,
          id_coordenador: Number(formulario.id_coordenador),
          criado_por: usuario.id_usuario,
          status: "ABERTO",
        },
      });
      setCriando(false);
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
    { chave: "data", rotulo: "Data", ordenavel: true, render: (s) => data(s.data) },
    { chave: "turno", rotulo: "Turno", ordenavel: true },
    { chave: "coordenador", rotulo: "Coordenador", ordenavel: true },
    { chave: "hora_inicio", rotulo: "Inicio", render: (s) => hora(s.hora_inicio) },
    { chave: "hora_encerramento", rotulo: "Encerramento", render: (s) => hora(s.hora_encerramento) },
    { chave: "equipes", rotulo: "Equipes", render: (s) => numero(s.equipes) },
    { chave: "ocorrencias", rotulo: "Ocorrências", render: (s) => numero(s.ocorrencias) },
    { chave: "status", rotulo: "Situação", ordenavel: true, render: (s) => <Selo valor={s.status} /> },
  ];

  return (
    <PaginaLista
      trilha={[{ rotulo: "Fiscalização" }, { rotulo: "Serviço Diário" }]}
      titulo="Serviço Diário"
      descricao="Escalas diarias da fiscalização, com equipes e ocorrências do turno."
      acao={
        podeGerenciar && (
          <button className="botao botao--primario" onClick={() => setCriando(true)}>
            <Icone nome="calendar" tamanho={16} /> Novo serviço diário
          </button>
        )
      }
      lista={lista}
      colunas={colunas}
      chaveDe={(s) => s.id_servico_diario}
      unidade="serviços"
      vazio="Nenhum serviço diário registrado."
      filtros={
        <>
          <Texto rotulo="Buscar" id="busca" placeholder="Coordenador ou turno"
                 value={lista.filtros.busca}
                 onChange={(e) => lista.alterarFiltro("busca", e.target.value)} />
          <Selecao rotulo="Turno" id="turno" vazio="Todos" opcoes={TURNOS}
                   value={lista.filtros.turno}
                   onChange={(e) => lista.alterarFiltro("turno", e.target.value)} />
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
      {criando && (
        <Modal
          titulo="Novo serviço diário"
          aoFechar={() => setCriando(false)}
          rodape={
            <>
              <button className="botao" onClick={() => setCriando(false)}>Cancelar</button>
              <button className="botao botao--primario" form="form-serviço" disabled={salvando}>
                {salvando ? "Salvando..." : "Criar serviço"}
              </button>
            </>
          }
        >
          {erroForm && <div className="login__erro">{erroForm}</div>}
          <form id="form-serviço" className="formulario-grade" onSubmit={salvar}>
            <Data rotulo="Data *" id="data" required {...campo("data")} />
            <Selecao rotulo="Turno *" id="turno" required opcoes={TURNOS} {...campo("turno")} />
            <Selecao rotulo="Coordenador *" id="id_coordenador" required vazio="Selecione"
                     opcoes={servidores.map((s) => ({ valor: s.id_servidor, rotulo: s.nome }))}
                     {...campo("id_coordenador")} />
            <Texto rotulo="Hora de inicio" id="hora_inicio" type="time" {...campo("hora_inicio")} />
          </form>
        </Modal>
      )}
    </PaginaLista>
  );
}
