"use server";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { checkAdminAccess } from "./auth";
import { sendWelcomeEmail } from "@/lib/email";

// Helper para obter URL base da aplicação (produção vs desenvolvimento)
function getAppUrl(): string {
  // Prioridade: env var > vercel url > localhost
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, ''); // Remove trailing slash
  }
  
  // Se estiver no Vercel, usar o URL do deployment
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Fallback para desenvolvimento
  return 'http://localhost:3000';
}

// Tipos
export interface Tenant {
  id: string;
  nome_empresa: string;
  ramo_atividade: string | null;
  nif: string | null;
  gestor_nome: string;
  gestor_email: string;
  plano_id: string | null;
  plano_nome: string;
  desconto_percentual: number;
  desconto_tipo: "permanente" | "temporario" | null;
  desconto_validade: string | null;
  creditos_ia: number;
  creditos_ia_consumidos: number;
  modulo_logistica: boolean;
  modulo_condominios: boolean;
  modulo_frota: boolean;
  modulo_rh: boolean;
  modulo_cc: boolean;
  modulo_ia: boolean;
  status: "ativo" | "suspenso" | "cancelado" | "trial";
  validade_acesso: string | null;
  data_registo: string;
  ultimo_acesso: string | null;
  alerta_divida: boolean;
  alerta_divida_mensagem: string | null;
  divida_acumulada: number;
}

export interface CreateTenantInput {
  nome_empresa: string;
  ramo_atividade?: string;
  nif?: string;
  gestor_nome: string;
  gestor_email: string;
  plano_id?: string;
  plano_nome?: string;
  desconto_percentual?: number;
  desconto_tipo?: "permanente" | "temporario";
  desconto_validade?: string;
  creditos_ia?: number;
  modulo_logistica?: boolean;
  modulo_condominios?: boolean;
  modulo_frota?: boolean;
  modulo_rh?: boolean;
  modulo_cc?: boolean;
  modulo_ia?: boolean;
  validade_acesso?: string;
}

export interface UpdateTenantInput extends Partial<CreateTenantInput> {
  status?: "ativo" | "suspenso" | "cancelado" | "trial";
}

// Helper para criar cliente Supabase no servidor (Anon)
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

// Helper para criar cliente Supabase Admin (Service Role) - para operações privilegiadas
async function createAdminSupabase() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get: async () => undefined,
        set: async () => {},
        remove: async () => {},
      },
    }
  );
}


// Listar todos os tenants (apenas para admins)
export async function getTenants(
  status?: "ativo" | "suspenso" | "cancelado" | "trial"
): Promise<{ data: Tenant[]; error: string | null }> {
  const { allowed } = await checkAdminAccess();

  if (!allowed) {
    return { data: [], error: "Acesso negado" };
  }

  const supabase = await createServerSupabase();

  let query = supabase.from("tenants").select("*");

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query.order("data_registo", { ascending: false });

  if (error) {
    console.error("Erro ao buscar tenants:", error);
    return { data: [], error: error.message };
  }

  return { data: (data as Tenant[]) || [], error: null };
}

// Pesquisar tenants
export async function searchTenants(
  searchTerm: string
): Promise<{ data: Tenant[]; error: string | null }> {
  const { allowed } = await checkAdminAccess();

  if (!allowed) {
    return { data: [], error: "Acesso negado" };
  }

  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .or(
      `nome_empresa.ilike.%${searchTerm}%,gestor_email.ilike.%${searchTerm}%,nif.ilike.%${searchTerm}%`
    )
    .order("data_registo", { ascending: false });

  if (error) {
    console.error("Erro ao pesquisar tenants:", error);
    return { data: [], error: error.message };
  }

  return { data: (data as Tenant[]) || [], error: null };
}

