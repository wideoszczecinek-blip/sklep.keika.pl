import { NextResponse } from "next/server";

import { MOSKITIERY_RAMKOWE_PRICE_PER_MB_PROMO, moskBilledMeters, moskPerimeterMeters } from "@/features/moskitiery-ramkowe/shared";
import { PD_HARDWARE, PD_PRODUCT_SLUG, calcPlisyDachowePrice } from "@/features/plisy-dachowe/shared";
import { applyPriceDeltas, calcPlisyPrice, fetchPlisyProfile, type PlisyProfile } from "@/features/plisy/shared";
import { ROOF_WINDOW_MODELS } from "@/features/rolety-dachowe/roof-windows-data";
import { calcRoletyDachowePrice, fetchRoofBlindProfile } from "@/features/rolety-dachowe/shared";
import { applyPriceAdjustment, normalizePriceAdjustmentPercent } from "@/lib/price-adjustment";

// Cennik wzorcowy dla kontroli cen konkurencji (CRM → Zespół AI → analityk
// cen, właściciel 14.10.2026: „porównywać produkt do produktu - wymiar,
// kolory, sterowanie, wszystko"). Stałe konfiguracje wyceniane TYM SAMYM
// kodem, którym liczy konfigurator (profile z CRM + korekta ceny produktu),
// więc liczby to dokładnie to, co klient widzi w sklepie. Bez cache: CRM
// pyta rzadko (raz na kilka godzin), a cennik ma być żywy.
export const dynamic = "force-dynamic";

const HOMEPAGE_CONFIG_URL = process.env.NEXT_PUBLIC_CRM_SHOP_CONFIG_URL || "https://crm-keika.groovemedia.pl/biuro/api/shop/homepage_public";

type BenchItem = {
  product: "moskitiery" | "plisy" | "rolety_dachowe" | "plisy_dachowe";
  config_key: string;
  label: string;
  spec: Record<string, string | number>;
  spec_text: string;
  our_price_zl: number | null;
  our_note: string;
  shop_url: string;
};

async function fetchAdjustments(): Promise<Record<string, number>> {
  try {
    const response = await fetch(HOMEPAGE_CONFIG_URL, { cache: "no-store" });
    const json = (await response.json()) as { config?: { product_groups?: Array<{ products?: Array<{ slug?: string; price_adjustment_percent?: unknown }> }> } };
    const out: Record<string, number> = {};
    for (const group of json?.config?.product_groups || []) {
      for (const product of group.products || []) {
        const slug = String(product.slug || "").trim();
        if (slug) out[slug] = normalizePriceAdjustmentPercent(product.price_adjustment_percent);
      }
    }
    return out;
  } catch {
    return {};
  }
}

function findWindow(producerRe: RegExp, modelRe: RegExp): { producer: string; model: string; widthMm: number; heightMm: number } | null {
  const hits = ROOF_WINDOW_MODELS.filter((m) => producerRe.test(m.producer) && (modelRe.test(m.model) || modelRe.test(m.altModel)));
  const best = hits.find((m) => m.certain) || hits[0];
  if (!best || !best.blindWidthMm || !best.blindHeightMm) return null;
  return { producer: best.producer, model: best.model, widthMm: best.blindWidthMm, heightMm: best.blindHeightMm };
}

function byIdOrLabel<T extends { id: string; label: string }>(list: T[], id: string, labelRe: RegExp): T | null {
  return list.find((x) => x.id === id) || list.find((x) => labelRe.test(x.label)) || null;
}

