/**
 * ChecklistDetalhe.jsx - Detalhes do Checklist do Veiculo.
 *
 * Desenho do Cesar de 29/10:
 *   Topo        faixa do veiculo com a FOTO (FaixaVeiculo) e setor, data,
 *               motorista, percurso e status (nas sub-abas, o hodometro)
 *   Visao Geral Checklist de Saida e de Entrada lado a lado (itens, status,
 *               observacao e rodape com KM, local e fotos), Rota/Percurso,
 *               Resumo do Checklist; a direita Status do Checklist,
 *               Manutencao e Ultimos Checklists deste Veiculo
 *   Saida /     "Itens do Checklist de Saida/Chegada" com os tres estados
 *   Entrada     (Conforme / Nao conforme / Nao verificado) e a observacao; a
 *               direita Informacoes do Checklist, Rota/Percurso, Fotos do
 *               Veiculo e Acoes (corrigir os itens, com senha e justificativa)
 *   Manutencao  a mesma tela da aba Manutencoes do veiculo, so com as OS
 *               deste checklist; a OS nova nasce ligada a ele
 *   Historico   linha do tempo e correcoes da gestao
 *
 * Fica de fora o que o checklist do Frotas nao tem: os itens alem dos quatro
 * equipamentos (combustivel, oleo, pneus...), foto por item, local de
 * chegada, rascunho e "Finalizar" (o checklist e preenchido pelo condutor no
 * QR Code; aqui a gestao consulta e corrige).
 */
import { useEffect, useState } from "react";
import { useOutletContext, useParams, useNavigate, useSearchParams } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import Selo from "../../components/Selo.jsx";
import FaixaVeiculo from "../../components/FaixaVeiculo.jsx";
import HistoricoAuditoria from "../../components/HistoricoAuditoria.jsx";
import CorrigirChecklist from "../../components/CorrigirChecklist.jsx";
import { AbaManutencoesVeiculo } from "../../components/AbasVeiculo.jsx";
import { useConfirmacaoSenha } from "../../components/ConfirmarSenha.jsx";
import { api, apiArquivo } from "../../lib/api.js";
import { data, dataHora, hora, numero, numeroOs } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";

const EQUIPAMENTOS = [
  { chave: "MACACO", nome: "Macaco" },
  { chave: "ESTEPE", nome: "Estepe" },
  { chave: "TRIANGULO", nome: "Triângulo" },
  { chave: "CHAVE_RODA", nome: "Chave de roda" },
];
const ESTADOS = [
  { valor: "C", texto: "Conforme", tom: "verde", marca: "✓" },
  { valor: "N", texto: "Não conforme", tom: "vermelho", marca: "!" },
  { valor: "V", texto: "Não verificado", tom: "cinza", marca: "–" },
];
const vazio = (v) => (v === null || v === undefined || v === "" ? "—" : v);
const estadoDe = (c) => (!c ? "V" : c.conforme ? "C" : "N");
const fotosTexto = (n) => `${n} foto${n === 1 ? "" : "s"}`;

function StatusItem({ conferido }) {
  const e = ESTADOS.find((x) => x.valor === estadoDe(conferido));
  return <span className="ck-status" data-tom={e.tom}><span className="ck-status__ponto">{e.marca}</span> {e.texto}</span>;
}

