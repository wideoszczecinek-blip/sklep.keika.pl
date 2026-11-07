"use client";

// Kafle wyboru konfiguratora rolet tradycyjnych (właściciel 7.11.2026):
// - kolor osprzętu jako mała kaseta z prowadnicami w tym kolorze,
// - rodzaj tkaniny (Deko / Termo) jako scena okna z PRAWDZIWĄ tkaniną z CRM:
//   Deko prześwituje słońcem, Termo zaciemnia (zamiast 6 kwadracików),
// - listwa przyszybowa (tylko kaseta z prowadnicą płaską): przekroje
//   prosta / półokrągła + jak sprawdzić linijką.
import { useId } from "react";
import { optimizeImageUrl } from "@/lib/image-optim";
import type { RoletyProfile } from "./shared";
import { FABRIC_TYPE_COPY, LISTWA_OPTIONS, type ListwaType } from "./systemy";
import { LISTWA_JAK_SPRAWDZIC, LISTWA_PRZYKLADY } from "./listwa";

type FabricGroup = RoletyProfile["fabricGroups"][number];
type HardwareOption = RoletyProfile["hardware"][number];
type Swatch = FabricGroup["swatches"][number];

/** Mała kaseta z prowadnicami w kolorze osprzętu. */
function HardwareMini({ color, cassette }: { color: string; cassette: boolean }) {
  return (
    <svg viewBox="0 0 64 48" className="rs-hw-mini" aria-hidden="true">
      <rect x="6" y="4" width="52" height="42" rx="2" fill="#fff" stroke="#d6dde6" />
      <rect x="11" y="9" width="42" height="33" fill="#cfe6f7" />
      <rect x="13" y={cassette ? 13 : 11} width="38" height="22" fill="#e9e3d6" />
      {cassette ? (
        <>
          <rect x="9" y="7" width="46" height="7" rx="1.5" fill={color} stroke="rgba(0,0,0,.18)" />
          <rect x="10" y="13" width="3.2" height="29" fill={color} stroke="rgba(0,0,0,.15)" strokeWidth=".6" />
          <rect x="50.8" y="13" width="3.2" height="29" fill={color} stroke="rgba(0,0,0,.15)" strokeWidth=".6" />
        </>
      ) : (
        <rect x="11" y="8" width="42" height="4" rx="2" fill={color} stroke="rgba(0,0,0,.18)" />
      )}
      <rect x="13" y="34" width="38" height="2.2" fill={color} />
    </svg>
  );
}

