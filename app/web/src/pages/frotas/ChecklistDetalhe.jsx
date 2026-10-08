/**
 * ChecklistDetalhe.jsx - Detalhes do Checklist do Veiculo.
 *
 * Desenho do Cesar (06/10), o mais parecido possivel, no padrao das telas de
 * detalhes: faixa do veiculo; abas Visao geral, Checklist de saida, Checklist
 * de entrada, Manutencao e Historico. Na visao geral, a conferencia dos
 * equipamentos na saida e na chegada lado a lado, o percurso, o resumo e os
 * chamados de manutencao abertos pelo condutor no QR Code.
 *
 * Fica de fora o que o SITRA nao tem: foto do veiculo e nivel de combustivel.
 * O checklist so tem quatro itens (os equipamentos obrigatorios) e cada um e
 * Conforme ou Nao conforme - nao existe "Atencao" aqui.
 */
import { useEffect, useState } from "react";
import { useOutletContext, useParams, useNavigate, useSearchParams } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import Selo from "../../components/Selo.jsx";
import ResumoVeiculo from "../../components/ResumoVeiculo.jsx";
import HistoricoAuditoria from "../../components/HistoricoAuditoria.jsx";
import RegistrarOs from "../../components/RegistrarOs.jsx";
import CorrigirChecklist from "../../components/CorrigirChecklist.jsx";
import { api, apiArquivo } from "../../lib/api.js";
import { data, dataHora, hora, numero, numeroOs, rotulo } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";

const EQUIPAMENTOS = [
  { chave: "MACACO", nome: "Macaco" },
  { chave: "ESTEPE", nome: "Estepe" },
  { chave: "TRIANGULO", nome: "Triângulo" },
  { chave: "CHAVE_RODA", nome: "Chave de roda" },
];
const vazio = (v) => (v === null || v === undefined || v === "" ? "—" : v);

function Item({ rotulo: r, children }) {
  return (
    <div className="vd-resumo__item">
      <span className="vd-resumo__rotulo">{r}</span>
      <span className="vd-resumo__valor">{children}</span>
    </div>
  );
}

function StatusItem({ conferido }) {
  if (!conferido) return <span className="ck-status" data-tom="cinza"><span className="ck-status__ponto">–</span> Não verificado</span>;
  return conferido.conforme
    ? <span className="ck-status" data-tom="verde"><span className="ck-status__ponto">✓</span> Conforme</span>
    : <span className="ck-status" data-tom="vermelho"><span className="ck-status__ponto">!</span> Não conforme</span>;
}

