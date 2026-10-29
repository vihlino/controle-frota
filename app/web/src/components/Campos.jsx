/**
 * Campos.jsx - Os campos de formulario e de filtro.
 *
 * Texto, Area (varias linhas), Selecao e Data - todos com a mesma casca:
 * rotulo em cima, campo embaixo, mesmas bordas e mesmo foco amarelo.
 *
 * Existem para que mudar a aparencia de todos os campos do sistema seja mexer
 * num arquivo so.
 */
// Campos de formulario e de filtro, todos com a mesma casca visual.
import Icone from "./Icone.jsx";

/**
 * @param {string} [ajuda]  Explicacao curta, mostrada ABAIXO do campo.
 *   Diferente de `placeholder`, que fica DENTRO e some ao digitar - e por isso
 *   nao serve para instrucao que a pessoa precisa ler enquanto preenche.
 */
/**
 * @param {string} [tamanho]  Sobra de uma epoca em que cada campo declarava
 *   a propria largura. Hoje todos ocupam o mesmo espaco na grade, e o valor
 *   nao muda nada - use `largo` quando o campo precisar da linha inteira.
 */
export function Campo({ rotulo, htmlFor, children, largo, ajuda, tamanho }) {
  return (
    <div
      className="campo"
      data-largo={largo ? "sim" : undefined}
      data-tamanho={tamanho}
    >
      {rotulo && <label htmlFor={htmlFor}>{Rotulo(rotulo)}</label>}
      {children}
      {ajuda && <span className="campo__ajuda">{ajuda}</span>}
    </div>
  );
}

/*
 * O "*" de campo obrigatorio sai do texto e vira um elemento proprio, para
 * poder ficar vermelho.
 *
 * O rotulo continua sendo escrito como "Placa *" em cada tela - uma string
 * simples, facil de ler no JSX. A separacao acontece AQUI, uma vez, e vale
 * para o sistema inteiro: nenhuma tela precisa lembrar de marcar nada, e
 * trocar a cor depois e mexer em uma regra de CSS, nao em 200 rotulos.
 *
 * "Opcional" nao se escreve: a ausencia do "*" ja diz isso.
 */
function Rotulo(rotulo) {
  if (typeof rotulo !== "string" || !rotulo.trimEnd().endsWith("*")) return rotulo;
  const texto = rotulo.trimEnd().slice(0, -1).trimEnd();
  return (
    <>
      {texto} <span className="campo__obrigatorio" aria-hidden="true">*</span>
    </>
  );
}

/*
 * ICONE DENTRO DO CAMPO (desenho do Cesar, 29/10)
 *
 * Nas janelas de cadastro cada campo tem um icone a esquerda (pessoa no
 * nome, calendario na data, telefone no telefone...). Ele sai do ROTULO, para
 * valer no sistema inteiro sem tocar em cada formulario; `icone` troca o
 * escolhido e `icone={false}` tira. Fora das janelas (barras de filtro) o
 * icone fica escondido pelo CSS - la o espaco e curto.
 */
const ICONES_CAMPO = [
  [/^\s*ano\b/i, "calendar"],
  [/placa/i, "placa"],
  [/e-?mail/i, "email"],
  [/telefone|celular|contato/i, "telefone"],
  [/cpf|matr[ií]cula|renach|cnh|registro/i, "cnh"],
  [/senha/i, "alterar-senha"],
  [/hora|hor[aá]rio/i, "historico"],
  [/data|vencimento|validade|prazo|emiss[aã]o|nascimento/i, "calendar"],
  [/km|od[oô]metro|quilometragem/i, "odometro"],
  [/pontos|pontua/i, "chart-line"],
  [/n[uú]mero da equipe|c[oó]digo/i, "arquivo-texto"],
  [/nome do item|^\s*nome\s*\*?\s*$/i, "adicionar"],
  [/custo|valor|r\$|pre[cç]o|pe[cç]as\b.*r\$|m[aã]o de obra|outros custos/i, "dinheiro"],
  [/respons[aá]vel|condutor|motorista|nome|coordenador|fiscal|usu[aá]rio|servidor/i, "user"],
  [/oficina|fornecedor|[oó]rg[aã]o|setor/i, "predio"],
  [/cargo|fun[cç][aã]o/i, "maleta"],
  [/equipe/i, "equipe"],
  [/viatura|ve[ií]culo|marca|modelo/i, "kpi-car"],
  [/chassi/i, "kpi-steering"],
  [/renavam|(?:^|\s)n[ºo°](?![a-z])|n[uú]mero|refer[eê]ncia|c[oó]digo|protocolo|auto de infra/i, "arquivo-texto"],
  [/\bcor\b/i, "paleta"],
  [/combust[ií]vel/i, "combustivel"],
  [/capacidade|lota[cç][aã]o/i, "usuarios"],
  [/v[ií]nculo/i, "link"],
  [/local|endere[cç]o|percurso|rota/i, "oc-local"],
  [/prioridade|gravidade/i, "alert-triangle"],
  [/descri|observa|justifica|motivo|pe[cç]as|provid[eê]ncias|documenta/i, "arquivo-texto"],
  [/servi[cç]o di[aá]rio|turno/i, "calendar"],
  [/tipo de manuten|servi[cç]o/i, "kpi-wrench"],
  [/frequ[eê]ncia|turno/i, "historico"],
  [/categoria|tipo|parte/i, "camadas"],
  [/pontos|pontua/i, "chart-line"],
  [/situa[cç][aã]o|status/i, "concluidas"],
];
export function iconeDoCampo(rotulo) {
  const t = typeof rotulo === "string" ? rotulo.replace(/\*/g, "") : "";
  if (!t) return null;
  return (ICONES_CAMPO.find(([re]) => re.test(t)) || [null, null])[1];
}

