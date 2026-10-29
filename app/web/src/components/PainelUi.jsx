/**
 * PainelUi.jsx - Pecas dos Dashboards no desenho do Cesar de 29/10:
 *
 *   TituloPainel   quadrinho colorido com icone + titulo em maiusculas
 *   VazioPainel    o "nada por aqui" com icone num circulo e uma explicacao
 *   ListaOsPainel  as OS em aberto em faixas coloridas, com o numero e a seta
 *   AcaoRapida     atalho da coluna da direita: icone, texto e seta
 */
import { Link } from "react-router-dom";
import Icone from "./Icone.jsx";
import { numero } from "../lib/formato.js";

export function TituloPainel({ icone, tom = "azul", children }) {
  return (
    <span className="tp">
      <span className="tp__icone" data-tom={tom}><Icone nome={icone} tamanho={20} monocromatico /></span>
      <span className="tp__texto">{children}</span>
    </span>
  );
}

export function VazioPainel({ icone = "arquivo-texto", titulo, texto }) {
  return (
    <div className="vp">
      <span className="vp__icone"><Icone nome={icone} tamanho={30} monocromatico /></span>
      <strong>{titulo}</strong>
      {texto && <span>{texto}</span>}
    </div>
  );
}

const ESTILO_OS = {
  EM_MANUTENCAO: ["vermelho", "kpi-wrench"],
  PENDENTE: ["amarelo", "historico"],
  EM_ANALISE: ["azul", "arquivo-texto"],
  AGUARDANDO_PECAS: ["laranja", "camadas"],
  AGUARDANDO_APROVACAO: ["roxo", "check"],
};

export function ListaOsPainel({ ordens, rotulos, base = "/frotas/manutencoes" }) {
  if (!ordens?.length) return <VazioPainel icone="kpi-wrench" titulo="Nenhuma OS em aberto." texto="As ordens de serviço abertas aparecem aqui." />;
  return (
    <div className="lop">
      {ordens.map((os) => {
        const r = rotulos[os.status] || { titulo: os.status, descricao: "" };
        const [tom, icone] = ESTILO_OS[os.status] || ["azul", "kpi-wrench"];
        return (
          <Link key={os.status} className="lop__item" data-tom={tom} to={`${base}?status=${os.status}`}>
            <span className="lop__icone"><Icone nome={icone} tamanho={22} monocromatico /></span>
            <span className="lop__textos"><strong>{r.titulo}</strong><small>{r.descricao}</small></span>
            <span className="lop__valor">{numero(os.quantidade)}</span>
            <Icone nome="chevron-right" tamanho={14} />
          </Link>
        );
      })}
    </div>
  );
}

export function AcaoRapida({ para, icone, children }) {
  return (
    <Link className="ar" to={para}>
      <Icone nome={icone} tamanho={18} monocromatico />
      <span>{children}</span>
      <Icone nome="chevron-right" tamanho={14} />
    </Link>
  );
}
