type Collection = {
  title: string;
  subtitle: string;
  bullets: string[];
  image: string;
};

const heroSlides = [
  "https://images.unsplash.com/photo-1616047006789-b7af3f061b46?auto=format&fit=crop&w=2200&q=80",
  "https://images.unsplash.com/photo-1600210492493-0946911123ea?auto=format&fit=crop&w=2200&q=80",
  "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=2200&q=80",
  "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=2200&q=80",
];

const collections: Collection[] = [
  {
    title: "Osłony wewnętrzne",
    subtitle: "Komfort i estetyka w każdym pomieszczeniu",
    bullets: [
      "Rolety tradycyjne i dzień noc",
      "Plisy i żaluzje",
      "Rolety rzymskie i dachowe",
    ],
    image:
      "https://images.unsplash.com/photo-1616628182509-6f11d7f2376d?auto=format&fit=crop&w=1600&q=80",
  },
  {
    title: "Osłony zewnętrzne",
    subtitle: "Prywatność i termika na poziomie premium",
    bullets: [
      "Rolety zewnętrzne",
      "Żaluzje fasadowe",
      "Screeny i systemy smart",
    ],
    image:
      "https://images.unsplash.com/photo-1613545325278-f24b0cae1224?auto=format&fit=crop&w=1600&q=80",
  },
  {
    title: "Taras",
    subtitle: "Cień i klimat wypoczynku przez cały sezon",
    bullets: ["Markizy", "Zadaszenia", "Shuttersy"],
    image:
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1600&q=80",
  },
];

const process = [
  {
    title: "1. Wybór stylu",
    text: "Wybierasz typ osłony i klimat wnętrza. Od razu widzisz realne inspiracje.",
  },
  {
    title: "2. Konfiguracja",
    text: "Podajesz wymiary i dodatki. System liczy cenę w czasie rzeczywistym.",
  },
  {
    title: "3. Produkcja i montaż",
    text: "Wykonujemy osłony pod wymiar i dostarczamy gotowe rozwiązanie.",
  },
];

const trustMetrics = [
  { value: "4.9/5", label: "ocena obsługi" },
  { value: "48h", label: "na wycenę custom" },
  { value: "10 lat", label: "gwarancji" },
  { value: "100%", label: "na wymiar" },
];

export default function Home() {
  return (
    <div className="home-root">
      <header className="hero-header">
        <a className="brand" href="/" aria-label="KEIKA strona główna">
          KEIKA
        </a>
        <div className="header-actions">
          <a className="phone" href="tel:+48123456789">
            +48 123 456 789
          </a>
          <a className="header-cta" href="#wycena">
            Darmowa wycena
          </a>
        </div>
      </header>

      <main>
        <section className="hero-full" id="start">
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

          <div className="hero-dim" aria-hidden="true" />
          <div className="hero-grain" aria-hidden="true" />

          <div className="hero-inner">
            <div className="hero-copy">
              <p className="eyebrow">Nowoczesne osłony dla nowoczesnych domów</p>
              <h1>
                Strona główna z efektem premium
                <span> i mocnym nastawieniem na konwersję</span>
              </h1>
              <p>
                Pełna szerokość, dynamiczne tło i czytelna ścieżka decyzji.
                Najpierw wybierasz kierunek, potem przechodzisz do konfiguratora.
              </p>
              <div className="hero-buttons">
                <a className="btn-primary" href="#wycena">
                  Rozpocznij konfigurację
                </a>
                <a className="btn-secondary" href="#kolekcje">
                  Zobacz kolekcje
                </a>
              </div>
            </div>

            <aside className="hero-panel" id="wycena">
              <h2>Start w 30 sekund</h2>
              <p>
                Zostaw 3 informacje, a dostaniesz orientacyjną wycenę oraz
                rekomendację najlepszej serii osłon.
              </p>
              <form className="quick-form">
                <label>
                  Typ projektu
                  <select defaultValue="dom">
                    <option value="dom">Dom / apartament</option>
                    <option value="biuro">Biuro / lokal</option>
                    <option value="taras">Taras / ogród zimowy</option>
                  </select>
                </label>
                <label>
                  Priorytet
                  <select defaultValue="komfort">
                    <option value="komfort">Komfort i prywatność</option>
                    <option value="design">Design i estetyka</option>
                    <option value="termika">Termika i oszczędność</option>
                  </select>
                </label>
                <label>
                  Telefon
                  <input type="tel" placeholder="np. 500 600 700" />
                </label>
                <button type="submit">Odbierz wycenę</button>
              </form>
            </aside>
          </div>
        </section>

        <section className="metrics-strip" aria-label="Najważniejsze metryki">
          {trustMetrics.map((item) => (
            <article key={item.label}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </article>
          ))}
        </section>

        <section className="collections" id="kolekcje">
          <div className="section-head">
            <h2>Trzy główne strefy oferty</h2>
            <p>
              Bez rozpraszaczy. Jedna strona główna, jasny wybór i szybkie
              przejście do produktu.
            </p>
          </div>

          <div className="collection-grid">
            {collections.map((item) => (
              <article key={item.title} className="collection-card">
                <div
                  className="collection-media"
                  style={{
                    backgroundImage: `linear-gradient(180deg, rgba(8, 13, 24, 0.08), rgba(8, 13, 24, 0.55)), url(${item.image})`,
                  }}
                />
                <div className="collection-body">
                  <h3>{item.title}</h3>
                  <p>{item.subtitle}</p>
                  <ul>
                    {item.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                  <a href="#wycena">Przejdź do wyceny</a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="process-band">
          <div className="section-head section-head-light">
            <h2>Proces zakupowy bez chaosu</h2>
          </div>
          <div className="process-grid">
            {process.map((item) => (
              <article key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="final-band" id="kontakt">
          <div>
            <p>Kontakt bez formularzowego męczenia</p>
            <h2>Powiedz, co chcesz osłonić. My dobierzemy cały system.</h2>
          </div>
          <div className="final-actions">
            <a href="tel:+48123456789">Zadzwoń teraz</a>
            <a href="mailto:kontakt@keika.pl">Napisz do nas</a>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <p>© {new Date().getFullYear()} KEIKA. Wszystkie prawa zastrzeżone.</p>
      </footer>

      <div className="mobile-fixed-cta">
        <a href="#wycena">Skonfiguruj i wyceń</a>
      </div>
    </div>
  );
}
