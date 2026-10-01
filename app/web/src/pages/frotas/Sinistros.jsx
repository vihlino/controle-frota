/**
 * Sinistros.jsx - Ocorrencias envolvendo veiculos da frota.
 *
 * Registra tipo, local, condutor, envolvimento de terceiros, B.O. e os danos.
 * Registrar e Editar abrem o mesmo pop-up (RegistrarSinistro); Editar e
 * Excluir pedem justificativa e senha, como no resto do sistema. Sem os
 * cartoes de numeros no topo: poluiam a tela.
 */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PaginaLista from "../../components/PaginaLista.jsx";
import Icone from "../../components/Icone.jsx";
import Selo from "../../components/Selo.jsx";
import Acoes from "../../components/Acoes.jsx";
import RegistrarSinistro, { TIPOS_SINISTRO, SITUACOES_SINISTRO } from "../../components/RegistrarSinistro.jsx";
import { useConfirmacaoSenha } from "../../components/ConfirmarSenha.jsx";
import { Texto, Selecao, Periodo } from "../../components/Campos.jsx";
import { useLista } from "../../components/useLista.js";
import { api } from "../../lib/api.js";
import { data, hora, rotulo, simNao } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";

export const TOM_TIPO_SINISTRO = {
  COLISAO: "vermelho", DANO_MATERIAL: "amarelo",
  ROUBO_FURTO: "azul", INCENDIO: "laranja", OUTRO: "verde",
};

