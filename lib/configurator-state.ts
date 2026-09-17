// Rejestr "na czym stanął klient w konfiguratorze" - każdy panel
// (moskitiery ramkowe, plisy, rolety dachowe) zgłasza tu swój aktualny
// postęp, a SiteAnalytics dokleja go do heartbeat / page_exit. Dzięki temu
// przy analizie "gdzie uciekają" widać nie tylko ostatnie kliknięcie, ale
// stan całego formularza w chwili wyjścia: które kroki gotowe, czego brakuje,
// czy przycisk "Dodaj do koszyka" był aktywny i dlaczego nie.
export type ConfiguratorProgress = {
  product: string;
  /** Ukończone kroki (np. montaż, kolor profilu, tkanina, wymiary). */
  done: string[];
  /** Brakujące kroki w kolejności, w jakiej klient je widzi. */
  missing: string[];
  /** Dlaczego CTA jest zablokowane mimo wypełnienia (np. wymiary poza zakresem). */
  blocked_reason: string;
  cta_enabled: boolean;
  price: number | null;
  positions: number;
  qty: number;
  width_mm: number;
  height_mm: number;
  unit: string;
};

let current: ConfiguratorProgress | null = null;
let updatedAt = 0;

export function reportConfiguratorState(state: ConfiguratorProgress): void {
  current = state;
  updatedAt = Date.now();
}

export function clearConfiguratorState(product?: string): void {
  if (!product || current?.product === product) {
    current = null;
    updatedAt = 0;
  }
}

/** Spłaszczony zrzut do meta zdarzenia (klucze z prefiksem cfg_). */
export function configuratorStateMeta(): Record<string, string | number | boolean | null> {
  if (!current) return {};
  return {
    cfg_product: current.product,
    cfg_done: current.done.join(","),
    cfg_missing: current.missing.join(","),
    cfg_blocked: current.blocked_reason,
    cfg_cta: current.cta_enabled,
    cfg_price: current.price,
    cfg_positions: current.positions,
    cfg_qty: current.qty,
    cfg_width_mm: current.width_mm,
    cfg_height_mm: current.height_mm,
    cfg_unit: current.unit,
    cfg_age_s: updatedAt ? Math.round((Date.now() - updatedAt) / 1000) : null,
  };
}
