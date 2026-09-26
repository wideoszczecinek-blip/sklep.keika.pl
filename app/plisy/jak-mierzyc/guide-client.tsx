"use client";

// Strona, na którą prowadzi "Wyślij instrukcję" z konfiguratora plis
// (features/plisy/MeasureShare.tsx). Ma być tym, czego ktoś potrzebuje
// stojąc przy oknie z telefonem: od razu animacja, bez ładowania całego
// landingu i konfiguratora.
import { useEffect, useState } from "react";
import Link from "next/link";
import PlisyMeasureGuide, { type MeasureMode } from "@/features/plisy/MeasureGuide";
import MeasureShare from "@/features/plisy/MeasureShare";
import { trackShopStep } from "@/lib/track-step";

export default function MeasureGuideClient() {
  // ?montaz=bezinwazyjny z wysłanego linku - czytamy po stronie klienta,
  // żeby strona została statyczna (żadnych searchParams w server
  // componencie).
  const [initialMode, setInitialMode] = useState<MeasureMode>("standard");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("montaz") || "";
    setInitialMode(/bezinwazyjn/i.test(raw) ? "bezinwazyjny" : "standard");
    setReady(true);
    trackShopStep("measure_guide_page", "open", { mount: /bezinwazyjn/i.test(raw) ? "bezinwazyjny" : "standard" });
  }, []);

  return (
    <main className="pl-guide-page">
      <div className="pl-guide-shell">
        <p className="pl-guide-eyebrow">KEIKA · plisy okienne</p>
        <h1>Jak zmierzyć okno pod plisę</h1>
        <p className="pl-guide-lead">
          Potrzebujesz tylko miarki zwijanej. Animacja niżej pokazuje krok po kroku, gdzie przyłożyć taśmę przy montażu
          przykręcanym i bezinwazyjnym — a potem wpisujesz dwie liczby w wycenie.
        </p>

        {ready ? (
          <div className="pl-guide-stage">
            <PlisyMeasureGuide initialMode={initialMode} startDelayMs={500} />
          </div>
        ) : (
          <div className="pl-guide-stage pl-guide-stage--placeholder" aria-hidden="true" />
        )}

        <MeasureShare source="guide_page" />

        <ul className="pl-guide-tips">
          <li>
            <strong>Mierz samo okno, nie firankę.</strong> Plisa pracuje na skrzydle, więc liczy się szyba ze
            szprosami/listwami, a nie otwór w murze.
          </li>
          <li>
            <strong>Zapisz w milimetrach.</strong> 1 cm = 10 mm — w wycenie przełączysz jednostkę, jak Ci wygodniej.
          </li>
          <li>
            <strong>Każde okno osobno.</strong> Nawet w tym samym mieszkaniu potrafią różnić się o kilka milimetrów.
          </li>
        </ul>

        <Link className="pl-guide-cta" href="/plisy" onClick={() => trackShopStep("measure_guide_page", "to_configurator")}>
          Mam wymiary — wyceń plisę →
        </Link>
      </div>
    </main>
  );
}