export function HardwareTiles({
  options,
  activeId,
  cassette,
  onPick,
}: {
  options: HardwareOption[];
  activeId: string;
  cassette: boolean;
  onPick: (option: HardwareOption) => void;
}) {
  return (
    <div className="rs-hw-grid">
      {options.map((option) => {
        const active = option.id === activeId;
        return (
          <button key={option.id} type="button" className={`rs-hw ${active ? "is-active" : ""}`} aria-pressed={active} onClick={() => onPick(option)}>
            <HardwareMini color={option.color} cassette={cassette} />
            <span>{option.label}</span>
            {option.priceDelta > 0 && option.priceDeltaType === "amount" ? <small className="rs-chip-delta">+{Math.round(option.priceDelta)} zł</small> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Scena okna z roletą z prawdziwej tkaniny. */
function FabricScene({ swatch, mode, hardwareColor, cassette }: { swatch: Swatch | null; mode: "light" | "dark"; hardwareColor: string; cassette: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const img = swatch ? optimizeImageUrl(swatch.thumbnailUrl || swatch.imageUrl, 360) : "";
  const fabricColor = swatch?.color || (mode === "light" ? "#e6dcc6" : "#9aa0a8");
  const dark = mode === "dark";
  return (
    <svg viewBox="0 0 320 190" className="rs-ft-scene" aria-hidden="true">
      <defs>
        <linearGradient id={`wall${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={dark ? "#4a505c" : "#f7f1e6"} />
          <stop offset="1" stopColor={dark ? "#30353f" : "#ece2d0"} />
        </linearGradient>
        <linearGradient id={`sky${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9fd2f5" />
          <stop offset="1" stopColor="#e6f4fd" />
        </linearGradient>
        <radialGradient id={`glow${uid}`} cx="0.68" cy="0.28" r="0.6">
          <stop offset="0" stopColor="#fffbe8" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#fff3c9" stopOpacity="0.45" />
          <stop offset="1" stopColor="#fff3c9" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`beam${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff2c4" stopOpacity="0.75" />
          <stop offset="1" stopColor="#fff2c4" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`silver${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4f6f8" />
          <stop offset="0.5" stopColor="#c3c9d0" />
          <stop offset="1" stopColor="#eef1f4" />
        </linearGradient>
        <clipPath id={`glass${uid}`}>
          <rect x="112" y="30" width="96" height="137" />
        </clipPath>
      </defs>
      <rect width="320" height="190" fill={`url(#wall${uid})`} />
      {!dark ? <polygon points="112,168 208,168 262,190 58,190" fill={`url(#beam${uid})`} /> : null}
      {/* okno */}
      <rect x="100" y="18" width="120" height="162" rx="3" fill={dark ? "#d5d9de" : "#fff"} stroke="rgba(0,0,0,.08)" />
      <rect x="112" y="30" width="96" height="140" fill={`url(#sky${uid})`} />
      <circle cx="178" cy="58" r="13" fill="#fff6c2" />
      {/* roleta */}
      <g clipPath={`url(#glass${uid})`}>
        <g opacity={dark ? 1 : 0.9}>
          <rect x="112" y="34" width="96" height="132" fill={fabricColor} />
          {/* Zdjęcie próbki większe od rolety - zawinięty róg zdjęcia zostaje poza kadrem. */}
          {img ? <image href={img} x="112" y="34" width="210" height="140" preserveAspectRatio="xMinYMin slice" /> : null}
        </g>
        {!dark ? <rect x="112" y="34" width="96" height="132" fill={`url(#glow${uid})`} /> : null}
        {dark ? <path d="M208 150 L208 166 L190 166 Q201 160 208 150 Z" fill={`url(#silver${uid})`} stroke="rgba(0,0,0,.12)" strokeWidth=".6" /> : null}
      </g>
      <rect x="112" y="163" width="96" height="4" fill={hardwareColor} />
      {cassette ? (
        <>
          <rect x="106" y="24" width="108" height="11" rx="2" fill={hardwareColor} stroke="rgba(0,0,0,.18)" />
          <rect x="108" y="34" width="4.5" height="136" fill={hardwareColor} stroke="rgba(0,0,0,.12)" strokeWidth=".6" />
          <rect x="207.5" y="34" width="4.5" height="136" fill={hardwareColor} stroke="rgba(0,0,0,.12)" strokeWidth=".6" />
        </>
      ) : (
        <rect x="108" y="26" width="104" height="8" rx="4" fill={hardwareColor} stroke="rgba(0,0,0,.18)" />
      )}
      {/* łańcuszek */}
      <line x1="216" y1="36" x2="216" y2="120" stroke={dark ? "#e8ebef" : "#b9bfc7"} strokeWidth="1.4" strokeDasharray="1.6 1.6" />
    </svg>
  );
}

/** Pierwsza jasna próbka (Deko - żeby było widać prześwit) albo pierwsza z listy. */
function sceneSwatch(group: FabricGroup, selected: Swatch | null, mode: "light" | "dark"): Swatch | null {
  if (selected && group.swatches.some((entry) => entry.id === selected.id)) return selected;
  if (mode === "light") {
    const light = group.swatches.find((entry) => {
      const hex = entry.color.replace("#", "");
      if (hex.length !== 6) return false;
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return (r + g + b) / 3 > 190;
    });
    if (light) return light;
  }
  return group.swatches.find((entry) => / 6[15]$/.test(entry.label)) || group.swatches[0] || null;
}

export function FabricTypeCards({
  groups,
  activeId,
  selectedSwatch,
  hardwareColor,
  cassette,
  onPick,
}: {
  groups: FabricGroup[];
  activeId: string;
  selectedSwatch: Swatch | null;
  hardwareColor: string;
  cassette: boolean;
  onPick: (group: FabricGroup) => void;
}) {
  return (
    <div className="rs-ft-grid">
      {groups.map((group) => {
        const copy = FABRIC_TYPE_COPY[group.id];
        const mode = copy?.mode || (/termo|zaciem/i.test(group.label) ? "dark" : "light");
        const active = group.id === activeId;
        const chips = group.swatches.slice(0, 8);
        return (
          <button key={group.id} type="button" className={`rs-ft-card ${active ? "is-active" : ""} is-${mode}`} aria-pressed={active} onClick={() => onPick(group)}>
            <span className="rs-ft-visual">
              <FabricScene swatch={sceneSwatch(group, selectedSwatch, mode)} mode={mode} hardwareColor={hardwareColor} cassette={cassette} />
              {copy ? <span className="rs-ft-badge">{copy.badge}</span> : null}
              {active ? <span className="rs-ft-check">✓</span> : null}
            </span>
            <span className="rs-ft-body">
              <span className="rs-ft-name">
                <strong>{copy?.name || group.label}</strong>
                {copy ? <em>{copy.kind}</em> : null}
              </span>
              {copy ? (
                <span className="rs-ft-facts">
                  {copy.facts.map((fact) => (
                    <span key={fact}>{fact}</span>
                  ))}
                </span>
              ) : (
                <small>{group.note}</small>
              )}
              <span className="rs-ft-colors">
                <span className="rs-ft-chips" aria-hidden="true">
                  {chips.map((swatch) => (
                    <span
                      key={swatch.id}
                      style={{
                        backgroundColor: swatch.color,
                        backgroundImage: swatch.thumbnailUrl ? `url(${optimizeImageUrl(swatch.thumbnailUrl, 64)})` : undefined,
                      }}
                    />
                  ))}
                </span>
                <b>{group.swatches.length} kolorów</b>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Przekrój listwy przyszybowej z linijką przyłożoną do lica. */
function ListwaSection({ type }: { type: ListwaType }) {
  return (
    <svg viewBox="0 0 160 104" className="rs-listwa-svg" aria-hidden="true">
      {/* szyba */}
      <rect x="6" y="10" width="78" height="10" fill="#cfe6f7" stroke="#9cc3df" />
      <text x="10" y="8" fontSize="7" fill="#64748b">szyba</text>
      {/* rama skrzydła */}
      <path d="M84 4 H154 V70 H112 V40 H84 Z" fill="#eef1f4" stroke="#b7c0ca" />
      <text x="116" y="16" fontSize="7" fill="#64748b">rama</text>
      {/* uszczelka */}
      <rect x="62" y="20" width="6" height="4" fill="#3a3d42" />
      {/* listwa */}
      {type === "prosta" ? (
        <path d="M60 24 H112 V40 H104 L100 48 H60 Z" fill="#fff" stroke="#e07b00" strokeWidth="1.6" />
      ) : (
        <path d="M60 24 H112 V40 C108 40 104 41 100 43 C88 50 74 52 60 48 Z" fill="#fff" stroke="#e07b00" strokeWidth="1.6" />
      )}
      <text x="70" y="36" fontSize="7.5" fill="#a15c00" fontWeight="700">listwa</text>
      {/* linijka */}
      {type === "prosta" ? (
        <rect x="52" y="49" width="56" height="5" rx="1" fill="#147a52" opacity=".85" transform="rotate(0)" />
      ) : (
        <rect x="46" y="50" width="64" height="5" rx="1" fill="#b45309" opacity=".85" transform="rotate(-9 86 52)" />
      )}
      <text x="6" y="72" fontSize="7.5" fill={type === "prosta" ? "#147a52" : "#b45309"} fontWeight="700">
        {type === "prosta" ? "linijka leży płasko" : "linijka się kołysze"}
      </text>
      <text x="6" y="96" fontSize="7" fill="#64748b">widok z góry, od strony pokoju ↓</text>
    </svg>
  );
}

export function ListwaPicker({ value, onPick }: { value: ListwaType | ""; onPick: (value: ListwaType) => void }) {
  return (
    <div className="rs-listwa-grid">
      {LISTWA_OPTIONS.map((option) => {
        const active = option.id === value;
        return (
          <button key={option.id} type="button" className={`rs-listwa ${active ? "is-active" : ""}`} aria-pressed={active} onClick={() => onPick(option.id)}>
            <ListwaSection type={option.id} />
            <strong>{option.label}</strong>
            <small>{option.note}</small>
          </button>
        );
      })}
    </div>
  );
}

/** Instrukcja: jak sprawdzić kształt listwy + przykłady systemów okien. */
export function ListwaGuide({ open }: { open?: boolean }) {
  return (
    <details className="rs-listwa-guide" open={open}>
      <summary>Jak sprawdzić, jaką masz listwę? (1 minuta)</summary>
      <ol>
        {LISTWA_JAK_SPRAWDZIC.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {LISTWA_PRZYKLADY.length ? (
        <div className="rs-listwa-examples">
          <strong>Przykłady popularnych okien</strong>
          <table>
            <thead>
              <tr>
                <th>Okno (system profili)</th>
                <th>Listwa</th>
              </tr>
            </thead>
            <tbody>
              {LISTWA_PRZYKLADY.map((row) => (
                <tr key={row.system}>
                  <td>{row.system}</td>
                  <td>{row.listwa}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <small>Nazwę systemu znajdziesz na naklejce lub nadruku w rowku ramy po otwarciu skrzydła albo w dokumentach okna. Ten sam system bywa z różnymi listwami - decyduje to, co widzisz i czujesz pod linijką.</small>
        </div>
      ) : null}
    </details>
  );
}
