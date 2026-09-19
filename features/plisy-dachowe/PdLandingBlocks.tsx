"use client";

// Landing blocks for plisy dachowe between the description and the
// configurator (same role as features/rolety-dachowe/RoofLandingBlocks.tsx):
// "Jak działa" tiles and the four hardware finishes. The fabrics guide is
// the window-plisa CollectionsPicker priced x1,25 (features/plisy/
// CollectionsPicker.tsx, multiplier props) and the library teaser is the
// roof-blind one (RoofLibraryTeaser) - both reused, not copied.
import { optimizeImageUrl } from "@/lib/image-optim";
import { PD_HOW_IT_WORKS, type PdHowItWorksTile } from "./landing-content";
import { PD_HARDWARE, PD_HARDWARE_SHEET_URL } from "./shared";

function TileIcon({ id }: { id: PdHowItWorksTile["id"] }) {
  const common = { width: 40, height: 40, viewBox: "0 0 40 40", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (id) {
    case "belki":
      return (
        <svg {...common}>
          <rect x="6" y="9" width="28" height="5" rx="1.5" />
          <rect x="6" y="24" width="28" height="5" rx="1.5" />
          <path d="M8 14l2 2-2 2 2 2-2 2 2 2M32 14l-2 2 2 2-2 2 2 2-2 2" opacity="0.5" />
          <path d="M14 16l2 2-2 2 2 2-2 2M26 16l-2 2 2 2-2 2 2 2" opacity="0.5" />
          <path d="M17 31h6M20 29v5" />
        </svg>
      );
    case "prowadnice":
      return (
        <svg {...common}>
          <path d="M8 5v30M32 5v30" strokeWidth="3" />
          <path d="M11 8h18v16H11z" opacity="0.5" />
          <path d="M11 24h18" />
          <path d="M11 12h18M11 16h18M11 20h18" opacity="0.35" />
        </svg>
      );
    case "model":
      return (
        <svg {...common}>
          <rect x="6" y="8" width="28" height="18" rx="2" />
          <path d="M10 13h12M10 17h16M10 21h8" opacity="0.6" />
          <circle cx="28" cy="29" r="5" />
          <path d="M31.5 32.5L36 37" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M6 30L20 8l14 22" />
          <path d="M14 30V18h12v12" opacity="0.6" />
          <circle cx="20" cy="24" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

export function PdHowItWorks() {
  return (
    <section className="rd-how pd-how" aria-label="Jak działa plisa dachowa">
      <h2 className="hero-product-section-title">Jak działa nasza plisa dachowa</h2>
      <p className="rd-how-lead">Plisa jak w oknie pionowym, ale prowadzona w bocznych prowadnicach — cztery elementy, które trzymają ją na skosie.</p>
      <div className="rd-how-grid">
        {PD_HOW_IT_WORKS.map((tile) => (
          <article key={tile.id} className="rd-how-tile">
            <span className="rd-how-icon">
              <TileIcon id={tile.id} />
            </span>
            <h3>{tile.title}</h3>
            <p>{tile.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function PdHardwareStrip({ onZoom }: { onZoom: (title: string, urls: string[], index: number) => void }) {
  return (
    <section className="rd-hardware pd-hardware" aria-label="Kolory osprzętu">
      <h2 className="hero-product-section-title">4 kolory osprzętu</h2>
      <p className="rd-how-lead">Belki i prowadnice zawsze w jednym kolorze — dobierz do ramy okna. Kliknij, żeby zobaczyć kolor na prawdziwym oknie.</p>
      <div className="rd-hardware-grid pd-hardware-strip">
        {PD_HARDWARE.map((option, index) => (
          <button key={option.id} type="button" className="rd-hardware-card" onClick={() => onZoom(`Osprzęt ${option.label}`, [option.imageUrl, PD_HARDWARE_SHEET_URL], 0)} title={option.note}>
            <span className="rd-hardware-image pd-hardware-image" style={{ backgroundImage: `url(${optimizeImageUrl(option.imageUrl, 360)})` }} />
            <span className="rd-hardware-label">
              <span className="hardware-dot" style={{ background: option.color }} />
              <strong>{option.label}</strong>
            </span>
            <span className="pd-hardware-note">{index === 0 ? "bez dopłaty" : option.note}</span>
          </button>
        ))}
      </div>
      <button type="button" className="rd-link pd-hardware-sheet-link" onClick={() => onZoom("Kolory osprzętu na oknie", [PD_HARDWARE_SHEET_URL], 0)}>
        Zobacz wszystkie cztery kolory na ramach okien →
      </button>
    </section>
  );
}
