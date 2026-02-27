<?php
declare(strict_types=1);

$products = $route['data']['products'];
?>
<section class="view view-catalog">
  <div class="container">
    <div class="surface-card catalog-hero">
      <div>
        <p class="eyebrow">Katalog produktów</p>
        <h1>Szkielet listy produktów</h1>
        <p>Tu zbudujemy docelowy katalog z filtrami, sortowaniem i wejściem do konfiguratora.</p>
      </div>
      <div class="filter-chips" aria-label="Przykładowe filtry">
        <button type="button" class="chip is-selected">Rolety dachowe</button>
        <button type="button" class="chip">Plisy</button>
        <button type="button" class="chip">Dzień / noc</button>
        <button type="button" class="chip">Moskitiery</button>
      </div>
    </div>

    <div class="catalog-grid">
      <?php foreach ($products as $product): ?>
        <article class="catalog-card">
          <div class="catalog-card__image" aria-hidden="true">
            <div class="catalog-card__frame"></div>
          </div>
          <div class="catalog-card__content">
            <div class="catalog-card__meta">
              <span class="chip chip-muted"><?= h($product['category']) ?></span>
              <span><?= h($product['lead_time_label']) ?></span>
            </div>
            <h2><?= h($product['name']) ?></h2>
            <p><?= h($product['short']) ?></p>
            <div class="catalog-card__footer">
              <div>
                <small>od</small>
                <strong><?= h(format_money_pln((float)$product['price_from'])) ?></strong>
              </div>
              <div class="catalog-card__actions">
                <a class="btn btn-ghost" href="<?= h(shop_url('/produkt/' . $product['slug'])) ?>">Karta</a>
                <a class="btn btn-primary" href="<?= h(shop_url('/konfigurator/' . $product['slug'])) ?>">Konfiguruj</a>
              </div>
            </div>
          </div>
        </article>
      <?php endforeach; ?>
    </div>
  </div>
</section>
