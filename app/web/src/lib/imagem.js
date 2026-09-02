/**
 * imagem.js - Reduz uma foto no proprio aparelho, antes de enviar.
 *
 * POR QUE ISTO EXISTE
 * -------------------
 * A foto de um celular atual tem 3 a 8 MB. Enviar isso pela rede movel do
 * patio e lento, gasta a franquia do condutor e enche o banco - o binario e
 * guardado no Postgres, porque o disco do servico no Render e efemero.
 *
 * Reduzindo o lado maior para 1600px e salvando em JPEG, a mesma foto sai com
 * ~300 KB e continua boa o suficiente para mostrar um amassado ou um pneu.
 *
 * O trabalho acontece no navegador, num <canvas>. Nada e enviado antes.
 */

const LADO_MAXIMO = 1600;
const QUALIDADE = 0.82;

/**
 * @param {File} arquivo   O arquivo escolhido no <input type="file">.
 * @returns {Promise<{dataUrl: string, bytes: number}>}
 */
export function reduzirImagem(arquivo) {
  return new Promise((resolve, reject) => {
    if (!arquivo.type.startsWith("image/")) {
      reject(new Error("O arquivo escolhido não é uma imagem."));
      return;
    }

    const url = URL.createObjectURL(arquivo);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      const maior = Math.max(img.width, img.height);
      const escala = maior > LADO_MAXIMO ? LADO_MAXIMO / maior : 1;
      const largura = Math.round(img.width * escala);
      const altura = Math.round(img.height * escala);

      const tela = document.createElement("canvas");
      tela.width = largura;
      tela.height = altura;

      const ctx = tela.getContext("2d");
      // Fundo branco: PNG com transparencia viraria preto ao virar JPEG.
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, largura, altura);
      ctx.drawImage(img, 0, 0, largura, altura);

      const dataUrl = tela.toDataURL("image/jpeg", QUALIDADE);
      // O base64 cresce ~33% sobre o binario; descontamos para estimar o peso
      // real que vai para o banco.
      const bytes = Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
      resolve({ dataUrl, bytes });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler esta imagem."));
    };

    img.src = url;
  });
}

/** Mostra o peso de um jeito legivel: "312 KB", "1,2 MB". */
export function pesoLegivel(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
