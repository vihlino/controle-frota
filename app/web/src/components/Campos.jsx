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
export function Campo({ rotulo, htmlFor, children, largo, ajuda }) {
  return (
    <div className="campo" data-largo={largo ? "sim" : undefined}>
      {rotulo && <label htmlFor={htmlFor}>{rotulo}</label>}
      {children}
      {ajuda && <span className="campo__ajuda">{ajuda}</span>}
    </div>
  );
}

export function Texto({ rotulo, id, largo, ajuda, ...resto }) {
  return (
    <Campo rotulo={rotulo} htmlFor={id} largo={largo} ajuda={ajuda}>
      <input id={id} {...resto} />
    </Campo>
  );
}

export function Area({ rotulo, id, largo, ajuda, ...resto }) {
  return (
    <Campo rotulo={rotulo} htmlFor={id} largo={largo} ajuda={ajuda}>
      <textarea id={id} rows={3} {...resto} />
    </Campo>
  );
}

// opcoes: [{valor, rotulo}]. "vazio" e o texto da opcao neutra ("Todos").
export function Selecao({ rotulo, id, opcoes = [], vazio, largo, ajuda, ...resto }) {
  return (
    <Campo rotulo={rotulo} htmlFor={id} largo={largo} ajuda={ajuda}>
      <select id={id} {...resto}>
        {vazio !== undefined && <option value="">{vazio}</option>}
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
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
export function Data({ rotulo, id, largo, ajuda, ...resto }) {
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
    <Campo rotulo={rotulo} htmlFor={id} largo={largo} ajuda={ajuda}>
      <span className="campo-data">
        {/* type="date" DEPOIS do espalhamento, de proposito. Quem chama
            manda `type={c.html}`, que vale undefined para um campo de data;
            espalhado por ultimo, esse undefined apagava o type="date" e o
            campo virava texto comum - sem calendario nenhum. Era esta a causa
            do "icone da data nao abre" na tela de editar servidor. */}
        <input id={id} onClick={abrirCalendario} {...resto} type="date" />
        <span className="campo-data__icone">
          <Icone nome="calendar" tamanho={18} />
        </span>
      </span>
    </Campo>
  );
}
