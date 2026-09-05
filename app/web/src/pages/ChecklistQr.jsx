/**
 * ChecklistQr.jsx - O checklist que o QR Code abre no celular.
 *
 * Tela PUBLICA, a unica do sistema que funciona sem login: a credencial e o
 * token do QR Code, e a matricula identifica o condutor.
 *
 * A tela decide sozinha o que mostrar:
 *   - veiculo sem checklist aberto -> formulario de SAIDA
 *   - veiculo com checklist aberto -> formulario de CHEGADA
 *
 * Por isso o mesmo adesivo serve para os dois momentos: o condutor le o QR ao
 * sair e le de novo ao voltar.
 *
 * SAIDA e CHEGADA nao pedem as mesmas coisas, de proposito:
 *   - a data e a hora da SAIDA vem do relogio do celular e nao se editam:
 *     o condutor esta com o veiculo na mao naquele instante.
 *   - a data e a hora da CHEGADA sao livres, porque nem sempre o checklist e
 *     fechado no momento exato da devolucao.
 *   - o PERCURSO so aparece na chegada: quem sabe onde foi e quem voltou.
 */
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Icone from "../components/Icone.jsx";
import Selo from "../components/Selo.jsx";
import { api } from "../lib/api.js";
import { numero, rotulo } from "../lib/formato.js";
import { reduzirImagem, pesoLegivel } from "../lib/imagem.js";

// Os quatro itens que o condutor confere. O icone e so apoio visual - quem
// manda no que vale e o codigo, que e o mesmo gravado no banco.
const EQUIPAMENTOS = [
  { codigo: "MACACO", rotulo: "Macaco", icone: "eq-macaco" },
  { codigo: "ESTEPE", rotulo: "Estepe", icone: "eq-estepe" },
  { codigo: "TRIANGULO", rotulo: "Triângulo", icone: "eq-triangulo" },
  { codigo: "CHAVE_RODA", rotulo: "Chave de roda", icone: "eq-chave-roda" },
];

// As partes do veiculo que o chamado aceita. Lista fechada de proposito:
// "farol queimado" digitado de dez jeitos diferentes nao vira relatorio.
const PARTES_VEICULO = [
  "PNEUS", "FREIOS", "ILUMINACAO", "MOTOR", "SUSPENSAO",
  "ELETRICA", "AR_CONDICIONADO", "OUTRO",
];

const equipamentosIniciais = () =>
  Object.fromEntries(EQUIPAMENTOS.map((e) => [e.codigo, { conforme: true, observacao: "" }]));

// Data e hora de AGORA, no fuso do proprio aparelho, no formato que os campos
// <input type="date"> e <input type="time"> esperam.
function agora() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return {
    data: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    hora: `${p(d.getHours())}:${p(d.getMinutes())}`,
  };
}

function dataBr(iso) {
  if (!iso) return "—";
  const [a, m, d] = String(iso).slice(0, 10).split("-");
  return d ? `${d}/${m}/${a}` : "—";
}

