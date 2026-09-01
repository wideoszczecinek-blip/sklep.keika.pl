import { NextResponse } from "next/server";
import { getStripeServer } from "@/lib/stripe";

// Temporary: check the real Stripe status of a specific PaymentIntent, to
// confirm before manually repairing shop_www_orders data for the order that
// was affected by the webhook secret mismatch. Deleted right after use.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || "";
  const stripe = getStripeServer();
  if (!stripe || !id) {
    return NextResponse.json({ ok: false });
  }
  const intent = await stripe.paymentIntents.retrieve(id);
  return NextResponse.json({
    ok: true,
    id: intent.id,
    status: intent.status,
    amount: intent.amount,
    currency: intent.currency,
    payment_method_types: intent.payment_method_types,
    created: intent.created,
  });
}
