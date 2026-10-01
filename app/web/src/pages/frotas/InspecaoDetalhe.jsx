/**
 * InspeçãoDetalhe.jsx - Uma inspeção por inteiro.
 *
 * Mostra os itens verificados em tres colunas - Conforme, Atencao e Nao
 * conforme - alem das observações e do historico.
 */
import { Fragment, useEffect, useState } from "react";
import { useOutletContext, useParams, useNavigate } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import Selo from "../../components/Selo.jsx";
import Modal from "../../components/Modal.jsx";
import EditarInspecao from "../../components/EditarInspecao.jsx";
import RegistrarOs from "../../components/RegistrarOs.jsx";
import { api } from "../../lib/api.js";
import { data, dataHora, hora, numero, numeroOs, rotulo, ROTULOS } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";

const NOME_RESULTADO = { ATENCAO: "Atenção", AVARIA: "Avaria" };

/*
 * O texto inicial da OS: cada item com ressalva, com o que o condutor
 * escreveu. A gestao so ajusta - nao precisa copiar a inspecao a mao para
 * dentro da OS, que era justamente o trabalho que fazia a OS nao ser aberta.
 */
function descricaoDaOs(itens) {
  return itens
    .filter((i) => i.resultado !== "NORMAL")
    .map((i) => `${i.item} (${NOME_RESULTADO[i.resultado] || i.resultado}): ${i.observacao || "sem observação"}`)
    .join("\n");
}

// Marcador das tres colunas de resultado: Conforme, Atencao e Nao conforme.
function Marca({ ativo, tom }) {
  if (!ativo) return <span className="marca marca--vazia">-</span>;
  return <span className="marca" data-tom={tom}>*</span>;
}

