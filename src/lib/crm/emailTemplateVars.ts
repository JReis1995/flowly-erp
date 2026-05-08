export function emailTemplateVarsFromLead(lead: {
  nome: string;
  empresa: string | null;
  tipo_projeto: string;
}) {
  const nome = lead.nome.trim();
  const primeiro = nome.split(/\s+/)[0] || nome;
  return {
    nome,
    primeiro_nome: primeiro,
    empresa: lead.empresa?.trim() || "a sua equipa",
    projeto: lead.tipo_projeto?.trim() || "o seu projeto",
  };
}

/** Amostras para pré-visualização no editor (substituem {{placeholders}}). */
export const EMAIL_TEMPLATE_PREVIEW_SAMPLES: Record<string, string> = {
  nome: "Maria Silva",
  primeiro_nome: "Maria",
  empresa: "Silva & Filhos, Lda.",
  projeto: "Operações e logística",
};
