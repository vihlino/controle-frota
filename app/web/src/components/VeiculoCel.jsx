/**
 * VeiculoCel.jsx - A celula "Veiculo" das tabelas: miniatura + nome.
 *
 * SOBRE A MINIATURA
 * -----------------
 * O mockup mostra uma foto do veiculo ao lado do nome. A tabela `veiculo` do
 * banco ainda NAO tem coluna de foto (ver db/001_sitra_v1.sql), entao nao ha
 * de onde tirar a imagem real de cada carro.
 *
 * Enquanto essa coluna nao existe, a miniatura mostra o icone do TIPO do
 * veiculo - que ja vem do banco em `tipo_veiculo`. Assim um caminhao nao
 * aparece com cara de carro de passeio, que e o pior dos dois mundos.
 *
 * Quando a coluna de foto existir, basta a API passar `foto` aqui: o
 * componente ja prefere a imagem real quando ela vem.
 */
import Icone from "./Icone.jsx";

// Do `tipo_veiculo` do banco para o icone. O texto vem em formatos variados
// ("Motocicleta", "MOTO", "Caminhão"), por isso a comparacao e frouxa.
function iconePorTipo(tipo) {
  const t = (tipo || "").toLowerCase();
  if (t.includes("moto")) return "fisc-bolt";
  if (t.includes("caminh") || t.includes("cami")) return "kpi-car";
  if (t.includes("onibus") || t.includes("ônibus")) return "kpi-car";
  return "kpi-car-front";
}

/**
 * @param {object} props
 * @param {string} [props.marca]
 * @param {string} [props.modelo]
 * @param {string} [props.tipo]   O `tipo_veiculo` vindo do banco.
 * @param {string} [props.foto]   URL da foto, quando houver.
 * @param {string} [props.nome]   Substitui marca+modelo, se preferir montar fora.
 */
export default function VeiculoCel({ marca, modelo, tipo, foto, nome }) {
  const rotulo = nome || [marca, modelo].filter(Boolean).join(" ") || "—";
  return (
    <span className="veiculo-cel">
      <span className="veiculo-cel__foto">
        {foto
          ? <img src={foto} alt="" loading="lazy" />
          : <Icone nome={iconePorTipo(tipo)} tamanho={18} />}
      </span>
      {rotulo}
    </span>
  );
}
