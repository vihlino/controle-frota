/**
 * CorrigirChecklist.jsx - Janela "Corrigir checklist" (08/10).
 *
 * Saiu de dentro de Checklists.jsx para ser usada tambem na tela de Detalhes
 * do Checklist: o Editar de la abre esta janela ali mesmo, sem ir para a
 * lista. Recebe o checklist completo (GET /frotas/checklists/:id).
 */
import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import Icone from "./Icone.jsx";
import { useConfirmacaoSenha } from "./ConfirmarSenha.jsx";
import { Texto, Selecao, Area } from "./Campos.jsx";
import { api, apiArquivo } from "../lib/api.js";
import { dataHora, numero, rotulo } from "../lib/formato.js";

export const ORDEM_EQUIPAMENTOS = ["MACACO", "ESTEPE", "TRIANGULO", "CHAVE_RODA"];

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

export default function CorrigirChecklist({ checklist, aoFechar, aoSalvar }) {
  const id = checklist.id_checklist;
  function inicial(c) {
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

    return {
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
    };
  }


  const [formulario, setFormulario] = useState(() => inicial(checklist));
  const [abaForm, setAbaForm] = useState("SAIDA");
  const [fotosForm, setFotosForm] = useState([]);
  const [erroForm, setErroForm] = useState("");
  const [salvando, setSalvando] = useState(false);
  const { pedirSenha, elemento: modalSenha } = useConfirmacaoSenha();

  /*
   * As fotos vem em duas etapas, como na tela de detalhes: a lista primeiro, o
   * arquivo depois. Elas aparecem para CONFERIR - o que o condutor fotografou
   * e a prova do estado do veiculo, e nao um campo que a gestao reescreve.
   */
  useEffect(() => {
    if (!id) return;
    let vivo = true;
    api(`/qrcode/fotos/checklist/${id}`)
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
  }, [id]);

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
      await api(`/frotas/checklists/${id}`, {
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
        await api(`/frotas/checklists/${id}/equipamentos`, {
          method: "PUT",
          body: { momento, itens: formulario[chave], justificativa },
        });
      }

      aoSalvar?.();
      aoFechar();
    } catch (e) {
      setErroForm(e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
    <Modal
      titulo="Corrigir checklist"
      legenda="A alteração fica registrada na auditoria, com o valor anterior."
      aoFechar={() => aoFechar()}
      rodape={
        <>
          <button className="botao" onClick={() => aoFechar()}>Cancelar</button>
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
      {modalSenha}
    </>
  );
}
