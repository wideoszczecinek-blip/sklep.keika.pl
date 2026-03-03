"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ThemeToggle from "@/app/components/theme-toggle";

type ProductItem = {
  name?: string;
  slug?: string;
  subtitle?: string;
  price_from?: string;
  image_url?: string;
  gallery_urls?: string[];
  badge?: string;
};

type ProductGroup = {
  title?: string;
  slug?: string;
  background_url?: string;
  description?: string;
  products?: ProductItem[];
};

type PublicConfig = {
  branding?: {
    site_title?: string;
    contact_phone?: string;
    logo_url?: string;
  };
  top_links?: Array<{ label?: string; url?: string }>;
  menu_groups?: Array<{
    title?: string;
    slug?: string;
    image_url?: string;
    items?: Array<string | { label?: string; title?: string; link_url?: string; url?: string }>;
  }>;
  product_groups?: ProductGroup[];
};

const fixedInteriorCategory: ProductGroup = {
  title: "Osłony wewnętrzne",
  slug: "oslony-wewnetrzne",
  description: "Wybierz typ rolety i przejdź do karty produktu.",
  background_url:
    "https://images.unsplash.com/photo-1616486701797-0f33f61038c8?auto=format&fit=crop&w=2400&q=80",
  products: [
    {
      name: "Rolety wolnowiszące mini",
      slug: "rolety-wolnowiszace-mini",
      subtitle: "Rolety naokienne z prowadzeniem żyłkowym.",
      price_from: "od 249 zł",
      badge: "",
      image_url:
        "https://images.unsplash.com/photo-1616627561950-9f746e330187?auto=format&fit=crop&w=1400&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1616627561950-9f746e330187?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?auto=format&fit=crop&w=1000&q=80",
      ],
    },
    {
      name: "Rolety wolnowiszące standard",
      slug: "rolety-wolnowiszace-standard",
      subtitle: "Rolety montowane na ścianie lub do sufitu. Przeznaczone do większych gabarytów.",
      price_from: "od 289 zł",
      badge: "",
      image_url:
        "https://images.unsplash.com/photo-1617103996702-96ff29b1c467?auto=format&fit=crop&w=1400&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1617104551722-3b2d5136648f?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1615874959474-d609969a20ed?auto=format&fit=crop&w=1000&q=80",
      ],
    },
    {
      name: "Rolety w kasecie Best 1",
      slug: "rolety-best-1",
      subtitle: "Rolety w aluminiowej kasecie, z prowadnicami przyszybowymi.",
      price_from: "od 329 zł",
      badge: "Najlepszy wybór",
      image_url:
        "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1600607687644-c7f34b5f3ef7?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600047508788-786f6b65df7f?auto=format&fit=crop&w=1000&q=80",
      ],
    },
    {
      name: "Rolety w kasecie przestrzennej Best 2",
      slug: "rolety-best-2",
      subtitle: "Rolety w aluminiowej kasecie z prowadnicami przestrzennymi.",
      price_from: "od 369 zł",
      badge: "",
      image_url:
        "https://images.unsplash.com/photo-1617098474202-0d0d7f60d4f0?auto=format&fit=crop&w=1400&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1600047509425-3854b8d7ad85?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600566753151-384129cf4e3e?auto=format&fit=crop&w=1000&q=80",
      ],
    },
  ],
};

