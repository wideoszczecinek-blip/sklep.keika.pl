import { NextResponse } from "next/server";
import { crmBaseUrl } from "@/lib/shop-public";
import { getStripePublishableKey, getStripeServer } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    // Respect the payment method the client actually chose (e.g. "cod" for
    // cash-on-delivery) instead of forcing "stripe" - the CRM's order_create
    // branches on this (see shop_public_orders_create()'s COD/SMS check).
    const paymentProvider =
      typeof payload.payment_provider === "string" && payload.payment_provider ? payload.payment_provider : "stripe";
    const crmResponse = await fetch(`${crmBaseUrl}/biuro/api/shop-public/order_create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        payment_provider: paymentProvider,
      }),
      cache: "no-store",
    });
    const crmJson = (await crmResponse.json()) as {
      ok: boolean;
      order?: {
        order_code: string;
        amount_total: string | null;
        currency: string;
      };
      error?: string;
    };

    if (!crmResponse.ok || !crmJson.ok || !crmJson.order) {
      return NextResponse.json(
        { ok: false, error: crmJson.error || "Order draft failed" },
        { status: crmResponse.status || 500 },
      );
    }

    // Cash-on-delivery orders are already confirmed in the CRM once the SMS
    // code is verified (see order_create.php) - there's no card payment to
    // set up, so skip Stripe entirely.
    if (paymentProvider === "cod") {
      return NextResponse.json({
        ok: true,
        order: crmJson.order,
        payment_enabled: false,
        payment_provider: "cod",
      });
    }

    const stripe = getStripeServer();
    const publishableKey = getStripePublishableKey();
    if (!stripe || !publishableKey || !crmJson.order.amount_total) {
      return NextResponse.json({
        ok: true,
        order: crmJson.order,
        payment_enabled: false,
        payment_provider: "stripe",
      });
    }

    const amount = Math.max(
      1,
      Math.round(Number(crmJson.order.amount_total.replace(",", ".")) * 100),
    );

    const customerEmail =
      typeof payload.customer === "object" && payload.customer && typeof payload.customer.email === "string"
        ? payload.customer.email.trim()
        : "";

    const intent = await stripe.paymentIntents.create({
      amount,
      currency: (crmJson.order.currency || "pln").toLowerCase(),
      automatic_payment_methods: {
        enabled: true,
      },
      // E-mail is required at checkout now - use it for the Stripe receipt
      // too, on top of pre-filling the Payment Element (done client-side).
      ...(customerEmail ? { receipt_email: customerEmail } : {}),
      metadata: {
        order_code: crmJson.order.order_code,
        quote_code: payload.quote_code || "",
      },
    });

    await fetch(`${crmBaseUrl}/biuro/api/shop-public/order_event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "attach_payment_intent",
        order_code: crmJson.order.order_code,
        payment_intent_id: intent.id,
        payment_client_secret: intent.client_secret || "",
      }),
      cache: "no-store",
    });

    return NextResponse.json({
      ok: true,
      order: crmJson.order,
      payment_enabled: true,
      payment_provider: "stripe",
      client_secret: intent.client_secret,
      publishable_key: publishableKey,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Order create failed",
      },
      { status: 500 },
    );
  }
}

