import Stripe from "stripe";

// Lazy initialization - só cria a instância quando necessário
let stripeInstance: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeInstance) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error("STRIPE_SECRET_KEY não está definida");
    }
    stripeInstance = new Stripe(apiKey, {
      apiVersion: "2026-03-25.dahlia",
      typescript: true,
    });
  }
  return stripeInstance;
}

export const getStripeSession = async ({
  priceId,
  tenantId,
  pacoteId,
  mode = "payment",
  successUrl,
  cancelUrl,
}: {
  priceId: string;
  tenantId: string;
  pacoteId: string;
  mode?: "payment" | "subscription";
  successUrl: string;
  cancelUrl: string;
}) => {
  const session = await getStripe().checkout.sessions.create({
    mode,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata: {
      tenantId,
      pacoteId,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return session;
};
