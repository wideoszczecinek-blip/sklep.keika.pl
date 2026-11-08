"use client";

// Okienko „produkt w koszyku” (właściciel 8.11): potwierdzenie wyboru, obietnica (5 lat gwarancji, 30 dni na zwrot)
// i zachęta do dokończenia zakupu. Druga wersja tego samego dnia („chuja widać - można zdecydowanie lepiej,
// z animacją”): biała karta nad konfiguratorem, animowany znak ✓ z iskrami, DUŻA miniatura tego, co klient wybrał
// (render całości: zdjęcie jego okna z wizualizatora, a bez niego okno w wybranych kolorach) z odznaką „W koszyku”,
// obietnice jako wyraźne plakietki, „Przejdź do koszyka” na pierwszym miejscu. Style: .atc-* w globals.css.
import CartWindowThumb, { resolveCartWindowThumb, type CartWindowThumbItem } from "@/app/components/cart-window-thumb";
import CartWizThumb from "@/app/components/cart-wiz-thumb";

type Item = CartWindowThumbItem & { wizToken?: string; previewImageUrl?: string; imageUrl?: string };

const NAZWA: Record<string, string> = {
  plisy: "plisy",
  "plisy-dachowe": "plisy dachowe",
  "rolety-dachowe": "rolety dachowe",
  "moskitiery-ramkowe": "moskitiery",
  zaluzje: "żaluzje",
};

function nazwaProduktu(slug: string): string {
  if (NAZWA[slug]) return NAZWA[slug];
  if (slug.startsWith("rolet")) return "rolety";
  if (slug.startsWith("moskit")) return "moskitiery";
  if (slug.startsWith("zaluz")) return "żaluzje";
  return "nasze osłony";
}

function maMiniature(item: Item): boolean {
  return Boolean(item.wizToken || resolveCartWindowThumb(item) || item.previewImageUrl || item.imageUrl || /^#[0-9a-f]{6}$/i.test(String(item.fabricColor || "")));
}

function Miniatura({ item, label }: { item: Item; label: string }) {
  if (item.wizToken) {
    return (
      <CartWizThumb token={item.wizToken} label={`${label} na zdjęciu Twojego okna`}>
        <CartWindowThumb item={item} label={`${label} na oknie, w wybranych kolorach`} />
      </CartWizThumb>
    );
  }
  if (resolveCartWindowThumb(item)) return <CartWindowThumb item={item} label={`${label} na oknie, w wybranych kolorach`} />;
  const img = item.previewImageUrl || item.imageUrl;
  if (img) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={img} alt={label} loading="eager" decoding="async" />;
  }
  return <span className="atc-swatch" style={{ background: item.fabricColor }} aria-label={`Wybrany kolor: ${label}`} />;
}

export default function AddedToCartMessage({ productSlug, productLabel, item }: { productSlug: string; productLabel: string; item?: Item | null }) {
  const pasuje = item && item.productSlug === productSlug && maMiniature(item) ? item : null;
  const zdjecie = Boolean(pasuje?.wizToken);
  return (
    <div className="atc" role="status">
      <div className="atc-head">
        <span className="atc-check" aria-hidden="true">
          <svg viewBox="0 0 52 52">
            <circle className="atc-check-c" cx="26" cy="26" r="23" />
            <path className="atc-check-p" d="M15 27.5l7.5 7.5L38 19" />
          </svg>
          {Array.from({ length: 8 }, (_, i) => (
            <i key={i} style={{ ["--a" as string]: `${i * 45}deg` }} />
          ))}
        </span>
        <div className="atc-head-text">
          <strong className="atc-title">Świetny wybór – produkt w koszyku.</strong>
          <span className="atc-label">{productLabel}</span>
        </div>
      </div>
      {pasuje ? (
        <div className={`atc-thumb${zdjecie ? " is-photo" : ""}`}>
          <Miniatura item={pasuje} label={productLabel} />
          <span className="atc-badge">
            <span aria-hidden="true">✓</span> W koszyku
          </span>
        </div>
      ) : null}
      <p className="atc-text">
        Na {nazwaProduktu(productSlug)} dajemy aż <b className="atc-hl">5 lat gwarancji</b>, a jak się nie spodoba, to masz{" "}
        <b className="atc-hl">30 dni na zwrot</b>.
      </p>
      <p className="atc-cta-text">Dokończ zakup i odmień swoje okna na lepsze.</p>
    </div>
  );
}
