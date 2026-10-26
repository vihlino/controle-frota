/**
 * MultasPessoa.jsx - Aba "Multas" dos detalhes do Motorista, do Servidor e do
 * Fiscal (08/10). Resumo (total, em aberto, pontos em 12 meses, valor em
 * aberto), a lista das multas do condutor e o botao "Registrar multa".
 * Clicar numa linha abre os Detalhes da multa (18/10), com "Atualizar
 * situação" e "Editar".
 *
 * Embaixo (26/10): "Resumo das infrações" (quantas multas, pontos e valor por
 * gravidade) e "Histórico da pontuação" (cada multa com os pontos, a data em
 * que os pontos deixam de contar e o total acumulado em 12 meses naquele dia).
 * Multa cancelada nao entra em nenhum dos dois.
 */
import { useEffect, useState } from "react";
import Cartao from "./Cartao.jsx";
import Icone from "./Icone.jsx";
import Selo from "./Selo.jsx";
import RegistrarMulta, { GRAVIDADES, SITUACOES_MULTA } from "./RegistrarMulta.jsx";
import DetalheMulta from "./DetalheMulta.jsx";
import { api } from "../lib/api.js";
import { data, dinheiro, numero } from "../lib/formato.js";
import { useSessao } from "../lib/sessao.jsx";

const vazio = (v) => (v === null || v === undefined || v === "" ? "—" : v);

export function SeloGravidade({ valor }) {
  const g = GRAVIDADES.find((x) => x.valor === valor);
  return g ? <Selo texto={g.rotulo} tom={g.tom} /> : <span>—</span>;
}
export function SeloMulta({ valor }) {
  const s = SITUACOES_MULTA.find((x) => x.valor === valor);
  return s ? <Selo texto={s.rotulo} tom={s.tom} /> : <span>—</span>;
}

