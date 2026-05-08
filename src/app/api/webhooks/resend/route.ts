import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

/** Endereços tipo comercial+lead-xxxxxxxx@domínio (8 hex = prefixo do UUID da lead) */
const LEAD_REPLY_TAG_RE = /\+lead-([a-f0-9]{8})/i;

/** Extrai o email de `"Nome" <x@y>` ou devolve o texto normalizado. */
function extractAngleEmail(raw: string): string {
  const t = raw.trim();
  const m = t.match(/<([^>]+)>/);
  if (m && m[1].includes("@")) return m[1].trim().toLowerCase();
  return t.toLowerCase();
}

function flattenRecipientValues(val: unknown): string[] {
  if (val == null) return [];
  if (typeof val === "string") return val.trim() ? [val.trim()] : [];
  if (Array.isArray(val)) return val.flatMap(flattenRecipientValues);
  if (typeof val === "object" && "email" in (val as object)) {
    const e = (val as { email?: unknown }).email;
    return typeof e === "string" && e.trim() ? [e.trim()] : [];
  }
  return [];
}

/**
 * Junta to/cc/bcc/reply_to e todos os valores em `headers` (ex.: delivered-to, envelope-to).
 * O tag +lead-… por vezes só aparece nos cabeçalhos, não no array `to` da API.
 */
function collectLeadMatchCandidates(mail: {
  to?: unknown;
  cc?: unknown;
  bcc?: unknown;
  reply_to?: unknown;
  headers?: unknown;
}): string[] {
  const chunks: string[] = [];
  chunks.push(...flattenRecipientValues(mail.to));
  chunks.push(...flattenRecipientValues(mail.cc));
  chunks.push(...flattenRecipientValues(mail.bcc));
  chunks.push(...flattenRecipientValues(mail.reply_to));

  const headers = mail.headers;
  if (headers && typeof headers === "object") {
    for (const v of Object.values(headers as Record<string, unknown>)) {
      chunks.push(...flattenRecipientValues(v));
    }
  }

  const normalized = chunks.map(extractAngleEmail).filter(Boolean);
  return [...new Set(normalized)];
}

/** Todas as ocorrências de +lead-xxxxxxxx no texto (respostas citam o email original no corpo). */
function extractLeadPrefixesFromText(...chunks: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const re = new RegExp(LEAD_REPLY_TAG_RE.source, "gi");
  for (const chunk of chunks) {
    if (!chunk) continue;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(chunk)) !== null) {
      seen.add(m[1].toLowerCase());
    }
  }
  return [...seen];
}

