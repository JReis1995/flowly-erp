"use server";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { checkAdminAccess } from "./auth";
import { sendLeadFollowUpEmail } from "@/lib/email";

export type CrmLeadRow = {
  id: string;
  created_at: string;
  nome: string;
  email: string;
  empresa: string | null;
  tipo_projeto: string;
  descricao: string;
  metadata: Record<string, unknown>;
  estado: "new" | "qualified" | "proposal" | "won" | "lost";
  owner_user_id: string | null;
  stage_id: "new" | "qualified" | "proposal" | "won" | "lost";
  first_contact_at: string | null;
  next_action_at: string | null;
  updated_at: string;
};

export type CrmLeadTask = {
  id: string;
  lead_id: string;
  title: string;
  due_at: string | null;
  status: "pending" | "done";
  assigned_user_id: string | null;
  created_at: string;
  completed_at: string | null;
};

export type CrmTimelineItem = {
  id: string;
  lead_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
};

export type CrmLeadListItem = CrmLeadRow & {
  owner_name: string | null;
  next_task: CrmLeadTask | null;
};

export type ProfileBasic = {
  id: string;
  nome: string | null;
  role: string;
};

const ALLOWED_STAGES = new Set(["new", "qualified", "proposal", "won", "lost"]);

async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: async (name: string) => {
          return (await cookieStore).get(name)?.value;
        },
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

async function getCurrentProfile(supabase: Awaited<ReturnType<typeof createServerSupabase>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, nome, role")
    .eq("id", user.id)
    .single();

  return (data as ProfileBasic | null) ?? null;
}

async function logTimeline(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  payload: {
    leadId: string;
    eventType: string;
    createdBy?: string | null;
    data?: Record<string, unknown>;
  }
) {
  await supabase.from("crm_lead_timeline").insert({
    lead_id: payload.leadId,
    event_type: payload.eventType,
    created_by: payload.createdBy ?? null,
    payload: payload.data ?? {},
  });
}

export async function getCrmOwners(): Promise<{ data: ProfileBasic[]; error: string | null }> {
  const { allowed } = await checkAdminAccess();
  if (!allowed) return { data: [], error: "Acesso negado" };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nome, role")
    // MVP: lista todos os perfis para permitir atribuição imediata de dono
    // mesmo quando existe apenas 1 utilizador com role não técnica.
    .order("nome", { ascending: true });

  if (error) return { data: [], error: error.message };
  return { data: (data as ProfileBasic[]) ?? [], error: null };
}

