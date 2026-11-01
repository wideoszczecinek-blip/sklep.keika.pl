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
  fetchKatalog, wizEvent, wizQrCreate, wizQrPoll, wizRender, wizRestart, wizSaveLayout, wizStart, wizStatus,
  type WizKatalog, type WizStatus, type WizUklad, type WizWynik, type WizSzyba,
} from "@/lib/wizualizator/api";
import { WIZ_PICK_EVENT, type WizPickDetail } from "@/lib/wizualizator/flag";
import { useBundleDiscountRules } from "@/lib/bundle-discount";
import s from "./WizModal.module.css";

type Faza = "start" | "wysylanie" | "analiza" | "gotowa" | "odrzucona" | "blad";
type Zakladka = "tkanina" | "listwy" | "szyby";
type PaneState = { id: string; rogi: Pt[]; gora: number; dol: number; tkanina: string; listwa: string; pewnosc: number; szerMm: number; wysMm: number; swiatlo: WizSzyba["swiatlo"] };
type Zdjecie = { token: string; miniatura: string; szyb: number };

const SESJA_KEY = "keika_wiz_sesja_v1";
const MAX_ZDJEC = 5;
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
    return Array.isArray(j) ? j.slice(0, MAX_ZDJEC) : [];
  } catch {
    return [];
  }
}

