/**
 * Kpi.jsx - O cartao de numero grande.
 *
 * Existe UM formato so: circulo de icone em tom suave, rotulo, numero e nota.
 * O quadrado amarelo solido dos dashboards antigos foi aposentado - o amarelo
 * e cor de marca (logo, item ativo da lateral, botao primario), nao de dado.
 *
 * O `tom` diz o que o numero SIGNIFICA, e nunca e escolhido por estetica:
 *
 *   verde     esta certo      concluido, disponivel, em dia
 *   vermelho  esta errado     cancelado, indisponivel, vencido
 *   ambar     pede atencao    em andamento, aguardando, vence em breve
 *   azul      informativo     em analise, intervencao, agendado
 *   roxo      contagem        total / agrupamento, sem juizo de valor
 *   neutro    (padrao)        um total sem carga nenhuma
 *
 * Se dois KPIs lado a lado tem o mesmo tom, provavelmente um deles esta
 * errado: a cor perde a funcao quando se repete sem motivo.
 */
import Icone from "./Icone.jsx";
import { numero } from "../lib/formato.js";

const TONS = ["neutro", "verde", "vermelho", "ambar", "azul", "roxo", "marca"];

export default function Kpi({ icone, rotulo, valor, nota, tom = "neutro" }) {
  if (import.meta.env.DEV && !TONS.includes(tom)) {
    console.warn(
      `Kpi "${rotulo}": tom "${tom}" nao existe. Use um de: ${TONS.join(", ")}.`
    );
  }

  return (
    <div className="cartao kpi">
      <span className="kpi__icone" data-tom={tom}>
        <Icone nome={icone} tamanho={24} />
      </span>
      <div>
        <div className="kpi__rotulo">{rotulo}</div>
        <div className="kpi__valor">
          {typeof valor === "number" ? numero(valor) : valor}
        </div>
        {nota && <div className="kpi__nota">{nota}</div>}
      </div>
    </div>
  );
}
