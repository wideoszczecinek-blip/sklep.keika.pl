import { NextResponse } from "next/server";
import { getStripeServer } from "@/lib/stripe";

// Temporary diagnostic/repair route - lists registered Stripe webhook
// endpoints (GET) and, since the registered one's signing secret evidently
// doesn't match what's in STRIPE_WEBHOOK_SECRET (0 orders have ever had
// payment_status flip to 'paid' - every real delivery attempt fails
// signature verification), creates a fresh endpoint + secret we can
// actually capture (POST, requires ?confirm=1). Deleted right after use.
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

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("confirm") !== "1") {
    return NextResponse.json({ ok: false, error: "pass ?confirm=1" }, { status: 400 });
  }
  const stripe = getStripeServer();
  if (!stripe) {
    return NextResponse.json({ ok: false, error: "no stripe client" });
  }
  const created = await stripe.webhookEndpoints.create({
    url: "https://sklep-keika-pl.vercel.app/api/webhook/stripe",
    enabled_events: ["payment_intent.succeeded", "payment_intent.payment_failed", "payment_intent.canceled"],
    description: "shop.keika.pl - recreated, old endpoint's secret didn't match STRIPE_WEBHOOK_SECRET",
  });
  return NextResponse.json({
    ok: true,
    id: created.id,
    secret: created.secret,
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || "";
  if (!id) {
    return NextResponse.json({ ok: false, error: "pass ?id=we_..." }, { status: 400 });
  }
  const stripe = getStripeServer();
  if (!stripe) {
    return NextResponse.json({ ok: false, error: "no stripe client" });
  }
  const deleted = await stripe.webhookEndpoints.del(id);
  return NextResponse.json({ ok: true, deleted });
}