export default function MultasPessoa({ servidor, aoMudar }) {
  const { podeVer } = useSessao();
  const podeGerenciar = podeVer("FROTAS_GERENCIAR_MULTAS");
  const [multas, setMultas] = useState(null);
  const [erro, setErro] = useState("");
  const [janela, setJanela] = useState(null); // null | "nova" | multa (edicao)
  const [vendo, setVendo] = useState(null);   // multa aberta nos Detalhes
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    api(`/frotas/multas?servidor=${servidor.id_servidor}&porPagina=200`)
      .then((r) => setMultas(r.itens || []))
      .catch((e) => setErro(e.message));
  }, [servidor.id_servidor, recarga]);

  const recarregar = () => {
    setRecarga((n) => n + 1);
    aoMudar?.();
  };

  const validas = (multas || []).filter((m) => m.status !== "CANCELADA");
  const abertas = validas.filter((m) => m.status === "PENDENTE" || m.status === "EM_RECURSO");
  const doze = new Date();
  doze.setMonth(doze.getMonth() - 12);
  const pontos12 = validas
    .filter((m) => new Date(`${String(m.data).slice(0, 10)}T00:00:00`) >= doze)
    .reduce((t, m) => t + Number(m.pontos || 0), 0);
  const valorAberto = abertas.reduce((t, m) => t + Number(m.valor || 0), 0);

  // --- Resumo das infracoes: por gravidade ---
  const porGravidade = GRAVIDADES.map((g) => {
    const lista = validas.filter((m) => m.gravidade === g.valor);
    return {
      ...g,
      quantidade: lista.length,
      pontos: lista.reduce((t, m) => t + Number(m.pontos || 0), 0),
      total: lista.reduce((t, m) => t + Number(m.valor || 0), 0),
    };
  });
  const totalGeral = {
    quantidade: validas.length,
    pontos: validas.reduce((t, m) => t + Number(m.pontos || 0), 0),
    total: validas.reduce((t, m) => t + Number(m.valor || 0), 0),
  };

  // --- Historico da pontuacao ---
  // Os pontos contam por 12 meses a partir da data da infracao. Para cada
  // multa: quando os pontos expiram e quantos pontos a pessoa tinha nos 12
  // meses ate aquele dia (essa multa incluida).
  const dia = (v) => new Date(`${String(v).slice(0, 10)}T00:00:00`);
  const maisDozeMeses = (v) => { const d = dia(v); d.setMonth(d.getMonth() + 12); return d; };
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const historicoPontos = validas
    .filter((m) => m.data)
    .map((m) => {
      const ate = dia(m.data);
      const desde = new Date(ate); desde.setMonth(desde.getMonth() - 12);
      const acumulado = validas
        .filter((x) => x.data && dia(x.data) > desde && dia(x.data) <= ate)
        .reduce((t, x) => t + Number(x.pontos || 0), 0);
      const expira = maisDozeMeses(m.data);
      return { ...m, expira, acumulado, contando: expira > hoje };
    })
    .sort((a, b) => dia(b.data) - dia(a.data));

  return (
    <>
      <Cartao
        className="cartao--acao-junto"
        titulo={<><Icone nome="alert-triangle" tamanho={18} /> Multas</>}
        acao={podeGerenciar && (
          <button className="botao botao--primario botao--pequeno vd-cartao-acao" onClick={() => setJanela("nova")}>
            <Icone nome="mais" tamanho={14} monocromatico /> Registrar multa
          </button>
        )}
      >
        {erro ? <div className="vazio">{erro}</div> : !multas ? <div className="carregando">Carregando...</div> : (
          <>
            <div className="fd-pontos-resumo">
              <div><span>Multas</span><strong className="multa-num">{numero(validas.length)}</strong></div>
              <div><span>Em aberto</span><strong className="multa-num">{numero(abertas.length)}</strong></div>
              <div>
                <span>Pontos na CNH (12 meses)</span>
                <strong className="multa-num" data-alerta={pontos12 >= 20 ? "sim" : undefined}>{numero(pontos12)}</strong>
              </div>
              <div><span>Valor em aberto</span><strong className="multa-num">{dinheiro(valorAberto)}</strong></div>
            </div>
            {multas.length === 0 ? (
              <p className="texto-corrido">Nenhuma multa registrada para este condutor.</p>
            ) : (
              <div className="rolagem-x">
                <table className="tabela vd-tabela tabela-ficha">
                  <thead>
                    <tr>
                      <th>Nº do auto</th><th>Data</th><th>Veículo</th><th>Infração</th>
                      <th>Gravidade</th><th>Pontos</th><th>Valor</th><th>Vencimento</th><th>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {multas.map((m) => (
                      <tr key={m.id_multa} className="vd-tabela__linha" onClick={() => setVendo(m)}>
                        <td>{vazio(m.numero_auto)}</td>
                        <td>{data(m.data)}</td>
                        <td>{m.placa}</td>
                        <td className="coluna-flexivel">
                          <span className="celula-cortada" title={m.descricao}>
                            {m.descricao}
                            {m.arquivos > 0 && <span className="multa-anexos"> · {m.arquivos} anexo{m.arquivos > 1 ? "s" : ""}</span>}
                          </span>
                        </td>
                        <td><SeloGravidade valor={m.gravidade} /></td>
                        <td>{m.pontos ?? "—"}</td>
                        <td>{m.valor !== null && m.valor !== undefined ? dinheiro(m.valor) : "—"}</td>
                        <td>{m.vencimento ? data(m.vencimento) : "—"}</td>
                        <td><SeloMulta valor={m.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {pontos12 >= 20 && (
              <p className="vd2-nota multa-aviso">
                Atenção: {numero(pontos12)} pontos em 12 meses. A partir de 20 pontos a CNH pode ser suspensa
                (o limite depende de haver infração gravíssima no período).
              </p>
            )}
          </>
        )}
      </Cartao>

      {multas && multas.length > 0 && (
        <div className="ficha-2 sd-par ficha-bloco mp-extra">
          <Cartao titulo={<><Icone nome="chart-line" tamanho={18} /> Resumo das infrações</>}>
            <div className="rolagem-x">
              <table className="tabela vd-tabela tabela-ficha">
                <thead>
                  <tr><th>Gravidade</th><th>Multas</th><th>Pontos</th><th>Valor total</th></tr>
                </thead>
                <tbody>
                  {porGravidade.map((g) => (
                    <tr key={g.valor} data-vazio={g.quantidade === 0 ? "sim" : undefined}>
                      <td><Selo texto={g.rotulo} tom={g.tom} /></td>
                      <td>{numero(g.quantidade)}</td>
                      <td>{numero(g.pontos)}</td>
                      <td>{dinheiro(g.total)}</td>
                    </tr>
                  ))}
                  <tr className="mp-total">
                    <td>Total</td>
                    <td>{numero(totalGeral.quantidade)}</td>
                    <td>{numero(totalGeral.pontos)}</td>
                    <td>{dinheiro(totalGeral.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="vd2-nota" style={{ marginTop: 10 }}>Multas canceladas não entram no resumo.</p>
          </Cartao>

          <Cartao titulo={<><Icone nome="historico" tamanho={18} /> Histórico da pontuação</>}>
            {historicoPontos.length === 0 ? (
              <p className="texto-corrido">Nenhuma infração com data registrada.</p>
            ) : (
              <div className="rolagem-x">
                <table className="tabela vd-tabela tabela-ficha">
                  <thead>
                    <tr><th>Data</th><th>Nº do auto</th><th>Pontos</th><th>Acumulado (12 meses)</th><th>Pontos valem até</th><th>Situação</th></tr>
                  </thead>
                  <tbody>
                    {historicoPontos.map((m) => (
                      <tr key={m.id_multa} className="vd-tabela__linha" onClick={() => setVendo(m)}>
                        <td>{data(m.data)}</td>
                        <td>{vazio(m.numero_auto)}</td>
                        <td>+{numero(m.pontos || 0)}</td>
                        <td><strong className="multa-num" data-alerta={m.acumulado >= 20 ? "sim" : undefined}>{numero(m.acumulado)}</strong></td>
                        <td>{data(m.expira.toLocaleDateString("sv-SE"))}</td>
                        <td>{m.contando ? <Selo texto="Contando" tom="amarelo" /> : <Selo texto="Expirada" tom="cinza" />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="vd2-nota" style={{ marginTop: 10 }}>
              Os pontos contam por 12 meses a partir da data da infração. Hoje: {numero(pontos12)} ponto(s).
            </p>
          </Cartao>
        </div>
      )}

      {vendo && !janela && (
        <DetalheMulta
          multa={vendo}
          servidor={servidor}
          aoFechar={() => setVendo(null)}
          aoEditar={(m) => { setVendo(null); setJanela(m); }}
          aoMudar={recarregar}
        />
      )}

      {janela && (
        <RegistrarMulta
          servidor={servidor}
          multa={janela === "nova" ? null : janela}
          aoFechar={() => setJanela(null)}
          aoSalvar={recarregar}
        />
      )}
    </>
  );
}
