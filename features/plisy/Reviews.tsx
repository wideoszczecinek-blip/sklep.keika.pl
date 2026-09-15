"use client";

// Reviews section for the plisy landing. Mirrors the moskitiery-ramkowe
// layout (summary with star distribution as filters, paged list, load more)
// so the two products read the same, with one hard difference: while
// PLISY_REVIEWS_ARE_PLACEHOLDERS is true, the whole section is labelled as
// examples - a banner on top and a note under the average, no "zweryfikowane
// zakupem" claim anywhere. The per-entry badge was dropped on 2026-09-16 at
// the owner's request; the banner is the disclosure and stays until the
// flag flips. See reviews-data.ts for why.
import { useEffect, useMemo, useState } from "react";
import { PLISY_REVIEWS, PLISY_REVIEWS_ARE_PLACEHOLDERS, PLISY_SHOW_PLACEHOLDER_REVIEWS, type PlisyReview } from "./reviews-data";

const PAGE = 8;

function Stars({ n }: { n: number }) {
  return (
    <span className="allegro-rating-stars" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={`allegro-star ${s <= n ? "is-filled" : ""}`}>
          ★
        </span>
      ))}
    </span>
  );
}

type CrmReview = { author: string; stars: number; text: string; date: string };

// KEIKA's real customer rating as a company (the rating endpoint in the CRM
// aggregates the seller's verified customer scores). Owner (2026-09-16):
// show the overall rating on the plisy tab, labelled as the company's
// rating across its sales channels; individual reviews he adds himself in
// the CRM and they render below it without any labels.
const COMPANY_RATING_URL = "https://crm-keika.groovemedia.pl/biuro/api/shop/allegro_offer_rating_public.php?slug=moskitiery-ramkowe";
// Real customer reviews of KEIKA across its sales channels (CRM feed:
// both Allegro accounts via the seller-ratings API + reviews the owner
// copies in by hand from Google / Facebook). Shown as plain entries, no
// source labels - owner's call, 2026-09-16.
const COMPANY_REVIEWS_URL = "https://crm-keika.groovemedia.pl/biuro/api/shop/company_reviews_public.php";
type CompanyReview = { id: string; author: string; date: string; stars: number; text: string };

