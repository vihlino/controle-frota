/**
 * ChecklistDetalhe.jsx - Um checklist por inteiro, do jeito que o gestor le.
 *
 * A tela tem DUAS abas, saida e entrada, porque sao dois momentos do mesmo
 * registro: o mesmo veiculo, o mesmo condutor, conferidos em horas diferentes.
 * Mostrar os dois lado a lado dobrava a tela e obrigava a comparar de olho.
 *
 * O que NAO esta aqui, de proposito:
 *   - resumo com contagem de itens. Sao quatro itens; o "3 de 4 presentes"
 *     ocupava um cartao inteiro para dizer o que a propria lista ja diz.
 *   - dados da leitura do QR (aparelho, versao do app, coordenada). E registro
 *     tecnico, nao ajuda quem confere o veiculo.
 *
 * O que e novo:
 *   - MANUTENCAO: os chamados que o condutor abriu durante o checklist. Eles
 *     nascem no patio, pelo QR Code, e este e o unico lugar que mostra a
 *     ligacao entre "o freio estava falhando" e o registro daquela saida.
 *   - FOTOS: as imagens anexadas pelo condutor, que ate agora ficavam no banco
 *     sem tela nenhuma para exibi-las.
 */
import { useEffect, useState } from "react";
import { useOutletContext, useParams, useNavigate, Link } from "react-router-dom";
import Cartao from "../../components/Cartao.jsx";
import Icone from "../../components/Icone.jsx";
import Trilha from "../../components/Trilha.jsx";
import Selo from "../../components/Selo.jsx";
import { api, apiArquivo } from "../../lib/api.js";
import { data, dataHora, hora, numero, rotulo } from "../../lib/formato.js";

const EQUIPAMENTOS_ORDEM = ["MACACO", "ESTEPE", "TRIANGULO", "CHAVE_RODA"];

// Rotulo + icone de cada campo da faixa de identificacao. O icone nao decora:
// e o que deixa a faixa ser lida em diagonal, sem ler os rotulos um a um.
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

