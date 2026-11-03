"use client";

/**
 * Wizualizator „Twoje okno” (plan: CRM docs/wizualizator-plan-2026-11.md).
 * Klient wysyła zdjęcie pokoju (telefon: aparat/galeria; komputer: kod QR →
 * zdjęcie z telefonu albo plik z dysku), CRM analizuje scenę etapami A–F, a tu
 * renderer (lib/wizualizator/renderer.ts) nakłada plisę na każdą szybę.
 * Zmiana tkaniny, listew i położenia belek działa od razu, bez AI.
 *
 * Kilka zdjęć w sesji („Dodaj kolejne okno”, do 5): liczymy szyby w całym
 * domu i pokazujemy próg rabatu ilościowego z CRM (CAŁY DOM). Ceny tylko w
 * konfiguratorze. Na każdym wyniku: „wizualizacja poglądowa”.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import qrcode from "qrcode-generator";
import { type Pt, invert3, apply, paneToImage, isConvexQuad } from "@/lib/wizualizator/homografia";
import { WizRenderer, hexToRgb, panePixelSize, RAIL_MM, type PaneRender } from "@/lib/wizualizator/renderer";
import {
  fetchKatalog, wizAnaliza, wizEvent, wizLead, wizPodglad, wizQrCreate, wizQrPoll, wizQrSkan, wizRender, wizRestart, wizSaveLayout, wizSprawdz, wizStart, wizStatus,
  type WizKatalog, type WizStatus, type WizUklad, type WizWynik, type WizSzyba,
} from "@/lib/wizualizator/api";
import { WIZ_PICK_EVENT, type WizPickDetail } from "@/lib/wizualizator/flag";
import { useBundleDiscountRules } from "@/lib/bundle-discount";
import WizWycena, { useCenaZestawu, type WycenaEtap, type WycenaSzyba } from "./WizWycena";
import WizDemo from "./WizDemo";
import s from "./WizModal.module.css";

type Faza = "start" | "wysylanie" | "sprawdzanie" | "popraw" | "analiza" | "gotowa" | "odrzucona" | "blad" | "qr_gotowe" | "qr_koniec";
type Zakladka = "grupa" | "tkanina" | "listwy" | "wycena" | "szyby" | null;
type PaneState = {
  id: string; rogi: Pt[]; gora: number; dol: number; tkanina: string; listwa: string; pewnosc: number; szerMm: number; wysMm: number; swiatlo: WizSzyba["swiatlo"];
  /** wycena: wymiary wpisane przez klienta, potwierdzenie pomiaru, pominięcie */
  wpisSzerMm?: number | null; wpisWysMm?: number | null; zmierzone?: boolean; pomin?: boolean; odniesienia?: string[]; pewnoscWym?: number | null;
};

/** Initial presentation only; saved layouts and subsequent manual edits win. */
function losoweUlozeniePlisy(): { gora: number; dol: number } {
  const wysokosc = 0.3 + Math.random() * 0.4;
  const miejsce = Math.floor(Math.random() * 3);
  const gora = miejsce === 0 ? 0 : miejsce === 1 ? 1 - wysokosc : (1 - wysokosc) * (0.25 + Math.random() * 0.5);
  return { gora, dol: gora + wysokosc };
}

const KORZYSCI = [
  { theme: "warranty", title: "Jakość gwarantowana", first: "5 lat gwarancji", second: "30 dni na zwrot", path: "M32 7l20 8v15c0 13-9 21-20 27C21 51 12 43 12 30V15z M22 31l7 7 14-15" },
  { theme: "materials", title: "Polska jakość zamiast marketowej taniochy", first: "Aluminiowy profil", second: "Grube tkaniny premium", path: "M7 13h50v12H7z M12 32l10 8 10-8 10 8 10-8 M12 43l10 8 10-8 10 8 10-8" },
  { theme: "durability", title: "Plisa na lata", first: "Stalowe trzpienie prowadzące sznurki", second: "Chronią sznurki przed przecieraniem", path: "M13 11v42m38-42v42 M13 17h38m-38 30h38 M24 17v12q0 7 8 7t8 7v4 M40 17v12q0 7-8 7t-8 7v4" },
  { theme: "producer", title: "Polski producent", first: "Wieloletnie doświadczenie", second: "Produkujemy w Polsce od 2015 roku", path: "M14 56V10m0 2c13-10 23 10 38 0v28c-15 10-25-10-38 0m0-14c13-10 23 10 38 0" },
] as const;

const POMIESZCZENIE: Record<string, string> = {
  salon: "salon", sypialnia: "sypialnię", kuchnia: "kuchnię", lazienka: "łazienkę", pokoj_dzieciecy: "pokój dziecięcy", biuro: "gabinet",
  poddasze: "poddasze", jadalnia: "jadalnię", przedpokoj: "przedpokój", inne: "wnętrze",
};
type Zdjecie = { token: string; miniatura: string; szyb: number; nazwa?: string; wKoszyku?: boolean };

/** Domyślna nazwa pokoju z rozpoznania sceny (etap A) - klient może ją zmienić. */
const NAZWA_POKOJU: Record<string, string> = {
  salon: "Salon", sypialnia: "Sypialnia", kuchnia: "Kuchnia", lazienka: "Łazienka", pokoj_dzieciecy: "Pokój dziecięcy", biuro: "Gabinet",
  poddasze: "Poddasze", jadalnia: "Jadalnia", przedpokoj: "Przedpokój", inne: "Pokój",
};

const SESJA_KEY = "keika_wiz_sesja_v1";
const MAX_ZDJEC = 8; // pokoje w jednej sesji (właściciel 1.11: kolejne pokoje = większy koszyk)
/** Prawdziwe zdjęcie próbki (makro 2048 px z katalogu) w rozmiarze do siatki/lupy - przez optymalizator obrazów sklepu. */
const mini = (url: string, w: number) => (url ? `/_next/image?url=${encodeURIComponent(url)}&w=${w}&q=75` : "");
/** Pasek postępu analizy: etap silnika → zakres paska (%) i typowy czas (s). Kolejność: Q → A → [0] → B → C → F. */
const ETAPY_POSTEP: Record<string, { od: number; do: number; s: number }> = {
  Q: { od: 0, do: 8, s: 3 },
  A: { od: 8, do: 34, s: 14 },
  "0": { od: 34, do: 60, s: 15 },
  B: { od: 60, do: 66, s: 2 },
  C: { od: 66, do: 94, s: 24 },
  F: { od: 94, do: 98, s: 2 },
};
const KOLEJNOSC_ETAPOW = ["Q", "A", "0", "B", "C", "F"];
const DOMYSLNA_TKANINA = "pp153";
const DOMYSLNA_LISTWA = "bialy";
const DRAFT_KEY = "keika_plisy_draft_v1";

function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.matchMedia("(pointer: coarse)").matches;
}

function readSesja(): Zdjecie[] {
  try {
    const j = JSON.parse(window.sessionStorage.getItem(SESJA_KEY) || "[]");
    return Array.isArray(j) ? j.slice(-MAX_ZDJEC) : []; // najnowsze (otwarte zdjęcie zawsze na liście)
  } catch {
    return [];
  }
}

function writeSesja(z: Zdjecie[]): void {
  try {
    window.sessionStorage.setItem(SESJA_KEY, JSON.stringify(z.slice(-MAX_ZDJEC)));
  } catch {
    /* sesja to wygoda */
  }
}

function loadImageOnce(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("obraz"));
    img.src = url;
  });
}

/** Z jedną ponowną próbą (hosting CRM potrafi chwilowo odpowiedzieć 403 przy serii zapytań). */
async function loadImage(url: string): Promise<HTMLImageElement> {
  try {
    return await loadImageOnce(url);
  } catch {
    await new Promise((r) => window.setTimeout(r, 1500));
    return loadImageOnce(url + (url.includes("?") ? "&" : "?") + "r=" + Date.now().toString(36));
  }
}

