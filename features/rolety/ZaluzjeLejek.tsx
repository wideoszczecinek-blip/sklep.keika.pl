"use client";

// Sekcje lejka stron żaluzji (właściciel 7.11.2026: „opisz bardziej
// szczegółowo żaluzje - zrób im landing - oprzyj go na lejku”; „potrzebujemy
// też instrukcji pomiaru - najlepiej animowanej na wzór tej z plis”).
// Kolejność jak przy plisach (feedback 2.11): co to jest -> opis -> mały
// dowód społeczny -> zbicie obiekcji -> szczegóły; CTA powtarzane.
// Fakty o produkcie: strony producenta (Sun & Shade) streszczone własnymi
// słowami - teksty w zaluzje-lejek.ts. Żaluzje to dystrybucja: gwarancja
// producenta, bez „5 lat / 30 dni” i bez „produkujemy”.
import { COMPANY_LEGAL } from "@/lib/company-legal";
import { trackShopStep } from "@/lib/track-step";
import { opinieLabel } from "@/features/plisy/LandingV2";
import { useCompanyRating } from "@/features/plisy/Reviews";
import { ZaluzjeMeasureGuide } from "./ZaluzjeMeasure";
import { ZALUZJE_BEZPIECZNIE, ZALUZJE_DOPASUJESZ, type ZaluzjeLejekCopy } from "./zaluzje-lejek";

/** Sekcja opinii strony produktu (home-client: product-section-opinie) - jedna lista opinii na stronie żaluzji. */
const OPINIE_SECTION_ID = "product-section-opinie";

