/**
 * TituloSecao.jsx - O titulo de cada parte de um formulario, no desenho do
 * Cesar de 29/10: um quadrinho colorido com icone, o nome da parte em
 * maiusculas e uma linha explicando o que preencher.
 *
 * Os formularios escreviam so um h3 "formulario__secao" com o nome
 * ("Dados pessoais"). Para nao reescrever todos, o icone, a cor e a explicacao saem
 * do proprio nome - quem quiser outro passa `icone`, `tom` e `descricao`.
 */
import Icone from "./Icone.jsx";

const REGRAS = [
  [/dados pessoais/i, "user", "laranja", "Informe os dados pessoais."],
  [/^cnh/i, "cnh", "azul", "Informe os dados da carteira de habilitação."],
  [/vincula[cç][aã]o$/i, "maleta", "verde", "Defina o setor, o cargo/função e a situação."],
  [/vincula[cç][oõ]es/i, "link", "verde", "Defina o setor, o vínculo e a situação."],
  [/acesso|usu[aá]rio|perfil/i, "alterar-senha", "roxo", "Defina o acesso ao sistema."],
  [/foto do ve/i, "oc-camera", "laranja", "Adicione uma foto para facilitar a identificação."],
  [/dados gerais/i, "kpi-car", "azul", "Informe os dados principais do veículo."],
  [/infra[cç][aã]o/i, "kpi-car", "laranja", "Informe os dados da infração de trânsito."],
  [/pagamento/i, "dinheiro", "verde", "Informe os dados de pagamento."],
  [/sa[ií]da do ve/i, "oc-local", "laranja", "Informe os dados da saída do veículo."],
  [/chegada do ve/i, "oc-local", "laranja", "Informe os dados da chegada do veículo."],
  [/verifica[cç][aã]o dos equip|equipamentos/i, "kpi-wrench", "azul", "Selecione se cada item está presente no veículo."],
  [/fotos? do condutor/i, "oc-camera", "roxo", "Anexe fotos (se necessário)."],
  [/informa[cç][oõ]es do sinistro/i, "sinistro", "laranja", "Informe os dados principais do sinistro."],
  [/danos/i, "kpi-wrench", "verde", "Detalhe os danos identificados no veículo."],
  [/envolvidos/i, "usuarios", "verde", "Adicione os envolvidos (condutores, terceiros etc.)."],
  [/or[cç]amento/i, "dinheiro", "amarelo", "Informe os custos estimados do reparo."],
  [/fotos e documentos|anexos|arquivo/i, "documentos", "roxo", "Anexe fotos e documentos (PDF, JPG ou PNG, até 10 MB)."],
  [/encaminhamentos/i, "arquivo-texto", "laranja", "Registre as providências tomadas e outras observações."],
  [/informa[cç][oõ]es complementares/i, "dinheiro", "verde", "Informe custos, prazo e peças necessárias."],
  [/itens a serem|itens verificados|servi[cç]os/i, "checklist", "roxo", "Adicione os itens ou serviços desta OS."],
  [/descri[cç][aã]o do servi/i, "arquivo-texto", "roxo", "Descreva o serviço ou manutenção a ser realizado."],
  [/ordem de servi|informa[cç][oõ]es da os|informa[cç][oõ]es principais/i, "user", "laranja", "Preencha os dados principais da OS."],
  [/ve[ií]culo e agendamento/i, "kpi-car", "azul", "Selecione o veículo e informe os detalhes da manutenção."],
  [/informa[cç][oõ]es do documento/i, "documento", "laranja", "Preencha os dados principais do documento."],
  [/observa[cç]/i, "arquivo-texto", "azul", "Informações adicionais."],
  [/fotos/i, "oc-camera", "roxo", "Fotos (JPG ou PNG)."],
];

const texto = (no) => (typeof no === "string" ? no : Array.isArray(no) ? no.filter((x) => typeof x === "string").join("") : "");

export default function TituloSecao({ children, icone, tom, descricao }) {
  const t = texto(children);
  const regra = REGRAS.find(([re]) => re.test(t));
  const ic = icone || regra?.[1] || "arquivo-texto";
  const cor = tom || regra?.[2] || "azul";
  const desc = descricao === null ? null : (descricao || regra?.[3]);
  // Na Fiscalizacao o desenho e outro: numero laranja, nome em cinza e um
  // fio ate o fim da linha ("1 INFORMACOES DO SERVICO ----").
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/fiscalizacao")) {
    return (
      <div className="ts-num">
        <span className="ts-num__numero" aria-hidden="true" />
        <h3 className="ts-num__titulo">{children}</h3>
        <span className="ts-num__fio" aria-hidden="true" />
      </div>
    );
  }
  return (
    <div className="ts" data-tom={cor}>
      <span className="ts__icone"><Icone nome={ic} tamanho={20} monocromatico /></span>
      <span className="ts__textos">
        <h3 className="ts__titulo">{children}</h3>
        {desc && <span className="ts__descricao">{desc}</span>}
      </span>
    </div>
  );
}
