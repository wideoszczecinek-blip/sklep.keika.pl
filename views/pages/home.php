<?php
declare(strict_types=1);

$featured = $route['data']['featured_product'];

$heroCategories = [
    ['label' => 'Rolety', 'price' => 'od 249 zł', 'href' => shop_url('/katalog'), 'tone' => 'rolety', 'active' => true],
    ['label' => 'Markizy', 'price' => 'od 2 990 zł', 'href' => shop_url('/katalog'), 'tone' => 'markizy', 'active' => false],
    ['label' => 'Moskitiery', 'price' => 'od 149 zł', 'href' => shop_url('/katalog'), 'tone' => 'moskitiery', 'active' => false],
    ['label' => 'Akcesoria', 'price' => 'od 119 zł', 'href' => shop_url('/katalog'), 'tone' => 'akcesoria', 'active' => false],
];

$popularProducts = [
    ['badge' => 'Nowość', 'badge_class' => 'is-new', 'name' => 'Roleta Zaciemniająca', 'price' => '269 zł', 'old_price' => null, 'tone' => 'rolety'],
    ['badge' => 'Bestseller', 'badge_class' => 'is-best', 'name' => 'Markiza Tarasowa', 'price' => '2 990 zł', 'old_price' => null, 'tone' => 'markizy'],
    ['badge' => 'Popularny', 'badge_class' => 'is-popular', 'name' => 'Moskietiera Ramkowa', 'price' => '149 zł', 'old_price' => null, 'tone' => 'moskitiery'],
    ['badge' => 'Promocja', 'badge_class' => 'is-sale', 'name' => 'Zestaw Napędu', 'price' => '129 zł', 'old_price' => '149 zł', 'tone' => 'akcesoria'],
];
?>
<section class="view view-home view-home--neo">
  <div class="neo-home-shell">
    <div class="neo-home-bg" aria-hidden="true">
      <div class="neo-home-bg__blob neo-home-bg__blob--a"></div>
      <div class="neo-home-bg__blob neo-home-bg__blob--b"></div>
      <div class="neo-home-bg__blob neo-home-bg__blob--c"></div>
      <div class="neo-home-bg__grid"></div>
    </div>

    <section class="neo-hero" aria-labelledby="neoHeroTitle">
      <div class="neo-hero__frame">
        <div class="neo-hero__copy">
          <div class="neo-topline">
            <span class="neo-signal neo-signal--live">Nowy sklep LH</span>
            <span class="neo-signal">UX-first</span>
            <span class="neo-signal">Konfigurator MVP</span>
          </div>

          <h1 id="neoHeroTitle">
            Wygodny wybór
            <span>rolet i markiz</span>
            <em>jak portal z 2080 roku</em>
          </h1>

          <p class="neo-hero__lead">
            Ultra nowoczesny front z naciskiem na mobile, szybki wybór kategorii i płynne przejście
            do konfiguratora. Bez przeładowywania na chaos, bez gubienia klienta.
          </p>

          <div class="neo-hero__actions">
            <a class="neo-btn neo-btn--primary" href="<?= h(shop_url('/katalog')) ?>">
              Przeglądaj produkty
              <span aria-hidden="true">→</span>
            </a>
            <a class="neo-btn neo-btn--ghost" href="<?= h(shop_url('/konfigurator/' . $featured['slug'])) ?>">
              Otwórz konfigurator
              <span aria-hidden="true">→</span>
            </a>
          </div>

          <div class="neo-hero__metrics">
            <div class="neo-metric">
              <span>Tryb</span>
              <strong>LH-only</strong>
            </div>
            <div class="neo-metric">
              <span>Flow</span>
              <strong>Refresh-safe</strong>
            </div>
            <div class="neo-metric">
              <span>Cel</span>
              <strong>WOW + UX</strong>
            </div>
          </div>
        </div>

        <div class="neo-hero__visual" aria-hidden="true">
          <div class="neo-stage">
            <div class="neo-stage__sky"></div>
            <div class="neo-stage__scene"></div>
            <div class="neo-stage__glass"></div>
            <div class="neo-stage__frame"></div>
            <div class="neo-stage__awning"></div>
            <div class="neo-stage__sunflare"></div>
            <div class="neo-stage__floor"></div>
            <div class="neo-stage__spot neo-stage__spot--1"></div>
            <div class="neo-stage__spot neo-stage__spot--2"></div>
            <div class="neo-stage__badge">Na<br>Wymiar</div>
            <div class="neo-stage__orbit neo-stage__orbit--a"></div>
            <div class="neo-stage__orbit neo-stage__orbit--b"></div>
          </div>
        </div>
      </div>
    </section>

    <section class="neo-ribbon neo-ribbon--categories" aria-labelledby="neoCategoryTitle">
      <div class="neo-ribbon__head">
        <div>
          <p class="neo-kicker">Kategorie</p>
          <h2 id="neoCategoryTitle">Wejdź w ofertę jednym ruchem</h2>
        </div>
        <a class="neo-pill-link" href="<?= h(shop_url('/katalog')) ?>">Zobacz pełny katalog</a>
      </div>

      <div class="neo-category-flow" role="list">
        <?php foreach ($heroCategories as $cat): ?>
          <a role="listitem" class="neo-cat-tile neo-cat-tile--<?= h($cat['tone']) ?> <?= $cat['active'] ? 'is-active' : '' ?>" href="<?= h($cat['href']) ?>">
            <div class="neo-cat-tile__art">
              <div class="neo-art neo-art--<?= h($cat['tone']) ?>"></div>
            </div>
            <div class="neo-cat-tile__glass">
              <div>
                <h3><?= h($cat['label']) ?></h3>
                <small><?= h($cat['price']) ?></small>
              </div>
              <span class="neo-icon-badge" aria-hidden="true">→</span>
            </div>
          </a>
        <?php endforeach; ?>
      </div>
    </section>

    <section class="neo-flow-grid">
      <article class="neo-stream neo-stream--config">
        <div class="neo-stream__copy">
          <p class="neo-kicker">Konfigurator rolety dachowej</p>
          <h3>Najważniejszy moduł, który ma robić efekt wow</h3>
          <p>
            Krokowy proces, walidacja na bieżąco, płynne przejścia i stałe podsumowanie ceny.
            To jest rdzeń doświadczenia, nie zwykły formularz.
          </p>
          <div class="neo-hero__actions">
            <a class="neo-btn neo-btn--primary" href="<?= h(shop_url('/konfigurator/' . $featured['slug'])) ?>">Przejdź do konfiguratora</a>
            <a class="neo-btn neo-btn--ghost" href="<?= h(shop_url('/admin/konfigurator')) ?>">Panel konfiguratora</a>
          </div>
        </div>

        <div class="neo-config-console" aria-hidden="true">
          <div class="neo-config-console__row neo-config-console__row--top">
            <span class="is-ok">Typ</span>
            <span class="is-active">Wymiary</span>
            <span>Montaż</span>
            <span>Materiał</span>
            <span>Cena</span>
          </div>
          <div class="neo-config-console__grid">
            <div><label>Szerokość</label><strong>780 mm</strong></div>
            <div><label>Wysokość</label><strong>1180 mm</strong></div>
            <div><label>Montaż</label><strong>Inwazyjny</strong></div>
            <div><label>Tkanina</label><strong>Blackout 001</strong></div>
          </div>
          <div class="neo-config-console__price">
            <span>Razem</span>
            <strong>520,00 zł</strong>
          </div>
        </div>
      </article>

      <aside class="neo-panel-links">
        <a class="neo-side-link" href="<?= h(shop_url('/admin')) ?>">
          <p class="neo-kicker">Panel sklepu</p>
          <h3>Oddzielny panel admina</h3>
          <p>Produkty, konfigurator, wycena i zamówienia w osobnym widoku, bez mieszania z UI CRM.</p>
          <span>Otwórz panel →</span>
        </a>

        <a class="neo-side-link neo-side-link--alt" href="<?= h(shop_url('/admin/produkty')) ?>">
          <p class="neo-kicker">Produkty</p>
          <h3>Katalog i warianty</h3>
          <p>Miejsce na zarządzanie ofertą, zdjęciami, dostępnością i czasem realizacji.</p>
          <span>Przejdź do modułu →</span>
        </a>
      </aside>
    </section>

    <section class="neo-ribbon neo-ribbon--products" aria-labelledby="neoPopularTitle">
      <div class="neo-ribbon__head">
        <div>
          <p class="neo-kicker">Polecane produkty</p>
          <h2 id="neoPopularTitle">Kafle produktowe w nowym stylu</h2>
        </div>
        <a class="neo-pill-link" href="<?= h(shop_url('/katalog')) ?>">Przejdź do katalogu</a>
      </div>

      <div class="neo-product-atlas" role="list">
        <?php foreach ($popularProducts as $item): ?>
          <article role="listitem" class="neo-product-tile neo-product-tile--<?= h($item['tone']) ?>">
            <div class="neo-product-tile__art">
              <div class="neo-art neo-art--<?= h($item['tone']) ?>"></div>
              <span class="neo-badge <?= h($item['badge_class']) ?>"><?= h($item['badge']) ?></span>
            </div>
            <div class="neo-product-tile__body">
              <h3><?= h($item['name']) ?></h3>
              <div class="neo-product-tile__meta">
                <div class="neo-price-stack">
                  <strong><?= h($item['price']) ?></strong>
                  <?php if ($item['old_price']): ?>
                    <small><?= h($item['old_price']) ?></small>
                  <?php endif; ?>
                </div>
                <a class="neo-icon-badge neo-icon-badge--cart" href="<?= h(shop_url('/produkt/' . $featured['slug'])) ?>" aria-label="Przejdź do produktu">🛒</a>
              </div>
            </div>
          </article>
        <?php endforeach; ?>
      </div>
    </section>
  </div>
</section>
