/**
 * AbasVeiculo.jsx - Abas Inspecoes, Manutencoes, Documentos e Ocorrencias dos
 * Detalhes do Veiculo (Frotas) e da Viatura (Fiscalizacao), no desenho do
 * Cesar de 29/10. Cada aba e uma AbaRegistros com as colunas, o filtro de
 * situacao, o botao de novo, o painel de detalhes ao lado e - na inspecao, na
 * manutencao e na ocorrencia - as fotos e os documentos embaixo da lista.
 *
 * Ficam aqui (e nao em cada tela) para o veiculo e a viatura mostrarem
 * exatamente a mesma coisa. A aba Sinistros usa a AbaSinistros do Motorista.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Selo from "./Selo.jsx";
import AbaRegistros from "./AbaRegistros.jsx";
import AnexosRegistro from "./AnexosRegistro.jsx";
import RegistrarOs from "./RegistrarOs.jsx";
import AgendarInspecao from "./AgendarInspecao.jsx";
import EditarInspecao from "./EditarInspecao.jsx";
import FormularioDocumento from "./FormularioDocumento.jsx";
import { PainelInspecao, PainelOs, PainelDocumento, PainelOcorrencia } from "./PaineisRegistro.jsx";
import { SeloInspecao, FREQUENCIA_INSPECAO } from "./ResumosLista.jsx";
import { api } from "../lib/api.js";
import { data, dinheiro, hora, numero, numeroOs, rotulo } from "../lib/formato.js";

const vazio = (v) => (v === null || v === undefined || v === "" ? "—" : v);
const tipoCurto = (t) => (t === "application/pdf" ? "PDF" : t === "image/png" ? "PNG" : t === "image/jpeg" ? "JPG" : "DOC");
const Clamp = ({ texto }) => <span className="as-clamp" title={texto || ""}>{vazio(texto)}</span>;

// ---------------------------------------------------------------- Inspecoes
export function AbaInspecoesVeiculo({ veiculo: v, podeGerenciar }) {
  const navegar = useNavigate();
  const abrir = (i) => navegar(`/frotas/inspecoes/${i.id_inspecao}`);
  // 29/10: Nova e Editar abrem a janela aqui mesmo, sem sair do veiculo.
  // Pendente reagenda (AgendarInspecao); concluida corrige os itens.
  const [janela, setJanela] = useState(null); // { novo } | { agendada } | { feita }
  const [recarga, setRecarga] = useState(0);
  const editar = async (i) => {
    try {
      const completa = await api(`/frotas/inspecoes/${i.id_inspecao}`);
      setJanela(completa.status === "ABERTA" ? { agendada: completa } : { feita: completa });
    } catch (e) { alert(e.message); }
  };
  const recarregar = () => setRecarga((n) => n + 1);
  return (
    <>
    <AbaRegistros recarga={recarga}
      titulo="Lista de Inspeções" icone="inspecao" placeholder="Buscar por nº, responsável..."
      situacoes={[
        { valor: "ABERTA", rotulo: "Pendente", campo: "status" },
        { valor: "EM_ANALISE", rotulo: "Em análise", campo: "analise" },
        { valor: "ANALISADO", rotulo: "Analisado", campo: "analise" },
        { valor: "APROVADO", rotulo: "Aprovado", campo: "analise" },
      ]}
      novo={podeGerenciar && { rotulo: "Nova Inspeção", aoClicar: () => setJanela({ novo: true }) }}
      caminho={`/frotas/inspecoes?veiculo=${v.id_veiculo}`} chave={(i) => i.id_inspecao} unidade="inspeções"
      vazio="Nenhuma inspeção registrada para este veículo."
      colunas={[
        { rotulo: "Nº da Inspeção", render: (i) => <strong>{vazio(i.numero)}</strong> },
        { rotulo: "Data", render: (i) => data(i.data_realizacao || i.data_programada) },
        { rotulo: "Tipo", classe: "as-quebra", render: (i) => `Inspeção ${(FREQUENCIA_INSPECAO[i.tipo] || i.tipo || "").toLowerCase()}` },
        { rotulo: "Responsável", classe: "as-quebra", render: (i) => <Clamp texto={i.responsavel} /> },
        { rotulo: "Local", classe: "as-quebra", render: (i) => <Clamp texto={i.local} /> },
        { rotulo: "Quilometragem", render: (i) => (i.quilometragem ? `${numero(i.quilometragem)} km` : "—") },
        { rotulo: "Status", render: (i) => <SeloInspecao i={i} /> },
      ]}
      acoes={(i) => [
        { rotulo: "Abrir em Inspeções", icone: "visualizar", aoClicar: () => abrir(i) },
        ...(podeGerenciar ? [{ rotulo: "Editar", icone: "editar", aoClicar: () => editar(i) }] : []),
      ]}
      painel={(i, { fechar }) => (
        <PainelInspecao linha={i} veiculo={v} aoFechar={fechar} destino={`/frotas/inspecoes/${i.id_inspecao}`}
                        aoEditar={podeGerenciar ? () => editar(i) : null} />
      )}
      baixo={(i, versao) => (
        <AnexosRegistro key={`${i.id_inspecao}-${versao}`} tituloFotos="Fotos da Inspeção" podeGerenciar={podeGerenciar}
                        caminhoLista={`/frotas/inspecoes/${i.id_inspecao}/arquivos`} caminhoArquivo="/frotas/inspecoes/arquivos" />
      )} />
    {janela?.novo && (
      <AgendarInspecao idVeiculo={v.id_veiculo} travarVeiculo aoFechar={() => setJanela(null)} aoSalvar={recarregar} />
    )}
    {janela?.agendada && (
      <AgendarInspecao inspecao={janela.agendada} travarVeiculo aoFechar={() => setJanela(null)} aoSalvar={recarregar} />
    )}
    {janela?.feita && (
      <EditarInspecao inspecao={janela.feita} aoFechar={() => setJanela(null)} aoSalvar={recarregar} />
    )}
    </>
  );
}

// ---------------------------------------------------------------- Manutencoes
const SITUACOES_OS = [
  { valor: "PENDENTE", rotulo: "Pendente" },
  { valor: "EM_ANALISE", rotulo: "Em análise" },
  { valor: "EM_MANUTENCAO", rotulo: "Em manutenção" },
  { valor: "RESOLVIDA", rotulo: "Resolvida" },
  { valor: "CANCELADA", rotulo: "Cancelada" },
];

/**
 * caminho/vazio/checklist: a aba Manutencao dos Detalhes do Checklist (29/10)
 * usa a mesma tela, so com as OS daquele checklist; a OS nova nasce ligada a ele.
 * aoNovo/podeNovo: a aba Manutencao da Inspecao abre a OS pela propria tela
 * (ja preenchida com os itens com ressalva) e so depois da inspecao feita.
 */