function moskitieryItems(adjustments: Record<string, number>): BenchItem[] {
  const perMb = applyPriceAdjustment(MOSKITIERY_RAMKOWE_PRICE_PER_MB_PROMO, adjustments["moskitiery-ramkowe"] || 0);
  const configs = [
    { key: "MR-60x120-bialy", w: 600, h: 1200, color: "biały" },
    { key: "MR-80x140-antracyt", w: 800, h: 1400, color: "antracyt" },
    { key: "MR-100x150-bialy", w: 1000, h: 1500, color: "biały" },
    { key: "MR-120x150-zloty-dab", w: 1200, h: 1500, color: "złoty dąb" },
  ];
  return configs.map((c) => {
    const billed = moskBilledMeters(moskPerimeterMeters(c.w, c.h));
    const price = Math.round(billed * perMb * 100) / 100;
    return {
      product: "moskitiery",
      config_key: c.key,
      label: `Moskitiera ramkowa ${c.w / 10}×${c.h / 10} cm, ${c.color}`,
      spec: { szerokosc_mm: c.w, wysokosc_mm: c.h, kolor_ramy: c.color, siatka: "standardowa z włókna szklanego (szara)", montaz: "zaczepy/haczyki, bez wiercenia", sterowanie: "stała, wyjmowana" },
      spec_text: `${c.w / 10}×${c.h / 10} cm · rama ${c.color} · siatka standard szara · na zaczepy · ${billed} mb × ${perMb.toFixed(2)} zł`,
      our_price_zl: price,
      our_note: `${billed} mb obwodu × ${perMb.toFixed(2)} zł/mb`,
      shop_url: "https://sklep.keika.pl/moskitiery-ramkowe",
    };
  });
}

function plisyItems(profile: PlisyProfile | null, adjustments: Record<string, number>): BenchItem[] {
  const configs = [
    { key: "PL-60x120-bialy-klasyczne-standard", w: 600, h: 1200, hw: "bialy", hwRe: /^biel|biał/i, group: "clasic", groupRe: /klasycz/i, mount: "przyszybowy-inwazyjny", mountRe: /standard/i, colorLabel: "biały", groupLabel: "Klasyczne (półprzepuszczalna)", mountLabel: "standard (przyszybowy, na wkręty)" },
    { key: "PL-80x140-bialy-klasyczne-bezinwazyjny", w: 800, h: 1400, hw: "bialy", hwRe: /^biel|biał/i, group: "clasic", groupRe: /klasycz/i, mount: "bezinwazyjny Sztywny", mountRe: /bezinwazyjn/i, colorLabel: "biały", groupLabel: "Klasyczne (półprzepuszczalna)", mountLabel: "bezinwazyjny (bez wiercenia)" },
    { key: "PL-80x140-antracyt-blackout-standard", w: 800, h: 1400, hw: "antracyt", hwRe: /antracyt/i, group: "blackout", groupRe: /podgum|blackout/i, mount: "przyszybowy-inwazyjny", mountRe: /standard/i, colorLabel: "antracyt", groupLabel: "Blackout (zaciemniająca, podgumowana)", mountLabel: "standard (przyszybowy, na wkręty)" },
    { key: "PL-100x150-bialy-duo-standard", w: 1000, h: 1500, hw: "bialy", hwRe: /^biel|biał/i, group: "duo", groupRe: /plaster/i, mount: "przyszybowy-inwazyjny", mountRe: /standard/i, colorLabel: "biały", groupLabel: "DUO plaster miodu (termoizolacyjna)", mountLabel: "standard (przyszybowy, na wkręty)" },
  ];
  const korekta = adjustments["plisy"] || 0;
  return configs.map((c) => {
    let price: number | null = null;
    let note = "";
    if (profile) {
      const hardware = byIdOrLabel(profile.hardware, c.hw, c.hwRe);
      const group = profile.fabricGroups.find((g) => g.id === c.group) || profile.fabricGroups.find((g) => c.groupRe.test(g.label)) || null;
      const mount = byIdOrLabel(profile.mountOptions, c.mount, c.mountRe);
      if (hardware && group) {
        const matrix = calcPlisyPrice({ ...profile, priceAdjustmentPercent: profile.priceAdjustmentPercent + korekta }, c.w, c.h, hardware.id, group.id);
        if (matrix !== null) {
          price = applyPriceDeltas(matrix, [mount, hardware, null]);
          note = `cennik ${group.label}${hardware.priceDelta ? `, listwa ${hardware.label} +${hardware.priceDelta} zł` : ""}${mount && mount.priceDelta ? `, montaż ${mount.label} +${mount.priceDelta} zł` : ""}${korekta ? `, korekta ${korekta} %` : ""}`;
        } else {
          note = "poza matrycą cennika";
        }
      } else {
        note = "brak opcji w profilu";
      }
    } else {
      note = "profil plis niedostępny";
    }
    return {
      product: "plisy",
      config_key: c.key,
      label: `Plisa okienna ${c.w / 10}×${c.h / 10} cm, ${c.colorLabel}, ${c.groupLabel.split(" (")[0]}`,
      spec: { szerokosc_mm: c.w, wysokosc_mm: c.h, kolor_listew: c.colorLabel, tkanina: c.groupLabel, montaz: c.mountLabel, sterowanie: "uchwyty na dolnej i górnej listwie (plisa swobodnie przesuwana góra-dół)", ilosc: 1 },
      spec_text: `${c.w / 10}×${c.h / 10} cm · listwy ${c.colorLabel} · ${c.groupLabel} · montaż ${c.mountLabel} · 1 szt.`,
      our_price_zl: price,
      our_note: note,
      shop_url: "https://sklep.keika.pl/plisy",
    };
  });
}

