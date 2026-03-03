"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ThemeToggle from "@/app/components/theme-toggle";

type ProductItem = {
  name?: string;
  title?: string;
  slug?: string;
  subtitle?: string;
  description?: string;
  price_from?: string;
  image_url?: string;
  gallery_urls?: string[];
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
  product_groups?: ProductGroup[];
};

type HardwareOption = {
  id: string;
  label: string;
  color: string;
  accent: string;
  image: string;
  note: string;
};

type FabricSwatch = {
  id: string;
  code: string;
  name: string;
  color: string;
};

type FabricGroup = {
  id: string;
  label: string;
  note: string;
  swatches: FabricSwatch[];
};

type MeasurementPosition = {
  id: number;
  width: number;
  height: number;
  quantity: number;
  controlSide: "left" | "right";
  glazingBead: "flat" | "round" | "angled";
};

const DEFAULT_PRODUCT: ProductItem = {
  name: "Rolety w kasecie Best 1",
  slug: "rolety-best-1",
  subtitle: "Rolety w aluminiowej kasecie, z prowadnicami przyszybowymi.",
  description:
    "System Best 1 zapewnia estetyczne prowadzenie tkaniny i stabilną pracę na skrzydle okna. Konfigurator pozwala dobrać osprzęt, tkaninę i wiele pozycji wymiarowych.",
  price_from: "od 329 zł",
  image_url:
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=80",
  gallery_urls: [
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1600047508788-786f6b65df7f?auto=format&fit=crop&w=1400&q=80",
  ],
};

const HARDWARE_OPTIONS: HardwareOption[] = [
  {
    id: "anthracite",
    label: "Antracyt mat",
    color: "#3e434b",
    accent: "#9ca6b7",
    image:
      "https://images.unsplash.com/photo-1616627561950-9f746e330187?auto=format&fit=crop&w=900&q=80",
    note: "Nowoczesny, kontrastowy wygląd do ciemnych profili.",
  },
  {
    id: "white",
    label: "Biały satyna",
    color: "#f3f5f7",
    accent: "#d2d9e2",
    image:
      "https://images.unsplash.com/photo-1617104551722-3b2d5136648f?auto=format&fit=crop&w=900&q=80",
    note: "Najczęściej wybierany do klasycznej stolarki PVC.",
  },
  {
    id: "black",
    label: "Czarny soft",
    color: "#1d2128",
    accent: "#798296",
    image:
      "https://images.unsplash.com/photo-1600047509425-3854b8d7ad85?auto=format&fit=crop&w=900&q=80",
    note: "Wyrazisty efekt premium do nowoczesnych wnętrz.",
  },
  {
    id: "golden-oak",
    label: "Złoty dąb",
    color: "#a77543",
    accent: "#d8b587",
    image:
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=80",
    note: "Ciepły, drewnopodobny odcień do klasycznych aranżacji.",
  },
  {
    id: "walnut",
    label: "Orzech",
    color: "#6c4630",
    accent: "#bf9a7d",
    image:
      "https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=900&q=80",
    note: "Głębszy, naturalny odcień drewna.",
  },
  {
    id: "silver",
    label: "Srebrny szczotkowany",
    color: "#aeb6c2",
    accent: "#e5ebf3",
    image:
      "https://images.unsplash.com/photo-1617098474202-0d0d7f60d4f0?auto=format&fit=crop&w=900&q=80",
    note: "Techniczny wygląd do nowoczesnej stolarki aluminiowej.",
  },
];

const EDEN_BASE_COLORS = [
  "#f2efe9",
  "#e4ded3",
  "#d1c7b7",
  "#b9ad99",
  "#998b74",
  "#7f6f59",
  "#5e5446",
  "#d9e5ef",
  "#becede",
  "#9cadc2",
];

const MADAGASKAR_BASE_COLORS = [
  "#f4f5f7",
  "#d6dbe3",
  "#b4bbc6",
  "#939ca9",
  "#727c89",
  "#59616d",
  "#434b57",
  "#2f3540",
];

const EDEN_SWATCHES: FabricSwatch[] = Array.from({ length: 50 }, (_, idx) => {
  const no = idx + 1;
  return {
    id: `eden-${no}`,
    code: `ED-${String(no).padStart(2, "0")}`,
    name: `EDEN ${String(no).padStart(2, "0")}`,
    color: EDEN_BASE_COLORS[idx % EDEN_BASE_COLORS.length],
  };
});

