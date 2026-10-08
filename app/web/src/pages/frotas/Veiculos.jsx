/**
 * Veículos.jsx - O cadastro da frota, nucleo do módulo.
 *
 * Escrita a mao (e nao pela fabrica criarPagina) por causa do menu de ações,
 * que leva para detalhes, historico, documentos e QR Code do veículo.
 *
 * As situações seguem as cores definidas: Regular (verde), Em manutenção
 * (amarelo), Indisponivel (vermelho).
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PaginaLista from "../../components/PaginaLista.jsx";
import Icone from "../../components/Icone.jsx";
import Selo from "../../components/Selo.jsx";
import Acoes from "../../components/Acoes.jsx";
import FormularioVeiculo, { SITUACOES } from "../../components/FormularioVeiculo.jsx";
import { useConfirmacaoSenha } from "../../components/ConfirmarSenha.jsx";
import { Texto, Selecao } from "../../components/Campos.jsx";
import { useLista } from "../../components/useLista.js";
import { api } from "../../lib/api.js";
import { vinculo } from "../../lib/vinculos.js";
import { useSessao } from "../../lib/sessao.jsx";

export default function Veículos() {
  const navegar = useNavigate();
  const { podeVer } = useSessao();
  const lista = useLista("frotas/veiculos", { busca: "", setor: "", status: "" });
  const [setores, setSetores] = useState([]);
  // null | "novo" | o veiculo em edicao. A janela e o FormularioVeiculo.
  const [editando, setEditando] = useState(null);
  const { pedirExclusao, elemento: modalSenha } = useConfirmacaoSenha();

  const podeGerenciar = podeVer("FROTAS_GERENCIAR_VEICULOS");
  const [parametros, definirParametros] = useSearchParams();

  /*
   * ?editar=ID abre o pop-up de edicao direto (botao Editar da tela de
   * detalhes). Ao fechar - salvando ou cancelando - volta para os detalhes,
   * que e de onde a pessoa veio.
   */
  const voltarParaDetalhe = useRef(null);
  const jaAbriu = useRef(false);
  useEffect(() => {
    const idEditar = podeGerenciar && parametros.get("editar");
    if (!idEditar) return;
    voltarParaDetalhe.current = idEditar;
    api(`/frotas/veiculos/${idEditar}`).then(abrirEdicao).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (editando !== null) {
      jaAbriu.current = true;
      return;
    }
    if (jaAbriu.current && voltarParaDetalhe.current) {
      const destino = voltarParaDetalhe.current;
      voltarParaDetalhe.current = null;
      navegar(`/frotas/veiculos/${destino}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando]);

  useEffect(() => {
    api("/setores").then(setSetores).catch(() => {});
  }, []);

  // ?novo=1 abre a janela de cadastro assim que a tela carrega, para o atalho
  // "+ Cadastrar veiculo" do painel cair direto no formulario em vez de parar
  // na listagem. O parametro sai da URL na hora: se ficasse, a janela abriria
  // sozinha a cada F5 e ao voltar pelo historico.
  useEffect(() => {
    if (!parametros.get("novo") || !podeGerenciar) return;
    setEditando("novo");
    const limpo = new URLSearchParams(parametros);
    limpo.delete("novo");
    definirParametros(limpo, { replace: true });
  }, [parametros, definirParametros, podeGerenciar]);

  function abrirNovo() {
    setEditando("novo");
  }

  function abrirEdicao(v) {
    setEditando(v);
  }

  async function excluir(v) {
    const resposta = await pedirExclusao({
      titulo: "Excluir veículo",
      oQue: `o veículo ${v.placa}`,
    });
    if (!resposta.ok) return;
    try {
      await api(`/frotas/veiculos/${v.id_veiculo}`, {
        method: "DELETE",
        body: { justificativa: resposta.justificativa },
      });
      lista.recarregar();
    } catch (e) {
      alert(e.message);
    }
  }

  const colunas = [
    { chave: "placa", rotulo: "Placa", ordenavel: true },
    { chave: "marca", rotulo: "Marca", ordenavel: true },
    { chave: "modelo", cortar: true, rotulo: "Modelo", ordenavel: true },
    { chave: "renavam", classe: "col-oculta-pequena", rotulo: "Renavam" },
    { chave: "chassi", rotulo: "Chassi" },
    { chave: "ano_modelo", rotulo: "Ano modelo", ordenavel: true },
    { chave: "ano_fabricacao", classe: "col-oculta-pequena", rotulo: "Ano fabricação" },
    { chave: "vinculo", rotulo: "Vínculo", render: (v) => vinculo(v.vinculo) },
    { chave: "setor", cortar: true, rotulo: "Setor", ordenavel: true },
    { chave: "status", rotulo: "Situação", ordenavel: true, render: (v) => <Selo valor={v.status} /> },
    {
      chave: "qrcode", rotulo: "QR Code",
      render: (v) => (
        <button
          className="botao-icone"
          title="QR Code do veículo"
          onClick={() => navegar(`/frotas/veiculos/${v.id_veiculo}/qrcode`)}
        >
          <Icone nome="codigo-qr" tamanho={18} />
        </button>
      ),
    },
    {
      chave: "ações", rotulo: "Ações",
      render: (v) => (
        <Acoes
          acoes={[
            { rotulo: "Visualizar", icone: "visualizar",
              aoClicar: () => navegar(`/frotas/veiculos/${v.id_veiculo}`) },
            ...(podeGerenciar
              ? [{ rotulo: "Editar", icone: "editar", aoClicar: () => abrirEdicao(v) }]
              : []),
            { rotulo: "Histórico", icone: "historico",
              aoClicar: () => navegar(`/frotas/checklists?veiculo=${v.id_veiculo}`) },
            { rotulo: "Documentos", icone: "documento",
              aoClicar: () => navegar(`/frotas/documentos?veiculo=${v.id_veiculo}`) },
            { rotulo: "Manutenções", icone: "kpi-wrench",
              aoClicar: () => navegar(`/frotas/manutencoes?veiculo=${v.id_veiculo}`) },
            ...(podeGerenciar
              ? [{ rotulo: "Excluir", perigo: true, icone: "lixo",
                   aoClicar: () => excluir(v) }]
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
            <Icone nome="mais" tamanho={15} /> Novo veículo
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
        <FormularioVeiculo
          veiculo={editando === "novo" ? null : editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => lista.recarregar()}
        />
      )}

      {modalSenha}
    </PaginaLista>
  );
}
