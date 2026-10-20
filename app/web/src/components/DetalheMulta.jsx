/**
 * DetalheMulta.jsx - Detalhes da multa (18/10).
 *
 * Clicar numa multa da aba Multas (Motorista, Servidor ou Fiscal) abre esta
 * janela: tudo o que foi registrado, o vencimento com os dias que faltam, os
 * anexos e quem registrou. No rodape:
 *   - "Atualizar situação": troca so a situação (Pendente, Em recurso, Paga,
 *     Cancelada), com a data do pagamento e uma observação - o caso do dia a
 *     dia, sem abrir o formulario inteiro;
 *   - "Editar": o formulario completo (RegistrarMulta).
 * As duas pedem a senha antes de salvar, como toda alteração no sistema.
 */
import { useState } from "react";
import Modal from "./Modal.jsx";
import Icone from "./Icone.jsx";
import Selo from "./Selo.jsx";
import ArquivosAnexados from "./ArquivosAnexados.jsx";
import { useConfirmacaoSenha } from "./ConfirmarSenha.jsx";
import { Selecao, Data, Area } from "./Campos.jsx";
import { GRAVIDADES, SITUACOES_MULTA } from "./RegistrarMulta.jsx";
import { api } from "../lib/api.js";
import { data, dataHora, diasAte, dinheiro, hora } from "../lib/formato.js";
import { useSessao } from "../lib/sessao.jsx";

const vazio = (v) => (v === null || v === undefined || v === "" ? "—" : v);
const data10 = (v) => (v ? String(v).slice(0, 10) : "");

function Linha({ rotulo, children }) {
  return (
    <div className="multa-det__linha">
      <dt>{rotulo}</dt>
      <dd>{children ?? "—"}</dd>
    </div>
  );
}

/** "Vence em 12 dias" / "Venceu há 3 dias" / "Vence hoje" para multa em aberto. */
function prazo(m) {
  if (!m.vencimento || !["PENDENTE", "EM_RECURSO"].includes(m.status)) return null;
  const d = diasAte(m.vencimento);
  if (d < 0) return { texto: `Venceu há ${Math.abs(d)} dia${Math.abs(d) === 1 ? "" : "s"}`, tom: "vermelho" };
  if (d === 0) return { texto: "Vence hoje", tom: "vermelho" };
  return { texto: `Vence em ${d} dia${d === 1 ? "" : "s"}`, tom: d <= 30 ? "amarelo" : "cinza" };
}

