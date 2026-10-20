/**
 * Pontuacao.jsx - Pontuacao dos fiscais (desenho do Cesar, 18/10).
 *
 * A classificacao dos fiscais no periodo: a pontuacao (a lancada para o
 * fiscal e a da equipe em que ele estava no dia), com as multas, as
 * ocorrencias atendidas e os checklists do mesmo periodo. Ao lado, os
 * detalhes do fiscal escolhido. Tela restrita a quem gerencia a pontuacao.
 *
 * Do desenho saiu o que o SITRA nao tem: motoristas (pontuacao e da
 * Fiscalizacao), a "situacao" (Boa / Em atencao / Critica - nao ha regra
 * de faixas no sistema) e a conformidade dos checklists. O "Exportar" virou
 * "Gerar relatório", que abre o Relatorio de Pontuacao. Os itens de
 * pontuacao (o catalogo) ficam em /fiscalizacao/pontuacao/itens.
 */
import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import AjudaTela from "../../components/AjudaTela.jsx";
import Acoes from "../../components/Acoes.jsx";
import { Tabela, Paginacao } from "../../components/Tabela.jsx";
import { Selecao, Texto, Periodo } from "../../components/Campos.jsx";
import { useLista } from "../../components/useLista.js";
import { api } from "../../lib/api.js";
import { data, numero } from "../../lib/formato.js";
import { iniciais } from "../ServidorDetalhe.jsx";

function Pontos({ valor, grande }) {
  const n = Number(valor || 0);
  return <strong className={`fd-pontos${grande ? " pt-pontos--grande" : ""}`} data-sinal={n > 0 ? "mais" : n < 0 ? "menos" : "zero"}>
    {n > 0 ? "+" : ""}{numero(n, Number.isInteger(n) ? 0 : 1)}
  </strong>;
}

