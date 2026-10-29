/**
 * PainelAlertas.jsx - Cartao "Alertas" da coluna lateral dos paineis (Frotas
 * e Fiscalizacao). Saiu de dentro do PainelFrotas (26/10) para a Fiscalizacao
 * ter o mesmo cartao.
 *
 * Os avisos sao os MESMOS do sininho (rota /alertas), filtrados pelo painel:
 * cada aviso diz em `modulos` a que painel pertence. Na Fiscalizacao entram
 * so os dela (documento das viaturas, CNH e multa dos fiscais, viatura sem
 * devolucao, equipamento faltando, relatorio da Fiscalizacao para atestar).
 *
 * Os avisos ficam agrupados pelo titulo ("Documento vencido"...). Um aviso so:
 * o clique abre o proprio registro. Varios: abre uma listinha logo abaixo do
 * botao com cada aviso, e o "Ver todos" quando existe uma lista que ja mostra
 * todos.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Cartao from "./Cartao.jsx";
import { TituloPainel } from "./PainelUi.jsx";
import Icone from "./Icone.jsx";
import MenuSuspenso from "./MenuSuspenso.jsx";
import { numero } from "../lib/formato.js";
import { api } from "../lib/api.js";

// Mesma ordem de gravidade da rota /alertas: o que esta vencido vem primeiro.
const ORDEM_PRIORIDADE = { CRITICA: 1, ALTA: 2, MEDIA: 3, BAIXA: 4 };

/** Lista que mostra todos os avisos do grupo ("Ver todos"), por painel. */
function listaDoGrupo(g, modulo) {
  const vencido = /vencid/i.test(g.titulo);
  if (modulo === "FISCALIZACAO") {
    return {
      ATESTE_PENDENTE: "/fiscalizacao/relatorios?status=MEU_ATESTE",
      CHECKLIST_FISC_ABERTO: "/fiscalizacao/checklists",
      EQUIPAMENTO_FALTANDO: "/fiscalizacao/equipamentos",
    }[g.tipo];
  }
  const doc = `/frotas/documentos?status=${vencido ? "VENCIDO" : "VENCENDO"}`;
  // Relatorio: a tela do modulo do relatorio (Frotas ou Fiscalizacao).
  const rel = g.itens.every((i) => String(i.link || "").startsWith("/fiscalizacao")) ? "/fiscalizacao/relatorios" : "/frotas/relatorios";
  return {
    DOCUMENTO_VENCENDO: doc, DOCUMENTO_VENCIDO: doc,
    OS_PENDENTE: "/frotas/manutencoes?status=PENDENTE",
    MANUTENCAO: "/frotas/manutencoes?status=PENDENTE",
    ATESTE_PENDENTE: `${rel}?status=MEU_ATESTE`,
  }[g.tipo];
}

export default function PainelAlertas({ modulo = "FROTAS" }) {
  const navegar = useNavigate();

  // null = ainda carregando; [] = carregou e nao ha aviso.
  const [alertas, setAlertas] = useState(null);
  useEffect(() => {
    let vivo = true;
    api("/alertas")
      .then((r) => vivo && setAlertas(
        (r.itens || [])
          // Aviso sem `modulos` (API antiga) fica so no painel de Frotas.
          .filter((a) => (a.modulos || ["FROTAS"]).includes(modulo))
          .sort((a, b) => (ORDEM_PRIORIDADE[a.prioridade] || 9) - (ORDEM_PRIORIDADE[b.prioridade] || 9))
      ))
      .catch(() => vivo && setAlertas([]));
    return () => { vivo = false; };
  }, [modulo]);

  // Mesmo destino do clique no sininho (Topo.jsx); na Fiscalizacao, o
  // destino dela quando o aviso traz um (ficha da viatura, ficha do fiscal).
  function abrirAlerta(item) {
    const destino = (modulo === "FISCALIZACAO" && item.link_fisc) || item.link;
    if (destino) navegar(destino);
    else if (item.entidade === "servidor") navegar("/frotas/motoristas");
    else if (item.entidade === "documento_veiculo") navegar("/frotas/documentos");
  }

  const grupos = alertas === null ? null : Object.values(
    alertas.reduce((acc, a) => {
      (acc[a.titulo] = acc[a.titulo] || { titulo: a.titulo, tipo: a.tipo, prioridade: a.prioridade, itens: [] }).itens.push(a);
      return acc;
    }, {})
  );

  const [grupoAberto, setGrupoAberto] = useState(null);
  const ancoraGrupo = useRef(null);
  const fecharGrupo = () => setGrupoAberto(null);
  function abrirGrupo(g, evento) {
    if (g.itens.length === 1) { abrirAlerta(g.itens[0]); return; }
    ancoraGrupo.current = evento.currentTarget;
    setGrupoAberto((atual) => (atual?.titulo === g.titulo ? null : g));
  }
  const verTodos = grupoAberto && listaDoGrupo(grupoAberto, modulo);

  return (
    <>
      <Cartao titulo={<TituloPainel icone="bell" tom="vermelho">Alertas</TituloPainel>}>
        <div className="lista-lateral">
          {grupos === null ? (
            <span className="painel-rodape__vazio">Carregando avisos...</span>
          ) : grupos.length === 0 ? (
            <span className="painel-rodape__vazio">Nenhum aviso no momento.</span>
          ) : (
            grupos.map((g) => (
              <button key={g.titulo} type="button" className="acao-rapida acao-rapida--alerta"
                      onClick={(e) => abrirGrupo(g, e)} aria-expanded={grupoAberto?.titulo === g.titulo}>
                <span className={`alerta-item__marca alerta-item__marca--${(g.prioridade || "BAIXA").toLowerCase()}`} />
                <span className="lista-lateral__texto">{g.titulo}</span>
                <span className="acao-rapida__conta">{numero(g.itens.length)}</span>
                <span className="pa-seta" aria-hidden="true">›</span>
              </button>
            ))
          )}
        </div>
      </Cartao>

      <MenuSuspenso aberto={Boolean(grupoAberto)} aoFechar={fecharGrupo} ancora={ancoraGrupo}
                    largura={380} alinhamento="esquerda" classe="menu-suspenso--alertas">
        {grupoAberto && (
          <>
            <div className="menu-suspenso__cabecalho">
              <div className="topo__usuario-nome">{grupoAberto.titulo}</div>
              <div className="topo__usuario-perfil">{`${grupoAberto.itens.length} avisos`}</div>
            </div>
            <div className="alertas-lista">
              {grupoAberto.itens.map((item) => (
                <button key={item.id_alerta} role="menuitem" className="alerta-item"
                        onClick={() => { fecharGrupo(); abrirAlerta(item); }}>
                  <span className={`alerta-item__marca alerta-item__marca--${(item.prioridade || "BAIXA").toLowerCase()}`} />
                  <span className="alerta-item__texto">
                    <span className="alerta-item__mensagem">{item.mensagem}</span>
                  </span>
                </button>
              ))}
            </div>
            {verTodos && (
              <button role="menuitem" className="painel-grupo__todos"
                      onClick={() => { fecharGrupo(); navegar(verTodos); }}>
                Ver todos <Icone nome="seta-direita" tamanho={14} />
              </button>
            )}
          </>
        )}
      </MenuSuspenso>
    </>
  );
}
