"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Animacje „w momencie wyświetlenia” (właściciel 9.11.2026: „na mobile to ładuje się z opóźnieniem, jak baner CAŁY DOM –
 * musimy pokazać po wyświetleniu na ekranie – wszystkie animowane elementy muszą pojawiać się w momencie wyświetlenia”,
 * wzór: efekty przewijania na inpost.pl/VonHalsky).
 *
 * 1. Każda animacja CSS w sklepie, która startuje poza ekranem, czeka zatrzymana na początku i rusza dopiero,
 *    gdy jej element wjedzie na ekran (np. rozsuwanie banera CAŁY DOM, puls daty dostawy, kafle korzyści).
 *    Nie dotyczy elementów przypiętych (fixed/sticky: okna, wysuwane panele, pływające przyciski).
 * 2. Bloki treści stron produktów leżące poniżej pierwszego ekranu wjeżdżają przy przewijaniu (uniesienie + rozjaśnienie,
 *    kilka bloków naraz – po kolei). Konfigurator, koszyk i kasa bez tego efektu – tam nic nie może „uciekać” spod palca.
 * Przy „ogranicz ruch” w systemie nie robimy nic.
 */

const BEZ_WJAZDU = /^\/(koszyk|zamowienie|moje-zamowienia|panel-zamowienia|p\/|wizualizator|wizyta|regulamin|legal)/;
// czego nie dzielimy ani nie animujemy przy wjeździe
const POMIN = ".hero-product-config-panel, header, nav, footer, dialog, [role='dialog'], [aria-modal='true'], form";
// bloki z elementami przypiętymi w środku (pływające przyciski, lightboxy) – przesunięcie zepsułoby ich położenie
const PRZYPIETE_W_SRODKU = "[class*='fab'], [class*='sticky'], [class*='modal'], [class*='lightbox'], [class*='overlay'], [class*='plywaj']";

function przypiety(el: Element): boolean {
  for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) {
    const p = getComputedStyle(e).position;
    if (p === "fixed" || p === "sticky") return true;
  }
  return false;
}