/** Junta destinatários normalizados + assunto + corpo + HTML + headers serializados. */
function collectAllLeadPrefixes(
  mail: {
    to?: unknown;
    cc?: unknown;
    bcc?: unknown;
    reply_to?: unknown;
    headers?: unknown;
    html?: string | null;
  },
  subject: string,
  bodyText: string
): string[] {
  const emails = collectLeadMatchCandidates(mail);
  const headersBlob =
    mail.headers && typeof mail.headers === "object"
      ? JSON.stringify(mail.headers)
      : "";
  /** Primeiro destinatários (Para real), depois corpo citado — evita apanhar outro +lead- numa thread antiga quando possível. */
  const fromRecipients = extractLeadPrefixesFromText(...emails);
  const fromContent = extractLeadPrefixesFromText(
    subject,
    bodyText,
    typeof mail.html === "string" ? mail.html : "",
    headersBlob
  );
  return [...new Set([...fromRecipients, ...fromContent])];
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Webhook Resend (evento `email.received`).
 * Configuração no dashboard Resend → Webhooks → URL desta rota → evento email.received.
 * Segredo: RESEND_WEBHOOK_SECRET (signing secret do webhook, formato whsec_...).
 *
 * 1) Descarrega o email completo via API Receiving.
 * 2) Reencaminha uma cópia para EMAIL_INBOUND_FORWARD_TO (por defeito caixa comercial) para não perderes respostas no Gmail.
 * 3) Se o destinatário contiver +lead-xxxxxxxx, associa à lead e grava `email_received` na timeline.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const apiKey = process.env.RESEND_API_KEY;

  if (!webhookSecret || !apiKey) {
    console.error("[webhooks/resend] Falta RESEND_WEBHOOK_SECRET ou RESEND_API_KEY");
    return NextResponse.json({ error: "Servidor mal configurado" }, { status: 503 });
  }

  const resend = new Resend(apiKey);

  let event: { type: string; data?: { email_id: string; message_id?: string } };
  try {
    event = resend.webhooks.verify({
      payload: rawBody,
      webhookSecret,
      headers: {
        id: req.headers.get("svix-id") ?? "",
        timestamp: req.headers.get("svix-timestamp") ?? "",
        signature: req.headers.get("svix-signature") ?? "",
      },
    }) as { type: string; data?: { email_id: string; message_id?: string } };
  } catch (e) {
    console.error("[webhooks/resend] Assinatura inválida", e);
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (event.type !== "email.received" || !event.data?.email_id) {
    return NextResponse.json({ ok: true });
  }

  const receivedRes = await resend.emails.receiving.get(event.data.email_id);
  if (receivedRes.error || !receivedRes.data) {
    console.error("[webhooks/resend] receiving.get", receivedRes.error);
    return NextResponse.json({ error: "Falha ao ler email recebido" }, { status: 502 });
  }

  const mail = receivedRes.data;

  let bodyText = mail.text?.trim() ?? "";
  if (!bodyText && mail.html) {
    bodyText = stripHtml(mail.html);
  }
  if (!bodyText) bodyText = "(sem corpo de texto)";

  const subject = mail.subject?.trim() || "(sem assunto)";
  const fromAddr =
    typeof mail.from === "string" ? mail.from : mail.from != null ? String(mail.from) : "";

  const forwardTo =
    process.env.EMAIL_INBOUND_FORWARD_TO?.trim() ||
    process.env.EMAIL_SIGNATURE_EMAIL?.trim() ||
    process.env.EMAIL_REPLY_TO_COMERCIAL?.trim() ||
    "";
  const forwardFromRaw = process.env.EMAIL_FROM_COMERCIAL?.trim();

  if (forwardTo && forwardFromRaw) {
    const fwd = await resend.emails.receiving.forward({
      emailId: mail.id,
      to: forwardTo,
      from: `Flowly Comercial <${forwardFromRaw}>`,
      passthrough: true,
    });
    if (fwd.error) {
      console.error("[webhooks/resend] forward para caixa interna falhou", fwd.error);
    }
  } else {
    console.warn(
      "[webhooks/resend] EMAIL_INBOUND_FORWARD_TO / EMAIL_FROM_COMERCIAL em falta — cópia por reencaminhamento desativada."
    );
  }

  const supabase = createServiceSupabase();
  if (!supabase) {
    console.error("[webhooks/resend] SUPABASE_SERVICE_ROLE_KEY em falta");
    return NextResponse.json({ ok: true, warning: "Timeline não gravada (Supabase)" });
  }

  const prefixes = collectAllLeadPrefixes(mail, subject, bodyText);
  let leadId: string | null = null;
  let lastRpcError: string | null = null;

  for (const prefix of prefixes) {
    const { data: rows, error: rpcErr } = await supabase.rpc("flowly_match_lead_id_prefix", {
      p_prefix: prefix,
    });
    if (rpcErr) {
      lastRpcError = rpcErr.message;
      console.error("[webhooks/resend] flowly_match_lead_id_prefix", rpcErr);
      continue;
    }
    const list = (rows ?? []) as { id: string }[];
    if (list.length === 1) {
      leadId = list[0].id;
      break;
    }
    if (list.length > 1) {
      console.warn("[webhooks/resend] várias leads para o prefixo; não associar automaticamente", prefix);
    }
  }

  let timelineError: string | null = null;

  if (leadId) {
    const { error: insErr } = await supabase.from("crm_lead_timeline").insert({
      lead_id: leadId,
      event_type: "email_received",
      created_by: null,
      payload: {
        subject,
        from: fromAddr,
        body: bodyText.slice(0, 100_000),
        message_id: mail.message_id,
        to: mail.to?.[0] ?? null,
        inbound_resend_id: mail.id,
      },
    });
    if (insErr) {
      timelineError = insErr.message;
      console.error("[webhooks/resend] timeline insert", insErr);
    }
  } else if (prefixes.length > 0) {
    console.warn(
      "[webhooks/resend] tokens +lead- encontrados mas sem match único na BD — prefixos:",
      prefixes.join(","),
      lastRpcError ? `último RPC: ${lastRpcError}` : ""
    );
  } else {
    console.warn(
      "[webhooks/resend] nenhum +lead-xxxxxxxx em destinatários, assunto ou corpo — não é possível associar."
    );
  }

  return NextResponse.json({
    ok: true,
    leadId,
    ...(timelineError ? { timelineError } : {}),
  });
}
