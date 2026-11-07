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

/** Produkt wizualizacji: plisa okienna albo osłony do okien dachowych (plisa / roleta w prowadnicach; właściciel 7.11, wersja testowa). */
export type WizProdukt = "plisy" | "plisa-dachowa" | "roleta-dachowa";

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
  /** przykładowe okno (gotowa wizualizacja „demo” w CRM) - „Nie masz teraz zdjęcia?” (2.11) */
  demo?: string;
  /** okna dachowe (7.11, test): udział osób widzących przycisk na stronach dachowych (0 = tylko ?wiz=dach) */
  udzial_dachowe?: number;
  /** zdjęcie okna dachowego wysłane ze strony plis przełącza produkt zamiast odmowy z linkiem */
  dachowe_wlaczone?: boolean;
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
  swiatlo: { za_szyba: number; za_szyba_rgb?: [number, number, number]; wokol: number; widok: { yaw: number; pitch: number } } | null;
  wymiary?: { szacunkowe: boolean; pewnosc?: number; odniesienia?: string[]; szer_min?: number; szer_max?: number; wys_min?: number; wys_max?: number };
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
  /** produkt po rozpoznaniu okna (silnik może go zmienić: ze strony dachowych a zwykłe okno → plisy) */
  produkt?: WizProdukt;
  rekomendacje?: {
    zestawy: { rodzaj: string; tkanina: string; nazwa: string; uzasadnienie: string }[];
    listwa: { id: string; nazwa: string; uzasadnienie: string } | null;
    rada: string;
  } | null;
  swiatlo?: { tint: [number, number, number]; jasnosc_pokoju: number; kierunek_cienia: [number, number]; barwa: string; pora: string };
  zastrzezenie: string;
  /** A0: zdjęcie posprzątane (osoby, bałagan, stare rolety) */
  uporzadkowane?: boolean;
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
  podglad?: { pomieszczenie: string; styl: string; opis: string; okien: number; ramy: string[]; paleta: { hex: string; nazwa: string }[]; pora: string; za_oknem: string; szyb?: number; oczyszczone?: boolean; rogi?: number[][][]; uporzadkowane?: boolean; usuniete?: string[]; wym?: number[][] } | null;
  kontakt?: boolean;
  produkt?: WizProdukt;
};

export type WizUkladSzyba = { tkanina: string; listwa: string; gora: number; dol: number; rogi?: Pt[]; szer_mm?: number | null; wys_mm?: number | null; zmierzone?: boolean; pomin?: boolean };
export type WizUklad = { szyby: Record<string, WizUkladSzyba>; montaz?: string; wszystkie?: boolean; dodane?: { id: string; rogi: Pt[] }[] };

const katalogPromise = new Map<WizProdukt, Promise<WizKatalog | null>>();

/** Katalog produktu (tkaniny, listwy/osprzęt, ustawienia wejścia). Okna dachowe mają własne katalogi (7.11). */
export function fetchKatalog(produkt: WizProdukt = "plisy"): Promise<WizKatalog | null> {
  let p = katalogPromise.get(produkt);
  if (!p) {
    p = fetch(`${WIZ_API}/katalog.php${produkt === "plisy" ? "" : `?produkt=${produkt}`}`)
      .then((r) => (r.ok ? (r.json() as Promise<WizKatalog>) : null))
      .catch(() => null);
    katalogPromise.set(produkt, p);
  }
  return p;
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

export async function wizStart(file: File, opts: { zrodlo: string; qr?: string; grupa?: string; produkt?: WizProdukt }): Promise<{ token: string }> {
  const blob = await toJpeg(file);
  const fd = new FormData();
  fd.append("zdjecie", blob, "okno.jpg");
  fd.append("zgoda", "1");
  fd.append("sklep", "keika");
  fd.append("zrodlo", opts.zrodlo);
  if (opts.produkt && opts.produkt !== "plisy") fd.append("produkt", opts.produkt);
  fd.append("session_token", getSessionToken());
  fd.append("visitor_id", getVisitorId());
  if (opts.grupa) fd.append("grupa_ab", opts.grupa);
  if (opts.qr) fd.append("qr", opts.qr);
  const r = await fetch(`${WIZ_API}/start.php`, { method: "POST", body: fd });
  const j = (await r.json().catch(() => null)) as { ok?: boolean; token?: string; error?: string } | null;
  if (!r.ok || !j?.ok || !j.token) throw new Error(j?.error || "Nie udało się wysłać zdjęcia - sprawdź internet i spróbuj jeszcze raz.");
  return { token: j.token };
}

/** Szybka kontrola zdjęcia (etap Q, 2–4 s) - przed pełną analizą. */
export type WizProduktZmiana = { z: WizProdukt; na: WizProdukt; komunikat: string };
export async function wizSprawdz(token: string): Promise<{
  decyzja: "ok" | "popraw" | "odrzuc"; komunikat: string; problemy: string[]; oslony: boolean; osoby?: boolean; balagan?: boolean;
  /** produkt po kontroli zdjęcia i ewentualna zmiana (okno dachowe ↔ zwykłe; 7.11) */
  produkt?: WizProdukt; produkt_zmiana?: WizProduktZmiana | null;
  /** co dokładnie zrobić, żebyśmy znaleźli szyby (właściciel 7.11), i ile szyb widać na zdjęciu (0 = nie znajdziemy) */
  kroki?: string[]; szyby_widoczne?: number | null;
}> {
  try {
    const r = await fetch(`${WIZ_API}/sprawdz.php`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token }) });
    const j = await r.json();
    if (j && j.ok) return { decyzja: j.decyzja || "ok", komunikat: j.komunikat || "", problemy: j.problemy || [], oslony: Boolean(j.oslony), osoby: Boolean(j.osoby), balagan: Boolean(j.balagan), produkt: j.produkt || undefined, produkt_zmiana: j.produkt_zmiana || null, kroki: Array.isArray(j.kroki) ? j.kroki : [], szyby_widoczne: typeof j.szyby_widoczne === "number" ? j.szyby_widoczne : null };
  } catch {
    // kontrola nie blokuje - pełna analiza i tak sprawdzi zdjęcie
  }
  return { decyzja: "ok", komunikat: "", problemy: [], oslony: false };
}

