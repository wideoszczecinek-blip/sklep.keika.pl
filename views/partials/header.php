<?php
declare(strict_types=1);

$currentPath = $request['path'];
$isAdmin = (bool)$route['is_admin'];
$isRoletyActive =
  is_active_route($currentPath, '/')
  || is_active_route($currentPath, '/katalog')
  || is_active_route($currentPath, '/produkt')
  || is_active_route($currentPath, '/konfigurator');
?>
<header class="site-header <?= $isAdmin ? 'site-header--admin' : 'site-header--shop' ?>">
  <div class="site-header__backdrop"></div>
  <div class="container site-header__inner">
    <a class="brand" href="<?= h(shop_url('/')) ?>">
      <span class="brand__mark" aria-hidden="true">K</span>
      <span class="brand__text">
        <strong>KEIKA Sklep</strong>
        <small><?= $isAdmin ? 'Panel sklepu (LH)' : 'MVP szkic / LH-only' ?></small>
      </span>
    </a>

    <?php if ($isAdmin): ?>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="mainNav" data-nav-toggle>
        <span></span><span></span><span></span>
        <span class="sr-only">Przełącz menu</span>
      </button>

      <nav id="mainNav" class="main-nav" aria-label="Główna nawigacja">
        <a class="<?= is_active_route($currentPath, '/') ? 'is-active' : '' ?>" href="<?= h(shop_url('/')) ?>">Start sklepu</a>
        <a class="<?= is_active_route($currentPath, '/katalog') ? 'is-active' : '' ?>" href="<?= h(shop_url('/katalog')) ?>">Katalog</a>
        <a class="<?= is_active_route($currentPath, '/admin') ? 'is-active' : '' ?>" href="<?= h(shop_url('/admin')) ?>">Panel sklepu</a>
        <a class="<?= is_active_route($currentPath, '/konfigurator') ? 'is-active' : '' ?>" href="<?= h(shop_url('/konfigurator/roleta-dachowa-classic')) ?>">Konfigurator</a>
      </nav>
    <?php else: ?>
      <nav id="mainNav" class="shop-top-nav" aria-label="Kategorie sklepu">
        <a class="<?= $isRoletyActive ? 'is-active' : '' ?>" href="<?= h(shop_url('/katalog')) ?>">Rolety</a>
        <a href="<?= h(shop_url('/katalog')) ?>">Markizy</a>
        <a href="<?= h(shop_url('/katalog')) ?>">Moskitiery</a>
        <a href="<?= h(shop_url('/katalog')) ?>">Akcesoria</a>
      </nav>

      <form class="shop-top-search" role="search" action="<?= h(shop_url('/katalog')) ?>" method="get">
        <span class="shop-top-search__icon" aria-hidden="true">⌕</span>
        <input type="search" name="q" placeholder="Szukaj produktów..." aria-label="Szukaj produktów">
      </form>

      <div class="shop-top-actions" aria-label="Szybkie akcje">
        <a class="shop-top-action shop-top-action--phone" href="tel:+48123456789">
          <span aria-hidden="true">☎</span>
          <strong>+48 123 456 789</strong>
        </a>
        <a class="shop-top-action shop-top-action--cart" href="<?= h(shop_url('/koszyk')) ?>">
          <span aria-hidden="true">🛒</span>
          <strong>Koszyk</strong>
          <em>0</em>
        </a>
        <a class="shop-top-action shop-top-action--admin" href="<?= h(shop_url('/admin')) ?>" title="Panel sklepu">
          <span aria-hidden="true">⚙</span>
          <strong>Panel</strong>
        </a>
      </div>

      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="mainNav" data-nav-toggle>
        <span></span><span></span><span></span>
        <span class="sr-only">Przełącz menu</span>
      </button>
    <?php endif; ?>
  </div>
</header>
