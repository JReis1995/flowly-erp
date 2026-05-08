/** Substitui `{{chave}}` no texto (escape das chaves não previsto — usar só placeholders permitidos). */
export function substituteTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, val] of Object.entries(vars)) {
    out = out.replaceAll(`{{${key}}}`, val);
  }
  return out;
}
