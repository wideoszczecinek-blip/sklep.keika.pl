<?php
declare(strict_types=1);
?>
<footer class="site-footer">
  <div class="container site-footer__inner">
    <div>
      <strong>KEIKA Sklep - szkielet LH</strong>
      <p>Routing po stronie serwera (PHP) oznacza, że odświeżenie URL nie zrzuca użytkownika na stronę główną.</p>
    </div>
    <div class="footer-links">
      <a href="<?= h(shop_url('/')) ?>">Start</a>
      <a href="<?= h(shop_url('/katalog')) ?>">Katalog</a>
      <a href="<?= h(shop_url('/admin')) ?>">Panel sklepu</a>
    </div>
  </div>
</footer>
