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

  function setMeta() {
    document.title = "KEIKA | Moskitiery na wymiar";
    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute("content", "Moskitiera na wymiar z konfiguracją online, opisem produktu i zakupem bezpośrednio w sklepie KEIKA.");
    }
  }

  function ensureHeader() {
    if (document.querySelector("[data-shop-copy-header]")) return;

    const header = document.createElement("div");
    header.className = "shop-copy-header";
    header.dataset.shopCopyHeader = "true";
    header.innerHTML = `
      <div class="shop-copy-header__inner">
        <button type="button" class="shop-copy-menu-button" aria-expanded="false" aria-controls="shop-copy-menu">
          <span class="shop-copy-menu-button__icon"><span></span></span>
          <span>Menu</span>
        </button>
        <a class="shop-copy-config-link" href="#shop-copy-configurator">Przejdź do konfiguratora</a>
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
      const button = header.querySelector("button");
      if (button) button.setAttribute("aria-expanded", "false");
    }

    function toggleMenu() {
      const open = document.body.dataset.shopMenuOpen === "true";
      document.body.dataset.shopMenuOpen = open ? "false" : "true";
      const button = header.querySelector("button");
      if (button) button.setAttribute("aria-expanded", open ? "false" : "true");
    }

    header.querySelector("button")?.addEventListener("click", toggleMenu);
    backdrop.addEventListener("click", closeMenu);
    drawer.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));

    document.body.appendChild(header);
    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);
  }

  function ensureIntro() {
    if (document.querySelector("[data-shop-copy-intro]")) return;

    const main = document.querySelector("main");
    if (!main || !main.parentNode) return;

    main.classList.add("shop-copy-main-target");
    main.id = "shop-copy-configurator";

    const section = document.createElement("section");
    section.className = "shop-copy-intro";
    section.dataset.shopCopyIntro = "true";
    section.innerHTML = `
      <div class="shop-copy-intro__card">
        <span class="shop-copy-intro__eyebrow">Moskitiera na wymiar</span>
        <div class="shop-copy-intro__grid">
          <div>
            <h1 class="shop-copy-intro__title">Świeże powietrze bez komarów i bez kompromisów.</h1>
            <p class="shop-copy-intro__lead">
              Zamawiasz moskitierę dopasowaną do konkretnego okna, z podglądem koloru profilu, siatki i dokładnym wyliczeniem ceny.
              Najpierw pokazujemy produkt i jego zalety, a dopiero potem przechodzisz do konfiguracji.
            </p>
            <ul class="shop-copy-intro__points">
              <li>Wzmocniona siatka i estetyczny profil dopasowany do stolarki.</li>
              <li>Dokładne wymiary w milimetrach, dzięki czemu zamawiasz wariant na swoje okno.</li>
              <li>Konfigurator prowadzi krok po kroku i od razu pokazuje, jak będzie wyglądał wybrany zestaw.</li>
            </ul>
            <div class="shop-copy-intro__cta-row">
              <a class="shop-copy-intro__primary" href="#shop-copy-configurator">Zacznij konfigurację</a>
              <a class="shop-copy-intro__secondary" href="/kontakt">Zapytaj o montaż</a>
            </div>
          </div>
          <div class="shop-copy-intro__side">
            <div class="shop-copy-intro__fact">
              <strong>Dla kogo</strong>
              <span>Dla osób, które chcą kupić moskitierę online, ale najpierw chcą zrozumieć produkt i zobaczyć efekt przed zamówieniem.</span>
            </div>
            <div class="shop-copy-intro__fact">
              <strong>Co dostajesz</strong>
              <span>Wycena, podgląd wariantu i prostą ścieżkę do złożenia zamówienia bez wychodzenia do zewnętrznych marketplace’ów.</span>
            </div>
          </div>
        </div>
      </div>
    `;

    main.parentNode.insertBefore(section, main);
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
