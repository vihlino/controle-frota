/**
 * RegistrarMulta.jsx - Janela "Registrar multa" / "Editar multa" (08/10).
 *
 * A multa e sempre de UM condutor (o da ficha onde a janela foi aberta): ele
 * aparece no topo, sem campo para trocar. Pontos e valor sao sugeridos pela
 * gravidade (tabela do CTB) quando ainda estao vazios - valem os do auto.
 *
 * Anexos: na multa nova, escolhidos aqui e enviados depois de gravar; na
 * edicao, a lista de anexos ja gravados, com adicionar e excluir.
 */
import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import Icone from "./Icone.jsx";
import AnexarArquivos from "./AnexarArquivos.jsx";
import ArquivosAnexados from "./ArquivosAnexados.jsx";
import { useConfirmacaoSenha } from "./ConfirmarSenha.jsx";
import { Texto, Selecao, Data, Area } from "./Campos.jsx";
import { api } from "../lib/api.js";
import { enviarArquivo } from "../lib/arquivos.js";
import { useSessao } from "../lib/sessao.jsx";
import TituloSecao from "./TituloSecao.jsx";

export const GRAVIDADES = [
  { valor: "LEVE", rotulo: "Leve", pontos: 3, valorMulta: "88.38", tom: "azul" },
  { valor: "MEDIA", rotulo: "Média", pontos: 4, valorMulta: "130.16", tom: "amarelo" },
  { valor: "GRAVE", rotulo: "Grave", pontos: 5, valorMulta: "195.23", tom: "laranja" },
  { valor: "GRAVISSIMA", rotulo: "Gravíssima", pontos: 7, valorMulta: "293.47", tom: "vermelho" },
];
/*
 * Opcao "Registrar multa" do menu de acoes das listas de Motoristas,
 * Servidores e Fiscais (08/10): abre esta janela ali mesmo, com o condutor
 * da linha. So para quem pode gerenciar multas.
 */
export const ACAO_MULTA = {
  rotulo: "Registrar multa",
  icone: "alert-triangle",
  permissao: "FROTAS_GERENCIAR_MULTAS",
  janela: (registro, fechar) => (
    <RegistrarMulta servidor={registro} aoFechar={fechar}
                    aoSalvar={() => alert(`Multa registrada para ${registro.nome}. Ela aparece na aba Multas dos detalhes.`)} />
  ),
};

export const SITUACOES_MULTA = [
  { valor: "PENDENTE", rotulo: "Pendente", tom: "amarelo" },
  { valor: "EM_RECURSO", rotulo: "Em recurso", tom: "azul" },
  { valor: "PAGA", rotulo: "Paga", tom: "verde" },
  { valor: "CANCELADA", rotulo: "Cancelada", tom: "cinza" },
];

const texto = (v) => (v === null || v === undefined ? "" : String(v));
const data10 = (v) => (v ? String(v).slice(0, 10) : "");
const hora5 = (v) => (v ? String(v).slice(0, 5) : "");