/** A caixa do campo com o icone a esquerda (quando houver). */
function Caixa({ icone, rotulo, children, area }) {
  const ic = icone === false ? null : (icone || iconeDoCampo(rotulo));
  if (!ic) return children;
  return (
    <span className={`campo-caixa${area ? " campo-caixa--area" : ""}`} data-ic="sim">
      <span className="campo-caixa__icone" aria-hidden="true"><Icone nome={ic} tamanho={16} monocromatico /></span>
      {children}
    </span>
  );
}

export function Texto({ rotulo, id, largo, ajuda, tamanho, icone, ...resto }) {
  return (
    <Campo rotulo={rotulo} htmlFor={id} largo={largo} ajuda={ajuda} tamanho={tamanho}>
      <Caixa icone={icone} rotulo={rotulo}><input id={id} {...resto} /></Caixa>
    </Campo>
  );
}

/** Varias linhas. Com `maxLength`, mostra o contador "0/500" no canto. */
export function Area({ rotulo, id, largo, ajuda, tamanho, icone, ...resto }) {
  const max = Number(resto.maxLength) || 0;
  const conta = max ? String(resto.value ?? "").length : 0;
  return (
    <Campo rotulo={rotulo} htmlFor={id} largo={largo} ajuda={ajuda} tamanho={tamanho}>
      <span className="campo-area">
        <Caixa icone={icone} rotulo={rotulo} area><textarea id={id} rows={3} {...resto} /></Caixa>
        {max ? <span className="campo-area__contador">{conta}/{max}</span> : null}
      </span>
    </Campo>
  );
}

