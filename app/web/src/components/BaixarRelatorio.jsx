/**
 * BaixarRelatorio.jsx - Pop-up "Baixar" do relatorio gerado (09/10).
 *
 * Mesmo jeito da janela "Exportar" da Auditoria: o relatorio e o periodo vem
 * travados e escolhe-se so o formato.
 *
 * - CSV: separado por ";" e com BOM, para o Excel abrir os acentos certos.
 * - PDF: o documento do relatorio em A4 deitado - cabecalho da CMTT e do
 *   SITRA, identificacao, a tabela e as assinaturas do ateste - com o numero
 *   da pagina. As bibliotecas do PDF so sao baixadas quando alguem clica em
 *   "Baixar em PDF".
 *
 * Os dois saem do SNAPSHOT ja carregado na tela, sem nova consulta: e o mesmo
 * material que foi selado na geracao e que e atestado.
 */
import { useState } from "react";
import Modal from "./Modal.jsx";
import Icone from "./Icone.jsx";
import { Texto } from "./Campos.jsx";
import { data, dataHora, numero } from "../lib/formato.js";

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

/** Le uma imagem de public/ como dataURL, com o tamanho dela (para a proporcao). */
function carregarImagem(caminho) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext("2d").drawImage(img, 0, 0);
      resolve({ url: c.toDataURL("image/png"), largura: img.naturalWidth, altura: img.naturalHeight });
    };
    img.onerror = () => resolve(null);
    img.src = caminho;
  });
}

/** O PDF nao tem todos os simbolos da tela: troca os que somem por texto simples. */
const limpo = (t) => String(t ?? "").replace(/[—–]/g, "-").replace(/✓/g, "").replace(/ /g, " ");

