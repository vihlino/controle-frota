/**
 * RelatorioVer.jsx - O relatorio como documento oficial.
 *
 * Nao e uma tela de cards: e um documento, com cabecalho da CMTT, identificacao
 * do relatorio, a tabela com os registros reais, area de assinatura e rodape
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

// O relatorio nao e uma tela de cards: e um documento oficial, com cabecalho,
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

export default function RelatorioVer() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const { podeVer } = useSessao();
  const [relatorio, setRelatorio] = useState(null);
  const [erro, setErro] = useState("");
  const [atestando, setAtestando] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const podeAtestar = podeVer("RELATORIOS_ATESTAR");

  useEffect(() => {
    definirCabecalho({ titulo: "Relatorio", legenda: "Documento oficial gerado pelo SITRA" });
  }, [definirCabecalho]);

  function carregar() {
    api(`/relatorios/${id}`).then(setRelatorio).catch((e) => setErro(e.message));
  }
  useEffect(carregar, [id]);

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
  if (!relatorio) return <div className="carregando">Carregando o relatorio...</div>;

  const conteudo = relatorio.conteudo_snapshot || { colunas: [], linhas: [] };
  const ateste = relatorio.atestacoes?.find((a) => a.status === "ATESTADO");

  return (
    <>
      <div className="cabecalho-pagina esconder-impressao">
        <div>
          <Trilha
            itens={[
              { rotulo: "Frotas" },
              { rotulo: "Relatorios", para: "/frotas/relatorios" },
              { rotulo: relatorio.nome },
            ]}
          />
          <h1>{relatorio.nome}</h1>
          <p>
            Periodo de {data(relatorio.periodo_inicio)} a {data(relatorio.periodo_fim)} -{" "}
            {numero(conteudo.linhas.length)} registros
          </p>
        </div>
        <div className="cabecalho-pagina__acoes">
          <button className="botao" onClick={() => navegar("/frotas/relatorios")}>Voltar</button>
          <button className="botao" onClick={() => window.print()}>
            <Icone nome="arrow-up" tamanho={15} /> Imprimir / PDF
          </button>
          {podeAtestar && relatorio.status !== "ATESTADO" && relatorio.status !== "CANCELADO" && (
            <button className="botao botao--primario" onClick={() => setAtestando(true)}>
              Atestar relatorio
            </button>
          )}
        </div>
      </div>

      {relatorio.integro === false && (
        <div className="login__erro esconder-impressao">
          Atencao: o conteudo salvo deste relatorio nao confere com o selo gerado na
          criacao. Procure a administracao do sistema.
        </div>
      )}

      <article className="documento">
        <header className="documento__cabecalho">
          <img src="/icons/logo-sitra.svg" alt="" className="documento__logo" />
          <div className="documento__orgao">
            <strong>CMTT</strong>
            <span>Companhia Municipal de Transito e Transporte</span>
          </div>
          <div className="documento__selo">
            <Selo
              texto={relatorio.status === "ATESTADO" ? "Atestado" : "Aguardando ateste"}
              tom={relatorio.status === "ATESTADO" ? "verde" : "amarelo"}
            />
          </div>
        </header>

        <div className="documento__titulo">
          <h2>{relatorio.nome}</h2>
          <dl className="documento__identificacao">
            <div>
              <dt>Periodo</dt>
              <dd>{data(relatorio.periodo_inicio)} a {data(relatorio.periodo_fim)}</dd>
            </div>
            <div><dt>Gerado em</dt><dd>{dataHora(relatorio.data_geracao)}</dd></div>
            <div>
              <dt>Gerado por</dt>
              <dd>{relatorio.gerado_por_nome} - {relatorio.gerado_por_cargo}</dd>
            </div>
            <div><dt>Setor</dt><dd>{relatorio.gerado_por_setor}</dd></div>
            <div><dt>Registros</dt><dd>{numero(conteudo.linhas.length)}</dd></div>
            <div>
              <dt>Codigo de verificacao</dt>
              <dd className="documento__hash">{relatorio.hash_conteudo?.slice(0, 16)}</dd>
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
            <div className="vazio">Nenhum registro encontrado no periodo escolhido.</div>
          )}
        </div>

        <footer className="documento__rodape">
          <div className="documento__assinatura">
            {ateste ? (
              <>
                <p className="documento__ateste">Relatorio atestado por</p>
                <p className="documento__assinante">{ateste.nome}</p>
                <p className="documento__cargo">{ateste.cargo}</p>
                <p className="documento__quando">Em {dataHora(ateste.data_atestacao)}</p>
                {ateste.observacao && (
                  <p className="documento__observacao">{ateste.observacao}</p>
                )}
              </>
            ) : (
              <>
                <p className="documento__ateste">Aguardando ateste do responsavel</p>
                <p className="documento__assinante">_______________________________</p>
                <p className="documento__cargo">Nome e cargo do responsavel</p>
              </>
            )}
          </div>

          <div className="documento__orgao-rodape">
            <strong>CMTT</strong>
            <span>Companhia Municipal de Transito e Transporte</span>
            <small>Documento gerado automaticamente pelo SITRA.</small>
          </div>
        </footer>
      </article>

      {atestando && (
        <Modal
          titulo="Atestar relatorio"
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
              registros deste relatorio. O ateste nao pode ser desfeito pela tela.
            </p>
            <Area rotulo="Observacao (opcional)" id="observacao" value={observacao}
                  onChange={(e) => setObservacao(e.target.value)} />
          </form>
        </Modal>
      )}
    </>
  );
}