function scrollToId(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  const container = target.closest<HTMLElement>(".hero-full");
  if (container && container.scrollHeight > container.clientHeight) {
    const delta = target.getBoundingClientRect().top - container.getBoundingClientRect().top - 96;
    container.scrollTo({ top: Math.max(0, container.scrollTop + delta), behavior: "smooth" });
    return;
  }
  try {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch {
    /* ignore */
  }
}

/** Mały dowód społeczny pod opisem: ocena firmy KEIKA (ta sama co przy plisach). */
export function ZaluzjeProofLine({ source }: { source: string }) {
  const rating = useCompanyRating();
  if (!rating?.total) return null;
  const rounded = Math.round(rating.average * 10) / 10;
  return (
    <button
      type="button"
      className="plv2-proof zlf-proof"
      onClick={() => {
        trackShopStep("zaluzje_proof_click", source, {});
        scrollToId(OPINIE_SECTION_ID);
      }}
    >
      <span className="plv2-proof-stars" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((s) => (
          <span key={s} className={s <= Math.round(rating.average) ? "is-filled" : ""}>
            ★
          </span>
        ))}
      </span>
      <strong>{rounded.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong>
      <span className="plv2-proof-sep">·</span>
      <span>{opinieLabel(rating.total)} klientów KEIKA</span>
    </button>
  );
}

/** Korzyści rodzaju - 4 karty. */
export function ZaluzjeKorzysci({ copy }: { copy: ZaluzjeLejekCopy }) {
  return (
    <section className="zlf-section" aria-labelledby={`zlf-k-${copy.slug}`}>
      <p className="zlf-eyebrow">{copy.eyebrow}</p>
      <h2 id={`zlf-k-${copy.slug}`} className="zlf-title">
        {copy.hookTitle}
      </h2>
      <div className="zlf-cards">
        {copy.korzysci.map((item) => (
          <div key={item.title} className="zlf-card">
            <span className="zlf-card-icon" aria-hidden="true">
              {item.icon}
            </span>
            <strong>{item.title}</strong>
            <span>{item.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Z czego i jak jest zrobiona - fakty techniczne rodzaju. */
export function ZaluzjeBudowa({ copy }: { copy: ZaluzjeLejekCopy }) {
  return (
    <section className="zlf-section" aria-labelledby={`zlf-b-${copy.slug}`}>
      <p className="zlf-eyebrow">Budowa</p>
      <h2 id={`zlf-b-${copy.slug}`} className="zlf-title">
        {copy.budowaTitle}
      </h2>
      <dl className="zlf-specs">
        {copy.budowa.map((row) => (
          <div key={row.title}>
            <dt>{row.title}</dt>
            <dd>{row.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Co dopasujesz w konfiguratorze (wspólne dla wszystkich rodzajów). */
export function ZaluzjeDopasujesz({ onConfigure }: { onConfigure: () => void }) {
  return (
    <section className="zlf-section" aria-labelledby="zlf-dop">
      <p className="zlf-eyebrow">Na Twoje okno</p>
      <h2 id="zlf-dop" className="zlf-title">
        Żaluzja skrojona pod okno, a nie okno pod żaluzję
      </h2>
      <ul className="zlf-checks">
        {ZALUZJE_DOPASUJESZ.map((item) => (
          <li key={item.title}>
            <strong>{item.title}</strong>
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
      <button type="button" className="pl-inline-cta-button zlf-cta" onClick={onConfigure}>
        Skonfiguruj swoją żaluzję
      </button>
    </section>
  );
}

/** Pomiar: zapętlona animacja trzech montaży (jak plisy) + co, jeśli masz wątpliwości. */
export function ZaluzjePomiar({
  onConfigure,
  ctaLabel = "Mam wymiary - przejdź do konfiguratora",
  pid,
}: {
  onConfigure: () => void;
  ctaLabel?: string;
  /** Model S&S do wysokości pakietu w animacji (typowy dla rodzaju). */
  pid?: number;
}) {
  return (
    <section className="zlf-section" aria-labelledby="zlf-pom">
      <p className="zlf-eyebrow">Pomiar</p>
      <h2 id="zlf-pom" className="zlf-title">
        Zmierzysz w 2 minuty. Wystarczy zwykła miarka.
      </h2>
      <p className="zlf-lead">
        Wybierz, gdzie żaluzja ma wisieć - animacja pokaże, gdzie przyłożyć miarkę. Wpisujesz dokładnie to, co zmierzysz, co do milimetra. Wymiar żaluzji
        wyliczy konfigurator - niczego nie odejmujesz w pamięci.
      </p>
      <div className="zlf-guide">
        <ZaluzjeMeasureGuide pid={pid} />
      </div>
      <div className="lj-pomylka zlf-help">
        <b>Nie masz pewności, który montaż wybrać?</b>
        <span>
          Zadzwoń albo napisz przed zamówieniem - doradzimy na podstawie zdjęcia okna. {COMPANY_LEGAL.hours}, tel.{" "}
          <a href={COMPANY_LEGAL.phoneHref} onClick={() => trackShopStep("call_click", "zaluzje", { source: "pomiar" })}>
            {COMPANY_LEGAL.phone}
          </a>
          .
        </span>
      </div>
      <button type="button" className="pl-inline-cta-button zlf-cta" onClick={onConfigure}>
        {ctaLabel}
      </button>
    </section>
  );
}

/** Zbicie obiekcji: kupujesz bezpiecznie. */
export function ZaluzjeBezpiecznie() {
  return (
    <section className="zlf-section" aria-labelledby="zlf-bez">
      <p className="zlf-eyebrow">Bez ryzyka</p>
      <h2 id="zlf-bez" className="zlf-title">
        Kupujesz u firmy, nie u anonimowego sprzedawcy
      </h2>
      <div className="zlf-cards zlf-cards--safe">
        {ZALUZJE_BEZPIECZNIE.map((item) => (
          <div key={item.title} className="zlf-card">
            <span className="zlf-card-icon" aria-hidden="true">
              {item.icon}
            </span>
            <strong>{item.title}</strong>
            <span>{item.text}</span>
          </div>
        ))}
      </div>
      <p className="zlf-legal">
        {COMPANY_LEGAL.legalName}, {COMPANY_LEGAL.street}, {COMPANY_LEGAL.postalCode} {COMPANY_LEGAL.city} · NIP {COMPANY_LEGAL.nip} ·{" "}
        <a href={COMPANY_LEGAL.phoneHref}>{COMPANY_LEGAL.phone}</a> · {COMPANY_LEGAL.email}
      </p>
    </section>
  );
}

/** Dla kogo / kiedy wybrać inny rodzaj + pielęgnacja. */
export function ZaluzjeDlaKogo({ copy }: { copy: ZaluzjeLejekCopy }) {
  return (
    <section className="zlf-section" aria-labelledby={`zlf-d-${copy.slug}`}>
      <p className="zlf-eyebrow">Czy to dla Ciebie?</p>
      <h2 id={`zlf-d-${copy.slug}`} className="zlf-title">
        {copy.dlaKogoTitle}
      </h2>
      <ul className="zlf-fit">
        {copy.dlaKogo.map((line) => (
          <li key={line} className="is-yes">
            {line}
          </li>
        ))}
        {copy.nieDla.map((line) => (
          <li key={line} className="is-no">
            {line}
          </li>
        ))}
      </ul>
      <div className="zlf-care">
        <strong>Pielęgnacja</strong>
        <span>{copy.pielegnacja}</span>
      </div>
    </section>
  );
}
