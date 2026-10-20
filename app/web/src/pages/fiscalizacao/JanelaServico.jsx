/**
 * JanelaServico.jsx - Janela de Novo / Editar servico diario (20/10).
 *
 * Usada pela lista do Servico Diario e pelos Detalhes do Servico Diario. O
 * servico e o dia e o turno, com o coordenador e as equipes que vao
 * trabalhar; cada equipe marcada vira um servico com codigo proprio
 * (SD-AAAA-NNNNN, gerado pelo banco).
 */
import { useEffect, useState } from "react";
import Modal from "../../components/Modal.jsx";
import Icone from "../../components/Icone.jsx";
import { useConfirmacaoSenha } from "../../components/ConfirmarSenha.jsx";
import { Selecao, Data, Texto } from "../../components/Campos.jsx";
import { api } from "../../lib/api.js";
import { data } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";
import { TURNOS_EQUIPE } from "./Equipes.jsx";

// Os valores que a tabela `servico_diario` aceita (chk_servico_turno).
export const TURNOS_SERVICO = [
  { valor: "DIURNO", rotulo: "Diurno" },
  { valor: "NOTURNO", rotulo: "Noturno" },
];
export const ROTULO_TURNO = Object.fromEntries(TURNOS_SERVICO.map((t) => [t.valor, t.rotulo]));
// O banco exige que o servico comece na hora do turno (migracao 041).
const HORA_DO_TURNO = { DIURNO: "06:00", NOTURNO: "19:00" };
export const HORARIO_TURNO = { DIURNO: "06:00 às 19:00", NOTURNO: "19:00 às 23:59" };

/**
 * Iniciar (Em aberto -> Em servico) ou encerrar (Em servico -> Encerrado) o
 * servico inteiro (todas as equipes do turno). Pede a senha antes.
 * @returns {Promise<boolean>} true se mudou.
 */
export async function mudarSituacaoServico(pedirSenha, servico, acao) {
  const iniciar = acao === "INICIAR";
  const qual = `o serviço ${ROTULO_TURNO[servico.turno]?.toLowerCase() || ""} de ${data(servico.data)}`;
  const ok = await pedirSenha({
    titulo: iniciar ? "Iniciar serviço" : "Encerrar serviço",
    aviso: iniciar
      ? `Iniciar ${qual}? Todas as equipes dele passam para Em serviço.`
      : `Encerrar ${qual}? Todas as equipes dele são encerradas e o horário fica registrado.`,
  });
  if (!ok) return false;
  try {
    await api(`/fiscalizacao/servico-diario/${servico.id_servico_diario}/situacao`, { method: "PUT", body: { acao } });
    return true;
  } catch (e) {
    alert(e.message);
    return false;
  }
}

