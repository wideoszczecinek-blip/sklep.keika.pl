import { expect, test, type Page } from "@playwright/test";

// Z02 (2026-10-28): Meta Pixel events carry catalogue ids and InitiateCheckout
// fires on real checkout intent, not on merely opening /koszyk.
//
// No real Meta traffic: tracking_config from the CRM is mocked (fixed pixel
// id, CAPI relay disabled) and fbevents.js is replaced with an empty script,
// so the fbq stub from lib/tracking.ts keeps every call in window.fbq.queue
// where the test can read it.

const PLISY_SKU = "plisa-okienna-na-wymiar";
const MOSKITIERY_SKU = "moskitiera-ramkowa-na-wymiar";

async function stubMeta(page: Page) {
  await page.route("**/biuro/api/shop-public/tracking_config**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, meta_pixel_id: "000000000000000", capi_enabled: false }),
    }),
  );
  await page.route("**/biuro/api/shop-public/capi_event**", (route) => route.fulfill({ status: 200, body: "{}" }));
  await page.route("https://connect.facebook.net/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: "" }),
  );
}

type FbqCall = unknown[];

async function fbqCalls(page: Page): Promise<FbqCall[]> {
  return page.evaluate(() => {
    const queue = (window as unknown as { fbq?: { queue?: ArrayLike<unknown>[] } }).fbq?.queue || [];
    return queue.map((args) => JSON.parse(JSON.stringify(Array.from(args))) as unknown[]);
  });
}

function eventsNamed(calls: FbqCall[], name: string): FbqCall[] {
  return calls.filter((call) => (call[0] === "track" || call[0] === "trackCustom") && call[1] === name);
}

test.describe("Meta events (Z02)", () => {
  test("ViewContent on /plisy carries the catalogue sku", async ({ page }) => {
    await stubMeta(page);
    await page.goto("/plisy");
    await expect
      .poll(async () => eventsNamed(await fbqCalls(page), "ViewContent").length, { timeout: 15_000 })
      .toBeGreaterThan(0);
    const [viewContent] = eventsNamed(await fbqCalls(page), "ViewContent");
    const params = viewContent[2] as { content_ids?: string[]; content_type?: string; currency?: string };
    expect(params.content_ids).toEqual([PLISY_SKU]);
    expect(params.content_type).toBe("product");
    expect(params.currency).toBe("PLN");
  });

  test("InitiateCheckout waits for checkout interaction and fires once", async ({ page }) => {
    await stubMeta(page);
    // A cart line seeded straight into storage (no configurator clicks, no
    // AddToCart). Only the phone field is touched below - the form is never
    // complete, so no draft order is created in the CRM.
    await page.addInitScript(() => {
      try {
        if (window.localStorage.getItem("keika_cart")) return;
        window.localStorage.setItem(
          "keika_cart",
          JSON.stringify({
            items: [
              {
                id: "z02-test-line",
                productSlug: "moskitiery-ramkowe",
                productLabel: "Moskitiera ramkowa",
                hardwareLabel: "Biały",
                meshLabel: "Szara",
                widthMm: 1000,
                heightMm: 1200,
                qty: 1,
                price: 149.5,
                total: 149.5,
                createdAt: new Date().toISOString(),
              },
            ],
          }),
        );
      } catch {
        /* ignore */
      }
    });

    // Classic cart forced (the v2 arm shares the same handlers in page.tsx).
    await page.goto("/koszyk?koszyk=stary");
    await expect(page.locator(".cart-page")).toBeVisible();
    // Give the pixel time to boot and any on-entry event time to fire.
    await expect.poll(async () => eventsNamed(await fbqCalls(page), "PageView").length, { timeout: 15_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(3000);
    expect(eventsNamed(await fbqCalls(page), "InitiateCheckout")).toHaveLength(0);

    const phone = page.locator('.cart-checkout-left input[type="tel"]').first();
    await phone.fill("500600700");
    await phone.blur();
    await expect
      .poll(async () => eventsNamed(await fbqCalls(page), "InitiateCheckout").length, { timeout: 10_000 })
      .toBe(1);

    // Further interaction with the same cart contents: still exactly one.
    await phone.focus();
    await phone.fill("500600701");
    await phone.blur();
    await page.waitForTimeout(1500);
    const initiate = eventsNamed(await fbqCalls(page), "InitiateCheckout");
    expect(initiate).toHaveLength(1);
    const params = initiate[0][2] as { content_ids?: string[]; currency?: string; value?: number };
    expect(params.content_ids).toEqual([MOSKITIERY_SKU]);
    expect(params.currency).toBe("PLN");
    expect(params.value).toBeGreaterThan(0);
  });
});
