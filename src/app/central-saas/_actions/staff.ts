"use server";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { checkAdminAccess } from "./auth";

// Tipos
export interface StaffMember {
  id: string;
  email: string;
  nome: string;
  cargo: "Owner" | "Admin" | "Dev" | "Support";
  status: "Ativo" | "Inativo";
  created_at: string;
  updated_at: string;
  last_login: string | null;
}

export interface CreateStaffInput {
  email: string;
  nome: string;
  cargo: "Owner" | "Admin" | "Dev" | "Support";
  status?: "Ativo" | "Inativo";
}

export interface UpdateStaffInput extends Partial<CreateStaffInput> {}

// Helper para criar cliente Supabase no servidor
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

// Listar todos os membros da equipa
export async function getStaffMembers(
  status?: "Ativo" | "Inativo"
): Promise<{ data: StaffMember[]; error: string | null }> {
  const { allowed } = await checkAdminAccess();

  if (!allowed) {
    return { data: [], error: "Acesso negado" };
  }

  const supabase = await createServerSupabase();

  let query = supabase.from("flowly_staff").select("*");

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar equipa:", error);
    return { data: [], error: error.message };
  }

  return { data: (data as StaffMember[]) || [], error: null };
}

// Criar novo membro
export async function createStaffMember(
  input: CreateStaffInput
): Promise<{ success: boolean; data: StaffMember | null; error: string | null }> {
  const { allowed, user } = await checkAdminAccess();

  if (!allowed) {
    return { success: false, data: null, error: "Acesso negado" };
  }

  const supabase = await createServerSupabase();

  // Verificar se email já existe
  const { data: existing } = await supabase
    .from("flowly_staff")
    .select("id")
    .eq("email", input.email)
    .single();

  if (existing) {
    return {
      success: false,
      data: null,
      error: "Já existe um membro com este email",
    };
  }

  const { data, error } = await supabase
    .from("flowly_staff")
    .insert({
      ...input,
      status: input.status || "Ativo",
    })
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar membro:", error);
    return { success: false, data: null, error: error.message };
  }

  revalidatePath("/central-saas/equipa");
  return { success: true, data: data as StaffMember, error: null };
}

// Atualizar membro
export async function updateStaffMember(
  id: string,
  input: UpdateStaffInput
): Promise<{ success: boolean; error: string | null }> {
  const { allowed } = await checkAdminAccess();

  if (!allowed) {
    return { success: false, error: "Acesso negado" };
  }

  const supabase = await createServerSupabase();

  const { error } = await supabase.from("flowly_staff").update(input).eq("id", id);

  if (error) {
    console.error("Erro ao atualizar membro:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/central-saas/equipa");
  return { success: true, error: null };
}

// Alternar status (Ativo/Inativo)
export async function toggleStaffStatus(
  id: string,
  currentStatus: "Ativo" | "Inativo"
): Promise<{ success: boolean; error: string | null }> {
  const { allowed } = await checkAdminAccess();

  if (!allowed) {
    return { success: false, error: "Acesso negado" };
  }

  const supabase = await createServerSupabase();

  const newStatus = currentStatus === "Ativo" ? "Inativo" : "Ativo";

  const { error } = await supabase
    .from("flowly_staff")
    .update({ status: newStatus })
    .eq("id", id);

  if (error) {
    console.error("Erro ao alternar status:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/central-saas/equipa");
  return { success: true, error: null };
}

// Estatísticas da equipa
export async function getStaffStats(): Promise<{
  total: number;
  ativos: number;
  inativos: number;
  porCargo: Record<string, number>;
  error: string | null;
}> {
  const { allowed } = await checkAdminAccess();

  if (!allowed) {
    return { total: 0, ativos: 0, inativos: 0, porCargo: {}, error: "Acesso negado" };
  }

  const supabase = await createServerSupabase();

  const { data, error } = await supabase.from("flowly_staff").select("status, cargo");

  if (error) {
    return { total: 0, ativos: 0, inativos: 0, porCargo: {}, error: error.message };
  }

  const porCargo: Record<string, number> = {};
  data.forEach((m) => {
    porCargo[m.cargo] = (porCargo[m.cargo] || 0) + 1;
  });

  return {
    total: data.length,
    ativos: data.filter((m) => m.status === "Ativo").length,
    inativos: data.filter((m) => m.status === "Inativo").length,
    porCargo,
    error: null,
  };
}

// Reenviar convite (simulação)
export async function resendStaffInvite(
  staffId: string
): Promise<{ success: boolean; error: string | null }> {
  const { allowed } = await checkAdminAccess();

  if (!allowed) {
    return { success: false, error: "Acesso negado" };
  }

  const supabase = await createServerSupabase();

  const { data: member, error } = await supabase
    .from("flowly_staff")
    .select("email, nome")
    .eq("id", staffId)
    .single();

  if (error || !member) {
    return { success: false, error: error?.message || "Membro não encontrado" };
  }

  console.log("[Email] Reenviar convite para:", member.email);

  return { success: true, error: null };
}
