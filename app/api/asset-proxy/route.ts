import sharp from "sharp";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

const ALLOWED_HOSTS = new Set([
  "crm-keika.groovemedia.pl",
  "images.unsplash.com",
]);

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url") || "";
  const widthParam = Number.parseInt(request.nextUrl.searchParams.get("w") || "", 10);
  const qualityParam = Number.parseInt(request.nextUrl.searchParams.get("q") || "", 10);

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
  const optimizeImage = Boolean(contentType && contentType.startsWith("image/"));
  const width = Number.isFinite(widthParam) && widthParam > 0 ? Math.min(widthParam, 2400) : null;
  const quality = Number.isFinite(qualityParam) && qualityParam > 0 ? Math.min(Math.max(qualityParam, 30), 90) : 72;

  if (optimizeImage) {
    try {
      const input = Buffer.from(await upstream.arrayBuffer());
      let pipeline = sharp(input, { failOn: "none" }).rotate();

      if (width) {
        pipeline = pipeline.resize({
          width,
          withoutEnlargement: true,
          fit: "inside",
        });
      }

      const output = await pipeline.webp({
        quality,
        effort: 4,
      }).toBuffer();

      headers.set("Content-Type", "image/webp");
      headers.set("Content-Length", String(output.byteLength));
      headers.set("Cache-Control", "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800");

      return new Response(new Uint8Array(output), {
        status: 200,
        headers,
      });
    } catch {
      // Fall back to passthrough below when optimization fails.
    }
  }

  if (contentType) headers.set("Content-Type", contentType);
  if (contentLength) headers.set("Content-Length", contentLength);
  headers.set("Cache-Control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800");

  return new Response(upstream.body, {
    status: 200,
    headers,
  });
}
