import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia", // Latest API version
  typescript: true,
});

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
  const session = await stripe.checkout.sessions.create({
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
