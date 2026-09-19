"use client";

// Reviews section for the rolety-dachowe landing - the same arrangement as
// features/plisy/Reviews.tsx (owner, 2026-09-19: "daj oceny analogicznie
// jak przy plisach"):
//  - while RD_SHOW_PLACEHOLDER_REVIEWS && RD_REVIEWS_ARE_PLACEHOLDERS the
//    section renders ~200 generated samples (reviews-data.ts) with a banner
//    saying they are examples, a star distribution that doubles as a
//    filter, DEKO/TERMO tags, pros/cons and "Pokaż więcej";
//  - reviews the owner types into the CRM product record replace the
//    samples outright (and the banner with them);
//  - with the samples switched off (go-live) it shows the real Allegro
//    rating of this roof blind + KEIKA's company reviews from the CRM feed.
import { useEffect, useMemo, useState } from "react";
import { RD_REVIEWS, RD_REVIEWS_ARE_PLACEHOLDERS, RD_SHOW_PLACEHOLDER_REVIEWS, type RdReview } from "./reviews-data";

// Three up front, three more per click - same as plisy and the FAQ.
const PAGE = 3;
const PRODUCT_RATING_URL = "https://crm-keika.groovemedia.pl/biuro/api/shop/allegro_offer_rating_public.php?slug=rolety-dachowe";
const COMPANY_REVIEWS_URL = "https://crm-keika.groovemedia.pl/biuro/api/shop/company_reviews_public.php";
const ROOF_KEYWORDS = /dachow|velux|fakro|roto|okpol|dakstra|poddasz|kaset|skos/i;

type CrmReview = { author: string; stars: number; text: string; date: string };
type CompanyReview = { id: string; author: string; date: string; stars: number; text: string; roof: boolean };
type Rating = { average: number; total: number; distribution: { stars: number; count: number }[] };

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

function useProductRating(enabled: boolean): Rating | null {
  const [rating, setRating] = useState<Rating | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetch(PRODUCT_RATING_URL, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive || !j?.ok || !j.rating) return;
        const total = Number(j.rating.total_responses) || 0;
        if (!total) return;
        setRating({
          average: Number(j.rating.average_score) || 0,
          total,
          distribution: Array.isArray(j.rating.score_distribution) ? j.rating.score_distribution : [],
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [enabled]);
  return rating;
}

export default function RoofReviews({ crmReviews }: { crmReviews?: CrmReview[] }) {
  const [starFilter, setStarFilter] = useState<number | null>(null);
  const [collectionFilter, setCollectionFilter] = useState<RdReview["collection"] | null>(null);
  const [visible, setVisible] = useState(PAGE);

  // Reviews entered in the CRM (Sklep WWW -> Produkty -> roleta-dachowa-dekolux
  // -> Opinie) replace the generated samples outright - and the banner.
  const fromCrm: RdReview[] = (crmReviews || []).map((r) => ({
    date: r.date,
    maskedLogin: r.author,
    body: r.text,
    stars: Math.min(5, Math.max(3, Math.round(r.stars))) as 3 | 4 | 5,
    collection: /termo/i.test(r.text) ? "TERMO" : "DEKO",
  }));
  const usingCrm = fromCrm.length > 0;
  const placeholders = RD_REVIEWS_ARE_PLACEHOLDERS && !usingCrm && RD_SHOW_PLACEHOLDER_REVIEWS;
  const all: RdReview[] = usingCrm ? fromCrm : RD_SHOW_PLACEHOLDER_REVIEWS ? RD_REVIEWS : [];
  const total = all.length;
  const average = useMemo(() => (total ? all.reduce((s, r) => s + r.stars, 0) / total : 0), [all, total]);
  const distribution = useMemo(() => [5, 4, 3, 2, 1].map((stars) => ({ stars, count: all.filter((r) => r.stars === stars).length })), [all]);
  const collectionCounts = useMemo(
    () => ({ DEKO: all.filter((r) => r.collection === "DEKO").length, TERMO: all.filter((r) => r.collection === "TERMO").length }),
    [all],
  );

  // Real proof only when the samples are off (or the owner's CRM reviews
  // are in) - no point paying two CRM calls under a placeholder banner.
  const realMode = !placeholders;
  const rating = useProductRating(realMode);
  const companyReviews = useCompanyReviews(realMode && !usingCrm);

  if (!total) {
    const shownCompany = companyReviews.slice(0, visible);
    return (
      <div className="hero-product-allegro-reviews">
        {rating ? (
          <div className="allegro-rating-summary">
            <div className="allegro-rating-score">
              <strong>{rating.average.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              <Stars n={Math.round(rating.average)} />
              <span className="allegro-rating-count">{rating.total.toLocaleString("pl-PL")} {rating.total === 1 ? "ocena" : rating.total % 10 >= 2 && rating.total % 10 <= 4 && (rating.total % 100 < 12 || rating.total % 100 > 14) ? "oceny" : "ocen"}</span>
              <span className="allegro-rating-source">Ocena tej rolety dachowej od klientów, którzy kupili ją na Allegro</span>
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
        ) : null}
        {companyReviews.length ? (
          <>
            <p className="rd-reviews-lead">Opinie klientów KEIKA — o roletach dachowych i o naszej firmie w różnych kanałach sprzedaży.</p>
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
                    {review.roof ? <span className="plisy-review-collection">rolety dachowe</span> : null}
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
        ) : !rating ? (
          <p className="hero-product-config-hint">Opinie o tym produkcie pojawią się tu po pierwszych realizacjach w sklepie.</p>
        ) : null}
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
          <strong>Przykładowe opinie.</strong> Rolety dachowe to nowy produkt w naszym sklepie — poniższe wpisy pokazują, jak będzie
          wyglądać ta sekcja. Prawdziwe opinie pojawią się tu po pierwszych realizacjach.
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
        <div className="rd-reviews-collections" role="group" aria-label="Filtruj opinie po tkaninie">
          {(["DEKO", "TERMO"] as const).map((collection) => {
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
            {[starFilter ? `ocena ${starFilter}★` : "", collectionFilter ? `tkanina ${collectionFilter}` : ""].filter(Boolean).join(" · ")} — {filtered.length}{" "}
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
