/**
 * ResumoVeiculo.jsx - O bloco do veiculo na faixa do topo das telas de
 * detalhes (Veiculo, Inspecao, OS, Sinistro, Documento): placa grande (leva a
 * ficha do veiculo), marca e modelo, e "tipo  •  combustivel  •  ano/ano".
 * Sem foto: o SITRA nao guarda foto do veiculo.
 */
import { useNavigate } from "react-router-dom";
import { rotulo } from "../lib/formato.js";
import Selo from "./Selo.jsx";

export default function ResumoVeiculo({ v, selo }) {
  // Situacao do veiculo ao lado da placa, como nos desenhos (vem como
  // veiculo_status nas consultas das telas de detalhes).
  const seloFinal = selo ?? (v.veiculo_status ? <Selo valor={v.veiculo_status} /> : null);
  const navegar = useNavigate();
  return (
    <div className="vd-resumo__principal">
      <span className="vd-resumo__rotulo">Veículo</span>
      <span className="resumo-veiculo__placa">
        <button type="button" className="vd-resumo__placa insp-link"
                onClick={() => navegar(`/frotas/veiculos/${v.id_veiculo}`)}>
          {v.placa}
        </button>
        {seloFinal}
      </span>
      <span className="vd-resumo__modelo">{v.marca} {v.modelo}</span>
      <span className="vd-resumo__linha">
        {[v.tipo_veiculo && rotulo("tipoVeiculo", v.tipo_veiculo),
          v.tipo_combustivel && rotulo("combustivel", v.tipo_combustivel),
          v.ano_fabricacao && `${v.ano_fabricacao} / ${v.ano_modelo}`].filter(Boolean).join("  •  ")}
      </span>
    </div>
  );
}