function plisyDachoweItems(profile: PlisyProfile | null, adjustments: Record<string, number>): BenchItem[] {
  const configs = [
    { key: "PD-velux-mk06-bialy-klasyczne", producer: /velux/i, model: /^MK06$/i, win: "Velux MK06 (78×118)", hw: "bialy", group: "clasic", groupRe: /klasycz/i, colorLabel: "biały", groupLabel: "Klasyczne (półprzepuszczalna)" },
    { key: "PD-velux-mk06-bialy-duo", producer: /velux/i, model: /^MK06$/i, win: "Velux MK06 (78×118)", hw: "bialy", group: "duo", groupRe: /plaster/i, colorLabel: "biały", groupLabel: "DUO plaster miodu (termoizolacyjna)" },
    { key: "PD-fakro-78x140-anoda-blackout", producer: /^fakro$/i, model: /^78x140$/i, win: "Fakro 78×140 (07)", hw: "anoda", group: "blackout", groupRe: /podgum|blackout/i, colorLabel: "anoda (szary)", groupLabel: "Blackout (zaciemniająca, podgumowana)" },
  ];
  const korekta = adjustments[PD_PRODUCT_SLUG] || 0;
  return configs.map((c) => {
    const win = findWindow(c.producer, c.model);
    let price: number | null = null;
    let note = "";
    if (!win) {
      note = "brak modelu okna w bibliotece";
    } else if (!profile) {
      note = "profil plis niedostępny";
    } else {
      const hardware = PD_HARDWARE.find((h) => h.id === c.hw) || PD_HARDWARE[0];
      const group = profile.fabricGroups.find((g) => g.id === c.group) || profile.fabricGroups.find((g) => c.groupRe.test(g.label)) || null;
      if (group) {
        price = calcPlisyDachowePrice(profile, win.widthMm, win.heightMm, hardware, group.id, null, korekta);
        note = price === null ? "poza matrycą cennika" : `plisa ${win.widthMm}×${win.heightMm} mm pod okno ${c.win}, cennik ${group.label}${korekta ? `, korekta ${korekta} %` : ""}`;
      } else {
        note = "brak kolekcji w profilu";
      }
    }
    return {
      product: "plisy_dachowe",
      config_key: c.key,
      label: `Plisa dachowa do ${c.win}, ${c.colorLabel}, ${c.groupLabel.split(" (")[0]}`,
      spec: { model_okna: c.win, szerokosc_plisy_mm: win?.widthMm || 0, wysokosc_plisy_mm: win?.heightMm || 0, kolor_osprzetu: c.colorLabel, tkanina: c.groupLabel, montaz: "prowadnice boczne na ramie skrzydła, na wkręty", sterowanie: "ręczne, uchwyty na listwach (góra-dół)", ilosc: 1 },
      spec_text: `${c.win} · osprzęt ${c.colorLabel} · ${c.groupLabel} · prowadnice boczne · sterowanie ręczne · 1 szt.`,
      our_price_zl: price,
      our_note: note,
      shop_url: "https://sklep.keika.pl/?produkt=plisy-dachowe",
    };
  });
}

