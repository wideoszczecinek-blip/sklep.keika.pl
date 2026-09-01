"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  CONSENT_CHANGED_EVENT,
  consentDecided,
  initTracking,
  setConsent,
} from "@/lib/tracking";
import styles from "./consent-banner.module.css";

/**
 * Baner zgody na cookies analityczne (RODO). Pixel Meta / CAPI nie ładują się
 * ani nie wysyłają niczego dopóki użytkownik nie kliknie "Akceptuję".
 * Wybór ("Tylko niezbędne" też) jest zapamiętywany - baner wraca tylko gdy
 * zmieni się wersja treści zgody albo user wyczyści dane przeglądarki.
 *
 * Montowany raz w app/layout.tsx.
 */

function subscribe(callback: () => void): () => void {
  window.addEventListener(CONSENT_CHANGED_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CONSENT_CHANGED_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export default function ConsentBanner() {
  // Źródło prawdy = localStorage (poprzez lib/tracking). Server snapshot =
  // "decyzja podjęta" -> SSR nic nie renderuje; klient sprawdza realny stan.
  const decided = useSyncExternalStore(
    subscribe,
    () => consentDecided(),
    () => true,
  );

  useEffect(() => {
    if (decided && consentDecided()) {
      void initTracking();
    }
  }, [decided]);

  if (decided) return null;

  return (
    <div className={styles.wrap} role="dialog" aria-label="Zgoda na pliki cookie">
      <p className={styles.text}>
        Używamy plików cookie i podobnych technologii (m.in. Meta Pixel), aby
        analizować ruch i mierzyć skuteczność reklam. Możesz zaakceptować
        wszystkie albo korzystać tylko z niezbędnych.{" "}
        <a href="/regulamin" target="_blank" rel="noopener noreferrer">
          Więcej informacji
        </a>
        .
      </p>
      <div className={styles.row}>
        <button type="button" className={styles.btn} onClick={() => setConsent(false)}>
          Tylko niezbędne
        </button>
        <span className={styles.spacer} />
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={() => setConsent(true)}
        >
          Akceptuję
        </button>
      </div>
    </div>
  );
}
