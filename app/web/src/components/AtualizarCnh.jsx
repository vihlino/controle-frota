/**
 * AtualizarCnh.jsx - Pop-up "Atualizar CNH" (pedido do Cesar, 26/10).
 *
 * Aberto pelo botao do cartao "Informacoes da CNH", na aba CNH dos Detalhes
 * do Motorista, do Servidor e do Fiscal. So os campos da CNH e o motivo da
 * troca: renovacao, mudanca de categoria, segunda via ou correcao. Pede a
 * senha antes de gravar, como o resto do sistema.
 *
 * A CNH que estava valendo NAO se perde: o banco a guarda sozinho (migracao
 * 049) e ela aparece no "Historico de renovacao", com o motivo e quem trocou.
 */
import { useState } from "react";
import Modal from "./Modal.jsx";
import Icone from "./Icone.jsx";
import { useConfirmacaoSenha } from "./ConfirmarSenha.jsx";
import { Texto, Selecao, Data } from "./Campos.jsx";
import { api } from "../lib/api.js";
import { data } from "../lib/formato.js";

const CATEGORIAS = ["A", "B", "AB", "C", "D", "E", "AC", "AD", "AE"].map((c) => ({ valor: c, rotulo: c }));
const MOTIVOS = ["Renovação", "Mudança de categoria", "Segunda via", "Correção de dados"]
  .map((m) => ({ valor: m, rotulo: m }));
const dia = (v) => (v ? String(v).slice(0, 10) : "");
const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR",
  "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"].map((u) => ({ valor: u, rotulo: u }));

export default function AtualizarCnh({ pessoa: p, aoFechar, aoSalvar }) {
  const temCnh = Boolean(p.condutor && (p.cnh || p.cnh_data_validade));
  // Renovacao e o caso mais comum: o numero e a categoria continuam, as
  // datas sao as da CNH nova (por isso comecam em branco).
  const [f, setF] = useState({
    motivo: temCnh ? "Renovação" : "Correção de dados",
    cnh: p.cnh || "",
    categoria_cnh: p.categoria_cnh || "",
    cnh_data_emissao: temCnh ? "" : dia(p.cnh_data_emissao),
    cnh_data_validade: temCnh ? "" : dia(p.cnh_data_validade),
    // Dados de 29/10: vem preenchidos com o que ja esta cadastrado.
    cnh_orgao_emissor: p.cnh_orgao_emissor || "",
    cnh_uf: p.cnh_uf || "GO",
    cnh_renach: p.cnh_renach || "",
    cnh_observacoes: p.cnh_observacoes || "",
  });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const { pedirSenha, elemento: modalSenha } = useConfirmacaoSenha();

  const campo = (nome) => ({
    value: f[nome] ?? "",
    onChange: (e) => setF((x) => ({ ...x, [nome]: e.target.value })),
  });
  // Correcao: comeca com os dados atuais, para corrigir so o que estava errado.
  function trocarMotivo(e) {
    const motivo = e.target.value;
    setF((x) => (motivo === "Correção de dados" && temCnh && !x.cnh_data_validade
      ? { ...x, motivo, cnh_data_emissao: dia(p.cnh_data_emissao), cnh_data_validade: dia(p.cnh_data_validade) }
      : { ...x, motivo }));
  }

  async function salvar(e) {
    e.preventDefault();
    setErro("");
    if (f.cnh_data_validade && f.cnh_data_emissao && f.cnh_data_validade <= f.cnh_data_emissao) {
      setErro("A validade precisa ser depois da emissão.");
      return;
    }
    setSalvando(true);
    try {
      const confirmou = await pedirSenha({
        titulo: "Atualizar CNH",
        aviso: `Confirme sua senha para atualizar a CNH de ${p.nome}. A CNH atual fica guardada no histórico.`,
      });
      if (!confirmou) return;
      await api(`/frotas/servidores/${p.id_servidor}/cnh`, { method: "PUT", body: f });
      aoSalvar?.();
      aoFechar();
    } catch (e2) {
      setErro(e2.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Modal
        titulo="Atualizar CNH"
        legenda="Os dados da CNH atual ficam guardados no Histórico de renovação."
        aoFechar={aoFechar}
        largura={560}
        rodape={
          <>
            <button className="botao" onClick={aoFechar}>Cancelar</button>
            <button className="botao botao--primario" form="form-atualizar-cnh" disabled={salvando}>
              <Icone nome="salvar" tamanho={15} monocromatico /> {salvando ? "Salvando..." : "Salvar CNH"}
            </button>
          </>
        }
      >
        {erro && <div className="login__erro">{erro}</div>}
        {temCnh && (
          <div className="cnh-atual">
            <Icone nome="cnh" tamanho={20} />
            <span>
              CNH atual: <strong>{p.cnh}</strong> · Categoria <strong>{p.categoria_cnh || "—"}</strong>
              {p.cnh_data_validade && <> · válida até <strong>{data(p.cnh_data_validade)}</strong></>}
            </span>
          </div>
        )}
        <form id="form-atualizar-cnh" className="formulario-grade cnh-grade" onSubmit={salvar}>
          <Selecao rotulo="Motivo *" id="cnh-motivo" required opcoes={MOTIVOS} largo
                   value={f.motivo} onChange={trocarMotivo} />
          <Texto rotulo="Nº da CNH / registro *" id="cnh-numero" required inputMode="numeric"
                 maxLength={15} {...campo("cnh")} placeholder="Ex.: 12345678901" />
          <Selecao rotulo="Categoria *" id="cnh-categoria" required vazio="Selecione"
                   opcoes={CATEGORIAS} {...campo("categoria_cnh")} />
          <Data rotulo="Data de emissão *" id="cnh-emissao" required {...campo("cnh_data_emissao")} />
          <Data rotulo="Data de validade *" id="cnh-validade" required {...campo("cnh_data_validade")} />
          <Texto rotulo="Órgão emissor" id="cnh-orgao" maxLength={60} {...campo("cnh_orgao_emissor")} placeholder="Ex.: DETRAN - GO" />
          <Selecao rotulo="UF" id="cnh-uf" vazio="Selecione" opcoes={UFS} {...campo("cnh_uf")} />
          <Texto rotulo="Registro RENACH" id="cnh-renach" maxLength={20} {...campo("cnh_renach")} placeholder="Ex.: GO123456789" />
          <Texto rotulo="Observações" id="cnh-obs" maxLength={2000} {...campo("cnh_observacoes")} placeholder="Ex.: EAR (exerce atividade remunerada)" />
        </form>
      </Modal>
      {modalSenha}
    </>
  );
}
