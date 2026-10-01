/**
 * FormularioDocumento.jsx - O pop-up de documento, nos tres usos:
 *
 *   novo       cadastra o documento (e, se quiser, ja anexa o arquivo)
 *   editar     corrige o que foi digitado - pede senha e justificativa
 *   atualizar  RENOVACAO: cadastra a versao nova (novo vencimento, novo
 *              numero, novo arquivo). A versao atual nao e apagada: vai para
 *              o historico e continua aberta na tela de Visualizar.
 *
 * O arquivo (PDF, JPG ou PNG, ate 10 MB) e enviado DEPOIS de o documento ser
 * gravado, porque precisa do id dele.
 */
import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import Icone from "./Icone.jsx";
import { Texto, Selecao, Data, Area, Campo } from "./Campos.jsx";
import { useConfirmacaoSenha } from "./ConfirmarSenha.jsx";
import { api } from "../lib/api.js";
import { data } from "../lib/formato.js";

export const CATEGORIAS_DOCUMENTO = ["Licenciamento", "Seguro", "Imposto", "Inspeção", "Manual", "Outro"];

/*
 * A situacao nao e escolhida - e calculada pela data de vencimento (funcao
 * situacao_documento no banco). A unica que e decisao de uma pessoa e
 * INATIVO, o documento arquivado, que sai dos avisos de vencimento.
 */
const ARQUIVAMENTO = [
  { valor: "VALIDO", rotulo: "Ativo" },
  { valor: "INATIVO", rotulo: "Inativo (arquivado)" },
];

const VAZIO = {
  id_veiculo: "", tipo_documento: "", numero_documento: "", categoria: "Licenciamento",
  orgao_emissor: "", data_emissao: "", data_validade: "", status: "VALIDO",
  id_responsavel: "", observacoes: "",
};

const TIPOS_ACEITOS = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 10 * 1024 * 1024;

const dia = (v) => (v ? String(v).slice(0, 10) : "");

export function tamanhoArquivo(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/** Le o arquivo escolhido como data URL (base64) - e assim que a API recebe. */
function lerComoDataUrl(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result);
    leitor.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    leitor.readAsDataURL(arquivo);
  });
}

/** Confere tipo e tamanho; devolve a mensagem de erro ou "" quando esta ok. */
export function conferirArquivo(arquivo) {
  if (!arquivo) return "";
  if (!TIPOS_ACEITOS.includes(arquivo.type)) return "Envie o documento em PDF, JPG ou PNG.";
  if (arquivo.size > MAX_BYTES) return "O arquivo precisa ter até 10 MB.";
  return "";
}

/** Envia o arquivo para um documento ja gravado. */
export async function enviarArquivoDocumento(idDocumento, arquivo) {
  const dataUrl = await lerComoDataUrl(arquivo);
  return api(`/frotas/documentos/${idDocumento}/arquivos`, {
    method: "POST",
    body: { nome: arquivo.name, dataUrl },
  });
}

/**
 * @param {object} p
 * @param {"novo"|"editar"|"atualizar"} p.modo
 * @param {object} [p.documento]  O documento (editar/atualizar).
 * @param {string|number} [p.idVeiculo]  Veiculo ja escolhido (novo).
 * @param {() => void} p.aoFechar
 * @param {(idDocumento: number) => void} [p.aoSalvar]
 */
