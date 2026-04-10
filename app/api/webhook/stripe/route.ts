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
    await fetch(`${crmBaseUrl}/biuro/api/shop-public/payment_stripe_webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payment_intent_id: paymentIntentId,
        payment_status: paymentStatus,
        event_name: event.type,
      }),
      cache: "no-store",
    });
  }

  return NextResponse.json({ ok: true });
}

