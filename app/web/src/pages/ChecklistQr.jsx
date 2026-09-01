/**
 * ChecklistQr.jsx - O checklist que o QR Code abre no celular.
 *
 * Tela PUBLICA, feita para telefone. E a unica do sistema que funciona sem
 * login: a credencial e o token do QR Code, e a matrícula identifica o condutor.
 *
 * A tela decide sozinha o que mostrar:
 *   - veículo sem checklist aberto  -> formulario de SAIDA
 *   - veículo com checklist aberto  -> formulario de CHEGADA
 *
 * Por isso o mesmo adesivo serve para os dois momentos: o condutor le o QR ao
 * sair e le de novo ao voltar.
 */
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Icone from "../components/Icone.jsx";
import { api } from "../lib/api.js";
import { numero, rotulo } from "../lib/formato.js";

// Tela que o QR Code do veículo abre no celular. Publica de proposito: a
// credencial e o token do QR Code somado a matrícula do condutor.
const EQUIPAMENTOS = ["MACACO", "ESTEPE", "TRIANGULO", "CHAVE_RODA"];

export default function ChecklistQr() {
  const { token } = useParams();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState("");

  const [matrícula, setMatrícula] = useState("");
  const [condutor, setCondutor] = useState(null);
  const [saida, setSaida] = useState({ odometro_saida: "", percurso: "", local_saida: "", observações: "" });
  const [equipamentos, setEquipamentos] = useState(
    Object.fromEntries(EQUIPAMENTOS.map((e) => [e, { conforme: true, observacao: "" }]))
  );
  const [chegada, setChegada] = useState({ odometro_chegada: "", observações: "" });

  useEffect(() => {
    api(`/qrcode/ler/${token}`)
      .then((r) => {
        setDados(r);
        setSaida((s) => ({ ...s, odometro_saida: String(r.veiculo.quilometragem_atual) }));
      })
      .catch((e) => setErro(e.message));
  }, [token]);

  async function buscarCondutor() {
    setErro("");
    try {
      setCondutor(await api(`/qrcode/condutor/${matrícula.trim()}`));
    } catch (e) {
      setCondutor(null);
      setErro(e.message);
    }
  }

  async function registrarSaida(e) {
    e.preventDefault();
    setEnviando(true);
    setErro("");
    try {
      await api(`/qrcode/saida/${token}`, {
        method: "POST",
        body: {
          matricula: matrícula.trim(),
          odometro_saida: Number(saida.odometro_saida),
          percurso: saida.percurso,
          local_saida: saida.local_saida,
          observacoes: saida.observações,
          equipamentos: EQUIPAMENTOS.map((código) => ({
            equipamento: código,
            conforme: equipamentos[código].conforme,
            observacao: equipamentos[código].conforme
              ? null
              : equipamentos[código].observacao || "Item ausente na conferencia.",
          })),
        },
      });
      setConcluido("saida");
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  }

  async function registrarChegada(e) {
    e.preventDefault();
    setEnviando(true);
    setErro("");
    try {
      await api(`/qrcode/chegada/${token}`, {
        method: "POST",
        body: {
          odometro_chegada: Number(chegada.odometro_chegada),
          observacoes: chegada.observações,
        },
      });
      setConcluido("chegada");
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  }

  if (erro && !dados) {
    return (
      <div className="qr-tela">
        <div className="qr-tela__aviso qr-tela__aviso--erro">{erro}</div>
      </div>
    );
  }
  if (!dados) return <div className="carregando">Carregando o veículo...</div>;

  const { veiculo, checklistAberto } = dados;

  if (concluido) {
    return (
      <div className="qr-tela">
        <header className="qr-tela__topo">
          <img src="/icons/logo-sitra.svg" alt="" />
          <div>
            <strong>SITRA</strong>
            <span>Sistema Integrado de Gestão Publica</span>
          </div>
        </header>
        <div className="qr-tela__sucesso">
          <Icone nome="checklist" tamanho={40} />
          <h1>{concluido === "saida" ? "Saida registrada!" : "Chegada registrada!"}</h1>
          <p>
            {concluido === "saida"
              ? "Boa viagem. Ao retornar, leia o QR Code de novo para registrar a chegada."
              : "Checklist concluido. Obrigado."}
          </p>
          <p className="qr-tela__veiculo">
            {veiculo.marca} {veiculo.modelo} - {veiculo.placa}
          </p>
        </div>
      </div>
    );
  }

  const dadosVeiculo = [
    ["Veículo", `${veiculo.marca} ${veiculo.modelo}`],
    ["Placa", veiculo.placa],
    ["Ano / Modelo", `${veiculo.ano_fabricacao} / ${veiculo.ano_modelo}`],
    ["Cor", veiculo.cor],
    ["Setor", veiculo.setor],
    ["Renavam", veiculo.renavam || "-"],
  ];

  return (
    <div className="qr-tela">
      <header className="qr-tela__topo">
        <img src="/icons/logo-sitra.svg" alt="" />
        <div>
          <strong>Checklist do Veículo</strong>
          <span>Aberto via QR Code</span>
        </div>
      </header>

      <div className="qr-tela__aviso">
        <Icone nome="checklist" tamanho={20} />
        <div>
          <strong>QR Code reconhecido</strong>
          <p>Confira os dados do veículo e preencha o checklist.</p>
        </div>
      </div>

      <section className="qr-cartao">
        <h2 className="qr-cartao__titulo">Dados do veículo</h2>
        <dl className="qr-dados">
          {dadosVeiculo.map(([r, v]) => (
            <div key={r}>
              <dt>{r}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {erro && <div className="qr-tela__aviso qr-tela__aviso--erro">{erro}</div>}

      {checklistAberto ? (
        <form className="qr-cartao" onSubmit={registrarChegada}>
          <h2 className="qr-cartao__titulo">
            <span className="qr-passo">2</span> Chegada do veículo
          </h2>
          <p className="qr-cartao__nota">
            Este veículo saiu com {checklistAberto.condutor} em{" "}
            {numero(checklistAberto.odometro_saida)} km. Informe o KM de chegada para
            fechar o checklist.
          </p>

          <div className="campo">
            <label htmlFor="km-chegada">KM de chegada *</label>
            <input
              id="km-chegada" type="number" required
              min={checklistAberto.odometro_saida}
              value={chegada.odometro_chegada}
              onChange={(e) => setChegada((c) => ({ ...c, odometro_chegada: e.target.value }))}
            />
          </div>
          <div className="campo">
            <label htmlFor="obs-chegada">Observações da chegada</label>
            <textarea
              id="obs-chegada" rows={3} value={chegada.observações}
              onChange={(e) => setChegada((c) => ({ ...c, observações: e.target.value }))}
            />
          </div>

          <button className="botao botao--primario qr-botao" disabled={enviando}>
            {enviando ? "Registrando..." : "Registrar chegada e concluir"}
          </button>
        </form>
      ) : (
        <form onSubmit={registrarSaida}>
          <section className="qr-cartao">
            <h2 className="qr-cartao__titulo">
              <span className="qr-passo">1</span> Saida do veículo
            </h2>

            <div className="campo">
              <label htmlFor="matrícula">Matrícula do condutor *</label>
              <div className="qr-matricula">
                <input
                  id="matrícula" required value={matrícula}
                  onChange={(e) => setMatrícula(e.target.value)}
                  onBlur={() => matrícula.trim() && buscarCondutor()}
                  placeholder="Ex.: 12548"
                />
                <button type="button" className="botao" onClick={buscarCondutor}>Buscar</button>
              </div>
            </div>

            {condutor && (
              <div className="qr-condutor">
                <Icone nome="user" tamanho={18} />
                <span>
                  <strong>{condutor.nome}</strong>
                  {condutor.categoria_cnh ? ` - CNH ${condutor.categoria_cnh}` : ""}
                </span>
              </div>
            )}

            <div className="campo">
              <label htmlFor="km-saida">KM de saida *</label>
              <input
                id="km-saida" type="number" required min={veiculo.quilometragem_atual}
                value={saida.odometro_saida}
                onChange={(e) => setSaida((s) => ({ ...s, odometro_saida: e.target.value }))}
              />
              <span className="campo__ajuda">
                Ultimo KM registrado: {numero(veiculo.quilometragem_atual)} km
              </span>
            </div>

            <div className="campo">
              <label htmlFor="local">Local de saida</label>
              <input
                id="local" value={saida.local_saida} placeholder="Ex.: Sede da CMTT"
                onChange={(e) => setSaida((s) => ({ ...s, local_saida: e.target.value }))}
              />
            </div>

            <div className="campo">
              <label htmlFor="percurso">Percurso / atividade *</label>
              <textarea
                id="percurso" rows={2} required value={saida.percurso}
                placeholder="Ex.: Fiscalização de transito - Regiao Central"
                onChange={(e) => setSaida((s) => ({ ...s, percurso: e.target.value }))}
              />
            </div>

            <div className="campo">
              <label htmlFor="obs-saida">Observações (saida)</label>
              <textarea
                id="obs-saida" rows={2} value={saida.observações}
                onChange={(e) => setSaida((s) => ({ ...s, observações: e.target.value }))}
              />
            </div>
          </section>

          <section className="qr-cartao">
            <h2 className="qr-cartao__titulo">
              <span className="qr-passo">2</span> Equipamentos obrigatorios
            </h2>
            <p className="qr-cartao__nota">
              Confira os itens abaixo antes de sair com o veículo.
            </p>

            <div className="qr-equipamentos">
              {EQUIPAMENTOS.map((código) => {
                const item = equipamentos[código];
                return (
                  <div className="qr-equipamento" key={código} data-ausente={!item.conforme}>
                    <strong>{rotulo("equipamento", código)}</strong>
                    <div className="qr-equipamento__botoes">
                      <button
                        type="button" data-ativo={item.conforme}
                        onClick={() =>
                          setEquipamentos((e) => ({ ...e, [código]: { ...item, conforme: true } }))
                        }
                      >
                        Presente
                      </button>
                      <button
                        type="button" data-ativo={!item.conforme} data-perigo="sim"
                        onClick={() =>
                          setEquipamentos((e) => ({ ...e, [código]: { ...item, conforme: false } }))
                        }
                      >
                        Ausente
                      </button>
                    </div>
                    {!item.conforme && (
                      <input
                        placeholder="O que houve com este item?"
                        value={item.observacao}
                        onChange={(ev) =>
                          setEquipamentos((e) => ({
                            ...e, [código]: { ...item, observacao: ev.target.value },
                          }))
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="qr-rodape">
            <p>
              Depois de devolver o veículo, leia o QR Code de novo para registrar a
              chegada e fechar o checklist.
            </p>
            <button className="botao botao--primario qr-botao" disabled={enviando}>
              {enviando ? "Registrando..." : "Registrar saida"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
