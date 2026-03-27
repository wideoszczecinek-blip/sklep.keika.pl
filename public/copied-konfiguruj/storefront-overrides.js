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
    const activeImage = gallery[0] || "";
    const activeAlt = data?.name || "Moskitiery ramkowe";
    const title = String(data?.title || data?.name || "Moskitiery ramkowe").trim() || "Moskitiery ramkowe";
    const subtitleLines = Array.isArray(data?.subtitle_lines) && data.subtitle_lines.length
      ? data.subtitle_lines
      : fallbackIntroData().subtitle_lines;

    return `
      <div class="shop-copy-intro__card">
        <div class="shop-copy-intro__heading">
          <span class="shop-copy-intro__eyebrow">Moskitiery</span>
          <h2 class="shop-copy-intro__title">${escapeHtml(title)}</h2>
          <div class="shop-copy-intro__subtitle">
            ${subtitleLines.map((line) => `<p>${formatMultilineText(line)}</p>`).join("")}
          </div>
        </div>
        <div class="shop-copy-intro__body">
          <div class="shop-copy-hero-gallery">
            <div class="shop-copy-hero-gallery__stage">
              ${activeImage
                ? `<img class="shop-copy-hero-gallery__image" data-shop-copy-main-image src="${escapeHtml(activeImage)}" alt="${escapeHtml(activeAlt)}">`
                : `<div class="shop-copy-hero-gallery__placeholder">Dodaj zdjęcia produktu w CRM</div>`}
              <div class="shop-copy-hero-gallery__overlay">
                <span class="shop-copy-intro__eyebrow">Moskitiery</span>
                <strong>${escapeHtml(data?.name || "Moskitiery ramkowe")}</strong>
                ${data?.price_from ? `<span class="shop-copy-hero-gallery__price">${escapeHtml(data.price_from)}</span>` : ""}
              </div>
            </div>
            <div class="shop-copy-hero-gallery__thumbs">
              ${gallery.map((imageUrl, index) => `
                <button
                  type="button"
                  class="shop-copy-hero-gallery__thumb${index === 0 ? " is-active" : ""}"
                  data-shop-copy-thumb
                  data-image="${escapeHtml(imageUrl)}"
                  data-alt="${escapeHtml(`${data?.name || "Moskitiery"} ${index + 1}`)}"
                  aria-label="Pokaż zdjęcie ${index + 1}"
                >
                  <span
                    class="shop-copy-hero-gallery__thumb-image"
                    style="background-image:url('${escapeHtml(imageUrl)}')"
                    aria-hidden="true"
                  ></span>
                  <span class="shop-copy-hero-gallery__thumb-copy">
                    <strong>Zdjęcie ${index + 1}</strong>
                    <small>${index === 0 ? "Widok główny produktu" : "Kliknij, aby zobaczyć to ujęcie"}</small>
                  </span>
                </button>
              `).join("")}
            </div>
          </div>
          <div class="shop-copy-hero-details">
            <div class="shop-copy-hero-details__header">
              <span class="shop-copy-hero-details__label">Opis produktu</span>
            </div>
            <div class="shop-copy-accordion-list">
              ${sections.map((section, index) => `
                <details class="shop-copy-accordion" ${index === 0 ? "open" : ""}>
                  <summary>${escapeHtml(section.title || `Sekcja ${index + 1}`)}</summary>
                  <div class="shop-copy-accordion__body">${formatMultilineText(section.body || "")}</div>
                </details>
              `).join("")}
            </div>
            <div class="shop-copy-intro__cta-row">
              <a class="shop-copy-intro__primary" href="#shop-copy-configurator">Zacznij konfigurację</a>
              <a class="shop-copy-intro__secondary" href="/kontakt">Zapytaj o montaż</a>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function bindIntroInteractions(section) {
    if (section.dataset.shopCopyBound === "true") return;

    section.addEventListener("click", (event) => {
      const thumb = event.target instanceof Element ? event.target.closest("[data-shop-copy-thumb]") : null;
      if (!(thumb instanceof HTMLElement)) return;

      const imageUrl = String(thumb.getAttribute("data-image") || "").trim();
      const altText = String(thumb.getAttribute("data-alt") || "").trim();
      const mainImage = section.querySelector("[data-shop-copy-main-image]");

      if (mainImage instanceof HTMLImageElement && imageUrl) {
        mainImage.src = imageUrl;
        mainImage.alt = altText || mainImage.alt;
      }

      section.querySelectorAll("[data-shop-copy-thumb]").forEach((node) => {
        node.classList.toggle("is-active", node === thumb);
      });
    });

    section.dataset.shopCopyBound = "true";
  }

  function getConfiguratorLayout(main) {
    const summaryPanel = main.querySelector("aside.showcase-panel");
    const grid = summaryPanel?.parentElement instanceof HTMLElement ? summaryPanel.parentElement : null;
    const contentColumn = grid
      ? Array.from(grid.children).find((node) => node !== summaryPanel && node.classList.contains("showcase-scroll"))
      : null;

    return {
      grid: grid instanceof HTMLElement ? grid : null,
      contentColumn: contentColumn instanceof HTMLElement ? contentColumn : null,
      summaryPanel: summaryPanel instanceof HTMLElement ? summaryPanel : null,
    };
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

    const { contentColumn, summaryPanel } = getConfiguratorLayout(main);

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
      section.classList.add("shop-copy-intro--embedded");
      contentColumn.classList.add("shop-copy-config-column");
      if (summaryPanel instanceof HTMLElement) {
        summaryPanel.classList.add("shop-copy-summary-panel");
      }

      const configuratorStart = Array.from(contentColumn.children).find((node) => node !== section);
      if (section.parentNode !== contentColumn) {
        contentColumn.insertBefore(section, configuratorStart instanceof Node ? configuratorStart : null);
      }

      if (main.id === "shop-copy-configurator") {
        main.removeAttribute("id");
      }

      if (configuratorStart instanceof HTMLElement) {
        configuratorStart.id = "shop-copy-configurator";
        configuratorStart.classList.add("shop-copy-configurator-start");
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
        section.dataset.shopCopyReady = "true";
      })
      .catch(() => {
        section.innerHTML = buildIntroMarkup(fallbackIntroData());
        bindIntroInteractions(section);
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
    ensureHeader();
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
