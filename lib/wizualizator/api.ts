/**
 * Wizualizator „Twoje okno” - rozmowa z CRM (views/biuro/api/shop-public/wizualizator/).
 * Zdjęcie zmniejszamy w przeglądarce (do 2600 px, JPEG, orientacja z EXIF
 * zastosowana) - telefonowe 12 MP to 5–8 MB, po zmniejszeniu ~0,8 MB, a iPhone
 * HEIC i tak trafia do canvas jako zwykły obraz.
 */
import { getSessionToken, getVisitorId } from "@/lib/analytics-context";
import { trackShopStep } from "@/lib/track-step";
import type { Pt } from "./homografia";

export const WIZ_API = "https://crm-keika.groovemedia.pl/biuro/api/shop-public/wizualizator";

export type WizTkanina = {
  id: string;
  kod: string;
  nazwa: string;
  kolor: string;
  kolekcja: string;
  transmisja: number;
  tekstura: string;
  miniatura: string;
};
export type WizKolekcja = { id: string; nazwa: string; opis: string; transmisja: number; zaciemnia: boolean; plaster_miodu: boolean };
export type WizListwa = { id: string; nazwa: string; kolor: string; zdjecie: string };
export type WizKatalog = {
  ok: boolean;
  wlaczony: boolean;
  udzial: number;
  limit_render_sesja: number;
  tkaniny: WizTkanina[];
  kolekcje: WizKolekcja[];
  listwy: WizListwa[];
  montaz: { id: string; nazwa: string; opis: string }[];
  zastrzezenie: string;
};

export type WizSzyba = {
  id: string;
  okno: number;
  skrzydlo: number;
  typ: string;
  rogi: Pt[];
  pewnosc: number;
  szer_cm: number;
  wys_cm: number;
  swiatlo: { za_szyba: number; wokol: number; widok: { yaw: number; pitch: number } } | null;
};

export type WizWynik = {
  token: string;
  status: "gotowa" | "recznie" | "odrzucona";
  powod?: string;
  komunikat?: string | null;
  obraz?: { url: string; szer: number; wys: number };
  maska?: string | null;
  przeslony?: { etykieta: string }[];
  scena?: {
    pomieszczenie?: { typ: string; styl: string; opis: string } | null;
    paleta?: { hex: string; nazwa: string; udzial: number }[];
    okna?: { typ: string; rama_kolor: string; rama_hex: string }[];
    uwagi_dla_klienta?: string;
  };
  szyby?: WizSzyba[];
  rekomendacje?: {
    zestawy: { rodzaj: string; tkanina: string; nazwa: string; uzasadnienie: string }[];
    listwa: { id: string; nazwa: string; uzasadnienie: string } | null;
    rada: string;
  } | null;
  swiatlo?: { tint: [number, number, number]; jasnosc_pokoju: number; kierunek_cienia: [number, number]; barwa: string; pora: string };
  zastrzezenie: string;
};

export type WizStatus = {
  ok: boolean;
  error?: string;
  token: string;
  status: "nowa" | "analiza" | "gotowa" | "recznie" | "odrzucona" | "blad";
  etap: string;
  etap_opis: string;
  komunikat: string | null;
  obraz?: { url: string; szer: number; wys: number };
  wynik?: WizWynik | null;
  uklad?: WizUklad | null;
};

export type WizUkladSzyba = { tkanina: string; listwa: string; gora: number; dol: number; rogi?: Pt[] };
export type WizUklad = { szyby: Record<string, WizUkladSzyba>; montaz?: string; wszystkie?: boolean; dodane?: { id: string; rogi: Pt[] }[] };

let katalogPromise: Promise<WizKatalog | null> | null = null;

export function fetchKatalog(): Promise<WizKatalog | null> {
  if (!katalogPromise) {
    katalogPromise = fetch(`${WIZ_API}/katalog.php`)
      .then((r) => (r.ok ? (r.json() as Promise<WizKatalog>) : null))
      .catch(() => null);
  }
  return katalogPromise;
}

async function toJpeg(file: File, maxSide = 2600): Promise<Blob> {
  let bmp: ImageBitmap | HTMLImageElement;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    bmp = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Nie umiemy odczytać tego pliku - wybierz zdjęcie JPG lub PNG."));
      img.src = url;
    });
  }
  const w = "naturalWidth" in bmp ? bmp.naturalWidth : bmp.width;
  const h = "naturalHeight" in bmp ? bmp.naturalHeight : bmp.height;
  const k = Math.min(1, maxSide / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bmp as CanvasImageSource, 0, 0, c.width, c.height);
  return await new Promise<Blob>((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("Nie udało się przygotować zdjęcia."))), "image/jpeg", 0.88),
  );
}

