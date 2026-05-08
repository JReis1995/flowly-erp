"use server";

import { revalidatePath } from "next/cache";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { checkAdminAccess } from "./auth";
import { composeOutboundPlainBody, composeSubject, type EmailTemplateKind } from "@/lib/crm/composeCrmEmail";
import type { ProspectingEmailContext } from "@/lib/crm/buildProspectingEmail";
import { EMAIL_TEMPLATE_PREVIEW_SAMPLES, emailTemplateVarsFromLead } from "@/lib/crm/emailTemplateVars";
import { buildCrmLeadFollowUpFullPlainText } from "@/lib/crm/crmLeadEmailPreview";

export type CrmEmailTemplateRow = {
  id: string;
  kind: EmailTemplateKind;
  slug: string;
  label: string;
  subject_template: string;
  body_template: string;
  area_label: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: async (name: string) => (await cookieStore).get(name)?.value,
        set: async (name: string, value: string, options: CookieOptions) => {
          (await cookieStore).set({ name, value, ...options });
        },
        remove: async (name: string, options: CookieOptions) => {
          (await cookieStore).set({ name, value: "", ...options });
        },
      },
    }
  );
}

export async function listEmailTemplates(kind?: EmailTemplateKind): Promise<{
  data: CrmEmailTemplateRow[];
  error: string | null;
}> {
  const { allowed } = await checkAdminAccess();
  if (!allowed) return { data: [], error: "Acesso negado" };

  const supabase = await createServerSupabase();
  let q = supabase.from("crm_email_templates").select("*").order("sort_order", { ascending: true });
  if (kind) q = q.eq("kind", kind);

  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return { data: (data as CrmEmailTemplateRow[]) ?? [], error: null };
}

export async function getEmailTemplate(id: string): Promise<{
  data: CrmEmailTemplateRow | null;
  error: string | null;
}> {
  const { allowed } = await checkAdminAccess();
  if (!allowed) return { data: null, error: "Acesso negado" };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("crm_email_templates").select("*").eq("id", id).single();
  if (error) return { data: null, error: error.message };
  return { data: data as CrmEmailTemplateRow, error: null };
}

export async function createEmailTemplate(input: {
  kind: EmailTemplateKind;
  slug: string;
  label: string;
  subject_template: string;
  body_template: string;
  area_label?: string | null;
  sort_order?: number;
}): Promise<{ success: boolean; error: string | null; id?: string }> {
  const { allowed } = await checkAdminAccess();
  if (!allowed) return { success: false, error: "Acesso negado" };

  const slug = input.slug.trim().toLowerCase();
  if (!SLUG_RE.test(slug)) return { success: false, error: "Slug inválido (usa minúsculas, números e hífens)." };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("crm_email_templates")
    .insert({
      kind: input.kind,
      slug,
      label: input.label.trim(),
      subject_template: input.subject_template.trim(),
      body_template: input.body_template.trim(),
      area_label: input.area_label?.trim() || null,
      sort_order: input.sort_order ?? 0,
    })
    .select("id")
    .single();

  if (error || !data) return { success: false, error: error?.message ?? "Erro ao criar." };

  revalidatePath("/central-saas/leads");
  revalidatePath("/central-saas/leads/templates");
  return { success: true, error: null, id: data.id };
}

export async function updateEmailTemplate(
  id: string,
  patch: Partial<{
    label: string;
    subject_template: string;
    body_template: string;
    area_label: string | null;
    sort_order: number;
  }>
): Promise<{ success: boolean; error: string | null }> {
  const { allowed } = await checkAdminAccess();
  if (!allowed) return { success: false, error: "Acesso negado" };

  const supabase = await createServerSupabase();
  const row: Record<string, unknown> = {};
  if (patch.label !== undefined) row.label = patch.label.trim();
  if (patch.subject_template !== undefined) row.subject_template = patch.subject_template.trim();
  if (patch.body_template !== undefined) row.body_template = patch.body_template.trim();
  if (patch.area_label !== undefined) row.area_label = patch.area_label?.trim() || null;
  if (patch.sort_order !== undefined) row.sort_order = patch.sort_order;

  const { error } = await supabase.from("crm_email_templates").update(row).eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/central-saas/leads");
  revalidatePath("/central-saas/leads/templates");
  return { success: true, error: null };
}

export async function deleteEmailTemplate(id: string): Promise<{ success: boolean; error: string | null }> {
  const { allowed } = await checkAdminAccess();
  if (!allowed) return { success: false, error: "Acesso negado" };

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("crm_email_templates").delete().eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/central-saas/leads");
  revalidatePath("/central-saas/leads/templates");
  return { success: true, error: null };
}