export default function AnimacjeNaEkranie() {
  const sciezka = usePathname();

  // 1. animacje CSS ruszają po wejściu na ekran (cały sklep)
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || typeof document.getAnimations !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Każda animacja jest na chwilę wstrzymana, a o widoczności decyduje obserwator przeglądarki (pierwszy odczyt
    // przychodzi w następnej klatce). Pomiar w chwili startu mylił się, gdy układ strony jeszcze rósł (zdjęcia, dane koszyka).
    const czekajace = new Map<Element, Animation[]>();
    const io = new IntersectionObserver((wpisy) => {
      for (const w of wpisy) {
        const lista = czekajace.get(w.target) || [];
        if (!w.isIntersecting) {
          // poza ekranem: od początku, gdy klient do niej dojedzie
          lista.forEach((a) => {
            if (a.playState === "paused") a.currentTime = 0;
          });
          continue;
        }
        czekajace.delete(w.target);
        io.unobserve(w.target);
        lista.forEach((a) => {
          try {
            a.play();
          } catch {
            /* animacja usunięta w międzyczasie */
          }
        });
      }
    }, { rootMargin: "0px 0px -6% 0px" });
    const wstrzymaj = (el: Element, anims: Animation[]) => {
      if (!anims.length || przypiety(el)) return;
      anims.forEach((a) => a.pause());
      czekajace.set(el, [...(czekajace.get(el) || []), ...anims]);
      io.observe(el);
    };
    // animacje, które wystartowały przed uruchomieniem skryptu
    const wgCelu = new Map<Element, Animation[]>();
    document.getAnimations().forEach((a) => {
      if (typeof CSSAnimation === "undefined" || !(a instanceof CSSAnimation)) return;
      const cel = (a.effect as KeyframeEffect | null)?.target;
      if (!(cel instanceof Element) || a.playState !== "running") return;
      wgCelu.set(cel, [...(wgCelu.get(cel) || []), a]);
    });
    wgCelu.forEach((anims, el) => wstrzymaj(el, anims));
    // każda nowa animacja
    const start = (e: AnimationEvent) => {
      const el = e.target;
      if (!(el instanceof Element) || czekajace.has(el)) return;
      const anims = el.getAnimations().filter((a) => typeof CSSAnimation !== "undefined" && a instanceof CSSAnimation && a.animationName === e.animationName);
      wstrzymaj(el, anims);
    };
    document.addEventListener("animationstart", start, true);
    return () => {
      document.removeEventListener("animationstart", start, true);
      io.disconnect();
      czekajace.forEach((lista) => lista.forEach((a) => { try { a.play(); } catch { /* */ } }));
    };
  }, []);

  // 2. wjazd bloków treści przy przewijaniu (strony produktów i informacyjne)
  useEffect(() => {
    if (BEZ_WJAZDU.test(sciezka || "/")) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const html = document.documentElement;
    html.classList.add("sr-on");
    const odslon = (el: HTMLElement, opoznienie: number) => {
      el.style.transitionDelay = `${opoznienie}ms`;
      el.classList.add("sr-wjazd");
      el.classList.remove("sr-czeka");
      const koniec = () => {
        el.classList.remove("sr-wjazd");
        el.style.transitionDelay = "";
      };
      el.addEventListener("transitionend", koniec, { once: true });
      window.setTimeout(koniec, 1400 + opoznienie);
    };
    const io = new IntersectionObserver((wpisy) => {
      let i = 0;
      for (const w of wpisy) {
        if (!w.isIntersecting) continue;
        io.unobserve(w.target);
        odslon(w.target as HTMLElement, Math.min(i, 4) * 90);
        i += 1;
      }
    }, { rootMargin: "0px 0px -8% 0px" });
    const zbierz = (el: Element, glebokosc: number, out: HTMLElement[]) => {
      if (!(el instanceof HTMLElement) || el.dataset.sr || el.matches(POMIN)) return;
      const r = el.getBoundingClientRect();
      if (r.height < 24 || r.width < 40) return;
      // na telefonie stronę przewija sekcja hero-full (wysokość ekranu) – liczy się wysokość treści, nie ramki
      const wysokosc = Math.max(r.height, el.scrollHeight);
      if (wysokosc > window.innerHeight * 1.2 && glebokosc < 9 && el.children.length) {
        for (const d of Array.from(el.children)) zbierz(d, glebokosc + 1, out);
        return;
      }
      el.dataset.sr = "1";
      if (r.top <= window.innerHeight || el.querySelector(POMIN) || el.querySelector(PRZYPIETE_W_SRODKU) || przypiety(el)) return;
      out.push(el);
    };
    const skanuj = () => {
      const main = document.querySelector("main");
      if (!main) return;
      const nowe: HTMLElement[] = [];
      for (const d of Array.from(main.children)) zbierz(d, 0, nowe);
      nowe.forEach((el) => {
        el.classList.add("sr-czeka");
        io.observe(el);
      });
    };
    skanuj();
    // treść dociągana później (opinie, baner wizualizatora, galerie)
    let t = 0;
    const mo = new MutationObserver(() => {
      window.clearTimeout(t);
      t = window.setTimeout(skanuj, 500);
    });
    const main = document.querySelector("main");
    if (main) mo.observe(main, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io.disconnect();
      window.clearTimeout(t);
      document.querySelectorAll<HTMLElement>(".sr-czeka, .sr-wjazd").forEach((el) => {
        el.classList.remove("sr-czeka", "sr-wjazd");
        el.style.transitionDelay = "";
      });
      document.querySelectorAll<HTMLElement>("[data-sr]").forEach((el) => delete el.dataset.sr);
      html.classList.remove("sr-on");
    };
  }, [sciezka]);

  return null;
}
