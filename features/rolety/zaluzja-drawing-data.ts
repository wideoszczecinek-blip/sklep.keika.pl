// Dane rysunku żaluzji i szczegółów pozycji w grupach (ZaluzjaDrawing.tsx) -
// zwykły moduł bez "use client", bo czyta je też lib/cart.ts.

export type ZaluzjaDrawingData = {
  widthMm: number;
  heightMm: number;
  /** Szerokość lameli (16/25/35/50/65 mm). */
  slatMm: number;
  slatColor: string;
  slatImg: string;
  slatLabel: string;
  ladder: "cord" | "tape" | "none";
  tapeColor: string;
  tapeImg: string;
  /** Podpis taśmy na rysunku ("taśma STANDARD" gdy kolor dobiera biuro). */
  tapeLabel: string;
  /** Maskownica: "" = model bez maskownicy. */
  valance: "" | "plain" | "both" | "left" | "right";
  tilter: "left" | "right";
  brake: "left" | "right";
  control: "cord" | "crank";
  crankMm: number;
  guides: boolean;
  mount: "w-swietle-szyby" | "na-skrzydlo" | "na-sciane" | "";
  /** Na ścianę: światło (wnęka) w mm. */
  lightWidthMm: number;
  lightHeightMm: number;
  stackMm: number;
};

export type ZaluzjaDetailGroup = { title: string; rows: Array<{ label: string; value: string }> };

/** Odczyt danych rysunku z koszyka (localStorage) - tylko znane pola. */
export function readZaluzjaDrawing(raw: unknown): ZaluzjaDrawingData | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const s = (v: unknown, max = 400) => String(v ?? "").slice(0, max);
  const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
  const widthMm = n(r.widthMm);
  const heightMm = n(r.heightMm);
  if (widthMm <= 0 || heightMm <= 0) return undefined;
  return {
    widthMm,
    heightMm,
    slatMm: n(r.slatMm) || 50,
    slatColor: s(r.slatColor, 40),
    slatImg: s(r.slatImg),
    slatLabel: s(r.slatLabel, 120),
    ladder: pick(r.ladder, ["cord", "tape", "none"] as const, "cord"),
    tapeColor: s(r.tapeColor, 40),
    tapeImg: s(r.tapeImg),
    tapeLabel: s(r.tapeLabel, 80),
    valance: pick(r.valance, ["", "plain", "both", "left", "right"] as const, ""),
    tilter: pick(r.tilter, ["left", "right"] as const, "right"),
    brake: pick(r.brake, ["left", "right"] as const, "right"),
    control: pick(r.control, ["cord", "crank"] as const, "cord"),
    crankMm: n(r.crankMm),
    guides: r.guides === true,
    mount: pick(r.mount, ["w-swietle-szyby", "na-skrzydlo", "na-sciane", ""] as const, ""),
    lightWidthMm: n(r.lightWidthMm),
    lightHeightMm: n(r.lightHeightMm),
    stackMm: n(r.stackMm),
  };
}

export function readZaluzjaDetailGroups(raw: unknown): ZaluzjaDetailGroup[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const groups = raw
    .filter((g): g is Record<string, unknown> => Boolean(g) && typeof g === "object")
    .map((g) => ({
      title: String(g.title ?? "").slice(0, 80),
      rows: (Array.isArray(g.rows) ? g.rows : [])
        .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
        .map((row) => ({ label: String(row.label ?? "").slice(0, 80), value: String(row.value ?? "").slice(0, 400) }))
        .filter((row) => row.label && row.value),
    }))
    .filter((g) => g.title && g.rows.length);
  return groups.length ? groups : undefined;
}

/** Przybliżony kolor taśmy z nazwy S&S (próbki to zdjęcia, nie kolor) - "" = nie znamy. */
export function zaluzjeTapeColor(label: string): string {
  const name = String(label || "").toLowerCase();
  const map: Array<[RegExp, string]> = [
    [/dark (grey|gray)|antra|graphite|anthr/, "#4a4d52"],
    [/black|czarn/, "#26262a"],
    [/dark beige/, "#a8916f"],
    [/dark brown|chocolate|coffee|wenge|cacao/, "#5a3b2a"],
    [/mocca|mocha|walnut|brown|brąz|chestnut/, "#7d5a40"],
    [/cherry|mahog|red|bordo/, "#8b3f34"],
    [/taupe|greige/, "#8b7d70"],
    [/light (grey|gray)|silver|cloud/, "#c3c5c7"],
    [/grey|gray|smoke|stone|szar/, "#9a9a96"],
    [/light blue|blue|navy/, "#7fa3c6"],
    [/green|olive|sage/, "#7f9a6e"],
    [/sassafras|yellow|gold/, "#d9c178"],
    [/sand|limestone|linen/, "#cdb894"],
    [/oak|natural|beech|pine|teak|maple/, "#b9925e"],
    [/beige|cream|vanilla/, "#dccaa9"],
    [/ivory|off-white|shell/, "#efe8d6"],
    [/white|snow|biał/, "#f5f5f2"],
  ];
  for (const [re, hex] of map) if (re.test(name)) return hex;
  return "";
}
