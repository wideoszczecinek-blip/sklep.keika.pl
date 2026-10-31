// IndexNow (31.10.2026): powiadamia Binga (Copilot, DuckDuckGo, Ecosia,
// część wyszukiwania ChatGPT) i Yandex o nowych lub zmienionych stronach -
// bez konta w Bing Webmaster. Klucz leży jako plik /<klucz>.txt na
// sklep.keika.pl i keika.pl (public/ w obu repo).
//
//   node scripts/indexnow.mjs                      - wszystkie adresy z map obu stron
//   node scripts/indexnow.mjs sklep.keika.pl       - tylko jedna strona
//   node scripts/indexnow.mjs https://sklep.keika.pl/plisy https://keika.pl/kontakt
//                                                  - wybrane adresy (po zmianie treści)
//
// Uruchamiać po zmianach, nie codziennie dla wszystkiego - IndexNow ma
// zgłaszać to, co się zmieniło.

const KEY = "9e058c7c9bc2dce44d1f4edd961b8114";
const HOSTS = ["sklep.keika.pl", "keika.pl"];
const ENDPOINT = "https://api.indexnow.org/indexnow";
const BATCH = 10000;

async function sitemapUrls(host) {
  const response = await fetch(`https://${host}/sitemap.xml`);
  if (!response.ok) throw new Error(`${host}/sitemap.xml: HTTP ${response.status}`);
  const xml = await response.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim().replace(/&amp;/g, "&"));
}

async function submit(host, urls) {
  for (let start = 0; start < urls.length; start += BATCH) {
    const urlList = urls.slice(start, start + BATCH);
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host, key: KEY, keyLocation: `https://${host}/${KEY}.txt`, urlList }),
    });
    // 200 = przyjęte, 202 = przyjęte, klucz w trakcie sprawdzania.
    console.log(`${host}: ${urlList.length} adresów -> HTTP ${response.status} ${await response.text()}`);
  }
}

const args = process.argv.slice(2);
const explicitUrls = args.filter((arg) => /^https?:\/\//.test(arg));
const byHost = new Map();
if (explicitUrls.length) {
  for (const url of explicitUrls) {
    const host = new URL(url).hostname;
    if (!HOSTS.includes(host)) throw new Error(`Nieobsługiwana strona: ${host}`);
    byHost.set(host, [...(byHost.get(host) || []), url]);
  }
} else {
  for (const host of args.length ? args : HOSTS) byHost.set(host, await sitemapUrls(host));
}
for (const [host, urls] of byHost) await submit(host, [...new Set(urls)]);
