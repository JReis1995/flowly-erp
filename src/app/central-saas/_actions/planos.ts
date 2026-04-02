"use server";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { checkAdminAccess } from "./auth";

// Tipos
export interface Plano {
  id: string;
  data_criacao: string;
  nome: string;
  descricao: string | null;
  modulos: Record<string, boolean>;
  preco_mensal: number;
  preco_anual: number;
  preco_inicial: number; // Valor de instalação/formação
  desconto_percentual: number; // Desconto no plano
  desconto_validade: string | null; // Data de validade do desconto
  mensalidades_oferta: number; // Número de mensalidades grátis
  creditos_ia_incluidos: number; // Créditos IA incluídos no plano
  status: "Ativo" | "Inativo";
  ordem_display: number;
  created_at: string;
  updated_at: string;
}

export interface CreatePlanoInput {
  nome: string;
  descricao?: string;
  modulos: Record<string, boolean>;
  preco_mensal: number;
  preco_anual: number;
  preco_inicial?: number;
  desconto_percentual?: number;
  desconto_validade?: string;
  mensalidades_oferta?: number;
  creditos_ia_incluidos?: number;
  ordem_display?: number;
  status?: "Ativo" | "Inativo";
}

export interface UpdatePlanoInput extends Partial<CreatePlanoInput> {}

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

// Listar todos os planos
export async function getPlanos(
  status?: "Ativo" | "Inativo"
): Promise<{ data: Plano[]; error: string | null }> {
  const { allowed } = await checkAdminAccess();

  if (!allowed) {
    return { data: [], error: "Acesso negado" };
  }

  const supabase = await createServerSupabase();

  let query = supabase.from("planos").select("*");

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query.order("ordem_display", { ascending: true });

  if (error) {
    console.error("Erro ao buscar planos:", error);
    return { data: [], error: error.message };
  }

  return { data: (data as Plano[]) || [], error: null };
}

// Criar novo plano
export async function createPlano(
  input: CreatePlanoInput
): Promise<{ success: boolean; data: Plano | null; error: string | null }> {
  const { allowed } = await checkAdminAccess();

  if (!allowed) {
    return { success: false, data: null, error: "Acesso negado" };
  }

  const supabase = await createServerSupabase();

  // Verificar se nome já existe
  const { data: existing } = await supabase
    .from("planos")
    .select("id")
    .eq("nome", input.nome)
    .single();

  if (existing) {
    return {
      success: false,
      data: null,
      error: "Já existe um plano com este nome",
    };
  }

  const { data, error } = await supabase
    .from("planos")
    .insert({
      ...input,
      status: input.status || "Ativo",
      ordem_display: input.ordem_display || 0,
    })
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar plano:", error);
    return { success: false, data: null, error: error.message };
  }

  revalidatePath("/central-saas/planos");
  return { success: true, data: data as Plano, error: null };
}

// Atualizar plano
export async function updatePlano(
  id: string,
  input: UpdatePlanoInput
): Promise<{ success: boolean; error: string | null }> {
  const { allowed } = await checkAdminAccess();

  if (!allowed) {
    return { success: false, error: "Acesso negado" };
  }

  const supabase = await createServerSupabase();

  const { error } = await supabase.from("planos").update(input).eq("id", id);

  if (error) {
    console.error("Erro ao atualizar plano:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/central-saas/planos");
  return { success: true, error: null };
}

// Alternar status (Ativo/Inativo)
export async function togglePlanoStatus(
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
    .from("planos")
    .update({ status: newStatus })
    .eq("id", id);

  if (error) {
    console.error("Erro ao alternar status:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/central-saas/planos");
  return { success: true, error: null };
}

// Estatísticas dos planos
export async function getPlanosStats(): Promise<{
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

  const { data, error } = await supabase.from("planos").select("status");

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
