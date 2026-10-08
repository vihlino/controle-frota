/**
 * Checklists.jsx - Os registros de saida e chegada da frota.
 *
 * NAO tem botao de "novo checklist", de proposito: o registro sempre nasce da
 * leitura do QR Code do veículo.
 *
 * A coluna de equipamentos mostra as quatro iniciais de forma compacta; o item
 * que o condutor marcou como ausente fica vermelho.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PaginaLista from "../../components/PaginaLista.jsx";
import Selo from "../../components/Selo.jsx";
import Acoes from "../../components/Acoes.jsx";
import CorrigirChecklist, { ORDEM_EQUIPAMENTOS } from "../../components/CorrigirChecklist.jsx";
import { useConfirmacaoSenha } from "../../components/ConfirmarSenha.jsx";
import { Texto, Selecao, Periodo } from "../../components/Campos.jsx";
import { useLista } from "../../components/useLista.js";
import { api } from "../../lib/api.js";
import { dataHora, hora, numero, rotulo } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";

// Mostra os quatro equipamentos obrigatorios de forma compacta. O que o
// condutor marcou como ausente fica vermelho.
function Equipamentos({ itens }) {
  const porNome = Object.fromEntries((itens || []).map((e) => [e.equipamento, e]));
  return (
    <span className="equipamentos">
      {ORDEM_EQUIPAMENTOS.map((código) => {
        const item = porNome[código];
        const ausente = item && !item.conforme;
        return (
          <abbr
            key={código}
            className="equipamentos__item"
            data-ausente={ausente ? "sim" : undefined}
            title={`${rotulo("equipamento", código)}: ${
              !item ? "nao informado" : item.conforme ? "presente" : "ausente"
            }`}
          >
            {rotulo("equipamento", código)[0]}
          </abbr>
        );
      })}
    </span>
  );
}

export default function Checklists() {
  const navegar = useNavigate();
  const [parâmetros] = useSearchParams();
  const lista = useLista("frotas/checklists", {
    busca: "",
    veiculo: parâmetros.get("veiculo") || "",
    status: "",
    // O painel manda "Movimentacoes de hoje" para ca ja com o dia preenchido.
    dataDe: parâmetros.get("dataDe") || "",
    dataAte: parâmetros.get("dataAte") || "",
  });
  const [veículos, setVeículos] = useState([]);

  /*
   * CORRIGIR UM CHECKLIST JA ENVIADO
   *
   * O registro nasce no celular do condutor e ninguem o digita duas vezes:
   * quando ele erra o odometro ou informa a hora de memoria no fim do turno,
   * a correcao tem de acontecer aqui.
   *
   * Tres travas, e nenhuma e enfeite:
   *   - a permissao e PROPRIA (FROTAS_EDITAR_CHECKLIST, migracao 019): quem
   *     cadastra veiculo nao ganha de brinde o poder de reescrever o
   *     historico da frota;
   *   - a senha e pedida antes de gravar, como no resto do sistema;
   *   - nao existe excluir, e nao existe criar. Checklist errado se corrige;
   *     apagado, ele tiraria do historico a prova de que o veiculo saiu, e
   *     criado a mao seria uma saida que nunca aconteceu.
   *
   * A API registra a alteracao na auditoria com o antes e o depois.
   */
  const { podeVer } = useSessao();
  const podeEditar = podeVer("FROTAS_EDITAR_CHECKLIST");
  const { pedirExclusao, elemento: modalSenha } = useConfirmacaoSenha();
  // null ou o checklist em correcao. A janela e o CorrigirChecklist.
  const [editando, setEditando] = useState(null);

  /*
   * ?editar=ID abre o pop-up de edicao direto (botao Editar da tela de
   * detalhes). Ao fechar - salvando ou cancelando - volta para os detalhes,
   * que e de onde a pessoa veio.
   */
  const voltarParaDetalhe = useRef(null);
  useEffect(() => {
    const idEditar = podeEditar && parâmetros.get("editar");
    if (!idEditar) return;
    voltarParaDetalhe.current = idEditar;
    api(`/frotas/checklists/${idEditar}`).then(abrirEdicao).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const jaAbriu = useRef(false);
  useEffect(() => {
    if (editando !== null) {
      jaAbriu.current = true;
      return;
    }
    if (jaAbriu.current && voltarParaDetalhe.current) {
      const destino = voltarParaDetalhe.current;
      voltarParaDetalhe.current = null;
      navegar(`/frotas/checklists/${destino}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando]);

  /*
   * A JANELA DE CORRECAO IMITA O CHECKLIST DO CONDUTOR
   *
   * Duas abas (saida e chegada), os dados do veiculo e do condutor no topo, os
   * equipamentos item por item e as fotos. Quem corrige esta conferindo o
   * registro contra a realidade - e faz isso comparando com o que o condutor
   * viu na tela dele. Um formulario com nomes de coluna do banco obrigaria a
   * traducao mental a cada campo.
   *
   * O que NAO se edita aparece, mas em texto: veiculo, condutor e matricula
   * sao de OUTROS cadastros. Trocar o condutor de um checklist nao seria
   * corrigir um erro de digitacao - seria dizer que outra pessoa dirigiu.
   */
  function abrirEdicao(c) {
    setEditando(c);
  }

  /** Excluir exige senha e nao tem volta - por isso o aviso nomeia a placa. */
  async function excluir(c) {
    const resposta = await pedirExclusao({
      titulo: "Excluir checklist",
      oQue: `o checklist do veículo ${c.placa}`,
    });
    if (!resposta.ok) return;
    try {
      await api(`/frotas/checklists/${c.id_checklist}`, {
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
      // "Enviado em" e o instante em que o condutor MANDOU o registro. Antes
      // esta coluna mostrava data_abertura, que e a data DECLARADA de saida -
      // duas coisas diferentes com o mesmo nome.
      chave: "criado_em", rotulo: "Enviado em", ordenavel: true,
      render: (c) => (
        <strong>{dataHora(c.criado_em)}</strong>
      ),
    },
    {
      chave: "placa", cortar: true, rotulo: "Placa / Veículo", ordenavel: true,
      render: (c) => (
        <span className="celula-dupla">
          <strong>{c.placa}</strong>
          <span>{`${c.marca} ${c.modelo}`}</span>
        </span>
      ),
    },
    { chave: "condutor", cortar: true, rotulo: "Condutor", ordenavel: true },
    {
      chave: "saida", rotulo: "Saida (hora / KM)",
      render: (c) => (
        <span className="celula-dupla">
          <strong>{hora(c.hora_saida)}</strong>
          <span>{numero(c.odometro_saida)} km</span>
        </span>
      ),
    },
    {
      chave: "chegada", rotulo: "Chegada (hora / KM)",
      render: (c) =>
        c.odometro_chegada === null ? (
          "-"
        ) : (
          <span className="celula-dupla">
            <strong>{hora(c.hora_chegada)}</strong>
            <span>{numero(c.odometro_chegada)} km</span>
          </span>
        ),
    },
    {
      // Quando a CHEGADA foi enviada. Comparado com a chegada declarada, e o
      // que mostra se o checklist foi fechado na hora ou dias depois.
      chave: "data_finalizacao", rotulo: "Fechado em", ordenavel: true,
      render: (c) =>
        !c.data_finalizacao ? (
          <span className="texto-fraco">Em aberto</span>
        ) : (
          <strong>{dataHora(c.data_finalizacao)}</strong>
        ),
    },
    {
      chave: "km_rodado", rotulo: "KM rodado", ordenavel: true,
      render: (c) => (c.km_rodado === null ? "-" : `${numero(c.km_rodado)} km`),
    },
    {
      chave: "equipamentos", rotulo: "Equipamentos",
      render: (c) => <Equipamentos itens={c.equipamentos} />,
    },
    { chave: "status", rotulo: "Situação", render: (c) => <Selo valor={c.status} /> },
    {
      chave: "ações", rotulo: "Ações",
      render: (c) => (
        <Acoes
          acoes={[
            {
              rotulo: "Visualizar", icone: "visualizar",
              aoClicar: () => navegar(`/frotas/checklists/${c.id_checklist}`),
            },
            ...(podeEditar
              ? [{ rotulo: "Editar", icone: "editar", aoClicar: () => abrirEdicao(c) }]
              : []),
            {
              rotulo: "Ver veículo", icone: "kpi-car",
              aoClicar: () => navegar(`/frotas/veiculos/${c.id_veiculo}`),
            },
            ...(podeEditar
              ? [{ rotulo: "Excluir", perigo: true, icone: "lixo",
                   aoClicar: () => excluir(c) }]
              : []),
          ]}
        />
      ),
    },
  ];

  return (
    <>
    <PaginaLista
      trilha={[{ rotulo: "Frotas" }, { rotulo: "Checklists" }]}
      titulo="Checklists"
      descricao="Checklists enviados pela frota. Novos registros nascem da leitura do QR Code do veículo."
      lista={lista}
      colunas={colunas}
      chaveDe={(c) => c.id_checklist}
      unidade="checklists"
      vazio="Nenhum checklist encontrado com esses filtros."
      filtros={
        <>
          <Texto
            rotulo="Buscar" id="busca" placeholder="Placa, condutor ou percurso"
            value={lista.filtros.busca}
            onChange={(e) => lista.alterarFiltro("busca", e.target.value)}
          />
          <Selecao
            rotulo="Veículo" id="veículo" vazio="Todos"
            opcoes={veículos.map((v) => ({ valor: v.id_veiculo, rotulo: `${v.placa} - ${v.modelo}` }))}
            value={lista.filtros.veiculo}
            onChange={(e) => lista.alterarFiltro("veiculo", e.target.value)}
          />
          <Selecao
            rotulo="Situação" id="status" vazio="Todas"
            opcoes={[
              { valor: "ABERTO", rotulo: "Em aberto" },
              { valor: "FINALIZADO", rotulo: "Finalizado" },
            ]}
            value={lista.filtros.status}
            onChange={(e) => lista.alterarFiltro("status", e.target.value)}
          />
          <Periodo id="periodo" de={lista.filtros.dataDe} ate={lista.filtros.dataAte}
                   aoMudarDe={(v) => lista.alterarFiltro("dataDe", v)}
                   aoMudarAte={(v) => lista.alterarFiltro("dataAte", v)} />
        </>
      }
    />

    {editando && (
      <CorrigirChecklist
        checklist={editando}
        aoFechar={() => setEditando(null)}
        aoSalvar={() => lista.recarregar()}
      />
    )}

    {modalSenha}
    </>
  );
}