export default function ChecklistQr() {
  const { token } = useParams();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState("");

  const inicio = useMemo(agora, []);

  const [matricula, setMatricula] = useState("");
  const [condutor, setCondutor] = useState(null);
  const [buscando, setBuscando] = useState(false);

  const [saida, setSaida] = useState({
    data: inicio.data,
    hora: inicio.hora,
    odometro: "",
    observacoes: "",
  });
  // O KM vem preenchido com o ultimo registrado. O condutor confirma; so
  // respondendo "Nao" o campo abre para edicao.
  const [kmConfere, setKmConfere] = useState(null);

  // Data e hora comecam no relogio do aparelho, igual a saida. Nasciam vazias
  // e sao obrigatorias: o motorista teria que digitar dia e hora na mao, no
  // patio, com o veiculo ainda ligado - justamente o atrito que a tela de
  // saida evita preenchendo sozinha. Continuam editaveis porque aqui a
  // correcao e real: quem chegou as 18h e so registrou as 19h precisa poder
  // dizer a hora certa.
  const [chegada, setChegada] = useState({
    data: inicio.data,
    hora: inicio.hora,
    odometro: "",
    percurso: "",
    observacoes: "",
  });

  const [equipamentos, setEquipamentos] = useState(equipamentosIniciais);

  // CHAMADO DE MANUTENCAO
  // E mecanica: pneu furado, farol queimado, freio falhando, barulho no motor.
  // Nada a ver com equipamento faltando, que se resolve na propria grade acima.
  //
  // Os chamados ficam numa FILA LOCAL ate o checklist existir no banco. Na
  // saida o registro so nasce quando o condutor confirma, e um chamado precisa
  // de id_checklist para se prender a alguma coisa - entao eles sobem junto,
  // logo depois, do mesmo jeito que as fotos.
  const [chamados, setChamados] = useState([]);
  const [chamadosAbertos, setChamadosAbertos] = useState([]);
  const [formChamado, setFormChamado] = useState(null);
  // Fotos ja reduzidas, prontas para enviar. Guardamos a dataUrl para
  // mostrar a miniatura sem ler o arquivo de novo.
  const [fotos, setFotos] = useState([]);
  const [preparandoFoto, setPreparandoFoto] = useState(false);
  const MAX_FOTOS = 6;

  useEffect(() => {
    api(`/qrcode/ler/${token}`)
      .then((r) => {
        setDados(r);
        setSaida((s) => ({ ...s, odometro: String(r.veiculo.quilometragem_atual ?? "") }));
      })
      .catch((e) => setErro(e.message));
  }, [token]);

  // Na chegada o checklist ja existe: os chamados abertos na saida aparecem
  // na lista, para o condutor nao abrir o mesmo duas vezes.
  useEffect(() => {
    const aberto = dados?.checklistAberto;
    if (!aberto) return;
    api(`/qrcode/chamados/${token}/${aberto.id_checklist}`)
      .then(setChamadosAbertos)
      .catch(() => setChamadosAbertos([]));
  }, [dados, token]);

  function novoChamado() {
    setFormChamado({ parte_veiculo: "PNEUS", gravidade: "MEDIA", descricao: "" });
  }

  function confirmarChamado() {
    if (!formChamado?.descricao.trim()) {
      setErro("Descreva o problema para abrir o chamado.");
      return;
    }
    setErro("");
    setChamados((c) => [...c, formChamado]);
    setFormChamado(null);
  }

  /**
   * Sobe os chamados da fila DEPOIS que o checklist foi gravado.
   *
   * Como nas fotos, uma falha aqui nao derruba o checklist: o registro do
   * veiculo ja esta salvo e e o que nao pode se perder.
   */
  async function enviarChamados(idChecklist, momento) {
    if (!chamados.length || !idChecklist) return;
    try {
      for (const chamado of chamados) {
        await api(`/qrcode/chamado/${token}`, {
          method: "POST",
          body: { ...chamado, id_checklist: idChecklist, momento },
        });
      }
    } catch (e) {
      setErro(
        `O checklist foi registrado, mas um chamado nao foi aberto (${e.message}). ` +
        "Avise a gestao da frota."
      );
    }
  }

  async function buscarCondutor() {
    const m = matricula.trim();
    if (!m) return;
    setErro("");
    setBuscando(true);
    try {
      // encodeURIComponent: a matricula vai DENTRO do caminho da URL. Uma
      // matricula com espaco, barra, ponto ou acento montaria um endereco
      // invalido e o servidor responderia "nao encontrada" sem nem chegar a
      // consultar o banco.
      setCondutor(await api(`/qrcode/condutor/${encodeURIComponent(token)}/${encodeURIComponent(m)}`));
    } catch (e) {
      setCondutor(null);
      setErro(e.message);
    } finally {
      setBuscando(false);
    }
  }

  // Os itens marcados como ausentes, na ordem da grade.
  const ausentes = EQUIPAMENTOS.filter(({ codigo }) => !equipamentos[codigo].conforme);

  const listaEquipamentos = () =>
    EQUIPAMENTOS.map(({ codigo }) => ({
      equipamento: codigo,
      conforme: equipamentos[codigo].conforme,
      observacao: equipamentos[codigo].conforme
        ? null
        : equipamentos[codigo].observacao || "Item ausente na conferência.",
    }));

  async function escolherFotos(evento) {
    const escolhidos = Array.from(evento.target.files || []);
    evento.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!escolhidos.length) return;

    const cabem = MAX_FOTOS - fotos.length;
    if (cabem <= 0) {
      setErro(`Você já anexou o máximo de ${MAX_FOTOS} fotos.`);
      return;
    }

    setPreparandoFoto(true);
    setErro("");
    try {
      const novas = [];
      for (const arquivo of escolhidos.slice(0, cabem)) {
        novas.push(await reduzirImagem(arquivo));
      }
      setFotos((f) => [...f, ...novas]);
    } catch (e) {
      setErro(e.message);
    } finally {
      setPreparandoFoto(false);
    }
  }

  function removerFoto(indice) {
    setFotos((f) => f.filter((_, i) => i !== indice));
  }

  /**
   * Envia as fotos DEPOIS que o checklist foi gravado - elas precisam de um
   * id_checklist para se prender.
   *
   * Uma falha aqui NAO derruba o checklist: o registro em si ja esta salvo, e
   * perder a foto e muito menos grave que perder a saida do veiculo. O usuario
   * e avisado do que aconteceu.
   */
  async function enviarFotos(momento) {
    if (!fotos.length) return;
    try {
      await api(`/qrcode/foto/${token}`, {
        method: "POST",
        body: { momento, fotos: fotos.map((f) => f.dataUrl) },
      });
    } catch (e) {
      setErro(
        `O checklist foi registrado, mas as fotos não subiram (${e.message}). ` +
        "Fale com a administração se precisar anexá-las."
      );
    }
  }

  async function registrarSaida(e) {
    e.preventDefault();
    if (!condutor) {
      setErro("Confirme a matrícula do condutor antes de continuar.");
      return;
    }
    setEnviando(true);
    setErro("");
    try {
      const criado = await api(`/qrcode/saida/${token}`, {
        method: "POST",
        body: {
          matricula: matricula.trim(),
          odometro_saida: Number(saida.odometro),
          observacoes: saida.observacoes,
          equipamentos: listaEquipamentos(),
        },
      });
      await enviarFotos("SAIDA");
      await enviarChamados(criado?.id_checklist, "SAIDA");
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
      const fechado = await api(`/qrcode/chegada/${token}`, {
        method: "POST",
        body: {
          odometro_chegada: Number(chegada.odometro),
          data_chegada: chegada.data || null,
          hora_chegada: chegada.hora || null,
          percurso: chegada.percurso,
          observacoes: chegada.observacoes,
          equipamentos: listaEquipamentos(),
        },
      });
      await enviarFotos("CHEGADA");
      await enviarChamados(
        fechado?.id_checklist ?? checklistAberto?.id_checklist, "CHEGADA"
      );
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
  const naChegada = Boolean(checklistAberto);

  if (concluido) {
    return (
      <div className="qr-tela">
        <div className="qr-tela__sucesso">
          <Icone nome="check" tamanho={44} />
          <h1>{concluido === "saida" ? "Saída registrada" : "Checklist concluído"}</h1>
          <p>
            {concluido === "saida"
              ? "Boa viagem. Ao retornar, leia o QR Code de novo para registrar a chegada."
              : "Obrigado. O registro foi fechado."}
          </p>
          <p className="qr-tela__veiculo">
            {veiculo.marca} {veiculo.modelo} · {veiculo.placa}
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
  ];

  const kmEditavel = kmConfere === false;

  return (
    <div className="qr-tela">
      {/* A marca inteira, centralizada. O condutor chega aqui pela camera do
          celular, sem login e sem menu: a logo e o unico sinal de que ele
          esta no sistema da prefeitura, e nao numa pagina qualquer. */}
      <header className="qr-tela__topo">
        <img src="/icons/logo-sitra.png" alt="SITRA" />
      </header>

      <div className="qr-tela__leitura">
        <strong>
          <Icone nome="check" tamanho={22} />
          QR Code reconhecido
        </strong>
        <p>
          {naChegada
            ? "Este veículo tem um checklist aberto. Registre a chegada para concluir."
            : "Confira os dados do veículo e preencha o checklist."}
        </p>
      </div>

      <section className="qr-cartao">
        <h2 className="qr-cartao__titulo qr-cartao__titulo--icone">
          <span className="qr-cartao__simbolo"><Icone nome="fisc-viatura" tamanho={20} /></span>
          Dados do veículo
        </h2>
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

      <form onSubmit={naChegada ? registrarChegada : registrarSaida}>
        <section className="qr-cartao">
          <h2 className="qr-cartao__titulo">
            {naChegada ? "Chegada do veículo" : "Saída do veículo"}
          </h2>

          {/* CONDUTOR. Na saida ele se identifica pela matricula; na chegada
              ja esta identificado, entao os campos vem preenchidos e travados. */}
          {naChegada ? (
            <div className="qr-condutor qr-condutor--fixo">
              <Icone nome="user" tamanho={18} />
              <div>
                <strong>{checklistAberto.condutor}</strong>
                <span>Matrícula {checklistAberto.matricula}</span>
                {checklistAberto.data_nascimento && (
                  <span>Nascimento {dataBr(checklistAberto.data_nascimento)}</span>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="campo">
                <label htmlFor="matricula">Matrícula do condutor *</label>
                <div className="qr-matricula">
                  <input
                    id="matricula" required value={matricula}
                    // A matricula da CMTT e so numeros: teclado numerico, que
                    // no patio se digita com uma mao so. enterKeyHint troca o
                    // "ir" do teclado por "buscar", que e o que a tecla faz.
                    inputMode="numeric" enterKeyHint="search"
                    autoComplete="off" placeholder="Ex.: 12548"
                    onChange={(e) => { setMatricula(e.target.value); setCondutor(null); }}
                    onBlur={buscarCondutor}
                    onKeyDown={(e) => {
                      // Enter busca em vez de enviar o formulario pela metade.
                      if (e.key === "Enter") { e.preventDefault(); buscarCondutor(); }
                    }}
                  />
                  <button type="button" className="botao" onClick={buscarCondutor}
                          disabled={buscando || !matricula.trim()}>
                    {buscando ? "..." : "Buscar"}
                  </button>
                </div>
              </div>

              {condutor && (
                <div className="qr-condutor">
                  <Icone nome="user" tamanho={18} />
                  <div>
                    <strong>{condutor.nome}</strong>
                    <span>Nascimento {dataBr(condutor.data_nascimento)}</span>
                    {condutor.categoria_cnh && <span>CNH categoria {condutor.categoria_cnh}</span>}
                  </div>
                </div>
              )}
            </>
          )}

          {/* SAIDA: texto, nao campo.
              O <input type="date"> desenha a data no idioma do APARELHO. Num
              celular em ingles, "2026-09-02" aparece como 09/02/2026 - mes e
              dia trocados numa tela que registra QUANDO o veiculo saiu.
              Na saida estes dois valores nem sao enviados: quem grava o
              horario e o servidor. Eram campos de formulario mostrando uma
              informacao que ninguem preenche e ninguem envia. Como texto, o
              formato e sempre o brasileiro e nao depende do celular.

              CHEGADA: continuam campos, porque ali a pessoa corrige de
              verdade - quem volta as 18h e so registra as 19h precisa poder
              dizer a hora certa - e os valores vao no corpo da requisicao. */}
          {naChegada ? (
            <div className="qr-dupla">
              <div className="campo">
                <label htmlFor="data">Data de chegada *</label>
                <input
                  id="data" type="date" required
                  value={chegada.data}
                  onChange={(e) => setChegada((c) => ({ ...c, data: e.target.value }))}
                />
              </div>
              <div className="campo">
                <label htmlFor="hora">Hora de chegada *</label>
                <input
                  id="hora" type="time" required
                  value={chegada.hora}
                  onChange={(e) => setChegada((c) => ({ ...c, hora: e.target.value }))}
                />
              </div>
            </div>
          ) : (
            <div className="qr-momento">
              <span className="qr-momento__rotulo">Saída registrada em</span>
              <strong className="qr-momento__valor">
                {dataBr(saida.data)} às {saida.hora}
              </strong>
            </div>
          )}

          {/* KM. Na saida o valor ja vem do ultimo registro e o condutor so
              confirma - digitar de novo um numero que o sistema ja sabe e
              convite a erro de digitacao. */}
          {naChegada ? (
            <div className="campo">
              <label htmlFor="km-chegada">KM de chegada *</label>
              <input
                id="km-chegada" type="number" required inputMode="numeric"
                placeholder="Ex.: 45230"
                /* +1 porque o KM de chegada tem de ser MAIOR que o de saida,
                   nao igual: veiculo que saiu e voltou rodou alguma coisa. */
                min={checklistAberto.odometro_saida + 1}
                value={chegada.odometro}
                onChange={(e) => {
                  const v = e.target.value;
                  setChegada((c) => ({ ...c, odometro: v }));
                  // Sem isto o navegador mostra a mensagem PADRAO dele - "o
                  // valor deve ser maior ou igual a X" - que contradiz a regra.
                  // setCustomValidity troca por uma nossa e continua bloqueando
                  // o envio pela validacao nativa do formulario.
                  e.target.setCustomValidity(
                    v !== "" && Number(v) <= checklistAberto.odometro_saida
                      ? `O KM de chegada precisa ser MAIOR que o da saída (${numero(checklistAberto.odometro_saida)} km).`
                      : ""
                  );
                }}
              />
              <span className="campo__ajuda">
                KM na saída: {numero(checklistAberto.odometro_saida)} km.
                O valor informado precisa ser maior que este.
              </span>
            </div>
          ) : (
            <div className="campo">
              <label htmlFor="km-saida">KM de saída *</label>
              <div className="qr-km">
                <input
                  id="km-saida" type="number" required inputMode="numeric"
                  value={saida.odometro} readOnly={!kmEditavel}
                  onChange={(e) => setSaida((s) => ({ ...s, odometro: e.target.value }))}
                />
                <div className="qr-km__confirma" role="group"
                     aria-label="O KM exibido está correto?">
                  <button type="button" data-ativo={kmConfere === true}
                          onClick={() => {
                            setKmConfere(true);
                            setSaida((s) => ({
                              ...s, odometro: String(veiculo.quilometragem_atual ?? ""),
                            }));
                          }}>
                    Sim
                  </button>
                  <button type="button" data-ativo={kmConfere === false}
                          onClick={() => setKmConfere(false)}>
                    Não
                  </button>
                </div>
              </div>
              <span className="campo__ajuda">
                Último KM registrado: {numero(veiculo.quilometragem_atual)} km.
                Marque "Não" caso o KM exibido esteja incorreto para permitir a edição.
              </span>
            </div>
          )}

          {/* O percurso so existe na chegada. */}
          {naChegada && (
            <div className="campo">
              <label htmlFor="percurso">Percurso / atividade</label>
              <textarea
                id="percurso" rows={2} value={chegada.percurso}
                placeholder="Ex.: Fiscalização de trânsito — Região Central"
                onChange={(e) => setChegada((c) => ({ ...c, percurso: e.target.value }))}
              />
            </div>
          )}

        </section>

        <section className="qr-cartao">
          <h2 className="qr-cartao__titulo">Equipamentos obrigatórios</h2>
          <p className="qr-cartao__nota">
            Toque no item para marcar como ausente.
          </p>

          <div className="qr-equipamentos">
            {EQUIPAMENTOS.map(({ codigo, rotulo, icone }) => {
              const item = equipamentos[codigo];
              return (
                <button
                  type="button" key={codigo}
                  className="qr-equipamento"
                  data-ausente={!item.conforme}
                  aria-pressed={item.conforme}
                  onClick={() =>
                    setEquipamentos((e) => ({
                      ...e, [codigo]: { ...item, conforme: !item.conforme },
                    }))
                  }
                >
                  <span className="qr-equipamento__figura">
                    <Icone nome={icone} tamanho={22} />
                  </span>
                  <span className="qr-equipamento__nome">{rotulo}</span>
                  <span className="qr-equipamento__marca">
                    <Icone nome={item.conforme ? "check" : "fechar"} tamanho={18} />
                  </span>
                </button>
              );
            })}
          </div>

          {/* O "o que houve" sai da grade e vem para baixo, em largura inteira.
              Dentro da grade ele herdava meia tela: a pergunta era cortada no
              meio ("O que houve com este item") e sobrava espaco para umas
              poucas palavras - num campo que existe justamente para a pessoa
              explicar a falta de um equipamento obrigatorio. Aqui embaixo cada
              um tem a linha toda e diz de qual item esta falando. */}
          {ausentes.length > 0 && (
            <div className="qr-ausentes">
              {ausentes.map(({ codigo, rotulo }) => (
                <div className="campo" key={codigo}>
                  <label htmlFor={`obs-${codigo}`}>{rotulo} — o que houve?</label>
                  <input
                    id={`obs-${codigo}`}
                    placeholder="Ex.: item não estava no veículo"
                    value={equipamentos[codigo].observacao}
                    onChange={(ev) =>
                      setEquipamentos((e) => ({
                        ...e,
                        [codigo]: { ...e[codigo], observacao: ev.target.value },
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* CHAMADO DE MANUTENCAO
            Aqui e mecanica, nao equipamento: pneu furado, farol queimado,
            freio falhando. Pode abrir mais de um no mesmo checklist. */}
        <section className="qr-cartao">
          <h2 className="qr-cartao__titulo qr-cartao__titulo--icone">
            <span className="qr-cartao__simbolo"><Icone nome="kpi-wrench" tamanho={19} /></span>
            Abrir chamado
          </h2>
          <p className="qr-cartao__nota">
            Pneu furado, farol queimado, freio falhando, barulho no motor.
            Pode abrir mais de um.
          </p>

          {formChamado ? (
            <div className="qr-chamado-form">
              <div className="qr-dupla">
                <div className="campo">
                  <label htmlFor="chamado-parte">Parte do veículo *</label>
                  <select
                    id="chamado-parte" value={formChamado.parte_veiculo}
                    onChange={(e) =>
                      setFormChamado((c) => ({ ...c, parte_veiculo: e.target.value }))}
                  >
                    {PARTES_VEICULO.map((p) => (
                      <option key={p} value={p}>{rotulo("parteVeiculo", p)}</option>
                    ))}
                  </select>
                </div>
                <div className="campo">
                  <label htmlFor="chamado-urgencia">Urgência *</label>
                  <select
                    id="chamado-urgencia" value={formChamado.gravidade}
                    onChange={(e) =>
                      setFormChamado((c) => ({ ...c, gravidade: e.target.value }))}
                  >
                    <option value="BAIXA">Baixa</option>
                    <option value="MEDIA">Média</option>
                    <option value="ALTA">Alta</option>
                  </select>
                </div>
              </div>

              <div className="campo">
                <label htmlFor="chamado-descricao">Descrição do problema *</label>
                <textarea
                  id="chamado-descricao" rows={3} value={formChamado.descricao}
                  placeholder="Ex.: furou o pneu dianteiro direito no percurso"
                  onChange={(e) =>
                    setFormChamado((c) => ({ ...c, descricao: e.target.value }))}
                />
              </div>

              <p className="qr-cartao__nota qr-cartao__nota--alerta">
                O chamado fica preso a este checklist e vai para a fila de
                Manutenções da frota.
              </p>

              <div className="qr-chamado-form__botoes">
                <button type="button" className="botao"
                        onClick={() => setFormChamado(null)}>
                  Cancelar
                </button>
                <button type="button" className="botao botao--primario"
                        onClick={confirmarChamado}>
                  Abrir OS de manutenção
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="botao qr-chamado-abrir" onClick={novoChamado}>
              <Icone nome="mais" tamanho={18} /> Abrir OS de manutenção
            </button>
          )}

          {(chamadosAbertos.length > 0 || chamados.length > 0) && (
            <div className="qr-chamados">
              <span className="qr-chamados__rotulo">Chamados deste checklist</span>

              {chamadosAbertos.map((c) => (
                <div className="qr-chamado" key={`os-${c.id_os}`}>
                  <div>
                    <strong>{rotulo("parteVeiculo", c.parte_veiculo)}</strong>
                    <p>{c.descricao}</p>
                    <span className="qr-chamado__meta">
                      {c.numero ? `OS ${c.numero} · ` : ""}
                      {rotulo("momentoChecklist", c.momento)}
                    </span>
                  </div>
                  <Selo valor={c.status} />
                </div>
              ))}

              {chamados.map((c, i) => (
                <div className="qr-chamado" key={`fila-${i}`}>
                  <div>
                    <strong>{rotulo("parteVeiculo", c.parte_veiculo)}</strong>
                    <p>{c.descricao}</p>
                    <span className="qr-chamado__meta">
                      Será aberto ao registrar {naChegada ? "a chegada" : "a saída"}
                    </span>
                  </div>
                  <button type="button" className="qr-chamado__remover"
                          onClick={() => setChamados((lista) => lista.filter((_, j) => j !== i))}
                          aria-label="Remover chamado">
                    <Icone nome="fechar" tamanho={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="qr-cartao">
          <h2 className="qr-cartao__titulo">Fotos (opcional)</h2>
          <p className="qr-cartao__nota">
            Registre avarias ou o estado do veículo. Até {MAX_FOTOS} fotos.
          </p>

          {fotos.length > 0 && (
            <div className="qr-fotos">
              {fotos.map((f, i) => (
                <figure className="qr-foto-item" key={i}>
                  <img src={f.dataUrl} alt={`Foto ${i + 1}`} />
                  <button type="button" className="qr-foto-item__remover"
                          onClick={() => removerFoto(i)}
                          aria-label={`Remover foto ${i + 1}`}>
                    <Icone nome="fechar" tamanho={16} />
                  </button>
                  <figcaption>{pesoLegivel(f.bytes)}</figcaption>
                </figure>
              ))}
            </div>
          )}

          {fotos.length < MAX_FOTOS && (
            <label className="qr-foto" data-ocupado={preparandoFoto}>
              <input type="file" accept="image/*" capture="environment" multiple
                     onChange={escolherFotos} disabled={preparandoFoto} />
              <Icone nome={preparandoFoto ? "ajuda" : "mais"} tamanho={26} />
              <span>
                {preparandoFoto
                  ? "Preparando a imagem..."
                  : fotos.length
                    ? "Adicionar outra foto"
                    : "Tirar foto ou escolher do aparelho"}
              </span>
            </label>
          )}

          <p className="qr-cartao__nota">
            A foto é reduzida no próprio aparelho antes de subir, para não
            gastar sua internet.
          </p>
        </section>

        <section className="qr-cartao">
          <h2 className="qr-cartao__titulo">Observações (opcional)</h2>
          <div className="campo">
            <textarea
              id="obs" rows={3} aria-label="Observações"
              value={naChegada ? chegada.observacoes : saida.observacoes}
              placeholder="Algo fora do normal no veículo?"
              onChange={(e) =>
                naChegada
                  ? setChegada((c) => ({ ...c, observacoes: e.target.value }))
                  : setSaida((s) => ({ ...s, observacoes: e.target.value }))
              }
            />
          </div>
        </section>

        <div className="qr-rodape">
          {!naChegada && (
            <div className="qr-rodape__aviso">
              <strong>Importante</strong>
              <p>
                Após o retorno do veículo, não se esqueça de registrar a chegada
                para concluir o checklist.
              </p>
            </div>
          )}

          <div className="qr-rodape__botoes">
            {!naChegada && (
              <button type="button" className="botao qr-botao"
                      onClick={() => window.history.back()}>
                Cancelar
              </button>
            )}
            <button className="botao botao--primario qr-botao" disabled={enviando}>
              {enviando
                ? "Registrando..."
                : naChegada
                  ? "Finalizar"
                  : "Continuar para o retorno"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
