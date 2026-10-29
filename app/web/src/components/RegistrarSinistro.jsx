/**
 * RegistrarSinistro.jsx - Pop-up "Registrar sinistro" (e "Editar", com o
 * sinistro preenchido).
 *
 * Junta o que a antiga pagina "Novo sinistro" pedia - inclusive a parte
 * danificada, a gravidade, a descricao dos danos e as providencias, que agora
 * sao gravadas (migracao 031). Editar pede justificativa e senha.
 *
 * "Houve terceiros?" e "Possui registro policial?" sao Sim/Nao; o numero do
 * B.O. so aparece (e passa a ser obrigatorio) quando o registro policial e Sim.
 * Fotos e documentos sao escolhidos aqui e enviados depois de gravar
 * (migracao 034).
 */
import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import Icone from "./Icone.jsx";
import { useConfirmacaoSenha } from "./ConfirmarSenha.jsx";
import { Texto, Selecao, Data, Area, Campo } from "./Campos.jsx";
import AnexarArquivos from "./AnexarArquivos.jsx";
import CampoDinheiro from "./CampoDinheiro.jsx";
import { dinheiro } from "../lib/formato.js";
import { api } from "../lib/api.js";
import { enviarArquivo } from "../lib/arquivos.js";
import { useSessao } from "../lib/sessao.jsx";
import TituloSecao from "./TituloSecao.jsx";

export const TIPOS_SINISTRO = [
  { valor: "COLISAO", rotulo: "Colisão" },
  { valor: "DANO_MATERIAL", rotulo: "Dano material" },
  { valor: "ROUBO_FURTO", rotulo: "Roubo / Furto" },
  { valor: "INCENDIO", rotulo: "Incêndio" },
  { valor: "OUTRO", rotulo: "Outro" },
];
export const SITUACOES_SINISTRO = [
  { valor: "ABERTO", rotulo: "Aberto" },
  { valor: "EM_ANALISE", rotulo: "Em análise" },
  { valor: "RESOLVIDO", rotulo: "Resolvido" },
  { valor: "ENCERRADO", rotulo: "Encerrado" },
];
export const PARTES_VEICULO = [
  { valor: "FRENTE", rotulo: "Frente" },
  { valor: "TRASEIRA", rotulo: "Traseira" },
  { valor: "LATERAL_ESQ", rotulo: "Lateral esquerda" },
  { valor: "LATERAL_DIR", rotulo: "Lateral direita" },
  { valor: "TETO", rotulo: "Teto" },
  { valor: "OUTRO", rotulo: "Outro" },
];
export const GRAVIDADES_DANOS = [
  { valor: "LEVE", rotulo: "Leve" },
  { valor: "MODERADO", rotulo: "Moderado" },
  { valor: "GRAVE", rotulo: "Grave" },
  { valor: "PERDA_TOTAL", rotulo: "Perda total" },
];

export const TIPOS_ENVOLVIDO = [
  { valor: "OUTRO_VEICULO", rotulo: "Outro veículo (condutor)" },
  { valor: "PASSAGEIRO", rotulo: "Passageiro" },
  { valor: "PEDESTRE", rotulo: "Pedestre" },
  { valor: "TESTEMUNHA", rotulo: "Testemunha" },
  { valor: "OUTRO", rotulo: "Outro" },
];
export const SITUACOES_ENVOLVIDO = [
  { valor: "SEM_LESOES", rotulo: "Sem lesões", tom: "verde" },
  { valor: "LESOES_LEVES", rotulo: "Lesões leves", tom: "amarelo" },
  { valor: "LESOES_GRAVES", rotulo: "Lesões graves", tom: "vermelho" },
];
const ENVOLVIDO_VAZIO = { tipo: "OUTRO_VEICULO", nome: "", placa: "", modelo: "", contato: "", situacao: "SEM_LESOES" };

/** Pergunta de Sim ou Nao, em botoes de opcao. */
export function SimNao({ nome, rotulo: texto, valor, aoMudar }) {
  return (
    <Campo rotulo={texto}>
      <div className="sim-nao sim-nao--caixa" role="radiogroup" aria-label={texto.replace(" *", "")}>
        <label className="sim-nao__opcao">
          <input type="radio" name={nome} checked={valor === true} onChange={() => aoMudar(true)} /> Sim
        </label>
        <label className="sim-nao__opcao">
          <input type="radio" name={nome} checked={valor === false} onChange={() => aoMudar(false)} /> Não
        </label>
      </div>
    </Campo>
  );
}

const texto = (v) => (v === null || v === undefined ? "" : String(v));

