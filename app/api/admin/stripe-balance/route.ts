import { NextResponse } from "next/server";
import { getStripeServer } from "@/lib/stripe";

// Internal, CRM-only endpoint: exposes the Stripe available-payout balance
// so the CRM dashboard's "Sklep WWW" sales section can show it without the
// CRM ever holding a Stripe secret key itself (that key only lives here).
// Authenticated with a static shared secret (CRM_ADMIN_API_SECRET) sent as
// "Authorization: Bearer <secret>" - not a customer-facing route, so no
// need for anything fancier (session cookies, CSRF, etc. don't apply to a
// server-to-server call).
export async function GET(request: Request) {
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

  try {
    const balance = await stripe.balance.retrieve();
    // Stripe returns amounts in the smallest currency unit (grosze for PLN),
    // and can carry several currencies - report each, plus a convenience
    // "pln" field since that's the only currency this shop actually uses.
    const available = balance.available.map((entry) => ({
      currency: entry.currency,
      amount: entry.amount / 100,
    }));
    const pending = balance.pending.map((entry) => ({
      currency: entry.currency,
      amount: entry.amount / 100,
    }));
    const plnAvailable = available.find((entry) => entry.currency === "pln")?.amount ?? null;

    return NextResponse.json({
      ok: true,
      available,
      pending,
      pln_available: plnAvailable,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "stripe_request_failed", message: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}