export default function DetalheMulta({ multa, servidor, aoFechar, aoEditar, aoMudar }) {
  const { podeVer } = useSessao();
  const podeGerenciar = podeVer("FROTAS_GERENCIAR_MULTAS");
  const { pedirSenha, elemento: modalSenha } = useConfirmacaoSenha();
  const [m, setM] = useState(multa);
  const [atualizando, setAtualizando] = useState(false);
  const [form, setForm] = useState({ status: multa.status, data_pagamento: data10(multa.data_pagamento), observacoes: multa.observacoes || "" });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const situacao = SITUACOES_MULTA.find((x) => x.valor === m.status);
  const gravidade = GRAVIDADES.find((x) => x.valor === m.gravidade);
  const venc = prazo(m);

  async function salvarSituacao(e) {
    e.preventDefault();
    setErro("");
    if (form.status === "PAGA" && !form.data_pagamento) {
      setErro("Informe a data do pagamento.");
      return;
    }
    const ok = await pedirSenha({
      titulo: "Atualizar situação",
      aviso: "Confirme sua senha para atualizar a situação desta multa.",
    });
    if (!ok) return;
    setSalvando(true);
    try {
      const corpo = {
        status: form.status,
        data_pagamento: form.status === "PAGA" ? form.data_pagamento : "",
        observacoes: form.observacoes,
      };
      const nova = await api(`/frotas/multas/${m.id_multa}`, { method: "PUT", body: corpo });
      setM((x) => ({ ...x, ...nova }));
      setAtualizando(false);
      aoMudar?.();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Modal
        titulo={`Multa${m.numero_auto ? ` ${m.numero_auto}` : ""}`}
        legenda={`Condutor: ${servidor.nome}`}
        aoFechar={aoFechar}
        rodape={atualizando ? (
          <>
            <button type="button" className="botao" onClick={() => { setAtualizando(false); setErro(""); }}>Cancelar</button>
            <button className="botao botao--primario" form="form-situacao-multa" disabled={salvando}>
              <Icone nome="salvar" tamanho={15} monocromatico /> {salvando ? "Salvando..." : "Salvar situação"}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="botao" onClick={aoFechar}>Fechar</button>
            {podeGerenciar && (
              <>
                <button type="button" className="botao" onClick={() => setAtualizando(true)}>
                  <Icone nome="historico" tamanho={15} /> Atualizar situação
                </button>
                <button type="button" className="botao botao--primario" onClick={() => aoEditar(m)}>
                  <Icone nome="editar" tamanho={15} monocromatico /> Editar
                </button>
              </>
            )}
          </>
        )}
      >
        {erro && <div className="login__erro">{erro}</div>}

        <div className="multa-det__topo">
          <div>
            <span className="multa-det__rotulo">Situação</span>
            {situacao ? <Selo texto={situacao.rotulo} tom={situacao.tom} /> : "—"}
          </div>
          <div>
            <span className="multa-det__rotulo">Valor</span>
            <strong>{m.valor !== null && m.valor !== undefined ? dinheiro(m.valor) : "—"}</strong>
          </div>
          <div>
            <span className="multa-det__rotulo">Pontos na CNH</span>
            <strong>{vazio(m.pontos)}</strong>
          </div>
          <div>
            <span className="multa-det__rotulo">Vencimento</span>
            <strong>{m.vencimento ? data(m.vencimento) : "—"}</strong>
            {venc && <Selo texto={venc.texto} tom={venc.tom} />}
          </div>
        </div>

        {atualizando && (
          <form id="form-situacao-multa" className="formulario-grade multa-det__atualizar" onSubmit={salvarSituacao}>
            <h3 className="formulario__secao">Atualizar situação</h3>
            <Selecao rotulo="Nova situação *" id="multa-nova-situacao" required
                     opcoes={SITUACOES_MULTA.map((s) => ({ valor: s.valor, rotulo: s.rotulo }))}
                     value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} />
            {form.status === "PAGA" && (
              <Data rotulo="Data do pagamento *" id="multa-data-pagamento" required
                    value={form.data_pagamento} onChange={(e) => setForm((f) => ({ ...f, data_pagamento: e.target.value }))} />
            )}
            <Area rotulo="Observações" id="multa-obs-situacao" largo value={form.observacoes}
                  placeholder="Ex.: Recurso indeferido em 20/10; boleto pago no dia seguinte"
                  onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} />
          </form>
        )}

        <h3 className="formulario__secao">Infração</h3>
        <dl className="multa-det__lista">
          <Linha rotulo="Nº do auto de infração">{vazio(m.numero_auto)}</Linha>
          <Linha rotulo="Órgão autuador">{vazio(m.orgao_autuador)}</Linha>
          <Linha rotulo="Data e hora">{data(m.data)}{m.hora ? ` às ${hora(m.hora)}` : ""}</Linha>
          <Linha rotulo="Veículo">{m.placa ? `${m.placa} - ${m.marca || ""} ${m.modelo || ""}` : "—"}</Linha>
          <Linha rotulo="Código da infração (CTB)">{vazio(m.codigo_infracao)}</Linha>
          <Linha rotulo="Gravidade">{gravidade ? <Selo texto={gravidade.rotulo} tom={gravidade.tom} /> : "—"}</Linha>
          <Linha rotulo="Local">{vazio(m.local)}</Linha>
          <Linha rotulo="Descrição">{vazio(m.descricao)}</Linha>
        </dl>

        <h3 className="formulario__secao">Pagamento</h3>
        <dl className="multa-det__lista">
          <Linha rotulo="Vencimento">{m.vencimento ? data(m.vencimento) : "—"}</Linha>
          <Linha rotulo="Situação">{situacao ? situacao.rotulo : "—"}</Linha>
          <Linha rotulo="Data do pagamento">{m.data_pagamento ? data(m.data_pagamento) : "—"}</Linha>
          <Linha rotulo="Observações">{vazio(m.observacoes)}</Linha>
          <Linha rotulo="Registrada em">{m.criado_em ? dataHora(m.criado_em) : "—"}</Linha>
        </dl>

        <h3 className="formulario__secao">Anexos</h3>
        <ArquivosAnexados
          caminhoLista={`/frotas/multas/${m.id_multa}/arquivos`}
          caminhoArquivo="/frotas/multas/arquivos"
          podeGerenciar={false}
          vazio="Nenhum arquivo anexado."
        />
      </Modal>
      {modalSenha}
    </>
  );
}
