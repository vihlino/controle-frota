/**
 * ItensOs.jsx - Lista editavel de itens verificados / servicos de uma OS.
 *
 * A mesma lista aparece no Registrar OS (o que a oficina deve olhar) e no
 * Fechar OS (o que foi feito). Linha sem descricao e ignorada ao salvar.
 */
export default function ItensOs({ itens, aoMudar }) {
  const mudar = (idx, campo, valor) =>
    aoMudar(itens.map((it, i) => (i === idx ? { ...it, [campo]: valor } : it)));

  return (
    <div className="itens-os">
      <div className="lista-itens">
        {itens.map((item, idx) => (
          <div key={idx} className="lista-itens__linha itens-os__linha">
            <span className="lista-itens__numero">{idx + 1}</span>
            <input className="campo__input" placeholder="Item ou serviço" maxLength={200}
                   aria-label={`Item ${idx + 1}`}
                   value={item.descricao || ""}
                   onChange={(e) => mudar(idx, "descricao", e.target.value)} />
            <input className="campo__input" placeholder="Observação (opcional)"
                   aria-label={`Observação do item ${idx + 1}`}
                   value={item.observacao || ""}
                   onChange={(e) => mudar(idx, "observacao", e.target.value)} />
            <button type="button" className="botao-icone" title="Remover item"
                    aria-label={`Remover item ${idx + 1}`}
                    onClick={() => aoMudar(itens.filter((_, i) => i !== idx))}>
              ✕
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="botao botao--pequeno itens-os__adicionar"
              onClick={() => aoMudar([...itens, { descricao: "", observacao: "" }])}>
        + Adicionar item
      </button>
    </div>
  );
}
