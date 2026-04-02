"use server";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { checkAdminAccess } from "./auth";

// Tipos
export interface PacoteIA {
  id: string;
  data_criacao: string;
  nome: string;
  creditos: number;
  preco_base: number;
  link_pagamento: string | null;
  status: "Ativo" | "Inativo";
  ultima_modificacao: string;
}

export interface CreatePacoteInput {
  nome: string;
  creditos: number;
  preco_base: number;
  link_pagamento?: string;
  status?: "Ativo" | "Inativo";
}

export interface UpdatePacoteInput extends Partial<CreatePacoteInput> {}

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

// Listar todos os pacotes (apenas admins)
export async function getPacotesIA(
  status?: "Ativo" | "Inativo"
): Promise<{ data: PacoteIA[]; error: string | null }> {
  const { allowed } = await checkAdminAccess();

  if (!allowed) {
    return { data: [], error: "Acesso negado" };
  }

  const supabase = await createServerSupabase();

  let query = supabase.from("pacotes_ia").select("*");

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query.order("data_criacao", { ascending: false });

  if (error) {
    console.error("Erro ao buscar pacotes IA:", error);
    return { data: [], error: error.message };
  }

  return { data: (data as PacoteIA[]) || [], error: null };
}

// Criar novo pacote
export async function createPacoteIA(
  input: CreatePacoteInput
): Promise<{ success: boolean; data: PacoteIA | null; error: string | null }> {
  const { allowed } = await checkAdminAccess();

  if (!allowed) {
    return { success: false, data: null, error: "Acesso negado" };
  }

  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("pacotes_ia")
    .insert({
      ...input,
      status: input.status || "Ativo",
    })
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar pacote IA:", error);
    return { success: false, data: null, error: error.message };
  }

  revalidatePath("/central-saas/pacotes-ia");
  return { success: true, data: data as PacoteIA, error: null };
}

// Atualizar pacote
export async function updatePacoteIA(
  id: string,
  input: UpdatePacoteInput
): Promise<{ success: boolean; error: string | null }> {
  const { allowed } = await checkAdminAccess();

  if (!allowed) {
    return { success: false, error: "Acesso negado" };
  }

  const supabase = await createServerSupabase();

  const { error } = await supabase.from("pacotes_ia").update(input).eq("id", id);

  if (error) {
    console.error("Erro ao atualizar pacote IA:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/central-saas/pacotes-ia");
  return { success: true, error: null };
}

// Alternar status do pacote (Ativo/Inativo)
export async function togglePacoteStatus(
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
    .from("pacotes_ia")
    .update({ status: newStatus })
    .eq("id", id);

  if (error) {
    console.error("Erro ao alternar status do pacote:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/central-saas/pacotes-ia");
  return { success: true, error: null };
}

// Estatísticas dos pacotes
export async function getPacotesStats(): Promise<{
  total: number;
  ativos: number;
  inativos: number;
  error: string | null;
}> {
  const { allowed } = await checkAdminAccess();

  if (!allowed) {
    return { total: 0, ativos: 0, inativos: 0, error: "Acesso negado" };
  }

  const supabase = await createServerSupabase();

  const { data, error } = await supabase.from("pacotes_ia").select("status");

  if (error) {
    return { total: 0, ativos: 0, inativos: 0, error: error.message };
  }

  return {
    total: data.length,
    ativos: data.filter((p) => p.status === "Ativo").length,
    inativos: data.filter((p) => p.status === "Inativo").length,
    error: null,
  };
}
