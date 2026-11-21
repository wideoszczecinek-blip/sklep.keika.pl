"use client";

// „X osób konfiguruje teraz swoje zamówienie” na górze każdego konfiguratora (właściciel 21.11.2026: „brakuje mi
// baneru, który mieliśmy - X to liczba osób na stronie, wszystkich, wszędzie”). Ten sam prawdziwy licznik, który
// do 3.11 stał w bloku zaufania koszyka (app/components/cart-trust-block.tsx): CRM shop-public/online_count = osobne
// sesje sklepu z jakimkolwiek zdarzeniem w ostatnich 2 minutach, na wszystkich stronach, bez botów. Pokazywany od
// 2 osób, żeby „1 osoba” (sam klient) nie brzmiało pusto; odświeżany co minutę.
import { useEffect, useState } from "react";
import { CRM_PUBLIC_BASE } from "@/app/components/payment-methods";
import { crmGetJson } from "@/lib/crm-get";

const MIN_DO_POKAZANIA = 2;
const ODSWIEZ_MS = 60_000;

function osob(n: number): string {
  if (n === 1) return "osoba konfiguruje";
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 >= 2 && m10 <= 4 && !(m100 >= 12 && m100 <= 14)) return "osoby konfigurują";
  return "osób konfiguruje";
}

export default function LiveConfiguring() {
  const [online, setOnline] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      if (document.hidden) return;
      crmGetJson<{ ok?: boolean; online?: number }>(`${CRM_PUBLIC_BASE}/online_count`)
        .then((j) => {
          if (alive) setOnline(j && j.ok && typeof j.online === "number" ? j.online : null);
        })
        .catch(() => {
          if (alive) setOnline(null);
        });
    };
    load();
    const id = window.setInterval(load, ODSWIEZ_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  if (online === null || online < MIN_DO_POKAZANIA) return null;
  return (
    <p className="live-konfig" aria-live="polite">
      <span className="live-konfig-kropka" aria-hidden="true" />
      <span>
        <strong>{online}</strong> {osob(online)} teraz swoje zamówienie
      </span>
    </p>
  );
}