export default function RegistrarMulta({ servidor, multa = null, aoFechar, aoSalvar }) {
  const editando = Boolean(multa);
  const { usuario, podeVer } = useSessao();
  const podeGerenciar = podeVer("FROTAS_GERENCIAR_MULTAS");
  const { pedirSenha, elemento: modalSenha } = useConfirmacaoSenha();
  const [veiculos, setVeiculos] = useState([]);
  const [anexos, setAnexos] = useState([]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [f, setF] = useState(() => ({
    id_veiculo: texto(multa?.id_veiculo),
    numero_auto: texto(multa?.numero_auto),
    orgao_autuador: texto(multa?.orgao_autuador),
    codigo_infracao: texto(multa?.codigo_infracao),
    data: data10(multa?.data),
    hora: hora5(multa?.hora),
    local: texto(multa?.local),
    descricao: texto(multa?.descricao),
    gravidade: multa?.gravidade || "",
    pontos: texto(multa?.pontos),
    valor: texto(multa?.valor),
    vencimento: data10(multa?.vencimento),
    status: multa?.status || "PENDENTE",
    data_pagamento: data10(multa?.data_pagamento),
    observacoes: texto(multa?.observacoes),
  }));

  useEffect(() => {
    api("/frotas/veiculos/opcoes").then((r) => setVeiculos(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  const campo = (nome) => ({
    value: f[nome] ?? "",
    onChange: (e) => setF((x) => ({ ...x, [nome]: e.target.value })),
  });

  // Gravidade sugere pontos e valor (CTB) so quando ainda estao vazios.
  function mudarGravidade(e) {
    const g = GRAVIDADES.find((x) => x.valor === e.target.value);
    setF((x) => ({
      ...x,
      gravidade: e.target.value,
      pontos: x.pontos === "" && g ? String(g.pontos) : x.pontos,
      valor: x.valor === "" && g ? g.valorMulta : x.valor,
    }));
  }

  async function salvar(e) {
    e.preventDefault();
    setErro("");
    setSalvando(true);
    try {
      const corpo = {
        id_servidor: Number(servidor.id_servidor),
        id_veiculo: Number(f.id_veiculo),
        numero_auto: f.numero_auto.trim() || null,
        orgao_autuador: f.orgao_autuador.trim() || null,
        codigo_infracao: f.codigo_infracao.trim() || null,
        data: f.data,
        hora: f.hora || null,
        local: f.local.trim() || null,
        descricao: f.descricao.trim(),
        gravidade: f.gravidade,
        pontos: f.pontos === "" ? null : Number(f.pontos),
        valor: f.valor === "" ? null : Number(String(f.valor).replace(",", ".")),
        vencimento: f.vencimento || null,
        status: f.status,
        // Data do pagamento so faz sentido para multa paga.
        data_pagamento: f.status === "PAGA" ? f.data_pagamento || null : null,
        observacoes: f.observacoes.trim() || null,
      };
      let idMulta = multa?.id_multa;
      if (editando) {
        const ok = await pedirSenha({
          titulo: "Salvar alterações",
          aviso: "Confirme sua senha para salvar as alterações nesta multa.",
        });
        if (!ok) {
          setSalvando(false);
          return;
        }
        await api(`/frotas/multas/${idMulta}`, { method: "PUT", body: corpo });
      } else {
        const nova = await api("/frotas/multas", {
          method: "POST", body: { ...corpo, criado_por: usuario.id_usuario },
        });
        idMulta = nova.id_multa;
        const falhas = [];
        for (const a of anexos) {
          try {
            await enviarArquivo(api, `/frotas/multas/${idMulta}/arquivos`, a);
          } catch (err) {
            falhas.push(`${a.name}: ${err.message}`);
          }
        }
        if (falhas.length) {
          alert(`A multa foi salva, mas estes arquivos não foram enviados:\n${falhas.join("\n")}\n`
            + "Anexe-os abrindo a multa de novo.");
        }
      }
      aoSalvar?.(idMulta);
      aoFechar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  const somenteLeitura = !podeGerenciar;

  return (
    <>
      <Modal
        titulo={editando ? (somenteLeitura ? "Multa" : "Editar multa") : "Registrar multa"}
        legenda={`Condutor: ${servidor.nome}`}
        aoFechar={aoFechar}
        rodape={
          <>
            <button type="button" className="botao" onClick={aoFechar}>{somenteLeitura ? "Fechar" : "Cancelar"}</button>
            {!somenteLeitura && (
              <button className="botao botao--primario" form="form-multa" disabled={salvando}>
                <Icone nome="salvar" tamanho={15} monocromatico /> {salvando ? "Salvando..." : "Salvar"}
              </button>
            )}
          </>
        }
      >
        {erro && <div className="login__erro">{erro}</div>}
        <form id="form-multa" className="formulario-grade" onSubmit={salvar}>
          <fieldset className="multa-campos" disabled={somenteLeitura}>
            <TituloSecao>Infração</TituloSecao>
            <Selecao rotulo="Veículo *" id="multa-veiculo" required vazio="Selecione"
                     opcoes={veiculos.map((v) => ({ valor: v.id_veiculo, rotulo: `${v.placa} - ${v.marca} ${v.modelo}` }))}
                     {...campo("id_veiculo")} />
            <Texto rotulo="Nº do auto de infração" id="multa-auto" {...campo("numero_auto")} placeholder="Ex.: A123456789" />
            <Texto rotulo="Órgão autuador" id="multa-orgao" {...campo("orgao_autuador")} placeholder="Ex.: DETRAN-GO, PRF" />
            <Data rotulo="Data da infração *" id="multa-data" required {...campo("data")} />
            <Texto rotulo="Hora" id="multa-hora" type="time" {...campo("hora")} />
            <Texto rotulo="Código da infração (CTB)" id="multa-codigo" {...campo("codigo_infracao")} placeholder="Ex.: 745-50" />
            <Texto rotulo="Local" id="multa-local" largo {...campo("local")} placeholder="Ex.: Av. Brasil, 1500 - Centro" />
            <Area rotulo="Descrição da infração *" id="multa-descricao" required largo {...campo("descricao")}
                  placeholder="Ex.: Transitar em velocidade superior à máxima permitida em até 20%" />
            <Selecao rotulo="Gravidade *" id="multa-gravidade" required vazio="Selecione"
                     opcoes={GRAVIDADES.map((g) => ({ valor: g.valor, rotulo: `${g.rotulo} (${g.pontos} pontos)` }))}
                     value={f.gravidade} onChange={mudarGravidade} />
            <Texto rotulo="Pontos na CNH" id="multa-pontos" type="number" min="0" max="40" {...campo("pontos")} />
            <Texto rotulo="Valor (R$)" id="multa-valor" type="number" min="0" step="0.01" {...campo("valor")} placeholder="Ex.: 130,16" />

            <TituloSecao>Pagamento</TituloSecao>
            <Data rotulo="Vencimento" id="multa-vencimento" {...campo("vencimento")} />
            <Selecao rotulo="Situação *" id="multa-status" required
                     opcoes={SITUACOES_MULTA.map((s) => ({ valor: s.valor, rotulo: s.rotulo }))}
                     {...campo("status")} />
            {f.status === "PAGA" && (
              <Data rotulo="Data do pagamento" id="multa-pagamento" {...campo("data_pagamento")} />
            )}
            <Area rotulo="Observações" id="multa-obs" largo {...campo("observacoes")}
                  placeholder="Ex.: Recurso protocolado em 15/06" />
          </fieldset>

          <TituloSecao>Anexos (auto de infração, notificação, comprovante)</TituloSecao>
          <div className="campo" data-largo="sim">
            {editando ? (
              <ArquivosAnexados
                caminhoLista={`/frotas/multas/${multa.id_multa}/arquivos`}
                caminhoArquivo="/frotas/multas/arquivos"
                podeGerenciar={podeGerenciar}
                vazio="Nenhum arquivo anexado."
                aoMudar={() => aoSalvar?.(multa.id_multa)}
              />
            ) : (
              <AnexarArquivos arquivos={anexos} aoMudar={setAnexos} aoErro={setErro}
                              titulo="Arraste e solte o auto de infração ou o comprovante aqui" />
            )}
          </div>
        </form>
      </Modal>
      {modalSenha}
    </>
  );
}
