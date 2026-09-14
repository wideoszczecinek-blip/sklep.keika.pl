import { expect, test, type Page } from "@playwright/test";

// The one path that pays the bills: product page -> colour -> mesh -> size ->
// price -> cart -> totals. Stops before the checkout form on purpose: a
// filled form creates a real draft order + PaymentIntent in the CRM.

// Prices render with a non-breaking space before "zł" (Intl.NumberFormat) -
// \s matches it.
const PRICE_1000x1200 = /149,50\s?zł|119,60\s?zł/;

async function collectPageErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test.describe("moskitiery-ramkowe", () => {
  test("SEO surface: robots, sitemap, canonical product URL, ad-URL redirect", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toContain("Sitemap:");

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain("/moskitiery-ramkowe");

    const redirected = await request.get("/?produkt=moskitiery-ramkowe&fbclid=smoke", { maxRedirects: 0 });
    expect([301, 308]).toContain(redirected.status());
    const location = redirected.headers()["location"] || "";
    expect(location).toContain("/moskitiery-ramkowe");
    expect(location).toContain("fbclid=smoke");
    expect(location).not.toContain("produkt=");

    const product = await request.get("/moskitiery-ramkowe");
    expect(product.status()).toBe(200);
    const html = await product.text();
    expect(html).toContain('<link rel="canonical" href="https://sklep.keika.pl/moskitiery-ramkowe"');
    expect(html).toContain("application/ld+json");
    expect((html.match(/<h1/g) || []).length).toBe(1);
  });

  test("configure a frame and land in the cart with matching totals", async ({ page }) => {
    const errors = await collectPageErrors(page);
    await page.goto("/moskitiery-ramkowe");

    await expect(page.locator("h1")).toHaveText(/Moskitiery ramkowe/);
    // No modal may interrupt a fresh visitor (audit P0).
    await page.waitForTimeout(2500);
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    // Cookie bar: decline (no marketing consent needed for the smoke path).
    const decline = page.getByRole("button", { name: "Tylko niezbędne" });
    if (await decline.isVisible().catch(() => false)) await decline.click();

    // Colour -> mesh -> size.
    await page.locator(".hardware-card-main").first().click();
    await page.locator(".hero-product-mesh-option").first().click();
    const inputs = page.locator(".hero-product-dimensions-grid input");
    await inputs.nth(0).fill("1000");
    await inputs.nth(1).fill("1200");
    await inputs.nth(1).blur();

    const priceBox = page.locator(".hero-product-mini-summary-price-final");
    await expect(priceBox).toBeVisible();
    // 1000x1200 mm = 4,40 m perimeter billed as 5 mb: 149,50 zł list,
    // 119,60 zł once SEZON20 (auto-activated) is applied.
    await expect(priceBox).toContainText(PRICE_1000x1200);
    await expect(page.locator(".hero-product-mini-summary-price-details")).toContainText("5 mb");

    // Regression guard (owner report 2026-09-14): with the CTA sitting at the
    // very bottom edge of the screen, the floating bottom tab bar used to
    // cover it and swallow the tap - the frame could not be added to the cart
    // at all on a phone. Scroll it exactly there before clicking; Playwright
    // fails the click if anything else would receive it.
    const addToCart = page.getByRole("button", { name: "Dodaj do koszyka" });
    await addToCart.evaluate((el) => el.scrollIntoView({ block: "end" }));
    await page.waitForTimeout(900);
    await addToCart.click({ timeout: 10_000 });
    await expect(page.getByText("Dodano do koszyka!")).toBeVisible();

    await page.goto("/koszyk");
    await expect(page.locator(".cart-page")).toBeVisible();
    await expect(page.getByText("1000 × 1200 mm")).toBeVisible();
    // Totals line matches what the configurator quoted.
    await expect(page.locator(".cart-page-summary-row").filter({ hasText: "Razem" })).toContainText(PRICE_1000x1200);
    // Checkout must not auto-create an order: the explicit CTA is the only way.
    await expect(page.getByRole("button", { name: "Zapisz dane i przejdź do płatności" })).toHaveCount(0);
    await expect(page.locator(".cart-checkout-form-grid input").first()).toHaveAttribute("autocomplete", "email");

    expect(errors, "no uncaught page errors").toEqual([]);
  });
});
