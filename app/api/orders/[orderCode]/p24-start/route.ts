import { NextResponse } from "next/server";
import { crmBaseUrl } from "@/lib/shop-public";

type RouteContext = {
  params: Promise<{ orderCode: string }>;
};

// "Dokończ płatność przez Przelewy24" na /zamowienie/[orderCode] (po
// nieudanej / przerwanej płatności albo z e-maila przypominającego). CRM
// sprawdza dostęp (access_token / verifier) tak samo jak order_get,
// rejestruje nową transakcję P24 i oddaje adres przekierowania.
export async function POST(request: Request, context: RouteContext) {
  const { orderCode } = await context.params;
  try {
    const body = await request.json().catch(() => ({}));
    const verifier = typeof body.verifier === "string" ? body.verifier : "";
    const accessToken = typeof body.access_token === "string" ? body.access_token : "";
    const kind = typeof body.method_kind === "string" ? body.method_kind : "transfer";
    // Bank wybrany w siatce (id z p24_banks) - P24 przenosi wtedy prosto do
    // banku, bez swojej listy metod. Tak samo jak w koszyku.
    const methodId = Number(body.method_id) > 0 ? Number(body.method_id) : 0;
    const regulationAccept = body.regulation_accept === true;
    if (!verifier && !accessToken) {
      return NextResponse.json({ ok: false, error: "Brak danych dostępu." }, { status: 400 });
    }
    const response = await fetch(`${crmBaseUrl}/biuro/api/shop-public/payment_p24_start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_code: orderCode,
        access_token: accessToken,
        verifier,
        method_kind: kind,
        ...(methodId ? { method_id: methodId } : {}),
        regulation_accept: regulationAccept,
      }),
      cache: "no-store",
    });
    const json = await response.json().catch(() => ({ ok: false, error: "Błąd odpowiedzi CRM" }));
    return NextResponse.json(json, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "P24 start failed" },
      { status: 500 },
    );
  }
}
