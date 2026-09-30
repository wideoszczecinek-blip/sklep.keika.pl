import { NextResponse } from "next/server";
import { crmBaseUrl } from "@/lib/shop-public";

type RouteContext = {
  params: Promise<{ orderCode: string }>;
};

// "Dokończ płatność przez PayNow" na /zamowienie/[orderCode] (po nieudanej /
// przerwanej płatności) - mirror app/api/orders/[orderCode]/p24-start. CRM
// sprawdza dostęp (access_token / verifier) tak samo jak order_get,
// rejestruje płatność PayNow i oddaje redirect_url (pbl/card) albo
// payment_id+status (blik, bez przekierowania - kod wpisywany na stronie).
export async function POST(request: Request, context: RouteContext) {
  const { orderCode } = await context.params;
  try {
    const body = await request.json().catch(() => ({}));
    const verifier = typeof body.verifier === "string" ? body.verifier : "";
    const accessToken = typeof body.access_token === "string" ? body.access_token : "";
    const kind = typeof body.method_kind === "string" ? body.method_kind : "pbl";
    // Bank wybrany w siatce (id z paynow_banks) - tylko dla kind=pbl.
    const paymentMethodId = Number(body.payment_method_id) > 0 ? Number(body.payment_method_id) : 0;
    const blikCode = typeof body.blik_code === "string" ? body.blik_code : "";
    if (!verifier && !accessToken) {
      return NextResponse.json({ ok: false, error: "Brak danych dostępu." }, { status: 400 });
    }
    const response = await fetch(`${crmBaseUrl}/biuro/api/shop-public/payment_paynow_start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_code: orderCode,
        access_token: accessToken,
        verifier,
        method_kind: kind,
        ...(paymentMethodId ? { payment_method_id: paymentMethodId } : {}),
        ...(blikCode ? { blik_code: blikCode } : {}),
      }),
      cache: "no-store",
    });
    const json = await response.json().catch(() => ({ ok: false, error: "Błąd odpowiedzi CRM" }));
    return NextResponse.json(json, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "PayNow start failed" },
      { status: 500 },
    );
  }
}
