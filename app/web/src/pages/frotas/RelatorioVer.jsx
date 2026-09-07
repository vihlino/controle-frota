/**
 * RelatórioVer.jsx - O relatório como documento oficial.
 *
 * Nao e uma tela de cards: e um documento, com cabecalho da CMTT, identificacao
 * do relatório, a tabela com os registros reais, area de assinatura e rodape
 * oficial. O CSS de impressao esconde menu e topo, entao imprimir gera o PDF.
 *
 * O conteudo vem do snapshot congelado na geracao, nao de consulta nova. O
 * campo "integro" avisa se o conteudo salvo ainda confere com o selo.
 */
import { useEffect, useState } from "react";
import { useOutletContext, useParams, useNavigate } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import Selo from "../../components/Selo.jsx";
import Modal from "../../components/Modal.jsx";
import { Area } from "../../components/Campos.jsx";
import { api } from "../../lib/api.js";
import { data, dataHora, dinheiro, hora, numero, simNao } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";

// O relatório nao e uma tela de cards: e um documento oficial, com cabecalho,
// tabela dos registros reais e rodape da CMTT.
function celula(valor, tipo) {
  if (valor === null || valor === undefined || valor === "") return "-";
  switch (tipo) {
    case "data": return data(valor);
    case "hora": return hora(valor);
    case "numero": return numero(valor);
    case "dinheiro": return dinheiro(valor);
    case "sim_nao": return simNao(valor);
    default: return String(valor);
  }
}

