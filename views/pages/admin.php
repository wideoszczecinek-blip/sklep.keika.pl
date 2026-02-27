<?php
declare(strict_types=1);

$section = $route['data']['section'];
$sectionKey = $route['data']['section_key'];
$sections = $route['data']['sections'];
?>
<section class="view view-admin">
  <div class="container admin-shell">
    <aside class="admin-sidebar surface-card" aria-label="Menu panelu sklepu">
      <div class="admin-sidebar__head">
        <p class="eyebrow">Panel sklepu</p>
        <h1>LH-only admin</h1>
        <p>Własny panel konfiguracji sklepu w osobnej aplikacji, ale na tym samym hostingu.</p>
      </div>

      <nav class="admin-sidebar__nav">
        <a class="<?= $sectionKey === 'dashboard' ? 'is-active' : '' ?>" href="<?= h(shop_url('/admin')) ?>">Dashboard</a>
        <a class="<?= $sectionKey === 'produkty' ? 'is-active' : '' ?>" href="<?= h(shop_url('/admin/produkty')) ?>">Produkty</a>
        <a class="<?= $sectionKey === 'konfigurator' ? 'is-active' : '' ?>" href="<?= h(shop_url('/admin/konfigurator')) ?>">Konfigurator</a>
        <a class="<?= $sectionKey === 'zamowienia' ? 'is-active' : '' ?>" href="<?= h(shop_url('/admin/zamowienia')) ?>">Zamówienia</a>
        <a class="<?= $sectionKey === 'ustawienia' ? 'is-active' : '' ?>" href="<?= h(shop_url('/admin/ustawienia')) ?>">Ustawienia</a>
      </nav>

      <div class="admin-sidebar__foot">
        <div class="admin-tip">
          <strong>Refresh-safe</strong>
          <p>Odświeżenie np. na `/admin/konfigurator` zostaje na tym ekranie dzięki routingowi PHP.</p>
        </div>
      </div>
    </aside>

    <div class="admin-content">
      <section class="surface-card admin-hero">
        <div>
          <p class="eyebrow">Aktualny moduł</p>
          <h2><?= h($section['title']) ?></h2>
          <p><?= h($section['intro']) ?></p>
        </div>
        <div class="admin-hero__stats" aria-label="Statystyki szkicu">
          <div><span>Tryb</span><strong>szkielet</strong></div>
          <div><span>Hosting</span><strong>LH</strong></div>
          <div><span>Backend</span><strong>PHP 8.4</strong></div>
          <div><span>Cel</span><strong>UX + konfigurator</strong></div>
        </div>
      </section>

      <section class="admin-card-grid">
        <?php foreach ($section['cards'] as $card): ?>
          <article class="surface-card admin-module-card">
            <h3><?= h($card['title']) ?></h3>
            <p><?= h($card['text']) ?></p>
            <div class="admin-module-card__actions">
              <button type="button" class="btn btn-ghost" data-demo-action>Edytuj (placeholder)</button>
              <button type="button" class="btn btn-secondary" data-demo-action>Podgląd</button>
            </div>
          </article>
        <?php endforeach; ?>
      </section>

      <section class="surface-card admin-note">
        <h3>Kolejne kroki implementacyjne</h3>
        <ol class="bullet-list bullet-list--ordered">
          <li>API `shop/v1` w CRM (PHP) - endpoint health + katalog + produkt</li>
          <li>Model danych konfiguratora rolety dachowej (kroki, pola, reguły, ceny)</li>
          <li>Podpięcie panelu sklepu do danych z CRM zamiast placeholderów</li>
          <li>Rozbudowa publicznego konfiguratora z walidacją i wyceną</li>
        </ol>
      </section>
    </div>
  </div>
</section>
