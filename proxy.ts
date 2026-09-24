import { NextResponse, type NextRequest } from "next/server";

// Next 16 "proxy" (formerly middleware). Reklamowe adresy /?produkt=<slug>
// przekierowują 308 na statycznie prerenderowane trasy produktowe (audyt
// 2026-09-13 dla moskitier, 2026-09-24 dla plis), gubiąc wyłącznie parametr
// "produkt" i zachowując resztę (fbclid, utm_*, resume_token, wroc).
// Działa tylko na "/" - żadna inna trasa nie jest ruszana.
const STATIC_PRODUCT_ROUTES: Record<string, string> = {
  "moskitiery-ramkowe": "/moskitiery-ramkowe",
  plisy: "/plisy",
};

export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  if (url.pathname !== "/") return NextResponse.next();
  const produkt = (url.searchParams.get("produkt") || "").trim().toLowerCase();
  const target = STATIC_PRODUCT_ROUTES[produkt];
  if (!target) return NextResponse.next();
  const next = url.clone();
  next.pathname = target;
  next.searchParams.delete("produkt");
  return NextResponse.redirect(next, 308);
}

export const config = { matcher: ["/"] };
