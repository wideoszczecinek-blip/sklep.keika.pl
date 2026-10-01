import { NextResponse } from "next/server";
import { crmBaseUrl } from "@/lib/shop-public";

// Klauzule RODO mElements (PayNow) do wyświetlenia przy polu kodu BLIK -
// wymóg aktywacji BLIK White Label: treść pobierana z API PayNow (CRM
// cachuje 12 h), nie wpisana na sztywno w sklepie.
export const revalidate = 43200;

export async function GET() {
  try {
    const response = await fetch(`${crmBaseUrl}/biuro/api/shop-public/paynow_gdpr`, {
      next: { revalidate: 43200 },
    });
    const json = await response.json().catch(() => ({ ok: false, notices: [] }));
    return NextResponse.json(json, { status: response.status });
  } catch {
    return NextResponse.json({ ok: false, notices: [] }, { status: 502 });
  }
}
