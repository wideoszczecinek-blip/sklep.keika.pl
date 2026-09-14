// "Ekspres" - paid production priority (P2 of the 2026-09-13 audit).
//
// Standard orders go into the daily production bucket the CRM's
// shipping_banner.php publishes ("wyślemy w środę · zostało N miejsc",
// handling_days, cutoff 15:00, Europe/Warsaw). Ekspres jumps that queue
// with its own, earlier cutoff (owner decision 2026-09-14, trial): placed
// before 12:00 on a business day -> dispatched THE SAME DAY; after 12:00 or
// on a weekend -> the next business day. It never touches the bucket
// counter, so the standard promise the banner makes stays exactly what
// production planned.
//
// The choice is a one-time flat fee position ("doplata-ekspres", same
// mechanism as the oversize-parcel surcharge): the cart adds it to the
// quote/order positions, the CRM's discount passes skip it when computing
// SEZON20's base (quote_save.php / _orders.php / shop_discount_codes.php),
// production sees it as a position AND as an "EKSPRES" line at the top of
// the order note. Stored client-side so the landing-page toggle carries
// into the cart.

// Master switch. OFF until the CRM side is live: quote_save.php, _orders.php
// and shop_discount_codes.php must list "doplata-ekspres" among the
// non-discountable positions (patched locally in the CRM repo 2026-09-13,
// awaiting upload) - otherwise SEZON20 would be computed on the fee too and
// the CRM's total (= what Stripe / the COD courier collects) would be
// 3,98 zł below what the cart shows. Flip to true + deploy once uploaded.
export const EXPRESS_ENABLED = true;

export const EXPRESS_FEE_AMOUNT = 19.9;
export const EXPRESS_POSITION_SLUG = "doplata-ekspres";
export const EXPRESS_LABEL = "Ekspres - priorytet produkcji";
export const EXPRESS_SUMMARY =
  "Ekspres: priorytet produkcji, wysyłka tego samego dnia przy zamówieniu do 12:00 w dzień roboczy (po 12:00 lub w weekend - następnego dnia roboczego)";
export const EXPRESS_NOTE_LINE =
  "⚡ EKSPRES: priorytet produkcji - wysyłka TEGO SAMEGO DNIA (zamówienie do 12:00), po 12:00 lub w weekend następnego dnia roboczego";
export const EXPRESS_CHANGED_EVENT = "keika:express-changed";
// Ekspres cutoff - deliberately its own constant, NOT the standard banner's
// 15:00 (that one is the daily bucket close for the regular queue).
export const EXPRESS_CUTOFF = { hour: 12, minute: 0 };
export const EXPRESS_DEFAULT_CUTOFF = EXPRESS_CUTOFF;

const STORAGE_KEY = "keika_shop_express_v1";

export function isExpressSelected(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setExpressSelected(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable - the choice just doesn't survive a reload.
  }
  try {
    window.dispatchEvent(new CustomEvent(EXPRESS_CHANGED_EVENT, { detail: { on } }));
  } catch {
    // ignore
  }
}

const DAY_LABELS = ["w niedzielę", "w poniedziałek", "we wtorek", "w środę", "w czwartek", "w piątek", "w sobotę"];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

// Mon-Fri only; public holidays aren't modelled (a holiday order simply
// gets dispatched a day later - the note says "po przyjęciu", not a date).
function isBusinessDay(date: Date): boolean {
  const weekday = date.getDay();
  return weekday >= 1 && weekday <= 5;
}

function nextBusinessDay(from: Date): Date {
  let next = addDays(startOfDay(from), 1);
  while (!isBusinessDay(next)) next = addDays(next, 1);
  return next;
}

/** "jeszcze dzisiaj" / "jutro" / "pojutrze" / "w czwartek" - same vocabulary
 * the CRM's shipping banner uses for the standard date. */
export function relativeDayLabel(target: Date, now: Date = new Date()): string {
  const diff = Math.round((startOfDay(target).getTime() - startOfDay(now).getTime()) / 86400000);
  if (diff === 0) return "jeszcze dzisiaj";
  if (diff === 1) return "jutro";
  if (diff === 2) return "pojutrze";
  return DAY_LABELS[target.getDay()];
}

export function computeExpressDispatch(
  now: Date = new Date(),
  cutoffHour: number = EXPRESS_DEFAULT_CUTOFF.hour,
  cutoffMinute: number = EXPRESS_DEFAULT_CUTOFF.minute,
): { date: Date; label: string } {
  const beforeCutoff =
    now.getHours() < cutoffHour || (now.getHours() === cutoffHour && now.getMinutes() < cutoffMinute);
  // Same-day dispatch when placed before the cutoff on a business day,
  // otherwise the next business day (trial rule, 2026-09-14).
  const dispatch = isBusinessDay(now) && beforeCutoff ? startOfDay(now) : nextBusinessDay(now);
  return { date: dispatch, label: relativeDayLabel(dispatch, now) };
}

export function formatCutoff(hour: number, minute: number): string {
  return `${hour}:${String(minute).padStart(2, "0")}`;
}

export type DispatchInfo = {
  /** Standard bucket dispatch as the CRM phrases it ("pojutrze", "w środę"). */
  standardLabel: string;
  /** Express dispatch relative to now ("jutro", "w poniedziałek"). */
  expressLabel: string;
  cutoffLabel: string;
  remainingOrders: number | null;
};

/** Same endpoint the landing page's shipping banner reads - one source of
 * truth for the standard date and the cutoff. Null when the banner is off. */
export async function fetchDispatchInfo(productSlug: string): Promise<DispatchInfo | null> {
  try {
    const response = await fetch(
      `https://crm-keika.groovemedia.pl/biuro/api/shop-public/shipping_banner.php?product=${encodeURIComponent(productSlug)}`,
    );
    const json = (await response.json()) as {
      ok?: boolean;
      banner?: {
        available?: boolean;
        day_label?: string;
        cutoff_hour?: number;
        cutoff_minute?: number;
        remaining_orders?: number;
      };
    };
    const banner = json.ok ? json.banner : null;
    if (!banner || !banner.available) return null;
    // The banner's own cutoff (15:00) only governs the standard bucket - the
    // Ekspres cutoff is the fixed EXPRESS_CUTOFF.
    return {
      standardLabel: String(banner.day_label || "").trim() || "w 3 dni robocze",
      expressLabel: computeExpressDispatch(new Date(), EXPRESS_CUTOFF.hour, EXPRESS_CUTOFF.minute).label,
      cutoffLabel: formatCutoff(EXPRESS_CUTOFF.hour, EXPRESS_CUTOFF.minute),
      remainingOrders: Number.isFinite(banner.remaining_orders) ? Number(banner.remaining_orders) : null,
    };
  } catch {
    return null;
  }
}
