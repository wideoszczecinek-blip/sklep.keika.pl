"use client";

// Animated measuring guide for plisy - the "Pomiar" instruction step and the
// configurator's "Jak mierzyć?" popup share it.
//
// Two mounting systems, two different measurements (owner, 2026-09-16):
//
//   STANDARD (wkręcany przy szybie, profil siedzi między listwami
//   przyszybowymi): width AND height from the middle of one seal to the
//   middle of the opposite seal. Competitors phrase the same thing as "szyba
//   z uszczelkami minus 2-4 mm"; measuring seal-centre to seal-centre gives
//   that clearance without any subtraction, so that is what we show.
//
//   BEZINWAZYJNY (uchwyty na skrzydło): width from the line where the
//   glazing bead meets the sash frame ("kreseczka") on one side to the same
//   line on the other, i.e. glass + both beads; height of the whole sash.
//
// The drawing is a front view of one sash at a scale where the bead (26 px)
// and seal (10 px) are legible, plus a magnifier over the top-left corner so
// the exact target - seal centre or bead/frame line - is unmistakable. A
// yellow tape extends across the glass for width, then down for height;
// labels pop when each tape lands. Everything is CSS-timed; switching mode
// or hitting "Odtwórz" remounts the SVG to restart.
import { useId, useState } from "react";

type Mode = "standard" | "bezinwazyjny";

/* Front-view geometry, viewBox 1000 x 800. */
const SASH = { x: 110, y: 40, w: 780, h: 640 };
const FRAME = 64; // sash frame thickness -> bead/frame line ("kreseczka")
const BEAD = 26; // glazing bead
const SEAL = 10; // rubber seal between bead and glass

const K = { x0: SASH.x + FRAME, x1: SASH.x + SASH.w - FRAME, y0: SASH.y + FRAME, y1: SASH.y + SASH.h - FRAME }; // kreseczka
const B = { x0: K.x0 + BEAD, x1: K.x1 - BEAD, y0: K.y0 + BEAD, y1: K.y1 - BEAD }; // bead inner edge = seal outer edge
const G = { x0: B.x0 + SEAL, x1: B.x1 - SEAL, y0: B.y0 + SEAL, y1: B.y1 - SEAL }; // glass
const M = { x0: B.x0 + SEAL / 2, x1: B.x1 - SEAL / 2, y0: B.y0 + SEAL / 2, y1: B.y1 - SEAL / 2 }; // seal centre

const TAPE_W_Y = 265;
const TAPE_H_X = 240;
const TAPE_T = 22;

/* Magnifier over the top-left corner. */
const LUPA = { cx: 700, cy: 500, r: 150, zoom: 2.8 };
/* The target sits up-left of the magnifier centre so bead, seal and a slice
 * of glass all fit inside the circle in both modes. */
const LUPA_OFF = -36;
/** Label box width from text length - the bezinwazyjny captions are long. */
const boxW = (text: string, min: number) => Math.max(min, Math.round(text.length * 7.4) + 44);

const MODES: Record<
  Mode,
  {
    label: string;
    sub: string;
    width: { from: number; to: number; text: string };
    height: { from: number; to: number; text: string };
    target: string;
    note: string;
  }
> = {
  standard: {
    label: "STANDARD — wkręcany przy szybie",
    sub: "Profil plisy siedzi między listwami przyszybowymi",
    width: { from: M.x0, to: M.x1, text: "od połowy uszczelki do połowy uszczelki" },
    height: { from: M.y0, to: M.y1, text: "od połowy uszczelki do połowy uszczelki" },
    target: "połowa uszczelki",
    note: "Nic nie odejmuj. Połowa uszczelki z każdej strony daje dokładnie tyle luzu, ile potrzebuje profil, żeby wejść między listwy.",
  },
  bezinwazyjny: {
    label: "BEZINWAZYJNY — uchwyty na skrzydło",
    sub: "Plisa zasłania szybę razem z listwami przyszybowymi",
    width: { from: K.x0, to: K.x1, text: "od kreseczki do kreseczki — szyba razem z listwami" },
    height: { from: SASH.y, to: SASH.y + SASH.h, text: "całe skrzydło, od góry do dołu ramy" },
    target: "kreseczka — styk listwy z ramą",
    note: "Kreseczka to cienka linia, w której listwa przyszybowa łączy się z ramą skrzydła. Nic nie odejmuj; zostaw co najmniej 5 mm od klamki.",
  },
};

