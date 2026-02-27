<?php
declare(strict_types=1);

$product = $route['data']['product'];
?>
<section class="view view-configurator">
  <div class="container">
    <div class="surface-card configurator-hero">
      <div>
        <p class="eyebrow">Konfigurator MVP</p>
        <h1><?= h($product['name']) ?></h1>
        <p>Szkielet UX pod trudny konfigurator: kroki, walidacja, podsumowanie i cena w stałym panelu.</p>
      </div>
      <div class="stepper" aria-label="Postęp konfiguratora">
        <div class="stepper__item is-done"><span>1</span><small>Typ</small></div>
        <div class="stepper__item is-active"><span>2</span><small>Wymiary</small></div>
        <div class="stepper__item"><span>3</span><small>Montaż</small></div>
        <div class="stepper__item"><span>4</span><small>Materiał</small></div>
        <div class="stepper__item"><span>5</span><small>Podsumowanie</small></div>
      </div>
    </div>

    <div class="config-layout">
      <section class="surface-card config-main">
        <div class="config-block">
          <div class="config-block__head">
            <h2>Wymiary</h2>
            <p>Walidacja min/max i kroki wymiarowe będą liczone po stronie PHP/API.</p>
          </div>
          <div class="form-grid">
            <label class="field">
              <span>Szerokość (mm)</span>
              <input type="number" value="780" min="300" max="2000" step="1">
            </label>
            <label class="field">
              <span>Wysokość (mm)</span>
              <input type="number" value="1180" min="300" max="2400" step="1">
            </label>
          </div>
        </div>

        <div class="config-block">
          <div class="config-block__head">
            <h2>Sposób montażu</h2>
            <p>Tu będą reguły kompatybilności (np. dostępność opcji zależnie od modelu).</p>
          </div>
          <div class="choice-grid">
            <label class="choice-card is-selected">
              <input type="radio" checked name="mount_type">
              <strong>Inwazyjny</strong>
              <small>Najczęściej wybierany, stabilny montaż</small>
            </label>
            <label class="choice-card">
              <input type="radio" name="mount_type">
              <strong>Bezinwazyjny</strong>
              <small>Dostępność zależna od modelu i wymiarów</small>
            </label>
          </div>
        </div>

        <div class="config-block">
          <div class="config-block__head">
            <h2>Materiał i kolor</h2>
            <p>Na etapie MVP start od ograniczonej listy opcji, ale z pełną logiką ceny.</p>
          </div>
          <div class="choice-grid">
            <label class="choice-card is-selected">
              <input type="radio" checked name="fabric">
              <strong>Blackout 001</strong>
              <small>Dopłata +70 zł</small>
            </label>
            <label class="choice-card">
              <input type="radio" name="fabric">
              <strong>Classic Light 002</strong>
              <small>Cena bazowa</small>
            </label>
          </div>
        </div>
      </section>

      <aside class="surface-card config-summary">
        <h2>Podsumowanie</h2>
        <ul class="summary-list">
          <li><span>Produkt</span><strong><?= h($product['name']) ?></strong></li>
          <li><span>Wymiary</span><strong>780 x 1180 mm</strong></li>
          <li><span>Montaż</span><strong>Inwazyjny</strong></li>
          <li><span>Materiał</span><strong>Blackout 001</strong></li>
          <li><span>Czas realizacji</span><strong><?= h($product['lead_time_label']) ?></strong></li>
        </ul>
        <div class="price-breakdown">
          <div><span>Baza</span><strong>450,00 zł</strong></div>
          <div><span>Dopłata materiał</span><strong>70,00 zł</strong></div>
          <div class="price-breakdown__total"><span>Razem</span><strong>520,00 zł</strong></div>
        </div>
        <div class="hero-actions hero-actions--stack">
          <a class="btn btn-primary" href="<?= h(shop_url('/koszyk')) ?>">Dodaj do koszyka (szkic)</a>
          <a class="btn btn-secondary" href="<?= h(shop_url('/produkt/' . $product['slug'])) ?>">Wróć do produktu</a>
        </div>
      </aside>
    </div>
  </div>
</section>
