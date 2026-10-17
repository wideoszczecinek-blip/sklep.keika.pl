import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/wycena - "Poproś o wycenę" z informacyjnych landingów
// (features/oferta). Tworzy lead w CRM przez ten sam endpoint, z którego
// korzysta strona firmowa keika.pl (website_lead_submit.php, typ "wycena"):
// lead w `leads` ze źródłem WWW + e-mail do biura. Sekret CRM nigdy nie
// trafia do przeglądarki - stąd proxy po stronie serwera. Anty-bot: honeypot
// i czas od wyrenderowania formularza; walidacja i limit na IP są w CRM.

const CRM_BASE = (process.env.CRM_API_BASE_URL || "https://crm-keika.groovemedia.pl").replace(/\/+$/, "");
const SECRET = process.env.WEBSITE_CMS_SHARED_SECRET || "";
const FALLBACK_ERROR = "Nie udało się wysłać zapytania. Zadzwoń do nas albo napisz na biuro@keika.pl.";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D+/g, "");
  if (digits.startsWith("0048")) digits = digits.slice(4);
  else if (digits.startsWith("48") && digits.length === 11) digits = digits.slice(2);
  return digits;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "Nieprawidłowe dane formularza." }, 400);
  }

  const str = (key: string, max = 500) => String(body[key] ?? "").trim().slice(0, max);

  // Honeypot i zbyt szybkie wysłanie: odpowiadamy "ok", żeby bot nie dostał sygnału.
  if (str("website", 200) !== "") return json({ ok: true, reference: "OK" });
  const renderedAt = Number(body.form_rendered_at ?? 0);
  if (renderedAt > 0 && Date.now() - renderedAt < 2500) return json({ ok: true, reference: "OK" });

  const name = str("name", 120);
  const phone = normalizePhone(str("phone", 40));
  const email = str("email", 190);
  const city = str("city", 120);
  const variant = str("variant", 160);
  const product = str("product", 120);
  const message = str("message", 2500);
  const consent = body.consent === true || body.consent === "true" || body.consent === 1;

  if (name.length < 2) return json({ ok: false, error: "Podaj imię i nazwisko." }, 422);
  if (phone.length !== 9) return json({ ok: false, error: "Podaj poprawny numer telefonu (9 cyfr)." }, 422);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: "Adres e-mail wygląda na niepoprawny." }, 422);
  if (!consent) return json({ ok: false, error: "Potrzebujemy zgody na kontakt w sprawie zgłoszenia." }, 422);

  if (!SECRET) {
    console.error("[WYCENA] WEBSITE_CMS_SHARED_SECRET is not configured");
    return json({ ok: false, error: FALLBACK_ERROR }, 503);
  }

  const utmRaw = typeof body.utm === "object" && body.utm ? (body.utm as Record<string, unknown>) : {};
  const utm: Record<string, string> = {};
  for (const [key, value] of Object.entries(utmRaw)) {
    if (/^utm_[a-z]+$/.test(key) && typeof value === "string" && value.trim()) utm[key] = value.trim().slice(0, 120);
  }

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || (request.headers.get("x-real-ip") ?? "");
  const userAgent = (request.headers.get("user-agent") ?? "").slice(0, 300);

  const products = [product, variant].filter(Boolean);
  const lines = [`Zapytanie o wycenę ze sklepu sklep.keika.pl (${product || "produkt"})`];
  if (variant) lines.push(`Wariant: ${variant}`);
  if (message) lines.push("", message);

  try {
    const response = await fetch(`${CRM_BASE}/biuro/api/shop-public/website_lead_submit.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Website-Secret": SECRET },
      body: JSON.stringify({
        type: "wycena",
        name,
        phone,
        email,
        city,
        products: Array.from(new Set(products)).slice(0, 12),
        message: lines.join("\n"),
        consent: true,
        page_url: str("page_url", 500),
        referrer: str("referrer", 500),
        utm,
        client_ip: ip,
        user_agent: userAgent,
      }),
      signal: AbortSignal.timeout(20000),
    });
    const data = (await response.json()) as { ok?: boolean; reference?: string; lead_id?: number | null; error?: string; code?: string };
    if (!data.ok) {
      return json({ ok: false, error: data.error || FALLBACK_ERROR, code: data.code }, response.status >= 400 ? response.status : 500);
    }
    return json({ ok: true, reference: data.reference || (data.lead_id ? `L-${data.lead_id}` : "OK") });
  } catch (error) {
    console.error("[WYCENA] CRM unreachable:", error instanceof Error ? error.message : error);
    return json({ ok: false, error: FALLBACK_ERROR }, 502);
  }
}
