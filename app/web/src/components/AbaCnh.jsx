/**
 * AbaCnh.jsx - Aba CNH dos Detalhes do Motorista, do Servidor e do Fiscal
 * (desenho do Cesar, 29/10).
 *
 *   Dados da CNH         numero, categoria, emissao, validade, orgao emissor,
 *                        UF, RENACH, observacoes e a imagem da carteira
 *   Situacao da CNH      valida / vencendo / vencida, quanto falta e quando
 *                        a renovacao e recomendada (6 meses antes)
 *   Historico de renovacao  linha do tempo das CNHs (migracoes 049 e 051)
 *   Uso da frota         o que cada tela ja mostrava (vem da tela)
 *   Arquivo da CNH       a foto ou o PDF da carteira (migracao 052)
 *
 * Do desenho ficou de fora, a pedido: Categorias da CNH e Restricoes.
 */
import { useRef } from "react";
import Cartao from "./Cartao.jsx";
import Icone from "./Icone.jsx";
import Selo from "./Selo.jsx";
import { useArquivos } from "./useArquivos.js";
import { ACEITAR, tamanhoArquivo } from "../lib/arquivos.js";
import { data, dataHora } from "../lib/formato.js";

const vazio = (v) => (v === null || v === undefined || v === "" ? "—" : v);
const dia = (v) => (v ? new Date(`${String(v).slice(0, 10)}T00:00:00`) : null);
const iniciais = (nome) => String(nome || "?").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("");

/** Situacao da CNH: o quadro grande do cartao "Situacao da CNH". */
function situacao(p) {
  const validade = dia(p.cnh_data_validade);
  if (!p.condutor || !validade) return { tom: "cinza", titulo: "Sem CNH registrada", texto: "Use Atualizar CNH para cadastrar.", lado: null };
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const dias = Math.round((validade - hoje) / 86400000);
  if (dias < 0) {
    return { tom: "vermelho", icone: "alert-triangle", titulo: "Vencida", texto: `Venceu em ${data(p.cnh_data_validade)}`,
             lado: `Há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? "" : "s"}`, dias };
  }
  const lado = dias === 0 ? "Vence hoje" : dias < 60 ? `Faltam ${dias} dias` : `Faltam ${Math.floor(dias / 30.44)} meses`;
  if (dias <= 30) return { tom: "amarelo", icone: "alert-triangle", titulo: "Vencendo", texto: `Vence em ${data(p.cnh_data_validade)}`, lado, dias };
  return { tom: "verde", icone: "check", titulo: "Válida", texto: `Vence em ${data(p.cnh_data_validade)}`, lado, dias };
}

/** Uma linha do quadro de campos (rotulo em cima, valor embaixo). */
function Campo({ rotulo, children }) {
  return (
    <div className="cnh-campo">
      <span className="cnh-campo__rotulo">{rotulo}</span>
      <span className="cnh-campo__valor">{children}</span>
    </div>
  );
}

/** Carteira desenhada com os dados do cadastro (quando nao ha foto anexada). */
function CarteiraDesenhada({ pessoa: p }) {
  return (
    <div className="cnh-carteira" aria-label="Resumo da CNH">
      <div className="cnh-carteira__topo">CARTEIRA DE HABILITAÇÃO · SITRA</div>
      <div className="cnh-carteira__corpo">
        <span className="cnh-carteira__foto">{iniciais(p.nome)}</span>
        <div className="cnh-carteira__dados">
          <span><small>NOME</small>{String(p.nome || "").toUpperCase()}</span>
          <span><small>Nº REGISTRO</small>{vazio(p.cnh)}</span>
          <span className="cnh-carteira__par">
            <span><small>VALIDADE</small>{p.cnh_data_validade ? data(p.cnh_data_validade) : "—"}</span>
            <span><small>CAT.</small>{vazio(p.categoria_cnh)}</span>
          </span>
        </div>
      </div>
      <div className="cnh-carteira__nota">Sem foto da CNH anexada</div>
    </div>
  );
}

