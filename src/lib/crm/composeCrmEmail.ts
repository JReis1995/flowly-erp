import { buildLeadEmailOpening } from "./leadEmailGreeting";
import { substituteTemplate } from "./templateSubstitute";

export type EmailTemplateKind = "prospeccao" | "follow_up";

/** Monta o texto plano final: saudação fixa + corpo (com placeholders já substituídos). Sem assinatura — gerida em `sendLeadFollowUpEmail`. */
export function composeOutboundPlainBody(
  kind: EmailTemplateKind,
  bodyTemplate: string,
  vars: Record<string, string>,
  nomeContacto: string
): string {
  const inner = substituteTemplate(bodyTemplate, vars).trim();
  if (kind === "prospeccao") {
    const pn = vars.primeiro_nome?.trim() || nomeContacto.trim().split(/\s+/)[0] || "Cliente";
    return `Olá ${pn},\n\n${inner}`;
  }
  return `${buildLeadEmailOpening(nomeContacto)}${inner}`;
}

export function composeSubject(subjectTemplate: string, vars: Record<string, string>): string {
  return substituteTemplate(subjectTemplate, vars).trim();
}