/** Pełna analiza (etapy R, A–G) - biegnie w CRM po odpowiedzi, postęp w wizStatus. */
export function wizAnaliza(token: string): void {
  void fetch(`${WIZ_API}/analiza.php`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token }), keepalive: true }).catch(() => {});
}

export async function wizLead(token: string, dane: { email?: string; telefon?: string; imie?: string; zgoda_kontakt: boolean; zgoda_marketing: boolean; moment: string }): Promise<{ ok: boolean; error?: string }> {
  const r = await fetch(`${WIZ_API}/lead.php`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token, ...dane, baza: window.location.origin }) }).catch(() => null); // link w mailu prowadzi tam, skąd klient przyszedł (jak kod QR)
  if (!r) return { ok: false, error: "Brak połączenia" };
  return ((await r.json().catch(() => null)) as { ok: boolean; error?: string }) || { ok: false };
}

/** „Nie mam teraz miarki”: mail z pomiarem w wybranym czasie. Zwraca czytelny termin („dziś wieczorem”). */
export async function wizPrzypomnij(token: string, kiedy: string): Promise<{ ok: boolean; error?: string; kiedy?: string }> {
  const r = await fetch(`${WIZ_API}/przypomnij.php`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token, kiedy }) }).catch(() => null);
  if (!r) return { ok: false, error: "Brak połączenia" };
  return ((await r.json().catch(() => null)) as { ok: boolean; error?: string; kiedy?: string }) || { ok: false };
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

/** Klient zmienia osłonę na wyniku (plisa okienna / plisa dachowa / roleta dachowa) - CRM zapisuje produkt wizualizacji (7.11). */
export function wizZmienProdukt(token: string, produkt: WizProdukt): void {
  void fetch(`${WIZ_API}/uklad.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ t: token, produkt }),
    keepalive: true,
  }).catch(() => {});
}

/** Ostatni widok klienta (mały JPEG z renderera) - do karty wizualizacji w CRM („co zobaczył klient”, 2.11). */
export function wizPodglad(token: string, obraz: string): void {
  void fetch(`${WIZ_API}/podglad.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ t: token, obraz }),
    keepalive: obraz.length < 60000,
  }).catch(() => {});
}

export type WizRenderWynik = { ok: boolean; url?: string; cache?: boolean; koszt_pln?: number; ms?: number; komunikat?: string; limit?: boolean };

/** E3: podgląd z renderera (JPEG data URL) → zdjęcie AI tego układu (klucz = skrót układu, wynik trzymany w CRM). */
export async function wizRender(token: string, uklad: WizUklad, klucz: string, obraz: string): Promise<WizRenderWynik> {
  const r = await fetch(`${WIZ_API}/render.php`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token, uklad, klucz, obraz }) }).catch(() => null);
  if (!r) return { ok: false, komunikat: "Brak połączenia" };
  return ((await r.json().catch(() => null)) as WizRenderWynik) || { ok: false };
}

export async function wizQrCreate(zrodlo: string): Promise<{ kod: string; url: string } | null> {
  const r = await fetch(`${WIZ_API}/qr.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_token: getSessionToken(), visitor_id: getVisitorId(), zrodlo, baza: window.location.origin }),
  }).catch(() => null);
  if (!r || !r.ok) return null;
  const j = (await r.json().catch(() => null)) as { ok?: boolean; kod?: string; url?: string } | null;
  return j?.ok && j.kod && j.url ? { kod: j.kod, url: j.url } : null;
}

/** „skan” = telefon otworzył stronę z kodu, zdjęcia jeszcze nie ma (komputer pokazuje „Telefon połączony”). */
export async function wizQrPoll(kod: string): Promise<{ status: "czeka" | "skan" | "jest" | "wygasl"; token?: string } | null> {
  const r = await fetch(`${WIZ_API}/qr.php?kod=${encodeURIComponent(kod)}`, { cache: "no-store" }).catch(() => null);
  if (!r || !r.ok) return null;
  return (await r.json().catch(() => null)) as { status: "czeka" | "skan" | "jest" | "wygasl"; token?: string } | null;
}

/** Telefon po zeskanowaniu kodu: znak dla komputera (i zdarzenie wiz_qr_zeskanowany w CRM). */
export function wizQrSkan(kod: string): void {
  void fetch(`${WIZ_API}/qr.php?kod=${encodeURIComponent(kod)}&skan=1`, { cache: "no-store" }).catch(() => {});
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
