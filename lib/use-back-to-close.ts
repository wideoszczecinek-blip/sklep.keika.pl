"use client";

// Wstecz zamyka modal, nie wyrzuca ze strony (właściciel, 2026-09-24:
// "kliknąłem wyślij, kliknąłem na telefonie wstecz i wywaliło mnie na
// stronę produktu - byłem w koszyku").
//
// Jak to działa: otwarcie modalu dokłada wpis do historii przeglądarki pod
// TYM SAMYM adresem (więc router Next.js nie zmienia trasy), a systemowe
// "wstecz" ten wpis zdejmuje - łapiemy to w popstate i zamykamy modal.
// Zamknięcie modalu krzyżykiem/Escape/kliknięciem w tło samo sprząta swój
// wpis (history.back()), żeby historia nie puchła i żeby kolejne "wstecz"
// zachowywało się normalnie.
import { useEffect, useRef } from "react";

export function useBackToClose(open: boolean, onClose: () => void): void {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined") return;

    let ownsEntry = true;
    try {
      window.history.pushState({ ...(window.history.state || {}), keikaModal: true }, "", window.location.href);
    } catch {
      // Gdyby przeglądarka odmówiła (limit wpisów), modal nadal działa -
      // po prostu bez przechwytywania "wstecz".
      ownsEntry = false;
    }

    const onPop = () => {
      // Nasz wpis właśnie zszedł z historii - nie ma już czego sprzątać.
      ownsEntry = false;
      closeRef.current();
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      if (!ownsEntry) return;
      // Modal zamknięty z poziomu UI - usuwamy wpis, który dołożyliśmy.
      try {
        if ((window.history.state as { keikaModal?: boolean } | null)?.keikaModal) {
          window.history.back();
        }
      } catch {
        /* nic - historia zostanie, ale nic się nie psuje */
      }
    };
  }, [open]);
}
