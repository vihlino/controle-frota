/**
 * MultasPessoa.jsx - Aba "Multas" dos detalhes do Motorista, do Servidor e do
 * Fiscal (08/10). Resumo (total, em aberto, pontos em 12 meses, valor em
 * aberto), a lista das multas do condutor e o botao "Registrar multa".
 * Clicar numa linha abre a multa (edicao, com os anexos).
 */
import { useEffect, useState } from "react";
import Cartao from "./Cartao.jsx";
import Icone from "./Icone.jsx";
import Selo from "./Selo.jsx";
import RegistrarMulta, { GRAVIDADES, SITUACOES_MULTA } from "./RegistrarMulta.jsx";
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
  const [janela, setJanela] = useState(null); // null | "nova" | multa
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
                      <tr key={m.id_multa} className="vd-tabela__linha" onClick={() => setJanela(m)}>
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
