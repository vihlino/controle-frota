/**
 * FormularioVeiculo.jsx - Janela de cadastro e edicao do veiculo (08/10).
 *
 * Saiu de dentro de Veiculos.jsx para ser usada tambem na tela de Detalhes do
 * Veiculo: o botao Editar de la abre esta janela ali mesmo, sem trocar de
 * tela (antes ia para a lista de Veiculos com o pop-up aberto e so voltava
 * depois de fechar).
 *
 * veiculo = null cadastra um novo; com um veiculo, edita (pedindo a senha,
 * como no resto do sistema). aoSalvar() roda depois de gravar.
 */
import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import Icone from "./Icone.jsx";
import { useConfirmacaoSenha } from "./ConfirmarSenha.jsx";
import { Texto, Selecao, Area } from "./Campos.jsx";
import { api, apiArquivo } from "../lib/api.js";
import { opcoes } from "../lib/formato.js";
import { VINCULOS } from "../lib/vinculos.js";
import TituloSecao from "./TituloSecao.jsx";

export const SITUACOES = [
  { valor: "DISPONIVEL", rotulo: "Regular" },
  { valor: "EM_USO", rotulo: "Em uso" },
  { valor: "EM_MANUTENCAO", rotulo: "Em manutenção" },
  { valor: "INATIVO", rotulo: "Indisponível" },
];
const TIPOS = opcoes("tipoVeiculo");
const COMBUSTIVEIS = opcoes("combustivel");

const VAZIO = {
  placa: "", marca: "", modelo: "", ano_fabricacao: "", ano_modelo: "", cor: "",
  tipo_veiculo: "AUTOMOVEL", renavam: "", chassi: "", tipo_combustivel: "FLEX",
  capacidade: "", quilometragem_atual: 0, id_setor: "", vinculo: "", observacoes: "",
  status: "DISPONIVEL",
};

/*
 * Foto do veiculo (26/10): a imagem escolhida e reduzida no proprio navegador
 * (no maximo 1600 px, JPG) antes de subir - a foto do celular tem 4 a 8 MB e
 * o cartao do topo nao precisa disso. Fundo branco para PNG transparente.
 */
function reduzirFoto(arquivo) {
  return new Promise((ok, falha) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height));
      const w = Math.round(img.width * k);
      const h = Math.round(img.height * k);
      const tela = document.createElement("canvas");
      tela.width = w;
      tela.height = h;
      const ctx = tela.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      ok(tela.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      falha(new Error("Não foi possível ler a imagem. Use uma foto JPG ou PNG."));
    };
    img.src = url;
  });
}

/*
 * soViatura (18/10): aberto pela tela de Viaturas. O setor fica travado em
 * Fiscalizacao - e o setor que faz do veiculo uma viatura.
 */