export function AbaManutencoesVeiculo({ veiculo: v, podeGerenciar, fiscalizacao = false, aoMudar, caminho, vazio: textoVazio, checklist, aoNovo, podeNovo = true, semMenu = false }) {
  const navegar = useNavigate();
  const [janela, setJanela] = useState(null); // "novo" | os (edicao)
  const [recarga, setRecarga] = useState(0);
  const base = fiscalizacao ? "/fiscalizacao/manutencoes" : "/frotas/manutencoes";
  const editar = async (o) => {
    try { setJanela(await api(`/frotas/manutencoes/${o.id_os}`)); } catch (e) { alert(e.message); }
  };
  return (
    <>
      <AbaRegistros
        titulo="Lista de Manutenções" icone="kpi-wrench" placeholder="Buscar por nº, descrição, oficina..."
        situacoes={SITUACOES_OS} recarga={recarga}
        novo={podeGerenciar && podeNovo && { rotulo: "Nova Manutenção", aoClicar: aoNovo || (() => setJanela("novo")) }}
        caminho={caminho || `/frotas/manutencoes?veiculo=${v.id_veiculo}`} chave={(o) => o.id_os} unidade="manutenções"
        vazio={textoVazio || "Nenhuma manutenção registrada para este veículo."}
        colunas={[
          { rotulo: "Nº da OS", render: (o) => <strong>{numeroOs(o.numero)}</strong> },
          { rotulo: "Data", render: (o) => data(o.data_fechamento || o.data_agendada || o.data_abertura) },
          { rotulo: "Tipo", classe: "as-quebra", render: (o) => `Manutenção ${rotulo("tipoOs", o.tipo).toLowerCase()}` },
          { rotulo: "Descrição", classe: "as-quebra as-descricao", render: (o) => <Clamp texto={o.descricao || o.servico_realizado} /> },
          { rotulo: "Quilometragem", render: (o) => (o.quilometragem ? `${numero(o.quilometragem)} km` : "—") },
          { rotulo: "Custo (R$)", render: (o) => (o.custo != null ? dinheiro(o.custo).replace(/^R\$\s?/, "") : "—") },
          { rotulo: "Status", render: (o) => <Selo valor={o.status} /> },
        ]}
        acoes={(o) => (semMenu ? [] : [
          { rotulo: "Abrir em Manutenções", icone: "visualizar", aoClicar: () => navegar(`${base}/${o.id_os}`) },
          ...(podeGerenciar ? [{ rotulo: "Editar", icone: "editar", aoClicar: () => editar(o) }] : []),
        ])}
        painel={(o, { fechar }) => (
          <PainelOs linha={o} veiculo={v} aoFechar={fechar} destino={`${base}/${o.id_os}`}
                    aoEditar={podeGerenciar ? () => editar(o) : null} />
        )}
        baixo={(o, versao) => (
          <AnexosRegistro key={`${o.id_os}-${versao}`} tituloFotos="Fotos da Manutenção" podeGerenciar={podeGerenciar}
                          caminhoLista={`/frotas/manutencoes/${o.id_os}/arquivos`} caminhoArquivo="/frotas/manutencoes/arquivos" />
        )} />
      {janela && (
        <RegistrarOs os={janela === "novo" ? undefined : janela} idVeiculo={String(v.id_veiculo)}
                     checklist={janela === "novo" ? checklist : undefined}
                     aoFechar={() => setJanela(null)}
                     aoSalvar={() => { setRecarga((n) => n + 1); aoMudar?.(); }} />
      )}
    </>
  );
}

