/**
 * criarPagina.jsx - Fabrica de telas de listagem.
 *
 * E o equivalente, no front, do que api/src/crud.js faz no servidor: em vez de
 * escrever a mesma tela 15 vezes, cada uma declara uma configuração e esta
 * função devolve o componente React pronto.
 *
 * EXEMPLO (pages/admin/Setores.jsx, resumido):
 *
 *     export default criarPagina({
 *       recurso: "admin/setores",
 *       id: "id_setor",
 *       titulo: "Setores",
 *       colunas: [{ chave: "nome", rotulo: "Setor", ordenavel: true }],
 *       filtros: [{ nome: "busca", rotulo: "Buscar" }],
 *       formulario: [{ nome: "nome", rotulo: "Nome *", obrigatorio: true }],
 *     });
 *
 * QUANDO NAO USAR
 * ---------------
 * Telas com comportamento proprio sao escritas a mao: Veículos (menu de ações
 * com QR Code e historico), Checklists (coluna de equipamentos), Relatórios
 * (fluxo de geracao), Usuários (senha separada) e Perfis (matriz de permissões).
 */
import { useEffect, useState } from "react";
import PaginaLista from "./PaginaLista.jsx";
import Icone from "./Icone.jsx";
import Modal from "./Modal.jsx";
import Ações from "./Ações.jsx";
import { Texto, Selecao, Data, Area } from "./Campos.jsx";
import { useLista } from "./useLista.js";
import { api } from "../lib/api.js";
import { useSessao } from "../lib/sessao.jsx";

// Traduz o "tipo" declarado na configuração para o componente de campo.
const CAMPOS = { texto: Texto, selecao: Selecao, data: Data, area: Area };

/**
 * Gera o componente da tela.
 *
 * @param {object} config
 * @param {string} config.recurso      Caminho na API. Ex.: "admin/setores"
 * @param {string} config.id           Nome da coluna de chave.
 * @param {string} config.titulo       Titulo grande da pagina.
 * @param {string} config.descricao    Frase abaixo do titulo.
 * @param {Array}  config.trilha       Migalhas de navegacao.
 * @param {Array}  config.colunas      Colunas da tabela. Cada uma:
 *                                     { chave, rotulo, ordenavel, render(linha) }
 * @param {Array}  config.filtros      Campos da barra de filtros.
 * @param {Array}  [config.formulario] Campos do cadastro. Sem isto, a tela fica
 *                                     somente leitura (sem botao de novo, sem
 *                                     coluna de ações).
 * @param {object} [config.opcoes]     {chave: "/rota/da/api"} - listas que
 *                                     alimentam os <select>.
 * @param {object} config.mapaOpcoes   {chave: (item) => ({valor, rotulo})} -
 *                                     como transformar cada item da lista acima
 *                                     em opcao do select.
 * @param {Function} [config.aoSalvar] (formulario, usuario) => corpo a enviar.
 *                                     Use para converter tipos e acrescentar
 *                                     campos que a tela nao pergunta.
 * @param {string} [config.permissaoGerenciar]  Sem ela, o usuário so ve.
 * @param {boolean} [config.permiteExcluir]
 * @returns {Function} O componente React da tela.
 */
