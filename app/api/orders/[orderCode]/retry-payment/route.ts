import { NextResponse } from "next/server";
import { crmBaseUrl } from "@/lib/shop-public";
import { getStripePublishableKey, getStripeServer } from "@/lib/stripe";
import type { PublicOrder } from "@/lib/shop-public";

type RouteContext = {
  params: Promise<{ orderCode: string }>;
};

// Powers the "Dokończ płatność" button on /zamowienie/[orderCode] - reached
// either by a customer typing their phone/email in, or straight from the
// payment_failed e-mail's one-click access_token link. Re-verifies access
// the exact same way order_get already does (same CRM endpoint, same
// verifier/access_token check) before creating anything, then mints a fresh
// Stripe PaymentIntent for the order's existing amount and re-attaches it
// (order_event/attach_payment_intent) so the webhook can match the new
// attempt back to this order by payment_intent_id, same as a first-time
// checkout.
export async function POST(request: Request, context: RouteContext) {
  const { orderCode } = await context.params;

  try {
    const body = await request.json().catch(() => ({}));
    const verifier = typeof body.verifier === "string" ? body.verifier : "";
    const accessToken = typeof body.access_token === "string" ? body.access_token : "";

    if (!verifier && !accessToken) {
      return NextResponse.json({ ok: false, error: "Brak danych dostępu." }, { status: 400 });
    }

    const lookupParams = new URLSearchParams({ order_code: orderCode });
    if (accessToken) lookupParams.set("access_token", accessToken);
    else lookupParams.set("verifier", verifier);

    const orderResponse = await fetch(`${crmBaseUrl}/biuro/api/shop-public/order_get?${lookupParams.toString()}`, {
      cache: "no-store",
    });
    const orderJson = (await orderResponse.json()) as { ok: boolean; order?: PublicOrder; error?: string };
    if (!orderResponse.ok || !orderJson.ok || !orderJson.order) {
      return NextResponse.json(
        { ok: false, error: orderJson.error || "Nie udało się odczytać zamówienia." },
        { status: orderResponse.status || 404 },
      );
    }

    const order = orderJson.order;
    if (order.payment_status === "paid") {
      return NextResponse.json({ ok: false, error: "To zamówienie jest już opłacone." }, { status: 409 });
    }
    if (order.payment_provider !== "stripe" || !order.amount_total) {
      return NextResponse.json(
        { ok: false, error: "Płatność online jest niedostępna dla tego zamówienia." },
        { status: 400 },
      );
    }

    const stripe = getStripeServer();
    const publishableKey = getStripePublishableKey();
    if (!stripe || !publishableKey) {
      return NextResponse.json({ ok: false, error: "Płatność online jest chwilowo niedostępna." }, { status: 503 });
    }

    const amount = Math.max(1, Math.round(Number(order.amount_total.replace(",", ".")) * 100));

    const intent = await stripe.paymentIntents.create({
      amount,
      currency: (order.currency || "pln").toLowerCase(),
      payment_method_types: ["card", "blik", "p24", "revolut_pay"],
      ...(order.customer_email ? { receipt_email: order.customer_email } : {}),
      metadata: {
        order_code: order.order_code,
        quote_code: order.quote_code || "",
        retry: "1",
      },
    });

    await fetch(`${crmBaseUrl}/biuro/api/shop-public/order_event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "attach_payment_intent",
        order_code: order.order_code,
        payment_intent_id: intent.id,
        payment_client_secret: intent.client_secret || "",
      }),
      cache: "no-store",
    });

    return NextResponse.json({
      ok: true,
      client_secret: intent.client_secret,
      publishable_key: publishableKey,
      contact: {
        name: order.customer_name || "",
        phone: order.customer_phone || "",
        email: order.customer_email || "",
        city: order.shipping_city || "",
        postcode: order.shipping_postcode || "",
        address1: order.shipping_address_line_1 || "",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Nie udało się rozpocząć płatności." },
      { status: 500 },
    );
  }
}
