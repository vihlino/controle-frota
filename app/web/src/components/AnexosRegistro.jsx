/**
 * AnexosRegistro.jsx - Os dois cartoes que ficam embaixo da lista nas abas
 * dos Detalhes do Veiculo e da Viatura (desenho do Cesar, 29/10):
 *
 *   Fotos da <registro>  as 4 primeiras miniaturas e "Adicionar fotos"
 *   Documentos           os PDFs (abrir / baixar) e uma linha com as fotos
 *
 * Serve a inspecao, a OS e a ocorrencia: muda so a rota dos anexos. Sem
 * `podeGerenciar` (ou sem rota de envio, como na ocorrencia) nao aparece o
 * "Adicionar fotos".
 */
import { useRef } from "react";
import Cartao from "./Cartao.jsx";
import Icone from "./Icone.jsx";
import Acoes from "./Acoes.jsx";
import { useArquivos } from "./useArquivos.js";
import { dataHora } from "../lib/formato.js";

const tamanho = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const tipoCurto = (t) => (t === "application/pdf" ? "PDF" : t === "image/png" ? "PNG" : t === "image/jpeg" ? "JPG" : "Arquivo");

export default function AnexosRegistro({ caminhoLista, caminhoArquivo, tituloFotos, podeGerenciar, aoVerTodos }) {
  const anexos = useArquivos(caminhoLista, caminhoArquivo);
  const entrada = useRef(null);
  const todos = anexos.arquivos || [];
  const fotos = todos.filter((a) => a.tipo.startsWith("image/"));
  const docs = todos.filter((a) => !a.tipo.startsWith("image/"));

  return (
    <div className="as-baixo">
      <Cartao titulo={<><Icone nome="oc-camera" tamanho={18} /> {tituloFotos}</>}
              acao={fotos.length > 4 && aoVerTodos && (
                <button className="botao botao--pequeno vd-cartao-acao" onClick={aoVerTodos}>Ver todas ({fotos.length})</button>
              )}>
        <input ref={entrada} type="file" hidden multiple accept="image/jpeg,image/png,application/pdf"
               onChange={(e) => { anexos.enviar(e.target.files); e.target.value = ""; }} />
        {anexos.arquivos === null ? <div className="carregando">Carregando...</div> : (
          <div className="as-fotos">
            {fotos.slice(0, 4).map((f) => (
              <button key={f.id_arquivo} type="button" className="as-foto" onClick={() => anexos.abrir(f)} title={f.nome}>
                {anexos.miniaturas[f.id_arquivo] ? <img src={anexos.miniaturas[f.id_arquivo]} alt={f.nome} /> : null}
              </button>
            ))}
            {podeGerenciar && (
              <button type="button" className="as-foto as-foto--nova" onClick={() => entrada.current?.click()} disabled={anexos.enviando}>
                <Icone nome="oc-camera" tamanho={20} />
                <span>{anexos.enviando ? "Enviando..." : "Adicionar fotos"}</span>
              </button>
            )}
            {!fotos.length && !podeGerenciar && <p className="pck-vazio">Nenhuma foto anexada.</p>}
          </div>
        )}
      </Cartao>

      <Cartao titulo={<><Icone nome="documentos" tamanho={18} /> Documentos</>}
              acao={podeGerenciar && (
                <button className="botao botao--pequeno vd-cartao-acao" onClick={() => entrada.current?.click()} disabled={anexos.enviando}>
                  <Icone nome="mais" tamanho={13} /> Anexar
                </button>
              )}>
        {anexos.arquivos === null ? <div className="carregando">Carregando...</div>
          : docs.length === 0 && fotos.length === 0 ? <p className="pck-vazio">Nenhum documento anexado.</p> : (
            <ul className="as-docs">
              {docs.slice(0, 4).map((a) => (
                <li key={a.id_arquivo}>
                  <span className="ad-tipo" data-tipo={tipoCurto(a.tipo)}>{tipoCurto(a.tipo)}</span>
                  <span className="as-docs__textos">
                    <strong title={a.nome}>{a.nome}</strong>
                    <small>{tipoCurto(a.tipo)} • {tamanho(a.bytes)} • Enviado em {dataHora(a.criado_em)}</small>
                  </span>
                  <span className="as-acoes">
                    <button type="button" className="botao botao--pequeno" aria-label={`Abrir ${a.nome}`} onClick={() => anexos.abrir(a)}>
                      <Icone nome="visualizar" tamanho={14} />
                    </button>
                    <Acoes acoes={[
                      { rotulo: "Abrir", icone: "visualizar", aoClicar: () => anexos.abrir(a) },
                      { rotulo: "Baixar", icone: "baixar", aoClicar: () => anexos.baixar(a) },
                    ]} />
                  </span>
                </li>
              ))}
              {fotos.length > 0 && (
                <li>
                  <span className="ad-tipo" data-tipo="FOTO"><Icone nome="oc-camera" tamanho={16} /></span>
                  <span className="as-docs__textos">
                    <strong>{tituloFotos} ({fotos.length})</strong>
                    <small>Última enviada em {dataHora(fotos[fotos.length - 1].criado_em)}</small>
                  </span>
                  <span className="as-acoes">
                    <button type="button" className="botao botao--pequeno" aria-label="Abrir a primeira foto" onClick={() => anexos.abrir(fotos[0])}>
                      <Icone nome="visualizar" tamanho={14} />
                    </button>
                  </span>
                </li>
              )}
            </ul>
          )}
      </Cartao>
    </div>
  );
}