async function roletyDachoweItems(adjustments: Record<string, number>): Promise<BenchItem[]> {
  const profile = await fetchRoofBlindProfile();
  const korekta = adjustments["rolety-dachowe"] || adjustments["roleta-dachowa-dekolux"] || 0;
  const configs = [
    { key: "RD-velux-mk06-bialy-polprzepuszczalna", producer: /velux/i, model: /^MK06$/i, win: "Velux MK06 (78×118)", hw: "bialy", hwRe: /bia[lł]/i, mat: "polprzepuszczalny", matRe: /p[oó][lł]przep/i, colorLabel: "biały", matLabel: "półprzepuszczalna (Deko)" },
    { key: "RD-velux-mk06-bialy-termo", producer: /velux/i, model: /^MK06$/i, win: "Velux MK06 (78×118)", hw: "bialy", hwRe: /bia[lł]/i, mat: "termo", matRe: /termo|zaciem/i, colorLabel: "biały", matLabel: "zaciemniająca termo (Termo)" },
    { key: "RD-velux-mk08-bialy-termo", producer: /velux/i, model: /^MK08$/i, win: "Velux MK08 (78×140)", hw: "bialy", hwRe: /bia[lł]/i, mat: "termo", matRe: /termo|zaciem/i, colorLabel: "biały", matLabel: "zaciemniająca termo (Termo)" },
    { key: "RD-fakro-78x118-sosna-termo", producer: /^fakro$/i, model: /^78x118$/i, win: "Fakro 78×118 (06)", hw: "sosna", hwRe: /sosn/i, mat: "termo", matRe: /termo|zaciem/i, colorLabel: "jasna sosna", matLabel: "zaciemniająca termo (Termo)" },
  ];
  return configs.map((c) => {
    const win = findWindow(c.producer, c.model);
    let price: number | null = null;
    let note = "";
    if (!win) {
      note = "brak modelu okna w bibliotece";
    } else {
      const hardware = byIdOrLabel(profile.hardware, c.hw, c.hwRe);
      const material = byIdOrLabel(profile.materialTypes, c.mat, c.matRe);
      if (hardware && material) {
        price = calcRoletyDachowePrice(profile.tables, win.widthMm, win.heightMm, hardware.id, material.id, korekta);
        note = price === null ? "poza matrycą cennika" : `roleta ${win.widthMm}×${win.heightMm} mm pod okno ${c.win}, profil ${profile.source}${korekta ? `, korekta ${korekta} %` : ""}`;
      } else {
        note = "brak opcji w profilu";
      }
    }
    return {
      product: "rolety_dachowe",
      config_key: c.key,
      label: `Roleta dachowa do ${c.win}, ${c.colorLabel}, ${c.matLabel.split(" (")[0]}`,
      spec: { model_okna: c.win, szerokosc_rolety_mm: win?.widthMm || 0, wysokosc_rolety_mm: win?.heightMm || 0, kolor_prowadnic: c.colorLabel, material: c.matLabel, montaz: "prowadnice boczne na ramie skrzydła, na wkręty", sterowanie: "ręczne, uchwyt na dolnej listwie, blokada w dowolnym miejscu", ilosc: 1 },
      spec_text: `${c.win} · prowadnice ${c.colorLabel} · ${c.matLabel} · prowadnice boczne · sterowanie ręczne · 1 szt.`,
      our_price_zl: price,
      our_note: note,
      shop_url: "https://sklep.keika.pl/?produkt=rolety-dachowe",
    };
  });
}

export async function GET() {
  try {
    const [adjustments, plisyProfile] = await Promise.all([fetchAdjustments(), fetchPlisyProfile()]);
    const items: BenchItem[] = [
      ...moskitieryItems(adjustments),
      ...plisyItems(plisyProfile, adjustments),
      ...(await roletyDachoweItems(adjustments)),
      ...plisyDachoweItems(plisyProfile, adjustments),
    ];
    return NextResponse.json(
      {
        ok: true,
        generated_at: new Date().toISOString(),
        adjustments,
        uwaga: "Ceny brutto za 1 szt. w sklepie sklep.keika.pl, liczone tym samym kodem co konfigurator; dostawa i dopłaty za ponadwymiar osobno.",
        items,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "price-bench failed" }, { status: 500 });
  }
}
