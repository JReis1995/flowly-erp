/** Alinhado ao formulário público (`LeadRequestForm`) para CRM manual e relatórios. */
export const LEAD_TIPO_PROJETO_OPTIONS = [
  { value: "crm", label: "CRM" },
  { value: "app-operacional", label: "Aplicação operacional" },
  { value: "gestao-filas", label: "Gestão de filas/atendimento" },
  { value: "website-corporativo", label: "Website corporativo" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "sistema-gestao", label: "Sistema de gestão" },
  { value: "automacoes-integracoes", label: "Automações e integrações" },
  { value: "outro", label: "Outro" },
] as const;

export const LEAD_TIPO_VALUES = new Set<string>(LEAD_TIPO_PROJETO_OPTIONS.map((o) => o.value));
