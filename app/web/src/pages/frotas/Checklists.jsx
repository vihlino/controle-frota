/**
 * Checklists.jsx - Os registros de saida e chegada da frota.
 *
 * NAO tem botao de "novo checklist", de proposito: o registro sempre nasce da
 * leitura do QR Code do veículo.
 *
 * A coluna de equipamentos mostra as quatro iniciais de forma compacta; o item
 * que o condutor marcou como ausente fica vermelho.
 */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PaginaLista from "../../components/PaginaLista.jsx";
import Selo from "../../components/Selo.jsx";
import Acoes from "../../components/Acoes.jsx";
import Icone from "../../components/Icone.jsx";
import Modal from "../../components/Modal.jsx";
import { useConfirmacaoSenha } from "../../components/ConfirmarSenha.jsx";
import { Texto, Selecao, Area, Periodo } from "../../components/Campos.jsx";
import { useLista } from "../../components/useLista.js";
import { api, apiArquivo } from "../../lib/api.js";
import { dataHora, hora, numero, rotulo } from "../../lib/formato.js";
import { useSessao } from "../../lib/sessao.jsx";

const ORDEM_EQUIPAMENTOS = ["MACACO", "ESTEPE", "TRIANGULO", "CHAVE_RODA"];

/*
 * O <input type="time"> e exigente: ele aceita "14:30" ou "14:30:00" e RECUSA
 * qualquer outra coisa - inclusive esvaziando o campo em silencio, sem erro
 * nenhum no console.
 *
 * O banco grava a hora de saida com CURRENT_TIME, que traz microssegundos:
 * "14:30:00.123456". Era exatamente esse valor que chegava ao campo, e por
 * isso a hora aparecia em branco na janela de correcao enquanto a tela de
 * detalhes a mostrava certa - a tela de detalhes corta a string antes de
 * mostrar; o campo nativo nao perdoa.
 */
function paraHora(valor) {
  return valor ? String(valor).slice(0, 5) : "";
}

/* Mesma historia para a data: o campo quer "aaaa-mm-dd" e nada mais. */
function paraData(valor) {
  return valor ? String(valor).slice(0, 10) : "";
}

// Mostra os quatro equipamentos obrigatorios de forma compacta. O que o
// condutor marcou como ausente fica vermelho.
function Equipamentos({ itens }) {
  const porNome = Object.fromEntries((itens || []).map((e) => [e.equipamento, e]));
  return (
    <span className="equipamentos">
      {ORDEM_EQUIPAMENTOS.map((código) => {
        const item = porNome[código];
        const ausente = item && !item.conforme;
        return (
          <abbr
            key={código}
            className="equipamentos__item"
            data-ausente={ausente ? "sim" : undefined}
            title={`${rotulo("equipamento", código)}: ${
              !item ? "nao informado" : item.conforme ? "presente" : "ausente"
            }`}
          >
            {rotulo("equipamento", código)[0]}
          </abbr>
        );
      })}
    </span>
  );
}