// idServidor (29/10): aberto pela ficha do condutor, ja vem com ele escolhido.
export default function RegistrarSinistro({ sinistro, idVeiculo = "", idServidor = "", aoFechar, aoSalvar }) {
  const editando = Boolean(sinistro);
  const { usuario } = useSessao();
  const { pedirSenha, elemento: modalSenha } = useConfirmacaoSenha();
  const [veiculos, setVeiculos] = useState([]);
  const [servidores, setServidores] = useState([]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [anexos, setAnexos] = useState([]);
  const [formulario, setFormulario] = useState(() => ({
    id_veiculo: texto(sinistro?.id_veiculo ?? idVeiculo),
    id_servidor: texto(sinistro?.id_servidor ?? idServidor),
    data: sinistro?.data ? String(sinistro.data).slice(0, 10) : "",
    hora: sinistro?.hora ? String(sinistro.hora).slice(0, 5) : "",
    tipo: sinistro?.tipo || "COLISAO",
    local: texto(sinistro?.local),
    bo: texto(sinistro?.bo),
    status: sinistro?.status || "ABERTO",
    houve_terceiros: !!sinistro?.houve_terceiros,
    // Sem coluna propria: "possui registro policial" e ter numero de B.O.
    tem_bo: Boolean(sinistro?.bo && String(sinistro.bo).trim()),
    descricao: texto(sinistro?.descricao),
    parte_danificada: texto(sinistro?.parte_danificada),
    gravidade_danos: texto(sinistro?.gravidade_danos),
    descricao_danos: texto(sinistro?.descricao_danos),
    providencias: texto(sinistro?.providencias),
    observacoes: texto(sinistro?.observacoes),
    // Migracao 035
    situacao_condutor: sinistro?.situacao_condutor || "SEM_LESOES",
    orcamento_oficina: texto(sinistro?.orcamento_oficina),
    orcamento_pecas: texto(sinistro?.orcamento_pecas),
    orcamento_mao_obra: texto(sinistro?.orcamento_mao_obra),
    orcamento_outros: texto(sinistro?.orcamento_outros),
  }));
  const [envolvidos, setEnvolvidos] = useState(() =>
    (sinistro?.envolvidos || []).map((e) => ({ ...ENVOLVIDO_VAZIO, ...Object.fromEntries(
      Object.entries(e).map(([k, v]) => [k, v ?? ""])) })));
  const mudarEnvolvido = (i, campo, valor) =>
    setEnvolvidos((lista) => lista.map((e, j) => (j === i ? { ...e, [campo]: valor } : e)));

  useEffect(() => {
    api("/frotas/veiculos/opcoes").then((r) => setVeiculos(Array.isArray(r) ? r : [])).catch(() => {});
    api("/admin/servidores/opcoes").then((r) => setServidores(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  const campo = (nome) => ({
    value: formulario[nome] ?? "",
    onChange: (e) => setFormulario((f) => ({ ...f, [nome]: e.target.value })),
  });

  const marcar = (nome) => (valor) => {
    setFormulario((f) => ({ ...f, [nome]: valor }));
    // "Houve terceiros? Sim" ja abre uma linha para o outro veiculo.
    if (nome === "houve_terceiros" && valor && envolvidos.length === 0) setEnvolvidos([{ ...ENVOLVIDO_VAZIO }]);
  };
  const totalOrcamento = ["orcamento_pecas", "orcamento_mao_obra", "orcamento_outros"]
    .reduce((t, k) => t + (Number(formulario[k]) || 0), 0);

  async function salvar(e) {
    e.preventDefault();
    if (envolvidos.some((e) => !String(e.nome || "").trim() && !String(e.placa || "").trim())) {
      setErro("Cada envolvido precisa de nome ou placa (ou tire a linha vazia).");
      return;
    }
    if (formulario.tem_bo && !formulario.bo.trim()) {
      setErro("Informe o número do B.O. (ou marque que não possui registro policial).");
      return;
    }
    setErro("");
    const { tem_bo: temBo, ...dados } = formulario;
    const corpo = {
      ...dados,
      bo: temBo ? formulario.bo.trim() : null,
      id_veiculo: Number(formulario.id_veiculo),
      id_servidor: Number(formulario.id_servidor),
      houve_terceiros: !!formulario.houve_terceiros,
      orcamento_oficina: formulario.orcamento_oficina || null,
      orcamento_pecas: formulario.orcamento_pecas === "" ? null : Number(formulario.orcamento_pecas),
      orcamento_mao_obra: formulario.orcamento_mao_obra === "" ? null : Number(formulario.orcamento_mao_obra),
      orcamento_outros: formulario.orcamento_outros === "" ? null : Number(formulario.orcamento_outros),
    };
    let justificativa;
    if (editando) {
      const resposta = await pedirSenha({
        titulo: "Salvar alterações",
        aviso: "A alteração do sinistro fica registrada na auditoria, com o que estava antes.",
        justificativa: true,
      });
      if (!resposta.ok) return;
      justificativa = resposta.justificativa;
    }
    setSalvando(true);
    try {
      let idSinistro = sinistro?.id_sinistro;
      if (editando) {
        await api(`/frotas/sinistros/${idSinistro}`, {
          method: "PUT", body: { ...corpo, justificativa },
        });
      } else {
        const novo = await api("/frotas/sinistros", {
          method: "POST", body: { ...corpo, id_responsavel: usuario.id_usuario },
        });
        idSinistro = novo.id_sinistro;
      }
      // Envolvidos: a lista inteira e regravada (migracao 035).
      if (envolvidos.length || (sinistro?.envolvidos || []).length) {
        await api(`/frotas/sinistros/${idSinistro}/envolvidos`, {
          method: "PUT",
          body: { envolvidos: envolvidos.map((e) => ({ ...e, situacao: e.situacao || null })) },
        });
      }
      // Os anexos vao depois, um a um: o sinistro ja esta gravado, entao uma
      // falha aqui so avisa (refazer o "Salvar" criaria outro sinistro).
      const falhas = [];
      for (const a of anexos) {
        try {
          await enviarArquivo(api, `/frotas/sinistros/${idSinistro}/arquivos`, a);
        } catch (err) {
          falhas.push(`${a.name}: ${err.message}`);
        }
      }
      if (falhas.length) {
        alert(`O sinistro foi salvo, mas estes arquivos não foram enviados:\n${falhas.join("\n")}\n`
          + "Anexe-os pela tela de Visualizar.");
      }
      aoSalvar?.(idSinistro);
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
        titulo={editando ? `Editar Sinistro ${sinistro.numero || ""}`.trim() : "Registrar sinistro"}
        legenda={editando ? "Atualize as informações do sinistro." : "Registre as informações do sinistro envolvendo o veículo."}
        aoFechar={aoFechar}
        rodape={
          <>
            <button type="button" className="botao" onClick={aoFechar}>Cancelar</button>
            <button className="botao botao--primario" form="form-sinistro" disabled={salvando}>
              <Icone nome="salvar" tamanho={15} monocromatico /> {salvando ? "Salvando..." : "Salvar"}
            </button>
          </>
        }
      >
        {erro && <div className="login__erro">{erro}</div>}
        <form id="form-sinistro" className="formulario-grade" onSubmit={salvar}>
          <TituloSecao>Informações do sinistro</TituloSecao>
          <Selecao rotulo="Veículo *" id="sin-veiculo" required vazio="Selecione o veículo"
                   opcoes={veiculos.map((v) => ({
                     valor: v.id_veiculo, rotulo: `${v.placa} - ${v.marca} ${v.modelo}`,
                   }))}
                   {...campo("id_veiculo")} />
          <Data rotulo="Data do sinistro *" id="sin-data" required {...campo("data")} />
          <Texto rotulo="Hora do sinistro *" id="sin-hora" type="time" required {...campo("hora")} />
          <Selecao rotulo="Tipo de sinistro *" id="sin-tipo" required opcoes={TIPOS_SINISTRO}
                   {...campo("tipo")} />
          <Selecao rotulo="Condutor no momento *" id="sin-condutor" required vazio="Selecione"
                   opcoes={servidores.map((s) => ({ valor: s.id_servidor, rotulo: s.nome }))}
                   {...campo("id_servidor")} />
          <Selecao rotulo="Situação" id="sin-status" opcoes={SITUACOES_SINISTRO} {...campo("status")} />
          <Texto rotulo="Local do sinistro *" id="sin-local" required largo
                 placeholder="Ex.: Av. Brasil, 1250 - Centro" {...campo("local")} />
          <SimNao nome="sin-terceiros" rotulo="Houve terceiros envolvidos? *"
                  valor={formulario.houve_terceiros} aoMudar={marcar("houve_terceiros")} />
          <SimNao nome="sin-tem-bo" rotulo="Possui registro policial (B.O.)? *"
                  valor={formulario.tem_bo} aoMudar={marcar("tem_bo")} />
          {formulario.tem_bo && (
            <Texto rotulo="Número do B.O. *" id="sin-bo" required placeholder="Ex.: 2026/123456"
                   {...campo("bo")} />
          )}
          <Area rotulo="Descrição do sinistro *" id="sin-descricao" largo required maxLength={1000}
                placeholder="Descreva como aconteceu..." {...campo("descricao")} />

          <TituloSecao>Danos e avaliação inicial</TituloSecao>
          <Selecao rotulo="Parte do veículo danificada" id="sin-parte" vazio="Selecione"
                   opcoes={PARTES_VEICULO} {...campo("parte_danificada")} />
          <Selecao rotulo="Gravidade dos danos" id="sin-gravidade" vazio="Selecione"
                   opcoes={GRAVIDADES_DANOS} {...campo("gravidade_danos")} />
          <Area rotulo="Descrição dos danos" id="sin-danos" largo maxLength={1000}
                placeholder="Descreva os danos identificados no veículo..."
                {...campo("descricao_danos")} />

          <TituloSecao>Envolvidos</TituloSecao>
          <Selecao rotulo="Situação do condutor" id="sin-sit-condutor" opcoes={SITUACOES_ENVOLVIDO}
                   {...campo("situacao_condutor")} />
          <div className="envolvidos-form">
            {envolvidos.map((e, i) => (
              <div className="envolvidos-form__linha" key={i}>
                <Selecao rotulo="Tipo" id={`env-tipo-${i}`} opcoes={TIPOS_ENVOLVIDO}
                         value={e.tipo} onChange={(ev) => mudarEnvolvido(i, "tipo", ev.target.value)} />
                <Texto rotulo="Nome" id={`env-nome-${i}`} placeholder="Nome da pessoa"
                       value={e.nome} onChange={(ev) => mudarEnvolvido(i, "nome", ev.target.value)} />
                {e.tipo === "OUTRO_VEICULO" && (
                  <>
                    <Texto rotulo="Placa" id={`env-placa-${i}`} placeholder="XYZ9F87"
                           value={e.placa} onChange={(ev) => mudarEnvolvido(i, "placa", ev.target.value.toUpperCase())} />
                    <Texto rotulo="Modelo" id={`env-modelo-${i}`} placeholder="Ex.: Hyundai HB20"
                           value={e.modelo} onChange={(ev) => mudarEnvolvido(i, "modelo", ev.target.value)} />
                  </>
                )}
                <Texto rotulo="Contato" id={`env-contato-${i}`} placeholder="(00) 00000-0000"
                       value={e.contato} onChange={(ev) => mudarEnvolvido(i, "contato", ev.target.value)} />
                <Selecao rotulo="Situação" id={`env-sit-${i}`} opcoes={SITUACOES_ENVOLVIDO}
                         value={e.situacao} onChange={(ev) => mudarEnvolvido(i, "situacao", ev.target.value)} />
                <button type="button" className="botao botao--pequeno botao--icone envolvidos-form__tirar"
                        title="Tirar envolvido" aria-label="Tirar envolvido"
                        onClick={() => setEnvolvidos((l) => l.filter((_, j) => j !== i))}>
                  <Icone nome="lixo" tamanho={13} />
                </button>
              </div>
            ))}
            <button type="button" className="botao botao--pequeno envolvidos-form__mais"
                    onClick={() => setEnvolvidos((l) => [...l, { ...ENVOLVIDO_VAZIO, tipo: formulario.houve_terceiros ? "OUTRO_VEICULO" : "TESTEMUNHA" }])}>
              <Icone nome="mais" tamanho={13} /> Adicionar envolvido
            </button>
          </div>

          <TituloSecao>Orçamento (opcional)</TituloSecao>
          <Texto rotulo="Oficina do orçamento" id="sin-orc-oficina" placeholder="Ex.: Auto Center Silva"
                 {...campo("orcamento_oficina")} />
          <CampoDinheiro rotulo="Peças" id="sin-orc-pecas" valor={formulario.orcamento_pecas}
                         aoMudar={marcar("orcamento_pecas")} />
          <CampoDinheiro rotulo="Mão de obra" id="sin-orc-mao" valor={formulario.orcamento_mao_obra}
                         aoMudar={marcar("orcamento_mao_obra")} />
          <CampoDinheiro rotulo="Outros custos" id="sin-orc-outros" valor={formulario.orcamento_outros}
                         aoMudar={marcar("orcamento_outros")} />
          <div className="campo orcamento-total">
            <label>Total estimado</label>
            <strong>{dinheiro(totalOrcamento)}</strong>
          </div>

          <TituloSecao>
            Fotos e documentos (opcional)
            {editando && sinistro.arquivos ? (
              <span className="modal-secao__nota"> · já tem {sinistro.arquivos} anexado{sinistro.arquivos > 1 ? "s" : ""}, veja em Visualizar</span>
            ) : null}
          </TituloSecao>
          <AnexarArquivos arquivos={anexos} aoMudar={setAnexos} aoErro={setErro} />

          <TituloSecao>Encaminhamentos e observações (opcional)</TituloSecao>
          <Area rotulo="Providências tomadas" id="sin-providencias" maxLength={1000}
                placeholder="Ex.: guincho acionado, B.O. registrado, seguradora avisada..."
                {...campo("providencias")} />
          <Area rotulo="Observações" id="sin-obs" maxLength={1000} placeholder="Observações adicionais..."
                {...campo("observacoes")} />
        </form>
      </Modal>
      {modalSenha}
    </>
  );
}
