"use client";

// Opisowa część strony rodzaju żaluzji (/zaluzje/<rodzaj>, właściciel
// 7.11.2026): okruszek, plakietki (bez ceny - materiał przed ceną), lead,
// zdjęcia, warianty grubości lameli z wersjami, opis, atuty, pomieszczenia,
// inne rodzaje. Konfigurator stoi obok (na telefonie pod spodem): grubość ->
// wersja -> montaż -> pomiar -> kolor -> drabinka -> cena.
import Link from "next/link";
import { useMemo } from "react";
import { optimizeImageUrl } from "@/lib/image-optim";
import { colorCountLabel } from "./ZaluzjeCategoryGrid";
import { ROLETY_COPY, type RoletyProfile } from "./shared";
import {
  ZALUZJE_RODZAJ_SLUGS,
  ZALUZJE_RODZAJE,
  zaluzjeRodzajGallery,
  zaluzjeRodzajWidths,
  zaluzjeVersionName,
  type ZaluzjeRodzajSlug,
} from "./zaluzje-rodzaje";

export default function ZaluzjeRodzajLanding({
  rodzaj,
  profile,
  onConfigure,
  onZoom,
}: {
  rodzaj: ZaluzjeRodzajSlug;
  profile: RoletyProfile | null;
  onConfigure: () => void;
  onZoom: (preview: { title: string; urls: string[]; index: number }) => void;
}) {
  const copy = ZALUZJE_RODZAJE[rodzaj];
  const photos = zaluzjeRodzajGallery(rodzaj);
  const strip = photos.slice(0, 4);
  const widths = useMemo(() => (profile ? zaluzjeRodzajWidths(profile, rodzaj) : []), [profile, rodzaj]);

  return (
    <div className="pl-landing zl-model-landing zl-rodzaj-landing">
      <nav className="zl-model-crumb" aria-label="Ścieżka">
        <Link href="/zaluzje">Żaluzje</Link>
        <span>{copy.short}</span>
      </nav>

      <div className="pl-trust-row">
        <span className="pl-chip">Na wymiar co do milimetra</span>
        <span className="pl-chip">Realizacja {ROLETY_COPY.zaluzje.leadTimeLabel}</span>
        <span className="pl-chip">Darmowa dostawa od 79 zł</span>
      </div>

      <p className="pl-subtitle">{copy.lead}</p>

      <div className={`rl-photos rl-photos--${Math.min(strip.length, 4)}`}>
        {strip.map((url, index) => (
          <button key={url} type="button" className="rl-photo" aria-label={`Powiększ zdjęcie ${index + 1}: ${copy.name}`} onClick={() => onZoom({ title: copy.name, urls: photos, index })}>
            <img src={optimizeImageUrl(url, 700)} alt={`${copy.name} - zdjęcie ${index + 1}`} loading={index === 0 ? "eager" : "lazy"} />
          </button>
        ))}
      </div>

      <div className="pl-cta-row">
        <button type="button" className="pl-cta-button" onClick={onConfigure}>
          Wybierz grubość lameli i kolor
        </button>
      </div>

      {widths.length ? (
        <>
          <h2 className="hero-product-section-title">Grubości lameli</h2>
          <div className="zl-rodzaj-widths">
            {widths.map((width) => (
              <div key={width.widthMm} className="zl-rodzaj-width">
                <strong>{width.widthMm} mm</strong>
                <span>
                  {width.groups.map((group) => zaluzjeVersionName(group).name).join(" · ")}
                </span>
                <small>{colorCountLabel(width.colorCount)}</small>
              </div>
            ))}
          </div>
          <p className="zl-rodzaj-hint">
            Węższa lamela = smuklejsza żaluzja, która mniej odstaje od szyby (dobra na skrzydło). Szersza lamela = mniej szczelin i więcej światła po otwarciu - najlepsza na duże okna.
          </p>
        </>
      ) : null}

      <h2 className="hero-product-section-title">Opis produktu</h2>
      <div className="pl-description">
        {copy.description.map((part, index) => (
          <p key={index}>{part}</p>
        ))}
      </div>

      <ul className="pl-feature-list">
        {copy.bullets.map((bullet) => (
          <li key={bullet.lead}>
            <strong>{bullet.lead}</strong>
            <span> - {bullet.detail}</span>
          </li>
        ))}
      </ul>

      <p className="zl-rodzaj-rooms">
        <span>Polecamy do:</span> {copy.rooms.join(", ")}
      </p>

      <div className="pl-callout">
        <strong>Nie wiesz, jak zmierzyć?</strong>
        <p>W konfiguratorze najpierw wybierasz sposób montażu, a my pokazujemy na animacji, co zmierzyć. Wpisujesz wynik co do milimetra - wymiar żaluzji wyliczymy sami.</p>
        <button type="button" className="pl-inline-cta-button pl-callout-cta" onClick={onConfigure}>
          Przejdź do konfiguratora
        </button>
      </div>

      <h3 className="zl-model-subtitle">Inne rodzaje żaluzji</h3>
      <div className="zl-rodzaj-others">
        {ZALUZJE_RODZAJ_SLUGS.filter((slug) => slug !== rodzaj).map((slug) => (
          <Link key={slug} href={`/zaluzje/${slug}`} className="zl-chip">
            <strong>{ZALUZJE_RODZAJE[slug].name}</strong>
          </Link>
        ))}
      </div>
    </div>
  );
}
