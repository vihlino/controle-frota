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
import { Texto, Selecao, Area, Data } from "./Campos.jsx";
import { api, apiArquivo } from "../lib/api.js";
import { dataHora, numero, rotulo } from "../lib/formato.js";
import TituloSecao from "./TituloSecao.jsx";

export const ORDEM_EQUIPAMENTOS = ["MACACO", "ESTEPE", "TRIANGULO", "CHAVE_RODA"];
const ICONE_EQUIPAMENTO = { MACACO: "eq-macaco", ESTEPE: "eq-estepe", TRIANGULO: "eq-triangulo", CHAVE_RODA: "eq-chave-roda" };

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
      <div className="checklist-faixa checklist-faixa--modal cc-faixa">
        <div className="checklist-faixa__campo">
          <span className="cc-faixa__icone"><Icone nome="kpi-car" tamanho={20} monocromatico /></span>
          <span className="checklist-faixa__rotulo">Veículo</span>
          <strong className="checklist-faixa__destaque">{formulario.placa}</strong>
          <span className="checklist-faixa__apoio">
            {formulario.marca} {formulario.modelo}
          </span>
        </div>
        <div className="checklist-faixa__campo">
          <span className="cc-faixa__icone"><Icone nome="user" tamanho={20} monocromatico /></span>
          <span className="checklist-faixa__rotulo">Condutor</span>
          <span className="checklist-faixa__nome">{formulario.condutor}</span>
          <span className="checklist-faixa__apoio">Matrícula {formulario.matricula}</span>
        </div>
        <div className="checklist-faixa__campo">
          <span className="cc-faixa__icone"><Icone nome="calendar" tamanho={20} monocromatico /></span>
          <span className="checklist-faixa__rotulo">Enviado em</span>
          <strong>{dataHora(formulario.criado_em)}</strong>
        </div>
      </div>

      {/* As mesmas duas abas da tela do condutor: saida e chegada sao o
          MESMO registro em dois momentos. */}
      <div className="abas cc-abas" role="tablist">
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
            <TituloSecao>Saída do veículo</TituloSecao>
            <Data rotulo="Data da saída *" id="data_abertura" required {...campo("data_abertura")} />
            <Texto rotulo="Hora da saída" id="hora_saida" type="time"
                   {...campo("hora_saida")} />
            <Texto rotulo="KM de saída *" id="odometro_saida" type="number" min="0"
                   required {...campo("odometro_saida")} placeholder="Ex.: 45230" />
            <Area rotulo="Percurso / atividade" id="percurso" largo maxLength={200} rows={2}
                  {...campo("percurso")} placeholder="Ex.: Sede - Setor Central - Sede" />
          </>
        ) : (
          <>
            <TituloSecao>Chegada do veículo</TituloSecao>
            <Data rotulo="Data da chegada" id="data_devolucao" {...campo("data_devolucao")} />
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
        <TituloSecao>Verificação dos equipamentos</TituloSecao>
        <div className="campo" data-largo="sim">
          <div className="eq-correcao">
            {(formulario[chaveEq] || []).map((item, i) => (
              <div className="eq-correcao__item cc-eq" key={item.equipamento} data-ok={item.conforme ? "sim" : "nao"}>
                <span className="cc-eq__icone"><Icone nome={ICONE_EQUIPAMENTO[item.equipamento] || "checklist"} tamanho={34} /></span>
                <span className="cc-eq__corpo">
                <span className="eq-correcao__nome">
                  {rotulo("equipamento", item.equipamento)}
                </span>
                <div className="eq-correcao__botoes">
                  <button type="button" className="botao botao--mini cc-eq__botao"
                          data-ativo={item.conforme ? "sim" : undefined}
                          onClick={() => alterarEquipamento(i, { conforme: true })}>
                    {item.conforme ? "✓" : "○"} Presente
                  </button>
                  <button type="button" className="botao botao--mini cc-eq__botao"
                          data-ativo={!item.conforme ? "sim" : undefined}
                          data-perigo="sim"
                          onClick={() => alterarEquipamento(i, { conforme: false })}>
                    {!item.conforme ? "✕" : "○"} Ausente
                  </button>
                </div>
                </span>
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
        <TituloSecao descricao="Fotos enviadas pelo condutor no QR Code (só para conferir).">Fotos do condutor</TituloSecao>
        <div className="campo" data-largo="sim">
          {(() => {
            const daAba = fotosForm.filter((f) => (f.momento || "SAIDA") === abaForm);
            return daAba.length === 0 ? (
              <div className="cc-sem-fotos"><Icone nome="oc-camera" tamanho={26} monocromatico /><span>Nenhuma foto enviada pelo condutor {naSaidaForm ? "na saída" : "na chegada"}.</span></div>
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

        <TituloSecao>Observações</TituloSecao>
        <Area id={naSaidaForm ? "observacoes" : "observacoes_chegada"} largo maxLength={500}
              aria-label="Observações"
              {...campo(naSaidaForm ? "observacoes" : "observacoes_chegada")}
              placeholder="Ex.: veículo devolvido com o tanque cheio" />

      </form>
    </Modal>
      {modalSenha}
    </>
  );
}
