/**
 * QrComum.jsx - Pecas comuns aos dois checklists do QR Code (Frotas e
 * Fiscalizacao): o cabecalho preto com a logo e a hora, o cartao de secao
 * com icone e o cartao "Dados do veiculo". Pedido do Cesar (26/10): os dois
 * checklists com o mesmo cabecalho e o mesmo cartao do veiculo.
 */
import { useEffect, useState } from "react";
import Icone from "./Icone.jsx";
import Selo from "./Selo.jsx";
import { rotulo } from "../lib/formato.js";

/**
 * Cabecalho: logo a esquerda; a direita o icone, a HORA e depois a data, numa
 * linha so. Antes eram duas linhas (data em cima, hora embaixo) e o icone
 * ficava sozinho no meio da altura, parecendo estar entre as duas.
 * O relogio anda sozinho: o checklist fica aberto o turno inteiro.
 */
export function TopoQr() {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 15000);
    return () => clearInterval(id);
  }, []);
  return (
    <header className="qf-topo">
      <img src="/icons/logo-sitra.png" alt="SITRA" />
      <span className="qf-topo__hora">
        <Icone nome="calendar" tamanho={18} monocromatico />
        <strong>{agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</strong>
        <span>{agora.toLocaleDateString("pt-BR")}</span>
      </span>
    </header>
  );
}

/** Cartao de secao: icone, titulo (com * quando obrigatorio), nota e acao. */
export function Secao({ icone, titulo, nota, obrigatorio, acao, children, className = "" }) {
  return (
    <section className={`qr-cartao qf-secao ${className}`.trim()}>
      <div className="qf-secao__topo">
        <span className="qf-secao__icone"><Icone nome={icone} tamanho={22} /></span>
        <div className="qf-secao__textos">
          <h2 className="qr-cartao__titulo">{titulo}{obrigatorio && <span className="qf-obrig"> *</span>}</h2>
          {nota && <p className="qr-cartao__nota">{nota}</p>}
        </div>
        {acao}
      </div>
      {children}
    </section>
  );
}

/**
 * "Dados do veiculo": placa e situacao, modelo, ano/combustivel/cor e o setor.
 * `lado` e o que vai a direita (na Fiscalizacao, a equipe e o codigo SD).
 */
export function CartaoVeiculo({ veiculo: v, lado = null }) {
  return (
    <Secao icone="fisc-viatura" titulo="Dados do veículo">
      <div className="qf-viatura">
        <span className="qf-viatura__icone"><Icone nome="fisc-viatura" tamanho={34} /></span>
        <div className="qf-viatura__dados">
          <span className="qf-viatura__placa"><strong>{v.placa}</strong><Selo valor={v.status} /></span>
          <span>{v.marca} {v.modelo}</span>
          <small>{[v.ano_modelo, v.tipo_combustivel ? rotulo("combustivel", v.tipo_combustivel) : null, v.cor].filter(Boolean).join(" · ")}</small>
          {v.setor && <span className="qf-viatura__setor">{v.setor}</span>}
        </div>
        {lado}
      </div>
    </Secao>
  );
}

/**
 * Linha "Horario de saida | Hodometro na saida (Sim / Nao)" e a ajuda do KM,
 * igual nos dois checklists.
 *   hora / setHora      - valor do horario; sem setHora o campo fica travado
 *   km / setKm          - valor do KM
 *   confere / setConfere - true (Sim), false (Nao) ou null (sem resposta)
 *   kmAtual            - ultimo KM registrado (volta para ele no "Sim")
 *   travado            - saida ja registrada: tudo so leitura, sem Sim/Nao
 */
