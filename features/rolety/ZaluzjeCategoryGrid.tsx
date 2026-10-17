"use client";

// Bloki rodzajów żaluzji (drewniane basswood, bambusowe...) - ten sam
// komponent w panelu produktu (ProductPanel) i na górze landingu na telefonie
// (Landing), gdzie panel konfiguratora jest dopiero pod opisem. Kliknięcie na
// landingu wysyła zdarzenie ZALUZJE_CATEGORY_EVENT, które ProductPanel
// zamienia na wybór kategorii, i przewija do panelu.
import { optimizeImageUrl } from "@/lib/image-optim";
import type { ZaluzjeCategory } from "./shared";

export const ZALUZJE_CATEGORY_EVENT = "keika:zaluzje-category";

export function dispatchZaluzjeCategory(slug: string) {
  try {
    window.dispatchEvent(new CustomEvent(ZALUZJE_CATEGORY_EVENT, { detail: { slug } }));
  } catch {
    /* ignore */
  }
}

function formatZl(value: number): string {
  return `${value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}

export function modelCountLabel(count: number): string {
  if (count === 1) return "1 model";
  const last = count % 10;
  const lastTwo = count % 100;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return `${count} modele`;
  return `${count} modeli`;
}

export function colorCountLabel(count: number): string {
  if (count === 1) return "1 kolor";
  const last = count % 10;
  const lastTwo = count % 100;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return `${count} kolory`;
  return `${count} kolorów`;
}

export default function ZaluzjeCategoryGrid({
  tree,
  activeSlug = "",
  onPick,
}: {
  tree: ZaluzjeCategory[];
  activeSlug?: string;
  onPick: (entry: ZaluzjeCategory) => void;
}) {
  return (
    <div className="zl-cat-grid">
      {tree.map((entry) => (
        <button key={entry.slug} type="button" className={`zl-cat-card ${entry.slug === activeSlug ? "is-active" : ""}`} onClick={() => onPick(entry)}>
          <span className="zl-cat-photo" aria-hidden="true" style={entry.imageUrl ? { backgroundImage: `url(${optimizeImageUrl(entry.imageUrl, 360)})` } : undefined} />
          <span className="zl-cat-body">
            <strong>{entry.category}</strong>
            {entry.description ? <span className="zl-cat-desc">{entry.description}</span> : null}
            <span className="zl-cat-meta">
              {entry.startingPrice !== null ? <span className="zl-price">od {formatZl(entry.startingPrice)}</span> : null}
              <span>{modelCountLabel(entry.modelCount)}</span>
              <span>{colorCountLabel(entry.colorCount)}</span>
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
