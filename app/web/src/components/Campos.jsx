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

export function Campo({ rotulo, htmlFor, children, largo }) {
  return (
    <div className="campo" data-largo={largo ? "sim" : undefined}>
      {rotulo && <label htmlFor={htmlFor}>{rotulo}</label>}
      {children}
    </div>
  );
}

export function Texto({ rotulo, id, largo, ...resto }) {
  return (
    <Campo rotulo={rotulo} htmlFor={id} largo={largo}>
      <input id={id} {...resto} />
    </Campo>
  );
}

export function Area({ rotulo, id, largo, ...resto }) {
  return (
    <Campo rotulo={rotulo} htmlFor={id} largo={largo}>
      <textarea id={id} rows={3} {...resto} />
    </Campo>
  );
}

// opcoes: [{valor, rotulo}]. "vazio" e o texto da opcao neutra ("Todos").
export function Selecao({ rotulo, id, opcoes = [], vazio, largo, ...resto }) {
  return (
    <Campo rotulo={rotulo} htmlFor={id} largo={largo}>
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

export function Data({ rotulo, id, largo, ...resto }) {
  return (
    <Campo rotulo={rotulo} htmlFor={id} largo={largo}>
      <input id={id} type="date" {...resto} />
    </Campo>
  );
}