function Tape({ x, y, len, vertical }: { x: number; y: number; len: number; vertical?: boolean }) {
  const ticks: React.ReactNode[] = [];
  for (let i = 0; i <= len; i += 10) {
    const big = i % 50 === 0;
    ticks.push(<line key={i} x1={i} y1={0} x2={i} y2={big ? 10 : 6} stroke="#1f2937" strokeWidth={big ? 1.6 : 1} />);
  }
  return (
    <g transform={`translate(${x} ${y})${vertical ? " rotate(90)" : ""}`} className="plmg-tape">
      <g className="plmg-tape-body">
        <rect x={0} y={-TAPE_T / 2} width={len} height={TAPE_T} rx={4} fill="#fbbf24" stroke="#b45309" strokeWidth="1.2" />
        <g transform={`translate(0 ${-TAPE_T / 2 + 1})`}>{ticks}</g>
        {/* metal hook at the start */}
        <rect x={-6} y={-TAPE_T / 2 - 3} width={7} height={TAPE_T + 6} rx={1.5} fill="#9ca3af" stroke="#4b5563" strokeWidth="1" />
      </g>
    </g>
  );
}

function Marker({ x, y, delay }: { x: number; y: number; delay: string }) {
  return (
    <g className="plmg-marker" style={{ animationDelay: delay }}>
      <circle cx={x} cy={y} r="14" fill="none" stroke="#ef4444" strokeWidth="2.5" className="plmg-marker-ring" style={{ animationDelay: delay }} />
      <circle cx={x} cy={y} r="4.5" fill="#ef4444" />
    </g>
  );
}