/** Resolve texto final para envio de prospecção (usa linha «Olá …» em compose). */
export async function resolveProspectingEmailFromTemplate(
  templateId: string,
  ctx: ProspectingEmailContext,
  draft?: { subject_template?: string; body_template?: string }
): Promise<{ subject: string; message: string } | null> {
  const supabase = await createServerSupabase();
  const { data: row, error } = await supabase
    .from("crm_email_templates")
    .select("*")
    .eq("id", templateId)
    .eq("kind", "prospeccao")
    .maybeSingle();

  if (error || !row) return null;

  const subject_template = (draft?.subject_template ?? row.subject_template).trim();
  const body_template = (draft?.body_template ?? row.body_template).trim();

  const vars = {
    primeiro_nome: ctx.primeiroNome,
    nome: ctx.nome,
    empresa: ctx.empresa || "a sua equipa",
    projeto: ctx.nome,
  };
  const subject = composeSubject(subject_template, vars);
  const message = composeOutboundPlainBody("prospeccao", body_template, vars, ctx.nome);
  return { subject, message };
}

/** Preenche assunto e mensagem para o editor da lead (follow-up). */
export async function applyFollowUpTemplateToLead(
  templateId: string,
  leadId: string
): Promise<{ success: boolean; subject: string; message: string; error: string | null }> {
  const { allowed } = await checkAdminAccess();
  if (!allowed) return { success: false, subject: "", message: "", error: "Acesso negado" };

  const supabase = await createServerSupabase();
  const [{ data: row, error: tErr }, { data: lead, error: lErr }] = await Promise.all([
    supabase.from("crm_email_templates").select("*").eq("id", templateId).eq("kind", "follow_up").single(),
    supabase
      .from("leads_inbound")
      .select("nome, empresa, tipo_projeto")
      .eq("id", leadId)
      .single(),
  ]);

  if (tErr || !row) return { success: false, subject: "", message: "", error: "Modelo não encontrado." };
  if (lErr || !lead) return { success: false, subject: "", message: "", error: "Lead não encontrada." };

  const vars = emailTemplateVarsFromLead(lead as { nome: string; empresa: string | null; tipo_projeto: string });
  const subject = composeSubject(row.subject_template, vars);
  const message = composeOutboundPlainBody("follow_up", row.body_template, vars, lead.nome);

  return { success: true, subject, message, error: null };
}

/** Pré-visualização no editor de templates (sem enviar). Inclui `fullPlainText` como no envio real (assinatura). */
export async function previewEmailTemplateDraft(input: {
  kind: EmailTemplateKind;
  subject_template: string;
  body_template: string;
}): Promise<{ subject: string; plainBody: string; fullPlainText: string; error: string | null }> {
  const { allowed } = await checkAdminAccess();
  if (!allowed) return { subject: "", plainBody: "", fullPlainText: "", error: "Acesso negado" };

  const v = EMAIL_TEMPLATE_PREVIEW_SAMPLES;
  try {
    const subject = composeSubject(input.subject_template, v);
    const plainBody = composeOutboundPlainBody(input.kind, input.body_template, v, v.nome);
    const fullPlainText = buildCrmLeadFollowUpFullPlainText(subject, plainBody);
    return { subject, plainBody, fullPlainText, error: null };
  } catch {
    return { subject: "", plainBody: "", fullPlainText: "", error: "Erro ao montar pré-visualização." };
  }
}

/** Pré-visualização de um modelo já guardado (lista), com amostras fixas. */
export async function previewSavedEmailTemplate(id: string): Promise<{
  subject: string;
  plainBody: string;
  fullPlainText: string;
  error: string | null;
}> {
  const { allowed } = await checkAdminAccess();
  if (!allowed) return { subject: "", plainBody: "", fullPlainText: "", error: "Acesso negado" };

  const res = await getEmailTemplate(id);
  if (res.error || !res.data) return { subject: "", plainBody: "", fullPlainText: "", error: res.error ?? "Modelo não encontrado." };

  const row = res.data;
  const v = EMAIL_TEMPLATE_PREVIEW_SAMPLES;
  try {
    const subject = composeSubject(row.subject_template, v);
    const plainBody = composeOutboundPlainBody(row.kind, row.body_template, v, v.nome);
    const fullPlainText = buildCrmLeadFollowUpFullPlainText(subject, plainBody);
    return { subject, plainBody, fullPlainText, error: null };
  } catch {
    return { subject: "", plainBody: "", fullPlainText: "", error: "Erro ao montar pré-visualização." };
  }
}