export default function JanelaServico({ idServico, aoFechar, aoSalvar }) {
  const { usuario } = useSessao();
  const { pedirSenha, elemento: modalSenha } = useConfirmacaoSenha();
  const [equipes, setEquipes] = useState(null);
  const [servidores, setServidores] = useState([]);
  const [form, setForm] = useState(null);
  const [turnoOriginal, setTurnoOriginal] = useState(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const comoLista = (r) => (Array.isArray(r) ? r : []);
    api("/admin/servidores/opcoes?status=true").then((r) => setServidores(comoLista(r))).catch(() => {});
    api("/fiscalizacao/equipes/opcoes?status=true")
      .then(async (r) => {
        const lista = comoLista(r);
        setEquipes(lista);
        if (idServico) {
          const s = await api(`/fiscalizacao/servico-diario/${idServico}/completo`);
          setTurnoOriginal(s.turno);
          setForm({
            data: String(s.data).slice(0, 10), turno: s.turno, id_coordenador: String(s.id_coordenador),
            equipes: s.equipes.filter((e) => e.status !== "CANCELADA").map((e) => String(e.id_equipe)),
          });
        } else {
          setForm({
            data: new Date().toLocaleDateString("sv-SE"), turno: "DIURNO", id_coordenador: "",
            equipes: lista.filter((e) => e.turno === "DIURNO").map((e) => String(e.id_equipe)),
          });
        }
      })
      .catch((e) => setErro(e.message));
  }, [idServico]);

  const mudar = (nome, valor) => setForm((f) => ({ ...f, [nome]: valor }));
  const campo = (nome) => ({ value: form?.[nome] ?? "", onChange: (e) => mudar(nome, e.target.value) });
  const trocarEquipe = (v) => mudar("equipes", form.equipes.includes(v) ? form.equipes.filter((x) => x !== v) : [...form.equipes, v]);

  async function salvar(e) {
    e.preventDefault();
    if (!form.equipes.length) {
      setErro("Marque pelo menos uma equipe para o serviço.");
      return;
    }
    const ok = await pedirSenha({
      titulo: idServico ? "Salvar alterações" : "Criar serviço diário",
      aviso: "Confirme sua senha para salvar o serviço diário.",
    });
    if (!ok) return;
    setSalvando(true);
    setErro("");
    try {
      const corpo = { data: form.data, turno: form.turno, id_coordenador: Number(form.id_coordenador) };
      // A hora so vai quando o servico e novo ou o turno mudou: servico antigo
      // (diurno das 07:00) continua editavel sem esbarrar na regra das 06:00.
      if (!idServico || turnoOriginal !== form.turno) corpo.hora_inicio = HORA_DO_TURNO[form.turno];
      let id = idServico;
      if (id) {
        await api(`/fiscalizacao/servico-diario/${id}`, { method: "PUT", body: corpo });
      } else {
        const novo = await api("/fiscalizacao/servico-diario", {
          method: "POST", body: { ...corpo, criado_por: usuario.id_usuario, status: "ABERTO" },
        });
        id = novo.id_servico_diario;
      }
      await api(`/fiscalizacao/servico-diario/${id}/equipes`, {
        method: "PUT", body: { equipes: form.equipes.map(Number) },
      });
      aoSalvar?.(id);
      aoFechar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Modal
        titulo={idServico ? "Editar serviço diário" : "Novo serviço diário"}
        legenda="O serviço é o dia e o turno, com o coordenador e as equipes. Cada equipe ganha o seu código (SD)."
        aoFechar={aoFechar}
        rodape={
          <>
            <button className="botao" onClick={aoFechar}>Cancelar</button>
            <button className="botao botao--primario" form="form-servico" disabled={salvando || !form}>
              <Icone nome="salvar" tamanho={15} monocromatico /> {salvando ? "Salvando..." : "Salvar"}
            </button>
          </>
        }
      >
        {erro && <div className="login__erro">{erro}</div>}
        {!form || !equipes ? <div className="carregando">Carregando...</div> : (
          <form id="form-servico" className="formulario-grade" onSubmit={salvar}>
            <Data rotulo="Data *" id="sd-data" required {...campo("data")} />
            <Selecao rotulo="Turno *" id="sd-turno" required opcoes={TURNOS_SERVICO} value={form.turno}
                     onChange={(e) => {
                       const t = e.target.value;
                       setForm((f) => ({
                         ...f, turno: t,
                         equipes: idServico ? f.equipes : equipes.filter((x) => x.turno === t).map((x) => String(x.id_equipe)),
                       }));
                     }} />
            <Texto rotulo="Horário do turno" id="sd-hora" disabled readOnly value={HORARIO_TURNO[form.turno] || ""} />
            <Selecao rotulo="Coordenador *" id="sd-coordenador" required vazio="Selecione" largo
                     opcoes={servidores.map((s) => ({ valor: s.id_servidor, rotulo: s.nome }))}
                     {...campo("id_coordenador")} />
            <h3 className="formulario__secao">Equipes do serviço</h3>
            <div className="campo" data-largo="sim">
              <label>Marque as equipes que trabalham neste serviço *</label>
              {equipes.length === 0 ? <p className="campo__leitura">Nenhuma equipe ativa cadastrada.</p> : (
                <div className="marcar-lista">
                  {equipes.map((e) => {
                    const v = String(e.id_equipe);
                    const t = TURNOS_EQUIPE.find((x) => x.valor === e.turno);
                    return (
                      <label key={v} className="marcar-lista__item" data-marcado={form.equipes.includes(v)}>
                        <input type="checkbox" checked={form.equipes.includes(v)} onChange={() => trocarEquipe(v)} />
                        <span>
                          <strong>{e.numero}</strong>
                          <small>{t ? t.rotulo : "Sem turno"}{e.nomes_integrantes ? ` · ${e.nomes_integrantes}` : ""}</small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              {!idServico && <small className="campo__ajuda">Já vêm marcadas as equipes do turno escolhido.</small>}
            </div>
          </form>
        )}
      </Modal>
      {modalSenha}
    </>
  );
}
