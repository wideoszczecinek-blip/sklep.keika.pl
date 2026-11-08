"use client";

// Okienko „produkt w koszyku” (właściciel 8.11): zamiast suchego „Dodano do koszyka!” - potwierdzenie wyboru,
// obietnica (5 lat gwarancji, 30 dni na zwrot) i zachęta do dokończenia zakupu. Plus miniatura tego, co klient
// właśnie wybrał - „dużym hamulcem jest to, że klient nie widzi, co wybrał, i może stracić pewność”:
// render całości (zdjęcie jego okna z wizualizatora, a bez niego okno w wybranych kolorach), bo sama próbka
// tkaniny nie pokazuje osprzętu ani tego, jak to wygląda na oknie. Przyciski „co dalej” zostają w okienku.
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
    return <img src={img} alt={label} loading="lazy" decoding="async" />;
  }
  if (item.fabricColor && /^#[0-9a-f]{6}$/i.test(item.fabricColor)) {
    return <span className="added-to-cart-swatch" style={{ background: item.fabricColor }} aria-label={`Wybrany kolor: ${label}`} />;
  }
  return null;
}

export default function AddedToCartMessage({ productSlug, productLabel, item }: { productSlug: string; productLabel: string; item?: Item | null }) {
  const pasuje = item && item.productSlug === productSlug && maMiniature(item) ? item : null;
  return (
    <div className="added-to-cart-message">
      {pasuje ? (
        <div className="added-to-cart-thumb">
          <Miniatura item={pasuje} label={productLabel} />
        </div>
      ) : (
        <span className="hero-product-added-toast-icon" aria-hidden="true">✓</span>
      )}
      <div className="added-to-cart-text">
        <p className="added-to-cart-title">
          <strong>Świetny wybór – produkt w koszyku.</strong> <span className="added-to-cart-label">{productLabel}</span>
        </p>
        <p>
          Na {nazwaProduktu(productSlug)} dajemy aż <strong>5 lat gwarancji</strong>, a jak się nie spodoba, to masz <strong>30 dni na zwrot</strong>. Dokończ zakup i odmień swoje okna na lepsze.
        </p>
      </div>
    </div>
  );
}