const MADAGASKAR_SWATCHES: FabricSwatch[] = Array.from({ length: 20 }, (_, idx) => {
  const no = idx + 1;
  return {
    id: `mad-${no}`,
    code: `MS-${String(no).padStart(2, "0")}`,
    name: `Madagaskar Silver ${String(no).padStart(2, "0")}`,
    color: MADAGASKAR_BASE_COLORS[idx % MADAGASKAR_BASE_COLORS.length],
  };
});

const FABRIC_GROUPS: FabricGroup[] = [
  {
    id: "eden",
    label: "EDEN",
    note: "Kolekcja ok. 50 kolorów - uniwersalne odcienie dzienne i zaciemniające.",
    swatches: EDEN_SWATCHES,
  },
  {
    id: "madagaskar-silver",
    label: "Madagaskar Silver",
    note: "Kolekcja ok. 20 kolorów - bardziej techniczne i nowoczesne tonacje.",
    swatches: MADAGASKAR_SWATCHES,
  },
];

const GLAZING_BEAD_OPTIONS = [
  {
    id: "flat",
    label: "Listwa płaska",
    image:
      "https://images.unsplash.com/photo-1616627561943-55d9e9f4f4c5?auto=format&fit=crop&w=900&q=80",
    note: "Do prostych listew przyszybowych z płaskim profilem.",
  },
  {
    id: "round",
    label: "Listwa zaokrąglona",
    image:
      "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=900&q=80",
    note: "Do listew z łukiem/zaokrągleniem przy szybie.",
  },
  {
    id: "angled",
    label: "Listwa skośna",
    image:
      "https://images.unsplash.com/photo-1600210492493-0946911123ea?auto=format&fit=crop&w=900&q=80",
    note: "Do listew o wyraźnym skosie i głębszym osadzeniu szyby.",
  },
] as const;

const STEPS = [
  { id: "hardware", label: "1. Kolor osprzętu" },
  { id: "fabric", label: "2. Tkanina" },
  { id: "dimensions", label: "3. Wymiary i sterowanie" },
] as const;

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

function parseNumericInput(value: string): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric));
}

function ensureProduct(config: PublicConfig | null, slug: string): ProductItem {
  const groups = Array.isArray(config?.product_groups) ? config.product_groups : [];
  for (const group of groups) {
    const products = Array.isArray(group.products) ? group.products : [];
    const match = products.find((entry) => String(entry.slug || "").trim() === slug);
    if (match) {
      return match;
    }
  }
  return DEFAULT_PRODUCT;
}

