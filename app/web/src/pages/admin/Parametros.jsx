/**
 * Parâmetros.jsx - Configurações do sistema.
 * Quatro abas (Gerais, Alertas, E-mail, Backup) separadas pelo prefixo da
 * chave: "alerta.", "email.", "backup.". Novo parametro com o prefixo certo
 * ja aparece na aba certa, sem mexer no código.
 */
import { useEffect, useState } from "react";
import Icone from "../../components/Icone.jsx";
import { useOutletContext } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Trilha from "../../components/Trilha.jsx";
import Selo from "../../components/Selo.jsx";
import { api } from "../../lib/api.js";
import { dataHora } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";

// As quatro abas pedidas na estrutura: Configurações Gerais, Sistema de
// Alertas, E-mail / Notificações e Backup. Cada aba mostra os parâmetros do
// banco cujo módulo corresponde.
const ABAS = [
  { chave: "SISTEMA", rotulo: "Configurações Gerais" },
  { chave: "ALERTAS", rotulo: "Sistema de Alertas" },
  { chave: "EMAIL", rotulo: "E-mail / Notificações" },
  { chave: "BACKUP", rotulo: "Backup" },
];

function valorLegivel(parametro) {
  const v = parametro.valor;
  if (v === null || v === undefined) return "-";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function Parâmetros() {
  const { definirCabecalho } = useOutletContext();
  const { podeVer } = useSessao();
  const [aba, setAba] = useState("SISTEMA");
  const [parâmetros, setParâmetros] = useState([]);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState(null);
  const [rascunho, setRascunho] = useState("");

  const podeEditar = podeVer("ADMIN_GERENCIAR_PARAMETROS");

  useEffect(() => {
    definirCabecalho({ titulo: "", legenda: "" });
  }, [definirCabecalho]);

  function carregar() {
    api("/admin/parametros?porPagina=200")
      .then((r) => setParâmetros(r.itens))
      .catch((e) => setErro(e.message));
  }
  useEffect(carregar, []);

  async function salvar(parametro) {
    try {
      // O valor e JSONB: texto puro precisa virar JSON valido antes de subir.
      let valor;
      try {
        valor = JSON.parse(rascunho);
      } catch {
        valor = rascunho;
      }
      await api(`/admin/parametros/${parametro.id_parametro}`, {
        method: "PUT",
        body: { valor: JSON.stringify(valor) },
      });
      setEditando(null);
      carregar();
    } catch (e) {
      alert(e.message);
    }
  }

  // Os parâmetros do banco usam os módulos SISTEMA/FROTAS/FISCALIZACAO/
  // RELATORIOS/ADMINISTRACAO. As abas de alertas, e-mail e backup filtram pela
  // chave, que segue o padrao "alerta.", "email." e "backup.".
  const daAba = parâmetros.filter((p) => {
    const chave = (p.chave || "").toLowerCase();
    if (aba === "ALERTAS") return chave.startsWith("alerta");
    if (aba === "EMAIL") return chave.startsWith("email") || chave.startsWith("notific");
    if (aba === "BACKUP") return chave.startsWith("backup");
    return (
      !chave.startsWith("alerta") &&
      !chave.startsWith("email") &&
      !chave.startsWith("notific") &&
      !chave.startsWith("backup")
    );
  });

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <Trilha itens={[{ rotulo: "Administração" }, { rotulo: "Parâmetros do Sistema" }]} />
          <h1>Parâmetros do Sistema</h1>
          <p>Configurações que mudam o comportamento do sistema sem mexer no código.</p>
        </div>
      </div>

      <div className="abas">
        {ABAS.map((a) => (
          <button key={a.chave} className="aba" data-ativa={aba === a.chave}
                  onClick={() => setAba(a.chave)}>
            {a.rotulo}
          </button>
        ))}
      </div>

      {erro && <Cartao><div className="vazio">{erro}</div></Cartao>}

      <Cartao>
        <div className="rolagem-x">
          <table className="tabela">
            <thead>
              <tr>
                <th>Parâmetro</th><th>Chave</th><th>Valor</th><th>Tipo</th>
                <th>Módulo</th><th>Atualizado em</th><th>Situação</th>
                {podeEditar && <th>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {daAba.map((p) => (
                <tr key={p.id_parametro}>
                  <td>
                    <span className="celula-dupla">
                      <strong>{p.nome}</strong>
                      <span>{p.descricao || "-"}</span>
                    </span>
                  </td>
                  <td><code className="codigo">{p.chave}</code></td>
                  <td>
                    {editando === p.id_parametro ? (
                      <input className="entrada-embutida" value={rascunho} autoFocus
                             onChange={(e) => setRascunho(e.target.value)} />
                    ) : (
                      <code className="codigo">{valorLegivel(p)}</code>
                    )}
                  </td>
                  <td>{p.tipo_valor}</td>
                  <td>{p.módulo}</td>
                  <td>{dataHora(p.atualizado_em)}</td>
                  <td>
                    <Selo texto={p.ativo ? "Ativo" : "Inativo"}
                          tom={p.ativo ? "verde" : "vermelho"} />
                  </td>
                  {podeEditar && (
                    <td>
                      {editando === p.id_parametro ? (
                        <span className="acoes-linha">
                          <button className="botao botao--pequeno botao--primario"
                                  onClick={() => salvar(p)}><Icone nome="salvar" tamanho={14} monocromatico /> Salvar</button>
                          <button className="botao botao--pequeno"
                                  onClick={() => setEditando(null)}>Cancelar</button>
                        </span>
                      ) : (
                        <button className="botao botao--pequeno"
                                onClick={() => {
                                  setEditando(p.id_parametro);
                                  setRascunho(valorLegivel(p));
                                }}>
                          Editar
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {daAba.length === 0 && (
            <div className="vazio">
              Nenhum parametro cadastrado nesta aba. Novos parâmetros sao criados
              com a chave iniciando por "alerta.", "email." ou "backup." para
              aparecerem nas abas correspondentes.
            </div>
          )}
        </div>
      </Cartao>
    </>
  );
}
