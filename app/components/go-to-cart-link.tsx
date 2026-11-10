"use client";

// "Przejdź do koszyka" w oknie sukcesu po dodaniu produktu.
//
// Zwykły <a href="/koszyk"> nie dawał żadnego znaku, że kliknięcie zadziałało:
// przy wolniejszym łączu koszyk otwiera się kilka sekund, a klient w tym
// czasie stuka w przycisk raz za razem (właściciel, 2026-11-10: "przejdź do
// koszyka nie działało, albo coś mi się przywiesiło"; w logach 10 kliknięć
// i 4 s czekania na odpowiedź serwera).
//
// Dlatego: 1) gdy tylko okno sukcesu się pokaże, dociągamy koszyk w tle,
// 2) po kliknięciu przycisk od razu zmienia napis i pokazuje kółko,
// 3) kolejne kliknięcia nic już nie robią (pierwsze przejście trwa dalej).
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";

const CART_HREF = "/koszyk";

export default function GoToCartLink({ className = "is-primary" }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  // Rozgrzewka: kod i dane koszyka czekają w pamięci, zanim klient kliknie.
  useEffect(() => {
    try {
      router.prefetch(CART_HREF);
    } catch {
      /* brak rozgrzewki niczego nie psuje */
    }
  }, [router]);

  useEffect(() => {
    const reset = () => {
      busyRef.current = false;
      setBusy(false);
    };
    // Powrót "wstecz" z koszyka (strona z pamięci przeglądarki) - przycisk
    // ma znów wyglądać normalnie.
    window.addEventListener("pageshow", reset);
    return () => {
      window.removeEventListener("pageshow", reset);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (busyRef.current) {
      // Przejście już trwa - kolejne stuknięcia nie zaczynają go od nowa.
      event.preventDefault();
      return;
    }
    busyRef.current = true;
    setBusy(true);
    // Gdyby przejście się nie udało (brak sieci), po chwili oddajemy przycisk.
    timerRef.current = window.setTimeout(() => {
      busyRef.current = false;
      setBusy(false);
    }, 12000);
  }

  return (
    <a
      href={CART_HREF}
      className={`${className}${busy ? " is-busy" : ""}`}
      aria-busy={busy || undefined}
      onClick={handleClick}
    >
      {busy ? (
        <>
          <span className="go-to-cart-spinner" aria-hidden="true" />
          Otwieram koszyk…
        </>
      ) : (
        "Przejdź do koszyka"
      )}
    </a>
  );
}