export default function ChecklistDetalhe() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { definirCabecalho } = useOutletContext();
  const [checklist, setChecklist] = useState(null);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState("SAIDA");
  const [fotos, setFotos] = useState([]);

  useEffect(() => {
    definirCabecalho({ titulo: "", legenda: "" });
  }, [definirCabecalho]);

  useEffect(() => {
    api(`/frotas/checklists/${id}`).then(setChecklist).catch((e) => setErro(e.message));
  }, [id]);

  /**
   * As fotos vem em duas etapas: primeiro a lista (id, momento, peso), depois
   * o binario de cada uma. A rota do binario exige token no cabecalho, entao
   * nao da para apontar o <img> direto para ela - apiArquivo baixa e devolve
   * um endereco de memoria.
   */
  useEffect(() => {
    if (!checklist) return;
    let vivo = true;
    const enderecos = [];

    api(`/qrcode/fotos/checklist/${id}`)
      .then(async (lista) => {
        const carregadas = [];
        for (const foto of lista) {
          try {
            const url = await apiArquivo(`/qrcode/foto/arquivo/${foto.id_foto}`);
            enderecos.push(url);
            carregadas.push({ ...foto, url });
          } catch {
            // Uma foto que nao carrega nao pode derrubar as outras.
          }
        }
        if (vivo) setFotos(carregadas);
      })
      .catch(() => setFotos([]));

    return () => {
      vivo = false;
      enderecos.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [checklist, id]);

  if (erro) return <Cartao><div className="vazio">{erro}</div></Cartao>;
  if (!checklist) return <div className="carregando">Carregando o checklist...</div>;

  const naSaida = aba === "SAIDA";
  const semChegada = checklist.status === "ABERTO";

  // Os equipamentos guardam o momento em que foram conferidos. Registros
  // antigos, anteriores a conferencia na chegada, so tem os da saida - por
  // isso a aba de entrada pode aparecer vazia sem que nada esteja errado.
  const itens = (checklist.equipamentos || [])
    .filter((e) => (e.momento || "SAIDA") === aba)
    .sort(
      (a, b) =>
        EQUIPAMENTOS_ORDEM.indexOf(a.equipamento) - EQUIPAMENTOS_ORDEM.indexOf(b.equipamento)
    );

  const chamados = checklist.chamados || [];
  const fotosDaAba = fotos.filter((f) => (f.momento || "SAIDA") === aba);

  const observacoes = naSaida ? checklist.observacoes : checklist.observacoes_chegada;

  // "Enviado em" e o instante em que o registro chegou ao servidor; "registro
  // do condutor" e a data e a hora que ele declarou. A distancia entre os dois
  // e exatamente o que se quer fiscalizar.
  const enviadoEm = naSaida ? checklist.criado_em : checklist.data_finalizacao;
  const declarado = naSaida
    ? `${data(checklist.data_abertura)} às ${hora(checklist.hora_saida)}`
    : checklist.data_devolucao
      ? `${data(checklist.data_devolucao)} às ${hora(checklist.hora_chegada)}`
      : "—";

  const dadosDoMomento = naSaida
    ? [
        ["Data e hora de saída", declarado],
        ["KM de saída", `${numero(checklist.odometro_saida)} km`],
        ["Percurso / atividade", checklist.percurso || "—"],
      ]
    : [
        ["Data e hora de chegada", declarado],
        [
          "KM de chegada",
          checklist.odometro_chegada === null ? "—" : `${numero(checklist.odometro_chegada)} km`,
        ],
        ["KM rodado", checklist.km_rodado === null ? "—" : `${numero(checklist.km_rodado)} km`],
        ["Percurso / atividade", checklist.percurso || "—"],
      ];

  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <Trilha
            itens={[
              { rotulo: "Frotas" },
              { rotulo: "Checklists", para: "/frotas/checklists" },
              { rotulo: "Detalhes do Checklist" },
            ]}
          />
          <h1>Detalhes do Checklist do Veículo</h1>
          <p>Consulte as informações completas do checklist de saída e de entrada do veículo.</p>
        </div>
        <div className="cabecalho-pagina__acoes">
          <Link className="botao" to={`/frotas/veiculos/${checklist.id_veiculo}`}>
            Ver veículo
          </Link>
          <button className="botao" onClick={() => navegar("/frotas/checklists")}>
            <Icone nome="seta-esquerda" tamanho={15} /> Voltar
          </button>
        </div>
      </div>

      {/* Faixa de identificacao. Setor, ano/modelo e a placa repetida sairam:
          a placa ja e o destaque do primeiro campo, e o resto e cadastro do
          veiculo - quem quer isso abre a tela do veiculo, que fica a um clique
          daqui. */}
      <div className="checklist-faixa">
        <Campo icone="fisc-viatura" rotulo="Veículo">
          <strong className="checklist-faixa__destaque">{checklist.placa}</strong>
          <span className="checklist-faixa__apoio">
            {checklist.marca} {checklist.modelo}
            {checklist.cor ? ` · ${checklist.cor}` : ""}
          </span>
        </Campo>

        <Campo icone="arrow-up" rotulo="Enviado em">{dataHora(enviadoEm)}</Campo>

        <Campo icone="calendar" rotulo="Registro do condutor">{declarado}</Campo>

        <Campo icone="user" rotulo="Responsável">
          <strong>{checklist.condutor}</strong>
          <span className="checklist-faixa__apoio">Matrícula {checklist.matricula}</span>
        </Campo>

        <Campo icone="check" rotulo="Status do checklist">
          <Selo valor={checklist.status} />
        </Campo>
      </div>

      {/* Abas: saida e entrada sao o MESMO registro em dois momentos. */}
      <div className="abas" role="tablist">
        <button type="button" role="tab" className="aba"
                data-ativa={naSaida} aria-selected={naSaida}
                onClick={() => setAba("SAIDA")}>
          Checklist de Saída
        </button>
        <button type="button" role="tab" className="aba"
                data-ativa={!naSaida} aria-selected={!naSaida}
                onClick={() => setAba("CHEGADA")}>
          Checklist de Chegada
        </button>
      </div>

      {!naSaida && semChegada ? (
        <Cartao>
          <div className="vazio">
            Este checklist ainda está aberto. A chegada é registrada pela leitura do
            QR Code do veículo.
          </div>
        </Cartao>
      ) : (
        <div className="checklist-corpo">
          <div className="checklist-corpo__coluna">
            <Cartao titulo={`Dados da ${naSaida ? "saída" : "chegada"}`}>
              <dl className="lista-dados">
                {dadosDoMomento.map(([r, v]) => (
                  <div className="lista-dados__linha" key={r}>
                    <dt>{r}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </Cartao>

            <Cartao
              titulo={`Itens do Checklist de ${naSaida ? "Saída" : "Chegada"}`}
              acao={
                <div className="checklist-legenda">
                  <span data-tom="verde">Presente</span>
                  <span data-tom="vermelho">Ausente</span>
                </div>
              }
            >
              {itens.length === 0 ? (
                <div className="vazio">Nenhum equipamento conferido neste momento.</div>
              ) : (
                <table className="tabela checklist-itens">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Situação</th>
                      <th>Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((e, i) => (
                      <tr key={e.equipamento}>
                        <td>
                          <span className="checklist-itens__ordem">{i + 1}</span>
                          {rotulo("equipamento", e.equipamento)}
                        </td>
                        <td>
                          <Selo
                            texto={e.conforme ? "Presente" : "Ausente"}
                            tom={e.conforme ? "verde" : "vermelho"}
                          />
                        </td>
                        <td className="checklist-itens__obs">{e.observacao || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Cartao>

            {/* MANUTENCAO: os chamados abertos pelo condutor no checklist. */}
            <Cartao
              titulo="Manutenção"
              acao={
                /* O link leva para Manutencoes JA FILTRADO neste veiculo: o
                   gestor que abre este cartao quer ver o historico da placa,
                   nao a fila inteira da frota. */
                <Link
                  className="cartao__acao"
                  to={`/frotas/manutencoes?veiculo=${checklist.id_veiculo}`}
                >
                  Ver todas as OS <Icone nome="seta-direita" tamanho={14} />
                </Link>
              }
            >
              <p className="texto-apoio">
                Chamados abertos pelo condutor durante este checklist.
              </p>

              {chamados.length === 0 ? (
                <div className="vazio">
                  Nenhum chamado de manutenção foi aberto neste checklist.
                </div>
              ) : (
                <div className="chamados">
                  {chamados.map((c) => (
                    <article className="chamado" key={c.id_os}>
                      <header className="chamado__topo">
                        <h3>{rotulo("parteVeiculo", c.parte_veiculo)}</h3>
                        <Selo valor={c.status} />
                      </header>
                      <p className="chamado__descricao">{c.descricao}</p>
                      <footer className="chamado__meta">
                        <span className="chamado__numero">
                          {c.numero ? `OS ${c.numero}` : `OS ${c.id_os}`}
                        </span>
                        <span>Aberto em {dataHora(c.data_abertura)}</span>
                        <span>{rotulo("momentoChecklist", c.momento)}</span>
                        <span>Prioridade {rotulo("gravidade", c.gravidade).toLowerCase()}</span>
                      </footer>
                    </article>
                  ))}
                </div>
              )}
            </Cartao>
          </div>

          <div className="checklist-corpo__coluna checklist-corpo__coluna--lado">
            <Cartao
              titulo="Fotos do checklist"
              acao={<span className="texto-apoio">{fotosDaAba.length} fotos</span>}
            >
              {fotosDaAba.length === 0 ? (
                <div className="vazio">Nenhuma foto anexada neste momento.</div>
              ) : (
                <div className="checklist-fotos">
                  {fotosDaAba.map((f) => (
                    <a key={f.id_foto} href={f.url} target="_blank" rel="noreferrer">
                      <img src={f.url} alt={`Foto do checklist ${f.id_foto}`} />
                    </a>
                  ))}
                </div>
              )}
            </Cartao>

            <Cartao titulo="Observações">
              <p className="texto-corrido">
                {observacoes || "Nenhuma observação registrada neste momento."}
              </p>
              <p className="texto-apoio checklist-assinatura">
                <Icone nome="user" tamanho={14} />
                Registrado por {checklist.condutor} na {naSaida ? "saída" : "chegada"}
              </p>
            </Cartao>
          </div>
        </div>
      )}
    </>
  );
}
