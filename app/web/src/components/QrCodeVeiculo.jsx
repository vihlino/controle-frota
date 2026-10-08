/**
 * QrCodeVeiculo.jsx - O QR Code do veiculo, como aba da tela Detalhes do
 * Veiculo (antes era uma tela separada, /frotas/veiculos/:id/qrcode, que
 * agora abre direto nesta aba).
 *
 * A imagem vem pronta do servidor em PNG base64, e o codigo aponta para a tela
 * publica de checklist. Da para baixar o PNG, que e como o adesivo chega ao
 * veiculo - imprimir a PAGINA levaria menu e cabecalho para o papel.
 * Sem QR Code ainda, oferece o botao para gerar.
 */
import { useEffect, useState } from "react";
import Cartao from "./Cartao.jsx";
import Icone from "./Icone.jsx";
import { api } from "../lib/api.js";

export default function QrCodeVeiculo({ veiculo, aoGerar }) {
  const id = veiculo.id_veiculo;
  const [qr, setQr] = useState(undefined); // undefined = carregando; null = sem QR
  const [erro, setErro] = useState("");
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    api(`/qrcode/imagem/${id}`).then(setQr).catch(() => setQr(null));
  }, [id]);

  async function gerar() {
    setGerando(true);
    setErro("");
    try {
      await api(`/qrcode/veiculo/${id}`, { method: "POST" });
      setQr(await api(`/qrcode/imagem/${id}`));
      aoGerar?.();
    } catch (e) {
      setErro(e.message);
    } finally {
      setGerando(false);
    }
  }

  // navigator.clipboard so existe em HTTPS (e em localhost); sem ele, o campo
  // fica selecionado para a pessoa copiar.
  async function copiar() {
    if (!qr?.url) return;
    try {
      await navigator.clipboard.writeText(qr.url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      document.querySelector(".qr__link-campo input")?.select();
    }
  }

  return (
    <div className="vd-qr">
      <Cartao titulo={<><Icone nome="codigo-qr" tamanho={18} /> QR Code do Veículo</>}>
        {erro && <div className="login__erro">{erro}</div>}
        {qr === undefined ? (
          <div className="carregando">Carregando o QR Code...</div>
        ) : qr ? (
          <div className="qr">
            <div className="qr__moldura">
              <img src={qr.imagem} alt={`QR Code do veículo ${veiculo.placa}`} />
            </div>
            <p className="qr__texto">
              Aponte a câmera do dispositivo para o QR Code
              para acessar as informações e realizar o checklist.
            </p>
            <div className="qr__link">
              <span className="qr__link-rotulo">Link de acesso</span>
              <div className="qr__link-campo">
                <input readOnly value={qr.url || ""} aria-label="Link de acesso ao checklist" />
                <button type="button" className="qr__copiar" onClick={copiar}
                        aria-label="Copiar link" title="Copiar link">
                  <Icone nome={copiado ? "check" : "copiar"} tamanho={18} />
                </button>
              </div>
              {copiado && <span className="qr__copiado">Link copiado.</span>}
            </div>
            <a className="botao botao--primario qr__baixar" href={qr.imagem}
               download={`qrcode-${veiculo.placa}.png`}>
              <Icone nome="baixar" tamanho={15} /> Baixar QR Code
            </a>
          </div>
        ) : (
          <div className="vazio">
            <p>Este veículo ainda não tem QR Code gerado.</p>
            <button className="botao botao--primario" onClick={gerar} disabled={gerando}>
              <Icone nome="codigo-qr" tamanho={15} monocromatico /> {gerando ? "Gerando..." : "Gerar QR Code"}
            </button>
          </div>
        )}
      </Cartao>

      <Cartao titulo={<><Icone nome="informacao" tamanho={18} /> Como utilizar</>}>
        <div className="instrucoes">
          <div className="instrucoes__texto">
            <p>O condutor ou servidor deve escanear o QR Code com o celular para:</p>
            <ul className="instrucoes__lista">
              <li><Icone nome="check" tamanho={18} /> Visualizar as informações do veículo</li>
              <li><Icone nome="check" tamanho={18} /> Preencher o checklist de saída</li>
              <li><Icone nome="check" tamanho={18} /> Registrar a chegada e fechar o checklist</li>
            </ul>
            <p className="instrucoes__observacao">
              <strong>Observação:</strong> Cole o adesivo em local visível do veículo.
              <br />
              O mesmo QR Code serve para a saída e para a chegada: o sistema
              reconhece se o veículo está em uso e abre a tela certa.
            </p>
          </div>
          <img className="instrucoes__arte" src="/icons/qr-viatura.png"
               alt="Celular lendo o QR Code colado em uma viatura" />
        </div>
      </Cartao>
    </div>
  );
}
