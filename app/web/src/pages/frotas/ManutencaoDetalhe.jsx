/**
 * ManutencaoDetalhe.jsx - Uma OS de manutencao por inteiro.
 *
 * No mesmo desenho da ficha do checklist: faixa de identificacao no topo,
 * duas abas - Registro da OS e Fechamento da OS, que sao a mesma OS em dois
 * momentos -, o conteudo a esquerda e o apoio (pecas, observacoes, historico)
 * numa coluna a direita. Editar e Fechar OS abrem os mesmos pop-ups da lista.
 */
import { useEffect, useState } from "react";
import { useOutletContext, useParams, useNavigate } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import Selo from "../../components/Selo.jsx";
import RegistrarOs from "../../components/RegistrarOs.jsx";
import FecharOs from "../../components/FecharOs.jsx";
import { api } from "../../lib/api.js";
import { data, dataHora, dinheiro, numero, numeroOs, rotulo } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";

const ORIGEM = {
  FROTAS: { texto: "Registro da gestão" },
  INSPECAO: { texto: "Inspeção", link: (id) => `/frotas/inspecoes/${id}` },
  CHECKLIST_FROTAS: { texto: "Checklist (QR Code)", link: (id) => `/frotas/checklists/${id}` },
  CHECKLIST_FISCALIZACAO: { texto: "Checklist da fiscalização" },
  FISCALIZACAO: { texto: "Fiscalização" },
  SINISTRO: { texto: "Sinistro" },
};
const ENCERRADA = ["RESOLVIDA", "CANCELADA"];
const TOM_PRIORIDADE = { BAIXA: "verde", MEDIA: "amarelo", ALTA: "vermelho" };

// Rotulo + icone de cada campo da faixa, igual a ficha do checklist.
function Campo({ icone, rotulo: texto, children }) {
  return (
    <div className="checklist-faixa__campo">
      <span className="checklist-faixa__rotulo">
        <Icone nome={icone} tamanho={14} />
        {texto}
      </span>
      <div className="checklist-faixa__valor">{children}</div>
    </div>
  );
}

