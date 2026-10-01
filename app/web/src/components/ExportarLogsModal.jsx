/**
 * ExportarLogsModal.jsx - Pop-up "Exportar" das telas de Auditoria.
 *
 * A origem fica TRAVADA na tela de onde se abriu (Logs de Acesso, Logs de
 * Acoes ou Alteracoes de Registros); escolhe-se so o periodo e o formato.
 *
 * - CSV: separado por ";" e com BOM, para o Excel abrir os acentos certos.
 * - PDF: tabela em A4 deitado, com cabecalho (origem, periodo, quem gerou)
 *   e numero de pagina. As bibliotecas do PDF so sao baixadas quando alguem
 *   clica em "Exportar em PDF" - nao pesam na abertura do sistema.
 *
 * A API entrega no maximo 200 linhas por pagina; aqui as paginas sao
 * buscadas uma a uma ate o fim (teto de 20.000 linhas), para o arquivo
 * trazer o periodo inteiro e nao so as primeiras 200.
 */
import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import Icone from "./Icone.jsx";
import { Texto, Data } from "./Campos.jsx";
import { api } from "../lib/api.js";
import { data as dataBr, dataHora, numero } from "../lib/formato.js";
import { useSessao } from "../lib/sessao.jsx";
import { nomeAcao, nomeEvento } from "../lib/rotulosAuditoria.js";

const POR_PAGINA = 200;
const MAX_PAGINAS = 100;

/** O que muda entre os dados antes e depois, numa linha de texto. */
function textoDaDiferenca(antes, depois) {
  if (!antes || !depois) return "";
  return Object.keys(depois)
    .filter((c) => JSON.stringify(antes[c]) !== JSON.stringify(depois[c]))
    .map((c) => {
      const v = (x) => (x === null || x === undefined ? "-" : typeof x === "object" ? JSON.stringify(x) : String(x));
      return `${c}: ${v(antes[c])} -> ${v(depois[c])}`;
    })
    .join(" | ");
}

export const ORIGENS_LOG = {
  acessos: {
    rotulo: "Logs de Acesso",
    colunas: [
      ["Data e hora", (l) => dataHora(l.data_hora)],
      ["Usuário", (l) => l.usuario_nome || l.login_informado || ""],
      ["Login informado", (l) => l.login_informado || ""],
      ["Evento", (l) => nomeEvento(l.tipo_evento)],
      ["IP", (l) => l.endereco_ip || ""],
      ["Resultado", (l) => (l.sucesso ? "Sucesso" : "Falha")],
    ],
  },
  acoes: {
    rotulo: "Logs de Ações",
    colunas: [
      ["Data e hora", (a) => dataHora(a.data_hora)],
      ["Usuário", (a) => a.usuario_nome || ""],
      ["Ação", (a) => nomeAcao(a.acao)],
      ["Registro afetado", (a) => a.entidade || ""],
      ["Nº do registro", (a) => (a.id_registro ?? "") + ""],
      ["Justificativa", (a) => a.justificativa || ""],
    ],
  },
  alteracoes: {
    rotulo: "Alterações de Registros",
    colunas: [
      ["Data e hora", (a) => dataHora(a.data_hora)],
      ["Usuário", (a) => a.usuario_nome || ""],
      ["Registro", (a) => a.entidade || ""],
      ["Nº do registro", (a) => (a.id_registro ?? "") + ""],
      ["Ação", (a) => nomeAcao(a.acao)],
      ["O que mudou", (a) => textoDaDiferenca(a.dados_anteriores, a.dados_novos)],
    ],
  },
};

const nomeArquivo = (rotulo, ext) =>
  `sitra-${rotulo.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.${ext}`;

