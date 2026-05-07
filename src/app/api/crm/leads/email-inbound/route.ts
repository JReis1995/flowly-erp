import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MAX_BODY = 100_000;

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function extractLeadPrefixFromAddress(addr: string): string | null {
  const m = addr.match(/\+lead-([a-f0-9]{8})/i);
  return m ? m[1].toLowerCase() : null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * POST com cabeçalho x-crm-email-webhook-secret igual a CRM_EMAIL_INBOUND_WEBHOOK_SECRET.
 * Corpo JSON:
 * - leadId (uuid, opcional)
 * - toAddress (opcional): endereço To (ex.: comercial+lead-aca17e43@...) para inferir prefixo
 * - from (obrigatório)
 * - subject (opcional)
 * - body ou text (obrigatório; texto plano)
 * - messageId (opcional)
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRM_EMAIL_INBOUND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRM_EMAIL_INBOUND_WEBHOOK_SECRET não configurado." }, { status: 503 });
  }

  const got = req.headers.get("x-crm-email-webhook-secret");
  if (!got || got !== secret) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Servidor sem SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });
  }

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (!bodyJson || typeof bodyJson !== "object") {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const o = bodyJson as Record<string, unknown>;
  const from = typeof o.from === "string" ? o.from.trim() : "";
  const rawBody = typeof o.body === "string" ? o.body : typeof o.text === "string" ? o.text : "";
  const subject = typeof o.subject === "string" ? o.subject.trim() : "";
  const messageId = typeof o.messageId === "string" ? o.messageId.trim() : null;
  const leadIdRaw = typeof o.leadId === "string" ? o.leadId.trim() : "";
  const toAddress = typeof o.toAddress === "string" ? o.toAddress.trim() : "";

  if (!from || from.length < 3) {
    return NextResponse.json({ error: "Campo from é obrigatório." }, { status: 400 });
  }

  const body = rawBody.trim().slice(0, MAX_BODY);
  if (body.length < 1) {
    return NextResponse.json({ error: "Campo body ou text é obrigatório." }, { status: 400 });
  }

  let leadId: string | null = null;
  if (leadIdRaw && isUuid(leadIdRaw)) {
    leadId = leadIdRaw;
  } else {
    const prefix = extractLeadPrefixFromAddress(toAddress);
    if (!prefix) {
      return NextResponse.json(
        { error: "Indica leadId (uuid) ou toAddress com +lead-{8hex}." },
        { status: 400 }
      );
    }
    const { data: matches, error: rpcError } = await supabase.rpc("flowly_match_lead_id_prefix", {
      p_prefix: prefix,
    });
    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }
    const rows = (matches ?? []) as { id: string }[];
    if (rows.length === 0) {
      return NextResponse.json({ error: "Nenhuma lead encontrada para esse prefixo." }, { status: 404 });
    }
    if (rows.length > 1) {
      return NextResponse.json(
        { error: "Várias leads coincidem com o prefixo; usa leadId completo." },
        { status: 409 }
      );
    }
    leadId = rows[0].id;
  }

  const { error: insError } = await supabase.from("crm_lead_timeline").insert({
    lead_id: leadId,
    event_type: "email_received",
    created_by: null,
    payload: {
      from,
      subject: subject || "(sem assunto)",
      body,
      message_id: messageId,
      to: toAddress || null,
    },
  });

  if (insError) {
    return NextResponse.json({ error: insError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, leadId });
}
