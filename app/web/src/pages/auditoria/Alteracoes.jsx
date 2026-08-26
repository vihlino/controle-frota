/**
 * Alteracoes.jsx - O que mudou em cada registro.
 * Compara o antes e o depois gravados na auditoria e mostra SO os campos que
 * realmente mudaram, com o valor antigo riscado em vermelho e o novo em verde.
 */
import { useState } from "react";
import criarPagina from "../../components/criarPagina.jsx";
import { dataHora } from "../../lib/formato.js";

// Mostra o antes e o depois lado a lado, so nos campos que realmente mudaram.
function Diferenca({ antes, depois }) {
  const [aberto, setAberto] = useState(false);
  if (!antes || !depois) return <span>-</span>;

  const mudados = Object.keys(depois).filter(
    (chave) => JSON.stringify(antes[chave]) !== JSON.stringify(depois[chave])
  );
  if (!mudados.length) return <span className="celula-nota">Sem alteracao de dados</span>;

  return (
    <div className="diferenca">
      <button className="botao botao--pequeno" onClick={() => setAberto((v) => !v)}>
        {aberto ? "Ocultar" : `Ver ${mudados.length} campo(s)`}
      </button>
      {aberto && (
        <table className="tabela tabela--interna">
          <thead>
            <tr><th>Campo</th><th>Antes</th><th>Depois</th></tr>
          </thead>
          <tbody>
            {mudados.map((chave) => (
              <tr key={chave}>
                <td><code className="codigo">{chave}</code></td>
                <td className="diferenca__antes">{String(antes[chave] ?? "-")}</td>
                <td className="diferenca__depois">{String(depois[chave] ?? "-")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default criarPagina({
  recurso: "auditoria/alteracoes",
  id: "id_auditoria",
  titulo: "Alteracoes de Registros",
  descricao: "O que mudou em cada registro, com o valor anterior e o novo.",
  trilha: [{ rotulo: "Auditoria" }, { rotulo: "Alteracoes de Registros" }],
  unidade: "alteracoes",
  vazio: "Nenhuma alteracao registrada no periodo.",
  mapaOpcoes: {},
  colunas: [
    { chave: "data_hora", rotulo: "Data e hora", ordenavel: true, render: (a) => dataHora(a.data_hora) },
    { chave: "usuario_nome", rotulo: "Usuario" },
    { chave: "entidade", rotulo: "Registro", ordenavel: true },
    { chave: "id_registro", rotulo: "No do registro" },
    { chave: "acao", rotulo: "Acao" },
    {
      chave: "diferenca", rotulo: "O que mudou",
      render: (a) => <Diferenca antes={a.dados_anteriores} depois={a.dados_novos} />,
    },
  ],
  filtros: [
    { nome: "busca", rotulo: "Buscar", dica: "Registro ou usuario" },
    { nome: "dataDe", rotulo: "De", tipo: "data" },
    { nome: "dataAte", rotulo: "Ate", tipo: "data" },
  ],
});
