"use client";

// Pasek zaufania w karcie płatności, tuż pod kwotą do zapłaty (właściciel,
// 2026-10-03): cztery obietnice, które mają uspokoić klienta w chwili, gdy
// sięga po kartę albo BLIK. Jedna linijka wysokości - hasła zmieniają się
// same, żeby nie zabierać miejsca metodom płatności. Rotacja staje, gdy
// klient najedzie na pasek, a czytnik ekranu dostaje wszystkie cztery naraz.
import { useEffect, useRef, useState, type ReactNode } from "react";

const ROTATE_MS = 3400;

type TrustItem = { key: string; strong: string; rest: string; icon: ReactNode };

const ITEMS: TrustItem[] = [
  {
    key: "return",
    strong: "30 dni",
    rest: "na zwrot zamówienia",
    icon: (
      <>
        <path d="M4 9h10.5a4.5 4.5 0 0 1 0 9H9" />
        <path d="M7.5 5.5 4 9l3.5 3.5" />
      </>
    ),
  },
  {
    key: "warranty",
    strong: "5 lat",
    rest: "gwarancji",
    icon: (
      <>
        <path d="M12 3 5 5.8v5.4c0 4.3 2.9 7.6 7 9.3 4.1-1.7 7-5 7-9.3V5.8L12 3Z" />
        <path d="m9 11.8 2.2 2.2 3.9-4.2" />
      </>
    ),
  },
  {
    key: "payments",
    strong: "Bezpieczne płatności",
    rest: "PayNow i Przelewy24",
    icon: (
      <>
        <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" />
        <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
        <path d="M12 14.3v2" />
      </>
    ),
  },
  {
    key: "shipping",
    strong: "Ubezpieczona",
    rest: "przesyłka kurierska",
    icon: (
      <>
        <path d="M3 6.5h10.5v10H3z" />
        <path d="M13.5 10h3.8l3.2 3.3v3.2h-7" />
        <circle cx="7.3" cy="17.3" r="1.8" />
        <circle cx="16.8" cy="17.3" r="1.8" />
      </>
    ),
  },
];

export default function PaymentTrustTicker() {
  const [active, setActive] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  // Karuzela rusza dopiero, gdy pasek jest na ekranie (właściciel,
  // 2026-10-03) - klient ma zobaczyć ją od pierwszego hasła, "30 dni na
  // zwrot", a nie trafić w środek obrotu, który kręcił się poza ekranem.
  const [visible, setVisible] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (entry) setVisible(entry.isIntersecting);
      },
      { threshold: 0.6 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const running = visible && !paused;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setActive((current) => {
        setPrevious(current);
        return (current + 1) % ITEMS.length;
      });
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [running]);

  return (
    <div
      ref={rootRef}
      className={`pay-trust${running ? "" : " is-paused"}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <ul className="pay-trust-sr">
        {ITEMS.map((item) => (
          <li key={item.key}>
            {item.strong} {item.rest}
          </li>
        ))}
      </ul>
      <div className="pay-trust-stage" aria-hidden="true">
        {ITEMS.map((item, index) => (
          <div
            key={item.key}
            className={`pay-trust-item${index === active ? " is-active" : index === previous ? " is-leaving" : ""}`}
          >
            <span className="pay-trust-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                {item.icon}
              </svg>
            </span>
            <span className="pay-trust-text">
              <strong>{item.strong}</strong> {item.rest}
            </span>
          </div>
        ))}
      </div>
      <div className="pay-trust-dots" aria-hidden="true">
        {ITEMS.map((item, index) => (
          <span key={item.key} className={`pay-trust-dot${index === active ? " is-active" : ""}`}>
            {/* key z indeksem aktywnego: pasek postępu startuje od zera przy każdej zmianie */}
            {index === active ? <i key={`${item.key}-${active}`} style={{ animationDuration: `${ROTATE_MS}ms` }} /> : null}
          </span>
        ))}
      </div>
    </div>
  );
}
