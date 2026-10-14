import { NextResponse } from "next/server";
import { getStripeServer } from "@/lib/stripe";

// Wewnętrzny endpoint tylko dla CRM: zwrot płatności Stripe (karta,
// Google/Apple Pay, BLIK przez Stripe) dla zamówienia ze sklepu. Klucz
// Stripe mieszka wyłącznie tutaj - CRM (views/biuro/api/shop/order_refund.php
// przez core/lib/shop_refund.php) woła ten endpoint z tym samym wspólnym
// sekretem co stripe-balance (CRM_ADMIN_API_SECRET, "Authorization: Bearer").
//
// POST JSON: { payment_intent: "pi_…", amount?: <grosze>, reason?: string, idempotency_key?: string }
//   amount pominięte = zwrot całości, która została pobrana.
//   → { ok, refund_id, status, amount, currency }

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const paymentIntent = typeof body.payment_intent === "string" ? body.payment_intent.trim() : "";
  if (!/^pi_[A-Za-z0-9]+$/.test(paymentIntent)) {
    return NextResponse.json({ ok: false, error: "bad_payment_intent" }, { status: 400 });
  }
  const amount = Number.isInteger(body.amount) && (body.amount as number) > 0 ? (body.amount as number) : undefined;
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  const idempotencyKey = typeof body.idempotency_key === "string" && body.idempotency_key.trim() ? body.idempotency_key.trim().slice(0, 255) : undefined;

  try {
    const refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntent,
        ...(amount ? { amount } : {}),
        // Stripe przyjmuje tylko trzy słownikowe powody; nasz opis idzie w metadata.
        reason: "requested_by_customer",
        metadata: { source: "keika_crm", note: reason },
      },
      idempotencyKey ? { idempotencyKey } : undefined
    );
    return NextResponse.json({
      ok: true,
      refund_id: refund.id,
      status: refund.status ?? "",
      amount: refund.amount,
      currency: refund.currency,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = typeof (error as { code?: unknown })?.code === "string" ? String((error as { code?: string }).code) : "";
    return NextResponse.json({ ok: false, error: "stripe_request_failed", code, message }, { status: 502 });
  }
}
