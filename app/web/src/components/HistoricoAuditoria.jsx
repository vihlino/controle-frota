/**
 * HistoricoAuditoria.jsx - Tabela "Data e hora / Usuario / Acao / Descricao"
 * das telas de detalhes, montada a partir da AUDITORIA do registro
 * (/frotas/historico/:tipo/:id): quem criou, quem alterou e por que, quem
 * fechou, que arquivos entraram e sairam.
 *
 * `inicio` cobre o que nao passou pela auditoria (ex.: OS aberta pelo
 * condutor no QR Code, sem login): entra como primeira linha quando a
 * auditoria nao tem a criacao.
 */
import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { dataHora } from "../lib/formato.js";

const NOMES = {
  ordem_servico: { CRIAR: ["Abertura", "OS registrada"], EDITAR: ["Edição", "Registro da OS alterado"],
    FECHAR_OS: ["Fechamento", "OS fechada"], EXCLUIR: ["Exclusão", "OS excluída"] },
  sinistro: { CRIAR: ["Registro", "Sinistro registrado"], EDITAR: ["Edição", "Dados do sinistro alterados"],
    EXCLUIR: ["Exclusão", "Sinistro excluído"] },
  checklist: { EDITAR: ["Correção", "Checklist corrigido pela gestão"], EXCLUIR: ["Exclusão", "Checklist excluído"] },
  documento: { CRIAR: ["Cadastro", "Documento cadastrado"], EDITAR: ["Edição", "Informações do documento alteradas"],
    EXCLUIR: ["Exclusão", "Documento excluído"] },
};

function descrever(l, tipo, id) {
  if (l.entidade.endsWith("_arquivo")) {
    return l.acao === "EXCLUIR"
      ? ["Arquivo", `Arquivo removido: ${l.arquivo || ""}`]
      : ["Arquivo", `Arquivo anexado: ${l.arquivo || ""}`];
  }
  if (l.entidade === "sinistro_envolvido") return ["Envolvidos", "Lista de envolvidos atualizada"];
  if (l.acao === "ATUALIZAR_DOCUMENTO") {
    return String(l.id_documento_anterior) === String(id) && String(l.id_registro) !== String(id)
      ? ["Substituição", "Substituído por uma nova versão (renovação)"]
      : ["Atualização", "Nova versão cadastrada (renovação)"];
  }
  const nomes = NOMES[l.entidade]?.[l.acao];
  return nomes || [l.acao, ""];
}

export default function HistoricoAuditoria({ tipo, id, inicio, recarga = 0, limite }) {
  const [linhas, setLinhas] = useState(null);
  useEffect(() => {
    api(`/frotas/historico/${tipo}/${id}`)
      .then((r) => setLinhas(Array.isArray(r) ? r : []))
      .catch(() => setLinhas([]));
  }, [tipo, id, recarga]);

  if (!linhas) return <p className="texto-corrido">Carregando...</p>;
  let todas = linhas.map((l) => {
    const [acao, descricao] = descrever(l, tipo, id);
    return { quando: l.data_hora, usuario: l.usuario, acao,
      descricao: [descricao, l.justificativa && `Motivo: ${l.justificativa}`].filter(Boolean).join(" — ") };
  });
  const temCriacao = linhas.some((l) => ["CRIAR"].includes(l.acao) && !l.entidade.endsWith("_arquivo"));
  if (inicio && !temCriacao) todas.push(inicio);
  if (limite) todas = todas.slice(0, limite);
  if (!todas.length) return <p className="texto-corrido">Nenhum registro no histórico.</p>;

  return (
    <div className="rolagem-x">
      <table className="tabela vd-tabela historico-tabela">
        <thead>
          <tr><th>Data e hora</th><th>Usuário</th><th>Ação</th><th>Descrição</th></tr>
        </thead>
        <tbody>
          {todas.map((l, n) => (
            <tr key={n}>
              <td>{dataHora(l.quando)}</td>
              <td>{l.usuario || "—"}</td>
              <td>{l.acao}</td>
              <td className="coluna-flexivel">
                <span className="celula-cortada" title={l.descricao}>{l.descricao || "—"}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
