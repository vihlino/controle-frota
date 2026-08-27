/**
 * ExportarLogs.jsx - Baixa os logs em CSV.
 * O arquivo e montado no proprio navegador. O BOM no inicio faz o Excel abrir
 * os acentos corretamente.
 */
import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import { Data, Selecao } from "../../components/Campos.jsx";
import { api } from "../../lib/api.js";
import { dataHora, numero } from "../../lib/formato.js";

const ORIGENS = [
  { valor: "acessos", rotulo: "Logs de Acesso" },
  { valor: "ações", rotulo: "Logs de Ações" },
  { valor: "alterações", rotulo: "Alterações de Registros" },
];

// Monta um CSV no proprio navegador a partir do que a API devolve, sem
// precisar de rota de exportacao no servidor.
function paraCsv(linhas) {
  if (!linhas.length) return "";
  const colunas = Object.keys(linhas[0]);
  const escapar = (v) => {
    if (v === null || v === undefined) return "";
    const texto = typeof v === "object" ? JSON.stringify(v) : String(v);
    return `"${texto.replace(/"/g, '""')}"`;
  };
  return [
    colunas.join(";"),
    ...linhas.map((l) => colunas.map((c) => escapar(l[c])).join(";")),
  ].join("\r\n");
}

export default function ExportarLogs() {
  const { definirCabecalho } = useOutletContext();
  const [origem, setOrigem] = useState("acessos");
  const [periodo, setPeriodo] = useState({ dataDe: "", dataAte: "" });
  const [previa, setPrevia] = useState(null);
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    definirCabecalho({
      titulo: "Exportar Logs",
      legenda: "Baixe os registros de auditoria em CSV.",
    });
  }, [definirCabecalho]);

  function parâmetros(porPagina) {
    const p = new URLSearchParams({ porPagina: String(porPagina) });
    if (periodo.dataDe) p.set("dataDe", periodo.dataDe);
    if (periodo.dataAte) p.set("dataAte", periodo.dataAte);
    return p;
  }

  useEffect(() => {
    api(`/auditoria/${origem}?${parâmetros(1)}`)
      .then((r) => setPrevia(r.total))
      .catch((e) => setErro(e.message));
  }, [origem, periodo]);

  async function exportar() {
    setExportando(true);
    setErro("");
    try {
      const r = await api(`/auditoria/${origem}?${parâmetros(5000)}`);
      const csv = paraCsv(r.itens);
      if (!csv) {
        setErro("Não há registros para exportar nesse periodo.");
        return;
      }
      // O BOM faz o Excel abrir os acentos corretamente.
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `sitra-${origem}-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErro(e.message);
    } finally {
      setExportando(false);
    }
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <Trilha itens={[{ rotulo: "Auditoria" }, { rotulo: "Exportar Logs" }]} />
          <h1>Exportar Logs</h1>
          <p>Escolha a origem e o periodo. O arquivo sai em CSV, pronto para o Excel.</p>
        </div>
      </div>

      {erro && <div className="login__erro">{erro}</div>}

      <Cartao titulo="Exportacao">
        <div className="formulario-grade">
          <Selecao rotulo="Origem dos logs" id="origem" opcoes={ORIGENS}
                   value={origem} onChange={(e) => setOrigem(e.target.value)} />
          <Data rotulo="De" id="dataDe" value={periodo.dataDe}
                onChange={(e) => setPeriodo((p) => ({ ...p, dataDe: e.target.value }))} />
          <Data rotulo="Ate" id="dataAte" value={periodo.dataAte}
                onChange={(e) => setPeriodo((p) => ({ ...p, dataAte: e.target.value }))} />
        </div>

        <p className="modal__aviso">
          {previa === null
            ? "Calculando..."
            : `${numero(previa)} registros serao exportados. O limite por arquivo e de 5.000 linhas.`}
        </p>

        <button className="botao botao--primario" onClick={exportar} disabled={exportando || !previa}>
          <Icone nome="arrow-up" tamanho={16} />
          {exportando ? " Gerando arquivo..." : " Exportar CSV"}
        </button>
      </Cartao>
    </>
  );
}
