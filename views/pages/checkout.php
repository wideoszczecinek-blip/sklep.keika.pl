<?php
declare(strict_types=1);
?>
<section class="view view-checkout">
  <div class="container">
    <div class="section-head section-head--tight">
      <p class="eyebrow">Checkout</p>
      <h1>Szkielet checkoutu (MVP)</h1>
      <p>Tu później wejdzie formularz klienta, dostawa, płatność Przelewy24 i finalizacja zamówienia.</p>
    </div>

    <div class="checkout-layout">
      <section class="surface-card checkout-form">
        <h2>Dane klienta</h2>
        <div class="form-grid">
          <label class="field"><span>Imię i nazwisko</span><input type="text" placeholder="Jan Kowalski"></label>
          <label class="field"><span>E-mail</span><input type="email" placeholder="jan@firma.pl"></label>
          <label class="field"><span>Telefon</span><input type="tel" placeholder="+48 600 000 000"></label>
          <label class="field"><span>Miasto</span><input type="text" placeholder="Szczecinek"></label>
          <label class="field field--wide"><span>Adres</span><input type="text" placeholder="Ulica i numer"></label>
          <label class="field"><span>Kod pocztowy</span><input type="text" placeholder="00-000"></label>
        </div>

        <h2>Dostawa</h2>
        <div class="choice-grid">
          <label class="choice-card is-selected">
            <input type="radio" checked name="delivery">
            <strong>Kurier</strong>
            <small>MVP: podstawowa wysyłka kurierska</small>
          </label>
          <label class="choice-card">
            <input type="radio" name="delivery">
            <strong>Kurier Express</strong>
            <small>Opcja przykładowa (do decyzji biznesowej)</small>
          </label>
        </div>

        <h2>Płatność</h2>
        <div class="choice-grid">
          <label class="choice-card is-selected">
            <input type="radio" checked name="payment">
            <strong>Przelewy24</strong>
            <small>Planowana płatność MVP</small>
          </label>
        </div>
      </section>

      <aside class="surface-card checkout-summary">
        <h2>Podsumowanie zamówienia</h2>
        <ul class="summary-list">
          <li><span>Roleta dachowa Classic</span><strong>520,00 zł</strong></li>
          <li><span>Dostawa</span><strong>19,00 zł</strong></li>
        </ul>
        <div class="price-breakdown">
          <div class="price-breakdown__total"><span>Razem do zapłaty</span><strong>539,00 zł</strong></div>
        </div>
        <button class="btn btn-primary btn-block" type="button">Złóż zamówienie (szkic)</button>
        <p class="checkout-note">
          To tylko szkielet UX. Integracja płatności i zapis zamówienia będą podpięte do CRM w kolejnych krokach.
        </p>
      </aside>
    </div>
  </div>
</section>
