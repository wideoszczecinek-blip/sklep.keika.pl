// Wspólny cache GET-ów do CRM po stronie przeglądarki.
//
// Powód (pomiar landingu plis, 2026-09-24): te same adresy pobierało po
// kilka niezależnych komponentów naraz - /shop-public/site pięć razy (pasek
// promocyjny, plakietka PayPo, metody płatności, stopka), a
// shipping_banner.php i /product po trzy razy z efektów landingu. Na
// dławionym 4G każde takie zapytanie to ~1 s na łączu, które w tym momencie
// jest zajęte wczytywaniem konfiguratora.
//
// Tu: jedno zapytanie w locie na adres + krótki cache odpowiedzi. Tylko GET
// po treść - zamówień, płatności i analityki to nie dotyczy (tamte mają
// własne ścieżki i nie mogą być cache'owane).
const DEFAULT_TTL_MS = 30 * 1000;
const cache = new Map<string, { at: number; value: unknown }>();
const inFlight = new Map<string, Promise<unknown>>();

export async function crmGetJson<T = unknown>(url: string, ttlMs: number = DEFAULT_TTL_MS): Promise<T> {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.at < ttlMs) return cached.value as T;
  const pending = inFlight.get(url);
  if (pending) return pending as Promise<T>;
  const request = fetch(url, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((value) => {
      cache.set(url, { at: Date.now(), value });
      return value as T;
    })
    .finally(() => {
      inFlight.delete(url);
    });
  inFlight.set(url, request as Promise<unknown>);
  return request as Promise<T>;
}
