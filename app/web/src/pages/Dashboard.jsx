/**
 * Dashboard.jsx - A tela inicial.
 *
 * Existe UM Dashboard. O que aparece dentro dele depende das permissões: o
 * Administrador ve as tres abas (Frotas, Fiscalização, TI e Sistema); um gestor
 * de frotas ve so a dele, e sem aba nenhuma, porque não há o que alternar.
 *
 * Os paineis de cada aba estao em pages/painel/.
 */
import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import Cartao from "../components/Cartao.jsx";
import Icone from "../components/Icone.jsx";
import Kpi from "../components/Kpi.jsx";
import Selo from "../components/Selo.jsx";
import { api } from "../lib/api.js";
import { useSessao } from "../lib/sessao.jsx";
import { data, dataPorExtenso, hora, numero, porcentagem, saudacao } from "../lib/formato.js";
import PainelFrotas from "./painel/PainelFrotas.jsx";
import PainelFiscalizacao from "./painel/PainelFiscalizacao.jsx";
import PainelTi from "./painel/PainelTi.jsx";

// Um Dashboard so. Quais paineis aparecem depende das permissões do usuario:
// o Administrador recebe os tres, o gestor de frotas so o de Frotas.
export default function Dashboard() {
  const { definirCabecalho } = useOutletContext();
  const { usuario } = useSessao();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState(null);

  useEffect(() => {
    const primeiroNome = (usuario?.nome || "").split(" ")[0];
    definirCabecalho({
      titulo: `${saudacao()}, ${primeiroNome}!`,
      legenda: dataPorExtenso(),
    });
  }, [definirCabecalho, usuário]);

  useEffect(() => {
    api("/dashboard")
      .then((r) => {
        setDados(r);
        setAba(Object.keys(r)[0] || null);
      })
      .catch((e) => setErro(e.message));
  }, []);

  if (erro) return <Cartao><div className="vazio">{erro}</div></Cartao>;
  if (!dados) return <div className="carregando">Carregando o painel...</div>;

  const paineis = [
    { chave: "frotas", rotulo: "Frotas", icone: "nav-frotas" },
    { chave: "fiscalização", rotulo: "Fiscalização", icone: "nav-fiscalização" },
    { chave: "ti", rotulo: "TI e Sistema", icone: "nav-administracao" },
  ].filter((p) => dados[p.chave]);

  if (!paineis.length) {
    return (
      <Cartao>
        <div className="vazio">
          Seu perfil ainda não tem acesso a nenhum painel. Procure a administração.
        </div>
      </Cartao>
    );
  }

  return (
    <>
      {paineis.length > 1 && (
        <div className="abas">
          {paineis.map((p) => (
            <button
              key={p.chave}
              className="aba"
              data-ativa={aba === p.chave}
              onClick={() => setAba(p.chave)}
            >
              <Icone nome={p.icone} tamanho={18} />
              {p.rotulo}
            </button>
          ))}
        </div>
      )}

      {aba === "frotas" && <PainelFrotas dados={dados.frotas} />}
      {aba === "fiscalização" && <PainelFiscalizacao dados={dados.fiscalização} />}
      {aba === "ti" && <PainelTi dados={dados.ti} />}
    </>
  );
}
