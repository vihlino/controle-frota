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
import Icone from "./Icone.jsx";
import MenuSuspenso from "./MenuSuspenso.jsx";
import { useNavigate } from "react-router-dom";
import { useSessao } from "../lib/sessao.jsx";
import { api } from "../lib/api.js";

export default function Topo({ titulo, legenda, aoAlternarMenu }) {
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

  // Fechar ao clicar fora, no Esc e ao rolar e responsabilidade do
  // MenuSuspenso - nao repetir aqui, senao viram dois ouvintes disputando.
  const fecharMenu = useCallback(() => setMenuAberto(false), []);
  const fecharAlertas = useCallback(() => setAlertasAberto(false), []);

  // Cada alerta aponta para o cadastro que precisa de atencao. Sem isso o
  // aviso obriga a pessoa a procurar na mao o servidor ou o veiculo citado.
  function abrirAlerta(item) {
    setAlertasAberto(false);
    if (item.entidade === "servidor") navegar("/frotas/motoristas");
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

      <div>
        <div className="topo__titulo">{titulo}</div>
        {legenda && <div className="topo__legenda">{legenda}</div>}
      </div>

      {/* Este wrapper e quem empurra o sino e o usuario para a direita
          (margin-left: auto no CSS). O empurrao NAO pode ficar no botao:
          dentro do wrapper ele so afasta o botao das proprias bordas, e a
          barra inteira volta para o meio da tela. */}
      <div className="topo__alertas">
        <button ref={sino} className="topo__sino" aria-label="Alertas"
                aria-haspopup="menu" aria-expanded={alertasAberto}
                onClick={() => setAlertasAberto((v) => !v)}>
          <Icone nome="bell" tamanho={22} />
          {alertas.length > 0 && <span className="topo__contador">{alertas.length}</span>}
        </button>

        <MenuSuspenso aberto={alertasAberto} aoFechar={fecharAlertas}
                      ancora={sino} largura={360} alinhamento="esquerda">
          <div className="menu-suspenso__cabecalho">
            <div className="topo__usuario-nome">Alertas</div>
            <div className="topo__usuario-perfil">
              {alertas.length === 0
                ? "Nenhum aviso no momento"
                : `${alertas.length} aviso(s) pendente(s)`}
            </div>
          </div>

          <div className="alertas-lista">
            {alertas.length === 0 ? (
              <p className="alertas-lista__vazio">
                Nada vencendo nos próximos 30 dias.
              </p>
            ) : (
              alertas.map((item) => (
                <button key={item.id_alerta} role="menuitem"
                        className="alerta-item"
                        onClick={() => abrirAlerta(item)}>
                  <span className={`alerta-item__marca alerta-item__marca--${(item.prioridade || "BAIXA").toLowerCase()}`} />
                  <span className="alerta-item__texto">
                    <span className="alerta-item__titulo">{item.titulo}</span>
                    <span className="alerta-item__mensagem">{item.mensagem}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </MenuSuspenso>
      </div>

      <div className="relativo">
        <button ref={caixa} className="topo__usuario"
                onClick={() => setMenuAberto((v) => !v)}
                aria-haspopup="menu" aria-expanded={menuAberto}>
          <span className="avatar">{iniciais}</span>
          <span>
            <span className="topo__usuario-nome">{usuario?.nome}</span>
            <br />
            <span className="topo__usuario-perfil">{usuario?.perfil}</span>
          </span>
          <Icone nome="chevron-down" tamanho={18} />
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