export default function BaixarRelatorio({ relatorio, conteudo, celula, situacao, aoFechar }) {
  const [baixando, setBaixando] = useState("");   // "" | "csv" | "pdf"
  const [erro, setErro] = useState("");

  const nomeBase = `${relatorio.nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-")}-${relatorio.periodo_inicio}-a-${relatorio.periodo_fim}`;
  const periodo = `${data(relatorio.periodo_inicio)} a ${data(relatorio.periodo_fim)}`;
  const atestacoes = relatorio.atestacoes || [];

  function gerarCsv() {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const linhas = [
      conteudo.colunas.map((c) => esc(c.rotulo)).join(";"),
      ...conteudo.linhas.map((linha) => conteudo.colunas.map((c) => esc(celula(linha[c.chave], c.tipo))).join(";")),
    ];
    baixar("﻿" + linhas.join("\r\n"), "text/csv;charset=utf-8", `${nomeBase}.csv`);
  }

  async function gerarPdf() {
    const [{ jsPDF }, { autoTable }, cmtt, sitra] = await Promise.all([
      import("jspdf"), import("jspdf-autotable"),
      carregarImagem("/icons/cmtt-logo-documento.png"), carregarImagem("/icons/logo-sitra-documento.png"),
    ]);
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const L = doc.internal.pageSize.getWidth();
    const A = doc.internal.pageSize.getHeight();
    const M = 12;
    const cinza = [91, 97, 103];

    // Cabecalho: CMTT a esquerda, SITRA e a situacao a direita.
    let x = M;
    if (cmtt) {
      const h = 17;
      const w = (h * cmtt.largura) / cmtt.altura;
      doc.addImage(cmtt.url, "PNG", M, 9, w, h);
      x = M + w + 5;
    }
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(17, 19, 21);
    doc.text("Companhia Municipal de Trânsito e Transporte", x, 15);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...cinza);
    doc.text(`CMTT · ${relatorio.modulo === "FISCALIZACAO" ? "Fiscalização" : "Gestão de Frotas"}`, x, 20);
    doc.text(`Setor: ${limpo(relatorio.gerado_por_setor)}`, x, 24.5);
    if (sitra) {
      const h = 12;
      const w = (h * sitra.largura) / sitra.altura;
      doc.addImage(sitra.url, "PNG", L - M - w, 8.5, w, h);
    }
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...cinza);
    doc.text(`Situação: ${limpo(situacao)}`, L - M, 25.5, { align: "right" });
    doc.setDrawColor(230, 232, 235); doc.setLineWidth(0.3);
    doc.line(M, 30, L - M, 30);

    // Titulo e identificacao.
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(17, 19, 21);
    doc.text(limpo(relatorio.nome).toUpperCase(), L / 2, 39, { align: "center" });
    const itens = [
      ["PERÍODO", periodo],
      ["GERADO EM", dataHora(relatorio.data_geracao)],
      ["GERADO POR", `${limpo(relatorio.gerado_por_nome)}${relatorio.gerado_por_cargo ? ` - ${limpo(relatorio.gerado_por_cargo)}` : ""}`],
      ["SETOR", limpo(relatorio.gerado_por_setor)],
      ["REGISTROS", numero(conteudo.linhas.length)],
      ["CÓDIGO DE VERIFICAÇÃO", relatorio.hash_sha256?.slice(0, 16) || "-"],
    ];
    const larguras = [0.14, 0.13, 0.27, 0.19, 0.08, 0.19].map((f) => f * (L - 2 * M));
    let cx = M;
    itens.forEach(([rotulo, valor], i) => {
      doc.setFont("helvetica", "normal"); doc.setFontSize(6.8); doc.setTextColor(139, 145, 152);
      doc.text(rotulo, cx, 46.5);
      doc.setFont(i === 5 ? "courier" : "helvetica", "bold"); doc.setFontSize(8.8); doc.setTextColor(17, 19, 21);
      doc.text(doc.splitTextToSize(String(valor), larguras[i] - 3).slice(0, 2), cx, 51);
      cx += larguras[i];
    });
    doc.line(M, 58, L - M, 58);

    // A tabela dos registros.
    autoTable(doc, {
      head: [["#", ...conteudo.colunas.map((c) => limpo(c.rotulo))]],
      body: conteudo.linhas.length
        ? conteudo.linhas.map((linha, i) => [String(i + 1), ...conteudo.colunas.map((c) => limpo(celula(linha[c.chave], c.tipo)))])
        : [[{ content: "Nenhum registro encontrado no período escolhido.", colSpan: conteudo.colunas.length + 1, styles: { halign: "center", textColor: 140 } }]],
      startY: 62,
      margin: { left: M, right: M, top: 14, bottom: 14 },
      styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.7, overflow: "linebreak", textColor: 30, lineColor: [230, 232, 235], lineWidth: 0.1 },
      headStyles: { fillColor: [243, 244, 246], textColor: 20, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 250, 251] },
      columnStyles: { 0: { cellWidth: 9, halign: "center", textColor: 120 } },
    });

    // Assinaturas do ateste, lado a lado (ate tres).
    if (atestacoes.length > 0 || relatorio.status === "AGUARDANDO_ATESTE") {
      const lista = atestacoes.length ? atestacoes : [{ status: "PENDENTE", nome: "", cargo: "Responsável pelo ateste" }];
      let y = (doc.lastAutoTable?.finalY || 60) + 12;
      if (y + 40 > A - 14) { doc.addPage(); y = 22; }
      const col = (L - 2 * M) / lista.length;
      lista.forEach((a, i) => {
        const centro = M + col * i + col / 2;
        const ok = a.status === "ATESTADO";
        doc.setFont("helvetica", ok ? "bold" : "normal"); doc.setFontSize(7.5);
        doc.setTextColor(...(ok ? [21, 128, 61] : [139, 145, 152]));
        doc.text(ok ? "ATESTADO ELETRONICAMENTE" : "AGUARDANDO ATESTE", centro, y, { align: "center" });
        doc.setDrawColor(150); doc.setLineWidth(0.3);
        doc.line(centro - Math.min(35, col / 2 - 6), y + 14, centro + Math.min(35, col / 2 - 6), y + 14);
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(17, 19, 21);
        if (a.nome) doc.text(limpo(a.nome), centro, y + 19, { align: "center" });
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...cinza);
        if (a.cargo) doc.text(limpo(a.cargo), centro, y + 23.5, { align: "center" });
        if (ok && a.data_atestacao) doc.text(`Em ${dataHora(a.data_atestacao)}`, centro, y + 28, { align: "center" });
        if (ok && a.observacao) {
          doc.setFont("helvetica", "italic");
          doc.text(doc.splitTextToSize(`"${limpo(a.observacao)}"`, col - 12).slice(0, 2), centro, y + 32.5, { align: "center" });
        }
      });
    }

    // Numero da pagina em todas.
    const total = doc.internal.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(140);
      doc.text(`Página ${p} de ${total}`, L - M, A - 6, { align: "right" });
    }
    baixar(doc.output("blob"), "application/pdf", `${nomeBase}.pdf`);
  }

  async function gerar(formato) {
    setErro("");
    setBaixando(formato);
    try {
      if (formato === "csv") gerarCsv();
      else await gerarPdf();
      aoFechar();
    } catch (e) {
      setErro(e.message || "Não foi possível gerar o arquivo.");
    } finally {
      setBaixando("");
    }
  }

  return (
    <Modal
      titulo="Baixar relatório"
      largura={560}
      aoFechar={aoFechar}
      rodape={
        <>
          <button type="button" className="botao" onClick={aoFechar}>Cancelar</button>
          <button type="button" className="botao" disabled={!!baixando} onClick={() => gerar("csv")}>
            <Icone nome="exportar" tamanho={15} /> {baixando === "csv" ? "Gerando..." : "Baixar em CSV"}
          </button>
          <button type="button" className="botao botao--primario" disabled={!!baixando} onClick={() => gerar("pdf")}>
            <Icone nome="documentos" tamanho={15} monocromatico /> {baixando === "pdf" ? "Gerando PDF..." : "Baixar em PDF"}
          </button>
        </>
      }
    >
      {erro && <div className="login__erro">{erro}</div>}
      <div className="formulario-grade exportar-logs">
        <Texto rotulo="Relatório" id="baixar-nome" value={relatorio.nome} disabled readOnly largo />
        <Texto rotulo="Período" id="baixar-periodo" value={periodo} disabled readOnly />
        <Texto rotulo="Registros" id="baixar-registros" value={numero(conteudo.linhas.length)} disabled readOnly />
      </div>
      <p className="texto-apoio exportar-logs__previa">
        CSV abre no Excel, só com a tabela. PDF sai como o documento da tela, com o cabeçalho, a tabela e as assinaturas.
      </p>
    </Modal>
  );
}