function writeSesja(z: Zdjecie[]): void {
  try {
    window.sessionStorage.setItem(SESJA_KEY, JSON.stringify(z.slice(0, MAX_ZDJEC)));
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
  const [zgoda, setZgoda] = useState(false);
  const [token, setToken] = useState<string | null>(startToken || null);
  const [status, setStatus] = useState<WizStatus | null>(null);
  const [katalog, setKatalog] = useState<WizKatalog | null>(null);
  const [wynik, setWynik] = useState<WizWynik | null>(null);
  const [panes, setPanes] = useState<PaneState[]>([]);
  const [sel, setSel] = useState(0);
  const [wszystkie, setWszystkie] = useState(true);
  const [montaz, setMontaz] = useState<"standard" | "bezinwazyjny">("standard");
  const [zakladka, setZakladka] = useState<Zakladka>("tkanina");
  const [kolekcja, setKolekcja] = useState("");
  const [przedPo, setPrzedPo] = useState<number | null>(null);
  const [edycja, setEdycja] = useState(false);
  const [qr, setQr] = useState<{ kod: string; url: string } | null>(null);
  const [zdjecia, setZdjecia] = useState<Zdjecie[]>([]);
  const [info, setInfo] = useState("");
  const [gotowyObraz, setGotowyObraz] = useState(false);
  const mobile = useMemo(isMobile, []);
  const bundle = useBundleDiscountRules();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const rendRef = useRef<WizRenderer | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const camRef = useRef<HTMLInputElement | null>(null);
  const dragRef = useRef<{ kind: "gora" | "dol" | "rog" | "split"; pane: number; corner?: number; off: number } | null>(null);
  const rafRef = useRef(0);
  const saveRef = useRef(0);
  const korektaRef = useRef(false);

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

  // Komputer: kod QR do telefonu (tylko z ekranu startowego, nie na stronie telefonu)
  useEffect(() => {
    if (mobile || qrKod || faza !== "start" || !zgoda || qr) return;
    void wizQrCreate(zrodlo).then((q) => {
      if (q) {
        setQr(q);
        wizEvent("wiz_qr", null, { zrodlo });
      }
    });
  }, [mobile, qrKod, faza, zgoda, qr, zrodlo]);

  // ...i czekanie, aż telefon wyśle zdjęcie
  useEffect(() => {
    if (!qr || faza !== "start") return;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      const r = await wizQrPoll(qr.kod);
      if (stop) return;
      if (r?.status === "jest" && r.token) {
        setToken(r.token);
        setFaza("analiza");
        return;
      }
      if (r?.status === "wygasl") {
        setQr(null);
        return;
      }
      window.setTimeout(tick, 3000);
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
    try {
      const r = await wizStart(file, { zrodlo, qr: qrKod });
      setToken(r.token);
      setFaza("analiza");
    } catch (e) {
      setBlad(e instanceof Error ? e.message : "Nie udało się wysłać zdjęcia.");
      setFaza("start");
    }
  }, [zgoda, zrodlo, qrKod]);

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
        if (st.status === "gotowa" || st.status === "recznie") {
          if (st.wynik) {
            setWynik(st.wynik);
            setFaza("gotowa");
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
    const zapis = status?.uklad;
    const rek = wynik.rekomendacje;
    const tk = startTkanina || rek?.zestawy?.[0]?.tkanina || DOMYSLNA_TKANINA;
    const li = startListwa || rek?.listwa?.id || DOMYSLNA_LISTWA;
    const szyby = (wynik.szyby || []).map<PaneState>((p) => {
      const z = zapis?.szyby?.[p.id];
      return {
        id: p.id, rogi: (z?.rogi as Pt[]) || p.rogi, gora: z?.gora ?? 0, dol: z?.dol ?? 0.68, tkanina: z?.tkanina || tk, listwa: z?.listwa || li,
        pewnosc: p.pewnosc, szerMm: (p.szer_cm || 0) * 10, wysMm: (p.wys_cm || 0) * 10, swiatlo: p.swiatlo,
      };
    });
    for (const d of zapis?.dodane || []) {
      szyby.push({ id: d.id, rogi: d.rogi, gora: 0, dol: 0.68, tkanina: tk, listwa: li, pewnosc: 100, szerMm: 0, wysMm: 0, swiatlo: null });
    }
    setPanes(szyby);
    setSel(0);
    const kol = katalog?.tkaniny.find((t) => t.id === tk)?.kolekcja;
    if (kol) setKolekcja(kol);
    if (wynik.status === "recznie" || szyby.some((p) => p.pewnosc < 70)) {
      setEdycja(true);
      setZakladka("szyby");
      setInfo(szyby.length ? "Sprawdź, czy obrys pasuje do szyby - przeciągnij kółka w rogi szyby." : "Nie znaleźliśmy szyby automatycznie. Dodaj ją i przeciągnij kółka w rogi szyby.");
    }
    const lista = readSesja().filter((z) => z.token !== token);
    lista.push({ token, miniatura: wynik.obraz?.url || "", szyb: szyby.length });
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

  // tekstury tkanin w użyciu
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
        const back = p.swiatlo?.za_szyba ?? 0.7;
        const wokol = p.swiatlo?.wokol ?? sw?.jasnosc_pokoju ?? 0.6;
        return {
          id: p.id, corners: p.rogi, top: p.gora, bottom: p.dol,
          fabric: { id: p.tkanina, color: hexToRgb(t?.kolor || "#EEEEEE"), transmission: t?.transmisja ?? 0.25, texture: null, honeycomb: Boolean(kol?.plaster_miodu) },
          rail, bracket: p.listwa === "bialy" ? [0.95, 0.95, 0.94] : rail, mount: montaz,
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

  // zapis układu (z opóźnieniem)
  useEffect(() => {
    if (!token || faza !== "gotowa" || !panes.length) return;
    window.clearTimeout(saveRef.current);
    saveRef.current = window.setTimeout(() => {
      const uklad: WizUklad = { szyby: {}, montaz, wszystkie, dodane: panes.filter((p) => p.id.startsWith("r")).map((p) => ({ id: p.id, rogi: p.rogi })) };
      for (const p of panes) uklad.szyby[p.id] = { tkanina: p.tkanina, listwa: p.listwa, gora: Math.round(p.gora * 1000) / 1000, dol: Math.round(p.dol * 1000) / 1000, rogi: p.rogi };
      wizSaveLayout(token, uklad, korektaRef.current);
    }, 1200);
  }, [panes, montaz, wszystkie, token, faza]);

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
    if (d && (d.kind === "gora" || d.kind === "dol")) wizEvent("wiz_belka", token, { belka: d.kind });
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
    const p = panes[sel] || panes[0];
    if (!p || !katalog) return;
    const t = katalog.tkaniny.find((x) => x.id === p.tkanina);
    const pick: WizPickDetail = { hardwareId: p.listwa, fabricGroupId: t?.kolekcja, fabricId: p.tkanina };
    try {
      const prev = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "{}");
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...prev, ...pick, savedAt: Date.now() }));
    } catch {
      /* szkic to wygoda */
    }
    wizEvent("wiz_do_konfiguratora", token, { tkanina: p.tkanina, listwa: p.listwa, szyb_w_domu: zdjecia.reduce((a, z) => a + z.szyb, 0) });
    const panel = document.querySelector(".hero-product-config-panel");
    if (panel && window.location.pathname.startsWith("/plisy")) {
      window.dispatchEvent(new CustomEvent<WizPickDetail>(WIZ_PICK_EVENT, { detail: pick }));
      onClose();
      window.setTimeout(() => panel.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    } else {
      window.location.href = "/plisy?wiz=1#konfigurator";
    }
  };

  const pokazDokladnie = async () => {
    if (!token) return;
    const uklad: WizUklad = { szyby: {} };
    for (const p of panes) uklad.szyby[p.id] = { tkanina: p.tkanina, listwa: p.listwa, gora: p.gora, dol: p.dol, rogi: p.rogi };
    const r = await wizRender(token, uklad);
    setInfo(r.komunikat || "Dokładny render AI uruchomimy wkrótce.");
  };

  const pobierz = () => {
    const c = canvasRef.current;
    if (!c || !wynik) return;
    draw();
    window.setTimeout(() => {
      const out = document.createElement("canvas");
      out.width = c.width;
      out.height = c.height;
      const ctx = out.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(c, 0, 0);
      const fs = Math.max(14, Math.round(c.width / 70));
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, c.height - fs * 2.2, c.width, fs * 2.2);
      ctx.fillStyle = "#fff";
      ctx.font = `${fs}px system-ui, sans-serif`;
      ctx.fillText("Wizualizacja poglądowa · KEIKA · sklep.keika.pl", fs * 0.8, c.height - fs * 0.75);
      const a = document.createElement("a");
      a.href = out.toDataURL("image/jpeg", 0.9);
      a.download = "plisa-w-moim-oknie.jpg";
      a.click();
    }, 60);
  };

  const noweZdjecie = () => {
    wizEvent("wiz_kolejne_okno", token, { zdjec: zdjecia.length });
    setToken(null);
    setWynik(null);
    setStatus(null);
    setPanes([]);
    setEdycja(false);
    setPrzedPo(null);
    setInfo("");
    setBlad("");
    setQr(null);
    setFaza("start");
  };

  const otworzZdjecie = (z: Zdjecie) => {
    if (z.token === token) return;
    setWynik(null);
    setPanes([]);
    setToken(z.token);
    setFaza("analiza");
  };

  // ------------------------------------------------------------ widok
  const aktywna = panes[sel];
  const tkAkt = katalog?.tkaniny.find((t) => t.id === aktywna?.tkanina);
  const szybWDomu = zdjecia.reduce((a, z) => a + (z.token === token ? panes.length : z.szyb), 0);
  const prog = useMemo(() => {
    const r = bundle.plisy;
    if (!r || !r.tiers?.length || szybWDomu < 1) return "";
    const tier = [...r.tiers].sort((a, b) => b.fromQty - a.fromQty).find((t) => szybWDomu >= t.fromQty);
    const next = [...r.tiers].sort((a, b) => a.fromQty - b.fromQty).find((t) => t.fromQty > szybWDomu);
    if (tier) return `${szybWDomu} ${szybWDomu === 1 ? "szyba" : szybWDomu < 5 ? "szyby" : "szyb"} = ${szybWDomu} plis${szybWDomu < 5 ? "y" : ""} → −${tier.percent} % na całe zamówienie (${r.label || "rabat ilościowy"}).`;
    if (next) return `Przy ${next.fromQty} plisach w koszyku −${next.percent} % na całe zamówienie.`;
    return "";
  }, [bundle, szybWDomu]);

  const tkaninyKolekcji = katalog?.tkaniny.filter((t) => t.kolekcja === (kolekcja || katalog.kolekcje[0]?.id)) || [];

  // Portal do <body>: przyciski siedzą w sekcjach z transform/overflow, które przycinałyby position: fixed.
  return createPortal(
    <div className={s.overlay} role="dialog" aria-modal="true" aria-label="Zobacz plisę w swoim oknie">
      <div className={`${s.modal} ${faza === "gotowa" ? s.modalWide : ""}`}>
        <button type="button" className={s.close} onClick={() => { wizEvent("wiz_zamkniete", token, { faza }); onClose(); }} aria-label="Zamknij">×</button>

        {faza === "start" || faza === "wysylanie" ? (
          <div className={s.startBox}>
            <h2 className={s.title}>Zobacz plisę w swoim oknie</h2>
            <p className={s.lead}>Zrób zdjęcie swojego okna – w kilkadziesiąt sekund pokażemy na nim plisę. Potem zmieniasz tkaninę, kolor listew i przesuwasz belki.</p>
            <ul className={s.tips}>
              <li><b>Stań naprzeciwko okna</b> – cała szyba w kadrze.</li>
              <li><b>Odsłoń szybę</b> – firanka odsunięta, światło dzienne.</li>
              <li><b>Bez ludzi w kadrze</b> – takich zdjęć nie przetwarzamy.</li>
            </ul>
            <label className={s.consent}>
              <input type="checkbox" checked={zgoda} onChange={(e) => setZgoda(e.target.checked)} />
              <span>
                Zgadzam się na przetworzenie zdjęcia przez KEIKA w celu przygotowania wizualizacji. Zdjęcie przechowujemy 30 dni, potem je usuwamy;
                nie używamy go w reklamach. Usunięcia możesz zażądać wcześniej (czat lub biuro@keika.pl).
              </span>
            </label>
            {blad ? <p className={s.error}>{blad}</p> : null}
            {faza === "wysylanie" ? (
              <p className={s.busy}>Wysyłamy zdjęcie…</p>
            ) : mobile || qrKod ? (
              <div className={s.actions}>
                <button type="button" className={s.primary} disabled={!zgoda} onClick={() => camRef.current?.click()}>Zrób zdjęcie okna</button>
                <button type="button" className={s.secondary} disabled={!zgoda} onClick={() => fileRef.current?.click()}>Wybierz z galerii</button>
              </div>
            ) : (
              <div className={s.desktopPick}>
                <div className={s.qrBox}>
                  {!zgoda ? (
                    <p className={s.qrHint}>Zaznacz zgodę, a pokażemy kod QR.</p>
                  ) : qr ? (
                    <>
                      <QrKod url={qr.url} />
                      <p className={s.qrHint}>Zeskanuj telefonem i zrób zdjęcie – wizualizacja pojawi się tutaj.</p>
                    </>
                  ) : (
                    <p className={s.qrHint}>Przygotowujemy kod…</p>
                  )}
                </div>
                <div className={s.orBox}>
                  <span>albo</span>
                  <button type="button" className={s.secondary} disabled={!zgoda} onClick={() => fileRef.current?.click()}>Wybierz zdjęcie z komputera</button>
                </div>
              </div>
            )}
            <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void wyslij(e.target.files?.[0])} />
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void wyslij(e.target.files?.[0])} />
          </div>
        ) : null}

        {faza === "analiza" ? (
          <div className={s.progressBox}>
            {status?.obraz?.url ? (
              <div className={s.scanWrap}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={status.obraz.url} alt="" className={s.scanImg} />
                <div className={s.scanLine} />
              </div>
            ) : null}
            <p className={s.stage}>{status?.etap_opis || "Analizujemy zdjęcie…"}</p>
            <p className={s.sub}>Zwykle trwa to 30–60 sekund. Możesz zostawić to okno otwarte.</p>
            {qrKod ? <p className={s.sub}>Wizualizacja pojawi się też na komputerze.</p> : null}
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
          <div className={s.result}>
            <div className={s.stageCol}>
              <div className={s.canvasWrap} ref={wrapRef}>
                <canvas
                  ref={canvasRef}
                  className={s.canvas}
                  onPointerDown={onDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onUp}
                />
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
                {przedPo !== null ? <div className={s.split} style={{ left: cornerPos([przedPo, 0]).left }}><span>przed | po</span></div> : null}
                <p className={s.disclaimer}>Wizualizacja poglądowa – kolory, faktura i proporcje mogą się różnić. Wymiary mierzysz sam.</p>
                {!gotowyObraz ? <div className={s.loading}>Wczytujemy…</div> : null}
              </div>
              {zdjecia.length > 0 ? (
                <div className={s.photos}>
                  {zdjecia.map((z) => (
                    <button key={z.token} type="button" className={`${s.photo} ${z.token === token ? s.photoOn : ""}`} onClick={() => otworzZdjecie(z)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={z.miniatura} alt="" />
                      <span>{z.token === token ? panes.length : z.szyb}</span>
                    </button>
                  ))}
                  {zdjecia.length < MAX_ZDJEC ? (
                    <button type="button" className={s.photoAdd} onClick={noweZdjecie}>+ Dodaj kolejne okno</button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className={s.panel}>
              {blad ? <p className={s.error}>{blad}</p> : null}
              {info ? <p className={s.info}>{info}</p> : null}
              {wynik.scena?.uwagi_dla_klienta ? <p className={s.hint}>{wynik.scena.uwagi_dla_klienta}</p> : null}
              <div className={s.tabs} role="tablist">
                {(["tkanina", "listwy", "szyby"] as Zakladka[]).map((z) => (
                  <button key={z} type="button" role="tab" aria-selected={zakladka === z} className={zakladka === z ? s.tabOn : s.tab}
                    onClick={() => { setZakladka(z); setEdycja(z === "szyby"); }}>
                    {z === "tkanina" ? "Tkanina" : z === "listwy" ? "Listwy" : `Szyby (${panes.length})`}
                  </button>
                ))}
              </div>

              {zakladka === "tkanina" && katalog ? (
                <div className={s.tabBody}>
                  {wynik.rekomendacje?.zestawy?.length ? (
                    <div className={s.reco}>
                      <p className={s.label}>Dobrane do Twojego wnętrza</p>
                      {wynik.rekomendacje.zestawy.map((z) => {
                        const t = katalog.tkaniny.find((x) => x.id === z.tkanina);
                        return (
                          <button key={z.tkanina} type="button" className={`${s.recoItem} ${aktywna?.tkanina === z.tkanina ? s.on : ""}`}
                            onClick={() => { ustawTkanine(z.tkanina); if (t) setKolekcja(t.kolekcja); wizEvent("wiz_rekomendacja", token, { rodzaj: z.rodzaj, tkanina: z.tkanina }); }}>
                            <span className={s.sw} style={{ backgroundImage: t ? `url(${t.tekstura})` : undefined, backgroundColor: t?.kolor }} />
                            <span><b>{z.nazwa}</b><small>{z.uzasadnienie}</small></span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  <div className={s.chips}>
                    {katalog.kolekcje.map((k) => (
                      <button key={k.id} type="button" className={(kolekcja || katalog.kolekcje[0]?.id) === k.id ? s.chipOn : s.chip} onClick={() => setKolekcja(k.id)}>
                        {k.nazwa}
                      </button>
                    ))}
                  </div>
                  <div className={s.grid}>
                    {tkaninyKolekcji.map((t) => (
                      <button key={t.id} type="button" title={t.nazwa} className={`${s.swBtn} ${aktywna?.tkanina === t.id ? s.on : ""}`} onClick={() => ustawTkanine(t.id)}>
                        <span className={s.sw} style={{ backgroundImage: `url(${t.tekstura})`, backgroundColor: t.kolor }} />
                        <small>{t.kod}</small>
                      </button>
                    ))}
                  </div>
                  {tkAkt ? <p className={s.current}>Na szybie: <b>{tkAkt.nazwa}</b> · {katalog.kolekcje.find((k) => k.id === tkAkt.kolekcja)?.nazwa}</p> : null}
                </div>
              ) : null}

              {zakladka === "listwy" && katalog ? (
                <div className={s.tabBody}>
                  {wynik.rekomendacje?.listwa ? <p className={s.hint}>Podpowiedź: <b>{wynik.rekomendacje.listwa.nazwa}</b> – {wynik.rekomendacje.listwa.uzasadnienie}</p> : null}
                  <div className={s.grid}>
                    {katalog.listwy.map((l) => (
                      <button key={l.id} type="button" className={`${s.swBtn} ${aktywna?.listwa === l.id ? s.on : ""}`} onClick={() => ustawListwe(l.id)}>
                        <span className={s.sw} style={{ background: l.kolor }} />
                        <small>{l.nazwa}</small>
                      </button>
                    ))}
                  </div>
                  <p className={s.label}>Montaż</p>
                  <div className={s.chips}>
                    <button type="button" className={montaz === "standard" ? s.chipOn : s.chip} onClick={() => setMontaz("standard")}>Standard (przykręcany)</button>
                    <button type="button" className={montaz === "bezinwazyjny" ? s.chipOn : s.chip} onClick={() => setMontaz("bezinwazyjny")}>Bezinwazyjny</button>
                  </div>
                </div>
              ) : null}

              {zakladka === "szyby" ? (
                <div className={s.tabBody}>
                  <p className={s.hint}>Przeciągnij kółka dokładnie w rogi szyby (tam, gdzie szkło styka się z ramą). Belki przesuwasz palcem na zdjęciu.</p>
                  <div className={s.actions}>
                    <button type="button" className={s.secondary} onClick={dodajSzybe}>+ Dodaj szybę</button>
                    {panes.length ? <button type="button" className={s.secondary} onClick={usunSzybe}>Usuń zaznaczoną</button> : null}
                    <button type="button" className={s.primary} onClick={() => { setEdycja(false); setZakladka("tkanina"); setInfo(""); }}>Gotowe</button>
                  </div>
                </div>
              ) : null}

              <div className={s.toggles}>
                <label><input type="checkbox" checked={wszystkie} onChange={(e) => (e.target.checked ? naWszystkie() : setWszystkie(false))} /> Ta sama plisa na wszystkich szybach</label>
                <button type="button" className={s.link} onClick={() => setPrzedPo((v) => (v === null ? (canvasRef.current?.width || 0) / 2 : null))}>
                  {przedPo === null ? "Porównaj przed / po" : "Zamknij porównanie"}
                </button>
              </div>
              {prog ? <p className={s.bundle}>{prog}</p> : null}
              <div className={s.cta}>
                <button type="button" className={s.primary} onClick={zamow} disabled={!panes.length}>Zamów tę plisę</button>
                <div className={s.ctaRow}>
                  <button type="button" className={s.secondary} onClick={() => void pokazDokladnie()}>Pokaż dokładnie (AI)</button>
                  <button type="button" className={s.secondary} onClick={pobierz}>Zapisz zdjęcie</button>
                </div>
                <p className={s.small}>Wymiary podajesz w konfiguratorze – zmierz szybę według naszej instrukcji. Cena liczy się w konfiguratorze.</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