// ---------------------------------------------------------------- Documentos
const SITUACOES_DOC = [
  { valor: "VALIDO", rotulo: "Válido" },
  { valor: "VENCENDO", rotulo: "Vencendo" },
  { valor: "VENCIDO", rotulo: "Vencido" },
  { valor: "INATIVO", rotulo: "Inativo" },
];

export function AbaDocumentosVeiculo({ veiculo: v, podeGerenciar, podeAbrir = true, aoMudar }) {
  const navegar = useNavigate();
  const [janela, setJanela] = useState(null); // "novo" | documento (edicao)
  const [recarga, setRecarga] = useState(0);
  return (
    <>
      <AbaRegistros
        titulo="Lista de Documentos" icone="documentos" placeholder="Buscar por nome, número..."
        situacoes={SITUACOES_DOC} recarga={recarga}
        novo={podeGerenciar && { rotulo: "Novo Documento", aoClicar: () => setJanela("novo") }}
        caminho={`/frotas/documentos?veiculo=${v.id_veiculo}`} chave={(d) => d.id_documento} unidade="documentos"
        vazio="Nenhum documento cadastrado para este veículo."
        colunas={[
          { rotulo: "Nome do Documento", classe: "ad-nome-celula", render: (d) => (
            <span className="ad-nome">
              <span className="ad-tipo" data-tipo={d.ultimo_arquivo ? tipoCurto(d.ultimo_arquivo.tipo) : "SEM"}>
                {d.ultimo_arquivo ? tipoCurto(d.ultimo_arquivo.tipo) : "DOC"}
              </span>
              <span className="ad-nome__textos">
                <strong>{d.tipo_documento}</strong>
                <small title={d.ultimo_arquivo?.nome || ""}>{d.ultimo_arquivo?.nome || "Sem arquivo"}</small>
              </span>
            </span>
          ) },
          { rotulo: "Tipo", render: (d) => vazio(d.categoria) },
          { rotulo: "Data de emissão", render: (d) => (d.data_emissao ? data(d.data_emissao) : "—") },
          { rotulo: "Data de validade", render: (d) => (d.data_validade ? data(d.data_validade) : "—") },
          { rotulo: "Status", render: (d) => <Selo valor={d.status} /> },
        ]}
        acoes={(d) => [
          ...(podeAbrir ? [{ rotulo: "Abrir em Documentos", icone: "visualizar", aoClicar: () => navegar(`/frotas/documentos/${d.id_documento}`) }] : []),
          ...(podeGerenciar ? [{ rotulo: "Editar", icone: "editar", aoClicar: () => setJanela(d) }] : []),
        ]}
        painel={(d, { fechar }) => (
          <PainelDocumento linha={d} aoFechar={fechar} destino={podeAbrir ? `/frotas/documentos/${d.id_documento}` : null}
                           aoEditar={podeGerenciar ? () => setJanela(d) : null} />
        )} />
      {janela && (
        <FormularioDocumento modo={janela === "novo" ? "novo" : "editar"} documento={janela === "novo" ? undefined : janela}
                             idVeiculo={String(v.id_veiculo)} aoFechar={() => setJanela(null)}
                             aoSalvar={() => { setRecarga((n) => n + 1); aoMudar?.(); }} />
      )}
    </>
  );
}

