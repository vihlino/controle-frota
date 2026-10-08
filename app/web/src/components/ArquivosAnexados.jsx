/**
 * ArquivosAnexados.jsx - Lista dos arquivos ja gravados de um registro (fotos
 * aparecem em miniatura), com Abrir, Remover (senha + justificativa) e
 * Adicionar. Usado na ficha do sinistro.
 *
 * @param {string} caminhoLista    Ex.: /frotas/sinistros/5/arquivos
 * @param {string} caminhoArquivo  Prefixo do arquivo: /frotas/sinistros/arquivos
 */
import { useEffect, useRef, useState } from "react";
import Icone from "./Icone.jsx";
import { useConfirmacaoSenha } from "./ConfirmarSenha.jsx";
import { api, apiArquivo } from "../lib/api.js";
import { dataHora } from "../lib/formato.js";
import { ACEITAR, conferirArquivo, enviarArquivo, tamanhoArquivo } from "../lib/arquivos.js";

/*
 * `filtro`: "imagem" mostra so as fotos, "pdf" so os documentos; sem filtro,
 * todos. `aceitar` troca os tipos oferecidos no Adicionar.
 */
const FILTROS = {
  imagem: (a) => a.tipo.startsWith("image/"),
  pdf: (a) => !a.tipo.startsWith("image/"),
};

export default function ArquivosAnexados({ caminhoLista, caminhoArquivo, podeGerenciar, vazio, aoMudar, filtro, aceitar, rotuloAdicionar = "Adicionar" }) {
  const [arquivos, setArquivos] = useState(null);
  const [miniaturas, setMiniaturas] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const entrada = useRef(null);
  const { pedirExclusao, elemento: modalSenha } = useConfirmacaoSenha();

  useEffect(() => {
    api(caminhoLista)
      .then((r) => setArquivos((Array.isArray(r) ? r : []).filter(FILTROS[filtro] || (() => true))))
      .catch(() => setArquivos([]));
  }, [caminhoLista, recarga, filtro]);

  // Miniaturas das fotos: a rota exige o token, entao baixa como blob.
  useEffect(() => {
    if (!arquivos) return undefined;
    let vivo = true;
    const criadas = [];
    arquivos.filter((a) => a.tipo.startsWith("image/")).forEach(async (a) => {
      try {
        const url = await apiArquivo(`${caminhoArquivo}/${a.id_arquivo}`);
        criadas.push(url);
        if (vivo) setMiniaturas((m) => ({ ...m, [a.id_arquivo]: url }));
      } catch { /* sem miniatura: fica o icone */ }
    });
    return () => { vivo = false; criadas.forEach((u) => URL.revokeObjectURL(u)); };
  }, [arquivos, caminhoArquivo]);

  async function abrir(a) {
    const janela = window.open("", "_blank");
    try {
      const url = await apiArquivo(`${caminhoArquivo}/${a.id_arquivo}`);
      if (janela) janela.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
    } catch (e) {
      janela?.close();
      alert(e.message);
    }
  }

  async function remover(a) {
    const r = await pedirExclusao({ titulo: "Remover arquivo", oQue: `o arquivo ${a.nome}` });
    if (!r.ok) return;
    try {
      await api(`${caminhoArquivo}/${a.id_arquivo}`, { method: "DELETE", body: { justificativa: r.justificativa } });
      setRecarga((n) => n + 1);
      aoMudar?.();
    } catch (e) {
      alert(e.message);
    }
  }

  async function anexar(e) {
    const lista = Array.from(e.target.files || []);
    e.target.value = "";
    const problemas = lista.map(conferirArquivo).filter(Boolean);
    if (problemas.length) alert(problemas.join("\n"));
    const bons = lista.filter((a) => !conferirArquivo(a));
    if (!bons.length) return;
    setEnviando(true);
    try {
      for (const a of bons) await enviarArquivo(api, caminhoLista, a);
    } catch (err) {
      alert(err.message);
    } finally {
      setEnviando(false);
      setRecarga((n) => n + 1);
      aoMudar?.();
    }
  }

  return (
    <>
      {podeGerenciar && (
        <div className="anexos__topo">
          <input ref={entrada} type="file" multiple hidden accept={aceitar || ACEITAR} onChange={anexar} />
          <button type="button" className="botao botao--pequeno" disabled={enviando}
                  onClick={() => entrada.current?.click()}>
            <Icone nome="mais" tamanho={13} /> {enviando ? "Enviando..." : rotuloAdicionar}
          </button>
        </div>
      )}
      {!arquivos ? (
        <p className="texto-corrido">Carregando...</p>
      ) : arquivos.length === 0 ? (
        <p className="texto-corrido">{vazio || "Nenhum arquivo anexado."}</p>
      ) : (
        <ul className="anexos">
          {arquivos.map((a) => (
            <li key={a.id_arquivo} className="anexos__item">
              <button type="button" className="anexos__previa" onClick={() => abrir(a)}
                      title={`Abrir ${a.nome}`}>
                {miniaturas[a.id_arquivo]
                  ? <img src={miniaturas[a.id_arquivo]} alt={a.nome} />
                  : <span className="anexos__pdf"><Icone nome="documento" tamanho={26} /><em>PDF</em></span>}
              </button>
              <div className="anexos__info">
                <strong title={a.nome}>{a.nome}</strong>
                <span>{[tamanhoArquivo(a.bytes), dataHora(a.criado_em)].filter(Boolean).join(" · ")}</span>
              </div>
              {podeGerenciar && (
                <button type="button" className="anexos__remover" title="Remover arquivo"
                        aria-label={`Remover ${a.nome}`} onClick={() => remover(a)}>
                  <Icone nome="lixo" tamanho={13} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {modalSenha}
    </>
  );
}
