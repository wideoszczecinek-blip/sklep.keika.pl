// Pobranie profilu konfiguratora z CRM z ponowieniem (31.10.2026). Jedno zapytanie bez ponowienia
// kończyło się „przepraszamy, spróbuj ponownie” przy każdym chwilowym przeciążeniu CRM
// (30.10: 54 nieudane wejścia z reklam plis w kilku falach po kilkanaście minut).
// Ponawiamy błąd sieci, przekroczenie czasu i odpowiedź 5xx/429; odpowiedź 4xx albo poprawny JSON zwracamy od razu.

const ATTEMPT_TIMEOUT_MS = 9000;
const RETRY_DELAYS_MS = [1200, 3000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** fetch + response.json() z ponowieniem; null po ostatniej nieudanej próbie. Nigdy nie rzuca. */
export async function fetchConfiguratorJson<T>(url: string, init: RequestInit = { cache: "no-store" }): Promise<T | null> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS) : null;
    try {
      const response = await fetch(url, controller ? { ...init, signal: controller.signal } : init);
      if (response.status >= 500 || response.status === 429) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as T;
    } catch {
      if (attempt === RETRY_DELAYS_MS.length) return null;
      await sleep(RETRY_DELAYS_MS[attempt]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return null;
}