function Dados({ linhas }) {
  return (
    <dl className="lista-dados">
      {linhas.map(([r, v]) => (
        <div className="lista-dados__linha" key={r}>
          <dt>{r}</dt>
          <dd>{v === null || v === undefined || v === "" ? "—" : v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Texto({ children, vazio }) {
  return <p className="texto-corrido texto-quebra">{children || vazio}</p>;
}

function TabelaItens({ itens, vazio }) {
  if (!itens?.length) return <div className="vazio">{vazio}</div>;
  return (
    <table className="tabela checklist-itens">
      <thead>
        <tr><th>Item / serviço</th><th>Observação</th></tr>
      </thead>
      <tbody>
        {itens.map((i, n) => (
          <tr key={n}>
            <td>
              <span className="checklist-itens__ordem">{n + 1}</span>
              {i.descricao}
            </td>
            <td className="checklist-itens__obs">{i.observacao || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ManutencaoDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const { podeVer } = useSessao();
  const [os, setOs] = useState(null);
  const [erro, setErro] = useState("");
  const [recarga, setRecarga] = useState(0);
  const [aba, setAba] = useState(null);          // REGISTRO | FECHAMENTO
  const [editando, setEditando] = useState(false);
  const [fechando, setFechando] = useState(false);

  useEffect(() => {
    definirCabecalho({ titulo: "", legenda: "" });
  }, [definirCabecalho]);

  useEffect(() => {
    api(`/frotas/manutencoes/${id}`)
      .then((r) => {
        setOs(r);
        // Abre na aba que interessa: OS fechada mostra o fechamento primeiro.
        setAba((atual) => atual || (r.status === "RESOLVIDA" ? "FECHAMENTO" : "REGISTRO"));
      })
      .catch((e) => setErro(e.message));
  }, [id, recarga]);

  const recarregar = () => setRecarga((n) => n + 1);

  if (erro) return <Cartao><div className="vazio">{erro}</div></Cartao>;
  if (!os) return <div className="carregando">Carregando a OS...</div>;

  const podeGerenciar = podeVer("FROTAS_GERENCIAR_OS");
  const encerrada = ENCERRADA.includes(os.status);
  const fechada = os.status === "RESOLVIDA";
  const noRegistro = aba !== "FECHAMENTO";
  const origem = ORIGEM[os.origem] || { texto: os.origem };

  const historico = [
    { tom: "verde", titulo: "OS registrada", quando: dataHora(os.data_abertura), quem: os.solicitante },
    os.data_agendada && { tom: "amarelo", titulo: "Agendada para a oficina", quando: data(os.data_agendada), quem: os.oficina },
    os.data_conclusao && { tom: "verde", titulo: "Serviço finalizado pela oficina", quando: data(os.data_conclusao) },
    fechada && { tom: "verde", titulo: "OS fechada", quando: data(os.data_fechamento), quem: os.fechada_por_nome },
    os.status === "CANCELADA" && { tom: "vermelho", titulo: "OS cancelada" },
  ].filter(Boolean);

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <Trilha
            itens={[
              { rotulo: "Frotas" },
              { rotulo: "Manutenções", para: "/frotas/manutencoes" },
              { rotulo: "Detalhes da OS" },
            ]}
          />
          <h1>Detalhes da OS</h1>
          <p>Consulte o registro da OS e o fechamento do serviço feito pela oficina.</p>
        </div>
        <div className="cabecalho-pagina__acoes">
          <button className="botao" onClick={() => navegar("/frotas/manutencoes")}>
            <Icone nome="seta-esquerda" tamanho={15} /> Voltar
          </button>
          {/* Editar acompanha a aba: no Registro edita os dados do registro;
              no Fechamento corrige o fechamento (so existe depois de fechada). */}
          {podeGerenciar && os.status !== "CANCELADA" && (noRegistro || fechada) && (
            <button className="botao" onClick={() => (noRegistro ? setEditando(true) : setFechando(true))}>
              <Icone nome="editar" tamanho={15} /> Editar
            </button>
          )}
          {podeGerenciar && !encerrada && (
            <button className="botao botao--primario" onClick={() => setFechando(true)}>
              <Icone nome="concluir" tamanho={15} monocromatico /> Fechar OS
            </button>
          )}
        </div>
      </div>

      <div className="checklist-faixa">
        <Campo icone="kpi-car" rotulo="Veículo">
          <strong className="checklist-faixa__destaque">{os.placa}</strong>
          <span className="checklist-faixa__apoio">{os.marca} {os.modelo}</span>
        </Campo>
        <Campo icone="documento" rotulo="Nº da OS">
          <strong>{numeroOs(os.numero) || "—"}</strong>
          <span className="checklist-faixa__apoio">{rotulo("tipoOs", os.tipo)}</span>
        </Campo>
        <Campo icone="alert-triangle" rotulo="Prioridade">
          <Selo texto={rotulo("gravidade", os.gravidade)} tom={TOM_PRIORIDADE[os.gravidade]} />
        </Campo>
        <Campo icone="kpi-wrench" rotulo="Oficina">
          <strong>{os.oficina || "—"}</strong>
          {os.telefone_oficina && <span className="checklist-faixa__apoio">{os.telefone_oficina}</span>}
        </Campo>
        <Campo icone="check" rotulo="Situação da OS">
          <Selo valor={os.status} />
        </Campo>
      </div>

      <div className="abas" role="tablist">
        <button type="button" role="tab" className="aba"
                data-ativa={noRegistro} aria-selected={noRegistro}
                onClick={() => setAba("REGISTRO")}>
          Registro da OS
        </button>
        <button type="button" role="tab" className="aba"
                data-ativa={!noRegistro} aria-selected={!noRegistro}
                onClick={() => setAba("FECHAMENTO")}>
          Fechamento da OS
        </button>
      </div>

      <div className="checklist-corpo">
        <div className="checklist-corpo__coluna">
          {noRegistro ? (
            <>
              <Cartao titulo="Dados do registro">
                <Dados
                  linhas={[
                    ["Registrada em", dataHora(os.data_abertura)],
                    ["Registrada por", os.solicitante],
                    [
                      "Origem",
                      origem.link && os.id_registro_origem ? (
                        <button type="button" className="os-ligadas__link"
                                onClick={() => navegar(origem.link(os.id_registro_origem))}>
                          {origem.texto}
                        </button>
                      ) : origem.texto,
                    ],
                    ["Data agendada", os.data_agendada ? data(os.data_agendada) : null],
                    ["KM no registro", os.quilometragem != null ? `${numero(os.quilometragem)} km` : null],
                    ["Responsável pela oficina", os.responsavel_oficina],
                    ["Prazo previsto", os.prazo_previsto ? data(os.prazo_previsto) : null],
                    ["Custo estimado", os.custo_estimado != null ? dinheiro(os.custo_estimado) : null],
                  ]}
                />
              </Cartao>

              <Cartao titulo="Descrição / Serviço a ser realizado">
                <Texto vazio="Sem descrição.">{os.descricao}</Texto>
              </Cartao>

              <Cartao titulo="Itens a serem verificados / serviços">
                <TabelaItens itens={os.itens} vazio="Nenhum item listado no registro." />
              </Cartao>
            </>
          ) : !fechada ? (
            <Cartao>
              <div className="vazio fechamento-pendente">
                <span>
                  {os.status === "CANCELADA"
                    ? "OS cancelada: não há fechamento."
                    : "Esta OS ainda não foi fechada. Quando o serviço voltar da oficina, registre o fechamento."}
                </span>
                {podeGerenciar && !encerrada && (
                  <button className="botao botao--primario botao--pequeno" onClick={() => setFechando(true)}>
                    <Icone nome="concluir" tamanho={14} monocromatico /> Fechar OS
                  </button>
                )}
              </div>
            </Cartao>
          ) : (
            <>
              <Cartao titulo="Dados do fechamento">
                <Dados
                  linhas={[
                    ["Data de fechamento", data(os.data_fechamento)],
                    ["Fechada por", os.fechada_por_nome],
                    ["KM no fechamento", os.km_fechamento != null ? `${numero(os.km_fechamento)} km` : null],
                    ["Data de finalização", os.data_conclusao ? data(os.data_conclusao) : null],
                    ["Custo final", os.custo != null ? dinheiro(os.custo) : null],
                    ["Houve troca de peças", os.houve_troca ? "Sim" : "Não"],
                  ]}
                />
              </Cartao>

              <Cartao titulo="Descrição / Serviço realizado">
                <Texto vazio="Sem descrição.">{os.servico_realizado}</Texto>
              </Cartao>

              <Cartao titulo="Itens verificados / serviços prestados">
                <TabelaItens itens={os.itens_fechamento} vazio="Nenhum item listado no fechamento." />
              </Cartao>
            </>
          )}
        </div>

        <div className="checklist-corpo__coluna checklist-corpo__coluna--lado">
          {noRegistro ? (
            <>
              <Cartao titulo="Peças necessárias">
                <Texto vazio="Nenhuma peça listada no registro.">{os.pecas_necessarias}</Texto>
              </Cartao>
              <Cartao titulo="Observações">
                <Texto vazio="Nenhuma observação no registro.">{os.observacoes}</Texto>
              </Cartao>
            </>
          ) : fechada ? (
            <>
              <Cartao titulo="Peças trocadas">
                <Texto vazio="Nenhuma peça trocada.">{os.pecas_trocadas}</Texto>
              </Cartao>
              <Cartao titulo="Observações">
                <Texto vazio="Nenhuma observação no fechamento.">{os.observacoes_fechamento}</Texto>
              </Cartao>
            </>
          ) : null}

          <Cartao titulo="Histórico da OS">
            <ol className="linha-tempo linha-tempo--compacta">
              {historico.map((h) => (
                <li key={h.titulo}>
                  <span className="linha-tempo__ponto" data-tom={h.tom} />
                  <div>
                    <strong>{h.titulo}</strong>
                    {(h.quando || h.quem) && (
                      <span>{[h.quando, h.quem].filter(Boolean).join(" - ")}</span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Cartao>
        </div>
      </div>

      {editando && (
        <RegistrarOs os={os} aoFechar={() => setEditando(false)} aoSalvar={recarregar} />
      )}
      {fechando && (
        <FecharOs os={os} aoFechar={() => setFechando(false)} aoSalvar={recarregar} />
      )}
    </>
  );
}