const fixedDayNightCategory: ProductGroup = {
  title: "Rolety dzień noc",
  slug: "rolety-dzien-noc",
  description: "Systemy dzień-noc do precyzyjnej regulacji światła i prywatności.",
  background_url:
    "https://images.unsplash.com/photo-1616627562072-5f8f66ef10cf?auto=format&fit=crop&w=2400&q=80",
  products: [
    {
      name: "Rolety wolnowiszące mini Dzień-Noc",
      slug: "rolety-mini-dzien-noc",
      subtitle: "Rolety naokienne z prowadzeniem żyłkowym.",
      price_from: "od 269 zł",
      badge: "",
      image_url:
        "https://images.unsplash.com/photo-1616627561950-9f746e330187?auto=format&fit=crop&w=1400&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1616627561950-9f746e330187?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1000&q=80",
      ],
    },
    {
      name: "Rolety wolnowiszące standard Dzień - Noc",
      slug: "rolety-standard-dzien-noc",
      subtitle: "Rolety wolnowiszące montowane na ścianie lub do sufitu. Przeznaczone do większych gabarytów.",
      price_from: "od 299 zł",
      badge: "",
      image_url:
        "https://images.unsplash.com/photo-1617103996702-96ff29b1c467?auto=format&fit=crop&w=1400&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1617104551722-3b2d5136648f?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1617806118233-18e1de247200?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1615874959474-d609969a20ed?auto=format&fit=crop&w=1000&q=80",
      ],
    },
    {
      name: "Rolety w kasecie Best 1 Dzień-Noc",
      slug: "rolety-best-1-dzien-noc",
      subtitle: "Rolety w aluminiowej kasecie, z prowadnicami przyszybowymi.",
      price_from: "od 349 zł",
      badge: "Najlepszy wybór",
      image_url:
        "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1600607687644-c7f34b5f3ef7?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600047508788-786f6b65df7f?auto=format&fit=crop&w=1000&q=80",
      ],
    },
    {
      name: "Rolety w kasecie przestrzennej Best 2 Dzień - Noc",
      slug: "rolety-best-2-dzien-noc",
      subtitle: "Rolety w aluminiowej kasecie z prowadnicami przestrzennymi.",
      price_from: "od 389 zł",
      badge: "",
      image_url:
        "https://images.unsplash.com/photo-1617098474202-0d0d7f60d4f0?auto=format&fit=crop&w=1400&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1600047509425-3854b8d7ad85?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600566753151-384129cf4e3e?auto=format&fit=crop&w=1000&q=80",
      ],
    },
  ],
};

const fixedPlisyCategory: ProductGroup = {
  title: "Plisy",
  slug: "plisy",
  description: "Wybierz typ plisy i przejdź do karty produktu.",
  background_url:
    "https://images.unsplash.com/photo-1611048268330-53de574cae3b?auto=format&fit=crop&w=2400&q=80",
  products: [
    {
      name: "Plisy do okien pionowych",
      slug: "plisy-do-okien-pionowych",
      subtitle: "Uniwersalne plisy do standardowych okien pionowych.",
      price_from: "od 299 zł",
      badge: "",
      image_url:
        "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1400&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1617104551722-3b2d5136648f?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1617103996702-96ff29b1c467?auto=format&fit=crop&w=1000&q=80",
      ],
    },
    {
      name: "Plisy SLIM do okien typu HS, HST",
      slug: "plisy-slim-hs-hst",
      subtitle: "Dedykowany profil 16 mm do dużych przeszkleń przesuwnych.",
      price_from: "od 369 zł",
      badge: "",
      image_url:
        "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1400&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600047508788-786f6b65df7f?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1000&q=80",
      ],
    },
  ],
};

const fixedRoofCategory: ProductGroup = {
  title: "Rolety do okien dachowych",
  slug: "rolety-do-okien-dachowych",
  description: "Produkty dedykowane oknom dachowym z precyzyjnym prowadzeniem.",
  background_url:
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2400&q=80",
  products: [
    {
      name: "Rolety dachowe Dekolux",
      slug: "rolety-dachowe-dekolux",
      subtitle: "Rolety z prowadnicami i mechanizmem sprężynowym.",
      price_from: "od 389 zł",
      badge: "",
      image_url:
        "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1400&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600607687644-c7f34b5f3ef7?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1000&q=80",
      ],
    },
    {
      name: "Plisy dachowe",
      slug: "plisy-dachowe",
      subtitle: "Plisa z prowadnicami umożliwiająca zakrycie dowolnej powierzchni okna.",
      price_from: "od 429 zł",
      badge: "",
      image_url:
        "https://images.unsplash.com/photo-1616047006789-b7af3f061b46?auto=format&fit=crop&w=1400&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1616047006789-b7af3f061b46?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600210492493-0946911123ea?auto=format&fit=crop&w=1000&q=80",
      ],
    },
  ],
};

