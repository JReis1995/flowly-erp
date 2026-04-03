import { NextRequest, NextResponse } from "next/server";
import { getStripeSession } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const { priceId, tenantId, pacoteId, mode = "payment" } = await req.json();

    if (!priceId || !tenantId || !pacoteId) {
      return NextResponse.json(
        { error: "Missing required fields: priceId, tenantId, pacoteId" },
        { status: 400 }
      );
    }

    const origin = req.headers.get("origin") || "http://localhost:3000";

    const session = await getStripeSession({
      priceId,
      tenantId,
      pacoteId,
      mode: mode as "payment" | "subscription",
      successUrl: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/checkout/cancel`,
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
