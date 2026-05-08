"use server";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { checkAdminAccess } from "./auth";
import { sendLeadFollowUpEmail } from "@/lib/email";
import { buildProspectingEmailContext } from "@/lib/crm/buildProspectingEmail";
import { resolveProspectingEmailFromTemplate } from "./emailTemplates";
import { LEAD_TIPO_VALUES } from "@/lib/crm/leadTipoProjetoOptions";
import {
  isValidTelemovelPt,
  sanitizeTelemovel,
  TELEMOVEL_ERRO_FORMATO,
  TELEMOVEL_ERRO_OBRIGATORIO,
} from "@/lib/crm/telemovelPt";

export type CrmLeadRow = {
  id: string;
  created_at: string;
  nome: string;
  email: string;
  telemovel: string | null;
  empresa: string | null;
  tipo_projeto: string;
  descricao: string;
  metadata: Record<string, unknown>;
  /** `website` (formulário público), `prospeccao` (criada no CRM), etc. */
  origem: string | null;
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

export type GetCrmLeadsInput = {
  stage?: string;
  ownerUserId?: string;
  onlySlaRisk?: boolean;
  page?: number;
  pageSize?: number;
};

export type GetCrmLeadsResult = {
  data: CrmLeadListItem[];
  error: string | null;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ProfileBasic = {
  id: string;
  nome: string | null;
  role: string;
};

/** Notas de handoff comercial → delivery (guardadas em `leads_inbound.metadata.handoff`). */
export type LeadHandoffNotes = {
  escopo_resumo?: string;
  proximos_passos_delivery?: string;
  contacto_delivery?: string;
};

const ALLOWED_STAGES = new Set(["new", "qualified", "proposal", "won", "lost"]);

const MAX_BULK_LEADS = 100;
const MAX_BULK_PROSPECTING_EMAILS = 50;
const MAX_BULK_DELETE_LEADS = 100;

function isValidEmailStrict(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("crm_lead_timeline").insert({
    lead_id: payload.leadId,
    event_type: payload.eventType,
    created_by: payload.createdBy ?? null,
    payload: payload.data ?? {},
  });
  return { error: error?.message ?? null };
}

export async function getCrmOwners(): Promise<{ data: ProfileBasic[]; error: string | null }> {
  const { allowed } = await checkAdminAccess();
  if (!allowed) return { data: [], error: "Acesso negado" };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nome, role")
    // Equipa Flowly / internos: sem tenant de cliente OU papéis de controlo (evita listar perfis de tenants SaaS).
    .or("tenant_id.is.null,role.eq.superadmin,role.eq.developer")
    .order("nome", { ascending: true });

  if (error) return { data: [], error: error.message };
  return { data: (data as ProfileBasic[]) ?? [], error: null };
}

export async function getCrmLeads(input: GetCrmLeadsInput = {}): Promise<GetCrmLeadsResult> {
  const { allowed } = await checkAdminAccess();
  if (!allowed) {
    return { data: [], error: "Acesso negado", total: 0, page: 1, pageSize: 20, totalPages: 0 };
  }

  const pageSize = Math.min(100, Math.max(5, input.pageSize ?? 20));
  const page = Math.max(1, input.page ?? 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createServerSupabase();
  let leadsQuery = supabase
    .from("leads_inbound")
    .select(
      "id, created_at, nome, email, telemovel, empresa, tipo_projeto, descricao, metadata, origem, estado, owner_user_id, stage_id, first_contact_at, next_action_at, updated_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (input.stage && ALLOWED_STAGES.has(input.stage)) {
    leadsQuery = leadsQuery.eq("stage_id", input.stage);
  }

  if (input.ownerUserId) {
    if (input.ownerUserId === "none") {
      leadsQuery = leadsQuery.is("owner_user_id", null);
    } else {
      leadsQuery = leadsQuery.eq("owner_user_id", input.ownerUserId);
    }
  }

  if (input.onlySlaRisk) {
    const riskThresholdIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    leadsQuery = leadsQuery.or(`next_action_at.is.null,next_action_at.lt.${riskThresholdIso}`);
  }

  const { data: leads, error: leadsError, count } = await leadsQuery;

  if (leadsError) {
    return {
      data: [],
      error: leadsError.message,
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  const leadRows = (leads as CrmLeadRow[]) ?? [];
  if (leadRows.length === 0) {
    const total = count ?? 0;
    return {
      data: [],
      error: null,
      total,
      page,
      pageSize,
      totalPages: total > 0 ? Math.ceil(total / pageSize) : 0,
    };
  }

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

  const total = count ?? 0;
  return {
    data,
    error: null,
    total,
    page,
    pageSize,
    totalPages: total > 0 ? Math.ceil(total / pageSize) : 0,
  };
}

/** Contagens globais do pipeline (sem filtros da lista) — métricas operacionais Bloco 4. */
const PIPELINE_STAGE_IDS = ["new", "qualified", "proposal", "won", "lost"] as const;

export type CrmPipelineCounts = {
  total: number;
  byStage: Record<(typeof PIPELINE_STAGE_IDS)[number], number>;
  /** Mesmo critério que «SLA em risco» na lista: sem próxima ação ou prazo antes de 24 h. */
  slaRiskTotal: number;
  /** Tarefas CRM pendentes (todas as leads). */
  pendingTasksTotal: number;
};

type PipelineCountsRpcPayload = {
  total?: number;
  by_stage?: Partial<Record<(typeof PIPELINE_STAGE_IDS)[number], number>>;
  sla_risk_total?: number;
  pending_tasks_total?: number;
};

async function getCrmLeadPipelineCountsLegacy(supabase: Awaited<ReturnType<typeof createServerSupabase>>): Promise<{
  data: CrmPipelineCounts | null;
  error: string | null;
}> {
  const riskThresholdIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const results = await Promise.all([
    supabase.from("leads_inbound").select("*", { count: "exact", head: true }),
    ...PIPELINE_STAGE_IDS.map((stage) =>
      supabase.from("leads_inbound").select("*", { count: "exact", head: true }).eq("stage_id", stage)
    ),
    supabase
      .from("leads_inbound")
      .select("*", { count: "exact", head: true })
      .or(`next_action_at.is.null,next_action_at.lt.${riskThresholdIso}`),
    supabase.from("crm_lead_tasks").select("*", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  for (const res of results) {
    if (res.error) return { data: null, error: res.error.message };
  }

  const totalRes = results[0];
  const pendingTasksRes = results[results.length - 1];
  const slaRes = results[results.length - 2];
  const stageResults = results.slice(1, -2);

  const byStage = {
    new: stageResults[0]?.count ?? 0,
    qualified: stageResults[1]?.count ?? 0,
    proposal: stageResults[2]?.count ?? 0,
    won: stageResults[3]?.count ?? 0,
    lost: stageResults[4]?.count ?? 0,
  };

  return {
    data: {
      total: totalRes.count ?? 0,
      byStage,
      slaRiskTotal: slaRes.count ?? 0,
      pendingTasksTotal: pendingTasksRes.count ?? 0,
    },
    error: null,
  };
}

export async function getCrmLeadPipelineCounts(): Promise<{
  data: CrmPipelineCounts | null;
  error: string | null;
}> {
  const { allowed } = await checkAdminAccess();
  if (!allowed) {
    return { data: null, error: "Acesso negado" };
  }

  const supabase = await createServerSupabase();
  const { data: rpcRaw, error: rpcError } = await supabase.rpc("flowly_crm_pipeline_counts");

  if (!rpcError && rpcRaw != null) {
    const row = rpcRaw as PipelineCountsRpcPayload;
    const by = row.by_stage ?? {};
    return {
      data: {
        total: Number(row.total ?? 0),
        byStage: {
          new: Number(by.new ?? 0),
          qualified: Number(by.qualified ?? 0),
          proposal: Number(by.proposal ?? 0),
          won: Number(by.won ?? 0),
          lost: Number(by.lost ?? 0),
        },
        slaRiskTotal: Number(row.sla_risk_total ?? 0),
        pendingTasksTotal: Number(row.pending_tasks_total ?? 0),
      },
      error: null,
    };
  }

  return getCrmLeadPipelineCountsLegacy(supabase);
}

export async function createManualLead(input: {
  nome: string;
  email: string;
  telemovel: string;
  empresa: string;
  tipo_projeto: string;
  tipo_projeto_outro?: string | null;
  descricao: string;
}): Promise<{ success: boolean; error: string | null; leadId?: string }> {
  const { allowed } = await checkAdminAccess();
  if (!allowed) return { success: false, error: "Acesso negado" };

  const nome = input.nome.trim().slice(0, 120);
  const email = input.email.trim().toLowerCase().slice(0, 180);
  const telemovel = sanitizeTelemovel(input.telemovel);
  const empresa = input.empresa.trim().slice(0, 160);
  const descricao = input.descricao.trim().slice(0, 4000);
  const tipoProjetoOutro = input.tipo_projeto_outro?.trim().slice(0, 160) || null;

  if (nome.length < 2) return { success: false, error: "Indica um nome válido." };
  if (!isValidEmailStrict(email)) return { success: false, error: "Email inválido." };
  if (!telemovel) return { success: false, error: TELEMOVEL_ERRO_OBRIGATORIO };
  if (!isValidTelemovelPt(telemovel)) return { success: false, error: TELEMOVEL_ERRO_FORMATO };
  if (empresa.length < 2) return { success: false, error: "Indica a empresa ou organização (mínimo 2 caracteres)." };
  if (!LEAD_TIPO_VALUES.has(input.tipo_projeto)) return { success: false, error: "Tipo de projeto inválido." };
  if (input.tipo_projeto === "outro" && (tipoProjetoOutro?.length ?? 0) < 3) {
    return { success: false, error: "Descreve o tipo de projeto em «Outro»." };
  }
  if (descricao.length < 10) return { success: false, error: "A nota / contexto deve ter pelo menos 10 caracteres." };

  const supabase = await createServerSupabase();
  const profile = await getCurrentProfile(supabase);

  const { data: row, error } = await supabase
    .from("leads_inbound")
    .insert({
      nome,
      email,
      telemovel,
      empresa,
      tipo_projeto: input.tipo_projeto,
      orcamento: null,
      descricao,
      origem: "prospeccao",
      estado: "new",
      metadata: {
        criado_via: "crm_manual",
        tipo_projeto_outro: input.tipo_projeto === "outro" ? tipoProjetoOutro : null,
        criado_por_user_id: profile?.id ?? null,
      },
    })
    .select("id")
    .single();

  if (error || !row) return { success: false, error: error?.message ?? "Não foi possível criar a lead." };

  const tl = await logTimeline(supabase, {
    leadId: row.id,
    eventType: "lead_created",
    createdBy: profile?.id,
    data: { origem: "prospeccao", manual: true },
  });
  if (tl.error) console.error("[createManualLead] timeline:", tl.error);

  revalidatePath("/central-saas/leads");
  revalidatePath(`/central-saas/leads/${row.id}`);
  return { success: true, error: null, leadId: row.id };
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

  const tl = await logTimeline(supabase, {
    leadId,
    eventType: "owner_changed",
    createdBy: profile?.id,
    data: {
      previous_owner_user_id: existing.owner_user_id,
      owner_user_id: ownerUserId,
    },
  });
  if (tl.error) console.error("[assignLeadOwner] timeline:", tl.error);

  revalidatePath("/central-saas/leads");
  return { success: true, error: null };
}

export async function updateLeadHandoffNotes(
  leadId: string,
  patch: LeadHandoffNotes
): Promise<{ success: boolean; error: string | null }> {
  const { allowed } = await checkAdminAccess();
  if (!allowed) return { success: false, error: "Acesso negado" };

  const supabase = await createServerSupabase();
  const { data: row, error: fetchErr } = await supabase
    .from("leads_inbound")
    .select("metadata")
    .eq("id", leadId)
    .single();

  if (fetchErr || !row) return { success: false, error: fetchErr?.message ?? "Lead não encontrada" };

  const meta = (row.metadata as Record<string, unknown>) ?? {};
  const prevHandoff = (meta.handoff as Record<string, unknown>) ?? {};
  const nextHandoff = { ...prevHandoff };
  for (const key of Object.keys(patch) as (keyof LeadHandoffNotes)[]) {
    const val = patch[key];
    if (val === undefined || val.trim() === "") {
      delete nextHandoff[key as string];
    } else {
      nextHandoff[key as string] = val.trim();
    }
  }
  const nextMeta = { ...meta, handoff: nextHandoff };

  const { error } = await supabase.from("leads_inbound").update({ metadata: nextMeta }).eq("id", leadId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/central-saas/leads/${leadId}`);
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

  const tl = await logTimeline(supabase, {
    leadId,
    eventType: "stage_changed",
    createdBy: profile?.id,
    data: {
      previous_stage_id: existing.stage_id ?? existing.estado,
      stage_id: stageId,
    },
  });
  if (tl.error) console.error("[moveLeadStage] timeline:", tl.error);

  revalidatePath("/central-saas/leads");
  return { success: true, error: null };
}

export async function bulkMoveLeadStage(
  leadIds: string[],
  stageId: string
): Promise<{ success: boolean; error: string | null; updated: number }> {
  const { allowed } = await checkAdminAccess();
  if (!allowed) return { success: false, error: "Acesso negado", updated: 0 };
  if (!ALLOWED_STAGES.has(stageId)) return { success: false, error: "Etapa inválida", updated: 0 };

  const ids = [...new Set(leadIds)].filter(Boolean).slice(0, MAX_BULK_LEADS);
  if (ids.length === 0) return { success: false, error: "Nenhuma lead selecionada.", updated: 0 };

  const supabase = await createServerSupabase();
  const profile = await getCurrentProfile(supabase);

  const { data: rows, error: fetchError } = await supabase
    .from("leads_inbound")
    .select("id, stage_id, estado")
    .in("id", ids);

  if (fetchError) return { success: false, error: fetchError.message, updated: 0 };
  if (!rows?.length) return { success: false, error: "Nenhuma lead encontrada.", updated: 0 };

  const { error: upError } = await supabase
    .from("leads_inbound")
    .update({ stage_id: stageId, estado: stageId })
    .in(
      "id",
      rows.map((r) => r.id)
    );

  if (upError) return { success: false, error: upError.message, updated: 0 };

  for (const row of rows) {
    const prev = (row.stage_id ?? row.estado) as string;
    if (prev === stageId) continue;
    const tl = await logTimeline(supabase, {
      leadId: row.id,
      eventType: "stage_changed",
      createdBy: profile?.id,
      data: {
        previous_stage_id: prev,
        stage_id: stageId,
        bulk: true,
      },
    });
    if (tl.error) console.error("[bulkMoveLeadStage] timeline:", tl.error);
  }

  revalidatePath("/central-saas/leads");
  return { success: true, error: null, updated: rows.length };
}

export async function bulkAssignLeadOwner(
  leadIds: string[],
  ownerUserId: string | null
): Promise<{ success: boolean; error: string | null; updated: number }> {
  const { allowed } = await checkAdminAccess();
  if (!allowed) return { success: false, error: "Acesso negado", updated: 0 };

  const ids = [...new Set(leadIds)].filter(Boolean).slice(0, MAX_BULK_LEADS);
  if (ids.length === 0) return { success: false, error: "Nenhuma lead selecionada.", updated: 0 };

  const supabase = await createServerSupabase();
  const profile = await getCurrentProfile(supabase);
  const nowIso = new Date().toISOString();

  const { data: rows, error: fetchError } = await supabase
    .from("leads_inbound")
    .select("id, owner_user_id")
    .in("id", ids);

  if (fetchError) return { success: false, error: fetchError.message, updated: 0 };
  if (!rows?.length) return { success: false, error: "Nenhuma lead encontrada.", updated: 0 };

  const needsChange = rows.filter((r) => r.owner_user_id !== ownerUserId);
  let updated = 0;
  for (const row of needsChange) {
    const { error } = await supabase
      .from("leads_inbound")
      .update({
        owner_user_id: ownerUserId,
        first_contact_at: row.owner_user_id ? undefined : nowIso,
        next_action_at: nowIso,
      })
      .eq("id", row.id);

    if (error) {
      console.error("[bulkAssignLeadOwner] update:", row.id, error.message);
      continue;
    }

    updated++;
    const tl = await logTimeline(supabase, {
      leadId: row.id,
      eventType: "owner_changed",
      createdBy: profile?.id,
      data: {
        previous_owner_user_id: row.owner_user_id,
        owner_user_id: ownerUserId,
        bulk: true,
      },
    });
    if (tl.error) console.error("[bulkAssignLeadOwner] timeline:", tl.error);
  }

  revalidatePath("/central-saas/leads");
  if (updated === 0 && needsChange.length > 0) {
    return { success: false, error: "Não foi possível atualizar os donos.", updated: 0 };
  }
  return { success: true, error: null, updated };
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

  const tl = await logTimeline(supabase, {
    leadId: input.leadId,
    eventType: "task_created",
    createdBy: profile?.id,
    data: {
      task_id: data.id,
      title: data.title,
      due_at: data.due_at,
    },
  });
  if (tl.error) console.error("[createLeadTask] timeline:", tl.error);

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

  const tl = await logTimeline(supabase, {
    leadId: existing.lead_id,
    eventType: "task_done",
    createdBy: profile?.id,
    data: {
      task_id: existing.id,
      title: existing.title,
    },
  });
  if (tl.error) console.error("[completeLeadTask] timeline:", tl.error);

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
    owners: ProfileBasic[];
    tasks: CrmLeadTask[];
    timeline: CrmTimelineItem[];
  };
  error: string | null;
  notFound: boolean;
}> {
  const { allowed } = await checkAdminAccess();
  if (!allowed) {
    return { data: { lead: null, owner: null, owners: [], tasks: [], timeline: [] }, error: "Acesso negado", notFound: false };
  }

  const supabase = await createServerSupabase();
  const { data: lead, error: leadError } = await supabase
    .from("leads_inbound")
    .select(
      "id, created_at, nome, email, telemovel, empresa, tipo_projeto, descricao, metadata, origem, estado, owner_user_id, stage_id, first_contact_at, next_action_at, updated_at"
    )
    .eq("id", leadId)
    .single();

  if (leadError || !lead) {
    return {
      data: { lead: null, owner: null, owners: [], tasks: [], timeline: [] },
      error: leadError?.message ?? "Lead não encontrada",
      notFound: true,
    };
  }

  const leadRow = lead as CrmLeadRow;
  const [ownerRes, ownersRes, tasksRes, timelineRes] = await Promise.all([
    leadRow.owner_user_id
      ? supabase.from("profiles").select("id, nome, role").eq("id", leadRow.owner_user_id).single()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("profiles")
      .select("id, nome, role")
      .or("tenant_id.is.null,role.eq.superadmin,role.eq.developer")
      .order("nome", { ascending: true }),
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
      owners: (ownersRes.data as ProfileBasic[]) ?? [],
      tasks: (tasksRes.data as CrmLeadTask[]) ?? [],
      timeline: (timelineRes.data as CrmTimelineItem[]) ?? [],
    },
    error: ownersRes.error?.message ?? tasksRes.error?.message ?? timelineRes.error?.message ?? null,
    notFound: false,
  };
}

export async function sendLeadEmail(input: {
  leadId: string;
  subject: string;
  message: string;
  /** Se preenchido, fica registado na timeline (envios de prospecção em massa). */
  prospectingTemplateId?: string | null;
}): Promise<{ success: boolean; error: string | null; warning?: string | null }> {
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
    /** Gmail usa o «De» como destino do «Responder», não só o Reply-To — precisa do tag +lead- no From. */
    from: leadReplyTo,
  });

  if (!sendResult.success) {
    return { success: false, error: sendResult.error ?? "Falha ao enviar email." };
  }

  const tl = await logTimeline(supabase, {
    leadId: input.leadId,
    eventType: "email_sent",
    createdBy: profile?.id,
    data: {
      subject,
      to: lead.email,
      reply_to: leadReplyTo,
      message_id: sendResult.messageId ?? null,
      body: message,
      ...(input.prospectingTemplateId ? { prospecting_template_id: input.prospectingTemplateId } : {}),
    },
  });

  revalidatePath(`/central-saas/leads/${input.leadId}`);
  if (tl.error) {
    console.error("[sendLeadEmail] timeline:", tl.error);
    return {
      success: true,
      error: null,
      warning:
        "O email foi enviado, mas não foi possível registar o envio na timeline. Verifica políticas RLS em crm_lead_timeline ou tenta outra vez.",
    };
  }
  return { success: true, error: null };
}

export async function bulkSendProspectingEmails(
  leadIds: string[],
  templateId: string,
  draft?: { subject_template?: string; body_template?: string }
): Promise<{ success: boolean; error: string | null; sent: number; failed: number }> {
  const { allowed } = await checkAdminAccess();
  if (!allowed) return { success: false, error: "Acesso negado", sent: 0, failed: 0 };

  const ids = [...new Set(leadIds)].filter(Boolean).slice(0, MAX_BULK_PROSPECTING_EMAILS);
  if (ids.length === 0) return { success: false, error: "Nenhuma lead selecionada.", sent: 0, failed: 0 };

  const supabase = await createServerSupabase();
  const { data: rows, error: fetchError } = await supabase
    .from("leads_inbound")
    .select("id, nome, email, empresa")
    .in("id", ids);

  if (fetchError) return { success: false, error: fetchError.message, sent: 0, failed: 0 };
  if (!rows?.length) return { success: false, error: "Nenhuma lead encontrada.", sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    const ctx = buildProspectingEmailContext(row.nome, row.empresa);
    const built = await resolveProspectingEmailFromTemplate(templateId, ctx, draft);
    if (!built) {
      failed++;
      continue;
    }
    const result = await sendLeadEmail({
      leadId: row.id,
      subject: built.subject,
      message: built.message,
      prospectingTemplateId: templateId,
    });
    if (result.success) sent++;
    else failed++;
  }

  revalidatePath("/central-saas/leads");

  if (sent === 0 && failed > 0) {
    return { success: false, error: "Não foi possível enviar os emails.", sent: 0, failed };
  }
  return { success: true, error: failed > 0 ? `${failed} envio(s) falharam.` : null, sent, failed };
}

export async function deleteLead(leadId: string): Promise<{ success: boolean; error: string | null }> {
  const { allowed } = await checkAdminAccess();
  if (!allowed) return { success: false, error: "Acesso negado" };

  const id = leadId.trim();
  if (!id) return { success: false, error: "Identificador inválido." };

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("leads_inbound").delete().eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/central-saas/leads");
  return { success: true, error: null };
}

export async function bulkDeleteLeads(
  leadIds: string[]
): Promise<{ success: boolean; error: string | null; deleted: number }> {
  const { allowed } = await checkAdminAccess();
  if (!allowed) return { success: false, error: "Acesso negado", deleted: 0 };

  const ids = [...new Set(leadIds)].filter(Boolean).slice(0, MAX_BULK_DELETE_LEADS);
  if (ids.length === 0) return { success: false, error: "Nenhuma lead selecionada.", deleted: 0 };

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("leads_inbound").delete().in("id", ids);
  if (error) return { success: false, error: error.message, deleted: 0 };

  revalidatePath("/central-saas/leads");
  return { success: true, error: null, deleted: ids.length };
}
