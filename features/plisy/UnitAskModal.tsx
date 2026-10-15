"use client";

// Mini-okno z pytaniem o jednostkę wymiaru (właściciel, 2026-10-15: "to
// pytanie nie powinno być minimodalem?"). Wcześniej była to ramka pod
// polami - łatwo ją przeoczyć, a od odpowiedzi zależy cena i to, co
// wyprodukujemy. Okno pojawia się dopiero po wyjściu z pola, więc nie
// przerywa pisania. Esc i kliknięcie obok = "Nie, zostaw".
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function UnitAskModal({
  title,
  detail,
  yesLabel,
  noLabel = "Nie, zostaw",
  onYes,
  onNo,
}: {
  title: string;
  detail: string;
  yesLabel: string;
  noLabel?: string;
  onYes: () => void;
  onNo: () => void;
}) {
  const yesRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    yesRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onNo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNo]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="unit-ask-overlay" onClick={onNo}>
      <div
        className="unit-ask-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unitAskTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="unit-ask-icon" aria-hidden="true">
          📏
        </span>
        <h3 id="unitAskTitle">{title}</h3>
        <p>{detail}</p>
        <div className="unit-ask-actions">
          <button type="button" className="unit-ask-yes" ref={yesRef} onClick={onYes}>
            {yesLabel}
          </button>
          <button type="button" className="unit-ask-no" onClick={onNo}>
            {noLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
