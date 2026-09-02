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
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PaginaLista from "./PaginaLista.jsx";
import Icone from "./Icone.jsx";
import Modal from "./Modal.jsx";
import Acoes from "./Acoes.jsx";
import { useConfirmacaoSenha } from "./ConfirmarSenha.jsx";
import { Texto, Selecao, Data, Area } from "./Campos.jsx";
import { useLista } from "./useLista.js";
import { api } from "../lib/api.js";
import { data as dataBr } from "../lib/formato.js";
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
    const filtrosIniciais = {
      ...Object.fromEntries((config.filtros || []).map((f) => [f.nome, ""])),
      // `filtrosFixos` nao tem controle na tela: e uma trava da propria pagina
      // (Motoristas = servidores com condutor=true). Como entra nos filtros
      // INICIAIS, ele sobrevive ao botao "Limpar" e vale tambem na contagem e
      // na paginacao, que sao calculadas pela API.
      ...(config.filtrosFixos || {}),
    };
    const lista = useLista(config.recurso, filtrosIniciais);

    const [opcoes, setOpcoes] = useState({});        // listas dos selects
    const [editando, setEditando] = useState(null);  // null | "novo" | id
    const [formulario, setFormulario] = useState({});
    const [erroForm, setErroForm] = useState("");
    const [salvando, setSalvando] = useState(false);
    const [vendo, setVendo] = useState(null);   // registro aberto em "Detalhes"
    const { pedirSenha, elemento: modalSenha } = useConfirmacaoSenha();

    const podeGerenciar = !config.permissaoGerenciar || podeVer(config.permissaoGerenciar);
    const temFormulario = !!config.formulario;
    const [parametros, definirParametros] = useSearchParams();

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
    /**
     * O `formulario` da configuracao aceita duas coisas: campos e cabecalhos
     * de secao ({ secao: "Dados pessoais" }). Esta funcao devolve so os
     * campos - a secao nao tem valor, nao entra no estado nem no POST.
     */
    /**
     * Valor de um campo em formato de leitura: o select mostra o ROTULO da
     * opcao, nao o codigo guardado; data vira dd/mm/aaaa; vazio vira travessao.
     */
    function valorLegivel(campo, registro) {
      const bruto = registro[campo.nome];
      if (bruto === null || bruto === undefined || bruto === "") return "—";

      if (campo.tipo === "data") return dataBr(bruto);

      if (campo.tipo === "selecao") {
        const lista = typeof campo.opcoes === "string"
          ? (opcoes[campo.opcoes] || []).map(config.mapaOpcoes[campo.opcoes])
          : campo.opcoes || [];
        const achado = lista.find((o) => String(o.valor) === String(bruto));
        return achado ? achado.rotulo : String(bruto);
      }

      if (typeof bruto === "boolean") return bruto ? "Sim" : "Não";
      return String(bruto);
    }

    function camposDoFormulario() {
      return config.formulario.filter((c) => !c.secao);
    }

    const abrir = useCallback(function abrir(registro) {
      // Comeca com todos os campos vazios (ou com o padrao declarado), para o
      // React nao reclamar de campo que muda de "nao controlado" para
      // "controlado" quando o usuário digita.
      const base = Object.fromEntries(
        camposDoFormulario().map((c) => [c.nome, c.padrao ?? ""])
      );
      let reg = registro;
      if (reg) {
        const camposData = camposDoFormulario()
          .filter((c) => c.tipo === "data")
          .map((c) => c.nome);
        for (const nome of camposData) {
          const v = reg[nome];
          if (v) {
            const d = new Date(v);
            if (!isNaN(d)) reg = { ...reg, [nome]: d.toISOString().slice(0, 10) };
          }
        }
      }
      setFormulario(reg ? { ...base, ...reg } : base);
      setErroForm("");
      setEditando(registro ? registro[config.id] : "novo");
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ?novo=1 abre a janela de cadastro assim que a tela carrega. E o que
    // permite um atalho do painel ("+ Cadastrar veiculo") cair direto no
    // formulario em vez de parar na listagem, onde a pessoa ainda teria que
    // procurar o botao. O parametro e consumido na hora - senao ele ficaria na
    // URL e a janela voltaria a abrir sozinha a cada F5.
    useEffect(() => {
      if (!parametros.get("novo")) return;
      if (!temFormulario || !podeGerenciar) return;
      abrir(null);
      const limpo = new URLSearchParams(parametros);
      limpo.delete("novo");
      definirParametros(limpo, { replace: true });
    }, [parametros, definirParametros, temFormulario, podeGerenciar, abrir]);

    /** Converte "dd/mm/yyyy" para "yyyy-mm-dd" se necessario. */
    function normalizarData(v) {
      if (typeof v === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
        const [d, m, y] = v.split("/");
        return `${y}-${m}-${d}`;
      }
      return v;
    }

    /** Envia o formulario: POST se for novo, PUT se for edicao. */
    async function salvar(e) {
      e.preventDefault(); // impede o navegador de recarregar a pagina
      setSalvando(true);
      setErroForm("");
      try {
        // aoSalvar e a chance de a tela converter tipos (texto -> numero) e
        // acrescentar campos que o formulario nao pergunta (id do usuário logado).
        let corpo = config.aoSalvar ? config.aoSalvar(formulario, usuario) : formulario;

        // Normaliza campos de data: converte dd/mm/yyyy -> yyyy-mm-dd caso o
        // browser envie no formato de exibicao em vez do formato ISO.
        const camposData = camposDoFormulario()
          .filter((c) => c.tipo === "data")
          .map((c) => c.nome);
        for (const nome of camposData) {
          if (corpo[nome]) corpo = { ...corpo, [nome]: normalizarData(corpo[nome]) };
        }

        if (editando === "novo") {
          await api(`/${config.recurso}`, { method: "POST", body: corpo });
        } else {
          // So a EDICAO pede senha. Criar um registro novo nao destroi nada e
          // e a acao mais comum do dia - exigir senha ali seria atrito sem
          // ganho de seguranca.
          const confirmou = await pedirSenha({
            titulo: `Salvar alterações`,
            aviso: `Confirme sua senha para salvar as alterações neste ${config.singular}.`,
          });
          if (!confirmou) {
            setSalvando(false);
            return;
          }
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

    /**
     * Exclui um registro. A senha substitui o confirm() do navegador: alem de
     * provar quem esta agindo, o confirm() nativo e clicado no automatico -
     * ninguem le aquela caixinha.
     */
    async function excluir(registro) {
      const confirmou = await pedirSenha({
        titulo: "Excluir registro",
        aviso:
          config.confirmarExclusao?.(registro) ||
          `Esta ação não pode ser desfeita. Confirme sua senha para excluir este ${config.singular}.`,
        perigo: true,
      });
      if (!confirmou) return;

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
          <Acoes
            acoes={[
              { rotulo: "Editar", aoClicar: () => abrir(registro) },
              { rotulo: "Detalhes", aoClicar: () => setVendo(registro) },
              // Excluir aparece por padrao; a tela declara
              // permiteExcluir: false quando o registro nao deve sumir
              // (checklist e a auditoria de uma saida, por exemplo).
              ...(config.permiteExcluir !== false
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
          required={c.obrigatorio && (c.mostrarSe ? c.mostrarSe(valores) : true)}
          largo={c.largo}
          type={c.html}
          placeholder={c.dica}
          ajuda={c.ajuda}
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
              <Icone nome={config.iconeAcao || "mais"} tamanho={16} /> {config.rotuloAcao}
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
                  {salvando ? "Salvando..." : config.rotuloSalvar || "Salvar"}
                </button>
              </>
            }
          >
            {erroForm && <div className="login__erro">{erroForm}</div>}
            <form id="form-pagina" className="formulario-grade" onSubmit={salvar}>
              {config.formulario
                // `mostrarSe` esconde campo que nao faz sentido no momento -
                // os dados da CNH so aparecem para quem e condutor. Uma secao
                // some junto quando nenhum campo dela sobrou.
                .filter((c) => (c.mostrarSe ? c.mostrarSe(formulario) : true))
                // Uma secao ficou vazia quando o proximo item ja e outra
                // secao (ou nao ha proximo).
                .filter((c, i, lista) =>
                  !c.secao || (lista[i + 1] && !lista[i + 1].secao)
                )
                .map((c, i) =>
                  c.secao ? (
                    <h3 className="formulario__secao" key={`secao-${i}`}>{c.secao}</h3>
                  ) : (
                    renderCampo(c, formulario, (nome, valor) =>
                      setFormulario((f) => ({ ...f, [nome]: valor }))
                    )
                  )
                )}
            </form>
          </Modal>
        )}

        {/* Detalhes: os mesmos campos do formulario, so leitura. Reaproveitar
            a declaracao garante que um campo novo aparece aqui sozinho. */}
        {vendo && (
          <Modal
            titulo={config.tituloDetalhes || `Detalhes do ${config.singular}`}
            aoFechar={() => setVendo(null)}
            largura={config.larguraFormulario || 640}
            rodape={
              <>
                <button className="botao" onClick={() => setVendo(null)}>Fechar</button>
                {podeGerenciar && (
                  <button
                    className="botao botao--primario"
                    onClick={() => { const r = vendo; setVendo(null); abrir(r); }}
                  >
                    Editar
                  </button>
                )}
              </>
            }
          >
            <dl className="lista-dados">
              {camposDoFormulario().map((c) => (
                <div className="lista-dados__linha" key={c.nome}>
                  <dt>{c.rotulo.replace(" *", "")}</dt>
                  <dd>{valorLegivel(c, vendo)}</dd>
                </div>
              ))}
            </dl>
          </Modal>
        )}

        {modalSenha}
      </PaginaLista>
    );
  };
}
