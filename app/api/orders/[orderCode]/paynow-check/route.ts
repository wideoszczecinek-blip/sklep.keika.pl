import { NextResponse } from "next/server";
import { crmBaseUrl } from "@/lib/shop-public";

type RouteContext = {
  params: Promise<{ orderCode: string }>;
};

// Mirror app/api/orders/[orderCode]/p24-check: po powrocie z PayNow (pbl)
// albo po wysłaniu kodu BLIK strona odpytuje ten endpoint - CRM sprawdza w
// PayNow stan płatności (gdy powiadomienie jeszcze nie doszło) i - jeśli
// CONFIRMED - księguje zamówienie i uruchamia automat.
export async function POST(request: Request, context: RouteContext) {
  const { orderCode } = await context.params;
  try {
    const body = await request.json().catch(() => ({}));
    const verifier = typeof body.verifier === "string" ? body.verifier : "";
    const accessToken = typeof body.access_token === "string" ? body.access_token : "";
    if (!verifier && !accessToken) {
      return NextResponse.json({ ok: false, error: "Brak danych dostępu." }, { status: 400 });
    }
    const response = await fetch(`${crmBaseUrl}/biuro/api/shop-public/payment_paynow_check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_code: orderCode, access_token: accessToken, verifier }),
      cache: "no-store",
    });
    const json = await response.json().catch(() => ({ ok: false, error: "Błąd odpowiedzi CRM" }));
    return NextResponse.json(json, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "PayNow check failed" },
      { status: 500 },
    );
  }
}
