/**
 * AnexarArquivos.jsx - Area de "arraste e solte" para escolher fotos e
 * documentos num formulario. So ESCOLHE: quem usa envia os arquivos depois de
 * gravar o registro (o envio precisa do id dele).
 *
 * @param {File[]} arquivos      Os ja escolhidos.
 * @param {(f: File[]) => void} aoMudar
 * @param {(msg: string) => void} [aoErro]
 */
import { useRef, useState } from "react";
import Icone from "./Icone.jsx";
import { ACEITAR, conferirArquivo, tamanhoArquivo } from "../lib/arquivos.js";

export default function AnexarArquivos({ arquivos, aoMudar, aoErro, titulo = "Arraste e solte as fotos e documentos aqui" }) {
  const entrada = useRef(null);
  const [arrastando, setArrastando] = useState(false);

  function acrescentar(lista) {
    const novos = [];
    const problemas = [];
    for (const a of Array.from(lista || [])) {
      const p = conferirArquivo(a);
      if (p) problemas.push(p);
      else novos.push(a);
    }
    if (problemas.length) aoErro?.(problemas.join(" "));
    if (novos.length) aoMudar([...arquivos, ...novos]);
  }

  return (
    <div className="anexar">
      <div
        className="upload-area anexar__area"
        data-arrastando={arrastando ? "sim" : undefined}
        role="button"
        tabIndex={0}
        onClick={() => entrada.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && entrada.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); acrescentar(e.dataTransfer.files); }}
      >
        <Icone nome="baixar" tamanho={26} />
        <p className="upload-area__titulo">{titulo}</p>
        <p className="upload-area__sub">ou</p>
        <span className="botao botao--pequeno">Selecionar arquivos</span>
        <p className="upload-area__info">Fotos em JPG ou PNG, documentos em PDF  •  até 10 MB por arquivo</p>
        <input ref={entrada} type="file" multiple hidden accept={ACEITAR}
               onChange={(e) => { acrescentar(e.target.files); e.target.value = ""; }} />
      </div>
      {arquivos.length > 0 && (
        <ul className="doc-arquivos anexar__lista">
          {arquivos.map((a, i) => (
            <li key={`${a.name}-${i}`}>
              <Icone nome={a.type === "application/pdf" ? "documento" : "visualizar"} tamanho={16} />
              <div className="doc-arquivos__info">
                <strong title={a.name}>{a.name}</strong>
                <span>{tamanhoArquivo(a.size)} · será enviado ao salvar</span>
              </div>
              <button type="button" className="botao botao--pequeno botao--icone"
                      title="Tirar da lista" aria-label={`Tirar ${a.name} da lista`}
                      onClick={() => aoMudar(arquivos.filter((_, j) => j !== i))}>
                <Icone nome="fechar" tamanho={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
