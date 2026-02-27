type Tile = {
  title: string;
  subtitle: string;
  price: string;
  image: string;
  href: string;
};

const categories: Tile[] = [
  {
    title: "Rolety",
    subtitle: "Screen, dzień noc i zaciemniające",
    price: "od 249 zł",
    image:
      "https://images.unsplash.com/photo-1616594039964-96016a0f0f84?auto=format&fit=crop&w=1600&q=80",
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
    title: "Akcesoria",
    subtitle: "Napędy, piloty, prowadnice",
    price: "od 119 zł",
    image:
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1600&q=80",
    href: "#produkty",
  },
];

const products: Tile[] = [
  {
    title: "Roleta Zaciemniająca PRO",
    subtitle: "Najczęściej wybierana do sypialni",
    price: "539 zł",
    image:
      "https://images.unsplash.com/photo-1617098474202-0cdbfda8d3f5?auto=format&fit=crop&w=1600&q=80",
    href: "#",
  },
  {
    title: "Markiza LUX Shadow",
    subtitle: "Bestseller na nowoczesne tarasy",
    price: "4 290 zł",
    image:
      "https://images.unsplash.com/photo-1615529182904-14819c35db37?auto=format&fit=crop&w=1600&q=80",
    href: "#",
  },
  {
    title: "Moskitiera Slide",
    subtitle: "Bezproblemowe przesuwanie",
    price: "389 zł",
    image:
      "https://images.unsplash.com/photo-1616137466211-f939a420be84?auto=format&fit=crop&w=1600&q=80",
    href: "#",
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
    text: "Wybierasz wymiary, tkaninę i automatykę. Cena liczy się w czasie rzeczywistym.",
  },
  {
    title: "2. Potwierdzasz",
    text: "Podsumowanie z terminem, kosztem dostawy i dokładną specyfikacją techniczną.",
  },
  {
    title: "3. Montujesz",
    text: "Dostarczamy gotowy zestaw z instrukcją lub wysyłamy ekipę montażową.",
  },
];

export default function Home() {
  return (
    <div className="storefront">
      <header className="topbar">
        <a className="brand" href="/" aria-label="KEIKA - strona główna">
          KEIKA
        </a>

        <nav className="main-nav" aria-label="Główna nawigacja">
          <a href="#kategorie">Rolety</a>
          <a href="#kategorie">Markizy</a>
          <a href="#kategorie">Moskitiery</a>
          <a href="#produkty">Bestsellery</a>
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

      <main>
        <section className="hero">
          <div
            className="hero-bg"
            aria-hidden="true"
            style={{
              backgroundImage:
                "url(https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2000&q=80)",
            }}
          />
          <div className="hero-noise" aria-hidden="true" />

          <div className="hero-inner reveal-up">
            <p className="eyebrow">Sklep KEIKA 2.0</p>
            <h1>
              Komfort, prywatność i design
              <span> na wymiar Twojego domu</span>
            </h1>
            <p className="hero-copy">
              Zamów rolety, markizy i moskitiery w kilka minut. Nowoczesny
              konfigurator, szybka wycena i produkcja pod Twój projekt.
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
                <input type="number" name="width" min={40} max={500} placeholder="120" />
              </label>
              <label>
                Wysokość (cm)
                <input type="number" name="height" min={40} max={500} placeholder="140" />
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

        <section className="final-cta">
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
