"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function DeliveryFeedback({ checking, complete }: { checking: boolean; complete: boolean }) {
  const [visible, setVisible] = useState(complete);
  useEffect(() => {
    if (!complete) return;
    const timer = window.setTimeout(() => setVisible(false), 3600);
    return () => window.clearTimeout(timer);
  }, [complete]);
  if (!checking && !(complete && visible)) return null;
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className={checking ? "checkout-check-overlay" : "checkout-check-toast"}>
      <div className={`checkout-delivery-status${checking ? " is-checking" : ""}`} role="status">
        {checking ? "Sprawdzamy kompletność danych…" : "✓ Dane dostawy są kompletne"}
      </div>
    </div>,
    document.body,
  );
}
