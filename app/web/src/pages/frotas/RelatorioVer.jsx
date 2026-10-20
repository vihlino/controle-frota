/**
 * RelatórioVer.jsx - O relatório como documento oficial.
 *
 * Nao e uma tela de cards: e um documento, com cabecalho da CMTT, identificacao
 * do relatório, a tabela com os registros reais, area de assinatura e rodape
 * oficial. O CSS de impressao esconde menu e topo, entao imprimir gera o PDF.
 *
 * O conteudo vem do snapshot congelado na geracao, nao de consulta nova. O
 * campo "integro" avisa se o conteudo salvo ainda confere com o selo.
 *
 * Cabecalho (07/10): marca da CMTT a esquerda com os dados da companhia,
 * marca do SITRA a direita. Rodape: so as assinaturas dos escolhidos para
 * atestar (Atestado / Aguardando ateste).
 *
 * Baixar e Imprimir (09/10): "Baixar" abre o pop-up de formato (CSV ou PDF,
 * components/BaixarRelatorio.jsx). "Imprimir" imprime so o documento, sem a
 * data, o endereco e o titulo que o navegador poe no alto e no pe da folha:
 * a margem da folha e zero (ai o navegador nao tem onde escrever) e o espaco
 * de cima e de baixo vem da moldura .impressao-moldura, que se repete em
 * cada pagina.
 */