// opcoes: [{valor, rotulo}]. "vazio" e o texto da opcao neutra ("Todos").
export function Selecao({ rotulo, id, opcoes = [], vazio, largo, ajuda, tamanho, icone, ...resto }) {
  return (
    <Campo rotulo={rotulo} htmlFor={id} largo={largo} ajuda={ajuda} tamanho={tamanho}>
      <Caixa icone={icone} rotulo={rotulo}>
        <select id={id} {...resto}>
          {vazio !== undefined && <option value="">{vazio}</option>}
          {opcoes.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
      </Caixa>
    </Campo>
  );
}

/**
 * Campo de data com icone de calendario e calendario que abre ao clicar.
 *
 * O <input type="date"> ja traz um seletor nativo, mas o gatilho e um icone
 * minusculo no canto - e diferente em cada navegador. Aqui o icone e nosso e
 * o clique em QUALQUER ponto do campo abre o calendario, que e o que a pessoa
 * espera e evita ter que digitar dd/mm/aaaa na mao.
 *
 * showPicker() nao existe em todo navegador (Safari antigo, Firefox antigo);
 * quando falta, o campo continua funcionando como sempre - digitando.
 */
export function Data({ rotulo, id, largo, ajuda, tamanho, icone: _icone, ...resto }) {
  // SO no clique. Tinha tambem um onFocus, e os dois juntos quebravam: o
  // focus abria o calendario e o click, no mesmo gesto, chamava showPicker de
  // novo - a segunda chamada lanca NotAllowedError ("requires a user
  // gesture") e o calendario fechava. O sintoma era o icone "nao clicavel".
  //
  // Abrir no foco tambem atrapalhava quem navega por Tab e quer digitar.
  function abrirCalendario(e) {
    const campo = e.currentTarget;
    if (typeof campo.showPicker !== "function") return;
    try {
      campo.showPicker();
    } catch {
      // Navegador sem suporte, campo desabilitado ou fora da tela: o campo
      // continua digitavel, que e o comportamento padrao.
    }
  }

  return (
    <Campo rotulo={rotulo} htmlFor={id} largo={largo} ajuda={ajuda} tamanho={tamanho}>
      <span className="campo-data campo-caixa" data-ic="sim">
        <span className="campo-caixa__icone" aria-hidden="true"><Icone nome="calendar" tamanho={16} monocromatico /></span>
        {/* type="date" DEPOIS do espalhamento, de proposito. Quem chama
            manda `type={c.html}`, que vale undefined para um campo de data;
            espalhado por ultimo, esse undefined apagava o type="date" e o
            campo virava texto comum - sem calendario nenhum. Era esta a causa
            do "icone da data nao abre" na tela de editar servidor. */}
        {/* Sem onClick aqui: o clique no texto so posiciona o cursor, para
            quem prefere DIGITAR a data. Abrir o calendario a cada clique
            atrapalhava exatamente isso - a pessoa clicava para corrigir o mes
            e o seletor tomava a frente. Quem quer o calendario clica no
            icone ao lado. */}
        <input id={id} {...resto} type="date" />
        {/* O icone tambem abre o calendario. Quem prefere DIGITAR (foi pedido
            assim) clica no texto e escreve dd/mm/aaaa; quem prefere escolher
            clica no calendario. Os dois caminhos existem no mesmo campo. */}
        <button
          type="button"
          className="campo-data__icone"
          tabIndex={-1}
          aria-label="Abrir calendário"
          onClick={(e) => {
            const campo = e.currentTarget.parentElement?.querySelector("input");
            if (campo) {
              campo.focus();
              abrirCalendario({ currentTarget: campo });
            }
          }}
        >
          <Icone nome="calendar" tamanho={15} />
        </button>
      </span>
    </Campo>
  );
}

/**
 * Periodo - "de" e "ate" num campo so.
 *
 * Dois campos de data lado a lado ocupavam duas colunas inteiras da barra de
 * filtros, e eram justamente os que empurravam o resto para a segunda linha.
 * Aqui eles dividem uma caixa unica, com o calendario no canto: mesma
 * informacao, metade do espaco.
 *
 * Cada metade continua sendo um <input type="date"> de verdade - da para
 * digitar a data e da para abrir o calendario, como no campo Data.
 */
export function Periodo({ rotulo = "Período", id, de, ate, aoMudarDe, aoMudarAte, largo, ajuda }) {
  function abrirCalendario(campo) {
    if (!campo || typeof campo.showPicker !== "function") return;
    try {
      campo.showPicker();
    } catch {
      // Sem suporte no navegador: o campo continua digitavel.
    }
  }

  return (
    <Campo rotulo={rotulo} htmlFor={`${id}-de`} largo={largo} ajuda={ajuda}>
      <span className="campo-periodo">
        <input
          id={`${id}-de`} type="date" value={de} aria-label={`${rotulo} - data inicial`}
          onChange={(e) => aoMudarDe(e.target.value)}
        />
        <span className="campo-periodo__sep" aria-hidden="true">até</span>
        <input
          id={`${id}-ate`} type="date" value={ate} aria-label={`${rotulo} - data final`}
          onChange={(e) => aoMudarAte(e.target.value)}
        />
        {/* Um icone so para os dois campos, e ele ABRE o calendario da data
            inicial. Antes era um desenho morto ao lado do seletor nativo do
            navegador: dois calendarios na mesma caixa, e nenhum dos dois era
            o nosso. */}
        <button
          type="button"
          className="campo-periodo__icone"
          tabIndex={-1}
          aria-label="Abrir calendário"
          onClick={(e) => {
            const campo = e.currentTarget.parentElement?.querySelector("input");
            if (campo) {
              campo.focus();
              abrirCalendario(campo);
            }
          }}
        >
          <Icone nome="calendar" tamanho={15} />
        </button>
      </span>
    </Campo>
  );
}

/**
 * ArquivoArraste - um arquivo so, escolhido pelo botao ou arrastando para a
 * caixa (desenho de 29/10: "Arraste e solte um arquivo aqui ou Escolher
 * arquivo"). `aoEscolher` recebe o mesmo evento de um <input type="file">.
 */
export function ArquivoArraste({ id, rotulo, ajuda = "PDF, JPG ou PNG, até 10 MB.", arquivo, aoEscolher,
  accept = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png", titulo = "Arraste e solte um arquivo aqui" }) {
  function soltar(e) {
    e.preventDefault();
    e.currentTarget.removeAttribute("data-arrastando");
    const f = e.dataTransfer?.files;
    if (f?.length) aoEscolher({ target: { files: f, value: "" } });
  }
  return (
    <Campo rotulo={rotulo} htmlFor={id} largo>
      <div className="arq-unico"
           onDragOver={(e) => { e.preventDefault(); e.currentTarget.setAttribute("data-arrastando", "sim"); }}
           onDragLeave={(e) => e.currentTarget.removeAttribute("data-arrastando")}
           onDrop={soltar}>
        <span className="arq-unico__nuvem"><Icone nome="exportar" tamanho={30} monocromatico /></span>
        <span className="arq-unico__textos"><strong>{titulo}</strong><small>{ajuda}</small></span>
        <span className="arq-unico__ou">ou</span>
        <label className="botao arq-unico__botao" htmlFor={id}><Icone nome="documentos" tamanho={16} /> Escolher arquivo</label>
        <span className="arq-unico__nome" title={arquivo?.name || ""}>{arquivo?.name || "Nenhum arquivo escolhido"}</span>
        <input id={id} type="file" hidden accept={accept} onChange={aoEscolher} />
      </div>
    </Campo>
  );
}