export default function AbaCnh({ pessoa: p, podeEditar, aoAtualizar, uso, recarga = 0 }) {
  const caminho = `/frotas/servidores/${p.id_servidor}/cnh/arquivos`;
  const anexos = useArquivos(caminho, caminho, recarga);
  const entrada = useRef(null);
  const arquivos = anexos.arquivos || [];
  const ultimo = arquivos[0]; // vem do mais novo para o mais antigo
  const imagem = ultimo && ultimo.tipo.startsWith("image/") ? anexos.miniaturas[ultimo.id_arquivo] : null;
  const sit = situacao(p);
  const temCnh = Boolean(p.condutor && (p.cnh || p.cnh_data_validade));

  // Renovacao recomendada: 6 meses antes do vencimento.
  const validade = dia(p.cnh_data_validade);
  const recomendada = validade ? new Date(validade) : null;
  if (recomendada) recomendada.setMonth(recomendada.getMonth() - 6);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

  // Linha do tempo: a CNH atual e as anteriores. O motivo guardado numa CNH
  // antiga e o motivo da troca que a substituiu - ele descreve a CNH seguinte.
  const antigas = p.cnh_historico || [];
  const linhaTempo = [
    ...(temCnh ? [{ chave: "atual", atual: true, emissao: p.cnh_data_emissao, validade: p.cnh_data_validade, categoria: p.categoria_cnh }] : []),
    ...antigas.map((h) => ({ chave: h.id_historico, emissao: h.cnh_data_emissao, validade: h.cnh_data_validade, categoria: h.categoria_cnh })),
  ];
  const rotuloDe = (k) => {
    const anterior = (temCnh ? antigas[k] : antigas[k + 1]);
    if (!anterior) return { texto: k === linhaTempo.length - 1 && linhaTempo.length > 1 ? "Primeira CNH registrada" : "CNH registrada", por: null };
    const m = anterior.motivo;
    return {
      texto: !m || m === "Renovação" ? "Renovação da CNH" : m,
      por: anterior.alterado_por,
    };
  };

  return (
    <>
      <div className="cnh-topo">
        <Cartao titulo={<><Icone nome="arquivo-texto" tamanho={18} /> Dados da CNH</>}
                acao={podeEditar && (
                  <button className="botao botao--pequeno vd-cartao-acao" onClick={aoAtualizar}>
                    <Icone nome="editar" tamanho={14} /> Atualizar CNH
                  </button>
                )}>
          <div className="cnh-dados">
            <div className="cnh-campos">
              <Campo rotulo="Número da CNH">{vazio(p.cnh)}</Campo>
              <Campo rotulo="Categoria atual">{p.categoria_cnh ? <span className="cnh-categoria">{p.categoria_cnh}</span> : "—"}</Campo>
              <Campo rotulo="Data de emissão">{p.cnh_data_emissao ? data(p.cnh_data_emissao) : "—"}</Campo>
              <Campo rotulo="Data de validade">
                <span className="cnh-campo__linha">
                  {p.cnh_data_validade ? data(p.cnh_data_validade) : "—"}
                  {temCnh && <Selo texto={sit.titulo === "Vencendo" ? "Vencendo" : sit.titulo === "Vencida" ? "Vencida" : "Válida"} tom={sit.tom} />}
                </span>
              </Campo>
              <Campo rotulo="Órgão emissor">{vazio(p.cnh_orgao_emissor)}</Campo>
              <Campo rotulo="UF">{vazio(p.cnh_uf)}</Campo>
              <Campo rotulo="Registro RENACH">{vazio(p.cnh_renach)}</Campo>
              <Campo rotulo="Observações">{vazio(p.cnh_observacoes)}</Campo>
            </div>
            <div className="cnh-imagem">
              {imagem
                ? <button type="button" className="cnh-imagem__foto" onClick={() => anexos.abrir(ultimo)} title="Abrir a imagem da CNH">
                    <img src={imagem} alt={`CNH de ${p.nome}`} />
                  </button>
                : <CarteiraDesenhada pessoa={p} />}
            </div>
          </div>
        </Cartao>

        <Cartao titulo={<><Icone nome="cnh" tamanho={18} /> Situação da CNH</>}>
          <div className="cnh-situacao" data-tom={sit.tom}>
            {sit.icone && <span className="cnh-situacao__icone"><Icone nome={sit.icone} tamanho={22} monocromatico /></span>}
            <div>
              <strong>{sit.titulo}</strong>
              <span>{sit.texto}</span>
            </div>
            {sit.lado && <span className="cnh-situacao__lado">{sit.lado}</span>}
          </div>
          {temCnh && sit.dias >= 0 && recomendada && (
            <div className="cnh-atencao">
              <Icone nome="informacao" tamanho={18} />
              <div>
                <strong>Atenção</strong>
                <span>
                  {hoje >= recomendada
                    ? <>Já está no período recomendado para renovar (a partir de <b>{data(recomendada.toLocaleDateString("sv-SE"))}</b>, 6 meses antes do vencimento).</>
                    : <>Renovação recomendada a partir de <b>{data(recomendada.toLocaleDateString("sv-SE"))}</b> (6 meses antes do vencimento).</>}
                </span>
              </div>
            </div>
          )}
          {temCnh && sit.dias < 0 && (
            <div className="cnh-atencao" data-tom="vermelho">
              <Icone nome="alert-triangle" tamanho={18} />
              <div>
                <strong>CNH vencida</strong>
                <span>O condutor não deve dirigir veículos da frota até renovar a CNH.</span>
              </div>
            </div>
          )}
          {temCnh && <p className="vd2-nota" style={{ marginTop: 10 }}>O aviso de CNH vencendo aparece no sino 30 dias antes da validade.</p>}
        </Cartao>
      </div>

      <div className="cnh-meio">
        <Cartao titulo={<><Icone nome="historico" tamanho={18} /> Histórico de Renovação</>}>
          {linhaTempo.length === 0 ? <p className="texto-corrido">Nenhuma CNH registrada.</p> : (
            <ol className="cnh-linha-tempo">
              {linhaTempo.map((l, k) => {
                const r = rotuloDe(k);
                return (
                  <li key={l.chave} data-atual={l.atual ? "sim" : undefined}>
                    <span className="cnh-linha-tempo__ponto" />
                    <span className="cnh-linha-tempo__data">{l.emissao ? data(l.emissao) : "—"}</span>
                    <span className="cnh-linha-tempo__texto">
                      <strong>{r.texto}</strong>
                      <small>Categoria {vazio(l.categoria)}{r.por ? ` · por ${r.por}` : ""}</small>
                    </span>
                    <span className="cnh-linha-tempo__validade">
                      {l.atual ? <Selo texto={`Válida até ${l.validade ? data(l.validade) : "—"}`} tom={sit.tom === "cinza" ? "cinza" : sit.tom} />
                        : `Válida até ${l.validade ? data(l.validade) : "—"}`}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="vd2-nota" style={{ marginTop: 10 }}>Ao atualizar a CNH, a anterior fica guardada aqui.</p>
        </Cartao>

        {uso && (
          <Cartao titulo={<><Icone nome="informacao" tamanho={18} /> {uso.titulo}</>}>
            <dl className="vd-dados__coluna">
              {uso.linhas.map(([r, v]) => (
                <div className="vd-dados__linha" key={r}><dt>{r}</dt><dd>{v ?? "—"}</dd></div>
              ))}
            </dl>
          </Cartao>
        )}
      </div>

      <Cartao titulo={<><Icone nome="documentos" tamanho={18} /> Arquivo da CNH</>}
              acao={podeEditar && (
                <button className="botao botao--pequeno vd-cartao-acao" onClick={() => entrada.current?.click()} disabled={anexos.enviando}>
                  <Icone nome="mais" tamanho={13} /> {anexos.enviando ? "Enviando..." : ultimo ? "Anexar nova versão" : "Anexar arquivo"}
                </button>
              )}>
        <input ref={entrada} type="file" hidden accept={ACEITAR}
               onChange={(e) => { anexos.enviar(e.target.files); e.target.value = ""; }} />
        {anexos.arquivos === null ? <div className="carregando">Carregando...</div>
          : arquivos.length === 0 ? <p className="texto-corrido">Nenhum arquivo da CNH anexado. Anexe a foto ou o PDF da carteira.</p> : (
            <div className="cnh-arquivos">
              {arquivos.map((a, i) => (
                <div className="cnh-arquivo" key={a.id_arquivo}>
                  <span className="cnh-arquivo__mini">
                    {anexos.miniaturas[a.id_arquivo] ? <img src={anexos.miniaturas[a.id_arquivo]} alt="" />
                      : <span className="cnh-arquivo__pdf">{a.tipo === "application/pdf" ? "PDF" : "ARQ"}</span>}
                  </span>
                  <div className="cnh-arquivo__textos">
                    <strong>CNH - {p.nome}{i === 0 && arquivos.length > 1 ? " (atual)" : ""}</strong>
                    <span>Adicionado em {dataHora(a.criado_em)}{a.enviado_por_nome ? ` por ${a.enviado_por_nome}` : ""}</span>
                    <span>Arquivo: {a.nome}</span>
                    <span>Tamanho: {tamanhoArquivo(a.bytes)}</span>
                  </div>
                  <div className="cnh-arquivo__botoes">
                    <button className="botao botao--pequeno" onClick={() => anexos.abrir(a)}>
                      <Icone nome="visualizar" tamanho={14} /> Visualizar
                    </button>
                    <button className="botao botao--pequeno" onClick={() => anexos.baixar(a)}>
                      <Icone nome="baixar" tamanho={14} /> Baixar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </Cartao>
    </>
  );
}
