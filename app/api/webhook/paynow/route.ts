import { NextResponse } from "next/server";
import { crmBaseUrl } from "@/lib/shop-public";

// Adres powiadomień PayNow. PayNow przyjmuje tylko adres z domeny sklepu
// (sklep.keika.pl), a księgowanie płatności robi CRM - więc ten route
// przekazuje SUROWE body i nagłówek Signature bez zmian do
// payment_paynow_status (tam weryfikacja podpisu HMAC i rozliczenie).
// Kod odpowiedzi CRM wraca do PayNow 1:1 - przy błędzie PayNow ponawia.
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("signature") ?? "";
  try {
    const response = await fetch(`${crmBaseUrl}/biuro/api/shop-public/payment_paynow_status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Signature: signature },
      body,
      cache: "no-store",
    });
    const text = await response.text().catch(() => "");
    return new NextResponse(text, {
      status: response.status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "PayNow relay failed" },
      { status: 502 },
    );
  }
}
