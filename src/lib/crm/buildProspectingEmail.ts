/** Contexto para variáveis de templates de prospecção ({{primeiro_nome}}, {{nome}}, {{empresa}}). */
export type ProspectingEmailContext = {
  primeiroNome: string;
  nome: string;
  empresa: string;
};

function primeiroNomeFromNome(nome: string): string {
  const p = nome.trim().split(/\s+/)[0];
  return p || nome.trim() || "Cliente";
}

export function buildProspectingEmailContext(nome: string, empresa: string | null): ProspectingEmailContext {
  const n = nome.trim();
  return {
    primeiroNome: primeiroNomeFromNome(n),
    nome: n,
    empresa: (empresa ?? "").trim(),
  };
}
