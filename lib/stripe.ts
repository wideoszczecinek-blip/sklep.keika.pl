import Stripe from "stripe";

let stripeClient: Stripe | null | undefined;

export function getStripeServer() {
  if (stripeClient !== undefined) {
    return stripeClient;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    stripeClient = null;
    return stripeClient;
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion: "2026-03-25.dahlia",
    typescript: true,
  });

  return stripeClient;
}

export function getStripePublishableKey() {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || "";
}
