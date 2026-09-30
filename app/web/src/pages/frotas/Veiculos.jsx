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
import { useNavigate, useSearchParams } from "react-router-dom";
import PaginaLista from "../../components/PaginaLista.jsx";
import Icone from "../../components/Icone.jsx";
import Selo from "../../components/Selo.jsx";
import Acoes from "../../components/Acoes.jsx";
import Modal from "../../components/Modal.jsx";
import { useConfirmacaoSenha } from "../../components/ConfirmarSenha.jsx";
import { Texto, Selecao, Area } from "../../components/Campos.jsx";
import { useLista } from "../../components/useLista.js";
import { api } from "../../lib/api.js";
import { numero, opcoes } from "../../lib/formato.js";
import { VINCULOS, vinculo } from "../../lib/vinculos.js";
import { useSessao } from "../../lib/sessao.jsx";

const SITUACOES = [
  { valor: "DISPONIVEL", rotulo: "Regular" },
  { valor: "EM_USO", rotulo: "Em uso" },
  { valor: "EM_MANUTENCAO", rotulo: "Em manutenção" },
  { valor: "INATIVO", rotulo: "Indisponível" },
];
const TIPOS = opcoes("tipoVeiculo");
const COMBUSTIVEIS = opcoes("combustivel");

const VAZIO = {
  placa: "", marca: "", modelo: "", ano_fabricacao: "", ano_modelo: "", cor: "",
  tipo_veiculo: "AUTOMOVEL", renavam: "", chassi: "", tipo_combustivel: "FLEX",
  capacidade: "", quilometragem_atual: 0, id_setor: "", vinculo: "", observacoes: "",
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
  const { pedirSenha, pedirExclusao, elemento: modalSenha } = useConfirmacaoSenha();

  const podeGerenciar = podeVer("FROTAS_GERENCIAR_VEICULOS");
  const [parametros, definirParametros] = useSearchParams();

  useEffect(() => {
    api("/setores").then(setSetores).catch(() => {});
  }, []);

  // ?novo=1 abre a janela de cadastro assim que a tela carrega, para o atalho
  // "+ Cadastrar veiculo" do painel cair direto no formulario em vez de parar
  // na listagem. O parametro sai da URL na hora: se ficasse, a janela abriria
  // sozinha a cada F5 e ao voltar pelo historico.
  useEffect(() => {
    if (!parametros.get("novo") || !podeGerenciar) return;
    setFormulario(VAZIO);
    setErroForm("");
    setEditando("novo");
    const limpo = new URLSearchParams(parametros);
    limpo.delete("novo");
    definirParametros(limpo, { replace: true });
  }, [parametros, definirParametros, podeGerenciar]);

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
        // Vinculo em branco vai como null, nao como "": a coluna aceita os
        // dois valores previstos ou NADA, e a string vazia seria barrada pelo
        // banco com uma mensagem que a pessoa nao teria como entender.
        vinculo: formulario.vinculo || null,
      };
      if (editando === "novo") {
        await api("/frotas/veiculos", { method: "POST", body: corpo });
      } else {
        // So a EDICAO pede senha, como no resto do sistema: cadastrar um
        // veiculo novo nao altera historico nenhum; mudar placa, KM ou setor
        // de um veiculo que ja tem checklists e OS, sim.
        const confirmou = await pedirSenha({
          titulo: "Salvar alterações",
          aviso: `Confirme sua senha para salvar as alterações no veículo ${formulario.placa}.`,
        });
        if (!confirmou) {
          setSalvando(false);
          return;
        }
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
    { chave: "vinculo", rotulo: "Vínculo", render: (v) => vinculo(v.vinculo) },
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
        <Modal
          titulo={editando === "novo" ? "Novo veículo" : "Editar veículo"}
          legenda="Os campos marcados são obrigatórios."
          aoFechar={() => setEditando(null)}
          rodape={
            <>
              <button className="botao" onClick={() => setEditando(null)}>Cancelar</button>
              <button className="botao botao--primario" form="form-veículo" disabled={salvando}>
                <Icone nome="salvar" tamanho={15} monocromatico /> {salvando ? "Salvando..." : "Salvar"}
              </button>
            </>
          }
        >
          {erroForm && <div className="login__erro">{erroForm}</div>}
          <form id="form-veículo" className="formulario-grade formulario-grade--colunas" onSubmit={salvar}>
            {/* Tres blocos, na ordem em que a pessoa tem a informacao na mao:
                o que esta no documento do veiculo, depois onde ele fica dentro
                da CMTT, e por fim o que nao cabe em campo nenhum.

                Nenhum campo declara largura: todos ocupam o mesmo espaco, pela
                grade. Tentar dar a cada um o tamanho do seu conteudo produzia
                uma fileira de caixas desencontradas, que e mais dificil de ler
                do que uma coluna regular - e "Modelo" ou "Chassi" nao ficam
                melhores com o dobro do espaco da "Placa".

                O campo obrigatorio leva "*" no rotulo; o opcional nao leva
                nada. Escrever "(opcional)" era dizer duas vezes a mesma
                coisa. */}
            <h3 className="formulario__secao">Dados gerais</h3>
            {/* A placa aparece em caixa alta enquanto a pessoa digita. Quem
                grava mesmo e a API (normalizacoes de frotas.js); isto e so
                para a tela nao mostrar uma coisa e salvar outra. */}
            <Texto rotulo="Placa *" id="placa" required maxLength={10}
                   style={{ textTransform: "uppercase" }}
                   {...campo("placa")} placeholder="Ex.: ABC-1D23" />
            <Texto rotulo="Marca *" id="marca" required {...campo("marca")} placeholder="Ex.: Chevrolet" />
            <Texto rotulo="Modelo *" id="modelo" required {...campo("modelo")} placeholder="Ex.: S10 LS 2.8" />

            <Texto rotulo="Ano fabricação *" id="ano_fabricacao" type="number"
                   min="1900" max="2100" required {...campo("ano_fabricacao")} placeholder="2022" />
            <Texto rotulo="Ano modelo *" id="ano_modelo" type="number"
                   min="1900" max="2100" required {...campo("ano_modelo")} placeholder="2022" />
            <Selecao rotulo="Tipo de veículo *" id="tipo_veiculo" required
                     opcoes={TIPOS} {...campo("tipo_veiculo")} />
            <Texto rotulo="Cor" id="cor" {...campo("cor")} placeholder="Ex.: Branco" />

            <Texto rotulo="Renavam" id="renavam" {...campo("renavam")} placeholder="Ex.: 01234567890" />
            <Texto rotulo="Chassi" id="chassi" {...campo("chassi")} placeholder="Ex.: 9BG1489NK0JC123456" />

            <Selecao rotulo="Combustível" id="tipo_combustivel"
                     opcoes={COMBUSTIVEIS} {...campo("tipo_combustivel")} />
            <Texto rotulo="Capacidade" id="capacidade"
                   {...campo("capacidade")} placeholder="Ex.: 5" />
            <Texto rotulo="Odômetro atual *" id="quilometragem_atual" type="number" min="0"
                   required {...campo("quilometragem_atual")} placeholder="Ex.: 45230" />

            <h3 className="formulario__secao">Vinculações</h3>
            {/* O SETOR e o que decide se o veiculo e viatura. Nao existe mais
                campo separado para isso: veiculo vinculado a Fiscalizacao
                aparece na tela de Viaturas, e todos aparecem em Frotas. Quem
                cadastra responde uma pergunta so, e as duas telas concordam
                sem ninguem ter que lembrar de marcar nada. */}
            <Selecao rotulo="Setor *" id="id_setor" required vazio="Selecione"
                     opcoes={setores.map((s) => ({ valor: s.id_setor, rotulo: s.nome }))}
                     {...campo("id_setor")} />
            <Selecao rotulo="Vínculo" id="vinculo" vazio="Selecione"
                     opcoes={VINCULOS} {...campo("vinculo")} />
            <Selecao rotulo="Situação" id="status" opcoes={SITUACOES} {...campo("status")} />

            <h3 className="formulario__secao">Observações</h3>
            <Area id="observacoes" largo aria-label="Observações" {...campo("observacoes")}
                  placeholder="Ex.: Veículo com adesivagem da CMTT" />
          </form>
        </Modal>
      )}

      {modalSenha}
    </PaginaLista>
  );
}