// Criar novo tenant
export async function createTenant(
  input: CreateTenantInput
): Promise<{ success: boolean; data: Tenant | null; error: string | null }> {
  const { allowed } = await checkAdminAccess();

  if (!allowed) {
    return { success: false, data: null, error: "Acesso negado" };
  }

  const supabase = await createServerSupabase();

  // Verificar se email já existe
  const { data: existing } = await supabase
    .from("tenants")
    .select("id")
    .eq("gestor_email", input.gestor_email)
    .single();

  if (existing) {
    return {
      success: false,
      data: null,
      error: "Já existe um cliente com este email de gestor",
    };
  }

  const { data, error } = await supabase
    .from("tenants")
    .insert({
      ...input,
      status: "ativo",
    })
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar tenant:", error);
    return { success: false, data: null, error: error.message };
  }

  // Criar utilizador no Supabase Auth e gerar magic link
  const adminSupabase = await createAdminSupabase();
  
  // Criar utilizador (se não existir)
  const { data: userData, error: userError } = await adminSupabase.auth.admin.createUser({
    email: input.gestor_email,
    email_confirm: true,
    user_metadata: {
      nome: input.gestor_nome,
      empresa: input.nome_empresa,
      tenant_id: data.id,
    },
  });

  if (userError && !userError.message.includes('already been registered')) {
    console.error("Erro ao criar utilizador:", userError);
  }

  // Gerar magic link para definir senha inicial
  const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
    type: 'magiclink',
    email: input.gestor_email,
    options: {
      redirectTo: `${getAppUrl()}/definir-senha`,
    },
  });

  if (linkError) {
    console.error("Erro ao gerar link:", linkError);
  }

  // Extrair tokens do link gerado
  let resetPasswordLink = `${getAppUrl()}/definir-senha`;
  if (linkData?.properties?.action_link) {
    // O link do Supabase contém access_token e refresh_token
    resetPasswordLink = linkData.properties.action_link;
  }

  // Enviar email de boas-vindas com link real do Supabase
  await sendWelcomeEmail({
    to: input.gestor_email,
    nome: input.gestor_nome,
    empresa: input.nome_empresa,
    resetPasswordLink,
  });

  revalidatePath("/central-saas/clientes");
  return { success: true, data: data as Tenant, error: null };
}