const fixedExternalRollerCategory: ProductGroup = {
  title: "Rolety zewnętrzne",
  slug: "rolety-zewnetrzne",
  description: "Wybierz typ rolety zewnętrznej i przejdź do karty produktu.",
  background_url:
    "https://images.unsplash.com/photo-1613977257592-487ecd136cc3?auto=format&fit=crop&w=2400&q=80",
  products: [
    {
      name: "Rolety adaptacyjne",
      slug: "rolety-adaptacyjne",
      subtitle: "Klasyczne rolety zewnętrzne montowane na elewacji lub we wnęce okiennej.",
      price_from: "od 899 zł",
      badge: "",
      image_url:
        "https://images.unsplash.com/photo-1600566752547-08f6a2e99cf7?auto=format&fit=crop&w=1400&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1600566752547-08f6a2e99cf7?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1000&q=80",
      ],
    },
    {
      name: "Rolety pod zabudowę",
      slug: "rolety-pod-zabudowe",
      subtitle: "Rolety do zabudowy warstwą elewacji.",
      price_from: "od 1049 zł",
      badge: "",
      image_url:
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1613545325278-f24b0cae1224?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600047508788-786f6b65df7f?auto=format&fit=crop&w=1000&q=80",
      ],
    },
  ],
};

const fixedZaluzjeCategory: ProductGroup = {
  title: "Żaluzje",
  slug: "zaluzje",
  description: "Wybierz wariant żaluzji i przejdź do karty produktu.",
  background_url:
    "https://images.unsplash.com/photo-1616627561943-55d9e9f4f4c5?auto=format&fit=crop&w=2400&q=80",
  products: [
    {
      name: "Żaluzje Aluminiowe 25mm",
      slug: "zaluzje-aluminiowe-25mm",
      subtitle: "Precyzyjna regulacja światła, lekka forma i nowoczesny wygląd.",
      price_from: "od 229 zł",
      image_url:
        "https://images.unsplash.com/photo-1616627561950-9f746e330187?auto=format&fit=crop&w=1400&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1616627561950-9f746e330187?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?auto=format&fit=crop&w=1000&q=80",
      ],
    },
    {
      name: "Żaluzje Aluminiowe 50mm",
      slug: "zaluzje-aluminiowe-50mm",
      subtitle: "Szersza lamela i mocniejszy akcent we wnętrzu.",
      price_from: "od 269 zł",
      image_url:
        "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600047508788-786f6b65df7f?auto=format&fit=crop&w=1000&q=80",
      ],
    },
    {
      name: "Żaluzje drewniane 25mm",
      slug: "zaluzje-drewniane-25mm",
      subtitle: "Naturalne drewno w smukłej lameli 25 mm.",
      price_from: "od 349 zł",
      image_url:
        "https://images.unsplash.com/photo-1617103996702-96ff29b1c467?auto=format&fit=crop&w=1400&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1617103996702-96ff29b1c467?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1617104551722-3b2d5136648f?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1615874959474-d609969a20ed?auto=format&fit=crop&w=1000&q=80",
      ],
    },
    {
      name: "Żaluzje drewniane 35mm",
      slug: "zaluzje-drewniane-35mm",
      subtitle: "Uniwersalna szerokość lameli do nowoczesnych wnętrz.",
      price_from: "od 379 zł",
      image_url:
        "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1400&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1611048268330-53de574cae3b?auto=format&fit=crop&w=1000&q=80",
      ],
    },
    {
      name: "Żaluzje drewniane 50mm",
      slug: "zaluzje-drewniane-50mm",
      subtitle: "Wyrazisty rytm lameli i mocny efekt premium.",
      price_from: "od 429 zł",
      image_url:
        "https://images.unsplash.com/photo-1617098474202-0d0d7f60d4f0?auto=format&fit=crop&w=1400&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1617098474202-0d0d7f60d4f0?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600047509425-3854b8d7ad85?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=1000&q=80",
      ],
    },
    {
      name: "Żaluzje drewniane 65mm",
      slug: "zaluzje-drewniane-65mm",
      subtitle: "Szeroka lamela do dużych przeszkleń i tarasowych okien.",
      price_from: "od 479 zł",
      image_url:
        "https://images.unsplash.com/photo-1600047508788-786f6b65df7f?auto=format&fit=crop&w=1400&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1600047508788-786f6b65df7f?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600047509425-3854b8d7ad85?auto=format&fit=crop&w=1000&q=80",
      ],
    },
    {
      name: "Żaluzje bambusowe 25mm",
      slug: "zaluzje-bambusowe-25mm",
      subtitle: "Lekki materiał bambusowy i delikatna lamela.",
      price_from: "od 369 zł",
      image_url:
        "https://images.unsplash.com/photo-1616627562072-5f8f66ef10cf?auto=format&fit=crop&w=1400&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1616627562072-5f8f66ef10cf?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1616627561943-55d9e9f4f4c5?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1616627561950-9f746e330187?auto=format&fit=crop&w=1000&q=80",
      ],
    },
    {
      name: "Żaluzje bambusowe 35mm",
      slug: "zaluzje-bambusowe-35mm",
      subtitle: "Bambusowa lamela o uniwersalnej szerokości 35 mm.",
      price_from: "od 399 zł",
      image_url:
        "https://images.unsplash.com/photo-1616627561943-55d9e9f4f4c5?auto=format&fit=crop&w=1400&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1616627561943-55d9e9f4f4c5?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1616627562072-5f8f66ef10cf?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1617104551722-3b2d5136648f?auto=format&fit=crop&w=1000&q=80",
      ],
    },
    {
      name: "Żaluzje bambusowe 50mm",
      slug: "zaluzje-bambusowe-50mm",
      subtitle: "Szersza lamela bambusowa i mocny, naturalny charakter.",
      price_from: "od 449 zł",
      image_url:
        "https://images.unsplash.com/photo-1611048268330-53de574cae3b?auto=format&fit=crop&w=1400&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1611048268330-53de574cae3b?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1617098474202-0d0d7f60d4f0?auto=format&fit=crop&w=1000&q=80",
      ],
    },
    {
      name: "Żaluzje bambusowe 65mm",
      slug: "zaluzje-bambusowe-65mm",
      subtitle: "Bambus 65 mm do dużych i reprezentacyjnych przeszkleń.",
      price_from: "od 499 zł",
      image_url:
        "https://images.unsplash.com/photo-1615874959474-d609969a20ed?auto=format&fit=crop&w=1400&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1615874959474-d609969a20ed?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1617103996702-96ff29b1c467?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1000&q=80",
      ],
    },
    {
      name: "Żaluzje RETRO 50mm",
      slug: "zaluzje-retro-50mm",
      subtitle: "Styl retro i ciepła kolorystyka drewna.",
      price_from: "od 469 zł",
      image_url:
        "https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=1400&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600566753151-384129cf4e3e?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600047508788-786f6b65df7f?auto=format&fit=crop&w=1000&q=80",
      ],
    },
    {
      name: "Plisożaluzja aluminiowa 25mm",
      slug: "plisozaluzja-aluminiowa-25mm",
      subtitle: "Połączenie zaluzji i plis w kompaktowym systemie 25 mm.",
      price_from: "od 329 zł",
      image_url:
        "https://images.unsplash.com/photo-1600047509425-3854b8d7ad85?auto=format&fit=crop&w=1400&q=80",
      gallery_urls: [
        "https://images.unsplash.com/photo-1600047509425-3854b8d7ad85?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1600607687644-c7f34b5f3ef7?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1617098474202-0d0d7f60d4f0?auto=format&fit=crop&w=1000&q=80",
      ],
    },
  ],
};

