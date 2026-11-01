/**
 * Wymiary plis: cm/mm jak w konfiguratorze (właściciel 1.11: „mm/cm muszą być tak samo rozpoznawane jak w konfiguratorze”).
 * Wspólne dla konfiguratora plis (features/plisy/ConfiguratorPanel.tsx) i kreatora wymiarów wizualizatora
 * (features/wizualizator/WizWycena.tsx): jednostka zapamiętana na urządzeniu (ten sam klucz co moskitiery),
 * przeliczanie co do milimetra i podpowiedź „czy chodziło o…”, gdy liczba wygląda na drugą jednostkę.
 */
export type DimensionUnit = "mm" | "cm";
export const DIMENSION_UNIT_STORAGE_KEY = "keika_dimension_unit_v1";

export function readStoredUnit(): DimensionUnit {
  try {
    if (typeof window === "undefined") return "cm";
    return window.localStorage.getItem(DIMENSION_UNIT_STORAGE_KEY) === "mm" ? "mm" : "cm";
  } catch {
    return "cm";
  }
}

export function storeUnit(unit: DimensionUnit): void {
  try {
    window.localStorage.setItem(DIMENSION_UNIT_STORAGE_KEY, unit);
  } catch {
    /* ignore */
  }
}

export function mmToInput(mm: number, unit: DimensionUnit): string {
  return unit === "cm" ? String(Math.round(mm) / 10) : String(Math.round(mm));
}

export function inputToMm(raw: string, unit: DimensionUnit): number {
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return unit === "cm" ? Math.round(n * 10) : Math.round(n);
}

export type DimensionLimits = { widthMinMm: number; widthMaxMm: number; heightMinMm: number; heightMaxMm: number };

/**
 * „15 × 120” w centymetrach (za mało, ale razy 10 pasuje) albo „1200 × 1500” w centymetrach (to milimetry):
 * propozycja poprawionego wymiaru w mm - albo null, gdy nie ma czego poprawiać. Szerokość do 2× maksimum (dwie plisy).
 */
export function timesTenFix(widthMm: number, heightMm: number, unit: DimensionUnit, l: DimensionLimits): { widthMm: number; heightMm: number; fromMm: boolean } | null {
  if (unit !== "cm" || widthMm <= 0 || heightMm <= 0) return null;
  const fixAxis = (v: number, min: number, max: number) => (v < min ? v * 10 : v > max ? v / 10 : v);
  const fixW = fixAxis(widthMm, l.widthMinMm, l.widthMaxMm * 2);
  const fixH = fixAxis(heightMm, l.heightMinMm, l.heightMaxMm);
  if (fixW === widthMm && fixH === heightMm) return null;
  const wOk = fixW >= l.widthMinMm && fixW <= l.widthMaxMm * 2;
  const hOk = fixH >= l.heightMinMm && fixH <= l.heightMaxMm;
  const fromMm = fixW < widthMm || fixH < heightMm;
  return wOk && hOk ? { widthMm: Math.round(fixW), heightMm: Math.round(fixH), fromMm } : null;
}

/** „60 × 120” wpisane przy milimetrach: obie liczby poniżej połowy najmniejszej plisy - to prawie na pewno centymetry. */
export function looksLikeCm(widthMm: number, heightMm: number, unit: DimensionUnit, l: DimensionLimits): boolean {
  return unit === "mm" && widthMm > 0 && heightMm > 0 && widthMm < l.widthMinMm / 2 && heightMm < l.heightMinMm / 2;
}