// Atualizar tenant
export async function updateTenant(
  id: string,
  input: UpdateTenantInput
): Promise<{ success: boolean; error: string | null }> {
  const { allowed } = await checkAdminAccess();

  if (!allowed) {
    return { success: false, error: "Acesso negado" };
  }

  const supabase = await createServerSupabase();

  const { error } = await supabase.from("tenants").update(input).eq("id", id);

  if (error) {
    console.error("Erro ao atualizar tenant:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/central-saas/clientes");
  return { success: true, error: null };
}

// Ações em massa
export async function bulkUpdateTenants(
  ids: string[],
  action: "activate" | "suspend" | "add_credits" | "change_plan" | "apply_discount" | "generate_invoices",
  value?: string | number,
  extraData?: { desconto_validade?: string; descricao_fatura?: string }
): Promise<{ success: boolean; affected: number; error: string | null }> {
  const { allowed } = await checkAdminAccess();

  if (!allowed) {
    return { success: false, affected: 0, error: "Acesso negado" };
  }

  const supabase = await createServerSupabase();

  let updateData: Record<string, unknown> = {};

  switch (action) {
    case "activate":
      updateData = { status: "ativo" };
      break;
    case "suspend":
      updateData = { status: "suspenso" };
      break;
    case "add_credits":
      if (typeof value !== "number") {
        return { success: false, affected: 0, error: "Valor de créditos inválido" };
      }
      // Usar RPC para adicionar créditos de forma atómica
      const { error: rpcError } = await supabase.rpc("add_tenant_credits", {
        tenant_ids: ids,
        credits_to_add: value,
      });
      if (rpcError) {
        return { success: false, affected: 0, error: rpcError.message };
      }
      revalidatePath("/central-saas/clientes");
      return { success: true, affected: ids.length, error: null };
    case "change_plan":
      if (typeof value !== "string") {
        return { success: false, affected: 0, error: "ID do plano inválido" };
      }
      updateData = { plano_id: value };
      break;
    case "apply_discount":
      if (typeof value !== "number" || value < 0 || value > 100) {
        return { success: false, affected: 0, error: "Percentual de desconto inválido (0-100)" };
      }
      if (!extraData?.desconto_validade) {
        return { success: false, affected: 0, error: "Data de validade do desconto é obrigatória" };
      }
      updateData = { 
        desconto_percentual: value,
        desconto_tipo: "temporario",
        desconto_validade: extraData.desconto_validade
      };
      break;
    case "generate_invoices":
      // Criar faturas/mensalidades para os tenants selecionados
      const { error: invoiceError } = await supabase.rpc("generate_tenant_invoices", {
        tenant_ids: ids,
        descricao: extraData?.descricao_fatura || "Mensalidade Flowly ERP",
      });
      if (invoiceError) {
        return { success: false, affected: 0, error: invoiceError.message };
      }
      revalidatePath("/central-saas/clientes");
      return { success: true, affected: ids.length, error: null };
  }

  const { error } = await supabase.from("tenants").update(updateData).in("id", ids);

  if (error) {
    console.error("Erro em ação em massa:", error);
    return { success: false, affected: 0, error: error.message };
  }

  revalidatePath("/central-saas/clientes");
  return { success: true, affected: ids.length, error: null };
}

// Reenviar email de registo
export async function resendWelcomeEmail(
  tenantId: string
): Promise<{ success: boolean; error: string | null }> {
  const { allowed } = await checkAdminAccess();

  if (!allowed) {
    return { success: false, error: "Acesso negado" };
  }

  const supabase = await createServerSupabase();

  // Buscar dados do tenant
  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("gestor_email, gestor_nome, nome_empresa")
    .eq("id", tenantId)
    .single();

  if (error || !tenant) {
    return { success: false, error: error?.message || "Tenant não encontrado" };
  }

  // Gerar novo link de recuperação via Supabase
  const adminSupabase = await createAdminSupabase();

  // Verificar se utilizador existe, se não, criar
  const { data: userData, error: userError } = await adminSupabase.auth.admin.createUser({
    email: tenant.gestor_email,
    email_confirm: true,
    user_metadata: {
      nome: tenant.gestor_nome,
      empresa: tenant.nome_empresa,
    },
  });

  if (userError && !userError.message.includes('already been registered')) {
    console.log("[ResendWelcome] Info ao criar utilizador:", userError.message);
  } else {
    console.log("[ResendWelcome] Utilizador criado ou já existia");
  }
  
  const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
    type: 'magiclink',
    email: tenant.gestor_email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/definir-senha`,
    },
  });

  if (linkError) {
    console.error("[ResendWelcome] Erro ao gerar link:", {
      error: linkError,
      email: tenant.gestor_email,
      hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      serviceRolePrefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 10) + '...',
    });
    return { success: false, error: `Erro ao gerar link: ${linkError.message}` };
  }

  const resetPasswordLink = linkData?.properties?.action_link || `${getAppUrl()}/definir-senha`;

  // Enviar email de boas-vindas real via Resend com link do Supabase
  const { success, error: emailError } = await sendWelcomeEmail({
    to: tenant.gestor_email,
    nome: tenant.gestor_nome,
    empresa: tenant.nome_empresa,
    resetPasswordLink,
  });

  if (!success) {
    return { success: false, error: emailError || "Erro ao enviar email" };
  }

  return { success: true, error: null };
}

// Impersonate - Iniciar sessão como tenant
export async function impersonateTenant(
  tenantId: string
): Promise<{ success: boolean; redirectUrl: string | null; error: string | null }> {
  const { allowed, user } = await checkAdminAccess();

  if (!allowed) {
    return { success: false, redirectUrl: null, error: "Acesso negado" };
  }

  const supabase = await createServerSupabase();

  // Buscar dados do tenant
  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .single();

  if (error || !tenant) {
    return { success: false, redirectUrl: null, error: error?.message || "Tenant não encontrado" };
  }

  // Registrar log de impersonate
  await supabase.from("impersonate_logs").insert({
    admin_id: user?.email, // Simplified - should be user id
    admin_email: user?.email,
    tenant_id: tenantId,
    tenant_nome: tenant.nome_empresa,
    action: "start",
  });

  // Criar cookie/session especial para impersonate
  // Na prática, isso seria uma flag na sessão ou um cookie separado
  // O middleware verificaria essa flag e injetaria o tenant_id nas queries

  return {
    success: true,
    redirectUrl: `/dashboard?impersonate=${tenantId}`,
    error: null,
  };
}

// Estatísticas para o dashboard
export async function getTenantStats(): Promise<{
  total: number;
  ativos: number;
  suspensos: number;
  trial: number;
  creditosTotais: number;
  error: string | null;
}> {
  const { allowed } = await checkAdminAccess();

  if (!allowed) {
    return { total: 0, ativos: 0, suspensos: 0, trial: 0, creditosTotais: 0, error: "Acesso negado" };
  }

  const supabase = await createServerSupabase();

  const { data, error } = await supabase.from("tenants").select("status, creditos_ia");

  if (error) {
    return { total: 0, ativos: 0, suspensos: 0, trial: 0, creditosTotais: 0, error: error.message };
  }

  const stats = {
    total: data.length,
    ativos: data.filter((t) => t.status === "ativo").length,
    suspensos: data.filter((t) => t.status === "suspenso").length,
    trial: data.filter((t) => t.status === "trial").length,
    creditosTotais: data.reduce((sum, t) => sum + (t.creditos_ia || 0), 0),
    error: null,
  };

  return stats;
}