export default function FormularioDocumento({ modo = "novo", documento, idVeiculo = "", aoFechar, aoSalvar }) {
  const atualizando = modo === "atualizar";
  const editando = modo === "editar";
  const d = documento || {};

  const [formulario, setFormulario] = useState(() => {
    if (editando) {
      return {
        ...VAZIO, ...d,
        data_emissao: dia(d.data_emissao), data_validade: dia(d.data_validade),
        // VENCENDO e VENCIDO sao calculados e nao existem na lista do formulario.
        status: (d.situacao || d.status) === "INATIVO" ? "INATIVO" : "VALIDO",
        id_responsavel: d.id_responsavel ?? "",
        orgao_emissor: d.orgao_emissor ?? "", observacoes: d.observacoes ?? "",
        numero_documento: d.numero_documento ?? "",
      };
    }
    if (atualizando) {
      // Renovacao: o que identifica o documento continua; numero, datas e
      // observacoes sao da versao nova e comecam em branco.
      return {
        ...VAZIO,
        id_veiculo: d.id_veiculo, tipo_documento: d.tipo_documento,
        categoria: d.categoria || "", orgao_emissor: d.orgao_emissor ?? "",
        id_responsavel: d.id_responsavel ?? "",
      };
    }
    return { ...VAZIO, id_veiculo: idVeiculo };
  });
  const [arquivo, setArquivo] = useState(null);
  const [veiculos, setVeiculos] = useState([]);
  const [servidores, setServidores] = useState([]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const { pedirSenha, elemento: modalSenha } = useConfirmacaoSenha();

  useEffect(() => {
    api("/frotas/veiculos/opcoes").then((r) => setVeiculos(Array.isArray(r) ? r : [])).catch(() => {});
    api("/admin/servidores/opcoes").then((r) => setServidores(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  const campo = (nome) => ({
    value: formulario[nome] ?? "",
    onChange: (e) => setFormulario((f) => ({ ...f, [nome]: e.target.value })),
  });

  function escolherArquivo(e) {
    const a = e.target.files?.[0] || null;
    const problema = conferirArquivo(a);
    if (problema) {
      setErro(problema);
      e.target.value = "";
      setArquivo(null);
      return;
    }
    setErro("");
    setArquivo(a);
  }

  async function salvar(e) {
    e.preventDefault();
    setErro("");
    if (formulario.data_emissao && formulario.data_validade
        && formulario.data_emissao > formulario.data_validade) {
      setErro("A data de emissão não pode ser depois do vencimento.");
      return;
    }

    let justificativa;
    if (editando) {
      const resposta = await pedirSenha({
        titulo: "Salvar alterações",
        aviso: "A alteração do documento fica registrada na auditoria, com o que estava antes. "
          + "Para renovar o documento (novo vencimento), use Atualizar.",
        justificativa: true,
        dicaJustificativa: "Ex.: número digitado errado no cadastro",
      });
      if (!resposta.ok) return;
      justificativa = resposta.justificativa;
    }

    setSalvando(true);
    let idGravado = null;
    try {
      const corpo = {
        id_veiculo: Number(formulario.id_veiculo),
        tipo_documento: formulario.tipo_documento,
        categoria: formulario.categoria || null,
        numero_documento: formulario.numero_documento || null,
        orgao_emissor: formulario.orgao_emissor || null,
        data_emissao: formulario.data_emissao || null,
        data_validade: formulario.data_validade || null,
        id_responsavel: formulario.id_responsavel ? Number(formulario.id_responsavel) : null,
        observacoes: formulario.observacoes || null,
      };
      if (atualizando) {
        const r = await api(`/frotas/documentos/${d.id_documento}/atualizar`, {
          method: "POST", body: corpo,
        });
        idGravado = r.id_documento;
      } else if (editando) {
        await api(`/frotas/documentos/${d.id_documento}`, {
          method: "PUT", body: { ...corpo, status: formulario.status, justificativa },
        });
        idGravado = d.id_documento;
      } else {
        const r = await api("/frotas/documentos", {
          method: "POST", body: { ...corpo, status: formulario.status },
        });
        idGravado = r.id_documento;
      }

      if (arquivo) {
        try {
          await enviarArquivoDocumento(idGravado, arquivo);
        } catch (err) {
          // O documento ja esta gravado: nao adianta "tentar salvar de novo",
          // isso criaria outro. Avisa e deixa anexar pela tela de Visualizar.
          alert(`O documento foi salvo, mas o arquivo não foi enviado: ${err.message}\n`
            + "Anexe o arquivo pela tela de Visualizar.");
        }
      }
      aoSalvar?.(idGravado);
      aoFechar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  const titulo = atualizando
    ? `Atualizar ${d.tipo_documento || "documento"}`
    : editando ? "Editar documento" : "Novo documento";
  const veiculoTexto = d.placa ? `${d.placa} - ${d.marca || ""} ${d.modelo || ""}`.trim() : "";

  return (
    <>
      <Modal
        titulo={titulo}
        aoFechar={aoFechar}
        rodape={
          <>
            <button type="button" className="botao" onClick={aoFechar}>Cancelar</button>
            <button className="botao botao--primario" form="form-doc" disabled={salvando}>
              <Icone nome="salvar" tamanho={15} monocromatico /> {salvando ? "Salvando..." : "Salvar"}
            </button>
          </>
        }
      >
        {erro && <div className="login__erro">{erro}</div>}
        <form id="form-doc" className="formulario-grade" onSubmit={salvar}>
          {atualizando && (
            <div className="doc-aviso">
              <Icone nome="historico" tamanho={16} />
              <span>
                Cadastre aqui o documento <strong>válido</strong>. A versão atual
                {d.numero_documento ? <> (nº <strong>{d.numero_documento}</strong>)</> : null}
                {d.data_validade ? <>, com vencimento em <strong>{data(d.data_validade)}</strong>,</> : null}
                {" "}não será apagada: vai para o histórico e continua disponível em Visualizar.
              </span>
            </div>
          )}

          {atualizando ? (
            <>
              <Texto rotulo="Veículo" id="doc-veiculo" value={veiculoTexto} disabled readOnly />
              <Texto rotulo="Tipo de documento" id="doc-tipo" value={formulario.tipo_documento} disabled readOnly />
              <Texto rotulo="Categoria" id="doc-categoria" value={formulario.categoria || "—"} disabled readOnly />
            </>
          ) : (
            <>
              <Selecao rotulo="Veículo *" id="doc-veiculo" required vazio="Selecione"
                       opcoes={veiculos.map((v) => ({
                         valor: v.id_veiculo, rotulo: `${v.placa} - ${v.marca} ${v.modelo}`,
                       }))}
                       {...campo("id_veiculo")} />
              <Texto rotulo="Tipo de documento *" id="doc-tipo" required
                     placeholder="Ex.: CRLV" {...campo("tipo_documento")} />
              <Selecao rotulo="Categoria" id="doc-categoria"
                       opcoes={CATEGORIAS_DOCUMENTO.map((c) => ({ valor: c, rotulo: c }))}
                       {...campo("categoria")} />
            </>
          )}
          <Texto rotulo={atualizando ? "Nº / Referência do novo documento" : "Nº / Referência"}
                 id="doc-numero" placeholder="Ex.: 01567890123" {...campo("numero_documento")} />
          <Texto rotulo="Órgão emissor" id="doc-orgao" placeholder="Ex.: DETRAN-MS"
                 {...campo("orgao_emissor")} />
          <Data rotulo="Data de emissão" id="doc-emissao" {...campo("data_emissao")} />
          <Data rotulo={atualizando ? "Novo vencimento *" : "Data de vencimento"} id="doc-validade"
                required={atualizando} {...campo("data_validade")} />
          <Selecao rotulo="Responsável" id="doc-responsavel" vazio="Sem responsável"
                   opcoes={servidores.map((s) => ({ valor: s.id_servidor, rotulo: s.nome }))}
                   {...campo("id_responsavel")} />
          {!atualizando && (
            <Selecao rotulo="Situação" id="doc-status" opcoes={ARQUIVAMENTO} {...campo("status")} />
          )}
          <Area rotulo="Observações" id="doc-obs" largo
                placeholder={atualizando ? "Ex.: Licenciamento 2027 pago em 10/01" : "Ex.: Renovação anual do licenciamento"}
                {...campo("observacoes")} />
          <Campo rotulo={editando ? "Anexar outro arquivo (opcional)" : "Arquivo do documento (opcional)"}
                 htmlFor="doc-arquivo" largo ajuda="PDF, JPG ou PNG, até 10 MB.">
            <input id="doc-arquivo" type="file" className="campo__input campo-arquivo"
                   accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                   onChange={escolherArquivo} />
          </Campo>
        </form>
      </Modal>
      {modalSenha}
    </>
  );
}
