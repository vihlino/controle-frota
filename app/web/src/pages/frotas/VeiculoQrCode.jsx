/**
 * VeiculoQrCode.jsx - Gera e mostra o QR Code do veículo.
 *
 * A imagem vem pronta do servidor em PNG base64, e o código aponta para a tela
 * publica de checklist. Da para baixar e imprimir, que e como o adesivo chega
 * ao veiculo.
 *
 * Se o veículo ainda não tem QR Code, a tela oferece o botao para gerar.
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
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    definirCabecalho({
      titulo: "QR Code do Veículo",
      legenda: "Acesso rápido ao checklist deste veículo.",
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

  // Copia o link do checklist. O navigator.clipboard so existe em HTTPS (e em
  // localhost); o campo selecionado serve de saida manual quando ele falta.
  async function copiar() {
    if (!qr?.url) return;
    try {
      await navigator.clipboard.writeText(qr.url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // sem permissao de area de transferencia: seleciona para o usuario copiar
      const campo = document.querySelector(".qr__link-campo input");
      campo?.select();
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
    ["Ano de fabricação", veiculo.ano_fabricacao],
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
              { rotulo: "Veículos", para: "/frotas/veiculos" },
              { rotulo: "QR Code do Veículo" },
            ]}
          />
          <h1>QR Code do Veículo</h1>
          <p>Use o QR Code abaixo para acesso rápido ao checklist deste veículo.</p>
        </div>
        <button className="botao" onClick={() => navegar("/frotas/veiculos")}>
          <Icone nome="seta-esquerda" tamanho={16} /> Voltar para veículos
        </button>
      </div>

      {/* Informacoes e QR Code num cartao so, separados por uma linha sutil -
          eram dois cartoes soltos, com sombra e borda repetidas no meio. */}
      <Cartao className="qr-cartao-principal">
        <div className="qr-painel">
          <section className="qr-painel__dados">
            <h2 className="qr-painel__titulo">Informações do Veículo</h2>
            <dl className="lista-dados">
              {dados.map(([rotulo, valor]) => (
                <div className="lista-dados__linha" key={rotulo}>
                  <dt>{rotulo}</dt>
                  <dd>{valor}</dd>
                </div>
              ))}
              <div className="lista-dados__linha">
                <dt>Situação</dt>
                <dd><Selo valor={veiculo.status} /></dd>
              </div>
            </dl>
          </section>

          <section className="qr-painel__qr">
            <h2 className="qr-painel__titulo">QR Code</h2>
            {qr ? (
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
                  <Icone nome="baixar" tamanho={16} /> Baixar QR Code
                </a>
                <button className="botao qr__imprimir" onClick={imprimir}>
                  Imprimir
                </button>
              </div>
            ) : (
              <div className="vazio">
                <p>Este veículo ainda não tem QR Code gerado.</p>
                <button className="botao botao--primario" onClick={gerar} disabled={gerando}>
                  {gerando ? "Gerando..." : "Gerar QR Code"}
                </button>
              </div>
            )}
          </section>
        </div>
      </Cartao>

      <Cartao>
        <div className="instrucoes">
          <h2 className="qr-painel__titulo qr-painel__titulo--com-icone">
            <Icone nome="ajuda" tamanho={20} /> Como utilizar
          </h2>
          <p>O condutor ou servidor deve escanear o QR Code com o celular para:</p>
          <ul className="instrucoes__lista">
            <li><Icone nome="check" tamanho={18} /> Visualizar as informações do veículo</li>
            <li><Icone nome="check" tamanho={18} /> Preencher o checklist de saída</li>
            <li><Icone nome="check" tamanho={18} /> Registrar a chegada e fechar o checklist</li>
          </ul>
        </div>
      </Cartao>
    </>
  );
}
