import { NextResponse, type NextRequest } from "next/server";

// Next 16 "proxy" (formerly middleware). The ad landing URL
// /?produkt=moskitiery-ramkowe permanently redirects to the statically
// rendered /moskitiery-ramkowe route (audit 2026-09-13), dropping only the
// produkt param and keeping everything else (fbclid, utm_*, resume_token)
// intact. Runs on "/" only - every other route is untouched.
export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  if (url.pathname !== "/") return NextResponse.next();
  const produkt = (url.searchParams.get("produkt") || "").trim().toLowerCase();
  if (produkt !== "moskitiery-ramkowe") return NextResponse.next();
  const target = url.clone();
  target.pathname = "/moskitiery-ramkowe";
  target.searchParams.delete("produkt");
  return NextResponse.redirect(target, 308);
}

export const config = { matcher: ["/"] };
