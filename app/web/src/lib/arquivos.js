/**
 * arquivos.js - O que as telas com anexo (documento, sinistro) tem em comum:
 * conferir tipo e tamanho, ler o arquivo como data URL (e assim que a API
 * recebe) e mostrar o tamanho de um jeito legivel.
 */
export const TIPOS_ACEITOS = ["application/pdf", "image/jpeg", "image/png"];
export const ACEITAR = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
export const MAX_BYTES = 10 * 1024 * 1024;

export function tamanhoArquivo(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/** Devolve a mensagem de erro, ou "" quando o arquivo pode ser enviado. */
export function conferirArquivo(arquivo) {
  if (!arquivo) return "";
  if (!TIPOS_ACEITOS.includes(arquivo.type)) return `"${arquivo.name}": envie em PDF, JPG ou PNG.`;
  if (arquivo.size > MAX_BYTES) return `"${arquivo.name}" passa de 10 MB.`;
  return "";
}

export function lerComoDataUrl(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result);
    leitor.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    leitor.readAsDataURL(arquivo);
  });
}

/** Envia um arquivo para a rota de anexos (ex.: /frotas/sinistros/5/arquivos). */
export async function enviarArquivo(api, caminho, arquivo) {
  const dataUrl = await lerComoDataUrl(arquivo);
  return api(caminho, { method: "POST", body: { nome: arquivo.name, dataUrl } });
}
