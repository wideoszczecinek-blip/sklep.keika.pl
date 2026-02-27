type Tile = {
  title: string;
  subtitle: string;
  price: string;
  image: string;
  href: string;
};

type MenuGroup = {
  id: string;
  title: string;
  items: { label: string; href: string }[];
};

const menuGroups: MenuGroup[] = [
  {
    id: "oslony-wewnetrzne",
    title: "Osłony wewnętrzne",
    items: [
      { label: "Rolety tradycyjne", href: "#konfigurator" },
      { label: "Rolety dzień noc", href: "#konfigurator" },
      { label: "Plisy", href: "#konfigurator" },
      { label: "Żaluzje", href: "#konfigurator" },
      { label: "Rolety rzymskie", href: "#konfigurator" },
      { label: "Rolety do okien dachowych", href: "#konfigurator" },
    ],
  },
  {
    id: "oslony-zewnetrzne",
    title: "Osłony zewnętrzne",
    items: [
      { label: "Rolety zewnętrzne", href: "#konfigurator" },
      { label: "Żaluzje fasadowe", href: "#konfigurator" },
      { label: "Screeny", href: "#konfigurator" },
    ],
  },
  {
    id: "taras",
    title: "Taras",
    items: [
      { label: "Markizy", href: "#konfigurator" },
      { label: "Zadaszenia", href: "#konfigurator" },
      { label: "Shuttersy", href: "#konfigurator" },
    ],
  },
];

const heroSlides = [
  "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=2200&q=80",
  "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=2200&q=80",
  "https://images.unsplash.com/photo-1615529162924-f860538846cc?auto=format&fit=crop&w=2200&q=80",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2200&q=80",
];

const categories: Tile[] = [
  {
    title: "Rolety",
    subtitle: "Screen, dzień noc i zaciemniające",
    price: "od 249 zł",
    image:
      "https://images.unsplash.com/photo-1617098474202-0cdbfda8d3f5?auto=format&fit=crop&w=1600&q=80",
    href: "#konfigurator",
  },
  {
    title: "Markizy",
    subtitle: "Tarasowe i balkonowe premium",
    price: "od 2 990 zł",
    image:
      "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1600&q=80",
    href: "#konfigurator",
  },
  {
    title: "Moskitiery",
    subtitle: "Ramkowe i przesuwne na wymiar",
    price: "od 149 zł",
    image:
      "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1600&q=80",
    href: "#konfigurator",
  },
  {
    title: "Shuttersy",
    subtitle: "Nowoczesne panele i osłony tarasu",
    price: "od 1 190 zł",
    image:
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1600&q=80",
    href: "#konfigurator",
  },
];

const products: Tile[] = [
  {
    title: "Roleta Zaciemniająca PRO",
    subtitle: "Najczęściej wybierana do sypialni",
    price: "539 zł",
    image:
      "https://images.unsplash.com/photo-1616137466211-f939a420be84?auto=format&fit=crop&w=1600&q=80",
    href: "#konfigurator",
  },
  {
    title: "Markiza LUX Shadow",
    subtitle: "Bestseller na nowoczesne tarasy",
    price: "4 290 zł",
    image:
      "https://images.unsplash.com/photo-1615529182904-14819c35db37?auto=format&fit=crop&w=1600&q=80",
    href: "#konfigurator",
  },
  {
    title: "Żaluzja Fasadowa AIR",
    subtitle: "Mocna ochrona przed słońcem",
    price: "1 890 zł",
    image:
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1600&q=80",
    href: "#konfigurator",
  },
];

const trustBadges = [
  "Produkcja w Polsce",
  "Konfigurator na żywo",
  "Obsługa klienta 7 dni",
  "Montaż i serwis",
];

const steps = [
  {
    title: "1. Konfigurujesz",
    text: "Wybierasz typ osłony, wymiary i dodatki. Cena aktualizuje się od razu.",
  },
  {
    title: "2. Potwierdzasz",
    text: "Dostajesz pełną specyfikację i termin realizacji, bez ukrytych kosztów.",
  },
  {
    title: "3. Montujesz",
    text: "Wysyłamy gotowy zestaw lub organizujemy montaż w Twoim regionie.",
  },
];

