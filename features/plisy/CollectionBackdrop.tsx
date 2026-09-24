"use client";

// Tło kafelka kolekcji tkanin: cztery zdjęcia tkanin z TEJ kolekcji,
// przenikające się płynnie (właściciel, 2026-09-24: "zostaw te ikony, ale w
// tle daj karuzelę przykładowych zdjęć z kolekcji"). Ikona i tekst zostają
// na wierzchu - nad zdjęciami leży warstwa rozjaśniająca, żeby nazwa i
// plakietki były czytelne niezależnie od tego, jaka tkanina akurat wypadła.
//
// Zdjęcia są wybierane deterministycznie (skok co 1/4 kolekcji od pozycji
// wyliczonej z id), więc nie skaczą przy każdym renderze, a każda kolekcja
// pokazuje inny zestaw. Przy prefers-reduced-motion zostaje jedno,
// nieruchome zdjęcie.
import { useMemo } from "react";
import { optimizeImageUrl } from "@/lib/image-optim";
import type { FabricGroup } from "./shared";

const LAYERS = 4;
/** Długość pełnego cyklu karuzeli; każde zdjęcie jest widoczne 1/4 cyklu. */
const CYCLE_S = 16;

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function pickBackdropUrls(group: Pick<FabricGroup, "id" | "swatches">, count = LAYERS): string[] {
  const urls = group.swatches
    .map((swatch) => swatch.imageUrl || swatch.thumbnailUrl)
    .filter((url): url is string => Boolean(url));
  if (urls.length === 0) return [];
  if (urls.length <= count) return urls;
  const offset = hashCode(group.id) % urls.length;
  const step = Math.max(1, Math.floor(urls.length / count));
  const picked: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const url = urls[(offset + i * step) % urls.length];
    if (!picked.includes(url)) picked.push(url);
  }
  return picked;
}

export default function PlisyCollectionBackdrop({ group }: { group: FabricGroup }) {
  const urls = useMemo(() => pickBackdropUrls(group), [group]);
  if (urls.length === 0) return null;
  return (
    <span className="plisy-coll-card-bg" aria-hidden="true">
      {urls.map((url, index) => (
        <span
          key={`${url}-${index}`}
          className="plisy-coll-card-bg-layer"
          style={{
            backgroundImage: `url(${optimizeImageUrl(url, 240)})`,
            animationDuration: `${CYCLE_S}s`,
            animationDelay: `${-index * (CYCLE_S / urls.length)}s`,
          }}
        />
      ))}
    </span>
  );
}