export function HoraEKmSaida({ hora, setHora, km, setKm, confere, setConfere, kmAtual, travado, formatarKm, data }) {
  // Com `data` (aaaa-mm-dd) a linha ganha a Data de saida na frente, como na
  // chegada do checklist de Frotas (26/10): tres campos do mesmo tamanho, e o
  // Sim/Nao do hodometro fica DENTRO do campo do KM, pequeno. A data e a do servico
  // (o dia do checklist): aparece, mas nao se edita.
  const comData = Boolean(data);
  const confirma = !travado && (
    <div className="qr-km__confirma" role="group" aria-label="O KM exibido está correto?">
      <button type="button" data-ativo={confere === true}
              onClick={() => { setConfere(true); setKm(String(kmAtual ?? "")); }}>Sim</button>
      <button type="button" data-ativo={confere === false}
              onClick={() => setConfere(false)}>Não</button>
    </div>
  );
  return (
    <>
      <div className={`qr-saida-linha${comData ? " qr-saida-linha--data" : ""}`}>
        {comData && (
          <div className="qr-saida-linha__data">
            <label htmlFor="qr-data-saida">Data de saída <span className="qf-obrig">*</span></label>
            {/* So leitura: o navegador esconde o icone do calendario em campo
                travado, entao o icone vem desenhado por cima. */}
            <span className="qr-data-fixa">
              <input id="qr-data-saida" type="date" value={data} readOnly tabIndex={-1} />
              <Icone nome="calendar" tamanho={14} />
            </span>
          </div>
        )}
        <div className="qr-saida-linha__hora">
          <label htmlFor="qr-hora-saida">Horário de saída <span className="qf-obrig">*</span></label>
          <input id="qr-hora-saida" type="time" value={hora} disabled={travado || !setHora}
                 onChange={(e) => setHora && setHora(e.target.value)} />
        </div>
        <div className="qr-saida-linha__km">
          <label htmlFor="qr-km-saida">Hodômetro na saída <span className="qf-obrig">*</span></label>
          <div className="qr-km">
            <input id="qr-km-saida" type="number" inputMode="numeric" required
                   readOnly={travado || confere !== false} value={km}
                   onChange={(e) => setKm(e.target.value)} />
            {confirma}
          </div>
        </div>
      </div>
      {!travado && (
        <span className="campo__ajuda qr-saida-ajuda">
          Último KM registrado: {formatarKm(kmAtual)} km. Marque "Não" caso o KM exibido esteja
          incorreto para permitir a edição.
        </span>
      )}
    </>
  );
}

/**
 * Tela de conclusao do checklist (desenho do Cesar, 26/10): circulo verde com
 * o check, confetes da marca, titulo, mensagem e o veiculo num quadro.
 *   titulo, texto - o que aconteceu ("Saida registrada", "Boa viagem...")
 *   veiculo       - { marca, modelo, placa }
 */
export function TelaSucesso({ titulo, texto, veiculo: v }) {
  return (
    <div className="qr-sucesso">
      <span className="qr-sucesso__faixa qr-sucesso__faixa--1" aria-hidden="true" />
      <span className="qr-sucesso__faixa qr-sucesso__faixa--2" aria-hidden="true" />
      <span className="qr-sucesso__faixa qr-sucesso__faixa--3" aria-hidden="true" />
      <section className="qr-sucesso__cartao" role="status">
        <div className="qr-sucesso__selo" aria-hidden="true">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <i key={n} className={`qr-sucesso__confete qr-sucesso__confete--${n}`} />)}
          <span className="qr-sucesso__halo">
            <span className="qr-sucesso__check">
              {/* So o traco do check: o icone "check" do projeto vem dentro de um circulo. */}
              <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor"
                   strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </span>
          </span>
        </div>
        <h1 className="qr-sucesso__titulo">{titulo}</h1>
        <p className="qr-sucesso__texto">{texto}</p>
        <div className="qr-sucesso__veiculo">
          <span className="qr-sucesso__icone"><Icone nome="kpi-car" tamanho={30} /></span>
          <span className="qr-sucesso__divisor" aria-hidden="true" />
          <span className="qr-sucesso__dados">
            <small>Veículo</small>
            <strong>{v.marca} {v.modelo}</strong>
            <span>{v.placa}</span>
          </span>
        </div>
      </section>
    </div>
  );
}
