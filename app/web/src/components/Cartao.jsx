/**
 * Cartao.jsx - O quadro branco com titulo.
 *
 * Bloco visual usado em toda parte: recebe um titulo, uma acao opcional no
 * canto direito (normalmente um "Ver todos") e o conteudo.
 */
export default function Cartao({ titulo, acao, children, className = "" }) {
  return (
    <section className={`cartao ${className}`}>
      {(titulo || acao) && (
        <header className="cartao__topo">
          {titulo && <h2 className="cartao__titulo">{titulo}</h2>}
          {acao}
        </header>
      )}
      <div className="cartao__corpo">{children}</div>
    </section>
  );
}
