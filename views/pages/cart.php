<?php
declare(strict_types=1);

$items = $route['data']['items'];
$total = 0.0;
foreach ($items as $item) {
    $total += (float)$item['price_from'];
}
?>
<section class="view view-cart">
  <div class="container">
    <div class="section-head section-head--tight">
      <p class="eyebrow">Koszyk</p>
      <h1>Szkielet koszyka (MVP)</h1>
    </div>
    <div class="cart-layout">
      <section class="surface-card">
        <?php foreach ($items as $item): ?>
          <article class="cart-item">
            <div class="cart-item__thumb" aria-hidden="true"></div>
            <div class="cart-item__content">
              <h2><?= h($item['name']) ?></h2>
              <p><?= h($item['category']) ?> • <?= h($item['lead_time_label']) ?></p>
              <div class="cart-item__meta">
                <span>Konfiguracja: przykładowa</span>
                <strong><?= h(format_money_pln((float)$item['price_from'])) ?></strong>
              </div>
            </div>
          </article>
        <?php endforeach; ?>
      </section>

      <aside class="surface-card cart-summary">
        <h2>Podsumowanie</h2>
        <div class="summary-list">
          <div><span>Produkty</span><strong><?= count($items) ?></strong></div>
          <div><span>Dostawa (MVP szkic)</span><strong>od 19,00 zł</strong></div>
          <div class="price-breakdown__total"><span>Razem</span><strong><?= h(format_money_pln($total + 19.0)) ?></strong></div>
        </div>
        <div class="hero-actions hero-actions--stack">
          <a class="btn btn-primary" href="<?= h(shop_url('/checkout')) ?>">Przejdź do checkoutu</a>
          <a class="btn btn-secondary" href="<?= h(shop_url('/katalog')) ?>">Wróć do katalogu</a>
        </div>
      </aside>
    </div>
  </div>
</section>