export default function PlisyMeasureGuide() {
  // Unique SVG ids: this guide renders twice on the landing (Instrukcje list
  // + the "Jak mierzyć?" modal). With shared ids the modal resolved its
  // clipPath to the hidden copy and the magnifier spilled over the stage.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ID = { clip: `plmgClip${uid}`, shadow: `plmgShadow${uid}`, sheen: `plmgSheen${uid}` };
  const [mode, setMode] = useState<Mode>("standard");
  const [run, setRun] = useState(0);
  const m = MODES[mode];
  const wLen = m.width.to - m.width.from;
  const hLen = m.height.to - m.height.from;

  // Where the magnifier "looks": the top-left measurement corner for this mode.
  const target = mode === "standard" ? { x: M.x0, y: M.y0 } : { x: K.x0, y: K.y0 };

  // Inside the magnifier: the corner drawn at LUPA.zoom around `target`.
  const z = LUPA.zoom;
  const lx = (x: number) => LUPA.cx + LUPA_OFF + (x - target.x) * z;
  const ly = (y: number) => LUPA.cy + LUPA_OFF + (y - target.y) * z;
  const TX = LUPA.cx + LUPA_OFF;
  const TY = LUPA.cy + LUPA_OFF;
  const wBox = boxW(m.width.text, 300);
  const hBox = boxW(m.height.text, 280);
  const tBox = Math.round(("MIERZ TU: " + m.target).length * 9.2) + 40;

  return (
    <div className="plmg">
      <div className="plmg-modes" role="tablist" aria-label="Sposób montażu">
        {(Object.keys(MODES) as Mode[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            className={`plmg-mode ${mode === key ? "is-active" : ""}`}
            onClick={() => {
              setMode(key);
              setRun((r) => r + 1);
            }}
          >
            <strong>{MODES[key].label.split(" — ")[0]}</strong>
            <span>{MODES[key].label.split(" — ")[1]}</span>
          </button>
        ))}
      </div>

      <div className="plmg-stage">
        <svg key={`${mode}-${run}`} viewBox="0 0 1000 800" className="plmg-svg" role="img" aria-label={`Pomiar plisy, montaż ${m.label}: szerokość ${m.width.text}, wysokość ${m.height.text}`}>
          <defs>
            <clipPath id={ID.clip}>
              <circle cx={LUPA.cx} cy={LUPA.cy} r={LUPA.r} />
            </clipPath>
            <filter id={ID.shadow} x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#0b1a2b" floodOpacity="0.28" />
            </filter>
          </defs>

          {/* --- sash --- */}
          <g className="plmg-sash">
            <rect x={SASH.x} y={SASH.y} width={SASH.w} height={SASH.h} rx="8" fill="#f7f9fb" stroke="#c9d2db" strokeWidth="2" />
            {/* kreseczka: bead/frame line */}
            <rect x={K.x0} y={K.y0} width={K.x1 - K.x0} height={K.y1 - K.y0} fill="#e6ebf0" stroke="#7f8b96" strokeWidth="2.2" />
            {/* bead inner edge */}
            <rect x={B.x0} y={B.y0} width={B.x1 - B.x0} height={B.y1 - B.y0} fill="#2b3138" />
            {/* glass */}
            <rect x={G.x0} y={G.y0} width={G.x1 - G.x0} height={G.y1 - G.y0} fill="#cfe4f5" />
            <rect x={G.x0} y={G.y0} width={G.x1 - G.x0} height={G.y1 - G.y0} fill={`url(#${ID.sheen})`} opacity="0.6" />
            {/* handle */}
            <rect x={SASH.x + 18} y={SASH.y + SASH.h / 2 - 40} width="16" height="80" rx="8" fill="#e6ebf0" stroke="#aeb9c4" strokeWidth="1.5" />
          </g>
          <defs>
            <linearGradient id={ID.sheen} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
              <stop offset="45%" stopColor="#fff" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* --- width: markers + tape + label --- */}
          <Marker x={m.width.from} y={TAPE_W_Y} delay="1.1s" />
          <Marker x={m.width.to} y={TAPE_W_Y} delay="1.1s" />
          <g className="plmg-anim-w">
            <Tape x={m.width.from} y={TAPE_W_Y} len={wLen} />
          </g>
          <g className="plmg-label plmg-label-w">
            <rect x={m.width.from + wLen / 2 - wBox / 2} y={TAPE_W_Y - 78} width={wBox} height="46" rx="10" fill="#0e1a2a" filter={`url(#${ID.shadow})`} />
            <text x={m.width.from + wLen / 2} y={TAPE_W_Y - 58} textAnchor="middle" fill="#ffc45c" fontSize="19" fontWeight="800">
              SZEROKOŚĆ
            </text>
            <text x={m.width.from + wLen / 2} y={TAPE_W_Y - 40} textAnchor="middle" fill="#e2ecf8" fontSize="13.5" fontWeight="600">
              {m.width.text}
            </text>
          </g>

          {/* --- height --- */}
          <Marker x={TAPE_H_X} y={m.height.from} delay="3.2s" />
          <Marker x={TAPE_H_X} y={m.height.to} delay="3.2s" />
          <g className="plmg-anim-h">
            <Tape x={TAPE_H_X} y={m.height.from} len={hLen} vertical />
          </g>
          <g className="plmg-label plmg-label-h">
            <rect x={TAPE_H_X + 24} y={m.height.from + hLen / 2 - 23} width={hBox} height="46" rx="10" fill="#0e1a2a" filter={`url(#${ID.shadow})`} />
            <text x={TAPE_H_X + 24 + hBox / 2} y={m.height.from + hLen / 2 - 3} textAnchor="middle" fill="#ffc45c" fontSize="19" fontWeight="800">
              WYSOKOŚĆ
            </text>
            <text x={TAPE_H_X + 24 + hBox / 2} y={m.height.from + hLen / 2 + 15} textAnchor="middle" fill="#e2ecf8" fontSize="13.5" fontWeight="600">
              {m.height.text}
            </text>
          </g>

          {/* --- magnifier over the top-left corner --- */}
          <g className="plmg-lupa">
            <line x1={target.x} y1={target.y} x2={LUPA.cx - LUPA.r * 0.72} y2={LUPA.cy - LUPA.r * 0.72} stroke="#0e1a2a" strokeWidth="2.5" strokeDasharray="6 5" />
            <circle cx={LUPA.cx} cy={LUPA.cy} r={LUPA.r + 6} fill="#0e1a2a" filter={`url(#${ID.shadow})`} />
            <g clipPath={`url(#${ID.clip})`}>
              {/* zoomed corner: frame, kreseczka, bead, seal, glass */}
              <rect x={lx(SASH.x - 400)} y={ly(SASH.y - 400)} width={2000} height={2000} fill="#f7f9fb" />
              <rect x={lx(K.x0)} y={ly(K.y0)} width={2000} height={2000} fill="#e6ebf0" stroke="#7f8b96" strokeWidth={2.2 * z} />
              <rect x={lx(B.x0)} y={ly(B.y0)} width={2000} height={2000} fill="#2b3138" />
              <rect x={lx(G.x0)} y={ly(G.y0)} width={2000} height={2000} fill="#cfe4f5" />
              {/* zoomed strip labels */}
              <text x={lx(SASH.x + FRAME / 2)} y={LUPA.cy + 40} textAnchor="middle" fill="#334155" fontSize="14" fontWeight="700" transform={`rotate(-90 ${lx(SASH.x + FRAME / 2)} ${LUPA.cy + 40})`}>
                RAMA SKRZYDŁA
              </text>
              <text x={lx(K.x0 + BEAD / 2)} y={LUPA.cy + 46} textAnchor="middle" fill="#334155" fontSize="12.5" fontWeight="700" transform={`rotate(-90 ${lx(K.x0 + BEAD / 2)} ${LUPA.cy + 46})`}>
                LISTWA PRZYSZYBOWA
              </text>
              <text x={lx(B.x0 + SEAL / 2)} y={LUPA.cy + 40} textAnchor="middle" fill="#f8fafc" fontSize="11.5" fontWeight="700" transform={`rotate(-90 ${lx(B.x0 + SEAL / 2)} ${LUPA.cy + 40})`}>
                USZCZELKA
              </text>
              <text x={lx(G.x0) + 28} y={LUPA.cy + 100} textAnchor="middle" fill="#1e3a5f" fontSize="13" fontWeight="800">
                SZYBA
              </text>
              {/* the target point */}
              <g className="plmg-target">
                <circle cx={TX} cy={TY} r="22" fill="none" stroke="#ef4444" strokeWidth="3" className="plmg-marker-ring" />
                <circle cx={TX} cy={TY} r="6" fill="#ef4444" />
                {mode === "standard" ? (
                  <line x1={lx(B.x0)} y1={TY} x2={lx(G.x0)} y2={TY} stroke="#ef4444" strokeWidth="2" strokeDasharray="3 3" />
                ) : (
                  <line x1={TX} y1={TY - 60} x2={TX} y2={TY + 110} stroke="#ef4444" strokeWidth="2" strokeDasharray="3 3" />
                )}
              </g>
            </g>
            <circle cx={LUPA.cx} cy={LUPA.cy} r={LUPA.r} fill="none" stroke="#0e1a2a" strokeWidth="6" />
            <g className="plmg-target-label">
              <rect x={LUPA.cx - tBox / 2} y={LUPA.cy + LUPA.r - 6} width={tBox} height="34" rx="8" fill="#ef4444" />
              <text x={LUPA.cx} y={LUPA.cy + LUPA.r + 17} textAnchor="middle" fill="#fff" fontSize="14" fontWeight="800">
                MIERZ TU: {m.target.toUpperCase()}
              </text>
            </g>
          </g>
        </svg>

        <button type="button" className="plmg-replay" onClick={() => setRun((r) => r + 1)} aria-label="Odtwórz animację ponownie">
          ↻ Odtwórz
        </button>
      </div>

      <div className="plmg-summary">
        <div className="plmg-summary-row">
          <span className="plmg-chip plmg-chip-w">Szerokość</span>
          <span>{m.width.text}</span>
        </div>
        <div className="plmg-summary-row">
          <span className="plmg-chip plmg-chip-h">Wysokość</span>
          <span>{m.height.text}</span>
        </div>
        <p className="plmg-note">{m.note}</p>
        <ul className="plmg-legend" aria-label="Legenda">
          <li>
            <i style={{ background: "#f7f9fb", borderColor: "#c9d2db" }} /> rama skrzydła
          </li>
          <li>
            <i style={{ background: "#e6ebf0", borderColor: "#7f8b96" }} /> listwa przyszybowa
          </li>
          <li>
            <i style={{ background: "#2b3138", borderColor: "#2b3138" }} /> uszczelka
          </li>
          <li>
            <i style={{ background: "#cfe4f5", borderColor: "#9cc3e0" }} /> szyba
          </li>
        </ul>
      </div>
    </div>
  );
}
