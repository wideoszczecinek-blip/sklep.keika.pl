import { COMPANY_SITE_URL, SHOP_POLICY, SHOP_URL, formatPricePl, getPricedCatalog, resolveFaq, shippingFor } from "@/lib/agent-catalog";

// /llms.txt (llmstxt.org) - zwięzły opis sklepu dla modeli językowych i
// agentów zakupowych AI (25.10.2026). Generowany z lib/agent-catalog.ts,
// więc ceny „od” i zasady dostawy są te same co na stronach i w koszyku.
export const revalidate = 3600;

export async function GET() {
  const catalog = await getPricedCatalog();
  const lines: string[] = [];
  lines.push("# KEIKA - sklep z osłonami okiennymi na wymiar");
  lines.push("");
  lines.push(
    `> Producent osłon okiennych na wymiar ze Szczecinka (${SHOP_POLICY.legalName}, NIP ${SHOP_POLICY.vatId}). Sklep internetowy ${SHOP_URL} sprzedaje w całej Polsce: moskitiery ramkowe, plisy okienne, rolety i plisy do okien dachowych. Każdy produkt jest szyty na wymiar, cenę widać od razu w konfiguratorze na stronie produktu - bez rejestracji. ${SHOP_POLICY.warrantyYears} lat gwarancji, ${SHOP_POLICY.returnDays} dni na zwrot (także produktów na wymiar), darmowa dostawa od ${SHOP_POLICY.freeShippingThreshold} zł.`,
  );
  lines.push("");
  lines.push("Ceny w PLN brutto. Zamówienie składa się na stronie produktu: wybór opcji i wymiaru → koszyk → płatność (BLIK, karta, Revolut Pay, Przelewy24, przelew, płatność za pobraniem).");
  lines.push("Marki okien (VELUX, FAKRO, ROTO i inne) podajemy wyłącznie jako przeznaczenie: nasze rolety i plisy są dopasowane do modeli tych okien, ale są produktem KEIKA, nie producenta okna.");
  lines.push("");
  lines.push("## Produkty");
  lines.push("");
  for (const product of catalog) {
    const price = `od ${formatPricePl(product.priceFrom)} zł${product.priceUnit ? " " + product.priceUnit : ""}`;
    lines.push(`- [${product.name}](${product.url}): ${price}. ${product.description}`);
  }
  for (const product of catalog) {
    const shipping = shippingFor(product);
    lines.push("");
    lines.push(`### ${product.name}`);
    lines.push("");
    lines.push(`- Strona i zamówienie: ${product.url}`);
    lines.push(`- Cena: od ${formatPricePl(product.priceFrom)} zł${product.priceUnit ? " " + product.priceUnit : ""} (${product.priceNote}); dokładna cena po wpisaniu wymiaru lub wyborze modelu okna`);
    lines.push(`- Wymiary: ${product.sizes}`);
    lines.push(`- Pomiar: ${product.measuring}`);
    lines.push(`- Montaż: ${product.mounting}`);
    lines.push(`- Opcje: ${product.options.join("; ")}`);
    lines.push(`- Realizacja: ${product.leadTime}`);
    lines.push(
      `- Dostawa: ${product.freeShippingAlways ? "darmowa od 1 sztuki" : shipping === 0 ? `darmowa (zamówienie od ${SHOP_POLICY.freeShippingThreshold} zł)` : `${formatPricePl(SHOP_POLICY.shippingFee)} zł, darmowa od ${SHOP_POLICY.freeShippingThreshold} zł`}; kurier, Paczkomat InPost (gdy paczka się mieści) lub odbiór osobisty w Szczecinku`,
    );
    lines.push(`- Dla kogo: ${product.bestFor}`);
    const faq = resolveFaq(product).slice(0, 8);
    if (faq.length) {
      lines.push("- Najczęstsze pytania:");
      for (const entry of faq) lines.push(`  - ${entry.question} ${entry.answer}`);
    }
  }
  lines.push("");
  lines.push("## Zakupy, dostawa i zwroty");
  lines.push("");
  lines.push(`- Dostawa w Polsce: kurier lub Paczkomat InPost, ${formatPricePl(SHOP_POLICY.shippingFee)} zł poniżej ${SHOP_POLICY.freeShippingThreshold} zł, powyżej - za darmo (plisy okienne zawsze za darmo); odbiór osobisty w Szczecinku bez opłat. Płatność za pobraniem +${formatPricePl(SHOP_POLICY.codSurcharge)} zł.`);
  lines.push(`- Zwrot: ${SHOP_POLICY.returnDays} dni bez podania przyczyny, także dla produktów szytych na wymiar. Gwarancja ${SHOP_POLICY.warrantyYears} lat.`);
  lines.push(`- [Regulamin sklepu](${SHOP_POLICY.regulaminUrl})`);
  lines.push(`- [Dostawa i płatność](${SHOP_URL}/legal/dostawa-i-platnosc)`);
  lines.push(`- [Reklamacje i zwroty](${SHOP_URL}/legal/reklamacje)`);
  lines.push(`- [Jak zmierzyć okno pod plisę](${SHOP_URL}/plisy/jak-mierzyc)`);
  lines.push("");
  lines.push("## Kontakt i firma");
  lines.push("");
  lines.push(`- Telefon: ${SHOP_POLICY.phone} (${SHOP_POLICY.phoneHours}), e-mail: ${SHOP_POLICY.email}`);
  lines.push(`- Salon: ${SHOP_POLICY.street}, ${SHOP_POLICY.postalCode} ${SHOP_POLICY.city} (${SHOP_POLICY.showroomHours})`);
  lines.push(`- [Kontakt](${SHOP_POLICY.contactUrl})`);
  lines.push(`- [Strona firmowa KEIKA - pomiar i montaż w okolicy Szczecinka, pełna oferta](${COMPANY_SITE_URL})`);
  lines.push("");
  lines.push("## Dane dla maszyn");
  lines.push("");
  lines.push(`- [Plik produktowy JSON (specyfikacja feedu produktów OpenAI)](${SHOP_URL}/feeds/products.json)`);
  lines.push(`- [Plik produktowy Google Merchant Center (XML)](${SHOP_URL}/feeds/google-merchant.xml)`);
  lines.push(`- [Mapa strony](${SHOP_URL}/sitemap.xml)`);
  lines.push("");
  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
