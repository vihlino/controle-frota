/**
 * RegistrarSinistro.jsx - Pop-up "Registrar sinistro" (e "Editar", com o
 * sinistro preenchido).
 *
 * Junta o que a antiga pagina "Novo sinistro" pedia - inclusive a parte
 * danificada, a gravidade, a descricao dos danos e as providencias, que agora
 * sao gravadas (migracao 031). Editar pede justificativa e senha.
 */
import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import Icone from "./Icone.jsx";
import { useConfirmacaoSenha } from "./ConfirmarSenha.jsx";
import { Texto, Selecao, Data, Area } from "./Campos.jsx";
import { api } from "../lib/api.js";
import { useSessao } from "../lib/sessao.jsx";

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

const texto = (v) => (v === null || v === undefined ? "" : String(v));

export default function RegistrarSinistro({ sinistro, idVeiculo = "", aoFechar, aoSalvar }) {
  const editando = Boolean(sinistro);
  const { usuario } = useSessao();
  const { pedirSenha, elemento: modalSenha } = useConfirmacaoSenha();
  const [veiculos, setVeiculos] = useState([]);
  const [servidores, setServidores] = useState([]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [formulario, setFormulario] = useState(() => ({
    id_veiculo: texto(sinistro?.id_veiculo ?? idVeiculo),
    id_servidor: texto(sinistro?.id_servidor),
    data: sinistro?.data ? String(sinistro.data).slice(0, 10) : "",
    hora: sinistro?.hora ? String(sinistro.hora).slice(0, 5) : "",
    tipo: sinistro?.tipo || "COLISAO",
    local: texto(sinistro?.local),
    bo: texto(sinistro?.bo),
    status: sinistro?.status || "ABERTO",
    houve_terceiros: !!sinistro?.houve_terceiros,
    descricao: texto(sinistro?.descricao),
    parte_danificada: texto(sinistro?.parte_danificada),
    gravidade_danos: texto(sinistro?.gravidade_danos),
    descricao_danos: texto(sinistro?.descricao_danos),
    providencias: texto(sinistro?.providencias),
    observacoes: texto(sinistro?.observacoes),
  }));

  useEffect(() => {
    api("/frotas/veiculos/opcoes").then((r) => setVeiculos(Array.isArray(r) ? r : [])).catch(() => {});
    api("/admin/servidores/opcoes").then((r) => setServidores(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  const campo = (nome) => ({
    value: formulario[nome] ?? "",
    onChange: (e) => setFormulario((f) => ({ ...f, [nome]: e.target.value })),
  });

  async function salvar(e) {
    e.preventDefault();
    setErro("");
    const corpo = {
      ...formulario,
      id_veiculo: Number(formulario.id_veiculo),
      id_servidor: Number(formulario.id_servidor),
      houve_terceiros: !!formulario.houve_terceiros,
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
      if (editando) {
        await api(`/frotas/sinistros/${sinistro.id_sinistro}`, {
          method: "PUT", body: { ...corpo, justificativa },
        });
      } else {
        await api("/frotas/sinistros", {
          method: "POST", body: { ...corpo, id_responsavel: usuario.id_usuario },
        });
      }
      aoSalvar?.();
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
          <Selecao rotulo="Veículo *" id="sin-veiculo" required vazio="Selecione"
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
          <Texto rotulo="Número do B.O." id="sin-bo" placeholder="Deixe em branco se não houve"
                 {...campo("bo")} />
          <div className="campo campo--marcavel">
            <label>
              <input type="checkbox" checked={!!formulario.houve_terceiros}
                     onChange={(e) => setFormulario((f) => ({ ...f, houve_terceiros: e.target.checked }))} />
              Houve terceiros envolvidos
            </label>
          </div>
          <Area rotulo="Descrição do sinistro *" id="sin-descricao" largo required
                placeholder="Descreva como aconteceu..." {...campo("descricao")} />

          <h3 className="modal-secao">Danos e avaliação inicial</h3>
          <Selecao rotulo="Parte do veículo danificada" id="sin-parte" vazio="Selecione"
                   opcoes={PARTES_VEICULO} {...campo("parte_danificada")} />
          <Selecao rotulo="Gravidade dos danos" id="sin-gravidade" vazio="Selecione"
                   opcoes={GRAVIDADES_DANOS} {...campo("gravidade_danos")} />
          <Area rotulo="Descrição dos danos" id="sin-danos" largo
                placeholder="Descreva os danos identificados no veículo..."
                {...campo("descricao_danos")} />

          <h3 className="modal-secao">Encaminhamentos e observações (opcional)</h3>
          <Area rotulo="Providências tomadas" id="sin-providencias" largo
                placeholder="Ex.: guincho acionado, B.O. registrado, seguradora avisada..."
                {...campo("providencias")} />
          <Area rotulo="Observações" id="sin-obs" largo placeholder="Observações adicionais..."
                {...campo("observacoes")} />
        </form>
      </Modal>
      {modalSenha}
    </>
  );
}