export default function Sinistros() {
  const navegar = useNavigate();
  const { podeVer } = useSessao();
  const [parametros] = useSearchParams();
  const lista = useLista("frotas/sinistros", {
    busca: "", veiculo: parametros.get("veiculo") || "", status: "", tipo: "", dataDe: "", dataAte: "",
  });
  const [veículos, setVeículos] = useState([]);
  // registrando = {} (novo) | { sinistro } (editar) | null (fechado)
  const [registrando, setRegistrando] = useState(null);
  const { pedirExclusao, elemento: modalSenha } = useConfirmacaoSenha();

  const podeGerenciar = podeVer("FROTAS_GERENCIAR_SINISTROS");

  useEffect(() => {
    api("/frotas/veiculos/opcoes").then(setVeículos).catch(() => {});
  }, []);

  /*
   * ?novo=1 abre o Registrar (endereco antigo /frotas/sinistros/novo);
   * ?editar=ID vem do botao Editar da ficha do sinistro. Saem do endereco
   * depois de usados, senao um F5 abriria a janela de novo.
   */
  useEffect(() => {
    const novo = parametros.get("novo");
    const editar = parametros.get("editar");
    if (!novo && !editar) return;
    if (novo) setRegistrando({ idVeiculo: parametros.get("veiculo") || "" });
    if (editar) {
      api(`/frotas/sinistros/${editar}`)
        .then((sinistro) => setRegistrando({ sinistro }))
        .catch((e) => alert(e.message));
    }
    navegar("/frotas/sinistros", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function excluir(s) {
    const resposta = await pedirExclusao({
      titulo: "Excluir sinistro",
      oQue: s.numero ? `o sinistro ${s.numero} do veículo ${s.placa}` : `o sinistro do veículo ${s.placa}`,
    });
    if (!resposta.ok) return;
    try {
      await api(`/frotas/sinistros/${s.id_sinistro}`, {
        method: "DELETE",
        body: { justificativa: resposta.justificativa },
      });
      lista.recarregar();
    } catch (e) {
      alert(e.message);
    }
  }

  const colunas = [
    { chave: "numero", rotulo: "Nº do sinistro", ordenavel: true, render: (s) => s.numero || "-" },
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
      chave: "placa", cortar: true, rotulo: "Veículo", ordenavel: true,
      render: (s) => (
        <span className="celula-dupla">
          <strong>{s.placa}</strong>
          <span>{`${s.marca} ${s.modelo}`}</span>
        </span>
      ),
    },
    {
      chave: "tipo", rotulo: "Tipo de sinistro", ordenavel: true,
      render: (s) => <Selo texto={rotulo("tipoSinistro", s.tipo)} tom={TOM_TIPO_SINISTRO[s.tipo]} />,
    },
    { chave: "local", cortar: true, rotulo: "Local" },
    {
      chave: "condutor", cortar: true, rotulo: "Condutor",
      render: (s) => (
        <span className="celula-dupla">
          <strong>{s.condutor}</strong>
          <span>Responsável: {s.responsavel}</span>
        </span>
      ),
    },
    { chave: "houve_terceiros", rotulo: "Houve terceiros?", render: (s) => simNao(s.houve_terceiros) },
    { chave: "bo", classe: "col-oculta-pequena", rotulo: "B.O.", render: (s) => s.bo || "-" },
    { chave: "status", rotulo: "Situação", ordenavel: true, render: (s) => <Selo valor={s.status} /> },
    {
      chave: "ações", rotulo: "Ações",
      render: (s) => (
        <Acoes
          acoes={[
            { rotulo: "Visualizar", icone: "visualizar",
              aoClicar: () => navegar(`/frotas/sinistros/${s.id_sinistro}`) },
            ...(podeGerenciar
              ? [{ rotulo: "Editar", icone: "editar", aoClicar: () => setRegistrando({ sinistro: s }) }]
              : []),
            { rotulo: "Ver veículo", icone: "kpi-car",
              aoClicar: () => navegar(`/frotas/veiculos/${s.id_veiculo}`) },
            ...(podeGerenciar
              ? [{ rotulo: "Excluir", perigo: true, icone: "lixo", aoClicar: () => excluir(s) }]
              : []),
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
          <button className="botao botao--primario" onClick={() => setRegistrando({})}>
            <Icone nome="alert-triangle" tamanho={15} /> Registrar sinistro
          </button>
        )
      }
      lista={lista}
      colunas={colunas}
      chaveDe={(s) => s.id_sinistro}
      unidade="sinistros"
      vazio="Nenhum sinistro encontrado com esses filtros."
      filtros={
        <>
          <Texto rotulo="Buscar" id="busca" placeholder="Placa, local, número ou B.O."
                 value={lista.filtros.busca}
                 onChange={(e) => lista.alterarFiltro("busca", e.target.value)} />
          <Selecao rotulo="Veículo" id="veiculo" vazio="Todos"
                   opcoes={veículos.map((v) => ({ valor: v.id_veiculo, rotulo: `${v.placa} - ${v.modelo}` }))}
                   value={lista.filtros.veiculo}
                   onChange={(e) => lista.alterarFiltro("veiculo", e.target.value)} />
          <Selecao rotulo="Tipo de sinistro" id="tipo" vazio="Todos" opcoes={TIPOS_SINISTRO}
                   value={lista.filtros.tipo}
                   onChange={(e) => lista.alterarFiltro("tipo", e.target.value)} />
          <Selecao rotulo="Situação" id="status" vazio="Todas" opcoes={SITUACOES_SINISTRO}
                   value={lista.filtros.status}
                   onChange={(e) => lista.alterarFiltro("status", e.target.value)} />
          <Periodo id="periodo" de={lista.filtros.dataDe} ate={lista.filtros.dataAte}
                   aoMudarDe={(v) => lista.alterarFiltro("dataDe", v)}
                   aoMudarAte={(v) => lista.alterarFiltro("dataAte", v)} />
        </>
      }
    >
      {registrando && (
        <RegistrarSinistro
          sinistro={registrando.sinistro}
          idVeiculo={registrando.idVeiculo}
          aoFechar={() => setRegistrando(null)}
          aoSalvar={lista.recarregar}
        />
      )}
      {modalSenha}
    </PaginaLista>
  );
}
