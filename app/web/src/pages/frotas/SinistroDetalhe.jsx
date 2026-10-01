/**
 * SinistroDetalhe.jsx - Um sinistro por inteiro.
 *
 * No mesmo desenho das fichas do checklist e da OS: faixa de identificacao no
 * topo, o fato e os danos a esquerda, providencias, observacoes e historico
 * numa coluna a direita. Editar abre o mesmo pop-up da lista.
 */
import { useEffect, useState } from "react";
import { useOutletContext, useParams, useNavigate } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import Selo from "../../components/Selo.jsx";
import RegistrarSinistro from "../../components/RegistrarSinistro.jsx";
import { api } from "../../lib/api.js";
import { data, hora, rotulo, simNao } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";
import { TOM_TIPO_SINISTRO } from "./Sinistros.jsx";

function Campo({ icone, rotulo: texto, children }) {
  return (
    <div className="checklist-faixa__campo">
      <span className="checklist-faixa__rotulo">
        <Icone nome={icone} tamanho={14} />
        {texto}
      </span>
      <div className="checklist-faixa__valor">{children}</div>
    </div>
  );
}

function Dados({ linhas }) {
  return (
    <dl className="lista-dados">
      {linhas.map(([r, v]) => (
        <div className="lista-dados__linha" key={r}>
          <dt>{r}</dt>
          <dd>{v === null || v === undefined || v === "" ? "—" : v}</dd>
        </div>
      ))}
    </dl>
  );
}

const Texto = ({ children, vazio }) => (
  <p className="texto-corrido texto-quebra">{children || vazio}</p>
);

export default function SinistroDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const { podeVer } = useSessao();
  const [sinistro, setSinistro] = useState(null);
  const [erro, setErro] = useState("");
  const [recarga, setRecarga] = useState(0);
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    definirCabecalho({ titulo: "", legenda: "" });
  }, [definirCabecalho]);

  useEffect(() => {
    api(`/frotas/sinistros/${id}`).then(setSinistro).catch((e) => setErro(e.message));
  }, [id, recarga]);

  if (erro) return <Cartao><div className="vazio">{erro}</div></Cartao>;
  if (!sinistro) return <div className="carregando">Carregando o sinistro...</div>;

  const s = sinistro;
  const podeGerenciar = podeVer("FROTAS_GERENCIAR_SINISTROS");
  const historico = [
    { tom: "vermelho", titulo: "Sinistro ocorrido", quando: `${data(s.data)} ${hora(s.hora)}`, quem: s.condutor },
    { tom: "azul", titulo: "Registrado no sistema", quem: s.responsavel },
    s.id_os && { tom: "amarelo", titulo: "OS de manutenção vinculada" },
    ["RESOLVIDO", "ENCERRADO"].includes(s.status) && {
      tom: "verde", titulo: s.status === "RESOLVIDO" ? "Sinistro resolvido" : "Sinistro encerrado",
    },
  ].filter(Boolean);

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <Trilha
            itens={[
              { rotulo: "Frotas" },
              { rotulo: "Sinistros", para: "/frotas/sinistros" },
              { rotulo: "Detalhes do sinistro" },
            ]}
          />
          <h1>Detalhes do sinistro</h1>
          <p>Consulte o que aconteceu, os danos no veículo e as providências tomadas.</p>
        </div>
        <div className="cabecalho-pagina__acoes">
          <button className="botao" onClick={() => navegar("/frotas/sinistros")}>
            <Icone nome="seta-esquerda" tamanho={15} /> Voltar
          </button>
          {podeGerenciar && (
            <button className="botao" onClick={() => setEditando(true)}>
              <Icone nome="editar" tamanho={15} /> Editar
            </button>
          )}
        </div>
      </div>

      <div className="checklist-faixa">
        <Campo icone="kpi-car" rotulo="Veículo">
          <strong className="checklist-faixa__destaque">{s.placa}</strong>
          <span className="checklist-faixa__apoio">{s.marca} {s.modelo}</span>
        </Campo>
        <Campo icone="documento" rotulo="Nº do sinistro">
          <strong>{s.numero || "—"}</strong>
        </Campo>
        <Campo icone="sinistro" rotulo="Tipo">
          <Selo texto={rotulo("tipoSinistro", s.tipo)} tom={TOM_TIPO_SINISTRO[s.tipo]} />
        </Campo>
        <Campo icone="calendar" rotulo="Data e hora">
          <strong>{data(s.data)}</strong>
          <span className="checklist-faixa__apoio">{hora(s.hora)}</span>
        </Campo>
        <Campo icone="check" rotulo="Situação">
          <Selo valor={s.status} />
        </Campo>
      </div>

      <div className="checklist-corpo">
        <div className="checklist-corpo__coluna">
          <Cartao titulo="Dados do sinistro">
            <Dados
              linhas={[
                ["Local", s.local],
                ["Condutor no momento", s.condutor],
                ["Registrado por", s.responsavel],
                ["Houve terceiros envolvidos", simNao(s.houve_terceiros)],
                ["Número do B.O.", s.bo],
                [
                  "OS de manutenção",
                  s.id_os ? (
                    <button type="button" className="os-ligadas__link"
                            onClick={() => navegar(`/frotas/manutencoes/${s.id_os}`)}>
                      Ver OS
                    </button>
                  ) : null,
                ],
              ]}
            />
          </Cartao>

          <Cartao titulo="Descrição do sinistro">
            <Texto vazio="Sem descrição.">{s.descricao}</Texto>
          </Cartao>

          <Cartao titulo="Danos e avaliação inicial">
            <Dados
              linhas={[
                ["Parte do veículo danificada", s.parte_danificada ? rotulo("parteSinistro", s.parte_danificada) : null],
                ["Gravidade dos danos", s.gravidade_danos ? rotulo("gravidadeDanos", s.gravidade_danos) : null],
              ]}
            />
            <div className="ficha-textos">
              <h3 className="ficha-textos__titulo">Descrição dos danos</h3>
              <Texto vazio="Nenhuma descrição dos danos.">{s.descricao_danos}</Texto>
            </div>
          </Cartao>
        </div>

        <div className="checklist-corpo__coluna checklist-corpo__coluna--lado">
          <Cartao titulo="Providências tomadas">
            <Texto vazio="Nenhuma providência registrada.">{s.providencias}</Texto>
          </Cartao>
          <Cartao titulo="Observações">
            <Texto vazio="Nenhuma observação registrada.">{s.observacoes}</Texto>
          </Cartao>
          <Cartao titulo="Histórico do sinistro">
            <ol className="linha-tempo linha-tempo--compacta">
              {historico.map((h) => (
                <li key={h.titulo}>
                  <span className="linha-tempo__ponto" data-tom={h.tom} />
                  <div>
                    <strong>{h.titulo}</strong>
                    {(h.quando || h.quem) && (
                      <span>{[h.quando, h.quem].filter(Boolean).join(" - ")}</span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Cartao>
        </div>
      </div>

      {editando && (
        <RegistrarSinistro sinistro={s} aoFechar={() => setEditando(false)}
                           aoSalvar={() => setRecarga((n) => n + 1)} />
      )}
    </>
  );
}
