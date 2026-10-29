/**
 * ChecklistFiscDetalhe.jsx - Detalhes do Checklist da Fiscalizacao (desenho
 * do Cesar, 18/10).
 *
 * Saida e chegada lado a lado (hora, odometro e os equipamentos conferidos),
 * os fiscais, as ocorrencias que a equipe atendeu naquele servico e a
 * pontuacao (so quem gerencia a pontuacao ve).
 *
 * Do desenho saiu o que o checklist da Fiscalizacao nao tem: itens "conforme
 * / nao conforme", fotos, area de atuacao, pontos fiscalizados e percurso.
 * Editar abre a correcao do checklist (senha e justificativa), aqui mesmo.
 *
 * 29/10 (desenho do Cesar): faixa da viatura com a foto e as abas Visao
 * Geral, Checklist de Saida, Ocorrencias, Checklist de Entrada, Manutencao
 * (a mesma tela da aba Manutencoes do veiculo, so com as OS abertas neste
 * checklist pelo QR Code), Pontuacao e Historico.
 */
import { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import Selo from "../../components/Selo.jsx";
import JanelaCadastro from "../../components/JanelaCadastro.jsx";
import FaixaVeiculo from "../../components/FaixaVeiculo.jsx";
import AbaRegistros from "../../components/AbaRegistros.jsx";
import { PainelOcorrencia } from "../../components/PaineisRegistro.jsx";
import { AbaManutencoesVeiculo } from "../../components/AbasVeiculo.jsx";
import { Tabela, Abas } from "../../components/FichaTabela.jsx";
import { api, apiArquivo } from "../../lib/api.js";
import { data, dataHora, hora, numero } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";
import { Item, Linhas } from "../ServidorDetalhe.jsx";
import { CONFIG_CHECKLIST_FISC } from "./ChecklistsFiscalizacao.jsx";

const BASE = "/fiscalizacao/checklists";
const TURNO = { DIURNO: "Diurno", NOTURNO: "Noturno" };
const PAPEL = { FISCAL_1: "Fiscal 1", FISCAL_2: "Fiscal 2" };
const TIPO_OCORRENCIA = { QRU: "QRU", PROGRAMADA: "Programada" };
const ACAO = { CRIAR: "Checklist registrado", EDITAR: "Checklist corrigido", EXCLUIR: "Checklist excluído" };
const qtd = (n) => (n === null || n === undefined ? "—" : numero(n));

function Pontos({ valor }) {
  const n = Number(valor || 0);
  return <strong className="fd-pontos" data-sinal={n > 0 ? "mais" : n < 0 ? "menos" : "zero"}>
    {n > 0 ? "+" : ""}{numero(n, Number.isInteger(n) ? 0 : 1)}
  </strong>;
}

const MOMENTO_FOTO = { SAIDA: "Saída", SERVICO: "Serviço", CHEGADA: "Chegada" };
/** Miniaturas das fotos tiradas pelo QR Code (a rota exige login: baixa como blob). */
function FotosChecklist({ fotos }) {
  const [urls, setUrls] = useState({});
  useEffect(() => {
    let vivo = true;
    const criadas = [];
    (async () => {
      for (const f of fotos) {
        try {
          const u = await apiArquivo(`/qrcode/fiscal/fotos/arquivo/${f.id_foto}`);
          criadas.push(u);
          if (vivo) setUrls((x) => ({ ...x, [f.id_foto]: u }));
        } catch { /* sem miniatura */ }
      }
    })();
    return () => { vivo = false; criadas.forEach((u) => URL.revokeObjectURL(u)); };
  }, [fotos]);
  return (
    <div className="ck-fotos">
      {fotos.map((f) => (
        <a key={f.id_foto} href={urls[f.id_foto]} target="_blank" rel="noreferrer" className="ck-foto">
          {urls[f.id_foto] ? <img src={urls[f.id_foto]} alt={`Foto ${MOMENTO_FOTO[f.momento]}`} /> : <span>...</span>}
          <small>{MOMENTO_FOTO[f.momento] || f.momento}</small>
        </a>
      ))}
    </div>
  );
}

/** Um lado do checklist (saida ou chegada): equipamentos e os numeros. */
function Etapa({ titulo, feito, quando, equipamentos, chave, rodape }) {
  return (
    <Cartao titulo={<><Icone nome="checklist" tamanho={18} /> {titulo}</>}
            acao={feito ? <Selo texto={`Realizado ${quando}`} tom="verde" /> : <Selo texto="Não realizado" tom="cinza" />}>
      <Tabela linhas={equipamentos} vazio="Nenhum equipamento cadastrado."
              colunas={[
                { rotulo: "Item", classe: "coluna-flexivel", render: (e) => <strong>{e.nome}</strong> },
                { rotulo: "Previsto", render: (e) => qtd(e.previsto) },
                { rotulo: "Conferido", render: (e) => (e[chave] === null || e[chave] === undefined
                  ? <span className="texto-apagado">Não conferido</span> : numero(e[chave])) },
                { rotulo: "Observação", render: (e) => e[`obs_${chave}`] || "—" },
              ]} />
      <div className="ck-numeros">
        {rodape.map((r) => (
          <div key={r.rotulo}>
            <Icone nome={r.icone} tamanho={20} />
            <span><small>{r.rotulo}</small><strong>{r.valor}</strong></span>
          </div>
        ))}
      </div>
    </Cartao>
  );
}

export default function ChecklistFiscDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const { podeVer } = useSessao();
  const [c, setC] = useState(null);
  const [erro, setErro] = useState("");
  const [recarga, setRecarga] = useState(0);
  const [editando, setEditando] = useState(false);
  const [parametros, definirParametros] = useSearchParams();
  const aba = parametros.get("aba") || "geral";
  const setAba = (chave) => {
    const p = new URLSearchParams(parametros);
    if (chave === "geral") p.delete("aba"); else p.set("aba", chave);
    definirParametros(p, { replace: true });
  };

  useEffect(() => { definirCabecalho({ titulo: "", legenda: "" }); }, [definirCabecalho]);
  useEffect(() => {
    api(`/fiscalizacao/checklists/${id}/ficha`).then(setC).catch((e) => setErro(e.message));
  }, [id, recarga]);

  if (erro) return <Cartao><div className="vazio">{erro}</div></Cartao>;
  if (!c) return <div className="carregando">Carregando o checklist...</div>;

  const vePontos = Array.isArray(c.pontuacao);
  const positivos = vePontos ? c.pontuacao.filter((r) => Number(r.pontos_aplicados) > 0).reduce((t, r) => t + Number(r.pontos_aplicados), 0) : 0;
  const negativos = vePontos ? c.pontuacao.filter((r) => Number(r.pontos_aplicados) < 0).reduce((t, r) => t + Number(r.pontos_aplicados), 0) : 0;
  const podeEditar = podeVer("FISCALIZACAO_EDITAR_CHECKLIST");
  const finalizado = c.status === "FINALIZADO";
  const horario = `${c.hora_saida ? hora(c.hora_saida) : "—"} às ${c.hora_chegada ? hora(c.hora_chegada) : "—"}`;

  const ABAS = [
    { chave: "geral", rotulo: "Visão Geral", icone: "checklist" },
    { chave: "saida", rotulo: "Checklist de Saída", icone: "arrow-up" },
    { chave: "ocorrencias", rotulo: "Ocorrências", icone: "fisc-ocorrencias", total: c.ocorrencias.length },
    { chave: "entrada", rotulo: "Checklist de Entrada", icone: "seta-baixo" },
    { chave: "manutencao", rotulo: "Manutenção", icone: "kpi-wrench", total: (c.os || []).length || undefined },
    vePontos && { chave: "pontuacao", rotulo: "Pontuação", icone: "fisc-bolt", total: c.pontuacao.length },
    { chave: "historico", rotulo: "Histórico", icone: "historico" },
  ].filter(Boolean);
  const fotosDe = (m) => (c.fotos || []).filter((f) => f.momento === m);
  const veiculoFaixa = { id_veiculo: c.id_veiculo, placa: c.placa, marca: c.marca, modelo: c.modelo, foto_em: c.foto_em };
  const etapaSaida = (
    <Etapa titulo="Checklist de Saída" feito chave="saida" equipamentos={c.equipamentos}
           quando={`em ${data(c.data_abertura)} ${c.hora_saida ? hora(c.hora_saida) : ""}`}
           rodape={[
             { icone: "odometro", rotulo: "Hodômetro de saída", valor: `${numero(c.odometro_saida)} km` },
             { icone: "calendar", rotulo: "Hora da saída (informada)", valor: c.hora_saida ? hora(c.hora_saida) : "—" },
             { icone: "historico", rotulo: "Registrada no sistema", valor: c.saida_registrada_em ? dataHora(c.saida_registrada_em) : "—" },
           ]} />
  );
  const etapaChegada = (
    <Etapa titulo="Checklist de Chegada" feito={finalizado} chave="chegada" equipamentos={c.equipamentos}
           quando={c.data_finalizacao ? `em ${dataHora(c.data_finalizacao)}` : ""}
           rodape={[
             { icone: "odometro", rotulo: "Hodômetro de chegada", valor: c.odometro_chegada != null ? `${numero(c.odometro_chegada)} km` : "—" },
             { icone: "calendar", rotulo: "Hora da chegada (informada)", valor: c.hora_chegada ? hora(c.hora_chegada) : "—" },
             { icone: "historico", rotulo: "Registrada no sistema", valor: c.chegada_registrada_em ? dataHora(c.chegada_registrada_em) : "—" },
             { icone: "kpi-steering", rotulo: "KM rodado", valor: c.km_rodado != null ? `${numero(c.km_rodado)} km` : "—" },
           ]} />
  );
  const subAba = (saida) => (
    <div className="vd-corpo">
      <div className="vd-corpo__principal">{saida ? etapaSaida : etapaChegada}</div>
      <div className="vd-corpo__lado">
        <Cartao titulo={<><Icone nome="historico" tamanho={18} /> Informações do Checklist</>}
                acao={<span className="vd-cartao-acao"><Selo valor={c.status} /></span>}>
          <Linhas linhas={saida ? [
            ["Data", data(c.data_abertura)],
            ["Hora de saída", c.hora_saida ? hora(c.hora_saida) : null],
            ...c.fiscais.map((f) => [PAPEL[f.tipo] || f.tipo, `${f.nome} (${f.matricula})`]),
            ["Hodômetro de saída", `${numero(c.odometro_saida)} km`],
            ["Equipe", c.equipe],
          ] : [
            ["Data", c.data_finalizacao ? data(c.data_finalizacao) : null],
            ["Hora de chegada", c.hora_chegada ? hora(c.hora_chegada) : null],
            ["Hodômetro de chegada", c.odometro_chegada != null ? `${numero(c.odometro_chegada)} km` : null],
            ["KM rodado", c.km_rodado != null ? `${numero(c.km_rodado)} km` : null],
            ["Equipe", c.equipe],
          ]} />
        </Cartao>
        <Cartao titulo={<><Icone nome="arquivo-texto" tamanho={18} /> Observações</>}>
          <Linhas linhas={saida ? [["Da saída", c.observacoes], ["Da equipe", c.observacoes_equipe]] : [["Da chegada", c.observacoes_chegada]]} />
        </Cartao>
        <Cartao titulo={<><Icone nome="oc-camera" tamanho={18} /> Fotos da Viatura na {saida ? "Saída" : "Chegada"}</>}>
          {fotosDe(saida ? "SAIDA" : "CHEGADA").length
            ? <FotosChecklist fotos={fotosDe(saida ? "SAIDA" : "CHEGADA")} />
            : <p className="pck-vazio">Nenhuma foto enviada {saida ? "na saída" : "na chegada"}.</p>}
        </Cartao>
      </div>
    </div>
  );

  const COL_OCORRENCIA = [
    { rotulo: "Protocolo", render: (o) => o.protocolo || "—" },
    { rotulo: "Horário", render: (o) => (o.hora ? hora(o.hora) : "—") },
    { rotulo: "Tipo", render: (o) => TIPO_OCORRENCIA[o.tipo] || o.tipo },
    { rotulo: "Descrição", classe: "coluna-flexivel", render: (o) => <span className="celula-cortada" title={o.descricao || ""}>{o.descricao || "—"}</span> },
    { rotulo: "Situação", render: (o) => <Selo valor={o.status} /> },
  ];
  const COL_PONTOS = [
    { rotulo: "Data", render: (r) => data(r.data_registro) },
    { rotulo: "Item", classe: "coluna-flexivel", render: (r) => `${r.codigo} - ${r.item}` },
    { rotulo: "Para", render: (r) => r.servidor || (c.equipe ? `Equipe ${c.equipe}` : "—") },
    { rotulo: "Qtd.", render: (r) => numero(r.quantidade) },
    { rotulo: "Pontos", render: (r) => <Pontos valor={r.pontos_aplicados} /> },
  ];
  const abrirOcorrencia = (o) => navegar(`/fiscalizacao/ocorrencias/${o.id_ocorrencia}`);

  return (
    <div className="ficha">
      <div className="cabecalho-pagina vd-cabecalho">
        <div>
          <Trilha itens={[{ rotulo: "Fiscalização" }, { rotulo: "Checklists", para: BASE }, { rotulo: "Detalhes do Checklist" }]} />
          <div className="vd-titulo">
            <span className="vd-titulo__icone"><Icone nome="checklist" tamanho={26} /></span>
            <div>
              <h1>Detalhes do Checklist da Fiscalização</h1>
              <p>Visualize todas as informações do checklist da viatura feito pela equipe de fiscalização.</p>
            </div>
          </div>
        </div>
        <div className="cabecalho-pagina__acoes">
          <button className="botao" onClick={() => navegar(BASE)}>
            <Icone nome="seta-esquerda" tamanho={15} /> Voltar
          </button>
          {podeEditar && (
            <button className="botao" onClick={() => setEditando(true)}>
              <Icone nome="editar" tamanho={15} /> Editar
            </button>
          )}
        </div>
      </div>

      <FaixaVeiculo
        v={{ id_veiculo: c.id_veiculo, placa: c.placa, marca: c.marca, modelo: c.modelo, tipo_veiculo: c.tipo_veiculo,
             tipo_combustivel: c.tipo_combustivel, ano_fabricacao: c.ano_fabricacao, ano_modelo: c.ano_modelo,
             veiculo_status: c.veiculo_status, foto_em: c.foto_em }}
        dados={[
          { icone: "equipe", rotulo: "Equipe", valor: c.equipe || "Sem equipe",
            apoio: c.servico_data ? `${c.servico_codigo ? `${c.servico_codigo} · ` : ""}${TURNO[c.servico_turno] || c.servico_turno || ""}` : null },
          { icone: "user", rotulo: "Fiscais", valor: c.fiscais.length ? c.fiscais[0].nome : "—",
            apoio: c.fiscais[1] ? c.fiscais[1].nome : null },
          { icone: "calendar", rotulo: "Data do checklist", valor: data(c.data_abertura), apoio: horario },
          { icone: "odometro", rotulo: "KM rodado", valor: c.km_rodado != null ? `${numero(c.km_rodado)} km` : "—" },
          { icone: "concluidas", rotulo: "Status", valor: <Selo valor={c.status} /> },
        ]} />

      <Abas abas={ABAS} ativa={aba} aoMudar={setAba} />

      {aba === "geral" && (
        <>
          <div className="ficha-2 ficha-bloco">
            {etapaSaida}
            {etapaChegada}
          </div>

          <div className="ficha-2 ficha-bloco">
            <div className="ficha-col">
              <Cartao titulo={<><Icone nome="motorista" tamanho={18} /> Fiscais e Serviço</>}>
                <Linhas linhas={[
                  ...c.fiscais.map((f) => [PAPEL[f.tipo] || f.tipo, `${f.nome} (Matrícula: ${f.matricula})`]),
                  ["Equipe", c.equipe],
                  ["Serviço diário", c.servico_data ? (c.id_servico_equipe
                    ? <button type="button" className="pt-nome sd-codigo" onClick={() => navegar(`/fiscalizacao/servico-diario/${c.id_servico_equipe}`)}>
                        {c.servico_codigo} · {data(c.servico_data)} · {TURNO[c.servico_turno] || c.servico_turno}
                      </button>
                    : `${data(c.servico_data)} · ${TURNO[c.servico_turno] || c.servico_turno}`) : null],
                  ["Coordenador", c.coordenador ? `${c.coordenador} (Matrícula: ${c.coordenador_matricula})` : null],
                  ["Observações da saída", c.observacoes],
                  ["Observações da equipe", c.observacoes_equipe],
                  ["Observações da chegada", c.observacoes_chegada],
                ]} />
              </Cartao>
              {(c.os || []).length > 0 && (
                <Cartao titulo={<><Icone nome="kpi-wrench" tamanho={18} /> OS abertas no checklist</>}>
                  <Tabela linhas={c.os} vazio="" aoAbrir={(o) => navegar(`/fiscalizacao/manutencoes/${o.id_os}`)}
                          colunas={[
                            { rotulo: "Nº da OS", render: (o) => o.numero },
                            { rotulo: "Descrição", classe: "coluna-flexivel", render: (o) => <span className="celula-cortada" title={o.descricao}>{o.descricao}</span> },
                            { rotulo: "Momento", render: (o) => (o.momento === "CHEGADA" ? "Chegada" : "Saída") },
                            { rotulo: "Situação", render: (o) => <Selo valor={o.status} /> },
                          ]} />
                </Cartao>
              )}
              {(c.fotos || []).length > 0 && (
                <Cartao titulo={<><Icone nome="documento" tamanho={18} /> Fotos ({c.fotos.length})</>}>
                  <FotosChecklist fotos={c.fotos} />
                </Cartao>
              )}
            </div>
            <div className="ficha-col">
              <Cartao titulo={<><Icone nome="fisc-ocorrencias" tamanho={18} /> Ocorrências Registradas</>}
                      acao={c.ocorrencias.length > 5 && (
                        <button type="button" className="botao botao--pequeno vd-cartao-acao" onClick={() => setAba("ocorrencias")}>
                          Ver todas ({c.ocorrencias.length})
                        </button>
                      )}>
                <Tabela linhas={c.ocorrencias.slice(0, 5)} aoAbrir={abrirOcorrencia}
                        colunas={COL_OCORRENCIA.filter((x) => x.rotulo !== "Descrição")}
                        vazio="A equipe não atendeu ocorrência neste serviço." />
              </Cartao>
              {vePontos && (
                <Cartao titulo={<><Icone nome="fisc-bolt" tamanho={18} /> Pontuação da Equipe</>}
                        acao={c.pontuacao.length > 0 && (
                          <button type="button" className="botao botao--pequeno vd-cartao-acao" onClick={() => setAba("pontuacao")}>
                            Ver detalhes
                          </button>
                        )}>
                  <Linhas linhas={[
                    ["Pontos positivos", <Pontos valor={positivos} />],
                    ["Pontos de penalidade", <Pontos valor={negativos} />],
                    ["Pontuação final", <Pontos valor={positivos + negativos} />],
                  ]} />
                </Cartao>
              )}
            </div>
          </div>
        </>
      )}

      {aba === "saida" && subAba(true)}
      {aba === "entrada" && subAba(false)}

      {aba === "ocorrencias" && (
        <AbaRegistros
          titulo="Lista de Ocorrências" icone="fisc-ocorrencias" placeholder="Buscar por protocolo, descrição..."
          linhas={c.ocorrencias} textoBusca={(o) => [o.protocolo, o.descricao, o.endereco].join(" ")}
          chave={(o) => o.id_ocorrencia} unidade="ocorrências" vazio="A equipe não atendeu ocorrência neste serviço."
          colunas={COL_OCORRENCIA}
          acoes={(o) => [{ rotulo: "Abrir em Ocorrências", icone: "visualizar", aoClicar: () => abrirOcorrencia(o) }]}
          painel={(o, { fechar }) => <PainelOcorrencia linha={{ ...o, equipe: c.equipe }} veiculo={veiculoFaixa} aoFechar={fechar}
                                                       destino={`/fiscalizacao/ocorrencias/${o.id_ocorrencia}`} />} />
      )}

      {aba === "manutencao" && (
        <AbaManutencoesVeiculo veiculo={veiculoFaixa} fiscalizacao podeGerenciar={podeVer("FROTAS_GERENCIAR_OS")} podeNovo={false}
          caminho={`/frotas/manutencoes?origem=CHECKLIST_FISCALIZACAO&registroOrigem=${c.id_checklist}`}
          vazio="Nenhuma OS aberta pela equipe neste checklist." />
      )}

      {aba === "pontuacao" && vePontos && (
        <Cartao titulo={<><Icone nome="fisc-bolt" tamanho={18} /> Pontuação</>}
                acao={<span className="cf-pontos vd-cartao-acao">
                  <span>Positivos <Pontos valor={positivos} /></span>
                  <span>Penalidades <Pontos valor={negativos} /></span>
                  <span>Final <Pontos valor={positivos + negativos} /></span>
                </span>}>
          <Tabela linhas={c.pontuacao} colunas={COL_PONTOS} vazio="Nenhum ponto lançado." />
        </Cartao>
      )}

      {aba === "historico" && (
        <Cartao titulo={<><Icone nome="historico" tamanho={18} /> Histórico do checklist</>}>
          <Tabela linhas={[
            { quando: `${String(c.data_abertura).slice(0, 10)} ${c.hora_saida || ""}`, titulo: "Saída da viatura", texto: `${c.placa} · ${numero(c.odometro_saida)} km` },
            c.data_finalizacao && { quando: String(c.data_finalizacao), titulo: "Chegada da viatura", texto: c.odometro_chegada != null ? `${numero(c.odometro_chegada)} km` : "" },
            ...c.historico.map((h) => ({ quando: String(h.data_hora), titulo: ACAO[h.acao] || h.acao,
              texto: [h.pessoa, h.justificativa].filter(Boolean).join(" · ") })),
          ].filter(Boolean).sort((a, b) => b.quando.localeCompare(a.quando))}
                  vazio="Nenhuma movimentação registrada."
                  colunas={[
                    { rotulo: "Data", render: (e) => (e.quando.slice(11, 16).trim() ? `${data(e.quando.slice(0, 10))} ${e.quando.slice(11, 16)}` : data(e.quando.slice(0, 10))) },
                    { rotulo: "O que aconteceu", render: (e) => <strong>{e.titulo}</strong> },
                    { rotulo: "Detalhes", classe: "coluna-flexivel", render: (e) => <span className="celula-cortada" title={e.texto}>{e.texto || "—"}</span> },
                  ]} />
        </Cartao>
      )}

      {editando && (
        <JanelaCadastro config={CONFIG_CHECKLIST_FISC} id={c.id_checklist}
                        aoFechar={() => setEditando(false)}
                        aoSalvar={() => setRecarga((n) => n + 1)} />
      )}
    </div>
  );
}
