import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sendPurchaseThankYouEmail } from "@/lib/email";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

async function createServerSupabase() {
  const cookieStore = await cookies();

  // Usar SERVICE_ROLE_KEY para bypassar RLS no webhook
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Bypass RLS
    {
      cookies: {
        get: async (name: string) => {
          return (await cookieStore).get(name)?.value;
        },
        set: async (name: string, value: string, options: any) => {
          (await cookieStore).set({ name, value, ...options });
        },
        remove: async (name: string, options: any) => {
          (await cookieStore).set({ name, value: "", ...options });
        },
      },
    }
  );
}

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");

  console.log("[Webhook] Received Stripe webhook");
  console.log("[Webhook] Signature present:", !!signature);
  console.log("[Webhook] Webhook secret configured:", !!webhookSecret);

  if (!signature) {
    console.error("[Webhook] Missing stripe-signature header");
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  if (!webhookSecret) {
    console.error("[Webhook] STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let event;

  try {
    event = getStripe().webhooks.constructEvent(payload, signature, webhookSecret);
    console.log("[Webhook] Event verified:", event.type, "ID:", event.id);
  } catch (err: any) {
    console.error(`[Webhook] Signature verification failed: ${err.message}`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = await createServerSupabase();

  // Log do evento
  try {
    const { error: logError } = await supabase.from("stripe_webhook_logs").insert({
      event_id: event.id,
      event_type: event.type,
      payload: event,
      processed: false,
      created_at: new Date().toISOString(),
    });
    
    if (logError) {
      console.error("[Webhook] Failed to log event:", logError);
    } else {
      console.log("[Webhook] Event logged successfully");
    }
  } catch (logErr) {
    console.error("[Webhook] Exception logging event:", logErr);
  }

  // Processar evento
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      console.log("[Webhook] Processing checkout.session.completed");
      console.log("[Webhook] Session ID:", session.id);
      console.log("[Webhook] Metadata:", session.metadata);
      
      const { tenantId, pacoteId } = session.metadata || {};

      if (!tenantId || !pacoteId) {
        console.error("[Webhook] Missing metadata! tenantId:", tenantId, "pacoteId:", pacoteId);
        break;
      }

      console.log("[Webhook] Looking up pacote:", pacoteId);

      // Buscar pacote para obter quantidade de créditos
      const { data: pacote, error: pacoteError } = await supabase
        .from("pacotes_ia")
        .select("creditos, nome")
        .eq("id", pacoteId)
        .single();

      if (pacoteError || !pacote) {
        console.error("[Webhook] Pacote not found:", pacoteError);
        break;
      }

      console.log("[Webhook] Found pacote:", pacote.nome, "with", pacote.creditos, "credits");
      console.log("[Webhook] Adding credits to tenant:", tenantId);

      // Atualizar créditos do tenant
      const { error: updateError } = await supabase.rpc("add_tenant_credits", {
        tenant_ids: [tenantId],
        credits_to_add: pacote.creditos,
      });

      if (updateError) {
        console.error("[Webhook] Failed to add credits:", updateError);
        break;
      }

      console.log("[Webhook] Credits added successfully");

      // Registrar compra na tabela de compras
      console.log("[Webhook] Recording purchase...");
      const { error: purchaseError } = await supabase.from("purchases").insert({
        tenant_id: tenantId,
        pacote_id: pacoteId,
        pacote_nome: pacote.nome,
        creditos_adquiridos: pacote.creditos,
        valor_pago: (session.amount_total || 0) / 100,
        stripe_session_id: session.id,
        stripe_payment_intent: session.payment_intent,
        status: "completed",
        created_at: new Date().toISOString(),
      });

      if (purchaseError) {
        console.error("[Webhook] Failed to record purchase:", purchaseError);
      } else {
        console.log("[Webhook] Purchase recorded successfully");
      }

      // Buscar tenant para enviar email de agradecimento
      console.log("[Webhook] Looking up tenant for email:", tenantId);
      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .select("gestor_email, gestor_nome")
        .eq("id", tenantId)
        .single();

      if (tenantError) {
        console.error("[Webhook] Tenant not found for email:", tenantError);
      } else if (tenant) {
        console.log("[Webhook] Sending thank you email to:", tenant.gestor_email);
        try {
          await sendPurchaseThankYouEmail({
            to: tenant.gestor_email,
            nome: tenant.gestor_nome,
            pacoteNome: pacote.nome,
            creditos: pacote.creditos,
            valor: (session.amount_total || 0) / 100,
          });
          console.log("[Webhook] Email sent successfully");
        } catch (emailErr) {
          console.error("[Webhook] Failed to send email:", emailErr);
        }
      }

      break;
    }

    case "checkout.session.expired":
    case "payment_intent.payment_failed": {
      const session = event.data.object;
      console.log(`[Webhook] Payment failed or expired: ${session.id}`);
      break;
    }

    default:
      console.log(`[Webhook] Unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
