<?php
declare(strict_types=1);
?>
<section class="view view-404">
  <div class="container">
    <div class="error-card">
      <p class="eyebrow">404</p>
      <h1>Nie znaleziono tego widoku</h1>
      <p>Adres nie istnieje w szkielecie sklepu. To nie redirect do strony głównej - to poprawny widok błędu z zachowaniem URL.</p>
      <div class="error-card__actions">
        <a class="btn btn-primary" href="<?= h(shop_url('/')) ?>">Wróć na start</a>
        <a class="btn btn-secondary" href="<?= h(shop_url('/admin')) ?>">Panel sklepu</a>
      </div>
    </div>
  </div>
</section>
