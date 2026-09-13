// "Ekspres" - paid production priority (P2 of the 2026-09-13 audit).
//
// Standard orders go into the daily production bucket the CRM's
// shipping_banner.php publishes ("wyślemy w środę · zostało N miejsc",
// handling_days, cutoff 15:00, Europe/Warsaw). Ekspres jumps that queue:
// accepted the same business day when placed before the cutoff (otherwise
// the next business day), dispatched the business day after acceptance.
// It never touches the bucket counter, so the standard promise the banner
// makes stays exactly what production planned.
//
// The choice is a one-time flat fee position ("doplata-ekspres", same
// mechanism as the oversize-parcel surcharge): the cart adds it to the
// quote/order positions, the CRM's discount passes skip it when computing
// SEZON20's base (quote_save.php / _orders.php / shop_discount_codes.php),
// production sees it as a position AND as an "EKSPRES" line at the top of
// the order note. Stored client-side so the landing-page toggle carries
// into the cart.

export const EXPRESS_FEE_AMOUNT = 19.9;
export const EXPRESS_POSITION_SLUG = "doplata-ekspres";
export const EXPRESS_LABEL = "Ekspres - priorytet produkcji";
export const EXPRESS_SUMMARY =
  "Ekspres: priorytet produkcji, wysyłka następnego dnia roboczego po przyjęciu (zamówienia do 15:00 w dni robocze)";
export const EXPRESS_NOTE_LINE = "⚡ EKSPRES: priorytet produkcji, wysyłka następnego dnia roboczego po przyjęciu zamówienia";
export const EXPRESS_CHANGED_EVENT = "keika:express-changed";
export const EXPRESS_DEFAULT_CUTOFF = { hour: 15, minute: 0 };

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

/** "dzisiaj" / "jutro" / "pojutrze" / "w czwartek" - same vocabulary the
 * CRM's shipping banner uses for the standard date. */
export function relativeDayLabel(target: Date, now: Date = new Date()): string {
  const diff = Math.round((startOfDay(target).getTime() - startOfDay(now).getTime()) / 86400000);
  if (diff === 0) return "dzisiaj";
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
  const accepted = isBusinessDay(now) && beforeCutoff ? startOfDay(now) : nextBusinessDay(now);
  const dispatch = nextBusinessDay(accepted);
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
    const cutoffHour = Number.isFinite(banner.cutoff_hour) ? Number(banner.cutoff_hour) : EXPRESS_DEFAULT_CUTOFF.hour;
    const cutoffMinute = Number.isFinite(banner.cutoff_minute) ? Number(banner.cutoff_minute) : EXPRESS_DEFAULT_CUTOFF.minute;
    return {
      standardLabel: String(banner.day_label || "").trim() || "w 3 dni robocze",
      expressLabel: computeExpressDispatch(new Date(), cutoffHour, cutoffMinute).label,
      cutoffLabel: formatCutoff(cutoffHour, cutoffMinute),
      remainingOrders: Number.isFinite(banner.remaining_orders) ? Number(banner.remaining_orders) : null,
    };
  } catch {
    return null;
  }
}
