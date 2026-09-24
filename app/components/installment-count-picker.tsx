"use client";

// Własna lista wyboru liczby rat - właściciel, 2026-09-24: "z małym
// swatchem do wyboru ilości (listą rozwijaną, ale jakąś ładną, nie jak
// windowsową)". Natywny <select> na Androidzie/Windowsie otwiera systemowy
// panel, który nie ma nic wspólnego ze stylem sklepu, więc rysujemy własny:
// pigułka z aktualnym wyborem i mała, zaokrąglona lista pod nią.
import { useEffect, useRef, useState } from "react";
import { INSTALLMENT_COUNTS } from "@/lib/installments";
import { useInstallmentCount } from "@/lib/installment-settings";

export default function InstallmentCountPicker({ className = "" }: { className?: string }) {
  const [count, setCount] = useInstallmentCount();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span className={`inst-picker ${open ? "is-open" : ""} ${className}`.trim()} ref={wrapRef}>
      <button
        type="button"
        className="inst-picker-button"
        aria-haspopup="listbox"
        aria-expanded={open ? "true" : "false"}
        aria-label={`Liczba rat: ${count}`}
        onClick={(event) => {
          // Kafelek metody płatności jest <label> - bez tego kliknięcie w
          // wybór rat przełączałoby też radio pod spodem.
          event.preventDefault();
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
      >
        {count}×
        <span className="inst-picker-chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <span className="inst-picker-list" role="listbox" aria-label="Liczba rat">
          {INSTALLMENT_COUNTS.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={option === count}
              className={`inst-picker-option ${option === count ? "is-active" : ""}`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setCount(option);
                setOpen(false);
              }}
            >
              {option} rat{option >= 2 && option <= 4 ? "y" : ""}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}
