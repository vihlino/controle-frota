/**
 * Topo.jsx - A barra superior.
 *
 * Traz o botao de recolher o menu, o titulo da tela, a busca (com atalho
 * Ctrl+K), o sininho de alertas e o menu do usuário com a saida.
 *
 * Dois detalhes de comportamento: o menu do usuário fecha ao clicar fora, e o
 * Ctrl+K joga o foco na busca. Os dois usam listeners no documento, sempre
 * removidos na limpeza do useEffect para nao acumular.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import AjudaTela from "./AjudaTela.jsx";
import Icone from "./Icone.jsx";
import MenuSuspenso from "./MenuSuspenso.jsx";
import { useLocation, useNavigate } from "react-router-dom";
import { useSessao } from "../lib/sessao.jsx";
import { api } from "../lib/api.js";

export default function Topo({ titulo, legenda, icone, aoAlternarMenu }) {
  const { usuario, sair } = useSessao();
  const navegar = useNavigate();
  const [menuAberto, setMenuAberto] = useState(false);
  const [alertasAberto, setAlertasAberto] = useState(false);
  const [alertas, setAlertas] = useState([]);
  const caixa = useRef(null);
  const sino = useRef(null);

  // A rota devolve { itens, naoLidos }. Antes so o numero era guardado, e por
  // isso o sininho nao tinha o que mostrar ao ser clicado.
  useEffect(() => {
    api("/alertas")
      .then((r) => setAlertas(r.itens || []))
      .catch(() => {});
  }, []);

  // O sininho mostra so os avisos do modulo da tela aberta (26/10): nas telas
  // da Fiscalizacao, so os da Fiscalizacao (documento das viaturas, CNH e
  // multa dos fiscais...); nas do Frotas, so os do Frotas. No Dashboard vale
  // a aba aberta (?painel=). Nas outras telas (Administracao, Auditoria, TI)
  // aparecem todos. Cada aviso diz em `modulos` a que painel pertence.
  const { pathname, search } = useLocation();
  const painel = new URLSearchParams(search).get("painel");
  const moduloDaTela = pathname.startsWith("/fiscalizacao") ? "FISCALIZACAO"
    : pathname.startsWith("/frotas") ? "FROTAS"
      : pathname.startsWith("/dashboard") || pathname === "/"
        ? ({ frotas: "FROTAS", fiscalizacao: "FISCALIZACAO" }[painel] || null)
        : null;
  const doModulo = moduloDaTela
    ? alertas.filter((a) => (a.modulos || ["FROTAS"]).includes(moduloDaTela))
    : alertas;
  // "Marcar todas como lidas" (29/10): fica guardado neste navegador. O aviso
  // lido sai da contagem do sino e aparece apagado no fim da lista; volta a
  // contar se mudar (outro numero de dias, por exemplo).
  const [lidos, setLidos] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("sitra.alertasLidos") || "[]")); } catch { return new Set(); }
  });
  const chaveAlerta = (a) => `${a.id_alerta}|${a.mensagem}`;
  const visiveis = doModulo.filter((a) => !lidos.has(chaveAlerta(a)));
  const [filtroAlerta, setFiltroAlerta] = useState("todas");
  const critica = (a) => a.prioridade === "CRITICA";
  const listaAlertas = [...visiveis, ...doModulo.filter((a) => lidos.has(chaveAlerta(a)))]
    .filter((a) => filtroAlerta === "todas" || (filtroAlerta === "criticas" ? critica(a) : !critica(a)));
  function marcarLidas() {
    const novo = new Set([...lidos, ...doModulo.map(chaveAlerta)]);
    setLidos(novo);
    try { localStorage.setItem("sitra.alertasLidos", JSON.stringify([...novo].slice(-500))); } catch { /* sem armazenamento */ }
  }
  const ICONE_ALERTA = { CNH_VENCENDO: "cnh", DOCUMENTO_VENCENDO: "documento", MULTA_VENCENDO: "dinheiro",
    OS_PENDENTE: "kpi-wrench", ATESTE_PENDENTE: "arquivo-texto", CHECKLIST_FISC_ABERTO: "checklist" };
  const quandoAlerta = (a) => {
    const m = /h[aá] (\d+) dia/i.exec(a.mensagem || "");
    if (m) return `Há ${m[1]} dias`;
    const e = /em (\d+) dia/i.exec(a.mensagem || "");
    if (e) return `Em ${e[1]} dias`;
    return /hoje/i.test(a.mensagem || "") ? "Hoje" : null;
  };

  // Fechar ao clicar fora, no Esc e ao rolar e responsabilidade do
  // MenuSuspenso - nao repetir aqui, senao viram dois ouvintes disputando.
  const fecharMenu = useCallback(() => setMenuAberto(false), []);
  const fecharAlertas = useCallback(() => setAlertasAberto(false), []);

  // Cada alerta aponta para o cadastro que precisa de atencao. Sem isso o
  // aviso obriga a pessoa a procurar na mao o servidor ou o veiculo citado.
  //
  // O endereco vem PRONTO da API (item.link), ja com a pesquisa: o nome do
  // motorista, a placa do veiculo. Quem monta o alerta sabe o que ele aponta;
  // a tela so segue.
  function abrirAlerta(item) {
    setAlertasAberto(false);
    const destino = (moduloDaTela === "FISCALIZACAO" && item.link_fisc) || item.link;
    if (destino) navegar(destino);
    else if (item.entidade === "servidor") navegar("/frotas/motoristas");
    else if (item.entidade === "documento_veiculo") navegar("/frotas/documentos");
  }

  const iniciais = (usuario?.nome || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");

  return (
    <header className="topo">
      <button className="topo__botao-menu" onClick={aoAlternarMenu} aria-label="Alternar menu">
        <Icone nome="menu" tamanho={24} />
      </button>

      {/* As telas de lista ja tem o proprio cabecalho, com trilha, titulo e
          botao de acao. Repetir o titulo aqui em cima era dizer a mesma coisa
          duas vezes, uma embaixo da outra. Quem nao tem cabecalho proprio - o
          painel, com a saudacao - publica o titulo e ele aparece aqui. */}
      {titulo ? (
        <div className="topo__cabeca">
          {/* O sol (ou a lua) ao lado da saudacao do Dashboard (29/10). */}
          {icone && <span className="topo__icone-titulo"><Icone nome={icone} tamanho={26} monocromatico /></span>}
          <div>
            <div className="topo__titulo">{titulo}<AjudaTela /></div>
            {legenda && <div className="topo__legenda">{legenda}</div>}
          </div>
        </div>
      ) : (
        <div className="topo__vazio" />
      )}

      {/* Este wrapper e quem empurra o sino e o usuario para a direita
          (margin-left: auto no CSS). O empurrao NAO pode ficar no botao:
          dentro do wrapper ele so afasta o botao das proprias bordas, e a
          barra inteira volta para o meio da tela. */}
      <div className="topo__alertas">
        <button ref={sino} className="topo__sino" aria-label="Alertas"
                aria-haspopup="menu" aria-expanded={alertasAberto}
                onClick={() => setAlertasAberto((v) => !v)}>
          <Icone nome="bell" tamanho={22} />
          {visiveis.length > 0 && <span className="topo__contador">{visiveis.length}</span>}
        </button>

        <MenuSuspenso aberto={alertasAberto} aoFechar={fecharAlertas}
                      ancora={sino} largura={460} alinhamento="esquerda"
                      classe="menu-suspenso--alertas ca">
          <div className="ca__topo">
            <span className="ca__sino"><Icone nome="bell" tamanho={26} monocromatico /></span>
            <span>
              <strong>Central de alertas</strong>
              <small>{visiveis.length === 0 ? "Nenhum aviso pendente" : `${visiveis.length} aviso${visiveis.length === 1 ? "" : "s"} pendente${visiveis.length === 1 ? "" : "s"}`}</small>
            </span>
          </div>
          <div className="ca__filtros" role="tablist">
            {[["todas", "Todas", visiveis.length], ["criticas", "Críticas", visiveis.filter(critica).length],
              ["avisos", "Avisos", visiveis.filter((a) => !critica(a)).length]].map(([k, r, n]) => (
              <button key={k} type="button" role="tab" className="ca__filtro" data-tipo={k}
                      data-ativo={filtroAlerta === k ? "sim" : undefined} onClick={() => setFiltroAlerta(k)}>
                {r} <span>{n}</span>
              </button>
            ))}
          </div>

          <div className="alertas-lista ca__lista">
            {listaAlertas.length === 0 ? (
              <p className="alertas-lista__vazio">Nada por aqui. Os avisos aparecem 30 dias antes de vencer.</p>
            ) : (
              listaAlertas.map((item) => {
                const lido = lidos.has(chaveAlerta(item));
                return (
                  <button key={`${item.id_alerta}-${item.mensagem}`} role="menuitem"
                          className="ca__item" data-critica={critica(item) ? "sim" : undefined} data-lido={lido ? "sim" : undefined}
                          onClick={() => abrirAlerta(item)}>
                    <span className="ca__icone"><Icone nome={ICONE_ALERTA[item.tipo] || "alert-triangle"} tamanho={22} monocromatico /></span>
                    <span className="ca__texto">
                      <strong>{item.titulo}</strong>
                      <span>{item.mensagem}</span>
                    </span>
                    {quandoAlerta(item) && <span className="ca__quando">{quandoAlerta(item)}</span>}
                    <Icone nome="chevron-right" tamanho={14} />
                  </button>
                );
              })
            )}
          </div>
          <div className="ca__rodape">
            <button type="button" onClick={marcarLidas} disabled={visiveis.length === 0}>
              <Icone nome="visualizar" tamanho={16} /> Marcar todas como lidas
            </button>
            <button type="button" className="ca__todas" onClick={() => {
              setAlertasAberto(false);
              navegar(`/dashboard${moduloDaTela === "FISCALIZACAO" ? "?painel=fiscalizacao" : moduloDaTela === "FROTAS" ? "?painel=frotas" : ""}`);
            }}>
              Ver todos os alertas <Icone nome="seta-direita" tamanho={14} monocromatico />
            </button>
          </div>
        </MenuSuspenso>
      </div>

      <div className="relativo">
        <button ref={caixa} className="topo__usuario"
                onClick={() => setMenuAberto((v) => !v)}
                aria-haspopup="menu" aria-expanded={menuAberto}>
          <span className="avatar">{iniciais}</span>
          <span className="topo__usuario-texto">
            <span className="topo__usuario-nome">{usuario?.nome}</span>
            <span className="topo__usuario-perfil">{usuario?.perfil}</span>
          </span>
          <Icone nome="chevron-down" tamanho={15} />
        </button>

        <MenuSuspenso aberto={menuAberto} aoFechar={fecharMenu} ancora={caixa} largura={260}>
          <div className="menu-suspenso__cabecalho">
            <div className="topo__usuario-nome">{usuario?.nome}</div>
            <div className="topo__usuario-perfil">
              {usuario?.cargo_funcao} - {usuario?.setor}
            </div>
            <div className="topo__usuario-perfil">Matrícula {usuario?.matricula}</div>
          </div>
          <button role="menuitem" onClick={sair}>Sair do sistema</button>
        </MenuSuspenso>
      </div>
    </header>
  );
}