/** Cartao de um momento (saida ou chegada): os 4 itens e o rodape com KM e fotos. */
function CartaoMomento({ titulo, realizadoEm, itens, rodape, aguardando }) {
  return (
    <Cartao
      titulo={<><Icone nome="checklist" tamanho={18} /> {titulo}</>}
      acao={realizadoEm && <span className="ck-realizado vd-cartao-acao">Realizado em {realizadoEm}</span>}
    >
      {aguardando ? (
        <div className="insp-nota"><Icone nome="informacao" tamanho={16} /><span>{aguardando}</span></div>
      ) : (
        <>
          <div className="rolagem-x">
            <table className="tabela vd-tabela tabela-ficha ck-tabela">
              <thead><tr><th>Item</th><th>Status</th><th>Observação</th></tr></thead>
              <tbody>
                {EQUIPAMENTOS.map((e, n) => {
                  const c = itens.find((x) => x.equipamento === e.chave);
                  return (
                    <tr key={e.chave}>
                      <td><span className="ck-item"><span className="ck-item__n">{n + 1}</span>{e.nome}</span></td>
                      <td><StatusItem conferido={c} /></td>
                      <td>{vazio(c?.observacao)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="ck-rodape">
            {rodape.map((r) => (
              <div className="ck-rodape__item" key={r.rotulo}>
                <Icone nome={r.icone} tamanho={20} />
                <div><span>{r.rotulo}</span><strong>{r.valor}</strong></div>
              </div>
            ))}
          </div>
        </>
      )}
    </Cartao>
  );
}

export default function ChecklistDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const { podeVer } = useSessao();
  const [checklist, setChecklist] = useState(null);
  const [erro, setErro] = useState("");
  const [fotos, setFotos] = useState([]);
  const [recarga, setRecarga] = useState(0);
  const [abrindoOs, setAbrindoOs] = useState(false);
  // Editar abre a correcao aqui mesmo (08/10), sem ir para a lista.
  const [corrigindo, setCorrigindo] = useState(false);
  const [parametros, definirParametros] = useSearchParams();
  const aba = parametros.get("aba") || "geral";
  const setAba = (chave) => {
    const p = new URLSearchParams(parametros);
    if (chave === "geral") p.delete("aba"); else p.set("aba", chave);
    definirParametros(p, { replace: true });
  };

  useEffect(() => {
    definirCabecalho({ titulo: "", legenda: "" });
  }, [definirCabecalho]);

  useEffect(() => {
    api(`/frotas/checklists/${id}`).then(setChecklist).catch((e) => setErro(e.message));
  }, [id, recarga]);

  // As fotos: primeiro a lista, depois o binario de cada uma (a rota exige o
  // token, entao vira endereco de memoria).
  useEffect(() => {
    if (!checklist) return undefined;
    let vivo = true;
    const enderecos = [];
    api(`/qrcode/fotos/checklist/${id}`)
      .then(async (lista) => {
        const carregadas = [];
        for (const foto of lista || []) {
          try {
            const url = await apiArquivo(`/qrcode/foto/arquivo/${foto.id_foto}`);
            enderecos.push(url);
            carregadas.push({ ...foto, url });
          } catch { /* uma foto que nao carrega nao derruba as outras */ }
        }
        if (vivo) setFotos(carregadas);
      })
      .catch(() => setFotos([]));
    return () => { vivo = false; enderecos.forEach((u) => URL.revokeObjectURL(u)); };
  }, [checklist, id]);

  if (erro) return <Cartao><div className="vazio">{erro}</div></Cartao>;
  if (!checklist) return <div className="carregando">Carregando o checklist...</div>;

  const c = checklist;
  const semChegada = c.status === "ABERTO";
  const equip = (momento) => (c.equipamentos || []).filter((e) => (e.momento || "SAIDA") === momento);
  const naSaida = equip("SAIDA");
  const naChegada = equip("CHEGADA");
  const fotosDe = (momento) => fotos.filter((f) => (f.momento || "SAIDA") === momento);
  const chamados = c.chamados || [];
  const podeEditar = podeVer("FROTAS_EDITAR_CHECKLIST");
  const podeOs = podeVer("FROTAS_GERENCIAR_OS");

  // Resumo: as conferencias dos quatro itens na saida e na chegada.
  const conferencias = [...naSaida, ...naChegada];
  const totalItens = EQUIPAMENTOS.length * (semChegada ? 1 : 2);
  const conformes = conferencias.filter((e) => e.conforme).length;
  const naoConformes = conferencias.filter((e) => !e.conforme).length;
  const naoVerificados = Math.max(0, totalItens - conformes - naoConformes);
  const pct = (n) => (totalItens ? Math.round((n / totalItens) * 100) : 0);

  const saidaEm = `${data(c.data_abertura)} ${hora(c.hora_saida)}`;
  const chegadaEm = c.data_devolucao ? `${data(c.data_devolucao)} ${hora(c.hora_chegada)}` : null;

  const ABAS = [
    { chave: "geral", rotulo: "Visão Geral", icone: "checklist" },
    { chave: "saida", rotulo: "Checklist de Saída", icone: "arrow-up" },
    { chave: "entrada", rotulo: "Checklist de Entrada", icone: "seta-baixo" },
    { chave: "manutencao", rotulo: "Manutenção", icone: "kpi-wrench", total: chamados.length || undefined },
    { chave: "historico", rotulo: "Histórico", icone: "historico" },
  ];

  const cartaoSaida = (
    <CartaoMomento
      titulo="Checklist de Saída"
      realizadoEm={saidaEm}
      itens={naSaida}
      rodape={[
        { icone: "odometro", rotulo: "Hodômetro de saída", valor: `${numero(c.odometro_saida)} km` },
        { icone: "kpi-car", rotulo: "Local de saída", valor: vazio(c.local_saida) },
        { icone: "visualizar", rotulo: "Fotos na saída", valor: `${fotosDe("SAIDA").length} foto${fotosDe("SAIDA").length === 1 ? "" : "s"}` },
      ]}
    />
  );
  const cartaoEntrada = (
    <CartaoMomento
      titulo="Checklist de Entrada"
      realizadoEm={chegadaEm}
      itens={naChegada}
      aguardando={semChegada ? "O veículo ainda não voltou: a conferência de entrada é feita na chegada, pelo QR Code." : null}
      rodape={[
        { icone: "odometro", rotulo: "Hodômetro de entrada", valor: c.odometro_chegada == null ? "—" : `${numero(c.odometro_chegada)} km` },
        { icone: "kpi-steering", rotulo: "KM rodado", valor: c.km_rodado == null ? "—" : `${numero(c.km_rodado)} km` },
        { icone: "visualizar", rotulo: "Fotos na entrada", valor: `${fotosDe("CHEGADA").length} foto${fotosDe("CHEGADA").length === 1 ? "" : "s"}` },
      ]}
    />
  );

  const listaChamados = chamados.length === 0 ? (
    <p className="texto-corrido">Não há chamado de manutenção aberto para este checklist.</p>
  ) : (
    <div className="rolagem-x">
      <table className="tabela vd-tabela tabela-ficha">
        <thead><tr><th>Nº da OS</th><th>Aberta em</th><th>Parte do veículo</th><th>Descrição</th><th>Situação</th></tr></thead>
        <tbody>
          {chamados.map((o) => (
            <tr key={o.id_os} className="vd-tabela__linha" onClick={() => navegar(`/frotas/manutencoes/${o.id_os}`)}>
              <td>{numeroOs(o.numero)}</td>
              <td>{dataHora(o.data_abertura)}</td>
              <td>{o.parte_veiculo ? rotulo("parteVeiculo", o.parte_veiculo) : "—"}</td>
              <td className="coluna-flexivel"><span className="celula-cortada" title={o.descricao}>{o.descricao}</span></td>
              <td><Selo valor={o.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const galeria = (momento) => (
    fotosDe(momento).length === 0 ? <p className="texto-corrido">Nenhuma foto anexada neste momento.</p> : (
      <div className="checklist-fotos">
        {fotosDe(momento).map((f) => (
          <a key={f.id_foto} href={f.url} target="_blank" rel="noreferrer">
            <img src={f.url} alt={`Foto do checklist ${f.id_foto}`} />
          </a>
        ))}
      </div>
    )
  );

  const dadosMomento = (momento) => {
    const saida = momento === "SAIDA";
    const linhas = saida
      ? [["Data e hora informadas", saidaEm], ["Enviado em", dataHora(c.criado_em)], ["KM de saída", `${numero(c.odometro_saida)} km`],
        ["Local de saída", c.local_saida], ["Percurso / atividade", c.percurso], ["Observações do condutor", c.observacoes]]
      : [["Data e hora informadas", chegadaEm], ["Enviado em", c.data_finalizacao ? dataHora(c.data_finalizacao) : null],
        ["KM de chegada", c.odometro_chegada == null ? null : `${numero(c.odometro_chegada)} km`],
        ["KM rodado", c.km_rodado == null ? null : `${numero(c.km_rodado)} km`], ["Observações do condutor", c.observacoes_chegada]];
    return (
      <dl className="vd-dados__coluna">
        {linhas.map(([r, v]) => <div className="vd-dados__linha" key={r}><dt>{r}</dt><dd>{vazio(v)}</dd></div>)}
      </dl>
    );
  };

  const eventos = [
    { quando: c.criado_em, usuario: c.condutor, acao: "Saída", descricao: `Checklist de saída enviado pelo QR Code (${numero(c.odometro_saida)} km)` },
    ...chamados.map((o) => ({ quando: o.data_abertura, usuario: c.condutor, acao: "Chamado", descricao: `${numeroOs(o.numero)} aberta: ${String(o.descricao || "").split("\n")[0]}` })),
    c.data_finalizacao && { quando: c.data_finalizacao, usuario: c.condutor, acao: "Chegada", descricao: `Checklist de entrada enviado (${numero(c.odometro_chegada)} km)` },
  ].filter(Boolean).sort((a, b) => String(b.quando).localeCompare(String(a.quando)));

  return (
    <div className="ficha">
      <div className="cabecalho-pagina vd-cabecalho">
        <div>
          <Trilha
            itens={[
              { rotulo: "Frotas" },
              { rotulo: "Checklists", para: "/frotas/checklists" },
              { rotulo: "Detalhes do Checklist" },
            ]}
          />
          <div className="vd-titulo">
            <span className="vd-titulo__icone"><Icone nome="checklist" tamanho={26} /></span>
            <div>
              <h1>Detalhes do Checklist do Veículo</h1>
              <p>Visualize todas as informações do checklist realizado para este veículo.</p>
            </div>
          </div>
        </div>
        <div className="cabecalho-pagina__acoes esconder-impressao">
          <button className="botao" onClick={() => navegar("/frotas/checklists")}>
            <Icone nome="seta-esquerda" tamanho={15} /> Voltar
          </button>
          {podeEditar && (
            <button className="botao" onClick={() => setCorrigindo(true)}>
              <Icone nome="editar" tamanho={15} /> Editar
            </button>
          )}
        </div>
      </div>

      <section className="vd-resumo">
        <ResumoVeiculo v={c} />
        <div className="vd-resumo__grade vd-resumo__grade--5">
          <div className="vd-resumo__coluna"><Item rotulo="Setor">{vazio(c.setor)}</Item></div>
          <div className="vd-resumo__coluna"><Item rotulo="Data do checklist">{saidaEm}</Item></div>
          <div className="vd-resumo__coluna">
            <Item rotulo="Motorista">{vazio(c.condutor)}</Item>
            {c.matricula && <span className="vd-resumo__apoio">Matrícula: {c.matricula}</span>}
          </div>
          <div className="vd-resumo__coluna"><Item rotulo="Rota / Percurso">{vazio(c.percurso)}</Item></div>
          <div className="vd-resumo__coluna">
            <Item rotulo="Status">{semChegada ? <Selo texto="Em uso" tom="azul" /> : <Selo texto="Concluído" tom="verde" />}</Item>
          </div>
        </div>
      </section>

      <div className="abas vd-abas esconder-impressao" role="tablist">
        {ABAS.map((a) => (
          <button key={a.chave} type="button" role="tab" className="aba"
                  data-ativa={aba === a.chave} aria-selected={aba === a.chave}
                  onClick={() => setAba(a.chave)}>
            <Icone nome={a.icone} tamanho={16} />
            {a.rotulo}
            {a.total ? <span className="vd-abas__total">{a.total}</span> : null}
          </button>
        ))}
      </div>

      {aba === "geral" && (
        <>
          <div className="ficha-2 ficha-bloco">
            {cartaoSaida}
            {cartaoEntrada}
          </div>

          <div className="ficha-2 ficha-bloco">
            <Cartao titulo={<><Icone nome="seta-direita" tamanho={18} /> Rota / Percurso</>}>
              <p className="ficha-subtitulo">Percurso / atividade</p>
              <p className="ck-destaque">{vazio(c.percurso)}</p>
              <p className="ficha-subtitulo">Local de saída</p>
              <p className="ck-destaque">{vazio(c.local_saida)}</p>
              <p className="ficha-subtitulo">Setor do veículo</p>
              <p className="ck-destaque">{vazio(c.setor)}</p>
              {(c.observacoes || c.observacoes_chegada) && (
                <div className="insp-nota insp-nota--pequena">
                  <Icone nome="informacao" tamanho={14} />
                  <span>{[c.observacoes && `Saída: ${c.observacoes}`, c.observacoes_chegada && `Chegada: ${c.observacoes_chegada}`].filter(Boolean).join(" · ")}</span>
                </div>
              )}
            </Cartao>

            <Cartao titulo={<><Icone nome="chart-line" tamanho={18} /> Resumo do Checklist</>}>
              <dl className="ck-resumo">
                <div><dt>Total de itens</dt><dd>{totalItens}</dd></div>
                <div><dt>Conforme</dt><dd><span className="ck-ponto" data-tom="verde" />{conformes} ({pct(conformes)}%)</dd></div>
                <div><dt>Não conforme</dt><dd><span className="ck-ponto" data-tom="vermelho" />{naoConformes} ({pct(naoConformes)}%)</dd></div>
                <div><dt>Não verificado</dt><dd><span className="ck-ponto" data-tom="cinza" />{naoVerificados} ({pct(naoVerificados)}%)</dd></div>
              </dl>
              <p className="vd2-nota">Quatro equipamentos conferidos na saída{semChegada ? "" : " e na chegada"}.</p>
            </Cartao>
          </div>

          {/* Padrao do cartao de manutencao (08/10): titulo "Manutencao" e o
              Abrir OS logo ao lado, igual na Inspecao. */}
          <Cartao
            className="cartao--acao-junto"
            titulo={<><Icone nome="kpi-wrench" tamanho={18} /> Manutenção</>}
            acao={podeOs && chamados.length === 0 && (
              <button className="botao botao--primario botao--pequeno vd-cartao-acao" onClick={() => setAbrindoOs(true)}>
                <Icone nome="kpi-wrench" tamanho={14} monocromatico /> Abrir OS
              </button>
            )}
          >
            {listaChamados}
          </Cartao>
        </>
      )}

      {aba === "saida" && (
        <div className="ficha-2 ficha-bloco">
          {cartaoSaida}
          <Cartao titulo={<><Icone nome="informacao" tamanho={18} /> Dados da saída</>}>
            {dadosMomento("SAIDA")}
            <p className="ficha-subtitulo" style={{ marginTop: 12 }}>Fotos na saída</p>
            {galeria("SAIDA")}
          </Cartao>
        </div>
      )}

      {aba === "entrada" && (
        <div className="ficha-2 ficha-bloco">
          {cartaoEntrada}
          <Cartao titulo={<><Icone nome="informacao" tamanho={18} /> Dados da entrada</>}>
            {semChegada ? <p className="texto-corrido">Aguardando a chegada do veículo.</p> : (
              <>
                {dadosMomento("CHEGADA")}
                <p className="ficha-subtitulo" style={{ marginTop: 12 }}>Fotos na entrada</p>
                {galeria("CHEGADA")}
              </>
            )}
          </Cartao>
        </div>
      )}

      {aba === "manutencao" && (
        <Cartao
          className="cartao--acao-junto"
          titulo={<><Icone nome="kpi-wrench" tamanho={18} /> Manutenção</>}
          acao={podeOs && chamados.length === 0 && (
            <button className="botao botao--primario botao--pequeno vd-cartao-acao" onClick={() => setAbrindoOs(true)}>
              <Icone nome="kpi-wrench" tamanho={14} monocromatico /> Abrir OS
            </button>
          )}
        >
          {listaChamados}
        </Cartao>
      )}

      {aba === "historico" && (
        <div className="ficha-2 ficha-bloco">
          <Cartao titulo={<><Icone nome="historico" tamanho={18} /> Linha do tempo</>}>
            <div className="rolagem-x">
              <table className="tabela vd-tabela tabela-ficha">
                <thead><tr><th>Data e hora</th><th>Usuário</th><th>Ação</th><th>Descrição</th></tr></thead>
                <tbody>
                  {eventos.map((e, n) => (
                    <tr key={n}>
                      <td>{dataHora(e.quando)}</td><td>{vazio(e.usuario)}</td><td>{e.acao}</td>
                      <td className="coluna-flexivel"><span className="celula-cortada" title={e.descricao}>{e.descricao}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Cartao>
          <Cartao titulo={<><Icone nome="editar" tamanho={18} /> Correções feitas pela gestão</>}>
            <HistoricoAuditoria tipo="checklist" id={c.id_checklist} recarga={recarga} />
          </Cartao>
        </div>
      )}

      {abrindoOs && (
        <RegistrarOs idVeiculo={String(c.id_veiculo)} aoFechar={() => setAbrindoOs(false)}
                     aoSalvar={() => setRecarga((n) => n + 1)} />
      )}
      {corrigindo && (
        <CorrigirChecklist checklist={c} aoFechar={() => setCorrigindo(false)}
                           aoSalvar={() => setRecarga((n) => n + 1)} />
      )}
    </div>
  );
}
