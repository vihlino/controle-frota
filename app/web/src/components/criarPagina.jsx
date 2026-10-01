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
import ExportarLogsModal from "./ExportarLogsModal.jsx";
import { useConfirmacaoSenha } from "./ConfirmarSenha.jsx";
import { Texto, Selecao, Data, Area, Periodo } from "./Campos.jsx";
import { MASCARAS } from "../lib/mascaras.js";
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
 * @param {Function} [config.aoMudarCampo]  (nome, valor, formulario, listas) => objeto
 *                                    com campos a corrigir junto. Serve para
 *                                    quando mexer num campo invalida outro.
 * @param {object} config.mapaOpcoes   {chave: (item) => ({valor, rotulo})} -
 *                                     como transformar cada item da lista acima
 *                                     em opcao do select.
 * @param {Function} [config.aoSalvar] (formulario, usuario) => corpo a enviar.
 *                                     Use para converter tipos e acrescentar
 *                                     campos que a tela nao pergunta.
 * @param {string} [config.permissaoGerenciar]  Sem ela, o usuário so ve.
 * @param {boolean} [config.exigeJustificativa]  Na edicao, a caixa da senha
 *                                    tambem pede o motivo, que vai para a
 *                                    auditoria.
 * @param {boolean} [config.permiteCriar]   false esconde o botao de cadastrar:
 *                                    a tela so edita o que ja existe.
 * @param {boolean} [config.permiteExcluir]
 * @returns {Function} O componente React da tela.
 */
