/**
 * VeiculoQrCode.jsx - Gera e mostra o QR Code do veiculo.
 *
 * A imagem vem pronta do servidor em PNG base64, e o codigo aponta para a tela
 * publica de checklist. Da para baixar e imprimir, que e como o adesivo chega
 * ao veiculo.
 *
 * Se o veiculo ainda nao tem QR Code, a tela oferece o botao para gerar.
 */
import { useEffect, useState } from "react";
import { useOutletContext, useParams, useNavigate } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import Selo from "../../components/Selo.jsx";
import { api } from "../../lib/api.js";
import { numero } from "../../lib/formato.js";

export default function VeiculoQrCode() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const [veiculo, setVeiculo] = useState(null);
  const [qr, setQr] = useState(null);
  const [erro, setErro] = useState("");
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    definirCabecalho({
      titulo: "QR Code do Veiculo",
      legenda: "Acesso rapido ao checklist deste veiculo.",
    });
  }, [definirCabecalho]);

  useEffect(() => {
    api(`/frotas/veiculos/${id}`).then(setVeiculo).catch((e) => setErro(e.message));
    api(`/qrcode/imagem/${id}`)
      .then(setQr)
      .catch(() => setQr(null)); // sem QR ainda: mostra o botao de gerar
  }, [id]);

  async function gerar() {
    setGerando(true);
    try {
      await api(`/qrcode/veiculo/${id}`, { method: "POST" });
      setQr(await api(`/qrcode/imagem/${id}`));
    } catch (e) {
      setErro(e.message);
    } finally {
      setGerando(false);
    }
  }

  function imprimir() {
    window.print();
  }

  if (erro) return <Cartao><div className="vazio">{erro}</div></Cartao>;
  if (!veiculo) return <div className="carregando">Carregando...</div>;

  const dados = [
    ["Placa", veiculo.placa],
    ["Marca", veiculo.marca],
    ["Modelo", veiculo.modelo],
    ["Renavam", veiculo.renavam || "-"],
    ["Chassi", veiculo.chassi || "-"],
    ["Ano modelo", veiculo.ano_modelo],
    ["Ano de fabricacao", veiculo.ano_fabricacao],
    ["Cor", veiculo.cor],
    ["Setor", veiculo.setor],
    ["Quilometragem", `${numero(veiculo.quilometragem_atual)} km`],
  ];

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <Trilha
            itens={[
              { rotulo: "Frotas" },
              { rotulo: "Veiculos", para: "/frotas/veiculos" },
              { rotulo: "QR Code do Veiculo" },
            ]}
          />
          <h1>QR Code do Veiculo</h1>
          <p>Use o QR Code abaixo para acesso rapido ao checklist deste veiculo.</p>
        </div>
        <button className="botao" onClick={() => navegar("/frotas/veiculos")}>
          Voltar para veiculos
        </button>
      </div>

      <div className="grade-2">
        <Cartao titulo="Informacoes do veiculo">
          <dl className="lista-dados">
            {dados.map(([rotulo, valor]) => (
              <div className="lista-dados__linha" key={rotulo}>
                <dt>{rotulo}</dt>
                <dd>{valor}</dd>
              </div>
            ))}
            <div className="lista-dados__linha">
              <dt>Situacao</dt>
              <dd><Selo valor={veiculo.status} /></dd>
            </div>
          </dl>
        </Cartao>

        <Cartao titulo="QR Code">
          {qr ? (
            <div className="qr">
              <div className="qr__moldura">
                <img src={qr.imagem} alt={`QR Code do veiculo ${veiculo.placa}`} />
              </div>
              <p className="qr__texto">
                Aponte a camera do celular para o QR Code para abrir o checklist
                deste veiculo.
              </p>
              <p className="qr__codigo">{qr.codigo}</p>
              <div className="qr__acoes">
                <a className="botao botao--primario" href={qr.imagem}
                   download={`qrcode-${veiculo.placa}.png`}>
                  <Icone nome="arrow-up" tamanho={16} /> Baixar QR Code
                </a>
                <button className="botao" onClick={imprimir}>Imprimir</button>
              </div>
            </div>
          ) : (
            <div className="vazio">
              <p>Este veiculo ainda nao tem QR Code gerado.</p>
              <button className="botao botao--primario" onClick={gerar} disabled={gerando}>
                {gerando ? "Gerando..." : "Gerar QR Code"}
              </button>
            </div>
          )}
        </Cartao>
      </div>

      <Cartao titulo="Como utilizar">
        <div className="instrucoes">
          <p>O condutor ou servidor deve escanear o QR Code com o celular para:</p>
          <ul>
            <li>Visualizar as informacoes do veiculo</li>
            <li>Preencher o checklist de saida (matricula, KM, percurso e equipamentos)</li>
            <li>Registrar a chegada e fechar o checklist</li>
          </ul>
          <p className="instrucoes__nota">
            O checklist nao tem botao de "novo" nas telas administrativas de proposito:
            ele sempre nasce da leitura do QR Code do veiculo.
          </p>
        </div>
      </Cartao>
    </>
  );
}