export default function FormularioVeiculo({ veiculo = null, aoFechar, aoSalvar, soViatura = false }) {
  const editando = veiculo ? veiculo.id_veiculo : "novo";
  const [formulario, setFormulario] = useState(() =>
    veiculo ? { ...VAZIO, ...veiculo, id_setor: veiculo.id_setor } : VAZIO);
  const [setores, setSetores] = useState([]);
  const [erroForm, setErroForm] = useState("");
  const [salvando, setSalvando] = useState(false);
  const { pedirSenha, elemento: modalSenha } = useConfirmacaoSenha();
  // Foto: a que ja existe (para mostrar) e o que a pessoa fez nesta janela.
  const [fotoVista, setFotoVista] = useState(null);  // URL para o <img>
  const [fotoNova, setFotoNova] = useState(null);    // data URL a enviar
  const [tirarFoto, setTirarFoto] = useState(false);
  useEffect(() => {
    if (!veiculo?.foto_em) return undefined;
    let url = null;
    apiArquivo(`/frotas/veiculos/${veiculo.id_veiculo}/foto?v=${encodeURIComponent(veiculo.foto_em)}`)
      .then((u) => { url = u; setFotoVista(u); })
      .catch(() => {});
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [veiculo?.id_veiculo, veiculo?.foto_em]);
  async function escolherFoto(e) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type)) {
      setErroForm("Escolha uma foto JPG ou PNG.");
      return;
    }
    try {
      const dataUrl = await reduzirFoto(arquivo);
      setFotoNova(dataUrl);
      setFotoVista(dataUrl);
      setTirarFoto(false);
      setErroForm("");
    } catch (erro) {
      setErroForm(erro.message);
    }
  }
  function removerFoto() {
    setFotoNova(null);
    setFotoVista(null);
    setTirarFoto(Boolean(veiculo?.foto_em));
  }
  // Depois de gravar o veiculo: sobe a foto nova ou apaga a antiga.
  async function gravarFoto(idVeiculo) {
    if (fotoNova) await api(`/frotas/veiculos/${idVeiculo}/foto`, { method: "PUT", body: { dataUrl: fotoNova } });
    else if (tirarFoto) await api(`/frotas/veiculos/${idVeiculo}/foto`, { method: "DELETE" });
  }

  useEffect(() => {
    api("/setores").then((lista) => {
      setSetores(lista);
      if (soViatura) {
        const sem = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
        const fisc = (Array.isArray(lista) ? lista : []).find((s) => sem(s.nome) === "FISCALIZACAO");
        if (fisc) setFormulario((f) => ({ ...f, id_setor: fisc.id_setor }));
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const campo = (nome) => ({
    value: formulario[nome] ?? "",
    onChange: (e) => setFormulario((f) => ({ ...f, [nome]: e.target.value })),
  });

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErroForm("");
    try {
      const corpo = {
        ...formulario,
        ano_fabricacao: Number(formulario.ano_fabricacao),
        ano_modelo: Number(formulario.ano_modelo),
        quilometragem_atual: Number(formulario.quilometragem_atual) || 0,
        id_setor: Number(formulario.id_setor),
        // Vinculo em branco vai como null, nao como "": a coluna aceita os
        // dois valores previstos ou NADA.
        vinculo: formulario.vinculo || null,
      };
      if (editando === "novo") {
        const novo = await api("/frotas/veiculos", { method: "POST", body: corpo });
        if (novo?.id_veiculo) await gravarFoto(novo.id_veiculo);
      } else {
        // So a EDICAO pede senha: mudar placa, KM ou setor de um veiculo que
        // ja tem checklists e OS altera historico.
        const confirmou = await pedirSenha({
          titulo: "Salvar alterações",
          aviso: `Confirme sua senha para salvar as alterações no veículo ${formulario.placa}.`,
        });
        if (!confirmou) {
          setSalvando(false);
          return;
        }
        await api(`/frotas/veiculos/${editando}`, { method: "PUT", body: corpo });
        await gravarFoto(editando);
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
        titulo={editando === "novo" ? (soViatura ? "Nova viatura" : "Novo veículo") : (soViatura ? "Editar viatura" : "Editar veículo")}
        legenda="Os campos marcados são obrigatórios."
        aoFechar={aoFechar}
        rodape={
          <>
            <button className="botao" onClick={aoFechar}>Cancelar</button>
            <button className="botao botao--primario" form="form-veículo" disabled={salvando}>
              <Icone nome="salvar" tamanho={15} monocromatico /> {salvando ? "Salvando..." : "Salvar"}
            </button>
          </>
        }
      >
        {erroForm && <div className="login__erro">{erroForm}</div>}
      <form id="form-veículo" className="formulario-grade formulario-grade--colunas" onSubmit={salvar}>
        {/* Tres blocos, na ordem em que a pessoa tem a informacao na mao:
            o que esta no documento do veiculo, depois onde ele fica dentro
            da CMTT, e por fim o que nao cabe em campo nenhum.

            Nenhum campo declara largura: todos ocupam o mesmo espaco, pela
            grade. Tentar dar a cada um o tamanho do seu conteudo produzia
            uma fileira de caixas desencontradas, que e mais dificil de ler
            do que uma coluna regular - e "Modelo" ou "Chassi" nao ficam
            melhores com o dobro do espaco da "Placa".

            O campo obrigatorio leva "*" no rotulo; o opcional nao leva
            nada. Escrever "(opcional)" era dizer duas vezes a mesma
            coisa. */}
        <TituloSecao>Foto do veículo</TituloSecao>
        <div className="foto-veiculo" data-largo="sim">
          <div className="foto-veiculo__quadro">
            {fotoVista
              ? <img src={fotoVista} alt="Foto do veículo" />
              : <Icone nome="kpi-car" tamanho={40} />}
          </div>
          <div className="foto-veiculo__acoes">
            <label className="botao">
              <Icone nome="oc-camera" tamanho={15} /> {fotoVista ? "Trocar foto" : "Adicionar foto"}
              <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={escolherFoto} />
            </label>
            {fotoVista && (
              <button type="button" className="botao" onClick={removerFoto}>
                <Icone nome="lixo" tamanho={15} /> Remover
              </button>
            )}
            <small className="campo__ajuda">JPG ou PNG. A foto aparece no topo dos Detalhes do Veículo.</small>
          </div>
        </div>

        <TituloSecao>Dados gerais</TituloSecao>
        {/* A placa aparece em caixa alta enquanto a pessoa digita. Quem
            grava mesmo e a API (normalizacoes de frotas.js); isto e so
            para a tela nao mostrar uma coisa e salvar outra. */}
        <Texto rotulo="Placa *" id="placa" required maxLength={10}
               style={{ textTransform: "uppercase" }}
               {...campo("placa")} placeholder="Ex.: ABC-1D23" />
        <Texto rotulo="Marca *" id="marca" required {...campo("marca")} placeholder="Ex.: Chevrolet" />
        <Texto rotulo="Modelo *" id="modelo" required {...campo("modelo")} placeholder="Ex.: S10 LS 2.8" />

        <Texto rotulo="Ano fabricação *" id="ano_fabricacao" type="number"
               min="1900" max="2100" required {...campo("ano_fabricacao")} placeholder="2022" />
        <Texto rotulo="Ano modelo *" id="ano_modelo" type="number"
               min="1900" max="2100" required {...campo("ano_modelo")} placeholder="2022" />
        <Selecao rotulo="Tipo de veículo *" id="tipo_veiculo" required
                 opcoes={TIPOS} {...campo("tipo_veiculo")} />
        <Texto rotulo="Cor" id="cor" {...campo("cor")} placeholder="Ex.: Branco" />

        <Texto rotulo="Renavam" id="renavam" {...campo("renavam")} placeholder="Ex.: 01234567890" />
        <Texto rotulo="Chassi" id="chassi" {...campo("chassi")} placeholder="Ex.: 9BG1489NK0JC123456" />

        <Selecao rotulo="Combustível" id="tipo_combustivel"
                 opcoes={COMBUSTIVEIS} {...campo("tipo_combustivel")} />
        <Texto rotulo="Capacidade" id="capacidade"
               {...campo("capacidade")} placeholder="Ex.: 5" />
        <Texto rotulo="Odômetro atual *" id="quilometragem_atual" type="number" min="0"
               required {...campo("quilometragem_atual")} placeholder="Ex.: 45230" />

        <TituloSecao>Vinculações</TituloSecao>
        {/* O SETOR e o que decide se o veiculo e viatura. Nao existe mais
            campo separado para isso: veiculo vinculado a Fiscalizacao
            aparece na tela de Viaturas, e todos aparecem em Frotas. Quem
            cadastra responde uma pergunta so, e as duas telas concordam
            sem ninguem ter que lembrar de marcar nada. */}
        <Selecao rotulo="Setor *" id="id_setor" required vazio="Selecione" disabled={soViatura}
                 opcoes={setores.map((s) => ({ valor: s.id_setor, rotulo: s.nome }))}
                 {...campo("id_setor")} />
        <Selecao rotulo="Vínculo" id="vinculo" vazio="Selecione"
                 opcoes={VINCULOS} {...campo("vinculo")} />
        <Selecao rotulo="Situação" id="status" opcoes={SITUACOES} {...campo("status")} />

        <TituloSecao>Observações</TituloSecao>
        <Area id="observacoes" largo aria-label="Observações" {...campo("observacoes")}
              placeholder="Ex.: Veículo com adesivagem da CMTT" />
      </form>
      </Modal>
      {modalSenha}
    </>
  );
}