export async function wizStart(file: File, opts: { zrodlo: string; qr?: string; grupa?: string }): Promise<{ token: string }> {
  const blob = await toJpeg(file);
  const fd = new FormData();
  fd.append("zdjecie", blob, "okno.jpg");
  fd.append("zgoda", "1");
  fd.append("sklep", "keika");
  fd.append("zrodlo", opts.zrodlo);
  fd.append("session_token", getSessionToken());
  fd.append("visitor_id", getVisitorId());
  if (opts.grupa) fd.append("grupa_ab", opts.grupa);
  if (opts.qr) fd.append("qr", opts.qr);
  const r = await fetch(`${WIZ_API}/start.php`, { method: "POST", body: fd });
  const j = (await r.json().catch(() => null)) as { ok?: boolean; token?: string; error?: string } | null;
  if (!r.ok || !j?.ok || !j.token) throw new Error(j?.error || "Nie udało się wysłać zdjęcia - sprawdź internet i spróbuj jeszcze raz.");
  // Analiza biegnie w CRM po odpowiedzi; nie czekamy na nią tutaj.
  void fetch(`${WIZ_API}/analiza.php`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: j.token }), keepalive: true }).catch(() => {});
  return { token: j.token };
}

export async function wizStatus(token: string): Promise<WizStatus> {
  const r = await fetch(`${WIZ_API}/status.php?t=${encodeURIComponent(token)}`, { cache: "no-store" });
  const j = (await r.json().catch(() => null)) as WizStatus | null;
  if (!j) throw new Error("Brak odpowiedzi");
  if (!r.ok) throw new Error(j.error || "Ta wizualizacja jest niedostępna.");
  return j;
}

export function wizRestart(token: string): void {
  void fetch(`${WIZ_API}/analiza.php`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token }) }).catch(() => {});
}

export function wizSaveLayout(token: string, uklad: WizUklad, korekta = false): void {
  void fetch(`${WIZ_API}/uklad.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ t: token, uklad, korekta_reczna: korekta }),
    keepalive: true,
  }).catch(() => {});
}

export async function wizRender(token: string, uklad: WizUklad): Promise<{ ok: boolean; wkrotce?: boolean; komunikat?: string }> {
  const r = await fetch(`${WIZ_API}/render.php`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token, uklad }) });
  return ((await r.json().catch(() => null)) as { ok: boolean; komunikat?: string }) || { ok: false };
}

export async function wizQrCreate(zrodlo: string): Promise<{ kod: string; url: string } | null> {
  const r = await fetch(`${WIZ_API}/qr.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_token: getSessionToken(), visitor_id: getVisitorId(), zrodlo }),
  }).catch(() => null);
  if (!r || !r.ok) return null;
  const j = (await r.json().catch(() => null)) as { ok?: boolean; kod?: string; url?: string } | null;
  return j?.ok && j.kod && j.url ? { kod: j.kod, url: j.url } : null;
}

export async function wizQrPoll(kod: string): Promise<{ status: "czeka" | "jest" | "wygasl"; token?: string } | null> {
  const r = await fetch(`${WIZ_API}/qr.php?kod=${encodeURIComponent(kod)}`, { cache: "no-store" }).catch(() => null);
  if (!r || !r.ok) return null;
  return (await r.json().catch(() => null)) as { status: "czeka" | "jest" | "wygasl"; token?: string } | null;
}

/** Zdarzenie: tabela wizualizatora w CRM + analityka sklepu (lejek, Agencja → zachowania). */
export function wizEvent(name: string, token: string | null, dane: Record<string, string | number | boolean | null> = {}): void {
  try {
    const body = JSON.stringify({ t: token || undefined, zdarzenie: name, dane, session_token: getSessionToken(), visitor_id: getVisitorId() });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(`${WIZ_API}/zdarzenie.php`, new Blob([body], { type: "text/plain" }));
    } else {
      void fetch(`${WIZ_API}/zdarzenie.php`, { method: "POST", body, keepalive: true }).catch(() => {});
    }
  } catch {
    // zdarzenia to statystyka - nic od nich nie zależy
  }
  trackShopStep(name, "wizualizator", { ...dane, wiz_token: token || "" });
}
