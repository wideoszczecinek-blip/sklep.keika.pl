(function () {
  const MENU_ITEMS = [
    { label: "Moskitiery", href: "/moskitiery" },
    { label: "O nas", href: "/o-nas" },
    { label: "Moje zamówienia", href: "/moje-zamowienia" },
    { label: "Kontakt", href: "/kontakt" },
    { label: "Regulamin", href: "/regulamin" },
  ];

  const TEXT_REPLACEMENTS = [
    ["zakup na Allegro", "sklep internetowy"],
    ["Najpierw konfigurujesz, potem kupujesz na Allegro", "Skonfiguruj i zamów bezpośrednio"],
    ["Finalizacja zamówienia nadal odbywa się na Allegro", "Finalizacja zamówienia odbywa się bezpośrednio w sklepie KEIKA"],
    ["Koszyk zawiera pozycje przypisane do różnych aukcji Allegro.", "Koszyk zawiera pozycje z różnych wariantów konfiguracji."],
    ["Zakup finalizujesz bezpiecznie na Allegro.", "Zakup finalizujesz bezpośrednio w sklepie KEIKA."],
    ["Podepnij ofertę Allegro w panelu CRM, aby aktywować przejście do aukcji.", "Zapisz wycenę lub skontaktuj się z nami, aby dokończyć zamówienie online."],
    ["Wróć do aukcji Allegro", "Przejdź do zamówienia"],
    ["Podepnij ofertę Allegro", "Zamówienie online w przygotowaniu"],
    ["Tyle już zyskujesz dzięki wspólnemu rozliczeniu obwodu w tej samej aukcji.", "Tyle już zyskujesz dzięki wspólnemu rozliczeniu obwodu w tym samym wariancie."],
    ["tej samej aukcji", "tego samego wariantu"],
    ["w wiadomości po zakupie", "po zapisaniu wyceny"],
    ["W uwagach do zakupu albo w wiadomości po zakupie podaj nam ten kod, żebyśmy od razu połączyli Twoją wycenę z zamówieniem.", "Po zapisaniu wyceny zachowaj ten kod. Dzięki niemu szybciej odnajdziemy Twoją konfigurację podczas finalizacji zamówienia."],
    ["Wybierz wariant, aby zacząć konfigurację.", "Skonfiguruj pierwszą moskitierę."],
  ];

  const HIDE_PATTERNS = [
    /powiązaną ofert/i,
    /aukcji allegro/i,
  ];

  const SHOP_CONFIG_URL = "https://crm-keika.groovemedia.pl/biuro/api/shop/homepage_public.php";
  const SHOP_GROUP_SLUG = "moskitiery";
  const SHOP_PRODUCT_SLUG = "moskitiery-ramkowe";
  const FALLBACK_GALLERY = [
    "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000328_79e6551b_Bialy_2.jpg",
    "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000347_2dc2ceab_Bialy_1.jpg",
    "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000401_566be7d6_Bialy_3.jpg",
  ];
  const FALLBACK_SECTIONS = [
    {
      title: "Najważniejsze cechy",
      body: "Lekka aluminiowa rama, estetyczne wykończenie i wzmocniona siatka zapewniają skuteczną ochronę przed owadami bez zasłaniania światła.",
    },
    {
      title: "Jak wygląda zamówienie",
      body: "Najpierw oglądasz zdjęcia produktu, potem wybierasz kolor profilu i siatki, wpisujesz wymiary i zapisujesz gotową konfigurację z wyliczoną ceną.",
    },
    {
      title: "Dopasowanie i montaż",
      body: "Moskitierę zamawiasz na wymiar. Przed finalizacją sprawdź dokładny pomiar szerokości i wysokości, aby gotowy model pasował do Twojego okna bez przeróbek.",
    },
  ];

  let introDataPromise = null;
  let galleryModalState = null;

  function setMeta() {
    document.title = "KEIKA | Moskitiery na wymiar";
    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute("content", "Moskitiera na wymiar z konfiguracją online, opisem produktu i zakupem bezpośrednio w sklepie KEIKA.");
    }
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formatMultilineText(value) {
    return escapeHtml(value).replace(/\n/g, "<br>");
  }

  function toAssetUrl(url, width, quality) {
    const source = String(url || "").trim();
    if (!source) return "";
    if (source.startsWith("data:") || source.startsWith("blob:") || source.startsWith("/api/asset-proxy")) {
      return source;
    }
    if (!/^https?:\/\//i.test(source)) {
      return source;
    }

    const params = new URLSearchParams({ url: source });
    if (Number.isFinite(width) && width > 0) {
      params.set("w", String(Math.round(width)));
    }
    if (Number.isFinite(quality) && quality > 0) {
      params.set("q", String(Math.round(quality)));
    }

    return `/api/asset-proxy?${params.toString()}`;
  }

  function fallbackIntroData() {
    return {
      name: "Moskitiery ramkowe",
      title: "Moskitiery ramkowe",
      subtitle_lines: ["Skonfiguruj moskitierę na wymiar i zobacz produkt jeszcze przed wejściem do konfiguratora."],
      price_from: "od 149 zł",
      gallery_urls: FALLBACK_GALLERY.slice(),
      landing_sections: FALLBACK_SECTIONS.slice(),
    };
  }

  function normalizeSubtitleLines(product) {
    const candidates = [
      String(product?.subtitle || "").trim(),
      String(product?.description || "").trim(),
    ];
    const unique = [];
    const seen = new Set();

    candidates.forEach((entry) => {
      if (!entry) return;
      const key = entry.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(entry);
    });

    return unique.length
      ? unique.slice(0, 2)
      : ["Skonfiguruj moskitierę na wymiar i zobacz produkt jeszcze przed wejściem do konfiguratora."];
  }

  function normalizeGalleryUrls(product) {
    const rawGallery = Array.isArray(product?.gallery_urls)
      ? product.gallery_urls
      : Array.isArray(product?.gallery)
        ? product.gallery
        : [];
    const unique = [];
    const seen = new Set();

    rawGallery
      .concat(product?.image_url ? [product.image_url] : [])
      .forEach((entry) => {
        const url = String(entry || "").trim();
        if (!url || seen.has(url)) return;
        seen.add(url);
        unique.push(url);
      });

    return unique.length ? unique : FALLBACK_GALLERY.slice();
  }

  function normalizeLandingSections(sections) {
    const normalized = (Array.isArray(sections) ? sections : [])
      .map((entry, index) => ({
        title: String(entry?.title || entry?.label || `Sekcja ${index + 1}`).trim(),
        body: String(entry?.body || entry?.content || entry?.description || "").trim(),
      }))
      .filter((entry) => entry.title || entry.body)
      .slice(0, 8);

    return normalized.length ? normalized : FALLBACK_SECTIONS.slice();
  }

  function extractIntroData(config) {
    const groups = Array.isArray(config?.product_groups) ? config.product_groups : [];
    const moskitieryGroup = groups.find((group) => String(group?.slug || "").trim() === SHOP_GROUP_SLUG);
    const products = Array.isArray(moskitieryGroup?.products) ? moskitieryGroup.products : [];
    const product = products.find((entry) => String(entry?.slug || "").trim() === SHOP_PRODUCT_SLUG) || {};

    return {
      name: String(product?.name || product?.title || "Moskitiery ramkowe").trim() || "Moskitiery ramkowe",
      title: String(product?.title || product?.name || "Moskitiery ramkowe").trim() || "Moskitiery ramkowe",
      subtitle_lines: normalizeSubtitleLines(product),
      price_from: String(product?.price_from || "od 149 zł").trim(),
      gallery_urls: normalizeGalleryUrls(product),
      landing_sections: normalizeLandingSections(product?.landing_sections || product?.accordion_sections),
    };
  }

  function fetchIntroData() {
    if (introDataPromise) {
      return introDataPromise;
    }

    introDataPromise = fetch(`${SHOP_CONFIG_URL}?_ts=${Date.now()}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Config request failed: ${response.status}`);
        }
        return response.json();
      })
      .then((payload) => extractIntroData(payload?.config || {}))
      .catch(() => fallbackIntroData());

    return introDataPromise;
  }

  function buildIntroMarkup(data) {
    const gallery = Array.isArray(data?.gallery_urls) && data.gallery_urls.length
      ? data.gallery_urls
      : FALLBACK_GALLERY;
    const sections = normalizeLandingSections(data?.landing_sections);
    const title = String(data?.title || data?.name || "Moskitiery ramkowe").trim() || "Moskitiery ramkowe";
    const subtitleLines = Array.isArray(data?.subtitle_lines) && data.subtitle_lines.length
      ? data.subtitle_lines
      : fallbackIntroData().subtitle_lines;
    const carouselSlides = [
      {
        title,
        body: subtitleLines.join("\n\n"),
      },
    ].concat(
      sections.map((section, index) => ({
        title: String(section.title || `Sekcja ${index + 1}`).trim(),
        body: String(section.body || "").trim(),
      })),
    );
    const snapLabels = [
      "Moskitiery",
      ...sections.map((section, index) => String(section.title || `Sekcja ${index + 1}`).trim()),
      "Konfigurator",
    ];
    const galleryItems = gallery.map((imageUrl, index) => ({
      previewSrc: toAssetUrl(imageUrl, 960, 52),
      modalSrc: toAssetUrl(imageUrl, 1440, 62),
      alt: `${data?.name || "Moskitiery"} ${index + 1}`,
      loading: index === 0 ? "eager" : "lazy",
      fetchPriority: index === 0 ? "high" : "auto",
    }));

    return `
      <div class="shop-copy-intro__card shop-copy-snap-landing" data-shop-copy-snap-landing>
        <div class="shop-copy-snap-shell">
          <nav class="shop-copy-snap-side-nav" aria-label="Sekcje landing">
            ${snapLabels.map((label, index) => `
              <button
                type="button"
                class="shop-copy-snap-side-nav__item${index === 0 ? " is-active" : ""}"
                data-shop-copy-snap-target="${index}"
                aria-label="${escapeHtml(label)}"
                aria-current="${index === 0 ? "true" : "false"}"
              >
                <span class="shop-copy-snap-side-nav__dot" aria-hidden="true"></span>
                <span class="shop-copy-snap-side-nav__label">${escapeHtml(label)}</span>
              </button>
            `).join("")}
          </nav>
          <div class="shop-copy-snap-viewport">
            <div class="shop-copy-snap-track" data-shop-copy-snap-track>
              <section class="shop-copy-snap-panel shop-copy-snap-panel--hero" data-shop-copy-snap-panel>
                <div class="shop-copy-snap-panel__inner shop-copy-snap-hero">
                  <div class="shop-copy-text-carousel" aria-live="polite">
                    ${carouselSlides.map((slide, index) => `
                      <article class="shop-copy-text-carousel__slide${index === 0 ? " is-active" : ""}" data-shop-copy-carousel-slide>
                        <h2 class="shop-copy-text-carousel__title">${escapeHtml(slide.title || title)}</h2>
                        <p class="shop-copy-text-carousel__body">${formatMultilineText(slide.body || "")}</p>
                      </article>
                    `).join("")}
                    <div class="shop-copy-snap-hero-controls" aria-label="Nawigacja slajdów hero">
                      <button
                        type="button"
                        class="shop-copy-snap-hero-controls__arrow"
                        data-shop-copy-carousel-step="-1"
                        aria-label="Poprzedni slajd"
                      >
                        <span aria-hidden="true">‹</span>
                      </button>
                      <div class="shop-copy-snap-hero-controls__pagination">
                        <div class="shop-copy-snap-hero-controls__count">
                          <span data-shop-copy-carousel-current>01</span>
                          <span>/</span>
                          <span data-shop-copy-carousel-total>${String(carouselSlides.length).padStart(2, "0")}</span>
                        </div>
                        <div class="shop-copy-snap-hero-controls__dots" aria-label="Paginacja slajdów">
                          ${carouselSlides.map((slide, index) => `
                            <button
                              type="button"
                              class="shop-copy-snap-hero-controls__dot${index === 0 ? " is-active" : ""}"
                              data-shop-copy-carousel-target="${index}"
                              aria-label="Przejdź do slajdu ${index + 1}: ${escapeHtml(slide.title || title)}"
                              aria-pressed="${index === 0 ? "true" : "false"}"
                            ></button>
                          `).join("")}
                        </div>
                      </div>
                      <button
                        type="button"
                        class="shop-copy-snap-hero-controls__arrow"
                        data-shop-copy-carousel-step="1"
                        aria-label="Następny slajd"
                      >
                        <span aria-hidden="true">›</span>
                      </button>
                    </div>
                  </div>

                  <aside class="shop-copy-hero-gallery" aria-label="Galeria produktu">
                    <div class="shop-copy-hero-gallery__stage">
                      <button
                        type="button"
                        class="shop-copy-hero-gallery__nav shop-copy-hero-gallery__nav--prev"
                        data-shop-copy-gallery-step="-1"
                        aria-label="Poprzednie zdjęcie"
                      >
                        <span aria-hidden="true">‹</span>
                      </button>
                      <div class="shop-copy-hero-gallery__carousel">
                        ${galleryItems.length
                          ? galleryItems.map((item, index) => `
                            <figure
                              class="shop-copy-hero-gallery__card${index === 0 ? " is-active" : index === 1 ? " is-next" : index === galleryItems.length - 1 ? " is-prev" : " is-hidden"}"
                              data-shop-copy-gallery-card
                              data-gallery-index="${index}"
                              aria-hidden="${index === 0 ? "false" : "true"}"
                            >
                              <div class="shop-copy-hero-gallery__card-frame">
                                <img
                                  class="shop-copy-hero-gallery__image"
                                  src="${escapeHtml(item.previewSrc)}"
                                  alt="${escapeHtml(item.alt)}"
                                  loading="${item.loading}"
                                  fetchpriority="${item.fetchPriority}"
                                  decoding="async"
                                >
                                <button
                                  type="button"
                                  class="shop-copy-hero-gallery__zoom"
                                  data-shop-copy-open-modal
                                  data-gallery-index="${index}"
                                  aria-label="Powiększ zdjęcie"
                                >
                                  <span aria-hidden="true">⌕</span>
                                </button>
                              </div>
                            </figure>
                          `).join("")
                          : `<div class="shop-copy-hero-gallery__placeholder">Dodaj zdjęcia produktu w CRM</div>`}
                      </div>
                      <button
                        type="button"
                        class="shop-copy-hero-gallery__nav shop-copy-hero-gallery__nav--next"
                        data-shop-copy-gallery-step="1"
                        aria-label="Następne zdjęcie"
                      >
                        <span aria-hidden="true">›</span>
                      </button>
                    </div>
                    <div class="shop-copy-hero-gallery__pagination" aria-label="Paginacja galerii">
                      ${galleryItems.map((item, index) => `
                        <button
                          type="button"
                          class="shop-copy-hero-gallery__dot${index === 0 ? " is-active" : ""}"
                          data-shop-copy-thumb
                          data-gallery-index="${index}"
                          data-image="${escapeHtml(item.previewSrc)}"
                          data-modal-image="${escapeHtml(item.modalSrc)}"
                          data-alt="${escapeHtml(item.alt)}"
                          aria-label="Pokaż zdjęcie ${index + 1}"
                          aria-pressed="${index === 0 ? "true" : "false"}"
                        ></button>
                      `).join("")}
                    </div>
                  </aside>
                </div>
              </section>

              ${sections.map((section, index) => `
                <section class="shop-copy-snap-panel shop-copy-snap-panel--story" data-shop-copy-snap-panel>
                  <div class="shop-copy-snap-panel__inner shop-copy-story-panel">
                    <div class="shop-copy-story-panel__copy">
                      <span class="shop-copy-intro__eyebrow">Moskitiery na wymiar</span>
                      <h3>${escapeHtml(section.title || `Sekcja ${index + 1}`)}</h3>
                      <p>${formatMultilineText(section.body || "")}</p>
                    </div>
                  </div>
                </section>
              `).join("")}

              <section class="shop-copy-snap-panel shop-copy-snap-panel--configurator" data-shop-copy-snap-panel>
                <div class="shop-copy-snap-panel__inner shop-copy-configurator-panel">
                  <div class="shop-copy-configurator-panel__copy">
                    <span class="shop-copy-intro__eyebrow">Konfigurator</span>
                    <h3>Skonfiguruj pierwszą moskitierę bez wychodzenia z landing page.</h3>
                  </div>
                  <div class="shop-copy-configurator-panel__frame" data-shop-copy-configurator-frame>
                    <div class="shop-copy-configurator-panel__viewport" data-shop-copy-configurator-viewport>
                      <div class="shop-copy-configurator-panel__mount" data-shop-copy-configurator-mount>
                        <div class="shop-copy-configurator-panel__loading">Ładowanie konfiguratora…</div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function ensureGalleryModal() {
    let modal = document.querySelector("[data-shop-copy-gallery-modal]");
    if (modal instanceof HTMLElement) return modal;

    modal = document.createElement("div");
    modal.className = "shop-copy-gallery-modal";
    modal.dataset.shopCopyGalleryModal = "true";
    modal.innerHTML = `
      <button type="button" class="shop-copy-gallery-modal__backdrop" data-shop-copy-close-modal aria-label="Zamknij podgląd"></button>
      <div class="shop-copy-gallery-modal__dialog" role="dialog" aria-modal="true" aria-label="Podgląd zdjęcia">
        <button type="button" class="shop-copy-gallery-modal__close" data-shop-copy-close-modal aria-label="Zamknij podgląd">×</button>
        <button type="button" class="shop-copy-gallery-modal__nav shop-copy-gallery-modal__nav--prev" data-shop-copy-modal-step="-1" aria-label="Poprzednie zdjęcie"><span aria-hidden="true">‹</span></button>
        <div class="shop-copy-gallery-modal__frame">
          <img class="shop-copy-gallery-modal__image" alt="">
        </div>
        <button type="button" class="shop-copy-gallery-modal__nav shop-copy-gallery-modal__nav--next" data-shop-copy-modal-step="1" aria-label="Następne zdjęcie"><span aria-hidden="true">›</span></button>
      </div>
    `;

    modal.addEventListener("click", (event) => {
      const closeTrigger = event.target instanceof Element ? event.target.closest("[data-shop-copy-close-modal]") : null;
      if (closeTrigger) {
        closeGalleryModal();
        return;
      }

      const stepTrigger = event.target instanceof Element ? event.target.closest("[data-shop-copy-modal-step]") : null;
      if (!(stepTrigger instanceof HTMLElement) || !galleryModalState?.items?.length) return;

      const step = Number.parseInt(stepTrigger.getAttribute("data-shop-copy-modal-step") || "0", 10);
      setGalleryModalIndex((galleryModalState.index || 0) + (Number.isFinite(step) ? step : 0));
    });

    const prevButton = modal.querySelector('[data-shop-copy-modal-step="-1"]');
    const nextButton = modal.querySelector('[data-shop-copy-modal-step="1"]');
    prevButton?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setGalleryModalIndex((galleryModalState?.index || 0) - 1);
    });
    nextButton?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setGalleryModalIndex((galleryModalState?.index || 0) + 1);
    });

    document.addEventListener("keydown", (event) => {
      if (document.body.dataset.shopCopyModalOpen !== "true") return;

      if (event.key === "Escape") {
        event.preventDefault();
        closeGalleryModal();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setGalleryModalIndex((galleryModalState?.index || 0) - 1);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setGalleryModalIndex((galleryModalState?.index || 0) + 1);
      }
    });

    document.body.appendChild(modal);
    return modal;
  }

  function setGalleryModalIndex(index) {
    if (!galleryModalState?.items?.length) return;

    const modal = ensureGalleryModal();
    const image = modal.querySelector(".shop-copy-gallery-modal__image");
    if (!(image instanceof HTMLImageElement)) return;

    const nextIndex = ((index % galleryModalState.items.length) + galleryModalState.items.length) % galleryModalState.items.length;
    const item = galleryModalState.items[nextIndex];

    image.src = item.modalSrc || item.previewSrc || "";
    image.alt = item.alt || "";
    galleryModalState.index = nextIndex;
  }

  function openGalleryModal(section, index) {
    const dots = Array.from(section.querySelectorAll("[data-shop-copy-thumb]")).filter((node) => node instanceof HTMLElement);
    if (!dots.length) return;

    galleryModalState = {
      items: dots.map((node) => ({
        previewSrc: String(node.getAttribute("data-image") || "").trim(),
        modalSrc: String(node.getAttribute("data-modal-image") || "").trim(),
        alt: String(node.getAttribute("data-alt") || "").trim(),
      })),
      index: 0,
    };

    ensureGalleryModal();
    document.body.dataset.shopCopyModalOpen = "true";
    setGalleryModalIndex(index);
  }

  function closeGalleryModal() {
    document.body.dataset.shopCopyModalOpen = "false";
  }

  function updateConfiguratorPanelScale(section) {
    const frame = section.querySelector("[data-shop-copy-configurator-frame]");
    const viewport = section.querySelector("[data-shop-copy-configurator-viewport]");
    const mount = section.querySelector("[data-shop-copy-configurator-mount]");
    const grid = mount?.querySelector(".shop-copy-layout-grid");
    if (!(frame instanceof HTMLElement) || !(viewport instanceof HTMLElement) || !(mount instanceof HTMLElement) || !(grid instanceof HTMLElement)) {
      return;
    }

    const naturalWidth = Math.max(grid.scrollWidth, grid.offsetWidth, 1);
    const naturalHeight = Math.max(grid.scrollHeight, grid.offsetHeight, 1);
    const availableWidth = Math.max(frame.clientWidth - 8, 320);
    const availableHeight = Math.max(frame.clientHeight - 8, 320);
    const scale = Math.min(availableWidth / naturalWidth, availableHeight / naturalHeight, 1);
    const scaledWidth = Math.max(320, Math.floor(naturalWidth * scale));
    const scaledHeight = Math.max(280, Math.floor(naturalHeight * scale));

    viewport.style.width = `${scaledWidth}px`;
    viewport.style.height = `${scaledHeight}px`;
    mount.style.width = `${naturalWidth}px`;
    mount.style.height = `${naturalHeight}px`;
    mount.style.transform = `scale(${scale})`;
    mount.dataset.shopCopyScale = String(scale);
  }

  function mountConfiguratorIntoIntro(section, grid) {
    const mount = section.querySelector("[data-shop-copy-configurator-mount]");
    if (!(mount instanceof HTMLElement) || !(grid instanceof HTMLElement)) return;

    if (grid.parentNode !== mount) {
      mount.innerHTML = "";
      mount.appendChild(grid);
    }

    grid.classList.add("shop-copy-layout-grid--embedded");

    const refreshScale = () => updateConfiguratorPanelScale(section);
    window.requestAnimationFrame(refreshScale);
    [120, 320, 900].forEach((delay) => window.setTimeout(refreshScale, delay));

    if (section.dataset.shopCopyConfigResizeBound !== "true") {
      section.dataset.shopCopyConfigResizeBound = "true";
      window.addEventListener("resize", refreshScale);
    }
  }

  function setActiveSnapPanel(section, index) {
    const landing = section.querySelector("[data-shop-copy-snap-landing]");
    const track = section.querySelector("[data-shop-copy-snap-track]");
    const panels = Array.from(section.querySelectorAll("[data-shop-copy-snap-panel]")).filter((node) => node instanceof HTMLElement);
    if (!(landing instanceof HTMLElement) || !(track instanceof HTMLElement) || !panels.length) return;

    const nextIndex = Math.max(0, Math.min(index, panels.length - 1));
    landing.dataset.shopCopySnapIndex = String(nextIndex);
    track.style.transform = `translate3d(0, calc(-${nextIndex} * var(--shop-copy-snap-panel-height, 0px)), 0)`;

    const targetButtons = Array.from(section.querySelectorAll("[data-shop-copy-snap-target]")).filter((node) => node instanceof HTMLElement);
    const activeTargetIndex = targetButtons.length ? Math.min(nextIndex, targetButtons.length - 1) : nextIndex;
    targetButtons.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      const isActive = Number.parseInt(node.getAttribute("data-shop-copy-snap-target") || "0", 10) === activeTargetIndex;
      node.classList.toggle("is-active", isActive);
      node.setAttribute("aria-current", isActive ? "true" : "false");
    });

  }

  function setActiveCarouselSlide(section, index) {
    const slides = Array.from(section.querySelectorAll("[data-shop-copy-carousel-slide]")).filter((node) => node instanceof HTMLElement);
    if (!slides.length) return;

    const nextIndex = ((index % slides.length) + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      slide.classList.toggle("is-active", slideIndex === nextIndex);
    });

    const heroDots = Array.from(section.querySelectorAll(".shop-copy-snap-hero-controls__dot")).filter((node) => node instanceof HTMLElement);
    heroDots.forEach((node, dotIndex) => {
      const isActive = dotIndex === nextIndex;
      node.classList.toggle("is-active", isActive);
      node.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    const currentLabel = section.querySelector("[data-shop-copy-carousel-current]");
    if (currentLabel instanceof HTMLElement) {
      currentLabel.textContent = String(nextIndex + 1).padStart(2, "0");
    }

    section.dataset.shopCopyCarouselIndex = String(nextIndex);
  }

  function setActiveGalleryIndex(section, index) {
    const dots = Array.from(section.querySelectorAll("[data-shop-copy-thumb]")).filter((node) => node instanceof HTMLElement);
    const cards = Array.from(section.querySelectorAll("[data-shop-copy-gallery-card]")).filter((node) => node instanceof HTMLElement);
    if (!dots.length || !cards.length) return;

    const nextIndex = ((index % dots.length) + dots.length) % dots.length;

    dots.forEach((node, dotIndex) => {
      const isActive = dotIndex === nextIndex;
      node.classList.toggle("is-active", isActive);
      node.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    cards.forEach((node, cardIndex) => {
      node.classList.remove("is-active", "is-prev", "is-next", "is-hidden");

      const forwardDistance = (cardIndex - nextIndex + cards.length) % cards.length;
      const backwardDistance = (nextIndex - cardIndex + cards.length) % cards.length;

      let state = "is-hidden";
      if (cardIndex === nextIndex) {
        state = "is-active";
      } else if (cards.length === 2) {
        state = "is-next";
      } else if (forwardDistance === 1) {
        state = "is-next";
      } else if (backwardDistance === 1) {
        state = "is-prev";
      }

      node.classList.add(state);
      node.setAttribute("aria-hidden", state === "is-active" ? "false" : "true");
    });

    section.dataset.shopCopyGalleryIndex = String(nextIndex);
  }

  function bindIntroInteractions(section) {
    if (section.dataset.shopCopyBound === "true") return;

    const snapLanding = section.querySelector("[data-shop-copy-snap-landing]");
    const stage = section.querySelector(".shop-copy-hero-gallery__stage");
    let snapCooldownUntil = 0;
    let touchStartX = 0;

    section.addEventListener("click", (event) => {
      const zoomButton = event.target instanceof Element ? event.target.closest("[data-shop-copy-open-modal]") : null;
      if (zoomButton instanceof HTMLElement) {
        const index = Number.parseInt(zoomButton.getAttribute("data-gallery-index") || "0", 10);
        openGalleryModal(section, Number.isFinite(index) ? index : 0);
        return;
      }

      const thumb = event.target instanceof Element ? event.target.closest("[data-shop-copy-thumb]") : null;
      if (thumb instanceof HTMLElement) {
        const index = Number.parseInt(thumb.getAttribute("data-gallery-index") || "0", 10);
        setActiveGalleryIndex(section, Number.isFinite(index) ? index : 0);
        return;
      }

      const stepButton = event.target instanceof Element ? event.target.closest("[data-shop-copy-gallery-step]") : null;
      if (!(stepButton instanceof HTMLElement)) return;

      event.preventDefault();
      event.stopPropagation();
      const currentIndex = Number.parseInt(section.dataset.shopCopyGalleryIndex || "0", 10);
      const step = Number.parseInt(stepButton.getAttribute("data-shop-copy-gallery-step") || "0", 10);
      setActiveGalleryIndex(section, (Number.isFinite(currentIndex) ? currentIndex : 0) + (Number.isFinite(step) ? step : 0));
      return;
    });

    section.addEventListener("click", (event) => {
      const snapButton = event.target instanceof Element ? event.target.closest("[data-shop-copy-snap-target]") : null;
      if (snapButton instanceof HTMLElement) {
        const nextIndex = Number.parseInt(snapButton.getAttribute("data-shop-copy-snap-target") || "0", 10);
        setActiveSnapPanel(section, Number.isFinite(nextIndex) ? nextIndex : 0);
        return;
      }

      const carouselTarget = event.target instanceof Element ? event.target.closest("[data-shop-copy-carousel-target]") : null;
      if (carouselTarget instanceof HTMLElement) {
        const nextIndex = Number.parseInt(carouselTarget.getAttribute("data-shop-copy-carousel-target") || "0", 10);
        setActiveCarouselSlide(section, Number.isFinite(nextIndex) ? nextIndex : 0);
        return;
      }

      const carouselStep = event.target instanceof Element ? event.target.closest("[data-shop-copy-carousel-step]") : null;
      if (carouselStep instanceof HTMLElement) {
        const slides = Array.from(section.querySelectorAll("[data-shop-copy-carousel-slide]")).filter((node) => node instanceof HTMLElement);
        const total = slides.length || 1;
        const currentIndex = Number.parseInt(section.dataset.shopCopyCarouselIndex || "0", 10) || 0;
        const step = Number.parseInt(carouselStep.getAttribute("data-shop-copy-carousel-step") || "0", 10);
        const nextIndex = ((currentIndex + (Number.isFinite(step) ? step : 0)) % total + total) % total;
        setActiveCarouselSlide(section, nextIndex);
        return;
      }

      const goConfigurator = event.target instanceof Element ? event.target.closest("[data-shop-copy-go-configurator]") : null;
      if (goConfigurator instanceof HTMLElement) {
        const panels = Array.from(section.querySelectorAll("[data-shop-copy-snap-panel]")).filter((node) => node instanceof HTMLElement);
        setActiveSnapPanel(section, Math.max(0, panels.length - 1));
      }
    });

    stage?.addEventListener("touchstart", (event) => {
      touchStartX = event.touches[0]?.clientX || 0;
    }, { passive: true });

    stage?.addEventListener("touchend", (event) => {
      const endX = event.changedTouches[0]?.clientX || 0;
      const deltaX = endX - touchStartX;
      if (Math.abs(deltaX) < 48) return;

      const currentIndex = Number.parseInt(section.dataset.shopCopyGalleryIndex || "0", 10);
      setActiveGalleryIndex(section, (Number.isFinite(currentIndex) ? currentIndex : 0) + (deltaX < 0 ? 1 : -1));
    }, { passive: true });

    stage?.addEventListener("wheel", (event) => {
      if (Math.abs(event.deltaX) < 24 && Math.abs(event.deltaY) < 24) return;
      if (Math.abs(event.deltaX) < Math.abs(event.deltaY)) return;
      event.preventDefault();
      const currentIndex = Number.parseInt(section.dataset.shopCopyGalleryIndex || "0", 10);
      setActiveGalleryIndex(section, (Number.isFinite(currentIndex) ? currentIndex : 0) + (event.deltaX > 0 ? 1 : -1));
    }, { passive: false });

    window.requestAnimationFrame(() => {
      setActiveSnapPanel(section, Number.parseInt(section.dataset.shopCopySnapIndex || "0", 10) || 0);
      setActiveCarouselSlide(section, Number.parseInt(section.dataset.shopCopyCarouselIndex || "0", 10) || 0);
      setActiveGalleryIndex(section, Number.parseInt(section.dataset.shopCopyGalleryIndex || "0", 10) || 0);
    });

    snapLanding?.addEventListener("wheel", (event) => {
      if (window.innerWidth < 981) return;
      if (Math.abs(event.deltaY) < 18) return;

      event.preventDefault();
      if (performance.now() < snapCooldownUntil) return;

      const panels = Array.from(section.querySelectorAll("[data-shop-copy-snap-panel]")).filter((node) => node instanceof HTMLElement);
      const currentIndex = Number.parseInt(snapLanding.getAttribute("data-shop-copy-snap-index") || section.dataset.shopCopySnapIndex || "0", 10) || 0;
      const nextIndex = Math.max(0, Math.min(currentIndex + (event.deltaY > 0 ? 1 : -1), panels.length - 1));

      if (nextIndex === currentIndex) {
        return;
      }

      snapCooldownUntil = performance.now() + 900;
      setActiveSnapPanel(section, nextIndex);
    }, { passive: false });

    section.dataset.shopCopyBound = "true";
  }

  function getConfiguratorLayout(main) {
    const summaryPanel = main.querySelector("aside.showcase-panel");
    const grid = summaryPanel?.parentElement instanceof HTMLElement ? summaryPanel.parentElement : null;
    const contentColumn = grid
      ? Array.from(grid.children).find((node) => node !== summaryPanel && node.classList.contains("showcase-scroll"))
      : null;
    const contentInner = contentColumn?.firstElementChild instanceof HTMLElement ? contentColumn.firstElementChild : null;
    const contentInnerChildren = contentInner
      ? Array.from(contentInner.children).filter((node) => node instanceof HTMLElement)
      : [];
    const legacyHeader = contentInnerChildren[0] instanceof HTMLElement ? contentInnerChildren[0] : null;
    const legacySteps = contentInnerChildren[1] instanceof HTMLElement ? contentInnerChildren[1] : null;

    return {
      grid: grid instanceof HTMLElement ? grid : null,
      contentColumn: contentColumn instanceof HTMLElement ? contentColumn : null,
      summaryPanel: summaryPanel instanceof HTMLElement ? summaryPanel : null,
      contentInner: contentInner instanceof HTMLElement ? contentInner : null,
      legacyHeader: legacyHeader instanceof HTMLElement ? legacyHeader : null,
      legacySteps: legacySteps instanceof HTMLElement ? legacySteps : null,
    };
  }

  function hideLegacyTopBar(main) {
    const viewportContent = main.querySelector(".viewport-card > .relative.flex");
    if (!(viewportContent instanceof HTMLElement)) return;

    Array.from(viewportContent.children).forEach((child) => {
      if (!(child instanceof HTMLElement)) return;
      if (child.hasAttribute("data-shop-copy-intro")) return;
      if (child.classList.contains("grid") && child.classList.contains("flex-1")) return;
      child.classList.add("shop-copy-legacy-topbar");
    });
  }

  function lockIntroAtTop(contentColumn) {
    if (!(contentColumn instanceof HTMLElement)) return;

    const reset = () => {
      contentColumn.style.height = "auto";
      contentColumn.style.maxHeight = "none";
      contentColumn.style.overflow = "visible";
      contentColumn.style.overflowY = "visible";
      contentColumn.style.scrollBehavior = "auto";
      contentColumn.scrollTop = 0;
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.scrollTo(0, 0);
    };

    reset();
    [80, 220, 500, 900, 1500].forEach((delay) => {
      window.setTimeout(reset, delay);
    });
  }

  function ensureHeader() {
    if (document.querySelector("[data-shop-copy-header]")) return;

    const header = document.createElement("div");
    header.className = "shop-copy-header";
    header.dataset.shopCopyHeader = "true";
    header.innerHTML = `
      <div class="shop-copy-header__inner">
        <div class="shop-copy-nav-bar">
          <button type="button" class="shop-copy-menu-button" aria-expanded="false" aria-controls="shop-copy-menu">
            <span class="shop-copy-menu-button__icon"><span></span></span>
            <span>Menu</span>
          </button>
          <nav class="shop-copy-desktop-nav" aria-label="Główne menu sklepu">
            ${MENU_ITEMS.map((item) => `<a href="${item.href}">${item.label}</a>`).join("")}
          </nav>
        </div>
      </div>
    `;

    const backdrop = document.createElement("button");
    backdrop.type = "button";
    backdrop.className = "shop-copy-menu-backdrop";
    backdrop.setAttribute("aria-label", "Zamknij menu");

    const drawer = document.createElement("aside");
    drawer.className = "shop-copy-menu-drawer";
    drawer.id = "shop-copy-menu";
    drawer.setAttribute("aria-label", "Menu sklepu");
    drawer.innerHTML = `
      <div class="shop-copy-menu-drawer__eyebrow">Sklep KEIKA</div>
      <h2 class="shop-copy-menu-drawer__title">Moskitiery na wymiar</h2>
      <nav class="shop-copy-menu-links">
        ${MENU_ITEMS.map((item) => `<a href="${item.href}">${item.label}</a>`).join("")}
      </nav>
    `;

    function closeMenu() {
      document.body.dataset.shopMenuOpen = "false";
      const button = header.querySelector(".shop-copy-menu-button");
      if (button) button.setAttribute("aria-expanded", "false");
    }

    function toggleMenu() {
      const open = document.body.dataset.shopMenuOpen === "true";
      document.body.dataset.shopMenuOpen = open ? "false" : "true";
      const button = header.querySelector(".shop-copy-menu-button");
      if (button) button.setAttribute("aria-expanded", open ? "false" : "true");
    }

    header.querySelector(".shop-copy-menu-button")?.addEventListener("click", toggleMenu);
    backdrop.addEventListener("click", closeMenu);
    drawer.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));

    document.body.appendChild(header);
    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);
  }

  function ensureIntro() {
    const main = document.querySelector("main");
    if (!(main instanceof HTMLElement) || !main.parentNode) return;

    main.classList.add("shop-copy-main-target");
    hideLegacyTopBar(main);

    const { grid, contentColumn, summaryPanel, contentInner, legacyHeader, legacySteps } = getConfiguratorLayout(main);
    const viewportContent = main.querySelector(".viewport-card > .relative.flex");

    let section = document.querySelector("[data-shop-copy-intro]");
    if (!(section instanceof HTMLElement)) {
      section = document.createElement("section");
      section.className = "shop-copy-intro";
      section.dataset.shopCopyIntro = "true";
      section.innerHTML = `
        <div class="shop-copy-intro__card">
          <div class="shop-copy-intro__loading">Ładowanie galerii produktu…</div>
        </div>
      `;
    }

    if (contentColumn instanceof HTMLElement) {
      section.classList.remove("shop-copy-intro--embedded");
      contentColumn.classList.add("shop-copy-config-column");
      if (grid instanceof HTMLElement) {
        grid.classList.add("shop-copy-layout-grid");
        grid.style.overflow = "visible";
        grid.style.height = "auto";
      }
      if (contentInner instanceof HTMLElement) {
        contentInner.classList.add("shop-copy-config-inner");
      }
      if (legacyHeader instanceof HTMLElement) {
        legacyHeader.classList.add("shop-copy-legacy-header");
      }
      if (legacySteps instanceof HTMLElement) {
        legacySteps.classList.add("shop-copy-legacy-steps");
      }
      if (summaryPanel instanceof HTMLElement) {
        summaryPanel.classList.add("shop-copy-summary-panel");
      }

      const configuratorStart = legacySteps instanceof HTMLElement
        ? legacySteps
        : Array.from(contentInner?.children || []).find((node) => node !== section);

      if (viewportContent instanceof HTMLElement) {
        const firstChild = viewportContent.firstElementChild;
        if (section.parentNode !== viewportContent) {
          viewportContent.insertBefore(section, firstChild || null);
        } else if (firstChild !== section) {
          viewportContent.insertBefore(section, firstChild || null);
        }
      } else if (section.parentNode !== main.parentNode) {
        main.parentNode.insertBefore(section, main);
      }

      if (main.id === "shop-copy-configurator") {
        main.removeAttribute("id");
      }

      if (configuratorStart instanceof HTMLElement) {
        configuratorStart.id = "shop-copy-configurator";
        configuratorStart.classList.add("shop-copy-configurator-start");
      }

      if (section.dataset.shopCopyInitialScroll !== "done") {
        section.dataset.shopCopyInitialScroll = "done";
        window.requestAnimationFrame(() => {
          lockIntroAtTop(contentColumn);
        });
      }
    } else {
      main.id = "shop-copy-configurator";
      if (section.parentNode !== main.parentNode) {
        main.parentNode.insertBefore(section, main);
      }
    }

    if (section.dataset.shopCopyReady === "true" || section.dataset.shopCopyLoading === "true") {
      return;
    }

    section.dataset.shopCopyLoading = "true";
    fetchIntroData()
      .then((data) => {
        section.innerHTML = buildIntroMarkup(data);
        bindIntroInteractions(section);
        if (grid instanceof HTMLElement) {
          mountConfiguratorIntoIntro(section, grid);
        }
        section.dataset.shopCopyReady = "true";
      })
      .catch(() => {
        section.innerHTML = buildIntroMarkup(fallbackIntroData());
        bindIntroInteractions(section);
        if (grid instanceof HTMLElement) {
          mountConfiguratorIntoIntro(section, grid);
        }
        section.dataset.shopCopyReady = "true";
      })
      .finally(() => {
        section.dataset.shopCopyLoading = "false";
      });
  }

  function replaceTextNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];

    while (walker.nextNode()) {
      const parentTag = walker.currentNode.parentElement?.tagName || "";
      if (parentTag === "SCRIPT" || parentTag === "STYLE" || parentTag === "NOSCRIPT") {
        continue;
      }
      nodes.push(walker.currentNode);
    }

    nodes.forEach((node) => {
      const original = node.nodeValue || "";
      let next = original;

      TEXT_REPLACEMENTS.forEach(([from, to]) => {
        if (next.includes(from)) {
          next = next.replaceAll(from, to);
        }
      });

      if (next !== original) {
        node.nodeValue = next;
      }
    });
  }

  function hideAllegroElements(root) {
    root.querySelectorAll('a[href*="allegro.pl"]').forEach((link) => {
      link.classList.add("shop-copy-hidden");
      link.removeAttribute("href");
    });

    root.querySelectorAll("a, button, p, span, div").forEach((element) => {
      const text = (element.textContent || "").trim();
      if (!text) return;

      if (HIDE_PATTERNS.some((pattern) => pattern.test(text))) {
        if (text.length < 120 || /powiązaną ofert|aukcj/i.test(text)) {
          element.classList.add("shop-copy-hidden");
        }
      }
    });
  }

  function enhance() {
    document.body.classList.add("shop-copy-enhanced");
    if (!document.body.dataset.shopMenuOpen) {
      document.body.dataset.shopMenuOpen = "false";
    }
    setMeta();
    document.querySelectorAll("[data-shop-copy-header], .shop-copy-menu-backdrop, .shop-copy-menu-drawer").forEach((node) => node.remove());
    ensureIntro();
    replaceTextNodes(document.body);
    hideAllegroElements(document.body);
  }

  let frame = 0;
  const observer = new MutationObserver(() => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      enhance();
    });
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhance, { once: true });
  } else {
    enhance();
  }

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
