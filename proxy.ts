import { NextResponse, type NextRequest } from "next/server";

// Next 16 "proxy" (formerly middleware). Reklamowe adresy /?produkt=<slug>
// przekierowują 308 na statycznie prerenderowane trasy produktowe (audyt
// 2026-09-13 dla moskitier, 2026-09-24 dla plis), gubiąc wyłącznie parametr
// "produkt" i zachowując resztę (fbclid, utm_*, resume_token, wroc).
const STATIC_PRODUCT_ROUTES: Record<string, string> = {
  "moskitiery-ramkowe": "/moskitiery-ramkowe",
  plisy: "/plisy",
  // 25.10.2026: produkty dachowe dostały własne strony (agenci AI i Google
  // widzieli pod /?produkt=... tylko stronę główną).
  "rolety-dachowe": "/rolety-dachowe",
  "plisy-dachowe": "/plisy-dachowe",
  "rolety-dzien-noc": "/rolety-dzien-noc",
  "rolety-tradycyjne": "/rolety-tradycyjne",
  zaluzje: "/zaluzje",
};

// Podgląd tylko dla właściciela (2026-10-17): nowe produkty do czasu
// akceptacji widzi wyłącznie ruch z dozwolonych adresów IP albo z ciasteczkiem
// podglądu (ustawianym adresem ...?podglad=<token>). Reszta trafia na stronę
// główną. Zdjęcie bramki = usunięcie slugu z PREVIEW_ONLY_ROUTES.
const PREVIEW_ONLY_ROUTES = new Set(["/rolety-dzien-noc", "/rolety-tradycyjne", "/zaluzje"]);
const PREVIEW_ONLY_SLUGS = new Set(["rolety-dzien-noc", "rolety-tradycyjne", "zaluzje"]);
const PREVIEW_ALLOWED_IPS = new Set(
  (process.env.PREVIEW_ALLOWED_IPS || "164.127.253.116").split(",").map((ip) => ip.trim()).filter(Boolean),
);
const PREVIEW_TOKEN = process.env.PREVIEW_TOKEN || "keika-podglad-rolety-2026";
const PREVIEW_COOKIE = "keika_podglad";

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const first = forwarded.split(",")[0].trim();
  return first || (request.headers.get("x-real-ip") || "").trim();
}

function previewAllowed(request: NextRequest): boolean {
  if (PREVIEW_ALLOWED_IPS.has(clientIp(request))) return true;
  return request.cookies.get(PREVIEW_COOKIE)?.value === PREVIEW_TOKEN;
}

function previewRoutePath(url: URL): string | null {
  if (PREVIEW_ONLY_ROUTES.has(url.pathname)) return url.pathname;
  // Strony modeli żaluzji (/zaluzje/<model>) - ta sama bramka co katalog.
  if (url.pathname.startsWith("/zaluzje/")) return url.pathname;
  const match = url.pathname.match(/^\/(?:produkt|kategoria)\/([a-z0-9-]+)\/?$/);
  if (match && PREVIEW_ONLY_SLUGS.has(match[1])) return `/${match[1]}`;
  if (url.pathname === "/" && PREVIEW_ONLY_SLUGS.has((url.searchParams.get("produkt") || "").trim().toLowerCase())) {
    return STATIC_PRODUCT_ROUTES[(url.searchParams.get("produkt") || "").trim().toLowerCase()];
  }
  return null;
}

// Filmy (30.10.2026, właściciel: „nie rozdajemy ich, to nasza droga praca”): plik .mp4 gra tylko w odtwarzaczu
// na naszych stronach. Otwarcie adresu wprost w przeglądarce (Sec-Fetch-Dest: document) albo osadzenie na cudzej
// stronie (Referer spoza keika) = 403. Brak nagłówków (stare przeglądarki) przepuszczamy, żeby klient zawsze zobaczył film.
const OUR_HOSTS = /(^|\.)keika\.pl$|\.vercel\.app$|^localhost$|^127\.0\.0\.1$/;
function videoBlocked(request: NextRequest): boolean {
  const dest = request.headers.get("sec-fetch-dest") || "";
  if (dest === "document" || dest === "iframe" || dest === "embed" || dest === "object") return true;
  const ref = request.headers.get("referer") || "";
  if (ref) {
    try {
      if (!OUR_HOSTS.test(new URL(ref).hostname)) return true;
    } catch {
      return true;
    }
  }
  return false;
}

export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  if (url.pathname.toLowerCase().endsWith(".mp4")) {
    if (videoBlocked(request)) {
      return new NextResponse("Ten film jest dostępny tylko na sklep.keika.pl", { status: 403, headers: { "x-robots-tag": "noindex", "content-type": "text/plain; charset=utf-8" } });
    }
    const res = NextResponse.next();
    res.headers.set("x-robots-tag", "noindex");
    return res;
  }
  const previewPath = previewRoutePath(url);

  if (previewPath) {
    // ?podglad=<token> - zapisz ciasteczko i wróć pod czysty adres.
    const token = (url.searchParams.get("podglad") || "").trim();
    if (token && token === PREVIEW_TOKEN) {
      const clean = url.clone();
      clean.pathname = previewPath;
      clean.searchParams.delete("podglad");
      clean.searchParams.delete("produkt");
      const response = NextResponse.redirect(clean, 307);
      response.cookies.set(PREVIEW_COOKIE, PREVIEW_TOKEN, { maxAge: 60 * 60 * 24 * 30, path: "/", sameSite: "lax", httpOnly: true, secure: true });
      return response;
    }
    if (!previewAllowed(request)) {
      const home = url.clone();
      home.pathname = "/";
      home.search = "";
      const response = NextResponse.redirect(home, 307);
      response.headers.set("x-robots-tag", "noindex");
      return response;
    }
  }

  if (url.pathname !== "/") return NextResponse.next();
  const produkt = (url.searchParams.get("produkt") || "").trim().toLowerCase();
  const target = STATIC_PRODUCT_ROUTES[produkt];
  if (!target) return NextResponse.next();
  const next = url.clone();
  next.pathname = target;
  next.searchParams.delete("produkt");
  return NextResponse.redirect(next, 308);
}

export const config = {
  matcher: ["/(.*\\.mp4)", "/", "/rolety-dzien-noc", "/rolety-tradycyjne", "/zaluzje", "/zaluzje/:path*", "/produkt/:slug", "/kategoria/:slug"],
};
