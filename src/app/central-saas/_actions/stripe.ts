"use server";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { checkAdminAccess } from "./auth";

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

export interface CheckoutSessionResult {
  sessionId: string;
  url: string;
}

// Criar sessão de checkout para compra de pacote IA
export async function createCheckoutSession(
  pacoteId: string,
  tenantId: string,
  priceId: string,
  mode: "payment" | "subscription" = "payment"
): Promise<{ success: boolean; data: CheckoutSessionResult | null; error: string | null }> {
  const { allowed } = await checkAdminAccess();

  if (!allowed) {
    return { success: false, data: null, error: "Acesso negado" };
  }

  try {
    const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const response = await fetch(`${origin}/api/stripe/checkout-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        priceId,
        tenantId,
        pacoteId,
        mode,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, data: null, error: errorData.error || "Erro ao criar sessão" };
    }

    const data = await response.json();

    return {
      success: true,
      data: {
        sessionId: data.sessionId,
        url: data.url,
      },
      error: null,
    };
  } catch (error) {
    console.error("Erro ao criar checkout session:", error);
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

// Verificar sessão de checkout
export async function verifyCheckoutSession(sessionId: string): Promise<{
  success: boolean;
  session: {
    id: string;
    status: string;
    amountTotal: number;
    pacoteNome: string;
    creditos: number;
  } | null;
  error: string | null;
}> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/stripe/verify-session`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }
    );

    if (!response.ok) {
      return { success: false, session: null, error: "Sessão inválida" };
    }

    const data = await response.json();
    return { success: true, session: data, error: null };
  } catch (error) {
    return {
      success: false,
      session: null,
      error: error instanceof Error ? error.message : "Erro ao verificar sessão",
    };
  }
}
