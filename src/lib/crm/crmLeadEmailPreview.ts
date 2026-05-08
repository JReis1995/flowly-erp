/** Replica o bloco final do texto simples em `sendLeadFollowUpEmail` (email.ts). */
export function appendCrmLeadEmailSignaturePlain(bodyWithGreeting: string): string {
  const email = process.env.EMAIL_SIGNATURE_EMAIL || "comercial@flowly.pt";
  return `${bodyWithGreeting.trim()}\n\n—\nEquipa Flowly · ${email}`;
}

/** Texto simples completo tal como enviado no multipart (Resend `text:`). */
export function buildCrmLeadFollowUpFullPlainText(subject: string, bodyWithGreeting: string): string {
  return `${subject.trim()}\n\n${appendCrmLeadEmailSignaturePlain(bodyWithGreeting)}`;
}
