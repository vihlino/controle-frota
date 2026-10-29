/**
 * PontuacaoItemDetalhe.jsx - Detalhes do item de pontuacao (desenho do Cesar,
 * 29/10). O item, o valor em pontos, a documentacao (com copiar), a situacao,
 * as datas e o uso no sistema (ocorrencias, lancamentos e a viatura em que
 * mais apareceu). Editar abre o pop-up da lista; Excluir pede senha e motivo.
 */
import { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import { useConfirmacaoSenha } from "../../components/ConfirmarSenha.jsx";
import { api } from "../../lib/api.js";
import { dataHora, numero } from "../../lib/formato.js";

const BASE = "/fiscalizacao/pontuacao/itens";
const vazio = (v) => (v === null || v === undefined || v === "" ? "—" : v);

export default function PontuacaoItemDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const [item, setItem] = useState(null);
  const [uso, setUso] = useState(null);
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);
  const { pedirExclusao, elemento: modalSenha } = useConfirmacaoSenha();

  useEffect(() => { definirCabecalho({ titulo: "", legenda: "" }); }, [definirCabecalho]);
  useEffect(() => {
    api(`/fiscalizacao/pontuacao/${id}`).then(setItem).catch((e) => setErro(e.message));
    api(`/fiscalizacao/pontuacao/${id}/uso`).then(setUso).catch(() => setUso({}));
  }, [id]);

  async function excluir() {
    const r = await pedirExclusao({ titulo: "Excluir item de pontuação", oQue: `o item ${item.codigo}` });
    if (!r.ok) return;
    try {
      await api(`/fiscalizacao/pontuacao/${id}`, { method: "DELETE", body: { justificativa: r.justificativa } });
      navegar(BASE);
    } catch (e) {
      alert(e.message);
    }
  }
  function copiar() {
    navigator.clipboard?.writeText(item.descricao || "").then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1500); }).catch(() => {});
  }

  if (erro) return <Cartao><div className="vazio">{erro}</div></Cartao>;
  if (!item) return <div className="carregando">Carregando o item...</div>;

  return (
    <div className="ficha">
      <div className="cabecalho-pagina vd-cabecalho">
        <div>
          <Trilha itens={[{ rotulo: "Fiscalização" }, { rotulo: "Pontuação", para: "/fiscalizacao/pontuacao" },
            { rotulo: "Itens", para: BASE }, { rotulo: "Detalhes do item" }]} />
          <h1 className="pi-h1">Detalhes do item de pontuação</h1>
        </div>
        <div className="cabecalho-pagina__acoes">
          <button className="botao" onClick={() => navegar(BASE)}><Icone nome="seta-esquerda" tamanho={15} /> Voltar</button>
          <button className="botao" onClick={() => navegar(`${BASE}?editar=${id}`)}><Icone nome="editar" tamanho={15} /> Editar</button>
          <button className="botao pi-excluir" onClick={excluir}><Icone nome="lixo" tamanho={15} monocromatico /> Excluir</button>
        </div>
      </div>

      <div className="vd-corpo">
        <div className="vd-corpo__principal">
          <section className="cartao pi-topo">
            <span className="pi-topo__icone"><Icone nome="arquivo-texto" tamanho={34} monocromatico /></span>
            <div className="pi-topo__textos">
              <h2>{item.nome}</h2>
              <p>Item de pontuação utilizado nas ocorrências de trânsito.</p>
            </div>
            <div className="pi-valor">
              <span className="pi-valor__estrela">★</span>
              <span><small>Valor em pontos</small><strong>{numero(item.valor_pontos)}</strong></span>
            </div>
          </section>

          <section className="cartao pi-secao">
            <h3 className="pi-secao__titulo">Informações gerais</h3>
            <div className="pi-campos">
              <div><span><Icone nome="arquivo-texto" tamanho={18} /> Código</span><strong>{item.codigo}</strong></div>
              <div><span><Icone nome="camadas" tamanho={18} /> Nome do item</span><strong>{item.nome}</strong></div>
              <div><span><Icone nome="chart-line" tamanho={18} /> Valor em pontos</span><strong>{numero(item.valor_pontos)}</strong></div>
            </div>
          </section>

          <section className="cartao pi-secao">
            <h3 className="pi-secao__titulo">Documentação do item</h3>
            <div className="pi-doc">
              <span className="pi-doc__icone"><Icone nome="documento" tamanho={22} /></span>
              <p>{item.descricao || "Nenhuma documentação informada."}</p>
              {item.descricao && (
                <button type="button" className="pi-copiar" onClick={copiar} title="Copiar" aria-label="Copiar a documentação">
                  {copiado ? "✓" : <Icone nome="copiar" tamanho={18} />}
                </button>
              )}
            </div>
          </section>
        </div>

        <div className="vd-corpo__lado">
          <section className="cartao pi-secao">
            <h3 className="pi-secao__titulo">Situação</h3>
            <div className="pi-situacao" data-ativo={item.ativo ? "sim" : undefined}>
              <span className="pi-situacao__ponto" /> {item.ativo ? "Ativo" : "Inativo"}
            </div>
            <p className="pi-nota">{item.ativo
              ? "Este item está disponível para uso nas ocorrências e na pontuação."
              : "Este item não aparece para seleção nas ocorrências."}</p>
          </section>

          <section className="cartao pi-secao">
            <h3 className="pi-secao__titulo">Informações adicionais</h3>
            <ul className="pi-lista">
              <li><span className="pi-lista__icone"><Icone nome="calendar" tamanho={20} /></span>
                <span><small>Data de criação</small><strong>{item.data_criacao ? dataHora(item.data_criacao) : "—"}</strong></span></li>
              <li><span className="pi-lista__icone"><Icone nome="editar" tamanho={20} /></span>
                <span><small>Última atualização</small><strong>{(uso?.ultima_alteracao || item.atualizado_em) ? dataHora(uso?.ultima_alteracao || item.atualizado_em) : "—"}</strong></span></li>
            </ul>
          </section>

          <section className="cartao pi-secao">
            <h3 className="pi-secao__titulo">Uso no sistema</h3>
            <ul className="pi-uso">
              <li><Icone nome="fisc-ocorrencias" tamanho={20} /><span>Total de ocorrências</span><strong>{uso ? numero(uso.ocorrencias || 0) : "…"}</strong></li>
              <li><Icone nome="checklist" tamanho={20} /><span>Lançamentos</span><strong>{uso ? numero(uso.lancamentos || 0) : "…"}</strong></li>
              <li><Icone nome="kpi-car" tamanho={20} /><span>Viatura mais frequente</span><strong>{uso ? vazio(uso.viatura_frequente) : "…"}</strong></li>
              <li><Icone nome="historico" tamanho={20} /><span>Último uso</span><strong>{uso?.ultimo_uso ? dataHora(uso.ultimo_uso) : "—"}</strong></li>
              <li><Icone nome="check" tamanho={20} /><span>Disponível para seleção</span><strong className={item.ativo ? "pi-sim" : "pi-nao"}>{item.ativo ? "Sim" : "Não"}</strong></li>
            </ul>
          </section>
        </div>
      </div>
      {modalSenha}
    </div>
  );
}
