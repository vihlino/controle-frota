/**
 * useArquivos.js - Carrega os anexos de um registro (sinistro, documento) e
 * as miniaturas das fotos, e oferece abrir, enviar e baixar.
 *
 * As rotas de arquivo exigem o token, entao a imagem nao pode ir direto num
 * <img src>: baixa como blob e vira uma URL local (liberada ao sair da tela).
 */
import { useCallback, useEffect, useState } from "react";
import { api, apiArquivo } from "../lib/api.js";
import { conferirArquivo, enviarArquivo } from "../lib/arquivos.js";

export function useArquivos(caminhoLista, caminhoArquivo, recarga = 0) {
  const [arquivos, setArquivos] = useState(null);
  const [miniaturas, setMiniaturas] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    api(caminhoLista).then((r) => setArquivos(Array.isArray(r) ? r : [])).catch(() => setArquivos([]));
  }, [caminhoLista, recarga, versao]);

  useEffect(() => {
    if (!arquivos) return undefined;
    let vivo = true;
    const criadas = [];
    arquivos.filter((a) => a.tipo.startsWith("image/")).forEach(async (a) => {
      try {
        const url = await apiArquivo(`${caminhoArquivo}/${a.id_arquivo}`);
        criadas.push(url);
        if (vivo) setMiniaturas((m) => ({ ...m, [a.id_arquivo]: url }));
      } catch { /* fica o icone */ }
    });
    return () => { vivo = false; criadas.forEach((u) => URL.revokeObjectURL(u)); };
  }, [arquivos, caminhoArquivo]);

  /** Abre numa aba nova (a aba e aberta ja no clique, senao vira pop-up bloqueado). */
  const abrir = useCallback(async (a) => {
    const janela = window.open("", "_blank");
    try {
      const url = await apiArquivo(`${caminhoArquivo}/${a.id_arquivo}`);
      if (janela) janela.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
    } catch (e) {
      janela?.close();
      alert(e.message);
    }
  }, [caminhoArquivo]);

  const baixar = useCallback(async (a) => {
    try {
      const url = await apiArquivo(`${caminhoArquivo}/${a.id_arquivo}`);
      const link = document.createElement("a");
      link.href = url;
      link.download = a.nome;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      alert(e.message);
    }
  }, [caminhoArquivo]);

  /** Envia os arquivos escolhidos (input file), um a um. */
  const enviar = useCallback(async (lista) => {
    const todos = Array.from(lista || []);
    const problemas = todos.map(conferirArquivo).filter(Boolean);
    if (problemas.length) alert(problemas.join("\n"));
    const bons = todos.filter((a) => !conferirArquivo(a));
    if (!bons.length) return;
    setEnviando(true);
    try {
      for (const a of bons) await enviarArquivo(api, caminhoLista, a);
    } catch (e) {
      alert(e.message);
    } finally {
      setEnviando(false);
      setVersao((n) => n + 1);
    }
  }, [caminhoLista]);

  const recarregar = useCallback(() => setVersao((n) => n + 1), []);

  return { arquivos, miniaturas, enviando, abrir, baixar, enviar, recarregar };
}
