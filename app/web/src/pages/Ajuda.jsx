/**
 * Ajuda.jsx - A Central de Ajuda (09/10).
 *
 * Layout do Cesar (09/10): no inicio, o cartao "Manual do Sistema", as
 * Perguntas Frequentes (as mais usadas) e o cartao "Precisa de mais ajuda?"
 * com o contato do suporte. Dali saem duas vistas:
 *   - ?aba=manual    o manual: passo a passo de cada cadastro (indice +
 *                    guia) e "Sobre as telas" (o texto do (?) de cada tela);
 *   - ?aba=perguntas todas as perguntas, por modulo, com busca.
 *
 * Os textos ficam em lib/ajudaGuias.js (passo a passo) e lib/ajudaTelas.js
 * (telas). Cada passo a passo tambem e uma pergunta ("Como cadastrar um novo
 * motorista?"), entao a pergunta e o manual nunca dizem coisas diferentes.
 *
 * So aparece o que o perfil pode abrir, como no menu lateral. O contato do
 * suporte vem de Parametros do Sistema (migracao 039, GET /sistema/suporte).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import Icone from "../components/Icone.jsx";
import Trilha from "../components/Trilha.jsx";
import { MENU } from "../components/menu.js";
import { AJUDA_TELAS } from "../lib/ajudaTelas.js";
import { GUIAS, MODULOS_AJUDA } from "../lib/ajudaGuias.js";
import { api } from "../lib/api.js";
import { useSessao } from "../lib/sessao.jsx";

/** Duvidas que nao sao um passo a passo. */
const DUVIDAS = [
  {
    id: "erro",
    pergunta: "O que fazer quando o sistema apresentar erro?",
    resposta: "Leia a mensagem: quase sempre ela diz o que falta (um campo obrigatório, uma data, uma permissão). Se não resolver, tire um print da tela, anote o que estava fazendo e fale com o suporte pelos contatos desta página.",
  },
  {
    id: "esqueci-senha",
    pergunta: "Esqueci a minha senha. O que faço?",
    resposta: "Peça ao administrador do sistema para usar \"Trocar senha\" na tela de Usuários. No próximo acesso você entra e cria uma senha nova.",
  },
  {
    id: "senha-salvar",
    pergunta: "Por que o sistema pede a minha senha para salvar?",
    resposta: "Para confirmar que é você mesmo quem está alterando. Toda alteração fica registrada na Auditoria com o seu nome, a data e a hora.",
  },
  {
    id: "justificativa",
    pergunta: "O que é a justificativa?",
    resposta: "É o motivo da alteração ou da exclusão, com pelo menos 5 letras. Ela é pedida ao corrigir checklist, inspeção, OS, documento e sinistro, e sempre que alguém exclui um registro.",
  },
  {
    id: "sem-botao",
    pergunta: "Não aparece o botão de cadastrar ou de editar. Por quê?",
    resposta: "O seu perfil só tem permissão para consultar essa tela. Se precisar cadastrar ou editar, fale com o administrador do sistema.",
  },
  {
    id: "condutor-login",
    pergunta: "O condutor precisa ter login para fazer o checklist?",
    resposta: "Não. Ele só lê o QR Code do veículo com o celular e informa a matrícula.",
  },
  {
    id: "saida-bloqueada",
    pergunta: "O checklist não deixa registrar a saída do veículo.",
    resposta: "Confira se o veículo não está Em manutenção ou Indisponível, se a matrícula está ativa e se não ficou um checklist em aberto (sem a chegada) para esse veículo.",
  },
  {
    id: "excluido",
    pergunta: "Excluí um registro por engano. Dá para recuperar?",
    resposta: "Não, a exclusão não pode ser desfeita. Ela fica registrada na Auditoria, com quem excluiu e o motivo. Fale com o administrador para cadastrar de novo.",
  },
  {
    id: "vira-viatura",
    pergunta: "Como um veículo vira viatura?",
    resposta: "Todo veículo do setor Fiscalização é viatura. Basta escolher esse setor no cadastro do veículo.",
  },
  {
    id: "vencimento",
    pergunta: "O que significam Válido, Vencendo e Vencido?",
    resposta: "É a situação calculada pela data de vencimento. Vencendo quer dizer que faltam 30 dias ou menos. Vencendo e Vencido também aparecem no sino.",
  },
];

