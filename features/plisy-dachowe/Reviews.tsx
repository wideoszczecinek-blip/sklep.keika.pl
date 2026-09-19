"use client";

// Reviews section for the plisy-dachowe landing - the same arrangement as
// features/rolety-dachowe/Reviews.tsx:
//  - while PD_SHOW_PLACEHOLDER_REVIEWS && PD_REVIEWS_ARE_PLACEHOLDERS the
//    section renders ~200 generated samples (reviews-data.ts) with a banner
//    saying they are examples, a star distribution that doubles as a
//    filter, collection tags, pros/cons and "Pokaż więcej";
//  - reviews the owner types into the CRM product record replace the
//    samples outright (and the banner with them);
//  - with the samples switched off (go-live) it shows KEIKA's company
//    reviews from the CRM feed (there is no Allegro offer for this product
//    to pull a rating from).
import { useEffect, useMemo, useState } from "react";
import { PD_REVIEW_COLLECTIONS, PD_REVIEWS, PD_REVIEWS_ARE_PLACEHOLDERS, PD_SHOW_PLACEHOLDER_REVIEWS, type PdReview, type PdReviewCollection } from "./reviews-data";

const PAGE = 3;
const COMPANY_REVIEWS_URL = "https://crm-keika.groovemedia.pl/biuro/api/shop/company_reviews_public.php";
const ROOF_KEYWORDS = /dachow|velux|fakro|roto|okpol|dakstra|poddasz|plis|skos/i;

type CrmReview = { author: string; stars: number; text: string; date: string };
type CompanyReview = { id: string; author: string; date: string; stars: number; text: string; roof: boolean };

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