import { useEffect, useState } from "react";
import { useLocation, useOutletContext, useParams, useNavigate } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import Selo from "../../components/Selo.jsx";
import Modal from "../../components/Modal.jsx";
import BaixarRelatorio from "../../components/BaixarRelatorio.jsx";
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
  const fiscalizacao = useLocation().pathname.startsWith("/fiscalizacao");
  const base = fiscalizacao ? "/fiscalizacao/relatorios" : "/frotas/relatorios";
  const { definirCabecalho } = useOutletContext();
  const { podeVer, usuario } = useSessao();
  const [relatório, setRelatório] = useState(null);
  const [erro, setErro] = useState("");
  const [atestando, setAtestando] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [baixando, setBaixando] = useState(false);

  const podeAtestar = podeVer("RELATORIOS_ATESTAR");

  // Relatorio com ateste encaminhado (036): so os escolhidos atestam, cada um
  // uma vez. Relatorios antigos: ate tres pessoas com a permissao.
  const atestacoes = relatório?.atestacoes || [];
  const minha = atestacoes.find((a) => String(a.id_usuario) === String(usuario?.id_usuario));
  const meuPendente = minha?.status === "PENDENTE";
  const podeAtestarAgora = !relatório || relatório.status === "CANCELADO" ? false
    : relatório.ateste_designado
      ? meuPendente
      : podeAtestar && relatório.status !== "GERADO" && atestacoes.length < 3 && !minha;
  const feitos = atestacoes.filter((a) => a.status === "ATESTADO").length;

  useEffect(() => {
    definirCabecalho({ titulo: "", legenda: "" });
  }, [definirCabecalho]);

  // So nesta tela a folha impressa tem margem zero (as outras telas que
  // imprimem continuam com a margem normal): sem margem o navegador nao tem
  // onde escrever data, endereco e titulo. A regra sai quando a tela fecha.
  useEffect(() => {
    const estilo = document.createElement("style");
    estilo.setAttribute("data-impressao", "relatorio");
    estilo.textContent = "@media print { @page { size: A4 landscape; margin: 0; } }";
    document.head.appendChild(estilo);
    return () => estilo.remove();
  }, []);

  function carregar() {
    api(`/relatorios/${id}`).then(setRelatório).catch((e) => setErro(e.message));
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
  if (!relatório) return <div className="carregando">Carregando o relatório...</div>;

  // A API devolve o conteudo congelado na coluna `snapshot` (tabela
  // relatorio). A tela lia `conteudo_snapshot`, que nao existe: todo
  // relatorio aparecia com 0 registros e a tabela vazia.
  const conteudo = relatório.snapshot || relatório.conteudo_snapshot || { colunas: [], linhas: [] };
  const situacao = { ATESTADO: "Atestado", GERADO: "Sem ateste", CANCELADO: "Cancelado" }[relatório.status]
    || (atestacoes.length ? `Aguardando ateste (${feitos} de ${atestacoes.length})` : "Aguardando ateste");

  return (
    <>
      <div className="cabecalho-pagina esconder-impressao">
        <div>
          <Trilha
            itens={[
              { rotulo: fiscalizacao ? "Fiscalização" : "Frotas" },
              { rotulo: "Relatórios", para: base },
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
          <button className="botao" onClick={() => navegar(base)}>
            <Icone nome="seta-esquerda" tamanho={15} /> Voltar
          </button>
          <button className="botao" onClick={() => setBaixando(true)}>
            <Icone nome="baixar" tamanho={15} /> Baixar
          </button>
          <button className="botao" onClick={() => window.print()}>
            <Icone nome="imprimir" tamanho={15} /> Imprimir
          </button>
          {podeAtestarAgora && (
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

      {meuPendente && relatório.status !== "CANCELADO" && (
        <div className="rel-encaminhado esconder-impressao">
          <Icone nome="salvar" tamanho={18} />
          <span>
            <strong>Este relatório foi encaminhado para você atestar.</strong>{" "}
            Confira os registros e clique em "Atestar relatório".
          </span>
        </div>
      )}

      {/* Moldura so da impressao: o espaco de cima e de baixo de cada folha. */}
      <table className="impressao-moldura">
        <thead><tr><td><div className="impressao-moldura__espaco" /></td></tr></thead>
        <tfoot><tr><td><div className="impressao-moldura__espaco" /></td></tr></tfoot>
        <tbody><tr><td>
      <article className="documento">
        <header className="documento__cabecalho">
          <div className="documento__orgao">
            <img src="/icons/cmtt-logo-documento.png" alt="CMTT" className="documento__logo-cmtt" />
            <div>
              <strong>Companhia Municipal de Trânsito e Transporte</strong>
              <span>CMTT · {relatório.modulo === "FISCALIZACAO" ? "Fiscalização" : "Gestão de Frotas"}</span>
              <span>Setor: {relatório.gerado_por_setor}</span>
            </div>
          </div>
          <div className="documento__sistema">
            {/* Versao com letras escuras: o relatorio e impresso em papel branco. */}
            <img src="/icons/logo-sitra-documento.png" alt="SITRA" className="documento__logo" />
            <Selo
              texto={situacao}
              tom={{ ATESTADO: "verde", GERADO: "azul", CANCELADO: "vermelho" }[relatório.status] || "amarelo"}
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

        {/* Rodape: uma assinatura por pessoa escolhida (ate tres, lado a
            lado). Quem ainda nao atestou fica com a linha em branco e
            "Aguardando ateste". Relatorio sem ateste nao tem rodape. */}
        {(atestacoes.length > 0 || relatório.status === "AGUARDANDO_ATESTE") && (
          <footer className="documento__rodape">
            <div className="documento__assinaturas" data-qtd={Math.max(atestacoes.length, 1)}>
              {atestacoes.map((a) => {
                const ok = a.status === "ATESTADO";
                return (
                  <div className="documento__assinatura" data-ok={ok} key={a.ordem}>
                    <p className="documento__ateste">{ok ? "✓ Atestado eletronicamente" : "Aguardando ateste"}</p>
                    <p className="documento__assinante">{a.nome}</p>
                    <p className="documento__cargo">{a.cargo}</p>
                    <p className="documento__quando">{ok ? `Em ${dataHora(a.data_atestacao)}` : "\u00a0"}</p>
                    {ok && a.observacao && <p className="documento__observacao">"{a.observacao}"</p>}
                  </div>
                );
              })}
              {atestacoes.length === 0 && (
                <div className="documento__assinatura">
                  <p className="documento__ateste">Aguardando ateste</p>
                  <p className="documento__assinante">&nbsp;</p>
                  <p className="documento__cargo">Responsável pelo ateste</p>
                  <p className="documento__quando">&nbsp;</p>
                </div>
              )}
            </div>
          </footer>
        )}
      </article>
        </td></tr></tbody>
      </table>

      {baixando && (
        <BaixarRelatorio relatorio={relatório} conteudo={conteudo} celula={celula}
                         situacao={situacao} aoFechar={() => setBaixando(false)} />
      )}

      {atestando && (
        <Modal
          titulo="Atestar relatório"
          legenda="Seu nome, cargo, data e hora ficam registrados no sistema."
          // Mesmo tamanho das outras janelas de confirmacao (18/10).
          largura={480}
          compacto
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
              Ao atestar, você confirma que conferiu os {numero(conteudo.linhas.length)}{" "}
              registros deste relatório. O ateste não pode ser desfeito pela tela.
            </p>
            <Area rotulo="Observação" id="observacao" value={observacao}
                  placeholder="Ex.: Conferido e de acordo" onChange={(e) => setObservacao(e.target.value)} />
          </form>
        </Modal>
      )}
    </>
  );
}
