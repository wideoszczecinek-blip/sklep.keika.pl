"use client";

// Reviews section for the rolety-dachowe landing - the real-proof variant of
// features/plisy/Reviews.tsx: the product's own Allegro rating (offer
// 18825232620 through the CRM rating endpoint), KEIKA's company reviews
// across its sales channels (CRM feed - roof-blind mentions first), and any
// reviews the owner types into the CRM product record. No placeholders.
import { useEffect, useMemo, useState } from "react";

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

function useCompanyReviews(): CompanyReview[] {
  const [rows, setRows] = useState<CompanyReview[]>([]);
  useEffect(() => {
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
        // Roof-blind mentions first, the rest in the feed's own order.
        setRows([...mapped.filter((r) => r.roof), ...mapped.filter((r) => !r.roof)]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return rows;
}

function useProductRating(): Rating | null {
  const [rating, setRating] = useState<Rating | null>(null);
  useEffect(() => {
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
  }, []);
  return rating;
}

export default function RoofReviews({ crmReviews }: { crmReviews?: CrmReview[] }) {
  const [visible, setVisible] = useState(PAGE);
  const rating = useProductRating();
  const companyReviews = useCompanyReviews();

  const combined = useMemo<CompanyReview[]>(
    () => [
      ...(crmReviews || []).map((r, i) => ({ id: `crm-${i}`, author: r.author, date: r.date, stars: Math.min(5, Math.max(1, Math.round(r.stars) || 5)), text: r.text, roof: true })),
      ...companyReviews,
    ],
    [crmReviews, companyReviews],
  );
  const shown = combined.slice(0, visible);

  return (
    <div className="hero-product-allegro-reviews">
      {rating ? (
        <div className="allegro-rating-summary">
          <div className="allegro-rating-score">
            <strong>{rating.average.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            <Stars n={Math.round(rating.average)} />
            <span className="allegro-rating-count">{rating.total.toLocaleString("pl-PL")} ocen</span>
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
      {combined.length ? (
        <>
          <p className="rd-reviews-lead">Opinie klientów KEIKA — o roletach dachowych i o naszej firmie w różnych kanałach sprzedaży.</p>
          <ul className="hero-product-reviews">
            {shown.map((review) => (
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
          {shown.length < combined.length ? (
            <div className="hero-product-reviews-load-more">
              <button type="button" className="hero-product-reviews-load-more-btn" onClick={() => setVisible((v) => v + PAGE)}>
                Pokaż więcej opinii ({combined.length - shown.length})
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