/** As 8 do inicio, nesta ordem (as que o perfil nao abre sao puladas). */
const DESTAQUES = [
  "motorista", "checklist", "ocorrencia", "relatorio", "primeiro-acesso",
  "erro", "perfis", "viatura", "fiscal", "os", "veiculo", "os-viatura",
  "esqueci-senha", "como-funciona",
];

/** Texto sem acento e minusculo, para a busca achar "inspecao" e "Inspeção". */
function simples(t) {
  return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Rota do botao "Abrir a tela": texto, ou a primeira [rota, permissao] liberada. */
function rotaDoGuia(guia, podeVer) {
  if (!guia.para) return null;
  if (typeof guia.para === "string") return guia.para;
  const achou = guia.para.find(([, permissao]) => podeVer(permissao));
  return achou ? achou[0] : null;
}

export default function Ajuda() {
  const { definirCabecalho } = useOutletContext();
  const { podeVer } = useSessao();
  const navegar = useNavigate();
  const [parametros, setParametros] = useSearchParams();
  const [busca, setBusca] = useState("");

  useEffect(() => {
    definirCabecalho({ titulo: "", legenda: "" });
  }, [definirCabecalho]);

  const vista = ["manual", "perguntas", "telas"].includes(parametros.get("aba")) ? parametros.get("aba") : "";
  const mudar = (novos) => {
    const p = new URLSearchParams(parametros);
    for (const [k, v] of Object.entries(novos)) (v ? p.set(k, v) : p.delete(k));
    setParametros(p, { replace: !("aba" in novos) });
  };
  // A busca da pagina inicial (29/10) leva para as perguntas ja filtradas (?q=).
  useEffect(() => setBusca(parametros.get("q") || ""), [vista]); // eslint-disable-line react-hooks/exhaustive-deps
  const [buscaInicio, setBuscaInicio] = useState("");

  const temAlguma = (lista) => !lista?.length || lista.some((c) => podeVer(c));
  // Quem nao tem Frotas (ex.: Gestor de Fiscalizacao) ve os guias comuns
  // (checklist, multa, relatorio) no grupo Fiscalizacao.
  const grupoDo = (g) => (g.modulo === "frotas" && !podeVer("FROTAS_VISUALIZAR") ? "fiscalizacao" : g.modulo);

  // Os guias que o perfil enxerga, e as perguntas (guias + duvidas).
  const guiasVisiveis = useMemo(
    () => GUIAS.filter((g) => temAlguma(g.ver)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [podeVer]
  );
  const perguntas = useMemo(
    () => [
      ...guiasVisiveis.map((g) => ({ id: g.id, pergunta: g.pergunta || g.titulo, guia: g, grupo: grupoDo(g) })),
      ...DUVIDAS.map((d) => ({ ...d, grupo: "duvidas" })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [guiasVisiveis]
  );
  const destaques = DESTAQUES.map((id) => perguntas.find((p) => p.id === id)).filter(Boolean).slice(0, 8);

  const contexto = { podeVer, temAlguma, grupoDo, mudar };

  return (
    <div className="ajuda">
      {!vista && (
        <section className="ah">
          <div className="ah__textos">
            <span className="ah__trilha">Ajuda</span>
            <h1>Central de Ajuda</h1>
            <p>Encontre respostas rápidas, tire suas dúvidas ou acesse o manual do sistema.</p>
            <form className="ah__busca" onSubmit={(e) => { e.preventDefault(); mudar({ aba: "perguntas", q: buscaInicio.trim() }); }}>
              <label className="ah__campo">
                <Icone nome="search" tamanho={18} />
                <input type="search" placeholder="O que você precisa encontrar?" aria-label="Buscar na ajuda"
                       value={buscaInicio} onChange={(e) => setBuscaInicio(e.target.value)} />
              </label>
              <button className="botao botao--primario ah__buscar"><Icone nome="search" tamanho={16} monocromatico /> Buscar</button>
            </form>
          </div>
          <IlustracaoAjuda />
        </section>
      )}
      {vista && (
      <div className="cabecalho-pagina ajuda__cabecalho">
        <div>
          <Trilha itens={vista
            ? [{ rotulo: "Ajuda", para: "/ajuda" }, { rotulo: vista === "perguntas" ? "Perguntas Frequentes" : "Manual do Sistema" }]
            : [{ rotulo: "Ajuda" }]} />
          <div className="ajuda__titulo">
            <span className="ajuda__selo">
              <Icone nome={vista === "perguntas" ? "documentos" : vista ? "livro" : "ajuda"} tamanho={26} />
            </span>
            <div>
              <h1>{vista === "perguntas" ? "Perguntas Frequentes" : vista ? "Manual do Sistema" : "Ajuda"}</h1>
              <p>
                {vista === "perguntas"
                  ? "Todas as dúvidas, separadas por assunto."
                  : vista
                    ? "Passo a passo dos cadastros e o que cada tela do SITRA faz."
                    : "Encontre respostas rápidas, tire suas dúvidas ou acesse o manual do sistema."}
              </p>
            </div>
          </div>
        </div>
        {vista && (
          <div className="cabecalho-pagina__acoes ajuda__acoes">
            <button className="botao" onClick={() => navegar("/ajuda")}>
              <Icone nome="seta-esquerda" tamanho={15} /> Voltar
            </button>
            <label className="ajuda__busca">
              <Icone nome="search" tamanho={16} />
              <input type="search" placeholder={vista === "perguntas" ? "Buscar pergunta" : "Buscar no manual"}
                     aria-label="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </label>
          </div>
        )}
      </div>
      )}

      {!vista && (
        <>
          <button type="button" className="cartao ajuda__manual ah__manual" onClick={() => mudar({ aba: "manual" })}>
            <span className="ajuda__manual-icone ah__manual-icone"><Icone nome="livro" tamanho={32} monocromatico /></span>
            <span className="ajuda__manual-texto">
              <strong>Manual do Sistema</strong>
              <span>
                Acesse o guia completo com o passo a passo de cada cadastro e a explicação das telas do SITRA,
                incluindo Frotas e Fiscalização.
              </span>
            </span>
            <span className="ah__seta"><Icone nome="seta-direita" tamanho={18} monocromatico /></span>
          </button>

          <div className="ajuda__inicio">
            <section className="cartao ajuda__faq">
              <header className="ajuda__faq-topo">
                <h2><span className="ah__faq-icone"><Icone nome="arquivo-texto" tamanho={20} /></span> Perguntas Frequentes</h2>
                <button type="button" className="ajuda__ver-todas" onClick={() => mudar({ aba: "perguntas" })}>
                  Ver todas as perguntas <Icone nome="seta-direita" tamanho={14} />
                </button>
              </header>
              <ListaPerguntas itens={destaques} contexto={contexto} />
            </section>

            <div className="ah__lado">
              <Suporte />
              <section className="cartao ah__dicas">
                <div className="ah__dicas-topo">
                  <span className="ah__dicas-icone"><Icone nome="lampada" tamanho={26} monocromatico /></span>
                  <div><h2>Dicas rápidas</h2><p>Alguns atalhos para facilitar o seu dia a dia.</p></div>
                </div>
                <ul>
                  <li><Icone nome="search" tamanho={18} /> Use o atalho Ctrl + K para buscar no sistema.</li>
                  <li><Icone nome="arquivo-texto" tamanho={18} /> Consulte o manual para aprender cada funcionalidade.</li>
                  <li><Icone nome="alert-triangle" tamanho={18} /> Em caso de erro, anote a mensagem exibida e informe ao suporte.</li>
                </ul>
              </section>
            </div>
          </div>
        </>
      )}

      {vista === "perguntas" && (
        <TodasPerguntas perguntas={perguntas} busca={busca} contexto={contexto} />
      )}

      {(vista === "manual" || vista === "telas") && (
        <Manual guias={guiasVisiveis} busca={busca} parametros={parametros} vista={vista} contexto={contexto} />
      )}
    </div>
  );
}

/** Desenho do topo da Central de Ajuda: livro aberto com a lampada. */
function IlustracaoAjuda() {
  return (
    <svg className="ah__ilustracao" viewBox="0 0 320 190" aria-hidden="true">
      <ellipse cx="170" cy="110" rx="150" ry="78" fill="#fff4d6" />
      <circle cx="58" cy="60" r="3" fill="#f5b301" /><circle cx="72" cy="48" r="2.5" fill="#f5b301" /><circle cx="290" cy="128" r="3" fill="#f5b301" />
      <path d="M70 128c32-18 66-20 94-6v54c-28-14-62-12-94 6z" fill="#f5b301" />
      <path d="M258 128c-32-18-66-20-94-6v54c28-14 62-12 94 6z" fill="#e7a200" />
      <path d="M78 120c30-16 60-18 86-6v48c-26-12-56-10-86 6z" fill="#fff" />
      <path d="M250 120c-30-16-60-18-86-6v48c26-12 56-10 86 6z" fill="#fff" />
      <g stroke="#d6dbe3" strokeWidth="3" strokeLinecap="round"><path d="M92 132c18-8 38-9 58-4M92 144c18-8 38-9 58-4M92 156c18-8 38-9 58-4" /><path d="M178 128c20-5 40-4 58 4M178 140c20-5 40-4 58 4M178 152c20-5 40-4 58 4" /></g>
      <circle cx="164" cy="56" r="26" fill="#f5b301" />
      <path d="M154 54c0-6 4-10 10-10s10 4 10 10c0 4-3 6-5 9v3h-10v-3c-2-3-5-5-5-9z" fill="none" stroke="#1f2937" strokeWidth="2.6" />
      <path d="M159 70h10" stroke="#1f2937" strokeWidth="2.6" strokeLinecap="round" />
      <rect x="212" y="30" width="62" height="34" rx="17" fill="#fff" stroke="#e5e7eb" />
      <circle cx="230" cy="47" r="4" fill="#1f2937" /><circle cx="243" cy="47" r="4" fill="#1f2937" /><circle cx="256" cy="47" r="4" fill="#1f2937" />
    </svg>
  );
}

/* ------------------------------------------------------------ perguntas */

function ListaPerguntas({ itens, contexto }) {
  return (
    <div className="ajuda__perguntas">
      {itens.map((p) => (
        <details key={p.id} className="ajuda__duvida">
          <summary>
            <span>{p.pergunta}</span>
            <Icone nome="chevron-down" tamanho={16} />
          </summary>
          <div className="ajuda__resposta">
            {p.guia ? <RespostaGuia guia={p.guia} contexto={contexto} /> : <p>{p.resposta}</p>}
          </div>
        </details>
      ))}
    </div>
  );
}

/** A resposta de uma pergunta que e um passo a passo: os passos, enxutos. */
function RespostaGuia({ guia, contexto }) {
  const rota = rotaDoGuia(guia, contexto.podeVer);
  return (
    <>
      {guia.onde && <div className="ajuda__onde"><span>Onde fica:</span> <strong>{guia.onde}</strong></div>}
      {!contexto.temAlguma(guia.fazer) && (
        <div className="ajuda__aviso">
          <Icone nome="informacao" tamanho={16} />
          <span>Seu perfil só consulta esta tela. O cadastro é feito por quem tem a permissão.</span>
        </div>
      )}
      <ol className="ajuda__passos ajuda__passos--compacto">
        {guia.passos.map((p, i) => (
          <li key={i}><span className="ajuda__numero">{i + 1}</span><span>{p}</span></li>
        ))}
      </ol>
      <div className="ajuda__resposta-links">
        <button type="button" className="ajuda__link"
                onClick={() => contexto.mudar({ aba: "manual", guia: guia.id })}>
          Ver no manual <Icone nome="chevron-right" tamanho={14} />
        </button>
        {rota && <Link to={rota} className="ajuda__link">Abrir a tela <Icone nome="chevron-right" tamanho={14} /></Link>}
      </div>
    </>
  );
}

function TodasPerguntas({ perguntas, busca, contexto }) {
  const termo = simples(busca.trim());
  const achadas = perguntas.filter((p) => !termo || simples([
    p.pergunta, p.resposta, p.guia?.onde, ...(p.guia?.passos || []), ...(p.guia?.dicas || []),
  ].join(" ")).includes(termo));
  const grupos = [
    ...MODULOS_AJUDA.map((m) => ({ chave: m.chave, rotulo: m.chave === "geral" ? "Para começar" : m.rotulo })),
    { chave: "duvidas", rotulo: "Dúvidas gerais" },
  ];
  if (!achadas.length) {
    return <div className="cartao"><div className="vazio">Nenhuma pergunta encontrada para "{busca}".</div></div>;
  }
  return grupos.map((g) => {
    const doGrupo = achadas.filter((p) => p.grupo === g.chave);
    if (!doGrupo.length) return null;
    return (
      <section key={g.chave} className="cartao ajuda__faq ajuda__faq--grupo">
        <header className="ajuda__faq-topo"><h2>{g.rotulo}</h2><span className="ajuda__contagem">{doGrupo.length}</span></header>
        <ListaPerguntas itens={doGrupo} contexto={contexto} />
      </section>
    );
  });
}

/* --------------------------------------------------------------- suporte */

function Suporte() {
  const { podeVer } = useSessao();
  const [contato, setContato] = useState(null);
  useEffect(() => {
    api("/sistema/suporte").then(setContato).catch(() => setContato({}));
  }, []);
  const temContato = contato && (contato.email || contato.telefone);
  const soNumeros = String(contato?.telefone || "").replace(/\D/g, "");

  return (
    <aside className="cartao ajuda__suporte">
      <div className="ajuda__suporte-topo ah__suporte-topo">
        <span className="ajuda__suporte-icone"><Icone nome="ajuda" tamanho={30} /></span>
        <div>
          <h2>Precisa de mais ajuda?</h2>
          <p>{temContato
            ? "Nossa equipe está disponível para auxiliar e resolver qualquer problema."
            : "Fale com o administrador do sistema do seu setor."}</p>
        </div>
        {temContato && (
          <a className="botao botao--primario ah__contato" href={contato.email ? `mailto:${contato.email}` : `tel:${soNumeros}`}>
            <Icone nome="email" tamanho={15} monocromatico /> Entrar em contato
          </a>
        )}
      </div>

      {contato === null && <div className="carregando">Carregando...</div>}

      {temContato && (
        <div className="ajuda__contatos">
          {contato.email && (
            <div className="ajuda__contato">
              <Icone nome="email" tamanho={22} />
              <div><strong>E-mail</strong><span>{contato.email}</span></div>
              <a className="botao ajuda__contato-botao" href={`mailto:${contato.email}`}>
                <Icone nome="email" tamanho={16} /> Enviar e-mail
              </a>
            </div>
          )}
          {contato.telefone && (
            <div className="ajuda__contato">
              <Icone nome="telefone" tamanho={22} />
              <div>
                <strong>Telefone</strong>
                <span>{contato.telefone}</span>
                {contato.horario && <small>{contato.horario}</small>}
              </div>
              <a className="botao ajuda__contato-botao" href={`tel:${soNumeros}`}>
                <Icone nome="telefone" tamanho={17} /> Ligar
              </a>
            </div>
          )}
          {contato.horario && !contato.telefone && (
            <div className="ajuda__contato">
              <Icone nome="calendar" tamanho={22} />
              <div><strong>Atendimento</strong><span>{contato.horario}</span></div>
            </div>
          )}
        </div>
      )}

      {contato && !temContato && podeVer("ADMIN_VISUALIZAR") && (
        <div className="ajuda__aviso">
          <Icone nome="informacao" tamanho={16} />
          <span>
            O e-mail e o telefone do suporte ainda não foram preenchidos.
            Preencha em <Link to="/admin/parametros">Parâmetros do Sistema</Link> (Configurações Gerais).
          </span>
        </div>
      )}

      <div className="ajuda__dica-contato">
        <Icone nome="informacao" tamanho={18} />
        <span>
          Ao pedir ajuda, tenha em mãos o máximo de informações sobre o problema,
          como prints da tela e a descrição do que estava fazendo.
        </span>
      </div>
    </aside>
  );
}

/* ---------------------------------------------------------------- manual */

function Manual({ guias, busca, parametros, vista, contexto }) {
  const { podeVer, temAlguma, grupoDo, mudar } = contexto;
  const termo = simples(busca.trim());

  const achados = guias.filter((g) =>
    !termo || simples([g.titulo, g.pergunta, g.resumo, g.onde, ...(g.passos || []), ...(g.dicas || [])].join(" ")).includes(termo));
  const guia = achados.find((g) => g.id === parametros.get("guia")) || achados[0];

  const blocos = MENU
    .filter((b) => !b.permissao || podeVer(b.permissao))
    .map((b) => ({
      ...b,
      itens: b.itens
        .filter((i) => !i.permissao || podeVer(i.permissao))
        .map((i) => ({ ...i, texto: AJUDA_TELAS[i.para] || "" }))
        .filter((i) => !termo || simples(`${i.rotulo} ${i.texto}`).includes(termo)),
    }))
    .filter((b) => b.itens.length);

  // No celular o guia fica abaixo do indice: ao escolher, rola ate ele.
  const refGuia = useRef(null);
  const [rolar, setRolar] = useState(false);
  useEffect(() => {
    if (rolar && refGuia.current && window.innerWidth <= 900) {
      refGuia.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setRolar(false);
  }, [rolar, guia?.id]);

  const abaManual = vista === "telas" ? "telas" : "passos";
  return (
    <>
      <div className="abas">
        <button className="aba" data-ativa={abaManual === "passos"} onClick={() => mudar({ aba: "manual" })}>
          <Icone nome="checklist" tamanho={16} /> Passo a passo
          {termo && <span className="ajuda__contagem">{achados.length}</span>}
        </button>
        <button className="aba" data-ativa={abaManual === "telas"} onClick={() => mudar({ aba: "telas" })}>
          <Icone nome="informacao" tamanho={16} /> Sobre as telas
          {termo && <span className="ajuda__contagem">{blocos.reduce((n, b) => n + b.itens.length, 0)}</span>}
        </button>
      </div>

      {abaManual === "passos" && (achados.length === 0 ? (
        <div className="cartao"><div className="vazio">Nada encontrado no manual para "{busca}".</div></div>
      ) : (
        <div className="ajuda__grade">
          <nav className="cartao ajuda__indice" aria-label="Passo a passo">
            {MODULOS_AJUDA.map((m) => {
              const doModulo = achados.filter((g) => grupoDo(g) === m.chave);
              if (!doModulo.length) return null;
              return (
                <div key={m.chave} className="ajuda__grupo">
                  <div className="ajuda__grupo-titulo">{m.rotulo}</div>
                  {doModulo.map((g) => (
                    <button key={g.id} type="button" className="ajuda__item" data-ativo={g.id === guia?.id}
                            onClick={() => { mudar({ guia: g.id }); setRolar(true); }}>
                      <Icone nome={g.icone} tamanho={17} />
                      <span>{g.titulo}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </nav>
          {guia && <Guia refGuia={refGuia} guia={guia} podeFazer={temAlguma(guia.fazer)} rota={rotaDoGuia(guia, podeVer)} />}
        </div>
      ))}

      {abaManual === "telas" && (blocos.length === 0 ? (
        <div className="cartao"><div className="vazio">Nenhuma tela encontrada para "{busca}".</div></div>
      ) : blocos.map((b, i) => (
        <section key={b.grupo || i} className="ajuda__bloco">
          <h2 className="ajuda__bloco-titulo">{b.grupo || "Geral"}</h2>
          <div className="ajuda__telas">
            {b.itens.map((t) => (
              <article key={t.para} className="cartao ajuda__tela">
                <div className="ajuda__tela-topo">
                  <span className="ajuda__icone"><Icone nome={t.icone} tamanho={20} /></span>
                  <h3>{t.rotulo}</h3>
                </div>
                <p>{t.texto || "Tela do sistema."}</p>
                <Link to={t.para} className="ajuda__link">Abrir a tela <Icone nome="chevron-right" tamanho={14} /></Link>
              </article>
            ))}
          </div>
        </section>
      )))}
    </>
  );
}

function Guia({ guia, podeFazer, rota, refGuia }) {
  return (
    <article ref={refGuia} className="cartao ajuda__guia">
      <header className="ajuda__guia-topo">
        <span className="ajuda__icone ajuda__icone--grande"><Icone nome={guia.icone} tamanho={24} /></span>
        <div>
          <h2>{guia.titulo}</h2>
          <p>{guia.resumo}</p>
        </div>
        {rota && (
          <Link to={rota} className="botao ajuda__abrir">
            Abrir a tela <Icone nome="chevron-right" tamanho={14} />
          </Link>
        )}
      </header>

      {guia.onde && (
        <div className="ajuda__onde">
          <Icone nome="seta-direita" tamanho={14} /> <span>Onde fica:</span> <strong>{guia.onde}</strong>
        </div>
      )}

      {!podeFazer && (
        <div className="ajuda__aviso">
          <Icone nome="informacao" tamanho={16} />
          <span>Seu perfil só consulta esta tela. O cadastro é feito por quem tem a permissão; se precisar, fale com o administrador.</span>
        </div>
      )}

      <ol className="ajuda__passos">
        {guia.passos.map((p, i) => (
          <li key={i}>
            <span className="ajuda__numero">{i + 1}</span>
            <span>{p}</span>
          </li>
        ))}
      </ol>

      {guia.dicas?.length > 0 && (
        <div className="ajuda__dicas">
          <div className="ajuda__dicas-titulo"><Icone nome="ajuda" tamanho={16} /> Bom saber</div>
          <ul>
            {guia.dicas.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        </div>
      )}
    </article>
  );
}
