/**
 * JanelaCadastro.jsx - A janela de EDICAO de uma tela feita com criarPagina,
 * para ser aberta em outro lugar (08/10).
 *
 * As telas de detalhes (Motorista, Servidor, Fiscal) abrem esta janela ali
 * mesmo quando a pessoa clica em Editar, sem ir para a lista. Recebe a MESMA
 * configuracao da lista (ex.: CONFIG_SERVIDOR), entao os campos, as opcoes,
 * as mascaras e a conversao antes de gravar sao exatamente os de la.
 *
 * So edita (o cadastro de um novo continua na lista). Pede a senha antes de
 * gravar, como no resto do sistema, e o motivo quando a configuracao exige.
 *
 * 09/10: tambem entende o campo "marcar" (lista de caixas, ex.: fiscais da
 * equipe) e chama o aposSalvar da configuracao, como a lista faz.
 */
import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import TituloSecao from "./TituloSecao.jsx";
import Icone from "./Icone.jsx";
import { useConfirmacaoSenha } from "./ConfirmarSenha.jsx";
import { Texto, Selecao, Data, Area } from "./Campos.jsx";
import { MASCARAS } from "../lib/mascaras.js";
import { api } from "../lib/api.js";
import { useSessao } from "../lib/sessao.jsx";

const CAMPOS = { texto: Texto, selecao: Selecao, data: Data, area: Area };

/** "dd/mm/aaaa" -> "aaaa-mm-dd" (o campo de data as vezes devolve assim). */
function normalizarData(v) {
  if (typeof v === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
    const [d, m, y] = v.split("/");
    return `${y}-${m}-${d}`;
  }
  return v;
}