export default function RelatórioVer() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const { podeVer, usuario } = useSessao();
  const [relatório, setRelatório] = useState(null);
  const [erro, setErro] = useState("");
  const [atestando, setAtestando] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const podeAtestar = podeVer("RELATORIOS_ATESTAR");

  // ATE TRES pessoas atestam o mesmo relatório, e ninguem atesta duas vezes.
  // A conta tambem vale para esconder o botao: melhor nao oferecer do que
  // deixar clicar e devolver erro.
  const atestacoes = relatório?.atestacoes || [];
  const jaAtestei = atestacoes.some((a) => a.id_usuario === usuario?.id_usuario);
  const podeAtestarAgora =
    relatório &&
    relatório.status !== "CANCELADO" &&
    atestacoes.length < 3 &&
    !jaAtestei;

  useEffect(() => {
    definirCabecalho({ titulo: "", legenda: "" });
  }, [definirCabecalho]);

  function carregar() {
    api(`/relatorios/${id}`).then(setRelatório).catch((e) => setErro(e.message));
  }
  useEffect(carregar, [id]);

  /**
   * Baixa o relatório como CSV - o mesmo conteudo que esta na tela, no arquivo
   * que abre no Excel.
   *
   * O arquivo sai do SNAPSHOT que ja esta carregado, sem nova consulta ao
   * servidor: e o mesmo material que foi selado na geracao e que sera
   * atestado. Ponto e virgula como separador e BOM no comeco porque e assim
   * que o Excel em portugues abre o arquivo sem embaralhar acento e coluna.
   */
  function baixarCsv() {
    const escapar = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const linhas = [
      conteudo.colunas.map((c) => escapar(c.rotulo)).join(";"),
      ...conteudo.linhas.map((linha) =>
        conteudo.colunas.map((c) => escapar(celula(linha[c.chave], c.tipo))).join(";")
      ),
    ];
    const arquivo = new Blob(["\uFEFF" + linhas.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const endereco = URL.createObjectURL(arquivo);
    const link = document.createElement("a");
    link.href = endereco;
    link.download = `${relatório.nome.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-")}-${relatório.periodo_inicio}-a-${relatório.periodo_fim}.csv`;
    link.click();
    URL.revokeObjectURL(endereco);
  }

  async function atestar(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api(`/relatorios/${id}/atestar`, { method: "POST", body: { observacao } });
      setAtestando(false);
      setObservacao("");
      carregar();
    } catch (e) {
      alert(e.message);
    } finally {
      setSalvando(false);
    }
  }

  if (erro) return <Cartao><div className="vazio">{erro}</div></Cartao>;
  if (!relatório) return <div className="carregando">Carregando o relatório...</div>;

  const conteudo = relatório.conteudo_snapshot || { colunas: [], linhas: [] };

  return (
    <>
      <div className="cabecalho-pagina esconder-impressao">
        <div>
          <Trilha
            itens={[
              { rotulo: "Frotas" },
              { rotulo: "Relatórios", para: "/frotas/relatorios" },
              { rotulo: relatório.nome },
            ]}
          />
          <h1>{relatório.nome}</h1>
          <p>
            Periodo de {data(relatório.periodo_inicio)} a {data(relatório.periodo_fim)} -{" "}
            {numero(conteudo.linhas.length)} registros
          </p>
        </div>
        <div className="cabecalho-pagina__acoes">
          <button className="botao" onClick={() => navegar("/frotas/relatorios")}>
            <Icone nome="seta-esquerda" tamanho={15} /> Voltar
          </button>
          <button className="botao" onClick={baixarCsv}>
            <Icone nome="baixar" tamanho={15} /> Baixar
          </button>
          <button className="botao" onClick={() => window.print()}>
            <Icone nome="arrow-up" tamanho={15} /> Imprimir / PDF
          </button>
          {podeAtestar && podeAtestarAgora && (
            <button className="botao botao--primario" onClick={() => setAtestando(true)}>
              <Icone nome="salvar" tamanho={15} monocromatico /> Atestar relatório
            </button>
          )}
        </div>
      </div>

      {relatório.integro === false && (
        <div className="login__erro esconder-impressao">
          Atencao: o conteudo salvo deste relatório nao confere com o selo gerado na
          criacao. Procure a administração do sistema.
        </div>
      )}

      <article className="documento">
        <header className="documento__cabecalho">
          {/* Versao escura: o relatorio e impresso em papel branco, e a logo de
              letras brancas sumiria ali. */}
          <img src="/icons/logo-sitra-escura.png" alt="SITRA" className="documento__logo" />
          <div className="documento__selo">
            <Selo
              texto={relatório.status === "ATESTADO" ? "Atestado" : "Aguardando ateste"}
              tom={relatório.status === "ATESTADO" ? "verde" : "amarelo"}
            />
          </div>
        </header>

        <div className="documento__titulo">
          <h2>{relatório.nome}</h2>
          <dl className="documento__identificacao">
            <div>
              <dt>Período</dt>
              <dd>{data(relatório.periodo_inicio)} a {data(relatório.periodo_fim)}</dd>
            </div>
            <div><dt>Gerado em</dt><dd>{dataHora(relatório.data_geracao)}</dd></div>
            <div>
              <dt>Gerado por</dt>
              <dd>{relatório.gerado_por_nome} - {relatório.gerado_por_cargo}</dd>
            </div>
            <div><dt>Setor</dt><dd>{relatório.gerado_por_setor}</dd></div>
            <div><dt>Registros</dt><dd>{numero(conteudo.linhas.length)}</dd></div>
            <div>
              <dt>Código de verificacao</dt>
              <dd className="documento__hash">{relatório.hash_sha256?.slice(0, 16) || "—"}</dd>
            </div>
          </dl>
        </div>

        <div className="documento__tabela rolagem-x">
          <table className="tabela tabela--documento">
            <thead>
              <tr>
                <th>#</th>
                {conteudo.colunas.map((c) => <th key={c.chave}>{c.rotulo}</th>)}
              </tr>
            </thead>
            <tbody>
              {conteudo.linhas.map((linha, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  {conteudo.colunas.map((c) => (
                    <td key={c.chave}>{celula(linha[c.chave], c.tipo)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {conteudo.linhas.length === 0 && (
            <div className="vazio">Nenhum registro encontrado no período escolhido.</div>
          )}
        </div>

        <footer className="documento__rodape">
          {/* Ate TRES assinaturas, lado a lado. Quem ainda nao atestou aparece
              como linha em branco: no papel, o espaco vazio e o convite para
              assinar - some-lo esconderia que faltam atestos. */}
          <div className="documento__assinaturas">
            {atestacoes.map((a) => (
              <div className="documento__assinatura" key={a.ordem}>
                <p className="documento__ateste">Atestado por</p>
                <p className="documento__assinante">{a.nome}</p>
                <p className="documento__cargo">{a.cargo}</p>
                <p className="documento__quando">Em {dataHora(a.data_atestacao)}</p>
                {a.observacao && <p className="documento__observacao">{a.observacao}</p>}
              </div>
            ))}
            {atestacoes.length === 0 && (
              <div className="documento__assinatura">
                <p className="documento__ateste">Aguardando ateste do responsável</p>
                <p className="documento__assinante">_______________________________</p>
                <p className="documento__cargo">Nome e cargo do responsável</p>
              </div>
            )}
          </div>

          <div className="documento__orgao-rodape">
            <img src="/icons/cmtt-logo.svg" alt="CMTT" className="documento__logo-cmtt" />
            <div>
              <strong>Companhia Municipal de Trânsito e Transporte</strong>
              <small>
                Documento gerado automaticamente pelo SITRA. Não necessita de
                assinatura quando usado para fins internos da administração.
              </small>
            </div>
          </div>
        </footer>
      </article>

      {atestando && (
        <Modal
          titulo="Atestar relatório"
          legenda="Seu nome, cargo, data e hora ficam registrados no sistema."
          aoFechar={() => setAtestando(false)}
          rodape={
            <>
              <button className="botao" onClick={() => setAtestando(false)}>Cancelar</button>
              <button className="botao botao--primario" form="form-ateste" disabled={salvando}>
                {salvando ? "Atestando..." : "Confirmar ateste"}
              </button>
            </>
          }
        >
          <form id="form-ateste" onSubmit={atestar}>
            <p className="modal__aviso">
              Ao atestar, voce confirma que conferiu os {numero(conteudo.linhas.length)}{" "}
              registros deste relatório. O ateste nao pode ser desfeito pela tela.
            </p>
            <Area rotulo="Observação (opcional)" id="observacao" value={observacao}
                  placeholder="Ex.: Conferido e de acordo" onChange={(e) => setObservacao(e.target.value)} />
          </form>
        </Modal>
      )}
    </>
  );
}