export default function InspeçãoDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const [inspeção, setInspeção] = useState(null);
  const [itens, setItens] = useState([]);
  const [erro, setErro] = useState("");
  const [recarga, setRecarga] = useState(0);
  const { podeVer } = useSessao();

  // As tres janelas desta tela: corrigir itens, abrir OS, concluir analise.
  const [corrigindo, setCorrigindo] = useState(false);
  const [abrindoOs, setAbrindoOs] = useState(null);      // formulario da OS ou null
  const [analisando, setAnalisando] = useState(null);    // texto da decisao ou null
  const [erroJanela, setErroJanela] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    definirCabecalho({ titulo: "", legenda: "" });
  }, [definirCabecalho]);

  useEffect(() => {
    api(`/frotas/inspecoes/${id}`).then(setInspeção).catch((e) => setErro(e.message));
    api(`/frotas/inspecoes/${id}/itens`).then((r) => setItens(Array.isArray(r) ? r : [])).catch(() => {});
  }, [id, recarga]);

  const recarregar = () => setRecarga((n) => n + 1);

  /*
   * Abrir OS usa a MESMA janela do Registrar OS, ja preenchida: tipo
   * corretiva, prioridade pela ressalva (Avaria pede mais pressa que Atencao),
   * a descricao e os itens a verificar tirados dos itens com ressalva.
   */
  function abrirOs() {
    const comRessalva = itens.filter((i) => i.resultado !== "NORMAL");
    setAbrindoOs({
      tipo: "CORRETIVA",
      gravidade: comRessalva.some((i) => i.resultado === "AVARIA") ? "ALTA" : "MEDIA",
      descricao: descricaoDaOs(itens),
      itens: comRessalva.map((i) => ({
        descricao: i.item,
        observacao: `${NOME_RESULTADO[i.resultado] || i.resultado}: ${i.observacao || "sem observação"}`,
      })),
    });
  }

  async function enviarAnalise(e) {
    e.preventDefault();
    setEnviando(true);
    setErroJanela("");
    try {
      await api(`/frotas/inspecoes/${id}/analise`, { method: "POST", body: { observacao: analisando } });
      setAnalisando(null);
      recarregar();
    } catch (err) {
      setErroJanela(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (erro) return <Cartao><div className="vazio">{erro}</div></Cartao>;
  if (!inspeção) return <div className="carregando">Carregando a inspeção...</div>;

  const cabecalho = [
    { rotulo: "Veículo", valor: inspeção.placa, nota: `${inspeção.marca} ${inspeção.modelo}`, icone: "kpi-car" },
    { rotulo: "Frequência", valor: rotulo("tipoInspeção", inspeção.tipo), icone: "calendar" },
    {
      rotulo: "Data da inspeção", valor: data(inspeção.data_realizacao),
      nota: hora(inspeção.hora_inicio), icone: "calendar",
    },
    { rotulo: "Responsável", valor: inspeção.responsavel, icone: "user" },
    {
      rotulo: "Situação",
      valor: inspeção.status === "ABERTA" ? "Pendente" : "Concluída",
      icone: "checklist",
    },
    {
      rotulo: "Resultado",
      valor: ROTULOS.analiseInspecao[inspeção.analise]?.texto || "-",
      icone: "chart-line",
    },
  ];

  const secundarios = [
    ["Próxima inspeção", data(inspeção.proxima_inspecao)],
    ["Quilometragem no momento", inspeção.quilometragem ? `${numero(inspeção.quilometragem)} km` : "-"],
    ["Hora de finalização", hora(inspeção.hora_finalizacao)],
    ["Nº da inspeção", inspeção.numero || "-"],
    ["Itens com ressalva", numero(inspeção.itens_com_ressalva || 0)],
  ];

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <Trilha
            itens={[
              { rotulo: "Frotas" },
              { rotulo: "Inspeções", para: "/frotas/inspecoes" },
              { rotulo: "Detalhes da inspeção" },
            ]}
          />
          <h1>Detalhes da inspeção</h1>
          <p>{inspeção.numero || `Inspeção do veículo ${inspeção.placa}`}</p>
        </div>
        <div className="cabecalho-pagina__acoes">
          <button className="botao" onClick={() => navegar("/frotas/inspecoes")}>
            <Icone nome="seta-esquerda" tamanho={15} /> Voltar
          </button>
          {podeVer("FROTAS_REALIZAR_INSPECAO") && (
            <button className="botao"
                    onClick={() => (inspeção.status === "ABERTA"
                      ? navegar(`/frotas/inspecoes?editar=${inspeção.id_inspecao}`)
                      : setCorrigindo(true))}>
              <Icone nome="editar" tamanho={15} /> Editar
            </button>
          )}
        </div>
      </div>

      <div className="faixa-resumo">
        {cabecalho.map((c) => (
          <div className="faixa-resumo__item" key={c.rotulo}>
            <span className="faixa-resumo__icone"><Icone nome={c.icone} tamanho={18} /></span>
            <div>
              <div className="faixa-resumo__rotulo">{c.rotulo}</div>
              <div className="faixa-resumo__valor">{c.valor}</div>
              {c.nota && <div className="faixa-resumo__nota">{c.nota}</div>}
            </div>
          </div>
        ))}
      </div>

      {inspeção.status === "FINALIZADA" && (
        <Cartao
          titulo="Análise da gestão"
          className="cartao--analise"
          acao={
            <>
              {inspeção.analise === "EM_ANALISE" && (
                <div className="analise-aviso">
                  <Icone nome="alert-triangle" tamanho={14} />
                  <span>
                    <strong>
                      {inspeção.itens_com_ressalva}{" "}
                      {inspeção.itens_com_ressalva === 1 ? "item com ressalva" : "itens com ressalva"}:
                    </strong>{" "}
                    abra uma OS ou conclua a análise. Até lá, aparece como "Em análise" na lista.
                  </span>
                </div>
              )}
              {inspeção.analise !== "APROVADO" && (
                <div className="analise-botoes">
                  {/* Com OS aberta, o botao some: o que falta e a oficina devolver
                      e alguem fechar a OS, que aprova a inspecao. */}
                  {podeVer("FROTAS_GERENCIAR_OS") && !inspeção.ordens_servico?.length && (
                    <button className="botao botao--primario botao--pequeno" onClick={abrirOs}>
                      <Icone nome="kpi-wrench" tamanho={14} monocromatico /> Abrir OS
                    </button>
                  )}
                  {inspeção.analise === "EM_ANALISE" && podeVer("FROTAS_REALIZAR_INSPECAO") && (
                    <button className="botao botao--pequeno"
                            onClick={() => { setErroJanela(""); setAnalisando(""); }}>
                      <Icone nome="check" tamanho={14} /> Concluir sem OS
                    </button>
                  )}
                </div>
              )}
            </>
          }
        >
          {inspeção.analise === "APROVADO" && (
            <p className="texto-corrido">
              {inspeção.aprovada_em
                ? <>Aprovada em {dataHora(inspeção.aprovada_em)}, com o fechamento da OS de manutenção.</>
                : "Nenhum item com ressalva: não há o que analisar."}
            </p>
          )}

          {inspeção.analise === "ANALISADO" && inspeção.ordens_servico?.some((o) => !["RESOLVIDA", "CANCELADA"].includes(o.status)) && (
            <p className="texto-corrido analise-espera">
              Aguardando o fechamento da OS: quando ela for fechada, a inspeção passa a Aprovado.
            </p>
          )}

          {inspeção.analise === "ANALISADO" && (
            <p className="texto-corrido">
              Analisada por <strong>{inspeção.analisada_por_nome || "-"}</strong> em{" "}
              {dataHora(inspeção.analisada_em)}.
              {inspeção.analise_observacao && <> Decisão: {inspeção.analise_observacao}</>}
            </p>
          )}

          {inspeção.ordens_servico?.length > 0 && (
            <ul className="os-ligadas">
              {inspeção.ordens_servico.map((os) => (
                <li key={os.id_os}>
                  <button type="button" className="os-ligadas__link"
                          onClick={() => navegar(`/frotas/manutencoes/${os.id_os}`)}>
                    {numeroOs(os.numero)}
                  </button>
                  <Selo valor={os.status} />
                  <span className="os-ligadas__descricao">{os.descricao}</span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      )}

      <Cartao titulo="Informações complementares">
        <dl className="lista-dados lista-dados--grade">
          {secundarios.map(([r, v]) => (
            <div className="lista-dados__linha" key={r}>
              <dt>{r}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </Cartao>

      <Cartao titulo="Itens verificados">
        <div className="rolagem-x">
          <table className="tabela">
            <thead>
              <tr>
                <th>Item verificado</th>
                <th className="coluna-marca">Conforme</th>
                <th className="coluna-marca">Atenção</th>
                <th className="coluna-marca">Não conforme</th>
                <th>Observação</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((i, n) => (
                /*
                 * Linha de titulo quando o grupo muda, com o mesmo agrupamento
                 * que o condutor viu na tela do QR Code. Sem isso a ficha da
                 * inspecao mensal era uma coluna de 21 itens soltos, e ninguem
                 * conseguia conferir se uma secao inteira tinha sido pulada.
                 *
                 * Inspecao antiga nao tem grupo (a lista era unica); ali a
                 * condicao e falsa e a tabela sai como sempre saiu.
                 */
                <Fragment key={i.id_inspecao_item}>
                {i.grupo && i.grupo !== itens[n - 1]?.grupo && (
                  <tr className="tabela__grupo">
                    <th colSpan={5} scope="colgroup">{i.grupo}</th>
                  </tr>
                )}
                <tr>
                  <td>{i.item}</td>
                  <td className="coluna-marca">
                    <Marca ativo={i.resultado === "NORMAL"} tom="verde" />
                  </td>
                  <td className="coluna-marca">
                    <Marca ativo={i.resultado === "ATENCAO"} tom="amarelo" />
                  </td>
                  <td className="coluna-marca">
                    <Marca ativo={i.resultado === "AVARIA"} tom="vermelho" />
                  </td>
                  <td>{i.observacao || "-"}</td>
                </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
          {itens.length === 0 && (
            <div className="vazio">Nenhum item registrado nesta inspeção.</div>
          )}
        </div>
      </Cartao>

      <div className="grade-2">
        <Cartao titulo="Observações gerais">
          <p className="texto-corrido">
            {inspeção.observacoes || "Nenhuma observacao registrada."}
          </p>
        </Cartao>

        <Cartao titulo="Histórico da inspeção">
          <ol className="linha-tempo">
            <li>
              <span className="linha-tempo__ponto" data-tom="verde" />
              <div>
                <strong>Inspeção criada</strong>
                <span>{data(inspeção.data_realizacao)} {hora(inspeção.hora_inicio)}</span>
              </div>
            </li>
            {inspeção.status === "FINALIZADA" && (
              <li>
                <span className="linha-tempo__ponto" data-tom="verde" />
                <div>
                  <strong>Inspeção concluída</strong>
                  <span>
                    {data(inspeção.data_finalizacao)} {hora(inspeção.hora_finalizacao)} -{" "}
                    {inspeção.responsavel}
                  </span>
                </div>
              </li>
            )}
            {inspeção.proxima_inspecao && (
              <li>
                <span className="linha-tempo__ponto" data-tom="amarelo" />
                <div>
                  <strong>Próxima inspeção prevista</strong>
                  <span>{data(inspeção.proxima_inspecao)}</span>
                </div>
              </li>
            )}
          </ol>
        </Cartao>
      </div>

      {corrigindo && (
        <EditarInspecao inspecao={inspeção} aoFechar={() => setCorrigindo(false)} aoSalvar={recarregar} />
      )}

      {abrindoOs && (
        <RegistrarOs
          inspecao={{ id: inspeção.id_inspecao, numero: inspeção.numero, id_veiculo: inspeção.id_veiculo }}
          inicial={abrindoOs}
          aoFechar={() => setAbrindoOs(null)}
          aoSalvar={recarregar}
        />
      )}

      {analisando !== null && (
        <Modal
          titulo="Concluir análise"
          largura={480}
          compacto
          aoFechar={() => setAnalisando(null)}
          rodape={
            <>
              <button className="botao" onClick={() => setAnalisando(null)}>Cancelar</button>
              <button className="botao botao--primario" form="form-analise" disabled={enviando}>
                {enviando ? "Salvando..." : "Concluir análise"}
              </button>
            </>
          }
        >
          <form id="form-analise" className="confirmar-senha" onSubmit={enviarAnalise}>
            <p className="confirmar-senha__texto confirmar-senha__texto--nota">
              A inspeção passa para "Analisado", com o seu nome e o que foi decidido.
            </p>
            {erroJanela && <div className="login__erro">{erroJanela}</div>}
            <div className="campo">
              <label htmlFor="analise-texto">O que foi decidido *</label>
              <textarea id="analise-texto" rows={3} required minLength={5} autoFocus
                        placeholder="Ex.: óleo completado na garagem; não precisa de OS"
                        value={analisando}
                        onChange={(e) => setAnalisando(e.target.value)} />
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