export default function criarPagina(config) {
  // `secao` vem por PROPRIEDADE, e nao pela configuracao, porque e conteudo
  // que muda a cada render - as abas de Setores e Cargos, por exemplo, que
  // precisam saber qual esta aberta. A configuracao e montada uma vez so,
  // quando o modulo carrega, e nao serviria para isso.
  return function Pagina({ secao }) {
    const { podeVer, usuario } = useSessao();

    // Transforma [{nome:"busca"},{nome:"setor"}] em {busca:"", setor:""},
    // que e o formato que o useLista espera.
    const filtrosIniciais = {
      ...Object.fromEntries((config.filtros || []).map((f) => [f.nome, ""])),
      // `filtrosFixos` nao tem controle na tela: e uma trava da propria pagina
      // (Motoristas = servidores com condutor=true). Vale tambem na contagem e
      // na paginacao, que sao calculadas pela API, e por isso e passado
      // tambem como FIXO: assim o botao "Limpar" nao o desliga.
      ...(config.filtrosFixos || {}),
    };
    const lista = useLista(config.recurso, filtrosIniciais, config.filtrosFixos || {});

    const [opcoes, setOpcoes] = useState({});        // listas dos selects
    const [editando, setEditando] = useState(null);  // null | "novo" | id
    // Telas de Auditoria: config.exportarLogs = "acessos" | "acoes" | "alteracoes".
    const [exportando, setExportando] = useState(false);
    const [formulario, setFormulario] = useState({});
    const [erroForm, setErroForm] = useState("");
    const [salvando, setSalvando] = useState(false);
    const [vendo, setVendo] = useState(null);   // registro aberto em "Detalhes"
    const { pedirSenha, pedirExclusao, elemento: modalSenha } = useConfirmacaoSenha();

    const podeGerenciar = !config.permissaoGerenciar || podeVer(config.permissaoGerenciar);
    const temFormulario = !!config.formulario;
    /*
     * Tela que EDITA mas nao CRIA.
     *
     * O checklist e o caso que pediu isto: o registro nasce sempre da leitura
     * do QR Code, no celular de quem esta com o veiculo. Um botao "Novo
     * checklist" na tela da gestao ofereceria inventar uma saida que nunca
     * aconteceu - e o valor do checklist e justamente ser prova de que
     * aconteceu. Corrigir o que o condutor digitou errado, sim; criar do
     * nada, nao.
     */
    const podeCriar = config.permiteCriar !== false;
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
        const lista =
          typeof campo.opcoes === "function"
            ? campo.opcoes(registro, opcoes)
            : typeof campo.opcoes === "string"
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
      if (!temFormulario || !podeGerenciar || !podeCriar) return;
      abrir(null);
      const limpo = new URLSearchParams(parametros);
      limpo.delete("novo");
      definirParametros(limpo, { replace: true });
    }, [parametros, definirParametros, temFormulario, podeGerenciar, podeCriar, abrir]);

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
          /*
           * Com exigeJustificativa, a mesma caixa pede o MOTIVO da alteracao,
           * e ele segue para a API, que o grava na auditoria (nao no
           * registro). E o caso do checklist: um numero que muda ali precisa
           * ter resposta para "por que mudou?" meses depois.
           */
          const pedeMotivo = !!config.exigeJustificativa;
          const resposta = await pedirSenha({
            titulo: `Salvar alterações`,
            aviso: `Confirme sua senha para salvar as alterações neste ${config.singular}.`,
            justificativa: pedeMotivo,
          });
          const confirmou = pedeMotivo ? resposta.ok : resposta;
          if (!confirmou) {
            setSalvando(false);
            return;
          }
          if (pedeMotivo) corpo = { ...corpo, justificativa: resposta.justificativa };
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
      /*
       * "O que sai": a tela pode descrever do jeito dela (descreverExclusao);
       * senao sai artigo + nome do cadastro + o primeiro identificador que o
       * registro tiver - "o servidor Maria Souza", "a equipe EQ-01".
       */
      const identificador =
        registro.nome ?? registro.placa ?? registro.protocolo ??
        registro.numero ?? registro.codigo ?? "";
      const oQue =
        config.descreverExclusao?.(registro) ||
        `${config.artigo || "o"} ${config.singular} ${identificador}`.trim();

      const resposta = await pedirExclusao({ titulo: `Excluir ${config.singular}`, oQue });
      if (!resposta.ok) return;

      try {
        await api(`/${config.recurso}/${registro[config.id]}`, {
          method: "DELETE",
          body: { justificativa: resposta.justificativa },
        });
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
              { rotulo: "Visualizar", icone: "visualizar", aoClicar: () => setVendo(registro) },
              { rotulo: "Editar", icone: "editar", aoClicar: () => abrir(registro) },
              // Excluir aparece por padrao; a tela declara
              // permiteExcluir: false quando o registro nao deve sumir
              // (checklist e a auditoria de uma saida, por exemplo).
              ...(config.permiteExcluir !== false
                ? [{ rotulo: "Excluir", perigo: true, icone: "lixo",
                     aoClicar: () => excluir(registro) }]
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
      // O periodo nao e um campo comum: ele governa DOIS nomes de filtro
      // (de e ate) dentro de uma caixa so, entao nao passa pelo caminho
      // generico abaixo.
      if (c.tipo === "periodo") {
        return (
          <Periodo
            key={c.nome}
            id={c.nome}
            rotulo={c.rotulo}
            de={valores[c.de] ?? ""}
            ate={valores[c.ate] ?? ""}
            aoMudarDe={(v) => aoMudar(c.de, v)}
            aoMudarAte={(v) => aoMudar(c.ate, v)}
          />
        );
      }

      const Componente = CAMPOS[c.tipo] || Texto;

      // As opcoes de um select podem vir de duas formas: uma lista fixa
      // escrita na configuração, ou o nome de uma lista carregada da API.
      // As opcoes de um select vem de tres formas:
      //   - lista fixa escrita na configuracao;
      //   - nome de uma lista carregada da API;
      //   - uma FUNCAO, quando as opcoes dependem do que ja foi preenchido no
      //     formulario. E o caso do cargo, que muda conforme o setor: a lista
      //     completa e carregada uma vez e a funcao escolhe o que mostrar, sem
      //     ir ao servidor a cada troca de setor.
      const listaOpcoes = c.opcoes
        ? typeof c.opcoes === "function"
          ? c.opcoes(valores, opcoes)
          : typeof c.opcoes === "string"
            ? (opcoes[c.opcoes] || []).map(config.mapaOpcoes[c.opcoes])
            : c.opcoes
        : undefined;

      /*
       * Mascara (CPF, telefone): a pontuacao aparece enquanto se digita.
       *
       * A mascara e aplicada na SAIDA e na ENTRADA. E isso que impede o cursor
       * de brigar com a pontuacao: o campo mostra sempre a forma canonica do
       * que ja foi digitado, e apagar um digito apaga o ponto junto.
       *
       * Quem TIRA a pontuacao antes de gravar e a API (normalizacoes), num
       * lugar so - valendo para qualquer tela que grave a mesma coluna.
       */
      const mascara = c.mascara ? MASCARAS[c.mascara] : null;

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
          // Teclado numerico no celular, para quem digita CPF nao ter que
          // procurar os numeros.
          inputMode={mascara ? "numeric" : undefined}
          value={mascara ? mascara(valores[c.nome] ?? "") : valores[c.nome] ?? ""}
          onChange={(e) =>
            aoMudar(c.nome, mascara ? mascara(e.target.value) : e.target.value)
          }
        />
      );
    }

    return (
      <PaginaLista
        secao={secao}
        trilha={config.trilha}
        titulo={config.titulo}
        descricao={config.descricao}
        acao={
          config.exportarLogs ? (
            podeVer("AUDITORIA_EXPORTAR") && (
              <button className="botao botao--primario" onClick={() => setExportando(true)}>
                <Icone nome="exportar" tamanho={15} /> Exportar
              </button>
            )
          ) : (
            temFormulario && podeGerenciar && podeCriar && (
              <button className="botao botao--primario" onClick={() => abrir(null)}>
                <Icone nome={config.iconeAcao || "mais"} tamanho={15} /> {config.rotuloAcao}
              </button>
            )
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
            aoFechar={() => setEditando(null)}
            rodape={
              <>
                <button className="botao" onClick={() => setEditando(null)}>Cancelar</button>
                {/* O atributo form liga este botao ao <form> abaixo, o que
                    permite deixar o botao no rodape do modal, fora do
                    formulario, sem perder o envio nem a validacao do HTML. */}
                <button className="botao botao--primario" form="form-pagina" disabled={salvando}>
                  <Icone nome="salvar" tamanho={15} monocromatico />{" "}
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
                      setFormulario((f) => {
                        const novo = { ...f, [nome]: valor };
                        // Um campo pode invalidar outro. Trocar o setor do
                        // servidor, por exemplo, derruba um cargo que so
                        // existia no setor anterior - sem isto o formulario
                        // ficaria com um cargo escolhido que nem aparece mais
                        // na lista, e salvaria assim mesmo.
                        return config.aoMudarCampo
                          ? { ...novo, ...(config.aoMudarCampo(nome, valor, novo, opcoes) || {}) }
                          : novo;
                      })
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

        {exportando && (
          <ExportarLogsModal origem={config.exportarLogs} aoFechar={() => setExportando(false)} />
        )}
        {modalSenha}
      </PaginaLista>
    );
  };
}
