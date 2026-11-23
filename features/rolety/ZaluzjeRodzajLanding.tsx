"use client";

// Opisowa część strony rodzaju żaluzji (/zaluzje/<rodzaj>, właściciel
// 7.11.2026): przełącznik materiału, plakietki (bez ceny - materiał przed
// ceną), lead, zdjęcia, opis, warianty grubości lameli, budowa, obiekcje,
// pomiar, porównanie materiałów. Konfigurator stoi obok (na telefonie pod
// spodem): grubość -> wersja -> montaż -> pomiar -> kolor -> drabinka -> cena.
// 23.11.2026 (właściciel): głównym wyborem jest materiał (aluminiowe,
// drewniane, bambusowe) - przełącznik pod tytułem, na górze konfiguratora i
// w porównaniu; wymiary wpisane w konfiguratorze przechodzą z klientem.
import { useEffect, useMemo, useRef } from "react";
import { optimizeImageUrl } from "@/lib/image-optim";
import { trackShopStep } from "@/lib/track-step";
import { colorCountLabel } from "./ZaluzjeCategoryGrid";
import { ROLETY_COPY, type RoletyProfile } from "./shared";
import { ZaluzjeBezpiecznie, ZaluzjeBudowa, ZaluzjeDlaKogo, ZaluzjeDopasujesz, ZaluzjeKorzysci, ZaluzjePomiar, ZaluzjeProofLine } from "./ZaluzjeLejek";
import { ZaluzjeMaterialSwitch, ZaluzjePorownanie } from "./ZaluzjeMaterialy";
import { ZALUZJE_LEJEK } from "./zaluzje-lejek";
import { ZALUZJE_RODZAJE, zaluzjeRodzajGallery, zaluzjeRodzajWidths, zaluzjeVersionName, type ZaluzjeRodzajSlug } from "./zaluzje-rodzaje";
import { requestZaluzjeSlatWidth } from "./zaluzje-switch";

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
  const lejek = ZALUZJE_LEJEK[rodzaj];
  const photos = zaluzjeRodzajGallery(rodzaj);
  const strip = photos.slice(0, 4);
  const widths = useMemo(() => (profile ? zaluzjeRodzajWidths(profile, rodzaj) : []), [profile, rodzaj]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const previousRodzaj = useRef(rodzaj);

  // Przejście na inny materiał (ta sama strona, inne dane): na telefonie strona
  // przewija się w .hero-full, którego Next nie wraca na górę - wracamy sami.
  // Przełącznik w konfiguratorze przewinie potem do konfiguratora.
  useEffect(() => {
    if (previousRodzaj.current === rodzaj) return;
    previousRodzaj.current = rodzaj;
    const container = rootRef.current?.closest<HTMLElement>(".hero-full");
    if (container) container.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [rodzaj]);

  return (
    <div ref={rootRef} className="pl-landing zl-model-landing zl-rodzaj-landing">
      <ZaluzjeMaterialSwitch current={rodzaj} variant="strip" />

      <div className="pl-trust-row">
        <span className="pl-chip">Na wymiar co do milimetra</span>
        <span className="pl-chip">Realizacja {ROLETY_COPY.zaluzje.leadTimeLabel}</span>
        <span className="pl-chip">Darmowa dostawa od 79 zł</span>
      </div>

      <p className="pl-subtitle">{copy.lead}</p>
      <ZaluzjeProofLine source={rodzaj} />

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

      <h2 className="hero-product-section-title">Opis produktu</h2>
      <div className="pl-description zlf-desc">
        {copy.description.map((part, index) => (
          <p key={index}>{part}</p>
        ))}
      </div>

      <ZaluzjeKorzysci copy={lejek} />

      {widths.length ? (
        <section className="zlf-section">
          <p className="zlf-eyebrow">Grubość lameli</p>
          <h2 className="zlf-title">Grubość lameli dobierasz do okna</h2>
          <div className="zl-rodzaj-widths">
            {widths.map((width) => (
              <button
                key={width.widthMm}
                type="button"
                className="zl-rodzaj-width"
                onClick={() => {
                  trackShopStep("zaluzje_slat_width_opis", `${width.widthMm} mm`, { rodzaj });
                  requestZaluzjeSlatWidth(width.widthMm);
                  onConfigure();
                }}
              >
                <strong>{width.widthMm} mm</strong>
                <span>{width.groups.map((group) => zaluzjeVersionName(group).name).join(" · ")}</span>
                <small>{colorCountLabel(width.colorCount)}</small>
                <em className="zl-rodzaj-width-go">Wybierz {width.widthMm} mm →</em>
              </button>
            ))}
          </div>
          <p className="zl-rodzaj-hint">
            Węższa lamela = smuklejsza żaluzja, która mniej odstaje od szyby (dobra na skrzydło). Szersza lamela = mniej szczelin i więcej światła po otwarciu - najlepsza na duże okna.
          </p>
        </section>
      ) : null}

      <ZaluzjeBudowa copy={lejek} />
      <ZaluzjeDopasujesz onConfigure={onConfigure} />
      <ZaluzjeBezpiecznie />
      <ZaluzjePomiar onConfigure={onConfigure} pid={lejek.pomiarPid} />
      <ZaluzjeDlaKogo copy={lejek} />
      <ZaluzjePorownanie current={rodzaj} />
    </div>
  );
}
