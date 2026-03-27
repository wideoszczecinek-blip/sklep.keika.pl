import { readFile } from "node:fs/promises";
import { join } from "node:path";

const htmlPath = join(process.cwd(), "public", "copied-konfiguruj", "moskitiery.html");
const headInjection =
  '<link rel="stylesheet" href="/copied-konfiguruj/storefront-overrides.css" data-keika-storefront="copy-style" />';
const bodyInjection =
  '<script src="/copied-konfiguruj/storefront-overrides.js" defer data-keika-storefront="copy-script"></script>';
const textReplacements = [
  ["KEIKA Allegro Configurator", "KEIKA | Moskitiery na wymiar"],
  ["Konfigurator produktu KEIKA dla klientów z Allegro.", "Sklepowy konfigurator moskitier KEIKA."],
  ["zakup na Allegro", "sklep internetowy"],
  ["Najpierw konfigurujesz, potem kupujesz na Allegro", "Skonfiguruj i zamów bezpośrednio"],
  ["Finalizacja zamówienia nadal odbywa się na Allegro", "Finalizacja zamówienia odbywa się bezpośrednio w sklepie KEIKA"],
  ["Koszyk zawiera pozycje przypisane do różnych aukcji Allegro.", "Koszyk zawiera pozycje z różnych wariantów konfiguracji."],
  ["Zakup finalizujesz bezpiecznie na Allegro.", "Zakup finalizujesz bezpośrednio w sklepie KEIKA."],
  ["Podepnij ofertę Allegro w panelu CRM, aby aktywować przejście do aukcji.", "Zapisz wycenę lub skontaktuj się z nami, aby dokończyć zamówienie online."],
  ["Wróć do aukcji Allegro", "Przejdź do zamówienia"],
  ["Podepnij ofertę Allegro", "Zamówienie online w przygotowaniu"],
  ["Tyle już zyskujesz dzięki wspólnemu rozliczeniu obwodu w tej samej aukcji.", "Tyle już zyskujesz dzięki wspólnemu rozliczeniu obwodu w tym samym wariancie."],
  ["tej samej aukcji", "tego samego wariantu"],
  ["w wiadomości po zakupie", "po zapisaniu wyceny"],
  [
    "W uwagach do zakupu albo w wiadomości po zakupie podaj nam ten kod, żebyśmy od razu połączyli Twoją wycenę z zamówieniem.",
    "Po zapisaniu wyceny zachowaj ten kod. Dzięki niemu szybciej odnajdziemy Twoją konfigurację podczas finalizacji zamówienia.",
  ],
];

function decorateCopiedHtml(html: string) {
  const decorated = textReplacements.reduce(
    (content, [from, to]) => content.replaceAll(from, to),
    html,
  );

  return decorated
    .replace(/https:\/\/allegro\.pl\/oferta\/[0-9]+/g, "")
    .replace(/"offer_id":"[^"]*"/g, '"offer_id":""')
    .replace(/"offer_url":"[^"]*"/g, '"offer_url":""')
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
