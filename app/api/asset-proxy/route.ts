import type { NextRequest } from "next/server";

const ALLOWED_HOSTS = new Set([
  "crm-keika.groovemedia.pl",
  "images.unsplash.com",
]);

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url") || "";

  if (!url) {
    return new Response("Missing url", { status: 400 });
  }

  let target: URL;

  try {
    target = new URL(url);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(target.hostname)) {
    return new Response("Forbidden", { status: 403 });
  }

  const upstream = await fetch(target.toString(), {
    headers: {
      Accept: request.headers.get("accept") || "*/*",
    },
    cache: "force-cache",
  });

  if (!upstream.ok) {
    return new Response("Upstream fetch failed", { status: upstream.status });
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  const contentLength = upstream.headers.get("content-length");

  if (contentType) headers.set("Content-Type", contentType);
  if (contentLength) headers.set("Content-Length", contentLength);
  headers.set("Cache-Control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800");

  return new Response(upstream.body, {
    status: 200,
    headers,
  });
}