export default function ConfiguratorPage({ params }: { params?: { slug?: string } }) {
  const routerParams = useParams<{ slug?: string | string[] }>();
  const routerSlug = Array.isArray(routerParams?.slug) ? routerParams.slug[0] : routerParams?.slug;
  const propSlug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  const slug = String(routerSlug || propSlug || "").trim();

  const configEndpoint =
    process.env.NEXT_PUBLIC_CRM_SHOP_CONFIG_URL || "https://crm-keika.groovemedia.pl/biuro/api/shop/homepage_public";
  const endpointOrigin = useMemo(() => {
    try {
      return new URL(configEndpoint).origin;
    } catch {
      return "https://crm-keika.groovemedia.pl";
    }
  }, [configEndpoint]);

  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedHardware, setSelectedHardware] = useState(HARDWARE_OPTIONS[0].id);
  const [selectedFabricGroup, setSelectedFabricGroup] = useState(FABRIC_GROUPS[0].id);
  const [selectedFabricCode, setSelectedFabricCode] = useState(FABRIC_GROUPS[0].swatches[0].code);
  const [positions, setPositions] = useState<MeasurementPosition[]>([
    {
      id: 1,
      width: 820,
      height: 1220,
      quantity: 1,
      controlSide: "right",
      glazingBead: "flat",
    },
  ]);

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
  const topLinks = Array.isArray(config?.top_links) ? config.top_links : [];
  const logoUrl = absolutizeUrl(branding.logo_url || "", endpointOrigin);
  const contactPhone = branding.contact_phone || "+48 123 456 789";

  const supportedProductSlug = "rolety-best-1";
  const isSupported = slug === supportedProductSlug;

  const product = ensureProduct(config, supportedProductSlug);
  const productName = product.name || product.title || "Rolety w kasecie Best 1";
  const productSubtitle = product.subtitle || "Rolety w aluminiowej kasecie z prowadnicami przyszybowymi.";
  const productDescription =
    product.description ||
    "Wybierz kolor osprzętu i tkaninę, a następnie dodaj jedną lub wiele pozycji wymiarowych.";
  const productImage = absolutizeUrl(
    product.image_url || product.gallery_urls?.[0] || DEFAULT_PRODUCT.image_url || "",
    endpointOrigin,
  );

  const hardwareOption = HARDWARE_OPTIONS.find((entry) => entry.id === selectedHardware) || HARDWARE_OPTIONS[0];
  const fabricGroup = FABRIC_GROUPS.find((entry) => entry.id === selectedFabricGroup) || FABRIC_GROUPS[0];
  const fabric =
    fabricGroup.swatches.find((entry) => entry.code === selectedFabricCode) || fabricGroup.swatches[0];

  const currentStepId = STEPS[currentStep]?.id || "hardware";

  const areDimensionsValid = positions.every(
    (entry) => entry.width > 0 && entry.height > 0 && entry.quantity > 0,
  );
  const canProceed =
    currentStepId === "hardware"
      ? Boolean(selectedHardware)
      : currentStepId === "fabric"
        ? Boolean(selectedFabricCode)
        : areDimensionsValid;

  const totalItems = positions.reduce((sum, entry) => sum + entry.quantity, 0);
  const estimatedPrice = positions.reduce((sum, entry) => {
    const squareMeters = (entry.width / 1000) * (entry.height / 1000);
    const rowBase = 329 + squareMeters * 138;
    return sum + rowBase * entry.quantity;
  }, 0);

  function updatePosition(id: number, patch: Partial<MeasurementPosition>) {
    setPositions((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }

  function addSimilarPosition(id: number) {
    setPositions((prev) => {
      const source = prev.find((entry) => entry.id === id);
      if (!source) return prev;
      const nextId = Math.max(...prev.map((entry) => entry.id), 0) + 1;
      return [...prev, { ...source, id: nextId }];
    });
  }

  function addEmptyPosition() {
    setPositions((prev) => {
      const nextId = Math.max(...prev.map((entry) => entry.id), 0) + 1;
      return [
        ...prev,
        {
          id: nextId,
          width: 800,
          height: 1200,
          quantity: 1,
          controlSide: "right",
          glazingBead: "flat",
        },
      ];
    });
  }

  function removePosition(id: number) {
    setPositions((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((entry) => entry.id !== id);
    });
  }

  function goNextStep() {
    if (!canProceed) return;
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  }

  function goPrevStep() {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }

  return (
    <div
      className="catalog-root configurator-root"
      style={{
        backgroundImage: productImage
          ? `linear-gradient(120deg, rgba(4,12,22,.9), rgba(7,16,30,.8)), url(${productImage})`
          : undefined,
      }}
    >
      <header className="hero-header">
        <div className="header-left">
          <Link className="brand" href="/" aria-label="KEIKA strona główna">
            {logoUrl ? (
              <img src={logoUrl} alt={branding.site_title || "KEIKA"} className="brand-logo" />
            ) : (
              branding.site_title || "KEIKA"
            )}
          </Link>
          <div className="top-links-wrap">
            <button type="button" className="top-links-toggle" aria-expanded="false">
              <span className="top-links-toggle-label">Menu</span>
              <span className="top-links-toggle-icon" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>
            <nav className="top-links-dropdown" aria-label="Menu dodatkowe">
              {topLinks.map((entry) => (
                <a key={`${entry.label}-${entry.url}`} href={entry.url || "#"}>
                  {entry.label || "Link"}
                </a>
              ))}
            </nav>
          </div>
        </div>
        <div className="header-actions">
          <ThemeToggle />
          <a className="phone" href={`tel:${contactPhone.replace(/\s+/g, "")}`}>
            {contactPhone}
          </a>
          <a className="header-cart has-items" href="#koszyk">
            <span className="header-cart-title">Koszyk</span>
            <small>Przejdź do koszyka</small>
          </a>
        </div>
      </header>

      <main className="catalog-main">
        {loading ? (
          <section className="catalog-card">Wczytywanie konfiguratora…</section>
        ) : !isSupported ? (
          <section className="catalog-card">
            <h1>Konfigurator jeszcze niedostępny</h1>
            <p>Na ten moment aktywny jest konfigurator dla produktu: Rolety w kasecie Best 1.</p>
            <p>
              <Link href={`/produkt/${supportedProductSlug}`}>Przejdź do produktu Best 1</Link>
            </p>
          </section>
        ) : (
          <section className="configurator-layout">
            <div className="configurator-main-panel">
              <article className="catalog-card">
                <p className="configurator-eyebrow">Konfigurator krokowy</p>
                <h1>{productName}</h1>
                <p className="configurator-lead">{productSubtitle}</p>
                <p className="configurator-note">{productDescription}</p>
                <div className="configurator-steps">
                  {STEPS.map((step, idx) => (
                    <button
                      key={step.id}
                      type="button"
                      className={`configurator-step-chip ${idx === currentStep ? "is-active" : ""} ${idx < currentStep ? "is-done" : ""}`}
                      onClick={() => setCurrentStep(idx)}
                    >
                      {step.label}
                    </button>
                  ))}
                </div>
              </article>

              {currentStepId === "hardware" ? (
                <article className="catalog-card">
                  <h2>Krok 1: Wybierz kolor osprzętu</h2>
                  <p className="configurator-field-note">
                    Wybrany kolor od razu aktualizuje mockup produktu po prawej stronie.
                  </p>
                  <div className="hardware-grid">
                    {HARDWARE_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`hardware-card ${option.id === selectedHardware ? "is-active" : ""}`}
                        onClick={() => setSelectedHardware(option.id)}
                      >
                        <span className="hardware-card-image" style={{ backgroundImage: `url(${option.image})` }} />
                        <span className="hardware-card-footer">
                          <span className="hardware-dot" style={{ background: option.color }} />
                          <strong>{option.label}</strong>
                        </span>
                        <small>{option.note}</small>
                      </button>
                    ))}
                  </div>
                </article>
              ) : null}

              {currentStepId === "fabric" ? (
                <article className="catalog-card">
                  <h2>Krok 2: Wybierz tkaninę</h2>
                  <p className="configurator-field-note">
                    Najpierw wybór estetyki (tkanina), potem precyzyjne wymiary - to zwykle daje lepszą konwersję.
                  </p>
                  <div className="fabric-groups">
                    {FABRIC_GROUPS.map((group) => (
                      <button
                        key={group.id}
                        type="button"
                        className={`fabric-group-tab ${group.id === selectedFabricGroup ? "is-active" : ""}`}
                        onClick={() => {
                          setSelectedFabricGroup(group.id);
                          setSelectedFabricCode(group.swatches[0].code);
                        }}
                      >
                        {group.label}
                      </button>
                    ))}
                  </div>
                  <p className="configurator-field-note">{fabricGroup.note}</p>
                  <div className="fabric-grid">
                    {fabricGroup.swatches.map((swatch) => (
                      <button
                        key={swatch.id}
                        type="button"
                        className={`fabric-swatch ${swatch.code === selectedFabricCode ? "is-active" : ""}`}
                        onClick={() => setSelectedFabricCode(swatch.code)}
                      >
                        <span className="fabric-swatch-color" style={{ background: swatch.color }} />
                        <span className="fabric-swatch-code">{swatch.code}</span>
                      </button>
                    ))}
                  </div>
                </article>
              ) : null}

              {currentStepId === "dimensions" ? (
                <article className="catalog-card">
                  <h2>Krok 3: Wymiary i sterowanie</h2>
                  <p className="configurator-field-note">
                    Dodaj wiele pozycji dla tego samego koloru. Każdą pozycję możesz szybko zduplikować.
                  </p>
                  <div className="measurements-list">
                    {positions.map((position, idx) => {
                      const selectedBead =
                        GLAZING_BEAD_OPTIONS.find((entry) => entry.id === position.glazingBead) ||
                        GLAZING_BEAD_OPTIONS[0];
                      return (
                        <article key={position.id} className="measurement-card">
                          <header>
                            <strong>Pozycja {idx + 1}</strong>
                            <div className="measurement-actions">
                              <button type="button" onClick={() => addSimilarPosition(position.id)}>
                                Dodaj podobną
                              </button>
                              <button type="button" onClick={() => removePosition(position.id)}>
                                Usuń
                              </button>
                            </div>
                          </header>

                          <div className="measurement-grid">
                            <label>
                              Szerokość (mm)
                              <input
                                type="number"
                                min={100}
                                step={1}
                                value={position.width}
                                onChange={(event) =>
                                  updatePosition(position.id, { width: parseNumericInput(event.target.value) })
                                }
                              />
                            </label>
                            <label>
                              Wysokość (mm)
                              <input
                                type="number"
                                min={100}
                                step={1}
                                value={position.height}
                                onChange={(event) =>
                                  updatePosition(position.id, { height: parseNumericInput(event.target.value) })
                                }
                              />
                            </label>
                            <label>
                              Ilość
                              <input
                                type="number"
                                min={1}
                                step={1}
                                value={position.quantity}
                                onChange={(event) =>
                                  updatePosition(position.id, {
                                    quantity: Math.max(1, parseNumericInput(event.target.value)),
                                  })
                                }
                              />
                            </label>
                            <label>
                              Strona sterowania
                              <select
                                value={position.controlSide}
                                onChange={(event) =>
                                  updatePosition(position.id, {
                                    controlSide: event.target.value === "left" ? "left" : "right",
                                  })
                                }
                              >
                                <option value="right">Prawa</option>
                                <option value="left">Lewa</option>
                              </select>
                            </label>
                            <label>
                              Listwa przyszybowa
                              <select
                                value={position.glazingBead}
                                onChange={(event) =>
                                  updatePosition(position.id, {
                                    glazingBead:
                                      event.target.value === "round"
                                        ? "round"
                                        : event.target.value === "angled"
                                          ? "angled"
                                          : "flat",
                                  })
                                }
                              >
                                {GLAZING_BEAD_OPTIONS.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div className="measurement-tooltip">
                              <img src={selectedBead.image} alt={selectedBead.label} />
                              <div>
                                <strong>{selectedBead.label}</strong>
                                <p>{selectedBead.note}</p>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  <div className="measurement-footer">
                    <button type="button" onClick={addEmptyPosition}>
                      Dodaj nową pozycję
                    </button>
                  </div>
                </article>
              ) : null}

              <article className="catalog-card">
                <div className="configurator-nav">
                  <button type="button" onClick={goPrevStep} disabled={currentStep === 0}>
                    Wstecz
                  </button>
                  {currentStep < STEPS.length - 1 ? (
                    <button type="button" onClick={goNextStep} disabled={!canProceed}>
                      Dalej
                    </button>
                  ) : (
                    <button type="button" disabled={!areDimensionsValid}>
                      Dodaj do koszyka (demo)
                    </button>
                  )}
                </div>
              </article>
            </div>

            <aside className="configurator-preview-panel">
              <article className="catalog-card">
                <h3>Podgląd na żywo</h3>
                <p>
                  Kolor osprzętu i tkaniny nanoszony jest na mockup. Docelowo podmienimy tu finalne warstwy PNG/SVG.
                </p>

                <div className="config-preview-mockup" style={{ backgroundImage: `url(${productImage})` }}>
                  <div className="config-preview-window">
                    <span
                      className="config-preview-cassette"
                      style={{ background: `linear-gradient(180deg, ${hardwareOption.accent}, ${hardwareOption.color})` }}
                    />
                    <span className="config-preview-guide is-left" style={{ background: hardwareOption.color }} />
                    <span className="config-preview-guide is-right" style={{ background: hardwareOption.color }} />
                    <span className="config-preview-fabric" style={{ background: fabric.color }} />
                  </div>
                </div>

                <div className="config-summary-grid">
                  <div>
                    <span>Osprzęt</span>
                    <strong>{hardwareOption.label}</strong>
                  </div>
                  <div>
                    <span>Tkanina</span>
                    <strong>{fabric.code}</strong>
                  </div>
                  <div>
                    <span>Ilość pozycji</span>
                    <strong>{positions.length}</strong>
                  </div>
                  <div>
                    <span>Sztuk łącznie</span>
                    <strong>{totalItems}</strong>
                  </div>
                  <div className="config-summary-total">
                    <span>Szacunkowo od</span>
                    <strong>{estimatedPrice.toLocaleString("pl-PL")} zł</strong>
                  </div>
                </div>

                <div className="configurator-links">
                  <Link href={`/produkt/${supportedProductSlug}`}>Wróć do karty produktu</Link>
                  <Link href="/kategoria/oslony-wewnetrzne">Wróć do kategorii</Link>
                </div>
              </article>
            </aside>
          </section>
        )}
      </main>
    </div>
  );
}