function useCompanyReviews(enabled: boolean): CompanyReview[] {
  const [rows, setRows] = useState<CompanyReview[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetch(COMPANY_REVIEWS_URL)
      .then((r) => r.json())
      .then((j) => {
        if (!alive || !j?.ok || !Array.isArray(j.reviews)) return;
        const mapped: CompanyReview[] = j.reviews
          .map((r: Record<string, unknown>) => {
            const text = String(r.text || "").trim();
            return {
              id: String(r.id || ""),
              author: String(r.author || "Klient"),
              date: String(r.date || ""),
              stars: Math.min(5, Math.max(1, Number(r.stars) || 5)),
              text,
              roof: ROOF_KEYWORDS.test(text),
            };
          })
          .filter((r: CompanyReview) => r.text);
        setRows([...mapped.filter((r) => r.roof), ...mapped.filter((r) => !r.roof)]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [enabled]);
  return rows;
}

function collectionFromText(text: string): PdReviewCollection {
  if (/duo.*termo|termo/i.test(text)) return "DUO TERMO";
  if (/duo|plaster/i.test(text)) return "DUO";
  if (/blackout|podgum|zaciemn/i.test(text)) return "Blackout";
  if (/reflex|odbija/i.test(text)) return "Reflex";
  return "Klasyczne";
}

export default function PdReviews({ crmReviews }: { crmReviews?: CrmReview[] }) {
  const [starFilter, setStarFilter] = useState<number | null>(null);
  const [collectionFilter, setCollectionFilter] = useState<PdReviewCollection | null>(null);
  const [visible, setVisible] = useState(PAGE);

  const fromCrm: PdReview[] = (crmReviews || []).map((r) => ({
    date: r.date,
    maskedLogin: r.author,
    body: r.text,
    stars: Math.min(5, Math.max(3, Math.round(r.stars))) as 3 | 4 | 5,
    collection: collectionFromText(r.text),
  }));
  const usingCrm = fromCrm.length > 0;
  const placeholders = PD_REVIEWS_ARE_PLACEHOLDERS && !usingCrm && PD_SHOW_PLACEHOLDER_REVIEWS;
  const all: PdReview[] = usingCrm ? fromCrm : PD_SHOW_PLACEHOLDER_REVIEWS ? PD_REVIEWS : [];
  const total = all.length;
  const average = useMemo(() => (total ? all.reduce((s, r) => s + r.stars, 0) / total : 0), [all, total]);
  const distribution = useMemo(() => [5, 4, 3, 2, 1].map((stars) => ({ stars, count: all.filter((r) => r.stars === stars).length })), [all]);
  const collectionCounts = useMemo(() => {
    const counts = {} as Record<PdReviewCollection, number>;
    for (const collection of PD_REVIEW_COLLECTIONS) counts[collection] = all.filter((r) => r.collection === collection).length;
    return counts;
  }, [all]);

  const realMode = !placeholders;
  const companyReviews = useCompanyReviews(realMode && !usingCrm);

  if (!total) {
    const shownCompany = companyReviews.slice(0, visible);
    return (
      <div className="hero-product-allegro-reviews">
        {companyReviews.length ? (
          <>
            <p className="rd-reviews-lead">Opinie klientów KEIKA — o plisach, oknach dachowych i o naszej firmie w różnych kanałach sprzedaży.</p>
            <ul className="hero-product-reviews">
              {shownCompany.map((review) => (
                <li key={review.id}>
                  <div className="allegro-review-meta">
                    <strong>{review.author}</strong>
                    <span>{review.date}</span>
                    <span className="allegro-review-estimated-stars" aria-label={`${review.stars} na 5`}>
                      {"★".repeat(review.stars)}
                      {"☆".repeat(5 - review.stars)}
                    </span>
                    {review.roof ? <span className="plisy-review-collection">plisy / okna dachowe</span> : null}
                  </div>
                  <p>{review.text}</p>
                </li>
              ))}
            </ul>
            {shownCompany.length < companyReviews.length ? (
              <div className="hero-product-reviews-load-more">
                <button type="button" className="hero-product-reviews-load-more-btn" onClick={() => setVisible((v) => v + PAGE)}>
                  Pokaż więcej opinii ({companyReviews.length - shownCompany.length})
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <p className="hero-product-config-hint">Opinie o tym produkcie pojawią się tu po pierwszych realizacjach w sklepie.</p>
        )}
      </div>
    );
  }

  const filtered = all.filter((r) => (starFilter ? r.stars === starFilter : true)).filter((r) => (collectionFilter ? r.collection === collectionFilter : true));
  const shown = filtered.slice(0, visible);
  const hasMore = shown.length < filtered.length;
  const clearFilters = () => {
    setStarFilter(null);
    setCollectionFilter(null);
    setVisible(PAGE);
  };

  return (
    <div className="hero-product-allegro-reviews">
      {placeholders ? (
        <p className="plisy-reviews-placeholder-banner" role="note">
          <strong>Przykładowe opinie.</strong> Plisy dachowe to nowy produkt w naszym sklepie — poniższe wpisy pokazują, jak będzie wyglądać ta sekcja. Prawdziwe opinie pojawią się tu po
          pierwszych realizacjach.
        </p>
      ) : null}

      <div className="allegro-rating-summary">
        <div className="allegro-rating-score">
          <strong>{average.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          <Stars n={Math.round(average)} />
          <span className="allegro-rating-count">{total.toLocaleString("pl-PL")} opinii</span>
          {placeholders ? <span className="allegro-rating-source">Dane przykładowe — nie są zweryfikowanymi ocenami</span> : null}
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

      {!usingCrm ? (
        <div className="rd-reviews-collections pd-reviews-collections" role="group" aria-label="Filtruj opinie po kolekcji tkaniny">
          {PD_REVIEW_COLLECTIONS.map((collection) => {
            const active = collectionFilter === collection;
            return (
              <button
                key={collection}
                type="button"
                className={`rd-unit ${active ? "is-active" : ""}`}
                aria-pressed={active}
                onClick={() => {
                  setCollectionFilter(active ? null : collection);
                  setVisible(PAGE);
                }}
              >
                {collection} · {collectionCounts[collection]}
              </button>
            );
          })}
        </div>
      ) : null}

      {starFilter || collectionFilter ? (
        <div className="hero-product-reviews-filter-bar">
          <span>
            {[starFilter ? `ocena ${starFilter}★` : "", collectionFilter ? `kolekcja ${collectionFilter}` : ""].filter(Boolean).join(" · ")} — {filtered.length}{" "}
            {filtered.length === 1 ? "opinia" : filtered.length < 5 ? "opinie" : "opinii"}
          </span>
          <button type="button" onClick={clearFilters}>
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
