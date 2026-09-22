import { NextResponse } from "next/server";
import { crmBaseUrl } from "@/lib/shop-public";

type RouteContext = {
  params: Promise<{ orderCode: string }>;
};

// Kafelek "Przelew tradycyjny" na /zamowienie/[orderCode]: przestawia
// nieopłacone zamówienie na przelew i wysyła klientowi dane do wpłaty
// (CRM: payment_transfer_switch). Dostęp weryfikuje CRM - access_token z
// linku w e-mailu albo telefon/e-mail wpisany na stronie.
export async function POST(request: Request, context: RouteContext) {
  const { orderCode } = await context.params;
  try {
    const body = await request.json().catch(() => ({}));
    const verifier = typeof body.verifier === "string" ? body.verifier : "";
    const accessToken = typeof body.access_token === "string" ? body.access_token : "";
    if (!verifier && !accessToken) {
      return NextResponse.json({ ok: false, error: "Brak danych dostępu." }, { status: 400 });
    }
    const response = await fetch(`${crmBaseUrl}/biuro/api/shop-public/payment_transfer_switch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_code: orderCode, access_token: accessToken, verifier }),
      cache: "no-store",
    });
    const json = await response.json().catch(() => ({ ok: false, error: "Błąd odpowiedzi CRM" }));
    return NextResponse.json(json, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Transfer switch failed" },
      { status: 500 },
    );
  }
}
