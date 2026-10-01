/**
 * Documentos.jsx - Documentos dos veículos e seus vencimentos.
 *
 * Cada linha mostra quantos dias faltam para vencer, com cor: verde acima de
 * 30 dias, laranja dentro dos 30 e vermelho quando ja venceu.
 *
 * Acoes: Visualizar (ficha com arquivos e historico), Ver veiculo, Atualizar
 * (renovacao: cadastra a versao nova e guarda a atual no historico), Editar
 * e Excluir. A lista mostra so a versao ATUAL de cada documento.
 */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PaginaLista from "../../components/PaginaLista.jsx";
import Icone from "../../components/Icone.jsx";
import Selo from "../../components/Selo.jsx";
import Acoes from "../../components/Acoes.jsx";
import FormularioDocumento, { CATEGORIAS_DOCUMENTO as CATEGORIAS } from "../../components/FormularioDocumento.jsx";
import { Texto, Selecao } from "../../components/Campos.jsx";
import { useLista } from "../../components/useLista.js";
import { useConfirmacaoSenha } from "../../components/ConfirmarSenha.jsx";
import { api } from "../../lib/api.js";
import { data } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";

const SITUACOES = [
  { valor: "VALIDO", rotulo: "Válido" },
  { valor: "VENCENDO", rotulo: "Vencendo" },
  { valor: "VENCIDO", rotulo: "Vencido" },
  { valor: "INATIVO", rotulo: "Inativo" },
];

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
  // { modo: "novo" | "editar" | "atualizar", documento?, idVeiculo? } ou null
  const [formulario, setFormulario] = useState(null);
  const { pedirExclusao, elemento: modalSenha } = useConfirmacaoSenha();

  const podeGerenciar = podeVer("FROTAS_GERENCIAR_DOCUMENTOS");

  useEffect(() => {
    api("/frotas/veiculos/opcoes").then(setVeículos).catch(() => {});
  }, []);

  /*
   * ?novo=1 abre o pop-up de Novo documento (atalho do painel e o endereco
   * antigo /frotas/documentos/novo). Sai do endereco depois de usado.
   */
  useEffect(() => {
    if (!parâmetros.get("novo") || !podeGerenciar) return;
    abrirNovo(parâmetros.get("veiculo") || "");
    navegar("/frotas/documentos", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function abrirNovo(idVeiculo = "") {
    setFormulario({ modo: "novo", idVeiculo });
  }

  // Era a unica exclusao com o confirm() do navegador: sem senha e sem motivo.
  async function excluir(d) {
    const resposta = await pedirExclusao({
      titulo: "Excluir documento",
      oQue: `o documento ${d.tipo_documento} do veículo ${d.placa}`,
    });
    if (!resposta.ok) return;
    try {
      await api(`/frotas/documentos/${d.id_documento}`, {
        method: "DELETE",
        body: { justificativa: resposta.justificativa },
      });
      lista.recarregar();
    } catch (e) {
      alert(e.message);
    }
  }

  const colunas = [
    { chave: "tipo_documento", cortar: true, rotulo: "Documento", ordenavel: true },
    {
      chave: "categoria", rotulo: "Categoria",
      render: (d) => (d.categoria ? <Selo texto={d.categoria} tom="azul" /> : "-"),
    },
    {
      chave: "placa", cortar: true, rotulo: "Veículo", ordenavel: true,
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
    { chave: "responsavel", cortar: true, rotulo: "Responsável", render: (d) => d.responsavel || "-" },
    { chave: "status", rotulo: "Situação", ordenavel: true, render: (d) => <Selo valor={d.status} /> },
    {
      chave: "ações", rotulo: "Ações",
      render: (d) => (
        <Acoes
          acoes={[
            { rotulo: "Visualizar", icone: "visualizar",
              aoClicar: () => navegar(`/frotas/documentos/${d.id_documento}`) },
            { rotulo: "Ver veículo", icone: "kpi-car",
              aoClicar: () => navegar(`/frotas/veiculos/${d.id_veiculo}`) },
            ...(podeGerenciar
              ? [
                  { rotulo: "Atualizar", icone: "historico",
                    aoClicar: () => setFormulario({ modo: "atualizar", documento: d }) },
                  { rotulo: "Editar", icone: "editar",
                    aoClicar: () => setFormulario({ modo: "editar", documento: d }) },
                  { rotulo: "Excluir", perigo: true, icone: "lixo",
                    aoClicar: () => excluir(d) },
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
          <button className="botao botao--primario" onClick={() => abrirNovo()}>
            <Icone nome="mais" tamanho={15} /> Novo documento
          </button>
        )
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
          <Selecao rotulo="Veículo" id="veículo" vazio="Todos"
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
      {formulario && (
        <FormularioDocumento
          modo={formulario.modo}
          documento={formulario.documento}
          idVeiculo={formulario.idVeiculo}
          aoFechar={() => setFormulario(null)}
          aoSalvar={(novoId) => {
            // Atualizar leva direto a versao nova, com o historico ao lado.
            if (formulario.modo === "atualizar" && novoId) navegar(`/frotas/documentos/${novoId}`);
            else lista.recarregar();
          }}
        />
      )}
      {modalSenha}
    </PaginaLista>
  );
}