function absolutizeUrl(rawUrl: string, fallbackOrigin: string): string {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  try {
    if (value.startsWith("//")) return `https:${value}`;
    if (/^https?:\/\//i.test(value)) return value;
    return new URL(value, fallbackOrigin).toString();
  } catch {
    return value;
  }
}

function formatPrice(value: string): string {
  const clean = String(value || "").trim();
  return clean || "Cena po konfiguracji";
}

function normalizeCategorySlug(raw: string): string {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return "";

  if (/^oslony-wewn.*trzne$/.test(value)) return "oslony-wewnetrzne";
  if (/^oslony-zewn.*trzne$/.test(value)) return "oslony-zewnetrzne";
  if (/^rolety dzien ?-? noc$/.test(value.replace(/-/g, " "))) return "rolety-dzien-noc";
  if (/^rolety-dzien-?noc$/.test(value)) return "rolety-dzien-noc";
  if (/^plisy$/.test(value)) return "plisy";
  if (/^zaluzje$/.test(value)) return "zaluzje";
  if (/^rolety do okien dachowych$/.test(value.replace(/-/g, " "))) return "rolety-do-okien-dachowych";
  if (/^rolety-dachowe$/.test(value)) return "rolety-do-okien-dachowych";
  if (/^rolety zewnetrzne$/.test(value.replace(/-/g, " "))) return "rolety-zewnetrzne";
  if (/^rolety-zewnetrzne$/.test(value)) return "rolety-zewnetrzne";
  return value;
}

function slugifyLabel(raw: string): string {
  return String(raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CategoryPage({ params }: { params?: { slug?: string } }) {
  const routerParams = useParams<{ slug?: string | string[] }>();
  const routerSlug = Array.isArray(routerParams?.slug)
    ? routerParams.slug[0]
    : routerParams?.slug;
  const propSlug = Array.isArray(params?.slug) ? params?.slug?.[0] : params?.slug;
  const slugRaw = String(routerSlug || propSlug || "").trim();
  const slug = normalizeCategorySlug(slugRaw);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const configEndpoint = process.env.NEXT_PUBLIC_CRM_SHOP_CONFIG_URL || "https://crm-keika.groovemedia.pl/biuro/api/shop/homepage_public";
  const endpointOrigin = useMemo(() => {
    try {
      return new URL(configEndpoint).origin;
    } catch {
      return "https://crm-keika.groovemedia.pl";
    }
  }, [configEndpoint]);

  useEffect(() => {
    let mounted = true;
    fetch(`${configEndpoint}?_ts=${Date.now()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (!mounted) return;
        if (json?.ok && typeof json.config === "object") {
          setConfig(json.config as PublicConfig);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [configEndpoint]);

  const branding = config?.branding || {};
  const logoUrl = absolutizeUrl(branding.logo_url || "", endpointOrigin);
  const topLinks = Array.isArray(config?.top_links) ? config.top_links : [];
  const contactPhone = branding.contact_phone || "+48 123 456 789";
  const groups = Array.isArray(config?.product_groups) ? config.product_groups : [];
  const menuGroups = Array.isArray(config?.menu_groups) ? config.menu_groups : [];
  const group = groups.find((entry) => normalizeCategorySlug(String(entry.slug || "")) === slug);
  const menuGroupMatch = menuGroups.find((entry) => normalizeCategorySlug(String(entry.slug || "")) === slug);
  const menuDerivedProducts: ProductItem[] = Array.isArray(menuGroupMatch?.items)
    ? menuGroupMatch.items
        .map((item) => {
          const label = typeof item === "string"
            ? item
            : String(item?.label || item?.title || "").trim();
          if (!label) return null;

          const linkedSlugRaw = typeof item === "string"
            ? ""
            : String(item?.link_url || item?.url || "").trim();
          const linkedSlug = linkedSlugRaw.startsWith("/produkt/")
            ? linkedSlugRaw.replace(/^\/produkt\//, "").split("?")[0].split("#")[0]
            : "";

          return {
            name: label,
            slug: linkedSlug || slugifyLabel(label),
            subtitle: "",
            price_from: "",
            image_url: "",
          };
        })
        .filter(Boolean) as ProductItem[]
    : [];
  const effectiveGroup: ProductGroup | null = group || (menuGroupMatch
    ? {
        title: menuGroupMatch.title || "Produkty",
        slug: menuGroupMatch.slug || slugRaw,
        background_url: menuGroupMatch.image_url || "",
        description: "",
        products: menuDerivedProducts,
      }
    : null);
  let hardcodedGroup: ProductGroup | null = null;
  if (slug === "oslony-wewnetrzne") hardcodedGroup = fixedInteriorCategory;
  if (slug === "rolety-dzien-noc") hardcodedGroup = fixedDayNightCategory;
  if (slug === "plisy") hardcodedGroup = fixedPlisyCategory;
  if (slug === "rolety-do-okien-dachowych") hardcodedGroup = fixedRoofCategory;
  if (slug === "rolety-zewnetrzne") hardcodedGroup = fixedExternalRollerCategory;
  if (slug === "zaluzje") hardcodedGroup = fixedZaluzjeCategory;
  const resolvedGroup: ProductGroup | null = hardcodedGroup || effectiveGroup;
  const bgFallback = slug === "oslony-wewnetrzne"
    ? "https://images.unsplash.com/photo-1616486701797-0f33f61038c8?auto=format&fit=crop&w=2200&q=80"
    : "";
  const bg = absolutizeUrl(resolvedGroup?.background_url || bgFallback, endpointOrigin);
  const products = Array.isArray(resolvedGroup?.products) ? resolvedGroup.products : [];

  return (
    <div className="catalog-root" style={{ backgroundImage: bg ? `url(${bg})` : undefined }}>
      <header className="hero-header">
        <div className="header-left">
          <Link className="brand" href="/" aria-label="KEIKA strona główna">
            {logoUrl ? <img src={logoUrl} alt={branding.site_title || "KEIKA"} className="brand-logo" /> : (branding.site_title || "KEIKA")}
          </Link>
          <div className="top-links-wrap">
            <button type="button" className="top-links-toggle" aria-expanded="false">
              <span className="top-links-toggle-label">Menu</span>
              <span className="top-links-toggle-icon" aria-hidden="true"><span /><span /><span /></span>
            </button>
            <nav className="top-links-dropdown" aria-label="Menu dodatkowe">
              {topLinks.map((entry) => (
                <a key={`${entry.label}-${entry.url}`} href={entry.url || "#"}>{entry.label || "Link"}</a>
              ))}
            </nav>
          </div>
        </div>
        <div className="header-actions">
          <ThemeToggle />
          <a className="phone" href={`tel:${contactPhone.replace(/\s+/g, "")}`}>{contactPhone}</a>
          <a className="header-cart has-items" href="#koszyk">
            <span className="header-cart-title">Koszyk</span>
            <small>Przejdź do koszyka</small>
          </a>
        </div>
      </header>

      <main className="catalog-main">
        {loading ? (
          <section className="catalog-card">Wczytywanie kategorii…</section>
        ) : !resolvedGroup ? (
          <section className="catalog-card">
            <h1>Nie znaleziono kategorii</h1>
            <p>Ta kategoria nie jest jeszcze skonfigurowana w panelu administracyjnym.</p>
            <Link href="/">Wróć na stronę główną</Link>
          </section>
        ) : (
          <>
            <section className="catalog-head">
              <p>Kategoria</p>
              <h1>{resolvedGroup.title || "Produkty"}</h1>
              <p>{resolvedGroup.description || "Rolety tradycyjne i systemy naokienne. Wybierz produkt i przejdź do szczegółów."}</p>
            </section>
            <section className="catalog-grid">
              {products.map((product) => {
                const productSlug = String(product.slug || "").trim();
                const image = absolutizeUrl(product.image_url || "", endpointOrigin);
                const galleryBase = Array.isArray(product.gallery_urls) ? product.gallery_urls : [];
                const gallerySource = galleryBase.length
                  ? galleryBase
                  : (image ? [image] : []);
                const galleryTiles = gallerySource
                  .slice(0, 3)
                  .map((entry) => absolutizeUrl(String(entry || ""), endpointOrigin))
                  .filter(Boolean);
                return (
                  <article key={`${resolvedGroup.slug}-${productSlug || product.name}`} className="catalog-product-card">
                    <div className="catalog-product-image catalog-product-image--gallery">
                      <div className="catalog-product-gallery-grid">
                        {galleryTiles.map((tileUrl, idx) => (
                          <span
                            key={`${productSlug || product.name}-gallery-${idx}`}
                            className="catalog-product-gallery-tile"
                            style={{ backgroundImage: `url(${tileUrl})` }}
                          />
                        ))}
                        {!galleryTiles.length ? (
                          <span className="catalog-product-gallery-tile catalog-product-gallery-tile--empty" />
                        ) : null}
                      </div>
                      <div className="catalog-product-image-overlay" />
                      {product.badge ? <span className="catalog-product-badge">{product.badge}</span> : null}
                    </div>
                    <div className="catalog-product-body">
                      <h2>{product.name || "Produkt"}</h2>
                      <p>{product.subtitle || "Konfiguracja i szybka wycena."}</p>
                      <div className="catalog-product-row">
                        <strong>{formatPrice(product.price_from || "")}</strong>
                        <Link href={productSlug ? `/produkt/${productSlug}` : "#"}>Szczegóły</Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
