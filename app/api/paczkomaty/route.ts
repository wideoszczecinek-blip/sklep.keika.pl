import type { NextRequest } from "next/server";

export const runtime = "nodejs";

// Proxies InPost's public, tokenless "points" endpoint (no merchant account
// needed - it's the same open data source their own Geowidget queries under
// the hood). Calling it straight from the browser gets a 403 from InPost's
// Cloudflare bot-management the moment a cross-origin Origin header shows up,
// so this route calls it server-to-server (which that same check happily
// allows) and hands the client back a small, cart-relevant shape instead of
// InPost's much larger raw point object.
const INPOST_POINTS_URL = "https://api-pl-points.easypack24.net/v1/points";
const SEARCH_RADIUS_METERS = 10000;
const RESULT_LIMIT = 20;

export type PaczkomatPoint = {
  id: string;
  address: string;
  lat: number;
  lng: number;
  openingHours: string | null;
  distanceMeters: number | null;
};

type InpostRawPoint = {
  name?: string;
  address?: { line1?: string; line2?: string };
  location?: { latitude?: number; longitude?: number };
  opening_hours?: string;
  distance?: number | null;
  type?: string[];
  status?: string;
};

function mapPoint(raw: InpostRawPoint): PaczkomatPoint | null {
  const id = String(raw.name || "").trim();
  const lat = raw.location?.latitude;
  const lng = raw.location?.longitude;
  if (!id || typeof lat !== "number" || typeof lng !== "number") return null;

  const line1 = String(raw.address?.line1 || "").trim();
  const line2 = String(raw.address?.line2 || "").trim();
  const address = [line1, line2].filter(Boolean).join(", ");

  return {
    id,
    address,
    lat,
    lng,
    openingHours: raw.opening_hours ? String(raw.opening_hours) : null,
    distanceMeters: typeof raw.distance === "number" ? raw.distance : null,
  };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const lat = Number.parseFloat(params.get("lat") || "");
  const lng = Number.parseFloat(params.get("lng") || "");
  const query = (params.get("query") || "").trim();

  if (!query && (!Number.isFinite(lat) || !Number.isFinite(lng))) {
    return Response.json({ ok: false, error: "Provide either lat+lng or query." }, { status: 400 });
  }

  const upstream = new URL(INPOST_POINTS_URL);
  upstream.searchParams.set("type", "parcel_locker");
  upstream.searchParams.set("status", "Operating");
  upstream.searchParams.set("limit", String(RESULT_LIMIT));

  if (query) {
    upstream.searchParams.set("query", query);
  } else {
    upstream.searchParams.set("relative_point", `${lat},${lng}`);
    upstream.searchParams.set("max_distance", String(SEARCH_RADIUS_METERS));
  }

  try {
    const upstreamResponse = await fetch(upstream.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!upstreamResponse.ok) {
      return Response.json({ ok: false, error: "Nie udało się pobrać listy paczkomatów." }, { status: 502 });
    }

    const data = (await upstreamResponse.json()) as { items?: InpostRawPoint[] };
    const points = (data.items || [])
      .map(mapPoint)
      .filter((point): point is PaczkomatPoint => point !== null);

    return Response.json({ ok: true, points });
  } catch {
    return Response.json({ ok: false, error: "Nie udało się połączyć z InPost." }, { status: 502 });
  }
}
