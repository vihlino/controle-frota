/**
 * PaginaLista.jsx - O molde visual de toda tela de listagem.
 *
 * Desenha, nesta ordem: trilha de navegacao, titulo, botao de acao, cartoes de
 * KPI (opcionais), barra de filtros, tabela e rodape com paginacao.
 *
 * Não tem logica de dados: recebe pronto o objeto vindo do useLista. Assim o
 * "como aparece" fica aqui e o "de onde vem" fica la.
 */
import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import Icone from "./Icone.jsx";
import Trilha from "./Trilha.jsx";
import Kpi from "./Kpi.jsx";
import { Tabela, Paginacao } from "./Tabela.jsx";
import { numero } from "../lib/formato.js";

// Molde de toda tela de listagem do SITRA: trilha, titulo, botao de acao,
// KPIs opcionais, barra de filtros, tabela e rodape com paginacao.
export default function PaginaLista({
  trilha,
  titulo,
  descricao,
  acao,
  kpis,
  secao,
  filtros,
  lista,
  colunas,
  chaveDe,
  unidade = "registros",
  vazio,
  aoExportar,
  children,
}) {
  const { definirCabecalho } = useOutletContext();

  // Nao existe mais botao "Filtros". A busca e os seletores aplicam sozinhos,
  // a cada tecla; um botao para "abrir os filtros" que ja estao abertos e
  // aplicando nao decide nada - so ocupa espaco e faz duvidar se algo ficou
  // por aplicar. Ficou so o "Limpar", que faz uma coisa que ninguem consegue
  // fazer sozinho: zerar todos os campos de uma vez.

  useEffect(() => {
    definirCabecalho({ titulo, legenda: descricao });
  }, [definirCabecalho, titulo, descricao]);

  const { resultado, carregando, erro, pagina, setPagina, porPagina, setPorPagina,
          ordem, ordenarPor, limpar } = lista;

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          {trilha && <Trilha itens={trilha} />}
          <h1>{titulo}</h1>
          {descricao && <p>{descricao}</p>}
        </div>
        {acao}
      </div>

      {kpis && (
        <div className="kpis">
          {kpis.map((k) => (
            <Kpi key={k.rotulo} {...k} />
          ))}
        </div>
      )}

      {secao}

      {filtros && (
        <div className="cartao filtros" data-aberto="true">
          {filtros}
          <div className="filtros__acoes">
            <button className="botao" onClick={limpar}>
              <Icone nome="limpar-filtros" tamanho={15} /> Limpar
            </button>
          </div>
        </div>
      )}

      <section className="cartao">
        <header className="cartao__topo cartao__topo--tabela">
          <span className="cartao__contagem">
            {resultado ? `${numero(resultado.total)} ${unidade}` : "Carregando..."}
          </span>
          {aoExportar && (
            <button className="botao cartao__acao-botao" onClick={aoExportar}>
              <Icone nome="arrow-up" tamanho={15} /> Exportar
            </button>
          )}
        </header>

        {erro ? (
          <div className="vazio">{erro}</div>
        ) : (
          <Tabela
            colunas={colunas}
            linhas={resultado?.itens}
            chaveDe={chaveDe}
            ordem={ordem}
            ordenarPor={ordenarPor}
            vazio={vazio}
            carregando={carregando}
          />
        )}

        {resultado && (
          <Paginacao
            pagina={pagina}
            setPagina={setPagina}
            porPagina={porPagina}
            setPorPagina={setPorPagina}
            total={resultado.total}
            paginas={resultado.paginas}
            unidade={unidade}
          />
        )}
      </section>

      {children}
    </>
  );
}