/** Cartao de um momento na Visao Geral: os 4 itens e o rodape com KM e fotos. */
function CartaoMomento({ icone, titulo, realizadoEm, itens, rodape, aguardando }) {
  return (
    <Cartao
      titulo={<><Icone nome={icone} tamanho={18} /> {titulo}</>}
      acao={realizadoEm && <span className="ck-realizado vd-cartao-acao"><Icone nome="calendar" tamanho={13} /> Realizado em {realizadoEm}</span>}
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

/** Linhas "rotulo | valor" com icone dos cartoes da direita. */
function Linhas({ linhas }) {
  return (
    <dl className="ck2-linhas">
      {linhas.map(([icone, r, v, apoio]) => (
        <div key={r}>
          <dt><Icone nome={icone} tamanho={15} /> {r}</dt>
          <dd>{vazio(v)}{apoio ? <small>{apoio}</small> : null}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function ChecklistDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const { podeVer } = useSessao();
  const [checklist, setChecklist] = useState(null);
  const [veiculo, setVeiculo] = useState(null);
  const [ultimos, setUltimos] = useState(null);
  const [erro, setErro] = useState("");
  const [fotos, setFotos] = useState([]);
  const [recarga, setRecarga] = useState(0);
  const [corrigindo, setCorrigindo] = useState(false);
  // Correcao dos itens na propria sub-aba: { momento, itens: {CHAVE: {estado, observacao}} }
  const [edicao, setEdicao] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erroEdicao, setErroEdicao] = useState("");
  const { pedirSenha, elemento: modalSenha } = useConfirmacaoSenha();
  const [parametros, definirParametros] = useSearchParams();
  const aba = parametros.get("aba") || "geral";
  const setAba = (chave) => {
    const p = new URLSearchParams(parametros);
    if (chave === "geral") p.delete("aba"); else p.set("aba", chave);
    definirParametros(p, { replace: true });
    setEdicao(null);
  };

  useEffect(() => { definirCabecalho({ titulo: "", legenda: "" }); }, [definirCabecalho]);

  useEffect(() => {
    api(`/frotas/checklists/${id}`).then(setChecklist).catch((e) => setErro(e.message));
  }, [id, recarga]);

  // Veiculo (foto, situacao, tipo) e os ultimos checklists dele.
  const idVeiculo = checklist?.id_veiculo;
  useEffect(() => {
    if (!idVeiculo) return;
    api(`/frotas/veiculos/${idVeiculo}`).then(setVeiculo).catch(() => {});
    api(`/frotas/checklists?veiculo=${idVeiculo}&porPagina=4`)
      .then((r) => setUltimos(r?.itens || [])).catch(() => setUltimos([]));
  }, [idVeiculo, recarga]);

  // Fotos: a lista e depois o binario de cada uma (a rota exige o token).
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
  const recarregar = () => setRecarga((n) => n + 1);

  // Resumo: as conferencias dos quatro itens na saida e na chegada.
  const conferencias = [...naSaida, ...naChegada];
  const totalItens = EQUIPAMENTOS.length * (semChegada ? 1 : 2);
  const conformes = conferencias.filter((e) => e.conforme).length;
  const naoConformes = conferencias.filter((e) => !e.conforme).length;
  const naoVerificados = Math.max(0, totalItens - conformes - naoConformes);
  const pct = (n) => (totalItens ? Math.round((n / totalItens) * 100) : 0);

  const saidaEm = `${data(c.data_abertura)} ${hora(c.hora_saida)}`;
  const chegadaEm = c.data_devolucao ? `${data(c.data_devolucao)} ${hora(c.hora_chegada)}` : null;
  const seloStatus = semChegada ? <Selo texto="Em uso" tom="azul" /> : <Selo texto="Concluído" tom="verde" />;

  // Faixa do veiculo: a mesma dos Detalhes do Documento, com os dados do checklist.
  const v = veiculo ? { ...veiculo, veiculo_status: veiculo.status } : {
    id_veiculo: c.id_veiculo, placa: c.placa, marca: c.marca, modelo: c.modelo, setor: c.setor,
  };
  const motorista = { icone: "user", rotulo: "Motorista", valor: vazio(c.condutor), apoio: c.matricula ? `Matrícula: ${c.matricula}` : null };
  const setor = { icone: "predio", rotulo: "Setor", valor: vazio(c.setor) };
  const dadosFaixa = aba === "saida" ? [
    setor, { icone: "calendar", rotulo: "Data do checklist", valor: saidaEm }, motorista,
    { icone: "odometro", rotulo: "Hodômetro de saída", valor: `${numero(c.odometro_saida)} km` },
  ] : aba === "entrada" ? [
    setor, { icone: "calendar", rotulo: "Data do checklist", valor: chegadaEm || "Aguardando chegada" }, motorista,
    { icone: "odometro", rotulo: "Hodômetro de chegada", valor: c.odometro_chegada == null ? "—" : `${numero(c.odometro_chegada)} km` },
  ] : [
    setor, { icone: "calendar", rotulo: "Data do checklist", valor: saidaEm }, motorista,
    { icone: "oc-local", rotulo: "Rota / Percurso", valor: vazio(c.percurso) },
    { icone: "concluidas", rotulo: "Status", valor: seloStatus },
  ];

  const ABAS = [
    { chave: "geral", rotulo: "Visão Geral", icone: "checklist" },
    { chave: "saida", rotulo: "Checklist de Saída", icone: "arrow-up" },
    { chave: "entrada", rotulo: "Checklist de Entrada", icone: "seta-baixo" },
    { chave: "manutencao", rotulo: "Manutenção", icone: "kpi-wrench", total: chamados.length || undefined },
    { chave: "historico", rotulo: "Histórico", icone: "historico" },
  ];

  // ------------------------------------------------ Correcao dos itens
  function comecarEdicao(momento) {
    const gravados = equip(momento);
    const itens = {};
    EQUIPAMENTOS.forEach((e) => {
      const g = gravados.find((x) => x.equipamento === e.chave);
      itens[e.chave] = { estado: estadoDe(g), observacao: g?.observacao || "" };
    });
    setErroEdicao("");
    setEdicao({ momento, itens });
  }
  const mudarItem = (chave, campo, valor) =>
    setEdicao((x) => ({ ...x, itens: { ...x.itens, [chave]: { ...x.itens[chave], [campo]: valor } } }));

  async function salvarEdicao() {
    setErroEdicao("");
    const faltando = EQUIPAMENTOS.filter((e) => edicao.itens[e.chave].estado === "N" && !edicao.itens[e.chave].observacao.trim());
    if (faltando.length) {
      setErroEdicao(`Escreva a observação de ${faltando.map((e) => e.nome).join(", ")} (item não conforme).`);
      return;
    }
    const resposta = await pedirSenha({
      titulo: "Salvar correção",
      aviso: `A correção do checklist de ${edicao.momento === "SAIDA" ? "saída" : "chegada"} fica registrada na auditoria, com o que estava antes.`,
      justificativa: true,
    });
    if (!resposta?.ok) return;
    setSalvando(true);
    try {
      // "Nao verificado" e item sem conferencia: nao vai para o banco.
      const itens = EQUIPAMENTOS.filter((e) => edicao.itens[e.chave].estado !== "V").map((e) => ({
        equipamento: e.chave,
        conforme: edicao.itens[e.chave].estado === "C",
        observacao: edicao.itens[e.chave].observacao.trim() || null,
      }));
      await api(`/frotas/checklists/${id}/equipamentos`, {
        method: "PUT", body: { momento: edicao.momento, itens, justificativa: resposta.justificativa },
      });
      setEdicao(null);
      recarregar();
    } catch (e) {
      setErroEdicao(e.message);
    } finally {
      setSalvando(false);
    }
  }

  // ------------------------------------------------ Visao Geral
  const cartaoSaida = (
    <CartaoMomento
      icone="arrow-up" titulo="Checklist de Saída" realizadoEm={saidaEm} itens={naSaida}
      rodape={[
        { icone: "odometro", rotulo: "Hodômetro de saída", valor: `${numero(c.odometro_saida)} km` },
        { icone: "oc-local", rotulo: "Local de saída", valor: vazio(c.local_saida) },
        { icone: "oc-camera", rotulo: "Fotos na saída", valor: fotosTexto(fotosDe("SAIDA").length) },
      ]}
    />
  );
  const cartaoEntrada = (
    <CartaoMomento
      icone="seta-baixo" titulo="Checklist de Entrada" realizadoEm={chegadaEm} itens={naChegada}
      aguardando={semChegada ? "O veículo ainda não voltou: a conferência de entrada é feita na chegada, pelo QR Code." : null}
      rodape={[
        { icone: "odometro", rotulo: "Hodômetro de entrada", valor: c.odometro_chegada == null ? "—" : `${numero(c.odometro_chegada)} km` },
        { icone: "kpi-steering", rotulo: "KM rodado", valor: c.km_rodado == null ? "—" : `${numero(c.km_rodado)} km` },
        { icone: "oc-camera", rotulo: "Fotos na entrada", valor: fotosTexto(fotosDe("CHEGADA").length) },
      ]}
    />
  );

  const cartaoStatus = (
    <Cartao titulo={<><Icone nome="historico" tamanho={18} /> Status do Checklist</>}>
      <div className="vd-situacao" data-tom={semChegada ? "azul" : "verde"}>
        <span className="vd-situacao__icone"><Icone nome={semChegada ? "kpi-car" : "check"} tamanho={22} /></span>
        <div>
          <strong>{semChegada ? "Em uso" : "Concluído"}</strong>
          <span>{semChegada ? `Saída em ${data(c.data_abertura)} às ${hora(c.hora_saida)}` : `Realizado em ${data(c.data_devolucao)} às ${hora(c.hora_chegada)}`}</span>
        </div>
      </div>
      <Linhas linhas={[
        ["calendar", "Data", data(c.data_abertura)],
        ["historico", "Hora de saída", hora(c.hora_saida)],
        ["historico", "Hora de chegada", c.hora_chegada ? hora(c.hora_chegada) : null],
        ["odometro", "KM de saída", `${numero(c.odometro_saida)} km`],
        ["odometro", "KM de chegada", c.odometro_chegada == null ? null : `${numero(c.odometro_chegada)} km`],
        ["kpi-steering", "KM percorridos", c.km_rodado == null ? null : `${numero(c.km_rodado)} km`],
      ]} />
    </Cartao>
  );

  const cartaoManutencao = (
    <Cartao titulo={<><Icone nome="kpi-wrench" tamanho={18} /> Manutenção</>}
            acao={<button className="botao botao--pequeno vd-cartao-acao" onClick={() => setAba("manutencao")}>Ver</button>}>
      <dl className="ck2-manut">
        <div>
          <dt><Icone nome="inspecao" tamanho={15} /> Necessita de manutenção?</dt>
          <dd>{chamados.length ? <Selo texto="Sim" tom="vermelho" /> : <Selo texto="Não" tom="verde" />}</dd>
        </div>
        <div className="ck2-manut__obs">
          <dt><Icone nome="arquivo-texto" tamanho={15} /> Observações de manutenção</dt>
          <dd>
            {chamados.length === 0 ? "Sem observações." : (
              <ul className="as-lista">
                {chamados.map((o) => (
                  <li key={o.id_os}>
                    <button type="button" className="os-ligadas__link" onClick={() => navegar(`/frotas/manutencoes/${o.id_os}`)}>{numeroOs(o.numero)}</button>
                    {" "}{String(o.descricao || "").split("\n")[0]}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>
    </Cartao>
  );

  const cartaoUltimos = (
    <Cartao titulo={<><Icone nome="historico" tamanho={18} /> Últimos Checklists deste Veículo</>}>
      {!ultimos ? <p className="texto-corrido">Carregando...</p> : (
        <>
          <table className="tabela ck2-ultimos">
            <thead><tr><th>Data</th><th>Motorista</th><th>KM rodado</th><th>Status</th></tr></thead>
            <tbody>
              {ultimos.map((u) => (
                <tr key={u.id_checklist} data-ativo={u.id_checklist === c.id_checklist ? "sim" : undefined}
                    onClick={() => u.id_checklist !== c.id_checklist && navegar(`/frotas/checklists/${u.id_checklist}`)}>
                  <td>{data(u.data_abertura)}</td>
                  <td><span className="ck2-cortado" title={u.condutor}>{vazio(u.condutor)}</span></td>
                  <td>{u.km_rodado == null ? "—" : `${numero(u.km_rodado)} km`}</td>
                  <td>{u.status === "ABERTO" ? <Selo texto="Em uso" tom="azul" /> : <Selo texto="Concluído" tom="verde" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="lr-abrir" onClick={() => navegar(`/frotas/veiculos/${c.id_veiculo}?aba=checklists`)}>
            Ver todos os checklists <Icone nome="seta-direita" tamanho={13} monocromatico />
          </button>
        </>
      )}
    </Cartao>
  );

  // ------------------------------------------------ Sub-abas Saida / Entrada
  const subAba = (momento) => {
    const saida = momento === "SAIDA";
    const gravados = saida ? naSaida : naChegada;
    const editando = edicao?.momento === momento;
    const aguardando = !saida && semChegada;
    const fotosMomento = fotosDe(momento);
    return (
      <div className="vd-corpo">
        <div className="vd-corpo__principal">
          <section className="cartao ck2-itens">
            <header className="dd-titulo">
              <Icone nome={saida ? "arrow-up" : "seta-baixo"} tamanho={22} />
              <div><h2>Itens do Checklist de {saida ? "Saída" : "Chegada"}</h2></div>
              {editando && <span className="ck2-editando"><Icone nome="editar" tamanho={13} /> Corrigindo</span>}
            </header>
            {aguardando ? (
              <div className="insp-nota"><Icone nome="informacao" tamanho={16} /><span>O veículo ainda não voltou: a conferência de chegada é feita pelo condutor, no QR Code.</span></div>
            ) : (
              <>
                <div className="ck2-aviso">
                  <Icone nome="informacao" tamanho={15} />
                  <span>{editando
                    ? "Marque o status de cada item. Em caso de não conformidade, a observação é obrigatória."
                    : `Conferência feita pelo condutor no QR Code${saida ? " na saída" : " na chegada"}: os equipamentos obrigatórios do veículo.`}</span>
                </div>
                {erroEdicao && editando && <div className="login__erro">{erroEdicao}</div>}
                <div className="rolagem-x">
                  <table className="tabela ck2-tabela">
                    <thead><tr><th>#</th><th>Item</th><th>Status</th><th>Observação</th></tr></thead>
                    <tbody>
                      {EQUIPAMENTOS.map((e, n) => {
                        const g = gravados.find((x) => x.equipamento === e.chave);
                        const atual = editando ? edicao.itens[e.chave].estado : estadoDe(g);
                        return (
                          <tr key={e.chave}>
                            <td><span className="ck-item__n">{n + 1}</span></td>
                            <td className="ck2-nome">{e.nome}</td>
                            <td>
                              <span className="ck2-estados" role={editando ? "radiogroup" : undefined} aria-label={`Status de ${e.nome}`}>
                                {ESTADOS.map((s) => (
                                  <button key={s.valor} type="button" className="ck2-estado" data-tom={s.tom}
                                          data-ativo={atual === s.valor ? "sim" : undefined} disabled={!editando}
                                          aria-pressed={atual === s.valor} onClick={() => mudarItem(e.chave, "estado", s.valor)}>
                                    <span className="ck2-estado__ponto">{s.marca}</span> {s.texto}
                                  </button>
                                ))}
                              </span>
                            </td>
                            <td className="ck2-obs">
                              {editando ? (
                                <input type="text" className="ck2-obs__campo" maxLength={500} placeholder="Digite uma observação..."
                                       value={edicao.itens[e.chave].observacao}
                                       onChange={(ev) => mudarItem(e.chave, "observacao", ev.target.value)} />
                              ) : <span className="ck2-obs__texto">{vazio(g?.observacao)}</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>

        <div className="vd-corpo__lado">
          <Cartao titulo={<><Icone nome="historico" tamanho={18} /> Informações do Checklist</>}
                  acao={<span className="vd-cartao-acao">{seloStatus}</span>}>
            <Linhas linhas={saida ? [
              ["calendar", "Data", data(c.data_abertura)],
              ["historico", "Hora de saída", hora(c.hora_saida)],
              ["user", "Motorista", c.condutor, c.matricula ? `Matrícula: ${c.matricula}` : null],
              ["odometro", "Hodômetro de saída", `${numero(c.odometro_saida)} km`],
              ["oc-local", "Local de saída", c.local_saida],
            ] : [
              ["calendar", "Data", c.data_devolucao ? data(c.data_devolucao) : null],
              ["historico", "Hora de chegada", c.hora_chegada ? hora(c.hora_chegada) : null],
              ["user", "Motorista", c.condutor, c.matricula ? `Matrícula: ${c.matricula}` : null],
              ["odometro", "Hodômetro de chegada", c.odometro_chegada == null ? null : `${numero(c.odometro_chegada)} km`],
              ["kpi-steering", "KM rodado", c.km_rodado == null ? null : `${numero(c.km_rodado)} km`],
            ]} />
          </Cartao>

          <Cartao titulo={<><Icone nome="oc-local" tamanho={18} /> Rota / Percurso</>}>
            <dl className="ck2-rota">
              <div><dt>Percurso / atividade</dt><dd>{vazio(c.percurso)}</dd></div>
              <div><dt>Setor do veículo</dt><dd>{vazio(c.setor)}</dd></div>
              <div>
                <dt>Observações do condutor {saida ? "na saída" : "na chegada"}</dt>
                <dd className="ck2-rota__obs">{(saida ? c.observacoes : c.observacoes_chegada) || "Nenhuma observação registrada."}</dd>
              </div>
            </dl>
          </Cartao>

          <Cartao titulo={<><Icone nome="oc-camera" tamanho={18} /> Fotos do Veículo na {saida ? "Saída" : "Chegada"}</>}>
            {fotosMomento.length === 0 ? <p className="pck-vazio">Nenhuma foto enviada {saida ? "na saída" : "na chegada"}.</p> : (
              <div className="as-fotos">
                {fotosMomento.map((f) => (
                  <a key={f.id_foto} className="as-foto" href={f.url} target="_blank" rel="noreferrer">
                    <img src={f.url} alt={`Foto do checklist ${f.id_foto}`} />
                  </a>
                ))}
              </div>
            )}
            <p className="vd2-nota" style={{ marginTop: 8 }}>As fotos são enviadas pelo condutor no QR Code.</p>
          </Cartao>

          {podeEditar && !aguardando && (
            <Cartao titulo={<><Icone nome="fisc-bolt" tamanho={18} /> Ações</>}>
              {editando ? (
                <div className="ck2-acoes">
                  <button className="botao botao--primario" onClick={salvarEdicao} disabled={salvando}>
                    <Icone nome="check" tamanho={15} monocromatico /> {salvando ? "Salvando..." : "Salvar correção"}
                  </button>
                  <button className="botao" onClick={() => { setEdicao(null); setErroEdicao(""); }} disabled={salvando}>
                    <Icone nome="fechar" tamanho={14} /> Cancelar
                  </button>
                </div>
              ) : (
                <div className="ck2-acoes">
                  <button className="botao botao--primario" onClick={() => comecarEdicao(momento)}>
                    <Icone nome="editar" tamanho={15} monocromatico /> Corrigir itens
                  </button>
                  <button className="botao" onClick={() => setCorrigindo(true)}>
                    <Icone nome="checklist" tamanho={15} /> Corrigir checklist completo
                  </button>
                </div>
              )}
            </Cartao>
          )}
        </div>
      </div>
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
          <Trilha itens={[{ rotulo: "Frotas" }, { rotulo: "Checklists", para: "/frotas/checklists" }, { rotulo: "Detalhes do Checklist" }]} />
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

      <FaixaVeiculo v={v} dados={dadosFaixa} />

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
        <div className="vd-corpo">
          <div className="vd-corpo__principal ck2-grade">
            {cartaoSaida}
            {cartaoEntrada}
            <Cartao titulo={<><Icone nome="oc-local" tamanho={18} /> Rota / Percurso</>}>
              <dl className="ck2-rota">
                <div><dt>Percurso / atividade</dt><dd>{vazio(c.percurso)}</dd></div>
                <div><dt>Local de saída</dt><dd>{vazio(c.local_saida)}</dd></div>
                <div><dt>Setor do veículo</dt><dd>{vazio(c.setor)}</dd></div>
                {(c.observacoes || c.observacoes_chegada) && (
                  <div>
                    <dt>Observações do condutor</dt>
                    <dd className="ck2-rota__obs">{[c.observacoes && `Saída: ${c.observacoes}`, c.observacoes_chegada && `Chegada: ${c.observacoes_chegada}`].filter(Boolean).join(" · ")}</dd>
                  </div>
                )}
              </dl>
            </Cartao>
            <Cartao titulo={<><Icone nome="chart-line" tamanho={18} /> Resumo do Checklist</>}>
              <dl className="ck-resumo">
                <div><dt>Total de itens</dt><dd>{totalItens}</dd></div>
                <div><dt>Conforme</dt><dd><span className="ck-ponto" data-tom="verde" />{conformes} ({pct(conformes)}%)</dd></div>
                <div><dt>Não conforme</dt><dd><span className="ck-ponto" data-tom="vermelho" />{naoConformes} ({pct(naoConformes)}%)</dd></div>
                <div><dt>Não verificados</dt><dd><span className="ck-ponto" data-tom="cinza" />{naoVerificados} ({pct(naoVerificados)}%)</dd></div>
              </dl>
              <p className="vd2-nota">Quatro equipamentos conferidos na saída{semChegada ? "" : " e na chegada"}.</p>
            </Cartao>
          </div>
          <div className="vd-corpo__lado">
            {cartaoStatus}
            {cartaoManutencao}
            {cartaoUltimos}
          </div>
        </div>
      )}

      {aba === "saida" && subAba("SAIDA")}
      {aba === "entrada" && subAba("CHEGADA")}

      {aba === "manutencao" && (
        <AbaManutencoesVeiculo veiculo={v} podeGerenciar={podeOs} aoMudar={recarregar} checklist={{ id: c.id_checklist }}
          caminho={`/frotas/manutencoes?origem=CHECKLIST_FROTAS&registroOrigem=${c.id_checklist}`}
          vazio="Nenhuma manutenção aberta a partir deste checklist." />
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

      {corrigindo && (
        <CorrigirChecklist checklist={c} aoFechar={() => setCorrigindo(false)} aoSalvar={recarregar} />
      )}
      {modalSenha}
    </div>
  );
}