export default function Pontuacao() {
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const lista = useLista("fiscalizacao/pontuacao/ranking", { busca: "", equipe: "", dataDe: "", dataAte: "" });
  const [equipes, setEquipes] = useState([]);
  const [escolhido, setEscolhido] = useState(null);
  const [lancamentos, setLancamentos] = useState(null);

  useEffect(() => { definirCabecalho({ titulo: "", legenda: "" }); }, [definirCabecalho]);
  useEffect(() => {
    api("/fiscalizacao/equipes/opcoes?status=true").then((r) => setEquipes(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  const itens = lista.resultado?.itens || [];
  // O painel acompanha a lista: o fiscal escolhido continua (com os numeros
  // do novo periodo) e, se ele saiu da lista, fica o primeiro.
  const atual = itens.find((i) => i.id_servidor === escolhido) || itens[0] || null;
  const { dataDe, dataAte } = lista.filtros;
  useEffect(() => {
    if (!atual) { setLancamentos(null); return; }
    setLancamentos(null);
    const q = new URLSearchParams();
    if (dataDe) q.set("dataDe", dataDe);
    if (dataAte) q.set("dataAte", dataAte);
    api(`/fiscalizacao/pontuacao/servidor/${atual.id_servidor}?${q}`)
      .then((r) => setLancamentos(Array.isArray(r) ? r : []))
      .catch(() => setLancamentos([]));
  }, [atual?.id_servidor, dataDe, dataAte]);

  const colunas = [
    { chave: "posicao", rotulo: "#", render: (l) => <span className="pt-posicao">{l.posicao}</span> },
    {
      chave: "nome", rotulo: "Nome", classe: "coluna-flexivel",
      render: (l) => (
        <button type="button" className="pt-nome" data-ativo={atual?.id_servidor === l.id_servidor}
                onClick={() => setEscolhido(l.id_servidor)}>
          {l.nome}
        </button>
      ),
    },
    { chave: "matricula", rotulo: "Matrícula" },
    { chave: "equipe", rotulo: "Equipe", render: (l) => l.equipe || "—" },
    { chave: "multas", rotulo: "Multas", render: (l) => numero(l.multas) },
    { chave: "ocorrencias", rotulo: "Ocorrências", render: (l) => numero(l.ocorrencias) },
    { chave: "checklists", rotulo: "Checklists", render: (l) => numero(l.checklists) },
    { chave: "pontos", rotulo: "Pontuação", render: (l) => <span className="pt-chip"><Pontos valor={l.pontos} /></span> },
    {
      chave: "acoes", rotulo: "Ações",
      render: (l) => (
        <Acoes acoes={[
          { rotulo: "Visualizar", icone: "visualizar", aoClicar: () => setEscolhido(l.id_servidor) },
          { rotulo: "Ver ficha do fiscal", icone: "motorista", aoClicar: () => navegar(`/fiscalizacao/fiscais/${l.id_servidor}?aba=pontuacao`) },
        ]} />
      ),
    },
  ];

  const periodoTexto = dataDe || dataAte
    ? `${dataDe ? data(dataDe) : "início"} a ${dataAte ? data(dataAte) : "hoje"}`
    : "Todo o período";

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <Trilha itens={[{ rotulo: "Fiscalização" }, { rotulo: "Pontuação" }]} />
          <h1>Pontuação<AjudaTela texto="A pontuação dos fiscais no período: a lançada para o fiscal e a da equipe em que ele estava no dia, com as multas, as ocorrências atendidas e os checklists do mesmo período." /></h1>
        </div>
        <div className="cabecalho-pagina__acoes">
          <button className="botao" onClick={() => navegar("/fiscalizacao/pontuacao/itens")}>
            <Icone nome="fisc-bolt" tamanho={15} /> Itens de pontuação
          </button>
          <button className="botao botao--primario" onClick={() => navegar("/fiscalizacao/relatorios?gerar=FISC_PONTUACAO")}>
            <Icone nome="chart-line" tamanho={15} /> Gerar relatório
          </button>
        </div>
      </div>

      <div className="cartao filtros" data-aberto="true">
        <Periodo id="periodo" de={dataDe} ate={dataAte}
                 aoMudarDe={(v) => lista.alterarFiltro("dataDe", v)}
                 aoMudarAte={(v) => lista.alterarFiltro("dataAte", v)} />
        <Selecao rotulo="Equipe" id="equipe" vazio="Todas as equipes"
                 opcoes={equipes.map((e) => ({ valor: e.id_equipe, rotulo: e.numero }))}
                 value={lista.filtros.equipe} onChange={(e) => lista.alterarFiltro("equipe", e.target.value)} />
        <Texto rotulo="Buscar" id="busca" placeholder="Nome ou matrícula"
               value={lista.filtros.busca} onChange={(e) => lista.alterarFiltro("busca", e.target.value)} />
        <div className="filtros__acoes">
          <button className="botao" onClick={lista.limpar}>
            <Icone nome="limpar-filtros" tamanho={15} /> Limpar
          </button>
        </div>
      </div>

      <div className="pt-corpo">
        <section className="cartao">
          <header className="cartao__topo cartao__topo--tabela">
            <span className="cartao__contagem pt-titulo">
              <Icone nome="fisc-bolt" tamanho={18} /> Pontuação dos Fiscais
              <small>{periodoTexto}</small>
            </span>
          </header>
          {lista.erro ? <div className="vazio">{lista.erro}</div> : (
            <Tabela colunas={colunas} linhas={lista.resultado?.itens} chaveDe={(l) => l.id_servidor}
                    vazio="Nenhum fiscal com esses filtros." carregando={lista.carregando} />
          )}
          {lista.resultado && (
            <Paginacao pagina={lista.pagina} setPagina={lista.setPagina} porPagina={lista.porPagina}
                       setPorPagina={lista.setPorPagina} total={lista.resultado.total}
                       paginas={lista.resultado.paginas} unidade="fiscais" />
          )}
        </section>

        <Cartao titulo={<><Icone nome="motorista" tamanho={18} /> Detalhes da Pontuação</>}>
          {!atual ? <p className="texto-corrido">Escolha um fiscal na lista.</p> : (
            <>
              <div className="pt-pessoa">
                <span className="pt-avatar">{iniciais(atual.nome)}</span>
                <div>
                  <strong>{atual.nome}</strong>
                  <span>{atual.cargo || "Fiscal"}</span>
                  <span>Matrícula: {atual.matricula}</span>
                </div>
                <div className="pt-total">
                  <Pontos valor={atual.pontos} grande />
                  <small>Pontuação</small>
                </div>
              </div>
              <dl className="pt-numeros">
                <div><dt><Icone nome="fisc-bolt" tamanho={18} /> Pontos positivos</dt><dd><Pontos valor={atual.positivos} /></dd></div>
                <div><dt><Icone nome="alert-triangle" tamanho={18} /> Pontos de penalidade</dt><dd><Pontos valor={atual.negativos} /></dd></div>
                <div><dt><Icone nome="cnh" tamanho={18} /> Multas</dt><dd>{numero(atual.multas)}</dd></div>
                <div><dt><Icone nome="fisc-ocorrencias" tamanho={18} /> Ocorrências atendidas</dt><dd>{numero(atual.ocorrencias)}</dd></div>
                <div><dt><Icone nome="checklist" tamanho={18} /> Checklists realizados</dt><dd>{numero(atual.checklists)}</dd></div>
              </dl>
              <h3 className="formulario__secao">Lançamentos no período</h3>
              {lancamentos === null ? <div className="carregando">Carregando...</div>
                : lancamentos.length === 0 ? <p className="texto-corrido">Nenhum lançamento no período.</p> : (
                  <ul className="pt-lancamentos">
                    {lancamentos.slice(0, 8).map((r) => (
                      <li key={r.id_pontuacao}>
                        <span>
                          <strong>{r.codigo} - {r.item}</strong>
                          <small>{data(r.data_registro)} · {r.individual ? "Individual" : `Equipe ${r.equipe}`}{Number(r.quantidade) !== 1 ? ` · ${numero(r.quantidade)}x` : ""}</small>
                        </span>
                        <Pontos valor={r.pontos_aplicados} />
                      </li>
                    ))}
                  </ul>
                )}
              <button type="button" className="botao pt-ficha" onClick={() => navegar(`/fiscalizacao/fiscais/${atual.id_servidor}?aba=pontuacao`)}>
                <Icone nome="motorista" tamanho={15} /> Ver ficha do fiscal
              </button>
            </>
          )}
        </Cartao>
      </div>
    </>
  );
}
