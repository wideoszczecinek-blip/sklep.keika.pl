/**
 * Routes a remote image URL through Next.js's built-in image optimizer
 * (the same `/_next/image` endpoint the `next/image` component uses) so it
 * gets resized, recompressed, and served as WebP/AVIF instead of the raw
 * original file.
 *
 * Product photos and swatches are uploaded to the CRM at full camera/export
 * resolution (often 2-3MB PNGs) and were being rendered as-is via plain
 * `<img src>` / CSS `background-image`, so a 64px swatch thumbnail downloaded
 * the same multi-megabyte file as a full-bleed hero image. This wraps the
 * URL so the browser only ever fetches a copy sized for where it's used.
 *
 * Safe to call on anything: local/data/blob URLs and empty strings pass
 * through untouched, and the target host must be listed in
 * `images.remotePatterns` (next.config.ts) or Next.js will refuse to
 * optimize it and this becomes a no-op 400 — currently crm-keika.groovemedia.pl
 * and images.unsplash.com are allowed.
 */
// The shop's own hostnames. CRM-edited landing fields (gallery, main photo)
// hold absolute URLs like https://sklep.keika.pl/plisy/realizacja-01.jpg -
// files that live in /public here. The optimizer only accepts remote hosts
// from images.remotePatterns, so such a URL 400s on the shop itself (seen
// live 2026-09-16: the plisy gallery rendered three broken tiles). Rewritten
// to the local path, which the optimizer serves without any allow-list and
// which also works on localhost / preview deployments.
const SELF_HOSTS = ["sklep.keika.pl", "www.sklep.keika.pl", "sklep-keika-pl.vercel.app"];

export function optimizeImageUrl(url: string, width: number, quality = 75): string {
  let raw = String(url || "").trim();
  if (!raw) return raw;
  const selfMatch = raw.match(new RegExp("^https?://([^/]+)(/.*)$", "i"));
  if (selfMatch && SELF_HOSTS.includes(selfMatch[1].toLowerCase())) {
    raw = selfMatch[2];
  }
  if (raw.startsWith("data:") || raw.startsWith("blob:") || raw.startsWith("/_next/image")) {
    return raw;
  }
  if (!/^https?:\/\//i.test(raw)) {
    return raw;
  }
  const safeWidth = Math.max(16, Math.round(width));
  const safeQuality = Math.min(100, Math.max(1, Math.round(quality)));
  return `/_next/image?url=${encodeURIComponent(raw)}&w=${safeWidth}&q=${safeQuality}`;
}
