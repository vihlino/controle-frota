/**
 * Modal.jsx - A janela sobreposta dos formularios.
 *
 * Fecha de tres formas: no X, na tecla Esc e clicando no fundo escuro.
 *
 * O clique no fundo usa onMouseDown e compara e.target com e.currentTarget
 * para fechar so quando o clique comecou no fundo mesmo - senao, arrastar para
 * selecionar um texto de dentro e soltar fora fecharia a janela junto.
 *
 * Enquanto aberto, trava a rolagem da pagina de tras.
 */
import { useEffect } from "react";
import Icone from "./Icone.jsx";
import { travar, destravar } from "../lib/travarRolagem.js";

/*
 * LARGURA UNICA PARA TODA JANELA DE FORMULARIO
 *
 * Cada tela vinha escolhendo a sua - 640, 680, 700, 720, 760 - e o resultado
 * era uma janela que crescia e encolhia conforme a pessoa passava de Veiculos
 * para Documentos e para Checklists, como se cada tela fosse de um sistema
 * diferente. O numero certo e o que serve o formulario mais largo do sistema
 * (o de correcao de checklist, com quatro campos por fileira); os demais
 * sobram espaco, e sobrar e melhor do que apertar.
 *
 * A prop `largura` continua existindo para o que NAO e formulario: a caixa de
 * confirmar senha e estreita de proposito, porque pede uma coisa so.
 */
export const LARGURA_FORMULARIO = 760;

/*
 * 29/10 (desenho do Cesar): toda janela ganha um quadrinho com icone ao lado
 * do titulo. Quem nao passa `icone` recebe um escolhido pelo titulo - assim as
 * dezenas de janelas do sistema mudaram sem mexer em cada uma. O tom segue a
 * mesma ideia: excluir e vermelho; editar/corrigir/atualizar e laranja; o
 * resto azul. A Fiscalizacao usa laranja nos cadastros dela (`tom`).
 */
const ICONES_TITULO = [
  [/exclu|remover|apagar/i, "lixo"],
  [/relat[oó]rio/i, "arquivo-texto"],
  [/motorista|servidor|fiscal\b|usu[aá]rio|condutor|perfil/i, "user"],
  [/cnh/i, "cnh"],
  [/ve[ií]culo|viatura/i, "kpi-car"],
  [/crlv|documento|licenciamento/i, "documento"],
  [/inspe[cç]/i, "calendario-check"],
  [/\bos\b|ordem de servi|manuten[cç]|fechamento/i, "kpi-wrench"],
  [/multa/i, "dinheiro"],
  [/sinistro/i, "sinistro"],
  [/checklist/i, "checklist"],
  [/servi[cç]o di[aá]rio/i, "calendar"],
  [/equipe/i, "equipe"],
  [/ocorr[eê]ncia/i, "fisc-ocorrencias"],
  [/setor/i, "predio"],
  [/senha/i, "alterar-senha"],
  [/item|equipamento|entrada|baixa/i, "adicionar"],
];
export function iconeDoTitulo(titulo) {
  const t = typeof titulo === "string" ? titulo : "";
  return (ICONES_TITULO.find(([re]) => re.test(t)) || [null, "documento"])[1];
}
function tomDoTitulo(titulo) {
  const t = typeof titulo === "string" ? titulo : "";
  if (/exclu|remover|apagar/i.test(t)) return "vermelho";
  if (/^(editar|corrigir|atualizar|completar|reagendar)/i.test(t.trim())) return "laranja";
  // As janelas da Fiscalizacao sao laranja no desenho (servico, equipe, itens).
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/fiscalizacao")) return "laranja";
  return "azul";
}

export default function Modal({
  titulo, legenda, largura = LARGURA_FORMULARIO, aoFechar, rodape, children,
  compacto = false, icone, tom,
}) {
  const iconeTopo = icone === null ? null : (icone || iconeDoTitulo(titulo));
  // Sem legenda, uma frase padrao pelo titulo ("Novo motorista" ->
  // "Cadastre as informações do motorista."). legenda={null} tira.
  const textoTitulo = typeof titulo === "string" ? titulo.trim() : "";
  const legendaFinal = legenda !== undefined ? legenda
    : /^novo /i.test(textoTitulo) ? `Cadastre as informações do ${textoTitulo.slice(5).toLowerCase()}.`
      : /^nova /i.test(textoTitulo) ? `Cadastre as informações da ${textoTitulo.slice(5).toLowerCase()}.`
        : /^editar /i.test(textoTitulo) ? "Atualize as informações. Os campos marcados com * são obrigatórios."
          : null;
  const tomTopo = tom || tomDoTitulo(titulo);
  // Esc fecha.
  useEffect(() => {
    function aoTeclar(e) {
      if (e.key === "Escape") aoFechar();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  // A trava da rolagem fica em EFEITO SEPARADO, com lista de dependencias
  // vazia: ela deve acontecer uma vez ao abrir e uma vez ao fechar. Junto com
  // o Esc, ela reagia a cada troca de `aoFechar` - que muda em todo render,
  // porque as telas passam uma funcao nova (`() => setEditando(null)`) - e
  // destravava e travava de novo sem motivo.
  useEffect(() => {
    travar();
    return destravar;
  }, []);

  return (
    <div className="modal__fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className={`modal${compacto ? " modal--compacto" : ""}`}
           style={{ maxWidth: largura }} role="dialog" aria-modal="true">
        <header className="modal__topo">
          {iconeTopo && (
            <span className="modal__icone" data-tom={tomTopo} aria-hidden="true">
              <Icone nome={iconeTopo} tamanho={26} monocromatico />
            </span>
          )}
          <div className="modal__textos">
            <h2 className="modal__titulo">{titulo}</h2>
            {legendaFinal && <p className="modal__legenda">{legendaFinal}</p>}
          </div>
          <button className="modal__fechar" onClick={aoFechar} aria-label="Fechar">
            <Icone nome="fechar" tamanho={18} />
          </button>
        </header>
        <div className="modal__corpo">{children}</div>
        {rodape && <footer className="modal__rodape">{rodape}</footer>}
      </div>
    </div>
  );
}
