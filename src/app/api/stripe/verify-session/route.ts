import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: async (name: string) => (await cookieStore).get(name)?.value,
        set: async () => {},
        remove: async () => {},
      },
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const supabase = await createServerSupabase();

    // Buscar dados do pacote da base de dados usando o pacoteId dos metadados
    const pacoteId = session.metadata?.pacoteId;
    let pacoteNome = "Pacote IA";
    let creditos = 0;

    if (pacoteId) {
      const { data: pacote } = await supabase
        .from("pacotes_ia")
        .select("nome, creditos")
        .eq("id", pacoteId)
        .single();

      if (pacote) {
        pacoteNome = pacote.nome;
        creditos = pacote.creditos;
      }
    }

    return NextResponse.json({
      id: session.id,
      status: session.status,
      amountTotal: (session.amount_total || 0) / 100,
      pacoteNome,
      creditos,
    });
  } catch (error) {
    console.error("Error verifying session:", error);
    return NextResponse.json(
      { error: "Failed to verify session" },
      { status: 500 }
    );
  }
}