export async function getCrmLeads(): Promise<{ data: CrmLeadListItem[]; error: string | null }> {
  const { allowed } = await checkAdminAccess();
  if (!allowed) return { data: [], error: "Acesso negado" };

  const supabase = await createServerSupabase();
  const { data: leads, error: leadsError } = await supabase
    .from("leads_inbound")
    .select(
      "id, created_at, nome, email, empresa, tipo_projeto, descricao, metadata, estado, owner_user_id, stage_id, first_contact_at, next_action_at, updated_at"
    )
    .order("created_at", { ascending: false });

  if (leadsError) {
    return { data: [], error: leadsError.message };
  }

  const leadRows = (leads as CrmLeadRow[]) ?? [];
  if (leadRows.length === 0) return { data: [], error: null };

  const ownerIds = [...new Set(leadRows.map((lead) => lead.owner_user_id).filter(Boolean))] as string[];
  const leadIds = leadRows.map((lead) => lead.id);

  const [ownersRes, tasksRes] = await Promise.all([
    ownerIds.length
      ? supabase.from("profiles").select("id, nome").in("id", ownerIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("crm_lead_tasks")
      .select("id, lead_id, title, due_at, status, assigned_user_id, created_at, completed_at")
      .in("lead_id", leadIds)
      .eq("status", "pending")
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
  ]);

  const ownersMap = new Map<string, string>();
  (ownersRes.data ?? []).forEach((owner: { id: string; nome: string | null }) => {
    ownersMap.set(owner.id, owner.nome ?? "Sem nome");
  });

  const taskMap = new Map<string, CrmLeadTask>();
  ((tasksRes.data as CrmLeadTask[]) ?? []).forEach((task) => {
    if (!taskMap.has(task.lead_id)) taskMap.set(task.lead_id, task);
  });

  const data = leadRows.map((lead) => ({
    ...lead,
    owner_name: lead.owner_user_id ? ownersMap.get(lead.owner_user_id) ?? "Utilizador interno" : null,
    next_task: taskMap.get(lead.id) ?? null,
  }));

  return { data, error: null };
}

export async function assignLeadOwner(leadId: string, ownerUserId: string | null) {
  const { allowed } = await checkAdminAccess();
  if (!allowed) return { success: false, error: "Acesso negado" };

  const supabase = await createServerSupabase();
  const profile = await getCurrentProfile(supabase);
  const nowIso = new Date().toISOString();

  const { data: existing, error: getError } = await supabase
    .from("leads_inbound")
    .select("owner_user_id")
    .eq("id", leadId)
    .single();

  if (getError || !existing) return { success: false, error: getError?.message ?? "Lead não encontrada" };

  const { error } = await supabase
    .from("leads_inbound")
    .update({
      owner_user_id: ownerUserId,
      first_contact_at: existing.owner_user_id ? undefined : nowIso,
      next_action_at: nowIso,
    })
    .eq("id", leadId);

  if (error) return { success: false, error: error.message };

  await logTimeline(supabase, {
    leadId,
    eventType: "owner_changed",
    createdBy: profile?.id,
    data: {
      previous_owner_user_id: existing.owner_user_id,
      owner_user_id: ownerUserId,
    },
  });

  revalidatePath("/central-saas/leads");
  return { success: true, error: null };
}

export async function moveLeadStage(leadId: string, stageId: string) {
  const { allowed } = await checkAdminAccess();
  if (!allowed) return { success: false, error: "Acesso negado" };
  if (!ALLOWED_STAGES.has(stageId)) return { success: false, error: "Etapa inválida" };

  const supabase = await createServerSupabase();
  const profile = await getCurrentProfile(supabase);

  const { data: existing, error: getError } = await supabase
    .from("leads_inbound")
    .select("stage_id, estado")
    .eq("id", leadId)
    .single();

  if (getError || !existing) return { success: false, error: getError?.message ?? "Lead não encontrada" };

  const { error } = await supabase
    .from("leads_inbound")
    .update({
      stage_id: stageId,
      estado: stageId,
    })
    .eq("id", leadId);

  if (error) return { success: false, error: error.message };

  await logTimeline(supabase, {
    leadId,
    eventType: "stage_changed",
    createdBy: profile?.id,
    data: {
      previous_stage_id: existing.stage_id ?? existing.estado,
      stage_id: stageId,
    },
  });

  revalidatePath("/central-saas/leads");
  return { success: true, error: null };
}

export async function createLeadTask(input: {
  leadId: string;
  title: string;
  dueAt?: string | null;
  assignedUserId?: string | null;
}) {
  const { allowed } = await checkAdminAccess();
  if (!allowed) return { success: false, error: "Acesso negado" };

  const title = input.title.trim();
  if (title.length < 3) return { success: false, error: "Título da tarefa demasiado curto" };

  const supabase = await createServerSupabase();
  const profile = await getCurrentProfile(supabase);

  const { data, error } = await supabase
    .from("crm_lead_tasks")
    .insert({
      lead_id: input.leadId,
      title,
      due_at: input.dueAt ?? null,
      status: "pending",
      assigned_user_id: input.assignedUserId ?? null,
      created_by: profile?.id ?? null,
    })
    .select("id, lead_id, title, due_at, status, assigned_user_id, created_at, completed_at")
    .single();

  if (error || !data) return { success: false, error: error?.message ?? "Erro ao criar tarefa" };

  await supabase
    .from("leads_inbound")
    .update({ next_action_at: input.dueAt ?? new Date().toISOString() })
    .eq("id", input.leadId);

  await logTimeline(supabase, {
    leadId: input.leadId,
    eventType: "task_created",
    createdBy: profile?.id,
    data: {
      task_id: data.id,
      title: data.title,
      due_at: data.due_at,
    },
  });

  revalidatePath("/central-saas/leads");
  return { success: true, error: null, data: data as CrmLeadTask };
}

export async function completeLeadTask(taskId: string) {
  const { allowed } = await checkAdminAccess();
  if (!allowed) return { success: false, error: "Acesso negado" };

  const supabase = await createServerSupabase();
  const profile = await getCurrentProfile(supabase);

  const { data: existing, error: getError } = await supabase
    .from("crm_lead_tasks")
    .select("id, lead_id, title, status")
    .eq("id", taskId)
    .single();

  if (getError || !existing) return { success: false, error: getError?.message ?? "Tarefa não encontrada" };
  if (existing.status === "done") return { success: true, error: null };

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("crm_lead_tasks")
    .update({
      status: "done",
      completed_at: nowIso,
    })
    .eq("id", taskId);

  if (error) return { success: false, error: error.message };

  await logTimeline(supabase, {
    leadId: existing.lead_id,
    eventType: "task_done",
    createdBy: profile?.id,
    data: {
      task_id: existing.id,
      title: existing.title,
    },
  });

  revalidatePath("/central-saas/leads");
  return { success: true, error: null };
}

export async function getLeadTimeline(leadId: string): Promise<{ data: CrmTimelineItem[]; error: string | null }> {
  const { allowed } = await checkAdminAccess();
  if (!allowed) return { data: [], error: "Acesso negado" };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("crm_lead_timeline")
    .select("id, lead_id, event_type, payload, created_by, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return { data: [], error: error.message };
  return { data: (data as CrmTimelineItem[]) ?? [], error: null };
}

export async function getCrmLeadDetail(leadId: string): Promise<{
  data: {
    lead: CrmLeadRow | null;
    owner: ProfileBasic | null;
    tasks: CrmLeadTask[];
    timeline: CrmTimelineItem[];
  };
  error: string | null;
}> {
  const { allowed } = await checkAdminAccess();
  if (!allowed) {
    return { data: { lead: null, owner: null, tasks: [], timeline: [] }, error: "Acesso negado" };
  }

  const supabase = await createServerSupabase();
  const { data: lead, error: leadError } = await supabase
    .from("leads_inbound")
    .select(
      "id, created_at, nome, email, empresa, tipo_projeto, descricao, metadata, estado, owner_user_id, stage_id, first_contact_at, next_action_at, updated_at"
    )
    .eq("id", leadId)
    .single();

  if (leadError || !lead) {
    return { data: { lead: null, owner: null, tasks: [], timeline: [] }, error: leadError?.message ?? "Lead não encontrada" };
  }

  const leadRow = lead as CrmLeadRow;
  const [ownerRes, tasksRes, timelineRes] = await Promise.all([
    leadRow.owner_user_id
      ? supabase.from("profiles").select("id, nome, role").eq("id", leadRow.owner_user_id).single()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("crm_lead_tasks")
      .select("id, lead_id, title, due_at, status, assigned_user_id, created_at, completed_at")
      .eq("lead_id", leadId)
      .order("status", { ascending: true })
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("crm_lead_timeline")
      .select("id, lead_id, event_type, payload, created_by, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return {
    data: {
      lead: leadRow,
      owner: (ownerRes.data as ProfileBasic | null) ?? null,
      tasks: (tasksRes.data as CrmLeadTask[]) ?? [],
      timeline: (timelineRes.data as CrmTimelineItem[]) ?? [],
    },
    error: tasksRes.error?.message ?? timelineRes.error?.message ?? null,
  };
}

export async function sendLeadEmail(input: {
  leadId: string;
  subject: string;
  message: string;
}) {
  const { allowed } = await checkAdminAccess();
  if (!allowed) return { success: false, error: "Acesso negado" };

  const subject = input.subject.trim();
  const message = input.message.trim();
  if (subject.length < 3 || message.length < 3) {
    return { success: false, error: "Assunto e mensagem são obrigatórios." };
  }

  const supabase = await createServerSupabase();
  const profile = await getCurrentProfile(supabase);

  const { data: lead, error } = await supabase
    .from("leads_inbound")
    .select("id, nome, email")
    .eq("id", input.leadId)
    .single();

  if (error || !lead) {
    return { success: false, error: error?.message ?? "Lead não encontrada." };
  }

  const baseReplyTo = process.env.EMAIL_REPLY_TO_COMERCIAL || "comercial@inbound.flowly.pt";
  const [localPart, domainPart] = baseReplyTo.split("@");
  const leadReplyTo =
    localPart && domainPart ? `${localPart}+lead-${input.leadId.slice(0, 8)}@${domainPart}` : baseReplyTo;

  const sendResult = await sendLeadFollowUpEmail({
    to: lead.email,
    nome: lead.nome,
    subject,
    message,
    replyTo: leadReplyTo,
  });

  if (!sendResult.success) {
    return { success: false, error: sendResult.error ?? "Falha ao enviar email." };
  }

  await logTimeline(supabase, {
    leadId: input.leadId,
    eventType: "email_sent",
    createdBy: profile?.id,
    data: {
      subject,
      to: lead.email,
      reply_to: leadReplyTo,
      message_id: sendResult.messageId ?? null,
    },
  });

  revalidatePath(`/central-saas/leads/${input.leadId}`);
  return { success: true, error: null };
}