function baixar(conteudo, tipo, nome) {
  const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ExportarLogsModal({ origem, aoFechar }) {
  const config = ORIGENS_LOG[origem];
  const { usuario } = useSessao();
  const [periodo, setPeriodo] = useState({ dataDe: "", dataAte: "" });
  const [total, setTotal] = useState(null);
  const [exportando, setExportando] = useState("");   // "" | "csv" | "pdf"
  const [erro, setErro] = useState("");

  const parametros = (pagina, porPagina) => {
    const p = new URLSearchParams({ pagina: String(pagina), porPagina: String(porPagina) });
    if (periodo.dataDe) p.set("dataDe", periodo.dataDe);
    if (periodo.dataAte) p.set("dataAte", periodo.dataAte);
    return p;
  };

  // Previa: quantos registros o periodo escolhido tem.
  useEffect(() => {
    setTotal(null);
    if (periodo.dataDe && periodo.dataAte && periodo.dataDe > periodo.dataAte) return;
    api(`/auditoria/${origem}?${parametros(1, 5)}`)
      .then((r) => setTotal(r.total))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origem, periodo.dataDe, periodo.dataAte]);

  async function buscarTudo() {
    const linhas = [];
    for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
      const r = await api(`/auditoria/${origem}?${parametros(pagina, POR_PAGINA)}`);
      linhas.push(...(r.itens || []));
      if (!r.itens || r.itens.length < POR_PAGINA || pagina >= (r.paginas || 1)) break;
    }
    return linhas;
  }

  const textoPeriodo = () =>
    periodo.dataDe || periodo.dataAte
      ? `${periodo.dataDe ? dataBr(periodo.dataDe) : "o início"} a ${periodo.dataAte ? dataBr(periodo.dataAte) : "hoje"}`
      : "todo o período";

  async function exportar(formato) {
    setErro("");
    if (periodo.dataDe && periodo.dataAte && periodo.dataDe > periodo.dataAte) {
      setErro("A data inicial não pode ser depois da data final.");
      return;
    }
    setExportando(formato);
    try {
      const linhas = await buscarTudo();
      if (!linhas.length) {
        setErro("Não há registros para exportar nesse período.");
        return;
      }
      const cabecalho = config.colunas.map(([r]) => r);
      const corpo = linhas.map((l) => config.colunas.map(([, f]) => String(f(l) ?? "")));

      if (formato === "csv") {
        const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
        const csv = [cabecalho, ...corpo].map((l) => l.map(esc).join(";")).join("\r\n");
        baixar("﻿" + csv, "text/csv;charset=utf-8", nomeArquivo(config.rotulo, "csv"));
      } else {
        const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        const largura = doc.internal.pageSize.getWidth();
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text(`SITRA - ${config.rotulo}`, 14, 15);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(90);
        doc.text(
          `Período: ${textoPeriodo()}  ·  ${numero(linhas.length)} registro(s)  ·  ` +
          `Gerado em ${new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} por ${usuario?.nome || "-"}`,
          14, 21
        );
        autoTable(doc, {
          head: [cabecalho],
          body: corpo,
          startY: 26,
          margin: { left: 10, right: 10 },
          styles: { fontSize: 7.5, cellPadding: 1.6, overflow: "linebreak", textColor: 30 },
          headStyles: { fillColor: [245, 184, 0], textColor: 20, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [247, 247, 247] },
          didDrawPage: () => {
            const pag = doc.internal.getNumberOfPages();
            doc.setFontSize(8);
            doc.setTextColor(120);
            doc.text(`Página ${pag}`, largura - 12, doc.internal.pageSize.getHeight() - 6, { align: "right" });
          },
        });
        baixar(doc.output("blob"), "application/pdf", nomeArquivo(config.rotulo, "pdf"));
      }
      aoFechar();
    } catch (e) {
      setErro(e.message || "Não foi possível exportar.");
    } finally {
      setExportando("");
    }
  }

  return (
    <Modal
      titulo="Exportar"
      largura={560}
      aoFechar={aoFechar}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="botao" disabled={!!exportando} onClick={() => exportar("csv")}>
            <Icone nome="exportar" tamanho={15} /> {exportando === "csv" ? "Exportando..." : "Exportar em CSV"}
          </button>
          <button type="button" className="botao botao--primario" disabled={!!exportando} onClick={() => exportar("pdf")}>
            <Icone nome="documento" tamanho={15} monocromatico /> {exportando === "pdf" ? "Gerando PDF..." : "Exportar em PDF"}
          </button>
        </>
      }
    >
      {erro && <div className="login__erro">{erro}</div>}
      <div className="formulario-grade exportar-logs">
        <Texto rotulo="Origem do log" id="exp-origem" value={config.rotulo} disabled readOnly largo />
        <Data rotulo="De" id="exp-de" value={periodo.dataDe}
              onChange={(e) => setPeriodo((p) => ({ ...p, dataDe: e.target.value }))} />
        <Data rotulo="Até" id="exp-ate" value={periodo.dataAte}
              onChange={(e) => setPeriodo((p) => ({ ...p, dataAte: e.target.value }))} />
      </div>
      <p className="texto-apoio exportar-logs__previa">
        {total === null
          ? "Contando os registros..."
          : `${numero(total)} registro(s) em ${textoPeriodo()}. Sem datas, sai o período inteiro.`}
      </p>
    </Modal>
  );
}
