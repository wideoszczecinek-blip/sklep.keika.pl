<?php
declare(strict_types=1);

$product = $route['data']['product'];
?>
<section class="view view-product">
  <div class="container">
    <div class="product-layout">
      <div class="surface-card product-gallery">
        <div class="product-gallery__hero" aria-hidden="true">
          <div class="window-frame window-frame--wide">
            <div class="window-frame__shade"></div>
            <div class="window-frame__glass"></div>
          </div>
        </div>
        <div class="product-gallery__thumbs" aria-hidden="true">
          <div></div><div></div><div></div>
        </div>
      </div>

      <div class="surface-card product-info">
        <p class="eyebrow"><?= h($product['category']) ?></p>
        <h1><?= h($product['name']) ?></h1>
        <p class="product-info__lead"><?= h($product['short']) ?></p>
        <ul class="bullet-list">
          <li>Lead time: <?= h($product['lead_time_label']) ?></li>
          <li>Model cenowy: siatka wymiarów + dopłaty</li>
          <li>Konfigurator krokowy z walidacją w czasie rzeczywistym (MVP szkic)</li>
        </ul>
        <div class="product-price-box">
          <span>Od</span>
          <strong><?= h(format_money_pln((float)$product['price_from'])) ?></strong>
        </div>
        <div class="hero-actions">
          <a class="btn btn-primary" href="<?= h(shop_url('/konfigurator/' . $product['slug'])) ?>">Przejdź do konfiguratora</a>
          <a class="btn btn-secondary" href="<?= h(shop_url('/koszyk')) ?>">Koszyk (szkic)</a>
        </div>
      </div>
    </div>
  </div>
</section>
