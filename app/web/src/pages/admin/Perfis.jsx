/**
 * Perfis.jsx - Perfis e permissões.
 * Escolhe-se um perfil a esquerda e marcam-se as permissões a direita,
 * agrupadas por módulo. Salvar substitui TODAS as permissões do perfil de
 * uma vez, em transacao.
 */
import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import Selo from "../../components/Selo.jsx";
import { api } from "../../lib/api.js";
import { numero } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";

// Acesso por módulo, tela e acao: o perfil recebe permissões e o usuário herda
// as permissões do perfil dele.
export default function Perfis() {
  const { definirCabecalho } = useOutletContext();
  const { podeVer } = useSessao();
  const [perfis, setPerfis] = useState([]);
  const [catalogo, setCatalogo] = useState({ porMódulo: {} });
  const [escolhido, setEscolhido] = useState(null);
  const [marcadas, setMarcadas] = useState(new Set());
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");

  const podeEditar = podeVer("PERFIL_EDITAR");

  useEffect(() => {
    definirCabecalho({
      titulo: "Perfis e Permissões",
      legenda: "Defina o que cada perfil pode ver e fazer.",
    });
  }, [definirCabecalho]);

  useEffect(() => {
    api("/admin/perfis?porPagina=100").then((r) => {
      setPerfis(r.itens);
      if (r.itens[0]) escolher(r.itens[0]);
    }).catch(() => {});
    api("/permissões").then(setCatalogo).catch(() => {});
  }, []);

  async function escolher(perfil) {
    setEscolhido(perfil);
    setAviso("");
    const ids = await api(`/permissões/perfil/${perfil.id_perfil}`);
    setMarcadas(new Set(ids));
  }

  function alternar(idPermissão) {
    setMarcadas((atual) => {
      const nova = new Set(atual);
      if (nova.has(idPermissão)) nova.delete(idPermissão);
      else nova.add(idPermissão);
      return nova;
    });
  }

  function alternarMódulo(permissões, ligar) {
    setMarcadas((atual) => {
      const nova = new Set(atual);
      for (const p of permissões) {
        if (ligar) nova.add(p.id_permissao);
        else nova.delete(p.id_permissao);
      }
      return nova;
    });
  }

  async function salvar() {
    setSalvando(true);
    setAviso("");
    try {
      await api(`/permissões/perfil/${escolhido.id_perfil}`, {
        method: "PUT",
        body: { permissões: [...marcadas] },
      });
      setAviso(`Permissões do perfil ${escolhido.nome} salvas.`);
    } catch (e) {
      setAviso(e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <Trilha itens={[{ rotulo: "Administração" }, { rotulo: "Perfis e Permissões" }]} />
          <h1>Perfis e Permissões</h1>
          <p>O usuário herda as permissões do perfil. Marque o que cada perfil pode fazer.</p>
        </div>
        {podeEditar && escolhido && (
          <button className="botao botao--primario" onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : `Salvar permissões de ${escolhido.nome}`}
          </button>
        )}
      </div>

      {aviso && <div className="aviso">{aviso}</div>}

      <div className="perfis">
        <aside className="perfis__lista">
          {perfis.map((p) => (
            <button
              key={p.id_perfil}
              className="perfil"
              data-ativo={escolhido?.id_perfil === p.id_perfil}
              onClick={() => escolher(p)}
            >
              <strong>{p.nome}</strong>
              <span>{p.descricao || "Sem descricao"}</span>
              <small>
                {numero(p.permissões)} permissões - {numero(p.usuários)} usuários
              </small>
            </button>
          ))}
        </aside>

        <div className="perfis__permissões">
          {Object.entries(catalogo.porMódulo).map(([módulo, permissões]) => {
            const todasMarcadas = permissões.every((p) => marcadas.has(p.id_permissao));
            return (
              <Cartao
                key={módulo}
                titulo={módulo}
                acao={
                  podeEditar && (
                    <button
                      className="cartao__acao"
                      onClick={() => alternarMódulo(permissões, !todasMarcadas)}
                    >
                      {todasMarcadas ? "Desmarcar todas" : "Marcar todas"}
                    </button>
                  )
                }
              >
                <div className="permissões">
                  {permissões.map((p) => (
                    <label key={p.id_permissao} className="permissão">
                      <input
                        type="checkbox"
                        disabled={!podeEditar}
                        checked={marcadas.has(p.id_permissao)}
                        onChange={() => alternar(p.id_permissao)}
                      />
                      <span>
                        <strong>{p.nome}</strong>
                        <small>{p.descricao || p.código}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </Cartao>
            );
          })}
        </div>
      </div>
    </>
  );
}