export default function Home() {
  return (
    <div className="storefront">
      <header className="topbar">
        <a className="brand" href="/" aria-label="KEIKA - strona główna">
          KEIKA
        </a>

        <nav className="mega-nav" aria-label="Główna nawigacja sklepu">
          <ul className="menu-root">
            {menuGroups.map((group) => (
              <li key={group.id} className="menu-item">
                <a className="menu-link" href={`#${group.id}`}>
                  {group.title}
                </a>
                <div className="submenu" role="menu" aria-label={`${group.title} podmenu`}>
                  {group.items.map((item) => (
                    <a key={item.label} href={item.href} role="menuitem">
                      {item.label}
                    </a>
                  ))}
                </div>
              </li>
            ))}
            <li className="menu-item menu-item-contact">
              <a className="menu-link" href="#kontakt">
                Kontakt
              </a>
            </li>
          </ul>
        </nav>

        <div className="topbar-actions">
          <a className="link-quiet" href="tel:+48123456789">
            +48 123 456 789
          </a>
          <a className="cart-link" href="#konfigurator">
            Konfigurator
          </a>
        </div>
      </header>

      <div className="mobile-drawer-nav" aria-label="Mobilna nawigacja">
        {menuGroups.map((group) => (
          <details key={group.id}>
            <summary>{group.title}</summary>
            <div>
              {group.items.map((item) => (
                <a key={item.label} href={item.href}>
                  {item.label}
                </a>
              ))}
            </div>
          </details>
        ))}
        <a className="mobile-contact" href="#kontakt">
          Kontakt
        </a>
      </div>

      <main>
        <section className="hero" id="start">
          <div className="hero-slides" aria-hidden="true">
            {heroSlides.map((slide, index) => (
              <div
                key={slide}
                className="hero-slide"
                style={{
                  backgroundImage: `url(${slide})`,
                  animationDelay: `${index * 5}s`,
                }}
              />
            ))}
          </div>
          <div className="hero-noise" aria-hidden="true" />

          <div className="hero-inner reveal-up">
            <p className="eyebrow">KEIKA Premium Home</p>
            <h1>
              Nowoczesne osłony okienne i tarasowe
              <span> w klimacie premium</span>
            </h1>
            <p className="hero-copy">
              Tło pokazuje inspiracje z realnych realizacji: żaluzje, rolety i
              markizy w nowoczesnych domach. Wybierz kategorię w menu i od razu
              przejdź do konfiguracji.
            </p>
            <div className="hero-cta">
              <a className="btn btn-primary" href="#konfigurator">
                Skonfiguruj produkt
              </a>
              <a className="btn btn-ghost" href="#kategorie">
                Zobacz kolekcję
              </a>
            </div>
            <ul className="hero-kpis" aria-label="Najważniejsze korzyści">
              <li>
                <strong>48h</strong>
                <span>na wycenę niestandardową</span>
              </li>
              <li>
                <strong>4.9/5</strong>
                <span>średnia ocena klientów</span>
              </li>
              <li>
                <strong>10 lat</strong>
                <span>gwarancji na wybrane serie</span>
              </li>
            </ul>
          </div>

          <aside className="quick-box reveal-up-delay" id="konfigurator">
            <h2>Ekspresowa wycena</h2>
            <p>Wypełnij 3 pola i sprawdź orientacyjną cenę jeszcze dziś.</p>
            <form className="quick-form">
              <label>
                Produkt
                <select defaultValue="rolety" name="product">
                  <option value="rolety">Rolety</option>
                  <option value="markizy">Markizy</option>
                  <option value="moskitiery">Moskitiery</option>
                </select>
              </label>
              <label>
                Szerokość (cm)
                <input
                  type="number"
                  name="width"
                  min={40}
                  max={500}
                  placeholder="120"
                />
              </label>
              <label>
                Wysokość (cm)
                <input
                  type="number"
                  name="height"
                  min={40}
                  max={500}
                  placeholder="140"
                />
              </label>
              <button type="submit">Pokaż przybliżoną cenę</button>
            </form>
          </aside>
        </section>

        <section className="trustbar" aria-label="Atuty marki">
          {trustBadges.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </section>

        <section className="content-block" id="kategorie">
          <div className="section-head">
            <h2>Wybierz kategorię i przejdź do konfiguracji</h2>
            <a href="#konfigurator">Przelicz swój zestaw</a>
          </div>

          <div className="category-grid">
            {categories.map((item, index) => (
              <article
                key={item.title}
                className="category-card"
                style={{
                  animationDelay: `${index * 90}ms`,
                  backgroundImage: `linear-gradient(180deg, rgba(8, 12, 23, 0.05) 20%, rgba(6, 9, 17, 0.82) 100%), url(${item.image})`,
                }}
              >
                <div className="category-meta">
                  <p>{item.subtitle}</p>
                  <h3>{item.title}</h3>
                </div>
                <div className="category-footer">
                  <span>{item.price}</span>
                  <a href={item.href}>Konfiguruj</a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="content-block" id="oslony-wewnetrzne">
          <div className="section-head">
            <h2>Osłony wewnętrzne</h2>
            <a href="#konfigurator">Przejdź do konfiguratora</a>
          </div>
          <p className="section-description">
            Rolety tradycyjne, dzień noc, plisy, żaluzje, rolety rzymskie i
            systemy do okien dachowych.
          </p>
        </section>

        <section className="content-block" id="oslony-zewnetrzne">
          <div className="section-head">
            <h2>Osłony zewnętrzne</h2>
            <a href="#konfigurator">Przejdź do konfiguratora</a>
          </div>
          <p className="section-description">
            Rolety zewnętrzne, żaluzje fasadowe i screeny zwiększające komfort
            termiczny oraz prywatność.
          </p>
        </section>

        <section className="content-block" id="taras">
          <div className="section-head">
            <h2>Taras</h2>
            <a href="#konfigurator">Przejdź do konfiguratora</a>
          </div>
          <p className="section-description">
            Markizy, zadaszenia i shuttersy tworzące strefę cienia i stylu przez
            cały sezon.
          </p>
        </section>

        <section className="content-block" id="produkty">
          <div className="section-head">
            <h2>Polecane produkty premium</h2>
            <a href="#konfigurator">Przejdź do pełnej oferty</a>
          </div>

          <div className="product-grid">
            {products.map((item, index) => (
              <article key={item.title} className="product-card">
                <div
                  className="product-media"
                  style={{
                    animationDelay: `${index * 100}ms`,
                    backgroundImage: `url(${item.image})`,
                  }}
                />
                <div className="product-copy">
                  <p>{item.subtitle}</p>
                  <h3>{item.title}</h3>
                  <div>
                    <strong>{item.price}</strong>
                    <a href={item.href}>Dodaj do projektu</a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="content-block workflow">
          <div className="section-head">
            <h2>Od pomysłu do montażu w 3 prostych krokach</h2>
          </div>
          <div className="workflow-grid">
            {steps.map((step) => (
              <article key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="final-cta" id="kontakt">
          <p>Gotowy, żeby odświeżyć swój dom?</p>
          <h2>Uruchom konfigurator i zamów bez czekania na telefon</h2>
          <a href="#konfigurator">Start konfiguracji</a>
        </section>
      </main>

      <footer className="site-footer">
        <p>© {new Date().getFullYear()} KEIKA. Wszystkie prawa zastrzeżone.</p>
        <div>
          <a href="#">Polityka prywatności</a>
          <a href="#">Regulamin</a>
          <a href="mailto:kontakt@keika.pl">kontakt@keika.pl</a>
        </div>
      </footer>

      <div className="mobile-cta">
        <a href="#konfigurator">Skonfiguruj i wyceń</a>
      </div>
    </div>
  );
}
