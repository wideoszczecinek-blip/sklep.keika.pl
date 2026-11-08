import { NextResponse } from "next/server";
import { crmBaseUrl } from "@/lib/shop-public";

type RouteContext = {
  params: Promise<{ code: string }>;
};

export const dynamic = "force-dynamic";

// Krótkie linki z SMS-ów: https://sklep.keika.pl/p/<kod> (właściciel 9.11.2026:
// SMS „dokończ płatność” ma się zmieścić w jednej wiadomości, a pełny link do
// zamówienia z access_token ma ponad 100 znaków). Cel trzyma CRM
// (core/lib/shop_short_link.php); tu tylko przekierowanie. Przekierowujemy
// wyłącznie na własny sklep - obcy adres albo nieznany kod kończy na stronie głównej.
const ALLOWED_HOSTS = new Set(["sklep.keika.pl"]);

export async function GET(request: Request, context: RouteContext) {
  const { code } = await context.params;
  const home = new URL("/", request.url);
  const clean = String(code || "").trim().toLowerCase();
  if (!/^[a-z0-9]{5,12}$/.test(clean)) return NextResponse.redirect(home, 302);
  try {
    const response = await fetch(`${crmBaseUrl}/biuro/api/shop-public/short_link?code=${encodeURIComponent(clean)}`, { cache: "no-store" });
    const json = (await response.json().catch(() => null)) as { ok?: boolean; target?: unknown } | null;
    const target = json?.ok && typeof json.target === "string" ? json.target : "";
    if (target) {
      const url = new URL(target);
      if (url.protocol === "https:" && ALLOWED_HOSTS.has(url.hostname)) {
        const redirect = NextResponse.redirect(url, 302);
        redirect.headers.set("Cache-Control", "no-store");
        redirect.headers.set("X-Robots-Tag", "noindex");
        return redirect;
      }
    }
  } catch {
    // CRM chwilowo niedostępny - klient trafia na stronę główną zamiast na błąd
  }
  return NextResponse.redirect(home, 302);
}
