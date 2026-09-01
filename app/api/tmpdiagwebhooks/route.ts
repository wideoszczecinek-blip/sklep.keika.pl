import { NextResponse } from "next/server";
import { getStripeServer } from "@/lib/stripe";

// Temporary diagnostic route - lists registered Stripe webhook endpoints to
// find out why payment_intent.succeeded/payment_failed events never reach
// our handler (0 orders have ever had payment_status flip to 'paid').
// Deleted right after use.
export async function GET() {
  const stripe = getStripeServer();
  if (!stripe) {
    return NextResponse.json({ ok: false, error: "no stripe client" });
  }
  const endpoints = await stripe.webhookEndpoints.list({ limit: 20 });
  return NextResponse.json({
    ok: true,
    webhook_secret_present: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
    endpoints: endpoints.data.map((e) => ({
      id: e.id,
      url: e.url,
      status: e.status,
      enabled_events: e.enabled_events,
      created: e.created,
    })),
  });
}