function QrKod({ url }: { url: string }) {
  const svg = useMemo(() => {
    const q = qrcode(0, "M");
    q.addData(url);
    q.make();
    return q.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
  }, [url]);
  return <div className={s.qr} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export default function WizModal({ zrodlo, onClose, startTkanina, startListwa, qrKod, startToken }: {
  zrodlo: string;
  onClose: () => void;
  startTkanina?: string;
  startListwa?: string;
  /** Strona telefonu po zeskanowaniu kodu: zdjęcie trafia do sesji komputera. */
  qrKod?: string;
  /** Powrót do zapisanej wizualizacji (?wiz_t=… - link z e-maila / z CRM). */
  startToken?: string;
}) {
  const [faza, setFaza] = useState<Faza>(startToken ? "analiza" : "start");
  const [blad, setBlad] = useState("");
  // zgoda wyrażana wysłaniem zdjęcia (informacja pod przyciskami; właściciel 1.11: QR od razu widoczny)
  const [zgoda] = useState(true);
  const [token, setToken] = useState<string | null>(startToken || null);
  const [status, setStatus] = useState<WizStatus | null>(null);
  const [katalog, setKatalog] = useState<WizKatalog | null>(null);
  const [wynik, setWynik] = useState<WizWynik | null>(null);
  const [panes, setPanes] = useState<PaneState[]>([]);
  const [sel, setSel] = useState(0);
  const [wszystkie, setWszystkie] = useState(true);
  const [montaz, setMontaz] = useState<"standard" | "bezinwazyjny">("standard");
  // karta otwarta przyciskiem pod zdjęciem (null = duże zdjęcie bez karty) i etap wyceny (lista → kreator wymiarów → podsumowanie)
  const [zakladka, setZakladka] = useState<Zakladka>(null);
  const [wEtap, setWEtap] = useState<WycenaEtap>("wycena");
  const [kolekcja, setKolekcja] = useState("");
  const [przedPo, setPrzedPo] = useState<number | null>(null);
  const [edycja, setEdycja] = useState(false);
  const [qr, setQr] = useState<{ kod: string; url: string } | null>(null);
  // telefon zeskanował kod - komputer czeka na zdjęcie (właściciel 2.11: zdjęcie telefonem mocno pokazane na komputerze)
  const [qrSkan, setQrSkan] = useState(false);
  // AGN-914 (3.11): 0 skanów na 77 kodów - po 20 s bez skanu wyraźna druga droga (plik z komputera); odnowienia kodu liczone osobno
  const [qrDlugo, setQrDlugo] = useState(false);
  const qrIleRef = useRef(0);
  // AGN-914: po wyniku z ceną szacunkową jednorazowa zachęta do wpisania wymiarów (6 z 165 otwarć wpisało wymiary)
  const [zachetaWym, setZachetaWym] = useState(false);
  // przykładowe okno (Agencja 2.11: „Nie masz teraz zdjęcia?”) - wspólna wizualizacja demo, bez zapisu i bez kosztu AI
  const [demo, setDemo] = useState(false);
  const [zdjecia, setZdjecia] = useState<Zdjecie[]>([]);
  const [info, setInfo] = useState("");
  const [gotowyObraz, setGotowyObraz] = useState(false);
  const [kontrola, setKontrola] = useState<{ komunikat: string; problemy: string[] } | null>(null);
  const [min, setMin] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [korzysc, setKorzysc] = useState(0);
  // podmiana zdjęcia po porządkowaniu: stare pod spodem, nowe „wjeżdża” (klient widzi, co zniknęło)
  const [zdjPrzed, setZdjPrzed] = useState<string | null>(null);
  const zdjUrlRef = useRef<string | null>(null);
  // e-mail: jedno pytanie, gdy wizualizacja jest gotowa (właściciel 1.11); „nie chcę” zapamiętane w sesji
  const [emailOkno, setEmailOkno] = useState(false);
  const [emailZgoda, setEmailZgoda] = useState(false);
  const [lead, setLead] = useState({ email: "", wyslane: false, blad: "" });
  // zdjęcie AI (E3) dla bieżącego układu: podgląd WebGL na żywo, po chwili spokoju fotorealistyczne zdjęcie z CRM
  const [ai, setAi] = useState<{ klucz: string; url: string } | null>(null);
  const [aiTrwa, setAiTrwa] = useState(false);
  const [aiInfo, setAiInfo] = useState("");
  const [aiPokaz, setAiPokaz] = useState(true);
  // lupa: duże prawdziwe zdjęcie próbki (właściciel 1.11: wybór tkanin na prawdziwych swatchach z powiększeniem)
  const [lupa, setLupa] = useState<string | null>(null);
  // pokoje: nazwa bieżącego, okno nazywania przed kolejnym pokojem, potwierdzenie dodania do koszyka
  const [pokojDialog, setPokojDialog] = useState<null | "kolejny" | "nazwa">(null);
  const [pokojNazwa, setPokojNazwa] = useState("");
  const [dodano, setDodano] = useState<{ sztuk: number; suma: number } | null>(null);
  const [lupaZoom, setLupaZoom] = useState<{ x: number; y: number } | null>(null); // klient może wrócić do ustawiania bez zmiany układu
  const aiOffRef = useRef(false);
  // gotowe wizualizacje tej sesji - przełączanie między zdjęciami bez ponownego odpytywania CRM
  const cacheRef = useRef(new Map<string, { wynik: WizWynik; status: WizStatus | null; panes: PaneState[]; sel: number; montaz: "standard" | "bezinwazyjny"; ai: { klucz: string; url: string } | null }>());
  const zCacheRef = useRef<{ token: string; panes: PaneState[]; sel: number; montaz: "standard" | "bezinwazyjny"; ai: { klucz: string; url: string } | null } | null>(null);
  const mobile = useMemo(isMobile, []);
  const bundle = useBundleDiscountRules();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const rendRef = useRef<WizRenderer | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const camRef = useRef<HTMLInputElement | null>(null);
  const dragRef = useRef<{ kind: "gora" | "dol" | "rog" | "split"; pane: number; corner?: number; off: number } | null>(null);
  // Podpowiedź po wyniku (Agencja 2.11: belki rusza 55 %, kolor zmienia 30 % klientów): łapka zsuwa dolną belkę pierwszej
  // szyby i wraca do pozycji z AI, potem napis i podświetlony „Kolor tkaniny”. Raz na wizualizację, znika przy dotknięciu.
  const [podp, setPodp] = useState<{ reka: { left: number; top: number } | null; napis: boolean } | null>(null);
  const podpAnimRef = useRef<{ pane: number; dol: number } | null>(null);
  const podpRafRef = useRef(0);
  const podpTokenRef = useRef<string | null>(null);
  const rafRef = useRef(0);
  const saveRef = useRef(0);
  const korektaRef = useRef(false);
  const zTelefonuRef = useRef(false);
  const demoRef = useRef(false);

  // ------------------------------------------------------------ start
  useEffect(() => {
    void fetchKatalog().then(setKatalog);
    setZdjecia(readSesja());
    wizEvent("wiz_otwarte", null, { zrodlo, qr: Boolean(qrKod) });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
      cancelAnimationFrame(rafRef.current);
      rendRef.current?.dispose();
      rendRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Telefon po zeskanowaniu kodu: komputer pokaże „Telefon połączony – zrób zdjęcie okna”
  useEffect(() => {
    if (qrKod) wizQrSkan(qrKod);
  }, [qrKod]);

  // Komputer: kod QR do telefonu (tylko z ekranu startowego, nie na stronie telefonu)
  useEffect(() => {
    if (mobile || qrKod || faza !== "start" || qr) return;
    void wizQrCreate(zrodlo).then((q) => {
      if (q) {
        setQr(q);
        setQrSkan(false);
        setQrDlugo(false);
        wizEvent("wiz_qr_pokazany", null, { zrodlo, ponowny: qrIleRef.current > 0 });
        qrIleRef.current += 1;
      }
    });
  }, [mobile, qrKod, faza, qr, zrodlo]);

  useEffect(() => {
    if (!qr || qrSkan || faza !== "start") return;
    const t = window.setTimeout(() => setQrDlugo(true), 20000);
    return () => window.clearTimeout(t);
  }, [qr, qrSkan, faza]);

  // ...i czekanie, aż telefon wyśle zdjęcie
  useEffect(() => {
    if (!qr || faza !== "start") return;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      const r = await wizQrPoll(qr.kod);
      if (stop) return;
      if (r?.status === "jest" && r.token) {
        // zdjęcie z telefonu: kontrolę i start analizy robi telefon (tam klient poprawia zdjęcie)
        zTelefonuRef.current = true;
        setToken(r.token);
        setFaza("analiza");
        return;
      }
      if (r?.status === "wygasl") {
        // nowy kod dopiero, gdy klient wróci do karty - odnowienia co 30 min w tle zawyżały „pokazania” (AGN-914)
        if (document.visibilityState === "visible") setQr(null);
        else document.addEventListener("visibilitychange", () => setQr(null), { once: true });
        return;
      }
      if (r?.status === "skan") setQrSkan(true);
      window.setTimeout(tick, r?.status === "skan" ? 2000 : 3000);
    };
    const t = window.setTimeout(tick, 3000);
    return () => {
      stop = true;
      window.clearTimeout(t);
    };
  }, [qr, faza]);

  const wyslij = useCallback(async (file: File | undefined | null) => {
    if (!file) return;
    if (!zgoda) {
      setBlad("Zaznacz zgodę na przetworzenie zdjęcia.");
      return;
    }
    setBlad("");
    setFaza("wysylanie");
    wizEvent("wiz_zdjecie_wybrane", null, { zrodlo, kb: Math.round(file.size / 1024), qr: Boolean(qrKod) });
    try {
      const r = await wizStart(file, { zrodlo, qr: qrKod });
      setToken(r.token);
      // szybka kontrola (2–4 s): złe zdjęcie → konkretna prośba o poprawkę, zanim zapłacimy za pełną analizę
      setFaza("sprawdzanie");
      const k = await wizSprawdz(r.token);
      if (k.decyzja === "odrzuc") {
        setBlad(k.komunikat || "Tego zdjęcia nie możemy użyć.");
        setFaza("odrzucona");
        return;
      }
      if (k.decyzja === "popraw") {
        setKontrola({ komunikat: k.komunikat, problemy: k.problemy });
        setFaza("popraw");
        return;
      }
      if (k.oslony || k.osoby || k.balagan) setInfo("Uporządkujemy zdjęcie (osoby, bałagan, stare rolety), żeby pokazać plisę w najlepszym świetle.");
      wizAnaliza(r.token);
      wizEvent("wiz_start_analizy", r.token, { qr: Boolean(qrKod) });
      // telefon z kodu QR: klient wybiera, gdzie ogląda wynik
      setFaza(qrKod ? "qr_gotowe" : "analiza");
    } catch (e) {
      setBlad(e instanceof Error ? e.message : "Nie udało się wysłać zdjęcia.");
      setFaza("start");
    }
  }, [zgoda, zrodlo, qrKod]);

  const mimoTo = () => {
    if (!token) return;
    wizEvent("wiz_mimo_to", token, { problemy: (kontrola?.problemy || []).join(", ") });
    wizAnaliza(token);
    wizEvent("wiz_start_analizy", token, { mimo_to: true });
    setKontrola(null);
    setFaza(qrKod ? "qr_gotowe" : "analiza");
  };

  // zminimalizowane okno nie blokuje przewijania strony; po powrocie rysujemy od nowa
  useEffect(() => {
    document.documentElement.style.overflow = min ? "" : "hidden";
    if (!min && faza === "gotowa") window.setTimeout(() => draw(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min]);

  // korzyści w czasie oczekiwania (co 4 s)
  useEffect(() => {
    if (faza !== "analiza" && faza !== "sprawdzanie") return;
    const t = window.setInterval(() => setKorzysc((k) => k + 1), 5000); // banerki: promocja + korzyści (indeks modulo długość listy)
    return () => window.clearInterval(t);
  }, [faza]);

  const wyslijKontakt = async (moment: string) => {
    if (!token) return;
    const r = await wizLead(token, { email: lead.email.trim(), zgoda_kontakt: true, zgoda_marketing: true, moment }); // właściciel 1.11: oferty i promocje ujęte w regulaminie wizualizatora
    setLead((l) => ({ ...l, wyslane: r.ok, blad: r.ok ? "" : r.error || "Nie udało się zapisać." }));
  };

  // ------------------------------------------------------------ postęp analizy (pasek z % i szacowanym czasem)
  const etapRef = useRef<{ etap: string; t: number }>({ etap: "", t: 0 });
  const [, setTykniecie] = useState(0);
  useEffect(() => {
    if (faza !== "analiza" && faza !== "sprawdzanie") {
      etapRef.current = { etap: "", t: 0 };
      return;
    }
    const id = window.setInterval(() => setTykniecie((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, [faza]);

  useEffect(() => {
    const u = status?.obraz?.url || null;
    if (u && zdjUrlRef.current && u !== zdjUrlRef.current && (faza === "analiza" || faza === "sprawdzanie")) {
      setZdjPrzed(zdjUrlRef.current);
      const t = window.setTimeout(() => setZdjPrzed(null), 2600);
      zdjUrlRef.current = u;
      return () => window.clearTimeout(t);
    }
    zdjUrlRef.current = u;
  }, [status?.obraz?.url, faza]);

  // ------------------------------------------------------------ odpytywanie
  useEffect(() => {
    if (!token || faza !== "analiza") return;
    let stop = false;
    let n = 0;
    const tick = async () => {
      if (stop) return;
      n += 1;
      try {
        const st = await wizStatus(token);
        if (stop) return;
        setStatus(st);
        if (st.kontakt) setLead((l) => ({ ...l, wyslane: true }));
        // powrót do zdjęcia, które zostało przy kontroli (np. link) - analiza jeszcze nie ruszyła
        if (st.status === "nowa" && n === 3 && !zTelefonuRef.current) wizAnaliza(token);
        if (st.status === "gotowa" || st.status === "recznie") {
          if (st.wynik) {
            setWynik(st.wynik);
            setFaza("gotowa");
            let pytany = false;
            try {
              pytany = window.sessionStorage.getItem("keika_wiz_email") === "1";
            } catch {
              /* sesja to wygoda */
            }
            if (!st.kontakt && !pytany && !demoRef.current) window.setTimeout(() => setEmailOkno(true), 900);
            return;
          }
        } else if (st.status === "odrzucona") {
          setBlad(st.komunikat || "Tego zdjęcia nie możemy użyć.");
          setFaza("odrzucona");
          return;
        } else if (st.status === "blad") {
          setBlad(st.komunikat || "Analiza się nie udała.");
          setFaza("blad");
          return;
        }
      } catch (e) {
        if (n > 5) {
          setBlad(e instanceof Error ? e.message : "Brak połączenia.");
          setFaza("blad");
          return;
        }
      }
      window.setTimeout(tick, n < 4 ? 2500 : 2000);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [token, faza]);

  // ------------------------------------------------------------ wynik → stan szyb
  useEffect(() => {
    if (!wynik || !token) return;
    const zc = zCacheRef.current;
    if (zc && zc.token === token) {
      // powrót do zdjęcia z tej sesji: stan dokładnie taki, jaki klient zostawił
      zCacheRef.current = null;
      setPanes(zc.panes);
      setSel(zc.sel);
      setMontaz(zc.montaz);
      setAi(zc.ai);
      setInfo(wynik.uporzadkowane || status?.podglad?.oczyszczone ? "Uporządkowaliśmy zdjęcie (osoby, bałagan, stare rolety) – tak Twoje okno wygląda z naszą plisą." : "");
      setZdjecia(readSesja());
      return;
    }
    const zapis = status?.uklad;
    const rek = wynik.rekomendacje;
    const tk = startTkanina || rek?.zestawy?.[0]?.tkanina || DOMYSLNA_TKANINA;
    const li = startListwa || rek?.listwa?.id || DOMYSLNA_LISTWA;
    const szyby = (wynik.szyby || []).map<PaneState>((p) => {
      const z = zapis?.szyby?.[p.id];
      const start = losoweUlozeniePlisy();
      return {
        id: p.id, rogi: (z?.rogi as Pt[]) || p.rogi, gora: z?.gora ?? start.gora, dol: z?.dol ?? start.dol, tkanina: z?.tkanina || tk, listwa: z?.listwa || li,
        pewnosc: p.pewnosc, szerMm: (p.szer_cm || 0) * 10, wysMm: (p.wys_cm || 0) * 10, swiatlo: p.swiatlo,
        wpisSzerMm: z?.szer_mm ?? null, wpisWysMm: z?.wys_mm ?? null, zmierzone: Boolean(z?.zmierzone), pomin: Boolean(z?.pomin),
        odniesienia: p.wymiary?.odniesienia || [], pewnoscWym: p.wymiary?.pewnosc ?? null,
      };
    });
    for (const d of zapis?.dodane || []) {
      szyby.push({ id: d.id, rogi: d.rogi, gora: 0, dol: 0.68, tkanina: tk, listwa: li, pewnosc: 100, szerMm: 0, wysMm: 0, swiatlo: null });
    }
    setPanes(szyby);
    setSel(0);
    setAi(null);
    aiOffRef.current = false;
    setInfo(wynik.uporzadkowane || status?.podglad?.oczyszczone ? "Uporządkowaliśmy zdjęcie (osoby, bałagan, stare rolety) – tak Twoje okno wygląda z naszą plisą." : "");
    const kol = katalog?.tkaniny.find((t) => t.id === tk)?.kolekcja;
    if (kol) setKolekcja(kol);
    if (wynik.status === "recznie" || szyby.some((p) => p.pewnosc < 70)) {
      setEdycja(true);
      setZakladka("szyby");
      setInfo(szyby.length ? "Sprawdź, czy obrys pasuje do szyby - przeciągnij kółka w rogi szyby." : "Nie znaleźliśmy szyby automatycznie. Dodaj ją i przeciągnij kółka w rogi szyby.");
    }
    if (demoRef.current) return;
    const stare = readSesja();
    const byl = stare.find((z) => z.token === token);
    const lista = stare.filter((z) => z.token !== token);
    // nazwa pokoju: zapisana albo z rozpoznania sceny; „Sypialnia 2”, gdy taka już jest
    let nazwa = byl?.nazwa || NAZWA_POKOJU[wynik.scena?.pomieszczenie?.typ || ""] || "Pokój";
    if (!byl?.nazwa && lista.some((z) => z.nazwa === nazwa)) {
      let n = 2;
      while (lista.some((z) => z.nazwa === `${nazwa} ${n}`)) n++;
      nazwa = `${nazwa} ${n}`;
    }
    lista.push({ token, miniatura: wynik.obraz?.url || "", szyb: szyby.length, nazwa, wKoszyku: byl?.wKoszyku });
    try {
      window.localStorage.setItem("keika_wiz_ostatnia", JSON.stringify({ token, miniatura: wynik.obraz?.url || "", data: new Date().toISOString(), szyb: szyby.length }));
    } catch {
      /* pasek powrotu to wygoda */
    }
    writeSesja(lista);
    setZdjecia(readSesja());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wynik, token]);

  // ------------------------------------------------------------ renderer
  useEffect(() => {
    if (faza !== "gotowa" || !wynik?.obraz || !canvasRef.current) return;
    let cancelled = false;
    try {
      rendRef.current = new WizRenderer(canvasRef.current);
    } catch (e) {
      console.error("[wizualizator] renderer", e);
      setBlad("Ta przeglądarka nie pokaże wizualizacji - otwórz stronę w Chrome lub Safari.");
      wizEvent("wiz_blad_renderu", token, { powod: String(e instanceof Error ? e.message : e).slice(0, 180) });
      return;
    }
    void (async () => {
      try {
        const img = await loadImage(wynik.obraz!.url);
        if (cancelled || !rendRef.current) return;
        rendRef.current.setPhoto(img);
        if (wynik.maska) {
          const m = await loadImage(wynik.maska).catch(() => null);
          if (!cancelled && rendRef.current) rendRef.current.setMask(m);
        }
        setGotowyObraz(true);
      } catch {
        setBlad("Nie udało się wczytać zdjęcia.");
      }
    })();
    return () => {
      cancelled = true;
      rendRef.current?.dispose();
      rendRef.current = null;
      setGotowyObraz(false);
    };
  }, [faza, wynik, token]);

  // tekstury tkanin i zdjęcia listw w użyciu
  useEffect(() => {
    if (!katalog) return;
    for (const id of new Set(panes.map((p) => p.tkanina))) {
      const t = katalog.tkaniny.find((x) => x.id === id);
      if (!t || rendRef.current?.hasFabric(id)) continue;
      void loadImage(t.tekstura).then((img) => {
        rendRef.current?.addFabric(id, img);
        draw();
      }).catch(() => {});
    }
    for (const id of new Set(panes.map((p) => p.listwa))) {
      const l = katalog.listwy.find((x) => x.id === id);
      if (!l?.zdjecie || rendRef.current?.hasRail(id)) continue;
      void loadImage(l.zdjecie).then((img) => {
        rendRef.current?.addRail(id, img);
        draw();
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panes, katalog, gotowyObraz]);

  const draw = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const r = rendRef.current;
      if (!r || !katalog || !wynik) return;
      const sw = wynik.swiatlo;
      const list: PaneRender[] = panes.filter((p) => isConvexQuad(p.rogi)).map((p, i) => {
        const t = katalog.tkaniny.find((x) => x.id === p.tkanina);
        const kol = katalog.kolekcje.find((k) => k.id === t?.kolekcja);
        const l = katalog.listwy.find((x) => x.id === p.listwa);
        const rail = hexToRgb(l?.kolor || "#EFEFF0");
        // prześwit tylko przy jasno za oknem: nocą „jasność za szybą” to odbicia lamp w szkle, a nie światło,
        // które przechodzi przez tkaninę - wtedy plisa wyglądała na szarą i wyblakłą (właściciel 1.11)
        const zaRgb = p.swiatlo?.za_szyba_rgb;
        const zaLum = zaRgb ? 0.299 * zaRgb[0] + 0.587 * zaRgb[1] + 0.114 * zaRgb[2] : 160;
        const nocKoef = sw?.pora === "noc" ? 0.15 : Math.max(0.15, Math.min(1, (zaLum - 45) / 110));
        const back = (p.swiatlo?.za_szyba ?? 0.7) * nocKoef;
        const wokol = p.swiatlo?.wokol ?? sw?.jasnosc_pokoju ?? 0.6;
        return {
          id: p.id, corners: p.rogi, top: p.gora, bottom: podpAnimRef.current?.pane === i ? podpAnimRef.current.dol : p.dol,
          fabric: { id: p.tkanina, color: hexToRgb(t?.kolor || "#EEEEEE"), transmission: t?.transmisja ?? 0.25, texture: null, honeycomb: Boolean(kol?.plaster_miodu) },
          rail, railId: p.listwa, bracket: ["bialy", "anoda"].includes(p.listwa) ? [0.95, 0.95, 0.94] : rail, mount: montaz,
          widthMm: p.szerMm, heightMm: p.wysMm, back, front: Math.max(0.45, Math.min(1.1, 0.35 + 0.75 * wokol)),
          pitch: p.swiatlo?.widok?.pitch ?? 0, selected: i === sel,
        };
      });
      r.render(list, { tint: sw?.tint || [1, 1, 1], split: przedPo ?? 1e9, outline: edycja });
    });
  }, [panes, katalog, wynik, montaz, sel, przedPo, edycja]);

  useEffect(() => {
    if (gotowyObraz) draw();
  }, [draw, gotowyObraz]);

  useEffect(() => {
    // czeka, aż klient zamknie okno e-maila i inne okienka - wcześniej leciała pod nimi
    if (faza !== "gotowa" || !gotowyObraz || demo || !token || !panes.length || edycja || przedPo !== null || zakladka || emailOkno || pokojDialog || lupa) return;
    if (podpTokenRef.current === token) return;
    let juz = false;
    try {
      // powrót z linku w mailu: tylko jeśli klient jeszcze nie ruszał belek
      juz = Boolean(window.localStorage.getItem(`keika_wiz_podp_${token}`) || window.localStorage.getItem(`keika_wiz_belka_${token}`));
    } catch {
      // bez pamięci przeglądarki podpowiedź pokaże się raz na otwarcie
    }
    if (juz) {
      podpTokenRef.current = token;
      return;
    }
    const timer = window.setTimeout(() => {
      podpTokenRef.current = token;
      try {
        window.localStorage.setItem(`keika_wiz_podp_${token}`, "1");
      } catch {
        // jw.
      }
      const ruch = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      wizEvent("wiz_podpowiedz", token, { ruch });
      const p = panes[0];
      const H = paneToImage(p.rogi);
      if (!ruch || !H) {
        setPodp({ reka: null, napis: true });
        return;
      }
      const baza = p.dol;
      const cel = baza <= 0.72 ? Math.min(0.97, baza + 0.25) : Math.max(p.gora + 0.18, baza - 0.3);
      const t0 = performance.now();
      const gladko = (x: number) => x * x * (3 - 2 * x);
      const krok = (now: number) => {
        const t = Math.min(1, (now - t0) / 2200);
        // łapka chwyta → belka w dół → chwila → z powrotem do pozycji z AI
        const k = t < 0.15 ? 0 : t < 0.5 ? gladko((t - 0.15) / 0.35) : t < 0.6 ? 1 : t < 0.95 ? 1 - gladko((t - 0.6) / 0.35) : 0;
        const dol = baza + (cel - baza) * k;
        podpAnimRef.current = { pane: 0, dol };
        draw();
        setPodp({ reka: cornerPos(apply(H, [0.5, dol])), napis: false });
        if (t < 1) {
          podpRafRef.current = requestAnimationFrame(krok);
        } else {
          podpAnimRef.current = null;
          draw();
          setPodp({ reka: null, napis: true });
        }
      };
      podpRafRef.current = requestAnimationFrame(krok);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [faza, gotowyObraz, demo, token, panes, edycja, przedPo, zakladka, emailOkno, pokojDialog, lupa, draw]);

  // pierwsze dotknięcie gdziekolwiek chowa podpowiedź (także w trakcie animacji - belka wraca na miejsce z AI)
  const podpJest = Boolean(podp);
  useEffect(() => {
    if (!podpJest) return;
    const zamknij = () => {
      cancelAnimationFrame(podpRafRef.current);
      if (podpAnimRef.current) {
        podpAnimRef.current = null;
        draw();
      }
      setPodp(null);
    };
    document.addEventListener("pointerdown", zamknij, { capture: true, once: true });
    return () => document.removeEventListener("pointerdown", zamknij, { capture: true });
  }, [podpJest, draw]);

  // klucz bieżącego układu (to, co widać na płótnie) - zdjęcie AI jest ważne tylko dla swojego klucza
  const klucz = useMemo(() => {
    const opis = JSON.stringify([montaz, panes.filter((p) => isConvexQuad(p.rogi)).map((p) => [p.tkanina, p.listwa, Math.round(p.gora * 200), Math.round(p.dol * 200), p.rogi.map((r) => [Math.round(r[0]), Math.round(r[1])])])]);
    let h1 = 0x811c9dc5;
    let h2 = 0x1b873593;
    for (let i = 0; i < opis.length; i++) {
      const c = opis.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
      h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
    }
    return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
  }, [panes, montaz]);

  // zdjęcie AI tylko na życzenie klienta (właściciel 1.11): najpierw ustawia tkaninę, listwy i belki na podglądzie,
  // potem jednym przyciskiem dostaje realistyczne zdjęcie tego układu; każda zmiana wraca do podglądu na żywo
  const generujAi = async () => {
    if (!token || aiTrwa || aiOffRef.current || !katalog) return;
    const mojKlucz = klucz;
    setAiInfo("");
    setAiTrwa(true);
    setAiPokaz(true);
    // tekstury tkanin i zdjęcia listw muszą być na płótnie (AI ma się wzorować na prawdziwym kolorze)
    for (let i = 0; i < 40; i++) {
      const r = rendRef.current;
      if (r && panes.every((p) => r.hasFabric(p.tkanina) && (!katalog.listwy.find((l) => l.id === p.listwa)?.zdjecie || r.hasRail(p.listwa)))) break;
      await new Promise((res) => window.setTimeout(res, 100));
    }
    draw();
    await new Promise((res) => window.setTimeout(res, 120));
    const rr = rendRef.current;
    if (!rr) {
      setAiTrwa(false);
      return;
    }
    const uklad: WizUklad = { szyby: {}, montaz };
    for (const p of panes) uklad.szyby[p.id] = { tkanina: p.tkanina, listwa: p.listwa, gora: p.gora, dol: p.dol };
    const res = await wizRender(token, uklad, mojKlucz, rr.toDataUrl(0.88));
    setAiTrwa(false);
    if (res.ok && res.url) {
      setAi({ klucz: mojKlucz, url: res.url });
    } else {
      if (res.limit) aiOffRef.current = true;
      setAiInfo(res.komunikat || "Nie udało się przygotować zdjęcia - spróbuj za chwilę.");
    }
  };
  // nowa zmiana układu = znowu podgląd na żywo; zdjęcie wróci, jeśli klient ustawi dokładnie to samo
  useEffect(() => {
    setAiPokaz(true);
    setAiInfo((t) => (aiOffRef.current ? t : ""));
  }, [klucz]);

  // zapis układu (z opóźnieniem)
  useEffect(() => {
    if (!token || faza !== "gotowa" || !panes.length || demo) return;
    window.clearTimeout(saveRef.current);
    saveRef.current = window.setTimeout(() => {
      const uklad: WizUklad = { szyby: {}, montaz, wszystkie, dodane: panes.filter((p) => p.id.startsWith("r")).map((p) => ({ id: p.id, rogi: p.rogi })) };
      for (const p of panes) {
        uklad.szyby[p.id] = { tkanina: p.tkanina, listwa: p.listwa, gora: Math.round(p.gora * 1000) / 1000, dol: Math.round(p.dol * 1000) / 1000, rogi: p.rogi,
          szer_mm: p.wpisSzerMm ?? null, wys_mm: p.wpisWysMm ?? null, zmierzone: Boolean(p.zmierzone), pomin: Boolean(p.pomin) };
      }
      wizSaveLayout(token, uklad, korektaRef.current);
      // zrzut tego, co klient widzi (plisy w tkaninie i ułożeniu belek) - CRM pokazuje go w karcie wizualizacji
      const c = canvasRef.current;
      if (c && c.width) {
        try {
          const sk = Math.min(1, 900 / Math.max(c.width, c.height));
          const o = document.createElement("canvas");
          o.width = Math.round(c.width * sk);
          o.height = Math.round(c.height * sk);
          o.getContext("2d")?.drawImage(c, 0, 0, o.width, o.height);
          wizPodglad(token, o.toDataURL("image/jpeg", 0.72));
        } catch {
          // płótno bez dostępu (CORS) - CRM odtworzy podgląd z układu
        }
      }
    }, 1200);
  }, [panes, montaz, wszystkie, token, faza, demo]);

  // ------------------------------------------------------------ wskaźnik na zdjęciu
  const toImg = (e: { clientX: number; clientY: number }): Pt | null => {
    const c = canvasRef.current;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return [((e.clientX - r.left) * c.width) / r.width, ((e.clientY - r.top) * c.height) / r.height];
  };
  const screenScale = () => {
    const c = canvasRef.current;
    return c ? c.width / c.getBoundingClientRect().width : 1;
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = toImg(e);
    if (!pt) return;
    if (przedPo !== null && Math.abs(pt[0] - przedPo) < 30 * screenScale()) {
      dragRef.current = { kind: "split", pane: -1, off: 0 };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    let hit: { kind: "gora" | "dol"; pane: number; off: number; d: number } | null = null;
    let selHit = -1;
    panes.forEach((p, i) => {
      const H = paneToImage(p.rogi);
      const Hi = H ? invert3(H) : null;
      if (!Hi) return;
      const [u, v] = apply(Hi, pt);
      if (u < -0.06 || u > 1.06 || v < -0.08 || v > 1.08) return;
      selHit = i;
      const [, ph] = panePixelSize(p.rogi);
      const railH = Math.max(RAIL_MM / Math.max(300, p.wysMm || 1200), 4 / ph);
      const tol = Math.max(railH * 1.2, (22 * screenScale()) / ph);
      const dTop = Math.abs(v - (p.gora + railH / 2));
      const dBot = Math.abs(v - (p.dol - railH / 2));
      if (dTop < tol && (!hit || dTop < hit.d)) hit = { kind: "gora", pane: i, off: v - p.gora, d: dTop };
      if (dBot < tol && (!hit || dBot < hit.d)) hit = { kind: "dol", pane: i, off: v - p.dol, d: dBot };
    });
    if (hit) {
      const h = hit as { kind: "gora" | "dol"; pane: number; off: number };
      dragRef.current = { kind: h.kind, pane: h.pane, off: h.off };
      setSel(h.pane);
      e.currentTarget.setPointerCapture(e.pointerId);
    } else if (selHit >= 0) {
      setSel(selHit);
    }
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const pt = toImg(e);
    if (!pt) return;
    if (d.kind === "split") {
      setPrzedPo(Math.max(0, Math.min(canvasRef.current?.width || 0, pt[0])));
      return;
    }
    setPanes((prev) => prev.map((p, i) => {
      if (i !== d.pane) return p;
      const H = paneToImage(p.rogi);
      const Hi = H ? invert3(H) : null;
      if (!Hi) return p;
      const v = apply(Hi, pt)[1] - d.off;
      const [, ph] = panePixelSize(p.rogi);
      const railH = Math.max(RAIL_MM / Math.max(300, p.wysMm || 1200), 4 / ph);
      const minGap = 2 * railH + 0.02;
      if (d.kind === "gora") return { ...p, gora: Math.max(0, Math.min(p.dol - minGap, v)) };
      return { ...p, dol: Math.min(1, Math.max(p.gora + minGap, v)) };
    }));
  };

  const onUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d && (d.kind === "gora" || d.kind === "dol")) {
      wizEvent("wiz_belka", token, { belka: d.kind });
      try {
        if (token) window.localStorage.setItem(`keika_wiz_belka_${token}`, "1");
      } catch {
        // tylko pamięć podpowiedzi
      }
    }
    if (d?.kind === "split") wizEvent("wiz_przed_po", token, {});
  };

  // rogi w trybie edycji (uchwyty DOM nad canvasem)
  const onCornerDown = (pane: number, corner: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { kind: "rog", pane, corner, off: 0 };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setSel(pane);
  };
  const onCornerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || d.kind !== "rog") return;
    const pt = toImg(e);
    const c = canvasRef.current;
    if (!pt || !c) return;
    const q: Pt = [Math.max(0, Math.min(c.width, pt[0])), Math.max(0, Math.min(c.height, pt[1]))];
    setPanes((prev) => prev.map((p, i) => {
      if (i !== d.pane) return p;
      const rogi = p.rogi.map((r, k) => (k === d.corner ? q : r)) as Pt[];
      return isConvexQuad(rogi) ? { ...p, rogi } : p;
    }));
    korektaRef.current = true;
  };
  const onCornerUp = () => {
    if (dragRef.current?.kind === "rog") wizEvent("wiz_recznie", token, { szyba: panes[dragRef.current.pane]?.id || "" });
    dragRef.current = null;
  };

  const [, force] = useState(0);
  useEffect(() => {
    const r = () => force((x) => x + 1);
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, []);
  /** Punkt zdjęcia → pozycja w .canvasWrap (płótno bywa wyśrodkowane). */
  const cornerPos = (p: Pt) => {
    const c = canvasRef.current;
    const w = wrapRef.current;
    if (!c || !w) return { left: 0, top: 0 };
    const r = c.getBoundingClientRect();
    const wr = w.getBoundingClientRect();
    return { left: r.left - wr.left + (p[0] * r.width) / c.width, top: r.top - wr.top + (p[1] * r.height) / c.height };
  };

  // ------------------------------------------------------------ akcje
  const ustawTkanine = (id: string) => {
    setPanes((prev) => prev.map((p, i) => (wszystkie || i === sel ? { ...p, tkanina: id } : p)));
    wizEvent("wiz_zmiana_tkaniny", token, { tkanina: id, wszystkie });
  };
  const ustawListwe = (id: string) => {
    setPanes((prev) => prev.map((p, i) => (wszystkie || i === sel ? { ...p, listwa: id } : p)));
    wizEvent("wiz_zmiana_listwy", token, { listwa: id, wszystkie });
  };
  const naWszystkie = () => {
    const src = panes[sel];
    if (!src) return;
    setWszystkie(true);
    setPanes((prev) => prev.map((p) => ({ ...p, tkanina: src.tkanina, listwa: src.listwa, gora: src.gora, dol: src.dol })));
    wizEvent("wiz_wszystkie", token, { szyb: panes.length });
  };
  const dodajSzybe = () => {
    const c = canvasRef.current;
    if (!c) return;
    const w = c.width;
    const h = c.height;
    const id = `r${Date.now().toString(36)}`;
    setPanes((prev) => [...prev, { id, rogi: [[w * 0.35, h * 0.25], [w * 0.65, h * 0.25], [w * 0.65, h * 0.7], [w * 0.35, h * 0.7]], gora: 0, dol: 0.68,
      tkanina: prev[sel]?.tkanina || DOMYSLNA_TKANINA, listwa: prev[sel]?.listwa || DOMYSLNA_LISTWA, pewnosc: 100, szerMm: 0, wysMm: 0, swiatlo: null }]);
    setSel(panes.length);
    korektaRef.current = true;
    wizEvent("wiz_recznie", token, { dodana: true });
  };
  const usunSzybe = () => {
    setPanes((prev) => prev.filter((_, i) => i !== sel));
    setSel(0);
    korektaRef.current = true;
  };

  const zamow = () => {
    if (!katalog) return;
    const previousRooms = zdjecia.filter((room) => room.token !== token && !room.wKoszyku);
    const rooms = [
      { name: zdjecia.find((room) => room.token === token)?.nazwa, panes },
      ...previousRooms.map((room) => ({ name: room.nazwa, panes: cacheRef.current.get(room.token)?.panes || [] })),
    ];
    const positions = rooms.flatMap((room) => room.panes.filter((pane) => !pane.pomin).map((pane) => ({
      hardwareId: pane.listwa,
      fabricGroupId: katalog.tkaniny.find((fabric) => fabric.id === pane.tkanina)?.kolekcja || "",
      fabricId: pane.tkanina,
      room: room.name,
    })));
    const first = positions[0];
    if (!first) return;
    const pick: WizPickDetail = { ...first, requireDimensions: true, positions };

    try {
      const prev = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "{}");
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...prev, ...pick, widthMm: undefined, heightMm: undefined, savedAt: Date.now() }));
    } catch {
      /* szkic to wygoda */
    }
    wizEvent("wiz_do_konfiguratora", token, { tkanina: first.fabricId, listwa: first.hardwareId, szyb_w_domu: zdjecia.reduce((a, z) => a + z.szyb, 0) });
    const panel = document.querySelector(".hero-product-config-panel");
    if (panel && window.location.pathname.startsWith("/plisy")) {
      window.dispatchEvent(new CustomEvent<WizPickDetail>(WIZ_PICK_EVENT, { detail: pick }));
      onClose();
      window.setTimeout(() => panel.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    } else {
      window.location.href = "/plisy?wiz=1#konfigurator";
    }
  };

  const pobierz = () => {
    const c = canvasRef.current;
    if (!c || !wynik) return;
    const aiAktualne = ai && ai.klucz === klucz && aiPokaz && !edycja && przedPo === null;
    draw();
    window.setTimeout(() => {
      const out = document.createElement("canvas");
      out.width = c.width;
      out.height = c.height;
      const ctx = out.getContext("2d");
      if (!ctx) return;
      const aiImg = aiAktualne ? (wrapRef.current?.querySelector("img[data-ai]") as HTMLImageElement | null) : null;
      if (aiImg && aiImg.complete && aiImg.naturalWidth) ctx.drawImage(aiImg, 0, 0, c.width, c.height);
      else ctx.drawImage(c, 0, 0);
      const fs = Math.max(14, Math.round(c.width / 70));
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, c.height - fs * 2.2, c.width, fs * 2.2);
      ctx.fillStyle = "#fff";
      ctx.font = `${fs}px system-ui, sans-serif`;
      ctx.fillText(`Wizualizacja poglądowa${wynik.uporzadkowane ? " · zdjęcie uporządkowane automatycznie" : ""} · KEIKA · sklep.keika.pl`, fs * 0.8, c.height - fs * 0.75);
      const a = document.createElement("a");
      a.href = out.toDataURL("image/jpeg", 0.9);
      a.download = "plisa-w-moim-oknie.jpg";
      a.click();
    }, 60);
  };

  const zapamietaj = () => {
    if (token && wynik && faza === "gotowa") cacheRef.current.set(token, { wynik, status, panes, sel, montaz, ai });
  };

  /** „Nie masz teraz zdjęcia? Zobacz na przykładowym oknie” - gotowa wizualizacja z CRM (bez kosztu AI). */
  const pokazDemo = () => {
    if (!katalog?.demo) return;
    demoRef.current = true;
    setDemo(true);
    setToken(katalog.demo);
    setFaza("analiza");
    wizEvent("wiz_demo", katalog.demo, { zrodlo });
  };

  const noweZdjecie = () => {
    etapRef.current = { etap: "", t: 0 };
    wizEvent("wiz_kolejne_okno", token, { zdjec: zdjecia.length, z_demo: demoRef.current });
    if (!demoRef.current) zapamietaj();
    demoRef.current = false;
    setDemo(false);
    setToken(null);
    setWynik(null);
    setStatus(null);
    setPanes([]);
    setEdycja(false);
    setPrzedPo(null);
    setInfo("");
    setBlad("");
    setQr(null);
    setAi(null);
    setFaza("start");
  };

  const otworzZdjecie = (z: Zdjecie) => {
    if (z.token === token) return;
    zapamietaj();
    setEdycja(false);
    setPrzedPo(null);
    setHover(null);
    setBlad("");
    const c = cacheRef.current.get(z.token);
    if (c) {
      zCacheRef.current = { token: z.token, panes: c.panes, sel: c.sel, montaz: c.montaz, ai: c.ai };
      setStatus(c.status);
      setWynik(c.wynik);
      setToken(z.token);
      setFaza("gotowa");
      return;
    }
    setWynik(null);
    setPanes([]);
    setToken(z.token);
    setFaza("analiza");
  };

  // ------------------------------------------------------------ widok
  const aktywna = panes[sel];
  const tkAkt = katalog?.tkaniny.find((t) => t.id === aktywna?.tkanina);
  const liAkt = katalog?.listwy.find((l) => l.id === aktywna?.listwa);
  const wycenaSzyby = useMemo(() => panes.map<WycenaSzyba>((p, i) => ({
    id: p.id, nr: i + 1, tkanina: p.tkanina, listwa: p.listwa, szacSzerCm: Math.round(p.szerMm / 10), szacWysCm: Math.round(p.wysMm / 10),
    pewnosc: p.pewnoscWym ?? null, odniesienia: p.odniesienia || [], szerMm: p.wpisSzerMm, wysMm: p.wpisWysMm, zmierzone: p.zmierzone, pomin: p.pomin,
  })), [panes]);
  const cenaZestawu = useCenaZestawu(wycenaSzyby, montaz);
  const szacunkowa = Boolean(cenaZestawu?.szacunkowa);
  // zachęta do wymiarów: wynik z ceną szacunkową, bez otwartych okienek i podpowiedzi, po 12 s - raz na wizualizację
  useEffect(() => {
    if (faza !== "gotowa" || !gotowyObraz || demo || !token || !szacunkowa || zakladka || emailOkno || pokojDialog || lupa || podp || edycja || przedPo !== null) return;
    try {
      if (window.localStorage.getItem(`keika_wiz_zwym_${token}`)) return;
    } catch {
      // bez pamięci przeglądarki zachęta pokaże się raz na otwarcie
    }
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(`keika_wiz_zwym_${token}`, "1");
      } catch {
        // jw.
      }
      setZachetaWym(true);
      wizEvent("wiz_zacheta_wymiary", token, {});
    }, 12000);
    return () => window.clearTimeout(t);
  }, [faza, gotowyObraz, demo, token, szacunkowa, zakladka, emailOkno, pokojDialog, lupa, podp, edycja, przedPo]);
  useEffect(() => {
    if (zakladka || !szacunkowa) setZachetaWym(false);
  }, [zakladka, szacunkowa]);
  const pokojTeraz =zdjecia.find((z) => z.token === token)?.nazwa || "Pokój";
  const zapiszNazwe = (nazwa: string) => {
    const n = nazwa.trim().slice(0, 40) || pokojTeraz;
    writeSesja(readSesja().map((z) => (z.token === token ? { ...z, nazwa: n } : z)));
    setZdjecia(readSesja());
    return n;
  };
  const kolejnyPokoj = () => {
    setPokojNazwa(pokojTeraz);
    setPokojDialog("kolejny");
  };
  const otworzKarte = (k: Exclude<Zakladka, null>) => {
    if (zakladka === k) {
      setZakladka(null);
      setEdycja(false);
      return;
    }
    setZakladka(k);
    setEdycja(k === "szyby");
    if (k === "wycena") wizEvent("wiz_produkt", token, { widok: "wycena" });
  };
  const szybWDomu = zdjecia.reduce((a, z) => a + (z.token === token ? panes.length : z.szyb), 0);
  const prog = useMemo(() => {
    const r = bundle.plisy;
    if (!r || !r.tiers?.length || szybWDomu < 2) return ""; // Agencja 1.11: rabat pokazujemy dopiero przy ≥ 2 szybach
    const tier = [...r.tiers].sort((a, b) => b.fromQty - a.fromQty).find((t) => szybWDomu >= t.fromQty);
    const next = [...r.tiers].sort((a, b) => a.fromQty - b.fromQty).find((t) => t.fromQty > szybWDomu);
    const pokoi = zdjecia.length;
    const ile = `${szybWDomu} ${szybWDomu === 1 ? "szyba" : szybWDomu % 10 >= 2 && szybWDomu % 10 <= 4 && (szybWDomu < 12 || szybWDomu > 14) ? "szyby" : "szyb"}${pokoi > 1 ? ` w ${pokoi} pokojach` : ""}`;
    if (tier) return `${ile} = ${szybWDomu} ${szybWDomu === 1 ? "plisa" : szybWDomu % 10 >= 2 && szybWDomu % 10 <= 4 && (szybWDomu < 12 || szybWDomu > 14) ? "plisy" : "plis"}: −${tier.percent} % na całe zamówienie (${(r.label || "rabat ilościowy").split(":")[0].trim()}).`;
    if (next) return `Przy ${next.fromQty} plisach w koszyku −${next.percent} % na całe zamówienie.`;
    return "";
  }, [bundle, szybWDomu]);

  // promocja sklepu na dole ekranu oczekiwania (reguły rabatu ilościowego z CRM, właściwe dla danego sklepu)
  const promo = useMemo(() => {
    const r = bundle.plisy;
    if (!r?.tiers?.length) return null;
    const progi = [...r.tiers].sort((a, b) => a.fromQty - b.fromQty).map((t) => `${t.fromQty}${t === r.tiers[r.tiers.length - 1] ? "+" : ""} szt. −${t.percent} %`).join(" · ");
    return { tytul: (r.label || "Promocja").split(":")[0].trim(), opis: `${progi} na całe zamówienie – plisy, moskitiery i rolety razem` };
  }, [bundle]);

  const tkaninyKolekcji = katalog?.tkaniny.filter((t) => t.kolekcja === (kolekcja || katalog.kolekcje[0]?.id)) || [];

  // Portal do <body>: przyciski siedzą w sekcjach z transform/overflow, które przycinałyby position: fixed.
  const podglad = status?.podglad;
  // postęp: zakres etapu + czas w etapie (krzywa dochodzi do końca zakresu, nigdy go nie przeskakuje)
  const etapTeraz = faza === "sprawdzanie" ? "Q" : ETAPY_POSTEP[status?.etap || ""] ? (status?.etap as string) : "A";
  const teraz = Date.now();
  if (faza === "analiza" || faza === "sprawdzanie") {
    if (etapRef.current.etap !== etapTeraz) etapRef.current = { etap: etapTeraz, t: teraz };
  }
  const ep = ETAPY_POSTEP[etapTeraz];
  const wEtapie = etapRef.current.t ? (teraz - etapRef.current.t) / 1000 : 0;
  const postep = Math.round(ep.od + (ep.do - ep.od) * (1 - Math.exp(-wEtapie / ep.s)));
  // zostało: reszta bieżącego etapu + typowe czasy następnych (porządkowanie tylko, gdy zdjęcie go wymaga)
  const porzadek = etapTeraz === "0" || Boolean(podglad?.uporzadkowane);
  const dalej = KOLEJNOSC_ETAPOW.slice(KOLEJNOSC_ETAPOW.indexOf(etapTeraz) + 1).filter((e) => e !== "0" || porzadek);
  const zostalo = Math.max(3, ep.s - wEtapie) + dalej.reduce((a, e) => a + ETAPY_POSTEP[e].s, 0);
  const dluzej = wEtapie > ep.s * 2.2;
  return createPortal(
    <>
    <div className={`${s.overlay} ${min ? s.hiddenOverlay : ""}`} role="dialog" aria-modal="true" aria-label="Zobacz plisę w swoim oknie">
      <div className={`${s.modal} ${faza === "gotowa" || faza === "start" || faza === "wysylanie" || faza === "analiza" || faza === "sprawdzanie" ? s.modalWide : ""}`}>
        <button type="button" className={s.close} onClick={() => { wizEvent("wiz_zamkniete", token, { faza }); onClose(); }} aria-label="Zamknij">×</button>
        {faza !== "start" ? (
          <button type="button" className={s.minBtn} onClick={() => { setMin(true); wizEvent("wiz_minimalizuj", token, { faza }); }} aria-label="Zminimalizuj" title="Zminimalizuj – przeglądaj sklep, wrócisz jednym kliknięciem">–</button>
        ) : null}

        {qrKod && (faza === "start" || faza === "wysylanie") ? (
          // telefon po zeskanowaniu kodu z komputera: od razu aparat / galeria, bez wstępu
          <div className={s.phoneBox}>
            <span className={s.newPill}>Połączono z komputerem</span>
            <h2 className={s.titleBig}>Zrób zdjęcie okna</h2>
            <p className={s.lead}>Stań na wprost okna, tak żeby całe było w kadrze. Osoby i bałagan usuniemy sami.</p>
            {blad ? <p className={s.error}>{blad}</p> : null}
            {faza === "wysylanie" ? (
              <p className={s.busy}>Wysyłamy zdjęcie…</p>
            ) : (
              <div className={s.phoneBtns}>
                <button type="button" className={s.primaryBig} onClick={() => camRef.current?.click()}>📷 Zrób zdjęcie</button>
                <button type="button" className={s.secondaryBig} onClick={() => fileRef.current?.click()}>🖼️ Wybierz z galerii</button>
              </div>
            )}
            <p className={s.consentLine}>Wysyłając zdjęcie, zgadzasz się na jego przetworzenie przez KEIKA w celu wizualizacji. Przechowujemy je 30 dni, nie używamy w reklamach.</p>
            <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void wyslij(e.target.files?.[0])} />
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void wyslij(e.target.files?.[0])} />
          </div>
        ) : null}

        {faza === "qr_gotowe" || faza === "qr_koniec" ? (
          <div className={s.phoneBox}>
            <div className={s.bigCheck} aria-hidden="true">✓</div>
            <h2 className={s.titleBig}>{faza === "qr_koniec" ? "Gotowe – wróć do komputera" : "Zdjęcie wysłane"}</h2>
            <p className={s.lead}>
              {faza === "qr_koniec"
                ? "Wizualizacja pojawi się na ekranie komputera za około minutę. Telefon możesz odłożyć."
                : "Przygotowujemy wizualizację – za około minutę zobaczysz plisę na swoim oknie. Gdzie chcesz ją oglądać?"}
            </p>
            {faza === "qr_gotowe" ? (
              <div className={s.phoneBtns}>
                <button type="button" className={s.primaryBig} onClick={() => { wizEvent("wiz_qr_telefon", token, { wybor: "telefon" }); setFaza("analiza"); }}>Kontynuuj na tym telefonie</button>
                <button type="button" className={s.secondaryBig} onClick={() => { wizEvent("wiz_qr_telefon", token, { wybor: "komputer" }); setFaza("qr_koniec"); }}>Wróć do komputera</button>
              </div>
            ) : (
              <button type="button" className={s.secondaryBig} onClick={() => setFaza("analiza")}>Jednak pokaż na telefonie</button>
            )}
          </div>
        ) : null}

        {!qrKod && (faza === "start" || faza === "wysylanie") ? (
          <div className={s.startGrid}>
            <WizDemo />
            <div className={s.startBox}>
              <div className={s.produkt}>
                <span className={s.newPill}>Nowość · AI</span>
                <span className={s.chipOnSm}>Plisy</span>
                <span className={s.chipOff} title="Wkrótce">Rolety dachowe – wkrótce</span>
              </div>
              <h2 className={s.titleBig}>Zobacz plisę w swoim oknie – zanim kupisz</h2>
              <p className={s.lead}>Wyślij zdjęcie okna. W minutę pokażemy plisę na Twojej szybie, dobierzemy kolor do wnętrza i policzymy cenę.</p>
              <ol className={s.steps3}>
                <li><span aria-hidden="true">📷</span><b>Zrób zdjęcie okna</b><small>na wprost, całe okno w kadrze, w dzień</small></li>
                <li><span aria-hidden="true">✨</span><b>AI dopasuje plisę</b><small>szyby, perspektywa i światło</small></li>
                <li><span aria-hidden="true">🎨</span><b>Wybierz kolor i zamów</b><small>150 tkanin, wycena od razu</small></li>
              </ol>
              {blad ? <p className={s.error}>{blad}</p> : null}
              {faza === "wysylanie" ? (
                <p className={s.busy}>Wysyłamy zdjęcie…</p>
              ) : mobile || qrKod ? (
                <div className={s.actions}>
                  <button type="button" className={s.primaryBig} onClick={() => camRef.current?.click()}>📷 Zrób zdjęcie okna</button>
                  <button type="button" className={s.secondary} onClick={() => fileRef.current?.click()}>Wybierz z galerii</button>
                </div>
              ) : (
                // komputer (właściciel 2.11): GŁÓWNA opcja to duży kod QR - zdjęcie robisz telefonem, wynik na dużym ekranie
                <div className={s.qrBig}>
                  <div className={s.qrBigHead}>
                    <b>📱 Zrób zdjęcie okna telefonem</b>
                    <small>Otwórz aparat w telefonie i skieruj go na kod – bez instalowania aplikacji. Wynik pojawi się tutaj, na dużym ekranie.</small>
                  </div>
                  {qrSkan ? (
                    <div className={s.qrPolaczono}>
                      <span className={s.qrPuls} aria-hidden="true">📱</span>
                      <b>Telefon połączony – zrób zdjęcie okna</b>
                      <small>Czekamy na zdjęcie z telefonu. Gdy je wyślesz, wizualizacja pojawi się tutaj.</small>
                    </div>
                  ) : (
                    <div className={s.qrBigImg}>{qr ? <QrKod url={qr.url} /> : <span className={s.qrWait}>…</span>}</div>
                  )}
                  {qrDlugo && !qrSkan ? (
                    <div className={s.qrAlt}>
                      <b>Nie masz telefonu pod ręką?</b>
                      <button type="button" className={s.secondary} onClick={() => { wizEvent("wiz_qr_alternatywa", null, { wybor: "plik" }); fileRef.current?.click(); }}>🖼️ Wybierz zdjęcie okna z komputera</button>
                    </div>
                  ) : (
                    <button type="button" className={s.qrPlik} onClick={() => fileRef.current?.click()}>albo wybierz plik z komputera</button>
                  )}
                </div>
              )}
              {faza === "start" && katalog?.demo ? (
                <button type="button" className={s.demoLink} onClick={pokazDemo}>Nie masz teraz zdjęcia? <b>Zobacz na przykładowym oknie →</b></button>
              ) : null}
              <p className={s.zaufanie}>🔒 Zdjęcie widzisz tylko Ty, usuwamy je po 30 dniach.</p>
              <p className={s.tidy}>✨ Osoby, bałagan i stare rolety usuniemy ze zdjęcia automatycznie.</p>
              <p className={s.consentLine}>
                Wysyłając zdjęcie, zgadzasz się na jego przetworzenie przez KEIKA w celu przygotowania wizualizacji. Przechowujemy je 30 dni, nie używamy w reklamach;
                usunięcia możesz zażądać wcześniej (czat lub biuro@keika.pl).
              </p>
              <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void wyslij(e.target.files?.[0])} />
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void wyslij(e.target.files?.[0])} />
            </div>
          </div>
        ) : null}

        {faza === "popraw" && kontrola ? (
          <div className={s.startBox}>
            <h2 className={s.title}>Prawie! Lepsze zdjęcie da lepszy efekt</h2>
            <p className={s.lead}>{kontrola.komunikat || "To zdjęcie może dać słabszy wynik."}</p>
            {kontrola.problemy.length ? <ul className={s.problems}>{kontrola.problemy.map((p) => <li key={p}>{p}</li>)}</ul> : null}
            <div className={s.actions}>
              <button type="button" className={s.primary} onClick={noweZdjecie}>Zrób nowe zdjęcie</button>
              <button type="button" className={s.secondary} onClick={mimoTo}>Spróbuj z tym zdjęciem</button>
            </div>
          </div>
        ) : null}

        {faza === "analiza" || faza === "sprawdzanie" ? (
          <div className={s.prodGrid}>
            <div className={s.prodPhoto}>
              {status?.obraz?.url ? (
                <div className={s.scanBox}>
                  {zdjPrzed ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={zdjPrzed} alt="" className={s.scanImg2} />
                  ) : null}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img key={status.obraz.url} src={status.obraz.url} alt="" className={`${s.scanImg2} ${zdjPrzed ? s.scanNowe : ""}`} />
                  {zdjPrzed ? <div className={s.scanWipeLine} /> : null}
                  {podglad?.rogi?.length && !zdjPrzed ? (() => {
                    const W = status.obraz!.szer;
                    const etapG = ["C", "F"].includes(status?.etap || "") || Boolean(podglad.wym);
                    // punkt w czworokącie (u, v ∈ 0..1) - siatka „perspektywy” na szybie
                    const pkt = (q: number[][], u: number, v: number) => [
                      (1 - u) * (1 - v) * q[0][0] + u * (1 - v) * q[1][0] + u * v * q[2][0] + (1 - u) * v * q[3][0],
                      (1 - u) * (1 - v) * q[0][1] + u * (1 - v) * q[1][1] + u * v * q[2][1] + (1 - u) * v * q[3][1],
                    ];
                    return (
                      <svg className={s.scanSvg} viewBox={`0 0 ${W} ${status.obraz!.wys}`} preserveAspectRatio="none" aria-hidden="true">
                        {podglad.rogi!.map((q, i) => {
                          const g = pkt(q, 0.5, 0);
                          const wym = podglad.wym?.[i];
                          return (
                            <g key={i} style={{ animationDelay: `${i * 0.25}s` }} className={s.scanSzyba}>
                              <polygon points={q.map((p) => p.join(",")).join(" ")} pathLength={100} />
                              {etapG ? [0.25, 0.5, 0.75].map((t) => {
                                const a1 = pkt(q, t, 0); const b1 = pkt(q, t, 1); const a2 = pkt(q, 0, t); const b2 = pkt(q, 1, t);
                                return (
                                  <g key={t} className={s.scanSiatka}>
                                    <line x1={a1[0]} y1={a1[1]} x2={b1[0]} y2={b1[1]} />
                                    <line x1={a2[0]} y1={a2[1]} x2={b2[0]} y2={b2[1]} />
                                  </g>
                                );
                              }) : null}
                              <text x={q.reduce((a, p) => a + p[0], 0) / 4} y={q.reduce((a, p) => a + p[1], 0) / 4}>{i + 1}</text>
                              {wym && wym[0] > 0 ? (
                                <text x={g[0]} y={g[1] - W * 0.012} className={s.scanWym} style={{ fontSize: Math.max(14, W * 0.022) }}>≈ {wym[0]} × {wym[1]} cm</text>
                              ) : null}
                            </g>
                          );
                        })}
                      </svg>
                    );
                  })() : null}
                  {!zdjPrzed ? <div className={s.scanLine} /> : null}
                  {podglad?.uporzadkowane ? (
                    <div className={s.scanUsun}>
                      <span>✨ Uporządkowaliśmy zdjęcie</span>
                      {(podglad.usuniete || []).map((u, i) => <span key={u} style={{ animationDelay: `${0.4 + i * 0.35}s` }}>✓ usunięte: {u}</span>)}
                    </div>
                  ) : null}
                </div>
              ) : <div className={s.scanEmpty}>Wysyłamy zdjęcie…</div>}
            {(() => {
                const hasPromo = promo && (podglad?.szyb || 0) >= 2;
                const index = korzysc % (KORZYSCI.length + (hasPromo ? 1 : 0));
                const card = KORZYSCI[index];
                return (
                  <aside className={s.benefitCard} data-theme={card?.theme || "promo"} key={index} aria-label="Zalety plis KEIKA">
                    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d={card?.path || "M8 10h25l22 22-23 23L10 33z M20 20h.1"} />
                    </svg>
                    <div>
                      <strong>{card?.title || promo?.tytul}</strong>
                      <div className={s.benefitDetails}>
                        <span>{card?.first || promo?.opis}</span>
                        {card?.second ? <span>{card.second}</span> : null}
                      </div>
                    </div>
                  </aside>
                );
              })()}
            </div>
            <div className={s.prodPanel}>
              <p className={s.label}>Twoja wizualizacja powstaje</p>
              <div className={s.progressRow} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={postep}>
                <b>{postep} %</b>
                <div className={s.progressTrack}><span style={{ width: `${postep}%` }} /></div>
                <small>{dluzej ? (etapTeraz === "0" ? "Porządkowanie zdjęcia trwa dziś dłużej – jeszcze chwila…" : "Jeszcze chwila, dopracowuję szyby…") : `zostało ok. ${Math.round(zostalo / 5) * 5 || 5} s`}</small>
              </div>
              <ol className={s.checklist}>
                {[
                  { id: "Q", t: "Szukam okna", done: faza !== "sprawdzanie" },
                  { id: "0", t: "Porządkuję zdjęcie (osoby, bałagan, stare rolety)", done: ["A", "B", "C", "F"].includes(status?.etap || "") || Boolean(podglad?.pomieszczenie), skip: !podglad?.uporzadkowane && Boolean(podglad?.szyb) },
                  { id: "A", t: podglad?.pomieszczenie ? `Sprawdzam światło i kolory wnętrza – widzę ${POMIESZCZENIE[podglad.pomieszczenie] || "wnętrze"}` : "Sprawdzam światło i kolory wnętrza", done: Boolean(podglad?.pomieszczenie) },
                  { id: "B", t: podglad?.szyb ? `Zaznaczam szyby – ${podglad.szyb} ${podglad.szyb === 1 ? "szyba" : podglad.szyb < 5 ? "szyby" : "szyb"}` : "Zaznaczam szyby", done: Boolean(podglad?.szyb) },
                  { id: "C", t: "Dobieram tkaniny do Twojego pokoju", done: status?.etap === "F" },
                  { id: "F", t: "Nakładam plisy", done: false },
                ].filter((k) => !k.skip).map((k) => {
                  const now = !k.done && (k.id === (faza === "sprawdzanie" ? "Q" : status?.etap || "A") || (k.id === "A" && !status?.etap));
                  return (
                    <li key={k.id} className={k.done ? s.ckDone : now ? s.ckNow : s.ckWait}>
                      <span aria-hidden="true">{k.done ? "✓" : now ? "" : "•"}</span>{k.t}
                    </li>
                  );
                })}
              </ol>
              {podglad?.paleta?.length ? (
                <span className={s.palette}>Kolory Twojego wnętrza: {podglad.paleta.map((p) => <i key={p.hex + p.nazwa} style={{ background: p.hex }} title={p.nazwa} />)}</span>
              ) : null}
              <p className={s.sub}>Możesz zminimalizować okno (–) i oglądać sklep – damy znać, gdy wizualizacja będzie gotowa.</p>
              {qrKod ? <p className={s.sub}>Wizualizacja pojawi się też na komputerze.</p> : null}
            </div>
          </div>
        ) : null}

        {faza === "odrzucona" || faza === "blad" ? (
          <div className={s.startBox}>
            <h2 className={s.title}>{faza === "odrzucona" ? "Potrzebujemy innego zdjęcia" : "Coś poszło nie tak"}</h2>
            <p className={s.lead}>{blad}</p>
            <div className={s.actions}>
              <button type="button" className={s.primary} onClick={noweZdjecie}>Wyślij inne zdjęcie</button>
              {faza === "blad" && token ? (
                <button type="button" className={s.secondary} onClick={() => { wizRestart(token); setBlad(""); setFaza("analiza"); }}>Spróbuj jeszcze raz</button>
              ) : null}
            </div>
          </div>
        ) : null}

        {faza === "gotowa" && wynik ? (
          <div className={s.res}>
            <div className={`${s.resStage} ${zakladka ? s.resStageKarta : ""}`}>
              <div className={s.stageCol}>
                {gotowyObraz && !edycja && przedPo === null && panes.length && zakladka !== "wycena" && (aiTrwa || (ai && ai.klucz === klucz && aiPokaz) || aiOffRef.current || aiInfo) ? (
                  <div className={`${s.aiBar} ${ai && ai.klucz === klucz && aiPokaz && !aiTrwa ? s.aiBarOk : ""}`} aria-live="polite">
                    {aiTrwa ? (
                      <>
                        <span className={s.aiSpin} aria-hidden="true" />
                        <p><b>Przygotowujemy realistyczne zdjęcie Twojego okna…</b><small>To potrwa około 10 sekund. Zdjęcie AI jest poglądowe – kolory i wygląd gotowej plisy mogą się różnić.</small></p>
                      </>
                    ) : ai && ai.klucz === klucz && aiPokaz ? (
                      <>
                        <span className={s.aiIco} aria-hidden="true">✓</span>
                        <p><b>Tak mogą wyglądać plisy w Twoim oknie</b><small>Zdjęcie przygotowane przez AI jest poglądowe – kolory, odcienie i wygląd gotowej plisy mogą się różnić. Chcesz coś zmienić? Wróć do ustawień.</small></p>
                        <button type="button" className={s.aiBtnGhost} onClick={() => setAiPokaz(false)}>Zmień ustawienia</button>
                      </>
                    ) : aiOffRef.current ? (
                      <>
                        <span className={s.aiIco} aria-hidden="true">i</span>
                        <p><b>{aiInfo || "Realistyczne zdjęcia dla tego okna są już wykorzystane."}</b><small>Kolor i położenie plis nadal zmienisz na podglądzie.</small></p>
                      </>
                    ) : aiInfo ? (
                      <>
                        <span className={s.aiIco} aria-hidden="true">i</span>
                        <p><b>{aiInfo}</b><small>Kolor i położenie plis nadal zmienisz na podglądzie.</small></p>
                      </>
                    ) : null}
                  </div>
                ) : null}
                <div className={s.canvasWrap} ref={wrapRef}>
                  <canvas
                    ref={canvasRef}
                    className={s.canvas}
                    onPointerDown={onDown}
                    onPointerMove={onMove}
                    onPointerUp={onUp}
                    onPointerCancel={onUp}
                  />
                  {podp?.reka ? (
                    <span className={s.podpReka} style={{ left: podp.reka.left, top: podp.reka.top }} aria-hidden="true">👆</span>
                  ) : null}
                  {podp?.napis ? (
                    <div className={s.podpNapis} role="status">
                      {isMobile() ? "Przesuń belkę palcem" : "Przeciągnij belkę myszką"} · {isMobile() ? "Stuknij" : "Kliknij"} „Kolor tkaniny”, żeby zmienić tkaninę
                    </div>
                  ) : null}
                  {/* przycisk zdjęcia AI na samym zdjęciu (właściciel 1.11: „nie rzuca się w oczy”), raz pulsuje po wyniku */}
                  {demo && gotowyObraz ? (
                    <button type="button" className={s.demoPasek} onClick={noweZdjecie}>
                      <b>Przykładowe okno</b><small>Pobaw się tkaninami i belkami – potem zrób zdjęcie swojego okna →</small>
                    </button>
                  ) : null}
                  {!demo && gotowyObraz && !edycja && przedPo === null && panes.length && !aiTrwa && !aiOffRef.current && !(ai && ai.klucz === klucz && aiPokaz) ? (
                    <button type="button" className={s.aiNaZdjeciu} onClick={() => void generujAi()}>
                      <span aria-hidden="true">✨</span><b>Pokaż realistyczne zdjęcie</b><small>Zobacz, jak na prawdziwym zdjęciu</small>
                    </button>
                  ) : null}
                  {/* zdjęcie AI bieżącego układu leży 1:1 na płótnie; przy każdej zmianie znika i wraca podgląd na żywo */}
                  {ai && ai.klucz === klucz && aiPokaz && !edycja && przedPo === null ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img data-ai="1" src={ai.url} alt="" className={s.aiImg} crossOrigin="anonymous" draggable={false} />
                  ) : null}
                  {ai && ai.klucz === klucz && aiPokaz && !edycja && przedPo === null ? (
                    <span className={s.aiZnak}>Zdjęcie AI · poglądowe – kolory mogą się różnić</span>
                  ) : null}
                  {edycja
                    ? panes.map((p, i) =>
                        p.rogi.map((r, k) => (
                          <button
                            key={`${p.id}-${k}`}
                            type="button"
                            aria-label={`Róg ${k + 1} szyby ${i + 1}`}
                            className={`${s.corner} ${i === sel ? s.cornerSel : ""}`}
                            style={cornerPos(r)}
                            onPointerDown={onCornerDown(i, k)}
                            onPointerMove={onCornerMove}
                            onPointerUp={onCornerUp}
                            onPointerCancel={onCornerUp}
                          />
                        )),
                      )
                    : null}
                  {/* kreator wymiarów: przyciemnione zdjęcie, jasna tylko mierzona szyba, strzałki szerokości i wysokości */}
                  {gotowyObraz && zakladka === "wycena" && wEtap === "kreator" && hover ? (() => {
                    const i = panes.findIndex((x) => x.id === hover);
                    const p = panes[i];
                    const w = wrapRef.current;
                    if (!p || !w) return null;
                    const wr = w.getBoundingClientRect();
                    const q = p.rogi.map((r) => cornerPos(r));
                    const pts = q.map((x) => `${x.left},${x.top}`).join(" ");
                    const sr = (a: { left: number; top: number }, b: { left: number; top: number }) => ({ left: (a.left + b.left) / 2, top: (a.top + b.top) / 2 });
                    const gora = sr(q[0], q[1]);
                    const lewa = sr(q[0], q[3]);
                    const odsun = 18;
                    return (
                      <svg className={s.kreatorSvg} width={wr.width} height={wr.height} aria-hidden="true">
                        <path fillRule="evenodd" d={`M0 0H${wr.width}V${wr.height}H0Z M${q.map((x) => `${x.left} ${x.top}`).join(" L")} Z`} className={s.kreatorMaska} />
                        <polygon points={pts} className={s.kreatorObrys} />
                        <line x1={q[0].left} y1={q[0].top - odsun} x2={q[1].left} y2={q[1].top - odsun} className={s.kreatorStrz} markerStart="url(#wk1)" markerEnd="url(#wk2)" />
                        <line x1={q[0].left - odsun} y1={q[0].top} x2={q[3].left - odsun} y2={q[3].top} className={s.kreatorStrz} markerStart="url(#wk1)" markerEnd="url(#wk2)" />
                        <text x={gora.left} y={gora.top - odsun - 7} textAnchor="middle" className={s.kreatorTxt}>szerokość</text>
                        <text x={lewa.left - odsun - 7} y={lewa.top} textAnchor="end" dominantBaseline="middle" className={s.kreatorTxt}>wysokość</text>
                        <text x={(q[0].left + q[2].left) / 2} y={(q[0].top + q[2].top) / 2} textAnchor="middle" dominantBaseline="middle" className={s.kreatorNr}>{i + 1}</text>
                        <defs>
                          <marker id="wk2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#2dd4bf" /></marker>
                          <marker id="wk1" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M10 0L0 5L10 10z" fill="#2dd4bf" /></marker>
                        </defs>
                      </svg>
                    );
                  })() : null}
                  {/* numery szyb (wycena) i podświetlenie szyby wskazanej na liście */}
                  {gotowyObraz && wEtap !== "kreator" && (zakladka === "wycena" || hover) ? panes.map((p, i) => {
                    const c = p.rogi.reduce((a, r) => [a[0] + r[0] / 4, a[1] + r[1] / 4], [0, 0]) as Pt;
                    return <span key={`nr-${p.id}`} className={`${s.paneBadge} ${hover === p.id ? s.paneBadgeOn : ""}`} style={cornerPos(c)}>{i + 1}</span>;
                  }) : null}
                  {hover && gotowyObraz && wEtap !== "kreator" ? (() => {
                    const p = panes.find((x) => x.id === hover);
                    const w = wrapRef.current;
                    if (!p || !w) return null;
                    const wr = w.getBoundingClientRect();
                    return (
                      <svg className={s.hlSvg} width={wr.width} height={wr.height} aria-hidden="true">
                        <polygon points={p.rogi.map((r) => { const q = cornerPos(r); return `${q.left},${q.top}`; }).join(" ")} />
                      </svg>
                    );
                  })() : null}
                  {przedPo !== null ? <div className={s.split} style={{ left: cornerPos([przedPo, 0]).left }}><span>przed | po</span></div> : null}
                  <p className={s.disclaimer}>
                    Wizualizacja poglądowa{wynik.uporzadkowane ? " · zdjęcie uporządkowane automatycznie" : ""}. Kolory, odcienie i wygląd gotowej plisy mogą się różnić (ekran, oświetlenie, zdjęcie). Wiążą parametry z konfiguratora i wzornik tkanin – <a href="/regulamin" target="_blank" rel="noopener">Regulamin §3 ust. 7</a>.
                  </p>
                  {!gotowyObraz ? <div className={s.loading}>Wczytujemy…</div> : null}
                </div>
              </div>

              {/* karta otwierana przyciskiem pod zdjęciem: na komputerze obok zdjęcia, na telefonie od dołu */}
              {zakladka ? (
                <div className={s.karta} role="dialog" aria-label="Ustawienia plis">
                  <div className={s.kartaHead}>
                    <b>{zakladka === "grupa" ? "Rodzaj tkaniny" : zakladka === "tkanina" ? "Kolor tkaniny" : zakladka === "listwy" ? "Kolor listew i montaż" : zakladka === "wycena" ? (wEtap === "kreator" ? "Twoje wymiary" : wEtap === "podsumowanie" ? "Twój zestaw" : "Wycena") : "Popraw obrys szyb"}</b>
                    <button type="button" aria-label="Zamknij" onClick={() => { setZakladka(null); setEdycja(false); setWEtap("wycena"); setInfo(""); }}>×</button>
                  </div>
                  <div className={s.kartaBody}>
                    {zakladka === "grupa" && katalog ? (
                      <div className={s.grupy}>
                        {katalog.kolekcje.map((k) => (
                          <button key={k.id} type="button" className={`${s.grupa} ${(kolekcja || katalog.kolekcje[0]?.id) === k.id ? s.on : ""}`}
                            onClick={() => {
                              setKolekcja(k.id);
                              const pierwsza = katalog.tkaniny.find((t) => t.kolekcja === k.id && t.id === aktywna?.tkanina) ? null : katalog.tkaniny.find((t) => t.kolekcja === k.id);
                              if (pierwsza) ustawTkanine(pierwsza.id);
                              setZakladka("tkanina");
                            }}>
                            <b>{k.nazwa}</b>
                            <small>{k.opis}</small>
                            <span className={s.grupaTag}>{k.zaciemnia ? "zaciemnia" : `przepuszcza ok. ${Math.round(k.transmisja * 100)} % światła`}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {zakladka === "tkanina" && katalog ? (
                      <>
                        {wynik.rekomendacje?.zestawy?.length ? (
                          <div className={s.reco}>
                            <p className={s.label}>Dobrane do Twojego wnętrza</p>
                            {wynik.rekomendacje.zestawy.map((z) => {
                              const t = katalog.tkaniny.find((x) => x.id === z.tkanina);
                              return (
                                <button key={z.tkanina} type="button" className={`${s.recoItem} ${aktywna?.tkanina === z.tkanina ? s.on : ""}`}
                                  onClick={() => { ustawTkanine(z.tkanina); if (t) setKolekcja(t.kolekcja); wizEvent("wiz_rekomendacja", token, { rodzaj: z.rodzaj, tkanina: z.tkanina }); }}>
                                  <span className={s.sw} style={{ backgroundImage: t ? `url(${mini(t.miniatura || t.tekstura, 128)})` : undefined, backgroundColor: t?.kolor }} />
                                  <span><b>{z.nazwa}</b><small>{z.uzasadnienie}</small></span>
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                        <p className={s.label}>{katalog.kolekcje.find((k) => k.id === (kolekcja || katalog.kolekcje[0]?.id))?.nazwa} · <button type="button" className={s.link} onClick={() => setZakladka("grupa")}>zmień rodzaj</button></p>
                        <div className={s.gridTk}>
                          {tkaninyKolekcji.map((t) => (
                            <div key={t.id} className={`${s.swItem} ${aktywna?.tkanina === t.id ? s.on : ""}`}>
                              <button type="button" title={t.nazwa} className={s.swPick} onClick={() => ustawTkanine(t.id)}>
                                <span className={s.swFoto} style={{ backgroundImage: `url(${mini(t.miniatura || t.tekstura, 256)})`, backgroundColor: t.kolor }} />
                                <small><b>{t.kod}</b>{t.nazwa.replace(t.kod, "").replace(/[()]/g, "").trim()}</small>
                              </button>
                              <button type="button" className={s.lupaBtn} aria-label={`Powiększ ${t.nazwa}`} onClick={() => { setLupa(t.id); setLupaZoom(null); wizEvent("wiz_lupa", token, { tkanina: t.id }); }}>⤢</button>
                            </div>
                          ))}
                        </div>
                        <p className={s.small}>To prawdziwe zdjęcia naszych tkanin. Kliknij ⤢, żeby obejrzeć z bliska splot i kolor.</p>
                      </>
                    ) : null}

                    {zakladka === "listwy" && katalog ? (
                      <>
                        {wynik.rekomendacje?.listwa ? <p className={s.hint}>Podpowiedź: <b>{wynik.rekomendacje.listwa.nazwa}</b> – {wynik.rekomendacje.listwa.uzasadnienie}</p> : null}
                        <div className={s.grid}>
                          {katalog.listwy.map((l) => (
                            <button key={l.id} type="button" className={`${s.swBtn} ${aktywna?.listwa === l.id ? s.on : ""}`} onClick={() => ustawListwe(l.id)}>
                              <span className={s.sw} style={l.zdjecie ? { backgroundImage: `url(${l.zdjecie})`, backgroundSize: "260% auto", backgroundPosition: "18% 50%", backgroundColor: l.kolor } : { background: l.kolor }} />
                              <small>{l.nazwa}</small>
                            </button>
                          ))}
                        </div>
                        <p className={s.label}>Montaż</p>
                        <div className={s.chips}>
                          <button type="button" className={montaz === "standard" ? s.chipOn : s.chip} onClick={() => setMontaz("standard")}>Przykręcany (standard)</button>
                          <button type="button" className={montaz === "bezinwazyjny" ? s.chipOn : s.chip} onClick={() => setMontaz("bezinwazyjny")}>Bez wiercenia</button>
                        </div>
                      </>
                    ) : null}

                    {zakladka === "wycena" ? (
                      <>
                        <WizWycena
                          szyby={wycenaSzyby}
                          etap={wEtap}
                          montaz={montaz}
                          pokoj={pokojTeraz}
                          wizToken={token || ""}
                          onBezMiarki={() => { setEmailOkno(true); wizEvent("wiz_produkt", token, { widok: "bez_miarki" }); }}
                          onDodano={(d) => {
                            writeSesja(readSesja().map((z) => (z.token === token ? { ...z, wKoszyku: true } : z)));
                            setZdjecia(readSesja());
                            setDodano(d);
                            setZakladka(null);
                            setWEtap("wycena");
                          }}
                          onEtap={setWEtap}
                          onHover={setHover}
                          onChange={(rows) => setPanes((prev) => prev.map((p) => {
                            const r = rows.find((x) => x.id === p.id);
                            return r ? { ...p, wpisSzerMm: r.szerMm ?? null, wpisWysMm: r.wysMm ?? null, zmierzone: r.zmierzone, pomin: r.pomin } : p;
                          }))}
                          onEvent={(n, d) => wizEvent(n, token, d)}
                        />
                      </>
                    ) : null}

                    {zakladka === "szyby" ? (
                      <>
                        <p className={s.hint}>Przeciągnij kółka dokładnie w rogi szyby (tam, gdzie szkło styka się z ramą). Belki przesuwasz palcem na zdjęciu.</p>
                        <div className={s.actions}>
                          <button type="button" className={s.secondary} onClick={dodajSzybe}>+ Dodaj szybę</button>
                          {panes.length ? <button type="button" className={s.secondary} onClick={usunSzybe}>Usuń zaznaczoną</button> : null}
                          <button type="button" className={s.primary} onClick={() => { setEdycja(false); setZakladka(null); setInfo(""); }}>Gotowe</button>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            {/* przyciski kart: co klient może zmienić */}
            <div className={s.resTools}>
              {katalog ? (
                <>
                  <button type="button" className={`${s.tool} ${zakladka === "grupa" ? s.toolOn : ""}`} onClick={() => otworzKarte("grupa")}>
                    <small>Rodzaj tkaniny</small><b>{katalog.kolekcje.find((k) => k.id === tkAkt?.kolekcja)?.nazwa || "Wybierz"}</b>
                  </button>
                  <button type="button" className={`${s.tool} ${zakladka === "tkanina" ? s.toolOn : ""} ${podp?.napis ? s.toolPodp : ""}`} onClick={() => otworzKarte("tkanina")}>
                    <small>Kolor tkaniny</small><b><i style={{ backgroundImage: tkAkt ? `url(${mini(tkAkt.miniatura || tkAkt.tekstura, 64)})` : undefined, backgroundColor: tkAkt?.kolor }} />{tkAkt?.kod || "Wybierz"}</b>
                  </button>
                  <button type="button" className={`${s.tool} ${zakladka === "listwy" ? s.toolOn : ""}`} onClick={() => otworzKarte("listwy")}>
                    <small>Listwy i montaż</small><b><i style={{ backgroundColor: liAkt?.kolor }} />{liAkt?.nazwa || "Wybierz"}</b>
                  </button>
                  <button type="button" className={`${s.tool} ${zakladka === "wycena" ? s.toolOn : ""}`} onClick={() => { otworzKarte("wycena"); setWEtap("wycena"); }}>
                    <small>Wycena ({panes.filter((p) => !p.pomin).length} {panes.length === 1 ? "szyba" : "szyb"})</small><b>{cenaZestawu ? `${cenaZestawu.szacunkowa ? "ok. " : ""}${Math.round(cenaZestawu.poRabacie).toLocaleString("pl-PL")} zł` : "…"}</b>
                  </button>
                </>
              ) : null}
            </div>

            <div className={s.resCta}>
              <div className={s.resCtaInfo}>
                {blad ? <p className={s.error}>{blad}</p> : null}
                {info && edycja ? <p className={s.info}>{info}</p> : null}
                {prog ? <p className={s.bundle}>{prog}</p> : null}
                {zachetaWym && !demo ? (
                  <button type="button" className={s.zachetaWym}
                    onClick={() => { setZachetaWym(false); setZakladka("wycena"); setEdycja(false); setWEtap("kreator"); wizEvent("wiz_produkt", token, { widok: "zacheta_wymiary" }); }}>
                    <span aria-hidden="true">📏</span>
                    <span><b>Masz miarkę? Wpisz wymiary okna</b><small>Teraz cena jest z wymiarów odczytanych ze zdjęcia. Po pomiarze zobaczysz cenę dokładnie dla Twojego okna – 2 minuty.</small></span>
                  </button>
                ) : null}
                <div className={s.resLinks}>
                  <label><input type="checkbox" checked={wszystkie} onChange={(e) => (e.target.checked ? naWszystkie() : setWszystkie(false))} /> Ta sama plisa na wszystkich szybach</label>
                  <button type="button" className={s.link} onClick={() => setPrzedPo((v) => (v === null ? (canvasRef.current?.width || 0) / 2 : null))}>{przedPo === null ? "Przed / po" : "Zamknij porównanie"}</button>
                  <button type="button" className={s.link} onClick={() => { otworzKarte("szyby"); setEdycja(true); }}>Popraw obrys</button>
                  <button type="button" className={s.link} onClick={pobierz}>Zapisz zdjęcie</button>
                  <button type="button" className={s.link} onClick={zamow} disabled={!panes.length}>Przenieś do konfiguratora</button>
                </div>
              </div>
              {demo ? (
                <button type="button" className={s.ctaBig} onClick={noweZdjecie}>
                  📷 Teraz zrób zdjęcie swojego okna
                  <small>za minutę zobaczysz plisę na swojej szybie i jej cenę</small>
                </button>
              ) : (
              <button type="button" className={s.ctaBig} disabled={!panes.length}
                onClick={() => { setZakladka("wycena"); setEdycja(false); setWEtap(cenaZestawu && !cenaZestawu.szacunkowa ? "podsumowanie" : "kreator"); wizEvent("wiz_produkt", token, { widok: "zestaw_cta" }); }}>
                Dodaj do koszyka{cenaZestawu ? ` · ${cenaZestawu.szacunkowa ? "ok. " : ""}${Math.round(cenaZestawu.poRabacie).toLocaleString("pl-PL")} zł` : ""}
                <small>{cenaZestawu && !cenaZestawu.szacunkowa ? "wymiary potwierdzone ✓" : "najpierw potwierdzisz wymiary – 2 min"}{cenaZestawu && cenaZestawu.poRabacie < cenaZestawu.suma ? ` · zamiast ${Math.round(cenaZestawu.suma).toLocaleString("pl-PL")} zł` : ""}</small>
              </button>
              )}
            </div>

            {emailOkno && !lead.wyslane ? (
              <div className={s.lupa} role="dialog" aria-label="Zapisz wizualizację">
                <form className={s.pokojBox} onSubmit={(e) => {
                  e.preventDefault();
                  if (!emailZgoda) {
                    setLead((l) => ({ ...l, blad: "Zaznacz akceptację regulaminu wizualizatora." }));
                    return;
                  }
                  void wyslijKontakt("gotowa").then(() => {
                    try { window.sessionStorage.setItem("keika_wiz_email", "1"); } catch { /* sesja */ }
                  });
                }}>
                  <span className={s.dodanoIco} aria-hidden="true">✓</span>
                  <b>{wEtap === "kreator" ? "Wyślij sobie tę wizualizację" : "Mamy to – Twoja wizualizacja jest gotowa!"}</b>
                  <small>{wEtap === "kreator"
                    ? "Zmierzysz okna, kiedy będzie Ci wygodnie – link do wizualizacji i wyceny przyjdzie na e-mail, razem z najlepszymi promocjami."
                    : "Podaj e-mail, a zapiszemy link do niej i wycenę – razem z najlepszymi promocjami. Wrócisz do niej, kiedy zechcesz."}</small>
                  <input type="email" inputMode="email" autoComplete="email" autoFocus placeholder="Twój adres e-mail" value={lead.email}
                    onChange={(e) => setLead((l) => ({ ...l, email: e.target.value, blad: "" }))} />
                  <label className={s.emailZgoda}>
                    <input type="checkbox" checked={emailZgoda} onChange={(e) => { setEmailZgoda(e.target.checked); setLead((l) => ({ ...l, blad: "" })); }} />
                    <span>Akceptuję <a href="/wizualizator/regulamin" target="_blank" rel="noopener">regulamin wizualizatora</a> – link do wizualizacji z wyceną oraz najlepsze oferty i promocje KEIKA e-mailem. Wypiszesz się jednym kliknięciem.</span>
                  </label>
                  {lead.blad ? <p className={s.error}>{lead.blad}</p> : null}
                  <button type="submit" className={s.ctaBig} disabled={!lead.email.trim()}>{wEtap === "kreator" ? "Wyślij mi link" : "Zapisz i pokaż wizualizację"}</button>
                  <button type="button" className={s.emailPomin} onClick={() => {
                    setEmailOkno(false);
                    try { window.sessionStorage.setItem("keika_wiz_email", "1"); } catch { /* sesja */ }
                    wizEvent("wiz_email_pomin", token, {});
                  }}>Nie chcę podawać e-maila</button>
                </form>
              </div>
            ) : null}

            {pokojDialog ? (
              <div className={s.lupa} role="dialog" aria-label="Nazwa pokoju" onClick={() => setPokojDialog(null)}>
                <form className={s.pokojBox} onClick={(e) => e.stopPropagation()}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const n = zapiszNazwe(pokojNazwa);
                    wizEvent("wiz_pokoj", token, { nazwa: n, kolejny: pokojDialog === "kolejny" });
                    const dalej = pokojDialog === "kolejny";
                    setPokojDialog(null);
                    if (dalej) {
                      setDodano(null);
                      noweZdjecie();
                    }
                  }}>
                  <b>{pokojDialog === "kolejny" ? "Nazwij ten pokój, zanim przejdziesz do kolejnego" : "Nazwa pokoju"}</b>
                  <small>{pokojDialog === "kolejny" ? "Dzięki temu w wycenie i w koszyku od razu zobaczysz, które plisy są do którego pokoju." : "Zobaczysz ją w wycenie i w koszyku."}</small>
                  <input autoFocus value={pokojNazwa} maxLength={40} placeholder="np. Salon, Sypialnia, Pokój Zosi" onChange={(e) => setPokojNazwa(e.target.value)} />
                  <div className={s.chips}>
                    {["Salon", "Sypialnia", "Kuchnia", "Pokój dziecięcy", "Gabinet", "Łazienka"].map((n) => (
                      <button key={n} type="button" className={pokojNazwa === n ? s.chipOn : s.chip} onClick={() => setPokojNazwa(n)}>{n}</button>
                    ))}
                  </div>
                  <div className={s.lupaAkcje}>
                    <button type="button" className={s.secondary} onClick={() => setPokojDialog(null)}>Anuluj</button>
                    <button type="submit" className={s.primary}>{pokojDialog === "kolejny" ? "Dalej: zdjęcie kolejnego pokoju →" : "Zapisz"}</button>
                  </div>
                </form>
              </div>
            ) : null}

            {dodano ? (
              <div className={s.lupa} role="dialog" aria-label="Dodano do koszyka" onClick={() => setDodano(null)}>
                <div className={s.pokojBox} onClick={(e) => e.stopPropagation()}>
                  <span className={s.dodanoIco} aria-hidden="true">✓</span>
                  <b>{pokojTeraz}: {dodano.sztuk} {dodano.sztuk === 1 ? "plisa" : dodano.sztuk < 5 ? "plisy" : "plis"} w koszyku</b>
                  <small>Masz jeszcze inne okna? Dodaj kolejny pokój – zrobisz to samo w minutę{prog ? `, a rabat CAŁY DOM liczy się od wszystkich plis w koszyku` : ""}.</small>
                  {prog ? <p className={s.bundle}>{prog}</p> : null}
                  <div className={s.lupaAkcje}>
                    {zdjecia.length < MAX_ZDJEC ? <button type="button" className={s.secondary} onClick={() => { setDodano(null); kolejnyPokoj(); }}>+ Dodaj kolejny pokój</button> : null}
                    <button type="button" className={s.ctaBig} onClick={() => { window.location.href = "/koszyk"; }}>Przejdź do koszyka</button>
                  </div>
                </div>
              </div>
            ) : null}

            {lupa && katalog ? (() => {
              const t = katalog.tkaniny.find((x) => x.id === lupa);
              if (!t) return null;
              const k = katalog.kolekcje.find((x) => x.id === t.kolekcja);
              return (
                <div className={s.lupa} role="dialog" aria-label={t.nazwa} onClick={() => setLupa(null)}>
                  <div className={s.lupaBox} onClick={(e) => e.stopPropagation()}>
                    <div className={s.lupaFoto}
                      onClick={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setLupaZoom((z) => (z ? null : { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }));
                      }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={mini(t.miniatura || t.tekstura, 1200)} alt={t.nazwa}
                        style={lupaZoom ? { transform: "scale(2.6)", transformOrigin: `${lupaZoom.x}% ${lupaZoom.y}%` } : undefined} />
                      <span className={s.lupaHint}>{lupaZoom ? "Kliknij, aby oddalić" : "Kliknij w zdjęcie, aby przybliżyć splot"}</span>
                    </div>
                    <div className={s.lupaInfo}>
                      <b>{t.nazwa}</b>
                      <small>{k?.nazwa}{k?.opis ? ` – ${k.opis}` : ""}</small>
                      <span className={s.grupaTag}>{k?.zaciemnia ? "zaciemnia" : `przepuszcza ok. ${Math.round((t.transmisja || k?.transmisja || 0) * 100)} % światła`}</span>
                      <div className={s.lupaAkcje}>
                        <button type="button" className={s.secondary} onClick={() => setLupa(null)}>Zamknij</button>
                        <button type="button" className={s.primary} onClick={() => { ustawTkanine(t.id); setKolekcja(t.kolekcja); setLupa(null); }}>
                          {aktywna?.tkanina === t.id ? "✓ Ta tkanina jest na oknie" : "Wybierz tę tkaninę"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })() : null}

            {zdjecia.length > 0 ? (
              <div className={s.photos}>
                {zdjecia.map((z) => (
                  <div key={z.token} className={s.pokoj}>
                    <button type="button" className={`${s.photo} ${z.token === token ? s.photoOn : ""}`} onClick={() => otworzZdjecie(z)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={z.miniatura} alt="" />
                      <span>{z.wKoszyku ? "✓ " : ""}{z.token === token ? panes.length : z.szyb}</span>
                    </button>
                    {z.token === token ? (
                      <button type="button" className={s.pokojNazwa} title="Zmień nazwę" onClick={() => { setPokojNazwa(z.nazwa || ""); setPokojDialog("nazwa"); }}>{z.nazwa || "Pokój"} ✎</button>
                    ) : <small className={s.pokojNazwa}>{z.nazwa || "Pokój"}</small>}
                  </div>
                ))}
                {zdjecia.length < MAX_ZDJEC ? (
                  <button type="button" className={s.photoAdd} onClick={kolejnyPokoj}>+ Dodaj kolejny pokój</button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
    {min ? (
      <button type="button" className={`${s.pill} ${faza === "gotowa" ? s.pillReady : ""}`} onClick={() => setMin(false)}>
        {status?.obraz?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={status.obraz.url} alt="" />
        ) : null}
        <span>
          <b>{faza === "gotowa" ? "Twoja wizualizacja jest gotowa" : faza === "popraw" ? "Sprawdź zdjęcie" : "Przygotowujemy wizualizację…"}</b>
          <small>{faza === "gotowa" ? "Zobacz plisę w swoim oknie →" : faza === "analiza" || faza === "sprawdzanie" ? `${postep} % · kliknij, aby wrócić` : "Kliknij, aby wrócić"}</small>
        </span>
      </button>
    ) : null}
    </>,
    document.body,
  );
}
