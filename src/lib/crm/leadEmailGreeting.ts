/** Saudação fixa (Caro/Cara + nome) — usada antes do corpo editável do template. */
export function getLeadSaudacao(nome: string): string {
  const first = nome.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  const femaleExceptions = new Set(["dia", "noa", "luca", "nikita"]);
  const isLikelyFemale = first.endsWith("a") && !femaleExceptions.has(first);
  return isLikelyFemale ? "Cara" : "Caro";
}

/** Abertura padrão do email (saudação + nome); o corpo do template vem a seguir. A assinatura HTML é acrescentada em `sendLeadFollowUpEmail`. */
export function buildLeadEmailOpening(nome: string): string {
  const n = nome.trim() || "Cliente";
  return `${getLeadSaudacao(nome)} ${n},\n\n`;
}
