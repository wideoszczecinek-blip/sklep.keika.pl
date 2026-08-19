import Stripe from "stripe";

// Deliberately not cached at module scope: a warm serverless instance can
// carry that cache across invocations, so a single cold-start request that
// happened to see process.env.STRIPE_SECRET_KEY as empty (a startup race,
// a redeploy mid-request, etc.) would permanently stick "Stripe not
// configured" for every later request on that instance, even once the env
// var is genuinely present - which is exactly what was happening here.
// Constructing a Stripe client is cheap (no network call), so there's no
// real cost to just re-reading env and rebuilding it every call.
export function getStripeServer() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    return null;
  }

  return new Stripe(secretKey, {
    apiVersion: "2026-03-25.dahlia",
    typescript: true,
  });
}

export function getStripePublishableKey() {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || "";
}
