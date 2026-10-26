/**
 * FaixaVeiculo.jsx - Faixa do veiculo no topo dos Detalhes do Documento
 * (desenho do Cesar, 26/10): a FOTO do veiculo (a do cadastro, migracao 050),
 * placa e situacao, modelo, os selinhos de tipo / combustivel / ano e os
 * dados com icone (setor, motorista atual, odometro, chassi, renavam).
 *
 * `v` precisa trazer id_veiculo, placa, marca, modelo, veiculo_status,
 * tipo_veiculo, tipo_combustivel, ano_fabricacao, ano_modelo, setor,
 * condutor_atual, quilometragem_atual, chassi, renavam e foto_em.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icone from "./Icone.jsx";
import Selo from "./Selo.jsx";
import { apiArquivo } from "../lib/api.js";
import { numero, rotulo } from "../lib/formato.js";

const vazio = (x) => (x === null || x === undefined || x === "" ? "—" : x);

/** URL local da foto do veiculo (a rota exige o token, entao vira blob). */
export function useFotoVeiculo(idVeiculo, fotoEm) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    setUrl(null);
    if (!idVeiculo || !fotoEm) return undefined;
    let criada = null;
    apiArquivo(`/frotas/veiculos/${idVeiculo}/foto?v=${encodeURIComponent(fotoEm)}`)
      .then((u) => { criada = u; setUrl(u); })
      .catch(() => {});
    return () => { if (criada) URL.revokeObjectURL(criada); };
  }, [idVeiculo, fotoEm]);
  return url;
}

function Dado({ icone, rotulo: r, children }) {
  return (
    <div className="fv-dado">
      <Icone nome={icone} tamanho={19} />
      <div>
        <span className="fv-dado__rotulo">{r}</span>
        <span className="fv-dado__valor">{children}</span>
      </div>
    </div>
  );
}

export default function FaixaVeiculo({ v }) {
  const navegar = useNavigate();
  const foto = useFotoVeiculo(v.id_veiculo, v.foto_em);
  const chips = [
    v.tipo_veiculo && { icone: "kpi-car", texto: rotulo("tipoVeiculo", v.tipo_veiculo) },
    v.tipo_combustivel && { icone: "combustivel", texto: rotulo("combustivel", v.tipo_combustivel) },
    v.ano_fabricacao && { icone: "calendar", texto: `${v.ano_fabricacao} / ${v.ano_modelo}` },
  ].filter(Boolean);
  return (
    <section className="cartao fv">
      <div className="fv-veiculo">
        <button type="button" className="fv-foto" title="Abrir os detalhes do veículo"
                onClick={() => navegar(`/frotas/veiculos/${v.id_veiculo}`)}>
          {foto ? <img src={foto} alt={`Foto do veículo ${v.placa}`} /> : <Icone nome="kpi-car" tamanho={34} />}
        </button>
        <div className="fv-veiculo__textos">
          <span className="fv-placa">
            <button type="button" className="fv-placa__link" onClick={() => navegar(`/frotas/veiculos/${v.id_veiculo}`)}>
              {v.placa}
            </button>
            {v.veiculo_status && <Selo valor={v.veiculo_status} />}
          </span>
          <span className="fv-modelo">{v.marca} {v.modelo}</span>
          <span className="fv-chips">
            {chips.map((c) => (
              <span className="fv-chip" key={c.texto}><Icone nome={c.icone} tamanho={13} /> {c.texto}</span>
            ))}
          </span>
        </div>
      </div>
      <div className="fv-dados">
        <Dado icone="organograma" rotulo="Setor">{vazio(v.setor)}</Dado>
        <Dado icone="user" rotulo="Motorista atual">{v.condutor_atual || <>—<small>Não vinculado</small></>}</Dado>
        <Dado icone="odometro" rotulo="Odômetro atual">{`${numero(v.quilometragem_atual)} km`}</Dado>
        <Dado icone="kpi-steering" rotulo="Chassi">{vazio(v.chassi)}</Dado>
        <Dado icone="arquivo-texto" rotulo="Renavam">{vazio(v.renavam)}</Dado>
      </div>
    </section>
  );
}
