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

    // Prawdziwy IP klienta (nagłówek od Vercela) - browser nie zna własnego,
    // a Meta CAPI korzysta z niego przy dopasowaniu. Doklejamy do bloku
    // tracking, który shop_public_orders_create() zapisuje przy zamówieniu.
    const forwardedFor = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "";
    const clientIp = forwardedFor.split(",")[0]?.trim() || "";
    const tracking =
      typeof payload.tracking === "object" && payload.tracking ? { ...payload.tracking } : {};
    if (clientIp && !tracking.ip) tracking.ip = clientIp;

    const crmResponse = await fetch(`${crmBaseUrl}/biuro/api/shop-public/order_create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        payment_provider: paymentProvider,
        tracking,
      }),
      cache: "no-store",
    });
    const crmJson = (await crmResponse.json()) as {
      ok: boolean;
      order?: {
        order_code: string;
        amount_total: string | null;
        currency: string;
        access_token?: string;
        crm_order_number?: string;
        transfer?: Record<string, unknown> | null;
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

    // Przelewy24 (umowa bezpośrednia): zamówienie to szkic jak przy Stripe;
    // CRM rejestruje transakcję (sessionId = kod zamówienia + próba) i
    // oddaje URL, na który przekierowujemy klienta. Płatność staje się
    // faktem dopiero po powiadomieniu P24 -> CRM (payment_p24_status) albo
    // po sprawdzeniu ze strony statusu (payment_p24_check).
    if (paymentProvider === "p24") {
      const kind =
        typeof payload.payment_method === "string" && payload.payment_method.startsWith("p24_")
          ? payload.payment_method.slice(4)
          : "transfer";
      const startResponse = await fetch(`${crmBaseUrl}/biuro/api/shop-public/payment_p24_start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_code: crmJson.order.order_code,
          access_token: crmJson.order.access_token || "",
          method_kind: kind,
          // Bank wybrany w koszyku (siatka logotypów) - P24 przenosi prosto do niego.
          method_id: Number.isFinite(Number(payload.p24_method_id)) ? Number(payload.p24_method_id) : 0,
          // Klient zaakceptował regulamin sklepu i płatności (w tym P24) przy
          // naszym checkboxie - P24 pomija własne okno zgody.
          regulation_accept: payload.p24_regulation_accepted === true,
        }),
        cache: "no-store",
      });
      const startJson = (await startResponse.json().catch(() => ({}))) as {
        ok?: boolean;
        redirect_url?: string;
        error?: string;
      };
      if (!startResponse.ok || !startJson.ok || !startJson.redirect_url) {
        return NextResponse.json(
          { ok: false, error: startJson.error || "Nie udało się uruchomić płatności Przelewy24." },
          { status: startResponse.status || 502 },
        );
      }
      return NextResponse.json({
        ok: true,
        order: crmJson.order,
        payment_enabled: false,
        payment_provider: "p24",
        redirect_url: startJson.redirect_url,
      });
    }

    // Przelew tradycyjny: zamówienie jest złożone od razu (CRM: status
    // confirmed, payment_status transfer_pending), dane do przelewu wracają
    // w order.transfer, e-mail z tymi danymi wysłał już CRM. Żadnego Stripe.
    if (paymentProvider === "transfer") {
      return NextResponse.json({
        ok: true,
        order: crmJson.order,
        payment_enabled: false,
        payment_provider: "transfer",
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
      // Explicit list instead of automatic_payment_methods: with "automatic"
      // Stripe's own "Link" express-checkout (email/phone + SMS code, a
      // separate Stripe product) can take over as the default option once it
      // recognizes a returning customer, pushing card/BLIK behind a "pay
      // another way" step - confusing for someone expecting to just pick a
      // method. This keeps the real methods and never offers Link.
      // "p24" removed 2026-09-22: Stripe rejected the P24 capability; the
      // shop now runs Przelewy24 directly (see the p24 branch above).
      // Kafelki w koszyku (BLIK / karta / Google Pay & Apple Pay) tworzą
      // intencję z JEDNYM typem (stripe_method), żeby Payment Element
      // pokazał tylko wybrane pole; bez stripe_method (stare wywołania,
      // ponowna płatność) - pełna lista.
      payment_method_types:
        payload.stripe_method === "blik"
          ? ["blik"]
          : payload.stripe_method === "card" || payload.stripe_method === "wallets"
            ? ["card"]
            : ["card", "blik", "revolut_pay"],
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

