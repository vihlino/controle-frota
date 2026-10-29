/**
 * Inspeções.jsx - As inspeções periodicas dos veículos.
 *
 * O botao e "Agendar inspeção" (e nao "Nova"), porque e disso que se trata.
 *
 * Ao agendar, a data da proxima inspeção ja sai calculada pela frequencia
 * escolhida: semanal +7 dias, quinzenal +15, mensal +30.
 */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PaginaLista from "../../components/PaginaLista.jsx";
import Icone from "../../components/Icone.jsx";
import Selo from "../../components/Selo.jsx";
import Acoes from "../../components/Acoes.jsx";
import AgendarInspecao, { FREQUENCIAS } from "../../components/AgendarInspecao.jsx";
import { useConfirmacaoSenha } from "../../components/ConfirmarSenha.jsx";
import EditarInspecao from "../../components/EditarInspecao.jsx";
import { Texto, Selecao, Periodo } from "../../components/Campos.jsx";
import { useLista } from "../../components/useLista.js";
import { api } from "../../lib/api.js";
import { data, hora, numero, rotulo, ROTULOS, opcoes } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";

export default function Inspeções() {
  const navegar = useNavigate();
  const { podeVer } = useSessao();
  const [parametros] = useSearchParams();
  const lista = useLista("frotas/inspecoes", {
    busca: "", veiculo: parametros.get("veiculo") || "", tipo: "", status: "", analise: "",
    dataDe: "", dataAte: "",
  });
  const [veículos, setVeículos] = useState([]);
  // null = fechada; {} = agendar; {inspecao} = reagendar (29/10: AgendarInspecao.jsx).
  const [agendando, setAgendando] = useState(null);
  /*
   * EDITAR TEM DOIS SENTIDOS, CONFORME A SITUACAO
   *
   * - PENDENTE: a inspecao ainda nao aconteceu. Editar reabre a janela de
   *   agendar com tudo preenchido (veiculo, responsavel, frequencia, data,
   *   hora) - e reagendar. `editandoId` guarda qual.
   * - CONCLUIDA: a data e o veiculo viraram fato. Editar abre os ITENS que o
   *   condutor marcou (EditarInspecao) - `corrigindo`. A API recusa trocar
   *   veiculo/data de inspecao ja feita.
   */
  const [corrigindo, setCorrigindo] = useState(null);
  const { pedirExclusao, elemento: modalSenha } = useConfirmacaoSenha();
  const podeGerenciar = podeVer("FROTAS_REALIZAR_INSPECAO");

  const abrirAgendamento = (idVeiculo = "") => setAgendando({ idVeiculo });
  const abrirEdicao = (i) => setAgendando({ inspecao: i });

  /*
   * /frotas/inspecoes?agendar=1 abre a janela de agendar. E o que o atalho
   * "Agendar inspecao" do painel usa - antes ele levava a uma pagina separada,
   * com outro desenho. O parametro sai do endereco depois de usado, senao um
   * F5 abriria a janela de novo.
   */
  useEffect(() => {
    if (parametros.get("agendar")) {
      abrirAgendamento(parametros.get("veiculo") || "");
      navegar("/frotas/inspecoes", { replace: true });
    }
    // ?editar=ID vem do botao Editar da ficha de uma inspecao pendente.
    const idEditar = parametros.get("editar");
    if (idEditar) {
      navegar("/frotas/inspecoes", { replace: true });
      api(`/frotas/inspecoes/${idEditar}`)
        .then((i) => (i.status === "ABERTA" ? abrirEdicao(i) : setCorrigindo(i)))
        .catch((e) => alert(e.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function excluir(i) {
    const resposta = await pedirExclusao({
      titulo: "Excluir inspeção",
      oQue: `a inspeção do veículo ${i.placa}`,
    });
    if (!resposta.ok) return;
    try {
      await api(`/frotas/inspecoes/${i.id_inspecao}`, {
        method: "DELETE",
        body: { justificativa: resposta.justificativa },
      });
      lista.recarregar();
    } catch (e) {
      alert(e.message);
    }
  }

  useEffect(() => {
    api("/frotas/veiculos/opcoes").then(setVeículos).catch(() => {});
  }, []);

  const colunas = [
    {
      chave: "data_realizacao", rotulo: "Data da inspeção", ordenavel: true,
      render: (i) => (
        // So a data: o veiculo ja tem coluna propria logo ao lado, e repetir
        // placa e modelo aqui deixava esta coluna a mais larga da tabela.
        <strong>{data(i.data_realizacao)}</strong>
      ),
    },
    {
      chave: "placa", cortar: true, rotulo: "Veículo", ordenavel: true,
      render: (i) => (
        <span className="celula-dupla">
          <strong>{i.placa}</strong>
          <span>{`${i.marca} ${i.modelo}`}</span>
        </span>
      ),
    },
    {
      // A hora fica junto da data, e nao em coluna propria: as duas respondem
      // "quando", e separadas obrigavam a ler duas colunas para montar uma
      // informacao so.
      chave: "hora_inicio", rotulo: "Horário",
      render: (i) => hora(i.hora_inicio),
    },
    {
      chave: "tipo", rotulo: "Frequência", ordenavel: true,
      render: (i) => {
        const CORES = { SEMANAL: "azul", QUINZENAL: "laranja", MENSAL: "verde", PERSONALIZADA: "amarelo" };
        const NOMES = { SEMANAL: "Semanal", QUINZENAL: "Quinzenal", MENSAL: "Mensal", PERSONALIZADA: "Personalizada", SEM_PERIODICIDADE: "Sem periodicidade" };
        return <Selo texto={NOMES[i.tipo] || i.tipo} tom={CORES[i.tipo] || "azul"} />;
      },
    },
    {
      chave: "proxima_inspecao", rotulo: "Próxima inspeção", ordenavel: true,
      render: (i) => data(i.proxima_inspecao || i.proxima_inspeção),
    },
    { chave: "responsavel", cortar: true, rotulo: "Responsável", ordenavel: true },
    {
      chave: "status", rotulo: "Situação", ordenavel: true,
      render: (i) => (
        <Selo
          texto={i.status === "ABERTA" ? "Pendente" : "Concluída"}
          tom={i.status === "ABERTA" ? "amarelo" : "verde"}
        />
      ),
    },
    {
      /*
       * Nao e mais "Aprovado / Reprovado": uma inspecao com ressalva que
       * ninguem olhou ainda e "Em analise" - e e ela que a gestao precisa
       * abrir. Depois de alguem decidir (abrir OS ou registrar que nao
       * precisa), vira "Analisado".
       */
      chave: "analise", rotulo: "Resultado", ordenavel: true,
      render: (i) => {
        const r = ROTULOS.analiseInspecao[i.analise];
        return r ? <Selo texto={r.texto} tom={r.tom} /> : "-";
      },
    },
    {
      chave: "ações", rotulo: "Ações",
      render: (i) => (
        <Acoes
          acoes={[
            {
              rotulo: "Visualizar", icone: "visualizar",
              aoClicar: () => navegar(`/frotas/inspecoes/${i.id_inspecao}`),
            },
            // Pendente: reagendar. Concluida: corrigir o que foi marcado.
            ...(podeGerenciar
              ? [{ rotulo: "Editar", icone: "editar",
                   aoClicar: () => (i.status === "ABERTA" ? abrirEdicao(i) : setCorrigindo(i)) }]
              : []),
            {
              rotulo: "Ver veículo", icone: "kpi-car",
              aoClicar: () => navegar(`/frotas/veiculos/${i.id_veiculo}`),
            },
            ...(podeGerenciar
              ? [{ rotulo: "Excluir", perigo: true, icone: "lixo",
                   aoClicar: () => excluir(i) }]
              : []),
          ]}
        />
      ),
    },
  ];

  return (
    <PaginaLista
      trilha={[{ rotulo: "Frotas" }, { rotulo: "Inspeções" }]}
      titulo="Inspeções"
      descricao="Acompanhe as inspeções periodicas agendadas para os veículos da frota."
      acao={
        podeGerenciar && (
          <button className="botao botao--primario" onClick={() => abrirAgendamento()}>
            <Icone nome="calendar" tamanho={15} /> Agendar inspeção
          </button>
        )
      }
      lista={lista}
      colunas={colunas}
      chaveDe={(i) => i.id_inspecao}
      unidade="inspeções"
      vazio="Nenhuma inspeção encontrada com esses filtros."
      filtros={
        <>
          <Texto rotulo="Buscar" id="busca" placeholder="Placa, responsável ou número"
                 value={lista.filtros.busca}
                 onChange={(e) => lista.alterarFiltro("busca", e.target.value)} />
          <Selecao rotulo="Veículo" id="veículo" vazio="Todos"
                   opcoes={veículos.map((v) => ({ valor: v.id_veiculo, rotulo: `${v.placa} - ${v.modelo}` }))}
                   value={lista.filtros.veiculo}
                   onChange={(e) => lista.alterarFiltro("veiculo", e.target.value)} />
          <Selecao rotulo="Frequência" id="tipo" vazio="Todas" opcoes={FREQUENCIAS}
                   value={lista.filtros.tipo}
                   onChange={(e) => lista.alterarFiltro("tipo", e.target.value)} />
          <Selecao rotulo="Situação" id="status" vazio="Todas"
                   opcoes={[
                     { valor: "ABERTA", rotulo: "Pendente" },
                     { valor: "FINALIZADA", rotulo: "Concluída" },
                   ]}
                   value={lista.filtros.status}
                   onChange={(e) => lista.alterarFiltro("status", e.target.value)} />
          <Selecao rotulo="Resultado" id="analise" vazio="Todos"
                   opcoes={opcoes("analiseInspecao")}
                   value={lista.filtros.analise}
                   onChange={(e) => lista.alterarFiltro("analise", e.target.value)} />
          <Periodo id="periodo" de={lista.filtros.dataDe} ate={lista.filtros.dataAte}
                   aoMudarDe={(v) => lista.alterarFiltro("dataDe", v)}
                   aoMudarAte={(v) => lista.alterarFiltro("dataAte", v)} />
        </>
      }
    >
      {agendando && (
        <AgendarInspecao inspecao={agendando.inspecao} idVeiculo={agendando.idVeiculo}
                         aoFechar={() => setAgendando(null)} aoSalvar={lista.recarregar} />
      )}

      {corrigindo && (
        <EditarInspecao
          inspecao={corrigindo}
          aoFechar={() => setCorrigindo(null)}
          aoSalvar={lista.recarregar}
        />
      )}

      {modalSenha}
    </PaginaLista>
  );
}