// ---------------------------------------------------------------- Ocorrencias
const SITUACOES_OCORRENCIA = [
  { valor: "PENDENTE", rotulo: "Pendente" },
  { valor: "ATRIBUIDA", rotulo: "Atribuída" },
  { valor: "EM_ANDAMENTO", rotulo: "Em andamento" },
  { valor: "FINALIZADA", rotulo: "Finalizada" },
  { valor: "INTERCORRENCIA", rotulo: "Intercorrência" },
];
const TIPO_OCORRENCIA = { QRU: "QRU", PROGRAMADA: "Programada" };

export function AbaOcorrenciasViatura({ veiculo: v, linhas }) {
  const navegar = useNavigate();
  const destino = (o) => `/fiscalizacao/ocorrencias/${o.id_ocorrencia}`;
  return (
    <AbaRegistros
      titulo="Lista de Ocorrências" icone="fisc-ocorrencias" placeholder="Buscar por protocolo, local..."
      situacoes={SITUACOES_OCORRENCIA}
      linhas={linhas} textoBusca={(o) => [o.protocolo, o.endereco, o.descricao, o.equipe].join(" ")}
      chave={(o) => o.id_ocorrencia} unidade="ocorrências" vazio="Nenhuma ocorrência atendida com esta viatura."
      colunas={[
        { rotulo: "Protocolo", render: (o) => <strong>{vazio(o.protocolo)}</strong> },
        { rotulo: "Data", render: (o) => <span className="celula-dupla"><strong>{data(o.data)}</strong><span>{o.hora ? hora(o.hora) : ""}</span></span> },
        { rotulo: "Tipo", render: (o) => TIPO_OCORRENCIA[o.tipo] || o.tipo },
        { rotulo: "Local", classe: "as-quebra", render: (o) => <Clamp texto={o.endereco} /> },
        { rotulo: "Descrição", classe: "as-quebra as-descricao", render: (o) => <Clamp texto={o.descricao} /> },
        { rotulo: "Equipe", render: (o) => vazio(o.equipe) },
        { rotulo: "Status", render: (o) => <Selo valor={o.status} /> },
      ]}
      acoes={(o) => [{ rotulo: "Abrir em Ocorrências", icone: "visualizar", aoClicar: () => navegar(destino(o)) }]}
      painel={(o, { fechar }) => <PainelOcorrencia linha={o} veiculo={v} aoFechar={fechar} destino={destino(o)} />}
      baixo={(o) => (
        <AnexosRegistro key={o.id_ocorrencia} tituloFotos="Fotos da Ocorrência" podeGerenciar={false}
                        caminhoLista={`/fiscalizacao/ocorrencias/${o.id_ocorrencia}/arquivos`} caminhoArquivo="/fiscalizacao/ocorrencias/arquivos" />
      )} />
  );
}

