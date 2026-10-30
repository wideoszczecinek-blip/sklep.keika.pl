"use client";

import { useEffect } from "react";

// Ochrona filmów (30.10.2026, właściciel: „filmiki zabezpieczone przed pobieraniem - nie rozdajemy ich, to nasza
// droga praca”). Każdy <video> na stronie: bez przycisku „Pobierz” i odtwarzania na innym urządzeniu, bez obrazu
// w obrazie, bez menu prawego przycisku i przeciągania. Bezpośredni adres pliku blokuje proxy.ts.
// Nie da się w 100 % zablokować nagrania ekranu - to utrudnia zwykłe „zapisz film jako”.
function protect(v: HTMLVideoElement) {
  if (v.dataset.guard === "1") return;
  v.dataset.guard = "1";
  v.setAttribute("controlsList", "nodownload noplaybackrate noremoteplayback");
  v.setAttribute("disablePictureInPicture", "");
  v.setAttribute("disableRemotePlayback", "");
  v.setAttribute("draggable", "false");
  v.disablePictureInPicture = true;
}

export default function VideoGuard() {
  useEffect(() => {
    document.querySelectorAll("video").forEach(protect);
    const mo = new MutationObserver((list) => {
      for (const m of list) {
        m.addedNodes.forEach((n) => {
          if (n instanceof HTMLVideoElement) protect(n);
          else if (n instanceof Element) n.querySelectorAll("video").forEach(protect);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    const block = (e: Event) => {
      if (e.target instanceof Element && e.target.closest("video")) e.preventDefault();
    };
    document.addEventListener("contextmenu", block, true);
    document.addEventListener("dragstart", block, true);
    return () => {
      mo.disconnect();
      document.removeEventListener("contextmenu", block, true);
      document.removeEventListener("dragstart", block, true);
    };
  }, []);
  return null;
}
