import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/app/moskitiery/moskitiery-v2.module.css";
import { COMPANY_LEGAL } from "@/lib/company-legal";

// Regulamin konta klienta ("Moje zamówienia"). Trzymany w repozytorium, nie
// w CRM: klient akceptuje KONKRETNĄ wersję, a data akceptacji zapisuje się
// przy koncie (shop_www_customer_accounts.terms_version). Zmiana treści =
// nowa wartość ACCOUNT_TERMS_VERSION tutaj i w CRM
// (SHOP_CUSTOMER_TERMS_VERSION w core/lib/shop_customer_accounts.php).
export const ACCOUNT_TERMS_VERSION = "2026-09-23";

export const metadata: Metadata = {
  title: "Regulamin konta klienta | KEIKA",
  description:
    "Zasady korzystania z panelu „Moje zamówienia” w sklepie KEIKA: logowanie numerem telefonu i hasłem, kody SMS, dane, płatności i usuwanie konta.",
  alternates: { canonical: "https://sklep.keika.pl/regulamin-konta" },
};

export default function AccountTermsPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <article className={styles.legalCard}>
          <h1>Regulamin konta klienta „Moje zamówienia”</h1>
          <p className={styles.sectionIntro}>
            Wersja {ACCOUNT_TERMS_VERSION} · {COMPANY_LEGAL.legalName}, {COMPANY_LEGAL.street},{" "}
            {COMPANY_LEGAL.postalCode} {COMPANY_LEGAL.city} · NIP {COMPANY_LEGAL.nip}
          </p>

          <div className={styles.legalHtml}>
            <h2>§1. Czym jest konto</h2>
            <p>
              Konto klienta to bezpłatny panel „Moje zamówienia” w sklepie {COMPANY_LEGAL.brand}, prowadzonym przez{" "}
              {COMPANY_LEGAL.legalName} ({COMPANY_LEGAL.legalForm}), {COMPANY_LEGAL.street}, {COMPANY_LEGAL.postalCode}{" "}
              {COMPANY_LEGAL.city}, NIP {COMPANY_LEGAL.nip}, REGON {COMPANY_LEGAL.regon}. W panelu zobaczysz swoje
              zamówienia złożone na ten numer telefonu, ich status, dane do przesyłki oraz opłacisz zamówienia, które
              nie zostały jeszcze opłacone.
            </p>
            <p>
              Konto jest dodatkiem do zakupów - nie jest konieczne, żeby złożyć zamówienie. Zasady sprzedaży,
              dostawy, zwrotów i reklamacji określa{" "}
              <Link href="/regulamin">Regulamin sklepu</Link>, a zasady przetwarzania danych{" "}
              <Link href="/legal/prywatnosc">Polityka prywatności</Link>.
            </p>

            <h2>§2. Zakładanie konta i logowanie</h2>
            <ol>
              <li>
                Konto zakłada się numerem telefonu podanym przy zamówieniu. Konto można założyć tylko wtedy, gdy na
                dany numer mamy co najmniej jedno zamówienie.
              </li>
              <li>
                Przy pierwszym logowaniu wysyłamy na ten numer SMS z jednorazowym kodem. Kod jest ważny 10 minut i
                służy wyłącznie potwierdzeniu, że numer należy do Ciebie.
              </li>
              <li>
                Po wpisaniu kodu ustalasz własne hasło (co najmniej 8 znaków). Kolejne logowania to już numer telefonu
                i hasło.
              </li>
              <li>
                Jeśli nie pamiętasz hasła, wybierz „Nie pamiętam hasła” - wyślemy nowy kod SMS i ustalisz nowe hasło.
                Ustawienie nowego hasła kończy wszystkie zalogowane sesje.
              </li>
              <li>
                Ze względów bezpieczeństwa ograniczamy liczbę wysyłanych kodów SMS oraz prób logowania. Po kilku
                nieudanych próbach logowanie jest chwilowo blokowane.
              </li>
            </ol>

            <h2>§3. Co widzisz w panelu</h2>
            <p>
              W panelu prezentujemy wszystkie zamówienia złożone na Twój numer telefonu: numer zamówienia, datę, status
              realizacji i płatności, kwotę, zamówione pozycje, adres dostawy oraz numery przesyłek, jeśli zostały już
              nadane. Jeśli zamówienie nie zostało opłacone, możesz je opłacić z panelu.
            </p>

            <h2>§4. Płatności z panelu</h2>
            <p>
              Płatności online obsługuje Przelewy24 (PayPro S.A. z siedzibą w Poznaniu, ul. Pastelowa 8, 60-198 Poznań,
              KRS 0000347935), zgodnie z regulaminem tego operatora. Zapłata z panelu dotyczy konkretnego,
              nieopłaconego zamówienia i nie zmienia jego zakresu ani ceny. Zamówień przekazanych już do realizacji w
              inny sposób (np. płatnych przy odbiorze) nie opłaca się przez panel.
            </p>

            <h2>§5. Twoje obowiązki</h2>
            <ol>
              <li>Zachowaj hasło i kody SMS dla siebie - nie przekazuj ich nikomu, także osobom podającym się za nas.</li>
              <li>
                Korzystaj z konta zgodnie z prawem. Nie próbuj uzyskać dostępu do cudzych zamówień ani obciążać systemu
                automatycznymi zapytaniami.
              </li>
              <li>
                Jeśli zauważysz nieuprawnione logowanie albo stracisz dostęp do numeru telefonu, niezwłocznie nas
                powiadom: {COMPANY_LEGAL.phone}, {COMPANY_LEGAL.email}.
              </li>
            </ol>

            <h2>§6. Dane osobowe</h2>
            <p>
              Administratorem danych jest {COMPANY_LEGAL.legalName}. W ramach konta przetwarzamy: numer telefonu, hash
              hasła (nigdy samego hasła), datę i wersję akceptacji tego regulaminu, daty logowań oraz dane zamówień
              powiązanych z numerem. Podstawą jest wykonanie umowy o prowadzenie konta (art. 6 ust. 1 lit. b RODO) oraz
              nasz uzasadniony interes w zabezpieczeniu panelu (art. 6 ust. 1 lit. f RODO). Kody SMS wysyła w naszym
              imieniu dostawca usługi SMS. Szczegóły, prawa i okresy przechowywania opisuje{" "}
              <Link href="/legal/prywatnosc">Polityka prywatności</Link>.
            </p>

            <h2>§7. Usunięcie konta i zmiany regulaminu</h2>
            <ol>
              <li>
                Konto możesz usunąć w każdej chwili - napisz na {COMPANY_LEGAL.email} z numeru lub adresu
                przypisanego do zamówień. Usunięcie konta nie usuwa samych zamówień, które musimy przechowywać ze
                względów księgowych i gwarancyjnych.
              </li>
              <li>
                Możemy zablokować konto, jeśli jest wykorzystywane niezgodnie z prawem lub z tym regulaminem -
                poinformujemy o tym na numer przypisany do konta.
              </li>
              <li>
                O zmianie regulaminu poinformujemy przy najbliższym logowaniu i poprosimy o akceptację nowej wersji.
                Dalsze korzystanie z konta wymaga jej zaakceptowania; brak zgody oznacza możliwość korzystania ze
                sklepu bez konta.
              </li>
            </ol>

            <h2>§8. Reklamacje dotyczące konta</h2>
            <p>
              Reklamacje dotyczące działania panelu zgłoś na {COMPANY_LEGAL.email} albo telefonicznie{" "}
              {COMPANY_LEGAL.phone} ({COMPANY_LEGAL.hours}). Odpowiadamy w terminie do 14 dni. Reklamacje dotyczące
              towarów rozpatrujemy na zasadach opisanych w{" "}
              <Link href="/legal/reklamacje">Reklamacje i zwroty</Link>.
            </p>
          </div>

          <p className={styles.sectionIntro}>
            <Link href="/moje-zamowienia">← Wróć do panelu „Moje zamówienia”</Link>
          </p>
        </article>
      </div>
    </main>
  );
}
