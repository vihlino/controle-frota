/**
 * TopoVeiculo.jsx - Topo dos Detalhes do Veiculo (Frotas) e dos Detalhes da
 * Viatura (Fiscalizacao), no desenho do Cesar de 29/10. Um componente so,
 * para as duas telas ficarem iguais.
 *
 *   Cartao do veiculo   foto do cadastro, placa e situacao, marca/modelo e
 *                       duas linhas de quatro dados separadas por fio
 *   Informacoes rapidas placa, setor, chassi, vinculo, renavam, proxima
 *                       inspecao, cor e proxima manutencao, cada um com icone
 *
 * O SITRA nao guarda a capacidade do tanque: "Capacidade" e a de lugares
 * do cadastro. Usa o tamanho compacto (classes vd3-*) que o Cesar ja aprovou em 26/10.
 */
import Icone from "./Icone.jsx";
import Selo from "./Selo.jsx";
import { useFotoVeiculo } from "./FaixaVeiculo.jsx";
import { data, numero, rotulo } from "../lib/formato.js";
import { vinculo } from "../lib/vinculos.js";

const vazio = (v) => (v === null || v === undefined || v === "" ? "—" : v);
/** Tipo pelo rotulo do sistema; fora da lista, so a primeira maiuscula. */
const tipoVeiculo = (t) => {
  if (!t) return null;
  const r = rotulo("tipoVeiculo", t);
  return r === t ? t.charAt(0) + t.slice(1).toLowerCase() : r;
};

function Dado({ icone, rotulo: r, children }) {
  return (
    <div className="vd3-dado">
      <Icone nome={icone} tamanho={16} />
      <div>
        <span className="vd3-dado__rotulo" title={r}>{r}</span>
        <span className="vd3-dado__valor">{children}</span>
      </div>
    </div>
  );
}

export default function TopoVeiculo({ v, proximaInspecao, proximaManutencao, podeEditar, aoEditar }) {
  const foto = useFotoVeiculo(v.id_veiculo, v.foto_em);
  const linha1 = [
    ["calendar", "Ano modelo", v.ano_modelo],
    ["calendar", "Ano fabricação", v.ano_fabricacao],
    ["kpi-car", "Tipo", tipoVeiculo(v.tipo_veiculo)],
    ["camadas", "Uso", v.viatura ? "Viatura da Fiscalização" : "Frota"],
  ];
  const linha2 = [
    ["predio", "Setor", v.setor],
    ["odometro", "Odômetro atual", `${numero(v.quilometragem_atual)} km`],
    ["combustivel", "Combustível", v.tipo_combustivel ? rotulo("combustivel", v.tipo_combustivel) : null],
    ["usuarios", "Capacidade", /^\d+$/.test(String(v.capacidade ?? "").trim()) ? `${String(v.capacidade).trim()} lugares` : v.capacidade],
  ];
  const rapidas = [
    { icone: "placa", rotulo: "Placa", valor: v.placa, tom: "amarelo" },
    { icone: "predio", rotulo: "Setor", valor: v.setor },
    { icone: "kpi-steering", rotulo: "Chassi", valor: v.chassi },
    { icone: "link", rotulo: "Vínculo", valor: v.vinculo ? vinculo(v.vinculo) : null },
    { icone: "arquivo-texto", rotulo: "Renavam", valor: v.renavam },
    { icone: "calendario-check", rotulo: "Próxima inspeção", valor: proximaInspecao ? data(proximaInspecao) : null, tom: "verde" },
    { icone: "paleta", rotulo: "Cor", valor: v.cor },
    { icone: "kpi-wrench", rotulo: "Próxima manutenção", valor: proximaManutencao ? data(proximaManutencao) : null },
  ];

  return (
    <div className="vd3-topo">
      <section className="cartao vd3-veiculo">
        <div className="vd3-foto">
          {foto ? <img src={foto} alt={`Foto do veículo ${v.placa}`} /> : (
            <div className="vd3-foto__vazia">
              <Icone nome="kpi-car" tamanho={24} />
              <span>Sem foto</span>
              {podeEditar && (
                <button type="button" className="botao botao--pequeno" onClick={aoEditar}>
                  <Icone nome="oc-camera" tamanho={14} /> Adicionar foto
                </button>
              )}
            </div>
          )}
        </div>
        <div className="vd3-veiculo__corpo">
          <div className="vd3-veiculo__linha">
            <div className="vd3-veiculo__placa">
              <strong>{v.placa}</strong>
              <Selo valor={v.status} />
            </div>
            {v.tipo_veiculo && (
              <span className="vd3-tipo"><Icone nome="kpi-car" tamanho={13} /> {tipoVeiculo(v.tipo_veiculo)}</span>
            )}
          </div>
          <span className="vd3-veiculo__modelo">{v.marca} {v.modelo}</span>
          {[linha1, linha2].map((linha, i) => (
            <div className="vd3-veiculo__dados" key={i}>
              {linha.map(([icone, r, valor]) => <Dado key={r} icone={icone} rotulo={r}>{vazio(valor)}</Dado>)}
            </div>
          ))}
        </div>
      </section>

      <section className="cartao vd3-rapidas">
        <h2 className="vd3-rapidas__titulo"><Icone nome="arquivo-texto" tamanho={16} /> Informações Rápidas</h2>
        <div className="vd3-rapidas__grade">
          {rapidas.map((x) => (
            <div className="vd3-rapidas__item" key={x.rotulo}>
              <span className="vd3-rapidas__icone" data-tom={x.tom}><Icone nome={x.icone} tamanho={14} /></span>
              <div>
                <span>{x.rotulo}</span>
                <strong>{vazio(x.valor)}</strong>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