export default function Checklists() {
  const navegar = useNavigate();
  const [parâmetros] = useSearchParams();
  const lista = useLista("frotas/checklists", {
    busca: "",
    veiculo: parâmetros.get("veiculo") || "",
    status: "",
    // O painel manda "Movimentacoes de hoje" para ca ja com o dia preenchido.
    dataDe: parâmetros.get("dataDe") || "",
    dataAte: parâmetros.get("dataAte") || "",
  });
  const [veículos, setVeículos] = useState([]);

  /*
   * CORRIGIR UM CHECKLIST JA ENVIADO
   *
   * O registro nasce no celular do condutor e ninguem o digita duas vezes:
   * quando ele erra o odometro ou informa a hora de memoria no fim do turno,
   * a correcao tem de acontecer aqui.
   *
   * Tres travas, e nenhuma e enfeite:
   *   - a permissao e PROPRIA (FROTAS_EDITAR_CHECKLIST, migracao 019): quem
   *     cadastra veiculo nao ganha de brinde o poder de reescrever o
   *     historico da frota;
   *   - a senha e pedida antes de gravar, como no resto do sistema;
   *   - nao existe excluir, e nao existe criar. Checklist errado se corrige;
   *     apagado, ele tiraria do historico a prova de que o veiculo saiu, e
   *     criado a mao seria uma saida que nunca aconteceu.
   *
   * A API registra a alteracao na auditoria com o antes e o depois.
   */
  const { podeVer } = useSessao();
  const podeEditar = podeVer("FROTAS_EDITAR_CHECKLIST");
  const { pedirSenha, elemento: modalSenha } = useConfirmacaoSenha();
  const [editando, setEditando] = useState(null);
  const [formulario, setFormulario] = useState({});
  const [abaForm, setAbaForm] = useState("SAIDA");
  const [fotosForm, setFotosForm] = useState([]);
  const [erroForm, setErroForm] = useState("");
  const [salvando, setSalvando] = useState(false);

  /*
   * A JANELA DE CORRECAO IMITA O CHECKLIST DO CONDUTOR
   *
   * Duas abas (saida e chegada), os dados do veiculo e do condutor no topo, os
   * equipamentos item por item e as fotos. Quem corrige esta conferindo o
   * registro contra a realidade - e faz isso comparando com o que o condutor
   * viu na tela dele. Um formulario com nomes de coluna do banco obrigaria a
   * traducao mental a cada campo.
   *
   * O que NAO se edita aparece, mas em texto: veiculo, condutor e matricula
   * sao de OUTROS cadastros. Trocar o condutor de um checklist nao seria
   * corrigir um erro de digitacao - seria dizer que outra pessoa dirigiu.
   */
  function abrirEdicao(c) {
    // Os quatro equipamentos obrigatorios existem sempre, mesmo que o condutor
    // nao tenha conferido naquele momento: um item que nunca foi tocado entra
    // como presente, que e o estado normal do veiculo.
    const porMomento = (momento) =>
      ORDEM_EQUIPAMENTOS.map((eq) => {
        const gravado = (c.equipamentos || []).find(
          (e) => e.equipamento === eq && (e.momento || "SAIDA") === momento
        );
        return {
          equipamento: eq,
          conforme: gravado ? gravado.conforme : true,
          observacao: gravado?.observacao || "",
        };
      });

    setFormulario({
      // Somente leitura, para a janela mostrar de quem e o registro.
      placa: c.placa, marca: c.marca, modelo: c.modelo,
      condutor: c.condutor, matricula: c.matricula,
      criado_em: c.criado_em, data_finalizacao: c.data_finalizacao,
      km_rodado: c.km_rodado,
      // Editaveis.
      data_abertura: paraData(c.data_abertura),
      hora_saida: paraHora(c.hora_saida),
      odometro_saida: c.odometro_saida ?? "",
      data_devolucao: paraData(c.data_devolucao),
      hora_chegada: paraHora(c.hora_chegada),
      odometro_chegada: c.odometro_chegada ?? "",
      percurso: c.percurso || "",
      status: c.status || "ABERTO",
      observacoes: c.observacoes || "",
      observacoes_chegada: c.observacoes_chegada || "",
      eqSaida: porMomento("SAIDA"),
      eqChegada: porMomento("CHEGADA"),
    });
    setAbaForm("SAIDA");
    setFotosForm([]);
    setErroForm("");
    setEditando(c.id_checklist);
  }

  /*
   * As fotos vem em duas etapas, como na tela de detalhes: a lista primeiro, o
   * arquivo depois. Elas aparecem para CONFERIR - o que o condutor fotografou
   * e a prova do estado do veiculo, e nao um campo que a gestao reescreve.
   */
  useEffect(() => {
    if (!editando) return;
    let vivo = true;
    api(`/qrcode/fotos/checklist/${editando}`)
      .then(async (lista) => {
        const carregadas = [];
        for (const foto of lista) {
          try {
            const url = await apiArquivo(`/qrcode/foto/arquivo/${foto.id_foto}`);
            if (!vivo) return;
            carregadas.push({ ...foto, url });
          } catch {
            // Uma foto que nao carrega nao pode derrubar as outras.
          }
        }
        if (vivo) setFotosForm(carregadas);
      })
      .catch(() => setFotosForm([]));
    return () => { vivo = false; };
  }, [editando]);

  const campo = (nome) => ({
    value: formulario[nome] ?? "",
    onChange: (e) => setFormulario((f) => ({ ...f, [nome]: e.target.value })),
  });

  const naSaidaForm = abaForm === "SAIDA";
  const chaveEq = naSaidaForm ? "eqSaida" : "eqChegada";

  function alterarEquipamento(indice, mudanca) {
    setFormulario((f) => ({
      ...f,
      [chaveEq]: f[chaveEq].map((item, i) => (i === indice ? { ...item, ...mudanca } : item)),
    }));
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErroForm("");
    try {
      /*
       * Senha e justificativa na MESMA caixa: e um so momento - assumir a
       * alteracao e dizer por que. A resposta vem como objeto porque foi
       * pedida com justificativa.
       */
      const resposta = await pedirSenha({
        titulo: "Salvar correção",
        aviso:
          "Confirme sua senha para corrigir este checklist. A alteração fica " +
          "registrada na auditoria com o valor anterior.",
        justificativa: true,
      });
      if (!resposta.ok) {
        setSalvando(false);
        return;
      }
      const justificativa = resposta.justificativa;
      await api(`/frotas/checklists/${editando}`, {
        method: "PUT",
        body: {
          justificativa,
          data_abertura: formulario.data_abertura,
          hora_saida: formulario.hora_saida,
          odometro_saida: Number(formulario.odometro_saida),
          data_devolucao: formulario.data_devolucao,
          hora_chegada: formulario.hora_chegada,
          // Campo vazio vai como null, e nao como 0: checklist sem chegada
          // ainda nao tem odometro, e zero seria um numero inventado.
          odometro_chegada:
            formulario.odometro_chegada === "" ? null : Number(formulario.odometro_chegada),
          percurso: formulario.percurso,
          status: formulario.status,
          observacoes: formulario.observacoes,
          observacoes_chegada: formulario.observacoes_chegada,
        },
      });

      // Os equipamentos vao em rota propria, uma chamada por momento: sao
      // linhas de outra tabela, e a API substitui as do momento em transacao.
      for (const [momento, chave] of [["SAIDA", "eqSaida"], ["CHEGADA", "eqChegada"]]) {
        await api(`/frotas/checklists/${editando}/equipamentos`, {
          method: "PUT",
          body: { momento, itens: formulario[chave], justificativa },
        });
      }

      setEditando(null);
      lista.recarregar();
    } catch (e) {
      setErroForm(e.message);
    } finally {
      setSalvando(false);
    }
  }

  /** Excluir exige senha e nao tem volta - por isso o aviso nomeia a placa. */
  async function excluir(c) {
    const confirmou = await pedirSenha({
      titulo: "Excluir checklist",
      aviso:
        `Esta ação não pode ser desfeita: o registro de saída do veículo ${c.placa} ` +
        `sai do histórico. Confirme sua senha para excluir.`,
      perigo: true,
    });
    if (!confirmou) return;
    try {
      await api(`/frotas/checklists/${c.id_checklist}`, { method: "DELETE" });
      lista.recarregar();
    } catch (e) {
      alert(e.message);
    }
  }

  useEffect(() => {
    api("/frotas/veiculos/opcoes").then(setVeículos).catch(() => {});
  }, []);

  const colunas = [
    {
      // "Enviado em" e o instante em que o condutor MANDOU o registro. Antes
      // esta coluna mostrava data_abertura, que e a data DECLARADA de saida -
      // duas coisas diferentes com o mesmo nome.
      chave: "criado_em", rotulo: "Enviado em", ordenavel: true,
      render: (c) => (
        <strong>{dataHora(c.criado_em)}</strong>
      ),
    },
    {
      chave: "placa", rotulo: "Placa / Veículo", ordenavel: true,
      render: (c) => (
        <span className="celula-dupla">
          <strong>{c.placa}</strong>
          <span>{`${c.marca} ${c.modelo}`}</span>
        </span>
      ),
    },
    { chave: "condutor", rotulo: "Condutor", ordenavel: true },
    {
      chave: "saida", rotulo: "Saida (hora / KM)",
      render: (c) => (
        <span className="celula-dupla">
          <strong>{hora(c.hora_saida)}</strong>
          <span>{numero(c.odometro_saida)} km</span>
        </span>
      ),
    },
    {
      chave: "chegada", rotulo: "Chegada (hora / KM)",
      render: (c) =>
        c.odometro_chegada === null ? (
          "-"
        ) : (
          <span className="celula-dupla">
            <strong>{hora(c.hora_chegada)}</strong>
            <span>{numero(c.odometro_chegada)} km</span>
          </span>
        ),
    },
    {
      // Quando a CHEGADA foi enviada. Comparado com a chegada declarada, e o
      // que mostra se o checklist foi fechado na hora ou dias depois.
      chave: "data_finalizacao", rotulo: "Fechado em", ordenavel: true,
      render: (c) =>
        !c.data_finalizacao ? (
          <span className="texto-fraco">Em aberto</span>
        ) : (
          <strong>{dataHora(c.data_finalizacao)}</strong>
        ),
    },
    {
      chave: "km_rodado", rotulo: "KM rodado", ordenavel: true,
      render: (c) => (c.km_rodado === null ? "-" : `${numero(c.km_rodado)} km`),
    },
    {
      chave: "equipamentos", rotulo: "Equipamentos",
      render: (c) => <Equipamentos itens={c.equipamentos} />,
    },
    { chave: "status", rotulo: "Situação", render: (c) => <Selo valor={c.status} /> },
    {
      chave: "ações", rotulo: "Ações",
      render: (c) => (
        <Acoes
          acoes={[
            {
              rotulo: "Visualizar", icone: "visualizar",
              aoClicar: () => navegar(`/frotas/checklists/${c.id_checklist}`),
            },
            ...(podeEditar
              ? [{ rotulo: "Editar", icone: "editar", aoClicar: () => abrirEdicao(c) }]
              : []),
            {
              rotulo: "Ver veículo", icone: "kpi-car",
              aoClicar: () => navegar(`/frotas/veiculos/${c.id_veiculo}`),
            },
            ...(podeEditar
              ? [{ rotulo: "Excluir", perigo: true, icone: "lixo",
                   aoClicar: () => excluir(c) }]
              : []),
          ]}
        />
      ),
    },
  ];

  return (
    <>
    <PaginaLista
      trilha={[{ rotulo: "Frotas" }, { rotulo: "Checklists" }]}
      titulo="Checklists"
      descricao="Checklists enviados pela frota. Novos registros nascem da leitura do QR Code do veículo."
      lista={lista}
      colunas={colunas}
      chaveDe={(c) => c.id_checklist}
      unidade="checklists"
      vazio="Nenhum checklist encontrado com esses filtros."
      filtros={
        <>
          <Texto
            rotulo="Buscar" id="busca" placeholder="Placa, condutor ou percurso"
            value={lista.filtros.busca}
            onChange={(e) => lista.alterarFiltro("busca", e.target.value)}
          />
          <Selecao
            rotulo="Veículo" id="veículo" vazio="Todos"
            opcoes={veículos.map((v) => ({ valor: v.id_veiculo, rotulo: `${v.placa} - ${v.modelo}` }))}
            value={lista.filtros.veiculo}
            onChange={(e) => lista.alterarFiltro("veiculo", e.target.value)}
          />
          <Selecao
            rotulo="Situação" id="status" vazio="Todas"
            opcoes={[
              { valor: "ABERTO", rotulo: "Em aberto" },
              { valor: "FINALIZADO", rotulo: "Finalizado" },
            ]}
            value={lista.filtros.status}
            onChange={(e) => lista.alterarFiltro("status", e.target.value)}
          />
          <Periodo id="periodo" de={lista.filtros.dataDe} ate={lista.filtros.dataAte}
                   aoMudarDe={(v) => lista.alterarFiltro("dataDe", v)}
                   aoMudarAte={(v) => lista.alterarFiltro("dataAte", v)} />
        </>
      }
    />

    {editando && (
      <Modal
        titulo="Corrigir checklist"
        legenda="A alteração fica registrada na auditoria, com o valor anterior."
        aoFechar={() => setEditando(null)}
        rodape={
          <>
            <button className="botao" onClick={() => setEditando(null)}>Cancelar</button>
            <button className="botao botao--primario" type="submit"
                    form="form-checklist" disabled={salvando}>
              <Icone nome="salvar" tamanho={15} />
              {salvando ? " Salvando..." : " Salvar"}
            </button>
          </>
        }
      >
        {erroForm && <div className="login__erro">{erroForm}</div>}

        {/* Veiculo e condutor: so leitura. Sao de outros cadastros, e trocar
            o condutor de um checklist nao seria corrigir digitacao - seria
            dizer que outra pessoa dirigiu. */}
        <div className="checklist-faixa checklist-faixa--modal">
          <div className="checklist-faixa__campo">
            <span className="checklist-faixa__rotulo">Veículo</span>
            <strong className="checklist-faixa__destaque">{formulario.placa}</strong>
            <span className="checklist-faixa__apoio">
              {formulario.marca} {formulario.modelo}
            </span>
          </div>
          <div className="checklist-faixa__campo">
            <span className="checklist-faixa__rotulo">Condutor</span>
            <span className="checklist-faixa__nome">{formulario.condutor}</span>
            <span className="checklist-faixa__apoio">Matrícula {formulario.matricula}</span>
          </div>
          <div className="checklist-faixa__campo">
            <span className="checklist-faixa__rotulo">Enviado em</span>
            <strong>{dataHora(formulario.criado_em)}</strong>
          </div>
        </div>

        {/* As mesmas duas abas da tela do condutor: saida e chegada sao o
            MESMO registro em dois momentos. */}
        <div className="abas" role="tablist">
          <button type="button" role="tab" className="aba"
                  data-ativa={naSaidaForm} aria-selected={naSaidaForm}
                  onClick={() => setAbaForm("SAIDA")}>
            Saída
          </button>
          <button type="button" role="tab" className="aba"
                  data-ativa={!naSaidaForm} aria-selected={!naSaidaForm}
                  onClick={() => setAbaForm("CHEGADA")}>
            Chegada
          </button>
        </div>

        <form id="form-checklist" className="formulario-grade formulario-grade--colunas"
              onSubmit={salvar}>
          {naSaidaForm ? (
            <>
              <h3 className="formulario__secao">Saída do veículo</h3>
              <Texto rotulo="Data da saída *" id="data_abertura" type="date" required
                     {...campo("data_abertura")} />
              <Texto rotulo="Hora da saída" id="hora_saida" type="time"
                     {...campo("hora_saida")} />
              <Texto rotulo="KM de saída *" id="odometro_saida" type="number" min="0"
                     required {...campo("odometro_saida")} placeholder="Ex.: 45230" />
              <Texto rotulo="Percurso / atividade" id="percurso" largo
                     {...campo("percurso")}
                     placeholder="Ex.: Sede - Setor Central - Sede" />
            </>
          ) : (
            <>
              <h3 className="formulario__secao">Chegada do veículo</h3>
              <Texto rotulo="Data da chegada" id="data_devolucao" type="date"
                     {...campo("data_devolucao")} />
              <Texto rotulo="Hora da chegada" id="hora_chegada" type="time"
                     {...campo("hora_chegada")} />
              <Texto rotulo="KM de chegada" id="odometro_chegada" type="number" min="0"
                     {...campo("odometro_chegada")} placeholder="Ex.: 45310" />
              <Selecao rotulo="Situação *" id="status" required
                       opcoes={[
                         { valor: "ABERTO", rotulo: "Em aberto" },
                         { valor: "FINALIZADO", rotulo: "Finalizado" },
                       ]}
                       {...campo("status")} />
              {/* KM rodado nao se digita: e a subtracao dos dois odometros,
                  calculada pelo banco. Mostrar aqui evita a conta de cabeca
                  na hora de conferir se a correcao faz sentido. */}
              <div className="campo">
                <label>KM rodado</label>
                <p className="campo__leitura">
                  {formulario.odometro_chegada === "" || formulario.odometro_chegada === null
                    ? "—"
                    : `${numero(Number(formulario.odometro_chegada) - Number(formulario.odometro_saida))} km`}
                </p>
              </div>
            </>
          )}

          {/* EQUIPAMENTOS: Presente ou Ausente, como na tela do condutor. O
              campo de observacao abre so no item ausente - em item presente
              nao ha o que explicar. */}
          <h3 className="formulario__secao">Verificação dos equipamentos</h3>
          <div className="campo" data-largo="sim">
            <div className="eq-correcao">
              {(formulario[chaveEq] || []).map((item, i) => (
                <div className="eq-correcao__item" key={item.equipamento}>
                  <span className="eq-correcao__nome">
                    {rotulo("equipamento", item.equipamento)}
                  </span>
                  <div className="eq-correcao__botoes">
                    <button type="button" className="botao botao--mini"
                            data-ativo={item.conforme ? "sim" : undefined}
                            onClick={() => alterarEquipamento(i, { conforme: true })}>
                      Presente
                    </button>
                    <button type="button" className="botao botao--mini"
                            data-ativo={!item.conforme ? "sim" : undefined}
                            data-perigo="sim"
                            onClick={() => alterarEquipamento(i, { conforme: false })}>
                      Ausente
                    </button>
                  </div>
                  {!item.conforme && (
                    <input
                      className="eq-correcao__obs"
                      placeholder="O que houve?"
                      value={item.observacao}
                      onChange={(e) => alterarEquipamento(i, { observacao: e.target.value })}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* FOTOS: conferencia, nao edicao. A foto e a prova do estado do
              veiculo no momento em que o condutor registrou - trocar isso
              daqui seria apagar a prova, nao corrigir um erro de digitacao. */}
          <h3 className="formulario__secao">Fotos do condutor</h3>
          <div className="campo" data-largo="sim">
            {(() => {
              const daAba = fotosForm.filter((f) => (f.momento || "SAIDA") === abaForm);
              return daAba.length === 0 ? (
                <div className="vazio">Nenhuma foto anexada neste momento.</div>
              ) : (
                <div className="checklist-fotos">
                  {daAba.map((f) => (
                    <a key={f.id_foto} href={f.url} target="_blank" rel="noreferrer">
                      <img src={f.url} alt={`Foto do checklist ${f.id_foto}`} />
                    </a>
                  ))}
                </div>
              );
            })()}
          </div>

          <h3 className="formulario__secao">Observações</h3>
          <Area id={naSaidaForm ? "observacoes" : "observacoes_chegada"} largo
                aria-label="Observações"
                {...campo(naSaidaForm ? "observacoes" : "observacoes_chegada")}
                placeholder="Ex.: veículo devolvido com o tanque cheio" />

        </form>
      </Modal>
    )}

    {modalSenha}
    </>
  );
}