export default function JanelaCadastro({ config, id, aoFechar, aoSalvar }) {
  const { usuario } = useSessao();
  const [formulario, setFormulario] = useState(null);
  const [opcoes, setOpcoes] = useState({});
  const [erroForm, setErroForm] = useState("");
  const [salvando, setSalvando] = useState(false);
  const { pedirSenha, elemento: modalSenha } = useConfirmacaoSenha();
  const campos = config.formulario.filter((c) => !c.secao);

  // O registro vem da propria rota do cadastro (e nao da ficha), para a
  // janela ter exatamente os campos que a lista teria.
  useEffect(() => {
    api(`/${config.recurso}/${id}`)
      .then((reg) => {
        const base = Object.fromEntries(campos.map((c) => [c.nome, c.padrao ?? ""]));
        let r = { ...base, ...reg };
        for (const c of campos.filter((x) => x.tipo === "data")) {
          const v = r[c.nome];
          if (v) {
            const d = new Date(v);
            if (!isNaN(d)) r = { ...r, [c.nome]: d.toISOString().slice(0, 10) };
          }
        }
        setFormulario(r);
      })
      .catch((e) => setErroForm(e.message));
    for (const [chave, caminho] of Object.entries(config.opcoes || {})) {
      api(caminho)
        .then((r) => setOpcoes((o) => ({ ...o, [chave]: r.itens || r })))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErroForm("");
    try {
      let corpo = config.aoSalvar ? config.aoSalvar(formulario, usuario) : formulario;
      for (const c of campos.filter((x) => x.tipo === "data")) {
        if (corpo[c.nome]) corpo = { ...corpo, [c.nome]: normalizarData(corpo[c.nome]) };
      }
      const pedeMotivo = !!config.exigeJustificativa;
      const resposta = await pedirSenha({
        titulo: "Salvar alterações",
        aviso: `Confirme sua senha para salvar as alterações neste ${config.singular}.`,
        justificativa: pedeMotivo,
      });
      const confirmou = pedeMotivo ? resposta.ok : resposta;
      if (!confirmou) {
        setSalvando(false);
        return;
      }
      if (pedeMotivo) corpo = { ...corpo, justificativa: resposta.justificativa };
      await api(`/${config.recurso}/${id}`, { method: "PUT", body: corpo });
      if (config.aposSalvar) await config.aposSalvar(id, formulario);
      aoSalvar?.();
      aoFechar();
    } catch (e) {
      setErroForm(e.message);
    } finally {
      setSalvando(false);
    }
  }

  function renderCampo(c) {
    // Lista de marcar (ex.: fiscais da equipe): o valor e um array de ids.
    if (c.tipo === "marcar") {
      const lista = typeof c.opcoes === "string"
        ? (opcoes[c.opcoes] || []).map(config.mapaOpcoes[c.opcoes])
        : c.opcoes || [];
      const marcados = (formulario[c.nome] || []).map(String);
      const trocar = (v) => setFormulario((f) => ({
        ...f, [c.nome]: marcados.includes(v) ? marcados.filter((x) => x !== v) : [...marcados, v],
      }));
      return (
        <div className="campo" data-largo="sim" key={c.nome}>
          <label>{c.rotulo}</label>
          {lista.length === 0 ? <p className="campo__leitura">{c.vazio || "Nenhuma opção."}</p> : (
            <div className="marcar-lista">
              {lista.map((o) => (
                <label key={o.valor} className="marcar-lista__item" data-marcado={marcados.includes(String(o.valor))}>
                  <input type="checkbox" checked={marcados.includes(String(o.valor))}
                         onChange={() => trocar(String(o.valor))} />
                  <span>
                    <strong>{o.rotulo}</strong>
                    {o.apoio && <small>{o.apoio}</small>}
                  </span>
                </label>
              ))}
            </div>
          )}
          {c.ajuda && <small className="campo__ajuda">{c.ajuda}</small>}
        </div>
      );
    }
    const Componente = CAMPOS[c.tipo] || Texto;
    const listaOpcoes = c.opcoes
      ? typeof c.opcoes === "function"
        ? c.opcoes(formulario, opcoes)
        : typeof c.opcoes === "string"
          ? (opcoes[c.opcoes] || []).map(config.mapaOpcoes[c.opcoes])
          : c.opcoes
      : undefined;
    const mascara = c.mascara ? MASCARAS[c.mascara] : null;
    const mudar = (valor) =>
      setFormulario((f) => {
        const novo = { ...f, [c.nome]: valor };
        return config.aoMudarCampo
          ? { ...novo, ...(config.aoMudarCampo(c.nome, valor, novo, opcoes) || {}) }
          : novo;
      });
    return (
      <Componente
        key={c.nome}
        id={c.nome}
        rotulo={c.rotulo}
        required={c.obrigatorio && (c.mostrarSe ? c.mostrarSe(formulario) : true)}
        largo={c.largo}
        type={c.html}
        placeholder={c.dica}
        ajuda={c.ajuda}
        vazio={c.tipo === "selecao" ? c.vazio ?? "Selecione" : undefined}
        opcoes={listaOpcoes}
        inputMode={mascara ? "numeric" : undefined}
        value={mascara ? mascara(formulario[c.nome] ?? "") : formulario[c.nome] ?? ""}
        onChange={(e) => mudar(mascara ? mascara(e.target.value) : e.target.value)}
      />
    );
  }

  return (
    <>
      <Modal
        titulo={`Editar ${config.singular}`}
        aoFechar={aoFechar}
        rodape={
          <>
            <button className="botao" onClick={aoFechar}>Cancelar</button>
            <button className="botao botao--primario" form="form-janela-cadastro"
                    disabled={salvando || !formulario}>
              <Icone nome="salvar" tamanho={15} monocromatico />{" "}
              {salvando ? "Salvando..." : config.rotuloSalvar || "Salvar"}
            </button>
          </>
        }
      >
        {erroForm && <div className="login__erro">{erroForm}</div>}
        {!formulario ? (
          !erroForm && <div className="carregando">Carregando...</div>
        ) : (
          <form id="form-janela-cadastro" className="formulario-grade" onSubmit={salvar}>
            {config.formulario
              .filter((c) => (c.mostrarSe ? c.mostrarSe(formulario) : true))
              .filter((c, i, lista) => !c.secao || (lista[i + 1] && !lista[i + 1].secao))
              .map((c, i) =>
                c.secao
                  ? <TituloSecao key={`secao-${i}`}>{c.secao}</TituloSecao>
                  : renderCampo(c)
              )}
          </form>
        )}
      </Modal>
      {modalSenha}
    </>
  );
}
