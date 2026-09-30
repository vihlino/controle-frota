/**
 * regrasSenha.js - As regras de senha do SITRA, conferidas enquanto se digita.
 *
 * QUEM DECIDE e o servidor (api/src/regrasSenha.js, problemaNaSenha). Esta
 * copia existe para a pessoa VER as regras antes de salvar: a tela anterior,
 * quando o servidor recusava, respondia so "facil demais de adivinhar" sem
 * dizer o que estava errado.
 *
 * Mudou uma regra la, muda aqui tambem - senao a tela mostra tudo verde e o
 * servidor recusa.
 */

/** Palavras que a senha nao pode conter, em qualquer posicao. */
export const PALAVRAS_PROIBIDAS = ["sitra", "senha", "123456", "admin", "cmtt", "mudar123", "trocar123"];

export const TAMANHO_MINIMO = 8;

/**
 * Cada regra, com o texto que aparece na tela e se a senha digitada ja cumpre.
 *
 * Senha vazia nao cumpre nenhuma - senao "nao ser so numeros" e "nao conter
 * palavra proibida" apareceriam verdes antes de a pessoa digitar qualquer coisa.
 *
 * @param {string} senha
 * @param {string} [login] Login do usuario, quando ja se sabe.
 * @returns {Array<{texto: string, ok: boolean}>}
 */
export function conferirSenha(senha, login) {
  const s = String(senha || "");
  const baixa = s.toLowerCase();
  const digitou = s.length > 0;
  const proibida = PALAVRAS_PROIBIDAS.find((p) => baixa.includes(p));
  const loginLimpo = String(login || "").trim();

  return [
    {
      texto: `Ter ${TAMANHO_MINIMO} caracteres ou mais` +
             (digitou && s.length < TAMANHO_MINIMO ? ` (tem ${s.length})` : ""),
      ok: s.length >= TAMANHO_MINIMO,
    },
    {
      texto: "Não ser só números",
      ok: digitou && !/^\d+$/.test(s),
    },
    {
      texto: loginLimpo ? `Ser diferente do login (${loginLimpo})` : "Ser diferente do login",
      ok: digitou && (!loginLimpo || baixa !== loginLimpo.toLowerCase()),
    },
    {
      // Quando uma palavra proibida aparece, a regra diz QUAL - e isso que a
      // pessoa precisa para consertar.
      texto: proibida
        ? `Não conter "${proibida}"`
        : "Não conter sitra, cmtt, admin, senha ou 123456",
      ok: digitou && !proibida,
    },
  ];
}

/** true quando a senha cumpre todas as regras. */
export function senhaAceita(senha, login) {
  return conferirSenha(senha, login).every((r) => r.ok);
}
