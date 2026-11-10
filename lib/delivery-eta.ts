/**
 * Przewidywany termin dostawy (właściciel 9.11.2026 - baner w koszyku; 10.11.2026 -
 * „po zakupie na stronie podziękowania musi mieć informację o przewidywanym czasie dostawy”).
 * Termin = najdłuższa produkcja w zamówieniu (dni robocze, bez świąt), wysyłka po
 * produkcji, kurier doręcza następnego dnia roboczego. Jedno źródło dla koszyka
 * (app/koszyk/cart-trust.tsx) i strony zamówienia (app/zamowienie/[orderCode]).
 */
import { dzienWysylki } from "@/features/plisy/Premium";
import { ROLETY_COPY, isRoletySlug } from "@/features/rolety/shared";

/** Dni robocze produkcji wg produktu (agent-catalog.ts, ROLETY_COPY). Moskitiery: termin z planu produkcji,
 * którego sklep nie zna - przyjmujemy ostrożnie 7 dni. */
export function dniProdukcji(slug: string): number {
  if (slug === "rolety-dachowe") return 5;
  if (slug === "plisy" || slug === "plisy-dachowe") return 7;
  if (isRoletySlug(slug)) return ROLETY_COPY[slug].leadTimeDays;
  if (slug.startsWith("zaluzj")) return 15;
  if (slug.startsWith("moskitier")) return 7;
  return 10;
}

export const DZIEN_TYGODNIA = ["w niedzielę", "w poniedziałek", "we wtorek", "w środę", "w czwartek", "w piątek", "w sobotę"];

export type DeliveryEta = { dni: number; dostawa: Date; dzien: string; data: string };

/** Termin dla listy produktów, licząc od dnia `od` (domyślnie dziś). null, gdy brak produktów. */
export function przewidywanaDostawa(slugs: string[], od: Date = new Date()): DeliveryEta | null {
  const lista = slugs.filter(Boolean);
  if (!lista.length) return null;
  const dni = Math.max(...lista.map(dniProdukcji));
  const dostawa = dzienWysylki(dzienWysylki(od, dni), 1);
  return {
    dni,
    dostawa,
    dzien: DZIEN_TYGODNIA[dostawa.getDay()],
    data: `${String(dostawa.getDate()).padStart(2, "0")}.${String(dostawa.getMonth() + 1).padStart(2, "0")}`,
  };
}

/** "2026-11-10 14:30:00" / ISO -> data lokalna (bez godziny); null, gdy nie da się odczytać. */
export function dataZCrm(text: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(text || ""));
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
