import { readFile } from "node:fs/promises";
import { join } from "node:path";

const htmlPath = join(process.cwd(), "public", "copied-konfiguruj", "moskitiery.html");
const headInjection =
  '<link rel="stylesheet" href="/copied-konfiguruj/storefront-overrides.css" data-keika-storefront="copy-style" />';
const bodyInjection =
  '<script src="/copied-konfiguruj/storefront-overrides.js" defer data-keika-storefront="copy-script"></script>';

function decorateCopiedHtml(html: string) {
  return html
    .replaceAll("KEIKA Allegro Configurator", "KEIKA | Moskitiery na wymiar")
    .replaceAll("Konfigurator produktu KEIKA dla klientów z Allegro.", "Sklepowy konfigurator moskitier KEIKA.")
    .replaceAll("https://allegro.pl/oferta/18429663001", "")
    .replace(/"offer_id":"[^"]*"/g, '"offer_id":""')
    .replaceAll("</head>", `${headInjection}</head>`)
    .replaceAll("</body>", `${bodyInjection}</body>`);
}

export async function renderCopiedMoskitieryHtml() {
  const html = decorateCopiedHtml(await readFile(htmlPath, "utf8"));

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