export default function criarPagina(config) {
  return function Pagina() {
    const { podeVer, usuario } = useSessao();

    // Transforma [{nome:"busca"},{nome:"setor"}] em {busca:"", setor:""},
    // que e o formato que o useLista espera.
    const filtrosIniciais = Object.fromEntries(
      (config.filtros || []).map((f) => [f.nome, ""])
    );
    const lista = useLista(config.recurso, filtrosIniciais);

    const [opcoes, setOpcoes] = useState({});        // listas dos selects
    const [editando, setEditando] = useState(null);  // null | "novo" | id
    const [formulario, setFormulario] = useState({});
    const [erroForm, setErroForm] = useState("");
    const [salvando, setSalvando] = useState(false);

    const podeGerenciar = !config.permissaoGerenciar || podeVer(config.permissaoGerenciar);
    const temFormulario = !!config.formulario;

    // Carrega as listas que alimentam os <select> declarados na configuração.
    // Roda uma vez so: essas listas mudam pouco.
    useEffect(() => {
      for (const [chave, caminho] of Object.entries(config.opcoes || {})) {
        api(caminho)
          // Algumas rotas devolvem {itens:[...]} e outras o array direto.
          .then((r) => setOpcoes((o) => ({ ...o, [chave]: r.itens || r })))
          .catch(() => {});
      }
    }, []);

    /**
     * Abre o modal de cadastro.
     * @param {object|null} registro  null = novo; um registro = edicao.
     */
    function abrir(registro) {
      // Comeca com todos os campos vazios (ou com o padrao declarado), para o
      // React nao reclamar de campo que muda de "nao controlado" para
      // "controlado" quando o usuário digita.
      const base = Object.fromEntries(
        config.formulario.map((c) => [c.nome, c.padrao ?? ""])
      );
      setFormulario(registro ? { ...base, ...registro } : base);
      setErroForm("");
      setEditando(registro ? registro[config.id] : "novo");
    }

    /** Envia o formulario: POST se for novo, PUT se for edicao. */
    async function salvar(e) {
      e.preventDefault(); // impede o navegador de recarregar a pagina
      setSalvando(true);
      setErroForm("");
      try {
        // aoSalvar e a chance de a tela converter tipos (texto -> numero) e
        // acrescentar campos que o formulario nao pergunta (id do usuário logado).
        const corpo = config.aoSalvar ? config.aoSalvar(formulario, usuario) : formulario;

        if (editando === "novo") {
          await api(`/${config.recurso}`, { method: "POST", body: corpo });
        } else {
          await api(`/${config.recurso}/${editando}`, { method: "PUT", body: corpo });
        }
        setEditando(null);
        lista.recarregar(); // atualiza a tabela com o que acabou de mudar
      } catch (e) {
        // O erro aparece dentro do modal, com o que o usuário digitou ainda
        // preenchido - refazer tudo por causa de um campo seria irritante.
        setErroForm(e.message);
      } finally {
        setSalvando(false);
      }
    }

    /** Exclui um registro, com confirmacao. */
    async function excluir(registro) {
      if (!confirm(config.confirmarExclusao?.(registro) || "Excluir este registro?")) return;
      try {
        await api(`/${config.recurso}/${registro[config.id]}`, { method: "DELETE" });
        lista.recarregar();
      } catch (e) {
        // Cobre o caso de registro vinculado a outros, que a API devolve com
        // mensagem propria.
        alert(e.message);
      }
    }

    // A coluna de ações so existe quando a tela tem cadastro E o usuário tem
    // permissão para gerenciar.
    const colunas = [...config.colunas];
    if (temFormulario && podeGerenciar) {
      colunas.push({
        chave: "ações",
        rotulo: "Ações",
        render: (registro) => (
          <Ações
            ações={[
              { rotulo: "Editar", aoClicar: () => abrir(registro) },
              ...(config.permiteExcluir
                ? [{ rotulo: "Excluir", perigo: true, aoClicar: () => excluir(registro) }]
                : []),
            ]}
          />
        ),
      });
    }

    /**
     * Desenha um campo, tanto na barra de filtros quanto no formulario.
     *
     * @param {object} c         Declaracao do campo.
     * @param {object} valores   Objeto de onde vem o valor atual.
     * @param {Function} aoMudar (nome, valor) => void
     */
    function renderCampo(c, valores, aoMudar) {
      const Componente = CAMPOS[c.tipo] || Texto;

      // As opcoes de um select podem vir de duas formas: uma lista fixa
      // escrita na configuração, ou o nome de uma lista carregada da API.
      const listaOpcoes = c.opcoes
        ? typeof c.opcoes === "string"
          ? (opcoes[c.opcoes] || []).map(config.mapaOpcoes[c.opcoes])
          : c.opcoes
        : undefined;

      return (
        <Componente
          key={c.nome}
          id={c.nome}
          rotulo={c.rotulo}
          required={c.obrigatorio}
          largo={c.largo}
          type={c.html}
          placeholder={c.dica}
          vazio={c.tipo === "selecao" ? c.vazio ?? "Selecione" : undefined}
          opcoes={listaOpcoes}
          value={valores[c.nome] ?? ""}
          onChange={(e) => aoMudar(c.nome, e.target.value)}
        />
      );
    }

    return (
      <PaginaLista
        trilha={config.trilha}
        titulo={config.titulo}
        descricao={config.descricao}
        acao={
          temFormulario && podeGerenciar && (
            <button className="botao botao--primario" onClick={() => abrir(null)}>
              <Icone nome={config.iconeAcao || "minus"} tamanho={16} /> {config.rotuloAcao}
            </button>
          )
        }
        lista={lista}
        colunas={colunas}
        chaveDe={(r) => r[config.id]}
        unidade={config.unidade}
        vazio={config.vazio}
        filtros={
          config.filtros && (
            <>
              {config.filtros.map((f) =>
                // Nos filtros, a opcao neutra e "Todos" (e nao "Selecione").
                renderCampo(
                  { ...f, vazio: f.vazio ?? "Todos" },
                  lista.filtros,
                  lista.alterarFiltro
                )
              )}
            </>
          )
        }
      >
        {editando && (
          <Modal
            titulo={editando === "novo" ? config.rotuloAcao : `Editar ${config.singular}`}
            largura={config.larguraFormulario || 640}
            aoFechar={() => setEditando(null)}
            rodape={
              <>
                <button className="botao" onClick={() => setEditando(null)}>Cancelar</button>
                {/* O atributo form liga este botao ao <form> abaixo, o que
                    permite deixar o botao no rodape do modal, fora do
                    formulario, sem perder o envio nem a validacao do HTML. */}
                <button className="botao botao--primario" form="form-pagina" disabled={salvando}>
                  {salvando ? "Salvando..." : "Salvar"}
                </button>
              </>
            }
          >
            {erroForm && <div className="login__erro">{erroForm}</div>}
            <form id="form-pagina" className="formulario-grade" onSubmit={salvar}>
              {config.formulario.map((c) =>
                renderCampo(c, formulario, (nome, valor) =>
                  setFormulario((f) => ({ ...f, [nome]: valor }))
                )
              )}
            </form>
          </Modal>
        )}
      </PaginaLista>
    );
  };
}