function useCompanyReviews(): CompanyReview[] {
  const [rows, setRows] = useState<CompanyReview[]>([]);
  useEffect(() => {
    let alive = true;
    fetch(COMPANY_REVIEWS_URL)
      .then((r) => r.json())
      .then((j) => {
        if (!alive || !j?.ok || !Array.isArray(j.reviews)) return;
        setRows(
          j.reviews
            .map((r: Record<string, unknown>) => ({
              id: String(r.id || ""),
              author: String(r.author || "Klient"),
              date: String(r.date || ""),
              stars: Math.min(5, Math.max(1, Number(r.stars) || 5)),
              text: String(r.text || "").trim(),
            }))
            .filter((r: CompanyReview) => r.text),
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return rows;
}
type CompanyRating = { average: number; total: number; distribution: { stars: number; count: number }[] };

function CompanyRatingBlock() {
  const [rating, setRating] = useState<CompanyRating | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(COMPANY_RATING_URL)
      .then((r) => r.json())
      .then((j) => {
        if (!alive || !j?.ok || !j.rating) return;
        setRating({
          average: Number(j.rating.average_score) || 0,
          total: Number(j.rating.total_responses) || 0,
          distribution: Array.isArray(j.rating.score_distribution) ? j.rating.score_distribution : [],
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  if (!rating) return null;
  return (
    <div className="allegro-rating-summary">
      <div className="allegro-rating-score">
        <strong>{rating.average.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
        <Stars n={Math.round(rating.average)} />
        <span className="allegro-rating-count">{rating.total.toLocaleString("pl-PL")} opinii</span>
        <span className="allegro-rating-source">Ocena firmy KEIKA w różnych kanałach sprzedaży</span>
      </div>
      <div className="allegro-rating-distribution">
        {rating.distribution.map((entry) => {
          const pct = rating.total ? Math.round((entry.count / rating.total) * 100) : 0;
          return (
            <div key={entry.stars} className="allegro-rating-bar-row">
              <span>{entry.stars}★</span>
              <span className="allegro-rating-bar-track">
                <span className="allegro-rating-bar-fill" style={{ width: `${pct}%` }} />
              </span>
              <span className="allegro-rating-bar-count">{entry.count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PlisyReviews({ crmReviews }: { crmReviews?: CrmReview[] }) {
  const [starFilter, setStarFilter] = useState<number | null>(null);
  const [visible, setVisible] = useState(PAGE);
  const companyReviews = useCompanyReviews();

  // Reviews entered in the CRM (Sklep WWW -> Produkty i konfiguratory ->
  // plisy -> Opinie) replace the generated placeholders outright - and with
  // them the "przykładowe" banner, because these are the owner's own.
  const fromCrm: PlisyReview[] = (crmReviews || []).map((r) => ({
    date: r.date,
    maskedLogin: r.author,
    body: r.text,
    stars: (Math.min(5, Math.max(3, Math.round(r.stars))) as 3 | 4 | 5),
    collection: "Klasyczne",
  }));
  const usingCrm = fromCrm.length > 0;
  const placeholders = PLISY_REVIEWS_ARE_PLACEHOLDERS && !usingCrm;
  const all = usingCrm ? fromCrm : PLISY_SHOW_PLACEHOLDER_REVIEWS ? PLISY_REVIEWS : [];
  const total = all.length;
  const average = useMemo(() => (total ? all.reduce((s, r) => s + r.stars, 0) / total : 0), [all, total]);
  const distribution = useMemo(
    () => [5, 4, 3, 2, 1].map((stars) => ({ stars, count: all.filter((r) => r.stars === stars).length })),
    [all],
  );

  const filtered: PlisyReview[] = starFilter ? all.filter((r) => r.stars === starFilter) : all;
  const shown = filtered.slice(0, visible);
  const hasMore = shown.length < filtered.length;

  if (!total || usingCrm) {
    const combined: CompanyReview[] = [
      ...fromCrm.map((r, i) => ({ id: `crm-${i}`, author: r.maskedLogin, date: r.date, stars: r.stars, text: r.body })),
      ...companyReviews,
    ];
    const shownCombined = combined.slice(0, visible);
    return (
      <div className="hero-product-allegro-reviews">
        <CompanyRatingBlock />
        {combined.length ? (
          <ul className="hero-product-reviews">
            {shownCombined.map((review) => (
              <li key={review.id}>
                <div className="allegro-review-meta">
                  <strong>{review.author}</strong>
                  <span>{review.date}</span>
                  <span className="allegro-review-estimated-stars" aria-label={`${review.stars} na 5`}>
                    {"★".repeat(review.stars)}
                    {"☆".repeat(5 - review.stars)}
                  </span>
                </div>
                <p>{review.text}</p>
              </li>
            ))}
          </ul>
        ) : null}
        {shownCombined.length < combined.length ? (
          <div className="hero-product-reviews-load-more">
            <button type="button" className="hero-product-reviews-load-more-btn" onClick={() => setVisible((v) => v + PAGE)}>
              Pokaż więcej opinii ({combined.length - shownCombined.length})
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="hero-product-allegro-reviews">
      {placeholders ? (
        <p className="plisy-reviews-placeholder-banner" role="note">
          <strong>Przykładowe opinie.</strong> Plisy to nowy produkt w naszym sklepie — poniższe wpisy pokazują, jak będzie
          wyglądać ta sekcja. Prawdziwe opinie pojawią się tu po pierwszych realizacjach.
        </p>
      ) : null}

      <div className="allegro-rating-summary">
        <div className="allegro-rating-score">
          <strong>{average.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          <Stars n={Math.round(average)} />
          <span className="allegro-rating-count">{total.toLocaleString("pl-PL")} opinii</span>
          {placeholders ? (
            <span className="allegro-rating-source">Dane przykładowe — nie są zweryfikowanymi ocenami</span>
          ) : null}
        </div>
        <div className="allegro-rating-distribution">
          {distribution.map((entry) => {
            const pct = total ? Math.round((entry.count / total) * 100) : 0;
            const active = starFilter === entry.stars;
            return (
              <button
                type="button"
                key={entry.stars}
                className={`allegro-rating-bar-row ${active ? "is-active-filter" : ""}`}
                onClick={() => {
                  setStarFilter(active ? null : entry.stars);
                  setVisible(PAGE);
                }}
                aria-pressed={active}
                disabled={entry.count === 0}
              >
                <span>{entry.stars}★</span>
                <span className="allegro-rating-bar-track">
                  <span className="allegro-rating-bar-fill" style={{ width: `${pct}%` }} />
                </span>
                <span className="allegro-rating-bar-count">{entry.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {starFilter ? (
        <div className="hero-product-reviews-filter-bar">
          <span>Opinie z oceną {starFilter}★</span>
          <button
            type="button"
            onClick={() => {
              setStarFilter(null);
              setVisible(PAGE);
            }}
          >
            Wyczyść filtr
          </button>
        </div>
      ) : null}

      <ul className="hero-product-reviews">
        {shown.map((review, index) => (
          <li key={`${review.date}-${review.maskedLogin}-${index}`}>
            <div className="allegro-review-meta">
              <strong>{review.maskedLogin}</strong>
              <span>{review.date}</span>
              <span className="allegro-review-estimated-stars" aria-label={`${review.stars} na 5`}>
                {"★".repeat(review.stars)}
                {"☆".repeat(5 - review.stars)}
              </span>
              {usingCrm ? null : <span className="plisy-review-collection">{review.collection}</span>}
            </div>
            <p>{review.body}</p>
            {review.pros || review.cons ? (
              <div className="allegro-review-tags">
                {review.pros ? (
                  <p className="allegro-review-tag allegro-review-tag-pros">
                    <strong>Zalety:</strong> {review.pros}
                  </p>
                ) : null}
                {review.cons ? (
                  <p className="allegro-review-tag allegro-review-tag-cons">
                    <strong>Wady:</strong> {review.cons}
                  </p>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {hasMore ? (
        <div className="hero-product-reviews-load-more">
          <button type="button" className="hero-product-reviews-load-more-btn" onClick={() => setVisible((v) => v + PAGE)}>
            Pokaż więcej opinii ({filtered.length - shown.length})
          </button>
        </div>
      ) : null}
    </div>
  );
}
