/**
 * urlPublica.js - O endereco que vai gravado DENTRO do QR Code.
 *
 * Nao e detalhe de configuracao: e o que o celular do motorista abre quando ele
 * aponta a camera para o adesivo. Errado, o adesivo nao serve para nada - e
 * so se descobre depois de imprimir.
 */
import os from "node:os";

/** Porta do servidor de desenvolvimento do front (o Vite). */
const PORTA_WEB = Number(process.env.PORT_WEB || 5173);

/*
 * Placas de rede que existem na maquina mas NAO levam ao Wi-Fi.
 *
 * O Windows cria varias: a do Hyper-V e a do WSL ("vEthernet"), a do
 * VirtualBox, a do VMware, a do Docker, a de VPN. Todas tem IPv4 e nenhuma e
 * "interna" para o Node - e a primeira da lista costuma ser uma delas, com um
 * 172.x que o celular nunca alcanca. Foi o que fez o QR Code nao abrir no
 * celular mesmo com tudo ligado.
 */
const VIRTUAIS = /vethernet|wsl|hyper-?v|virtualbox|vmware|vbox|docker|loopback|tailscale|zerotier|hamachi|vpn|tap|tun|bluetooth/i;

/**
 * Nota de cada endereco: quanto maior, mais provavel ser o do Wi-Fi.
 *
 * 192.168.x.x e a faixa dos roteadores domesticos e de escritorio - quase
 * sempre e ela. 10.x vem depois (redes corporativas). 172.16-31 por ultimo,
 * porque e justamente a faixa que Hyper-V, WSL e Docker usam.
 */
function nota(ip) {
  if (ip.startsWith("192.168.")) return 3;
  if (ip.startsWith("10.")) return 2;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 1;
  return 0;
}

/**
 * Todos os IPv4 desta maquina que podem ser o da rede local, do mais provavel
 * para o menos. As placas virtuais ficam de fora.
 *
 * @returns {Array<{ip: string, placa: string}>}
 */
export function ipsDaRedeLocal() {
  const candidatos = [];
  for (const [placa, enderecos] of Object.entries(os.networkInterfaces())) {
    if (VIRTUAIS.test(placa)) continue;
    for (const e of enderecos || []) {
      if (e.family === "IPv4" && !e.internal) candidatos.push({ ip: e.address, placa });
    }
  }
  return candidatos.sort((a, b) => nota(b.ip) - nota(a.ip));
}

/**
 * O IP desta maquina na rede local (192.168.x.x, 10.x.x.x...).
 *
 * "localhost" no celular aponta para o PROPRIO celular, onde nada esta rodando:
 * o QR Code gerado com localhost abre uma tela de erro. Ja o IP da maquina na
 * rede e alcancavel pelo celular ligado no mesmo Wi-Fi.
 *
 * Se ainda assim a escolhida for a errada, URL_PUBLICA no .env resolve de forma
 * explicita - a API lista todas as candidatas no log ao subir.
 *
 * @returns {string|null}
 */
export function ipDaRedeLocal() {
  return ipsDaRedeLocal()[0]?.ip ?? null;
}

/**
 * A base das URLs publicas (sem barra no final).
 *
 * Em producao vem de URL_PUBLICA, e ponto: chutar o IP de um container seria
 * gravar no adesivo um endereco que so existe dentro do datacenter.
 *
 * Em desenvolvimento, sem URL_PUBLICA, usa o IP desta maquina na rede local -
 * assim o QR Code ja nasce funcionando no celular, sem ninguem precisar
 * descobrir o proprio IP com ipconfig e escrever no .env.
 *
 * @returns {string}
 */
export function urlPublica() {
  if (process.env.URL_PUBLICA) {
    // Barra no final geraria ".../checklist" com duas barras. Nao quebra, mas
    // aparece na tela e na etiqueta impressa.
    return process.env.URL_PUBLICA.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    return "";
  }

  const ip = ipDaRedeLocal();
  return ip ? `http://${ip}:${PORTA_WEB}` : `http://localhost:${PORTA_WEB}`;
}
