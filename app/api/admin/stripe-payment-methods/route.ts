import { NextResponse } from "next/server";
import { getStripeServer } from "@/lib/stripe";
import { stripeChargedMethod } from "@/lib/stripe-method";

// CRM-only (same Bearer CRM_ADMIN_API_SECRET as /api/admin/stripe-balance):
// which method (blik / card / wallets) Stripe charged for given
// PaymentIntents. Used to backfill shop_www_orders.payment_method for orders
// placed before the CRM stored it - the Stripe key only lives here.
// POST { payment_intent_ids: string[] } (max 50) -> { ok, methods: { [id]: method } }
export async function POST(request: Request) {
  const expectedSecret = process.env.CRM_ADMIN_API_SECRET?.trim();
  if (!expectedSecret) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }
  const authHeader = request.headers.get("authorization") || "";
  const providedSecret = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!providedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const stripe = getStripeServer();
  if (!stripe) {
    return NextResponse.json({ ok: false, error: "stripe_not_configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.payment_intent_ids)
    ? body.payment_intent_ids.filter((id: unknown): id is string => typeof id === "string" && id.startsWith("pi_")).slice(0, 50)
    : [];

  const methods: Record<string, string> = {};
  for (const id of ids) {
    try {
      methods[id] = await stripeChargedMethod(stripe, id);
    } catch {
      methods[id] = "";
    }
  }
  return NextResponse.json({ ok: true, methods });
}
