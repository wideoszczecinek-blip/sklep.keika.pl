"use client";

import type { KeyboardEvent } from "react";

export function numericEntryKey(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
  event.preventDefault();
  const input = event.currentTarget;
  const fields = Array.from(input.closest("[data-numeric-entry]")?.querySelectorAll<HTMLInputElement>("input[data-numeric-field]:not(:disabled)") || []);
  const next = input.enterKeyHint === "next" ? fields[fields.indexOf(input) + 1] : undefined;
  if (next) next.focus();
  else input.blur();
}

export function NumericDone() {
  return (
    <button type="button" className="numeric-entry-done" onPointerDown={(event) => event.preventDefault()} onClick={() => {
      if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur();
    }}>
      Gotowe <span aria-hidden="true">✓</span>
    </button>
  );
}
