import Stripe from "stripe";
import { NextResponse } from "next/server";
import { crmBaseUrl } from "@/lib/shop-public";
import { getStripeServer } from "@/lib/stripe";

export async function POST(request: Request) {
  const stripe = getStripeServer();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!stripe || !webhookSecret) {
    return NextResponse.json({ ok: false, error: "Stripe webhook not configured" }, { status: 503 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ ok: false, error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Invalid signature" },
      { status: 400 },
    );
  }

  const intent = event.data.object as Stripe.PaymentIntent;
  const paymentIntentId = intent.id;
  let paymentStatus = "";

  if (event.type === "payment_intent.succeeded") {
    paymentStatus = "paid";
  } else if (event.type === "payment_intent.payment_failed") {
    paymentStatus = "failed";
  } else if (event.type === "payment_intent.canceled") {
    paymentStatus = "canceled";
  }

  if (paymentStatus) {
    // order_code_hint: real live incident 2026-09-13 - a since-removed
    // frontend bug (see koszyk/page.tsx's own comment on the removed resync
    // effect) minted a second PaymentIntent for an order that already had
    // one active and paid, so the CRM's stored payment_intent_id no longer
    // matched what actually succeeded - the CRM's exact-match lookup found
    // nothing, and 2 real paid orders went completely unrecorded until a
    // manual Stripe-vs-CRM diff caught it. shop_public_orders_create()
    // always stamps order_code/quote_code into the PaymentIntent's own
    // metadata (see _orders.php), so it survives independently of whatever
    // the CRM's own row currently says - passing it through here lets the
    // CRM self-heal via a fallback lookup instead of silently dropping the
    // payment, no matter what future bug causes a similar ID mismatch.
    await fetch(`${crmBaseUrl}/biuro/api/shop-public/payment_stripe_webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payment_intent_id: paymentIntentId,
        payment_status: paymentStatus,
        event_name: event.type,
        order_code_hint: typeof intent.metadata?.order_code === "string" ? intent.metadata.order_code : "",
      }),
      cache: "no-store",
    });
  }

  return NextResponse.json({ ok: true });
}

