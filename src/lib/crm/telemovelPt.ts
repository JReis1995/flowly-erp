/** Limite alinhado com coluna `telemovel` e inputs do CRM / site. */
export const MAX_TELEMOVEL_CHARS = 32;

/**
 * Normaliza texto livre: `trim`, espaços consecutivos, limite de caracteres.
 */
export function sanitizeTelemovel(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, MAX_TELEMOVEL_CHARS);
}

/**
 * Telemóvel português: 9 dígitos nacionais (rede móvel 91, 92, 93, 96) com prefixo opcional 351.
 */
export function isValidTelemovelPt(value: string): boolean {
  const t = value.trim();
  if (!t) return false;
  let digits = t.replace(/\D/g, "");
  if (digits.startsWith("351")) {
    digits = digits.slice(3);
  }
  if (digits.length !== 9) return false;
  return /^9[1236]\d{7}$/.test(digits);
}

export const TELEMOVEL_ERRO_OBRIGATORIO =
  "Indica um número de telemóvel português (campo obrigatório).";

export const TELEMOVEL_ERRO_FORMATO =
  "O telemóvel deve ser português: 9 dígitos (ex.: 912 345 678 ou +351 912 345 678).";
