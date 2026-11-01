import type { Metadata } from "next";
import { COMPANY_LEGAL } from "@/lib/company-legal";
import styles from "@/app/moskitiery/moskitiery-v2.module.css";

/**
 * Regulamin wizualizatora „Twoje okno” (właściciel 1.11: zgoda na oferty i promocje ma być ujęta w regulaminie -
 * jedno pole „Akceptuję regulamin” w oknie e-mail). Osobna strona, żeby regulamin sklepu (CRM → strony formalne)
 * nie zmieniał się przed uruchomieniem wizualizatora dla klientów.
 */
const REGULAMIN_WIZUALIZATORA_WERSJA = "2026-11-01";

export const metadata: Metadata = {
  title: "Regulamin wizualizatora „Twoje okno” | KEIKA",
  robots: { index: false },
};

export default function RegulaminWizualizatoraPage() {
  const c = COMPANY_LEGAL;
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <article className={styles.legalCard}>
          <h1>Regulamin wizualizatora „Twoje okno”</h1>
          <p className={styles.sectionIntro}>Wersja z {REGULAMIN_WIZUALIZATORA_WERSJA.split("-").reverse().join(".")} r.</p>
          <div className={styles.legalHtml}>
            <h2>§ 1. Kto prowadzi wizualizator</h2>
            <p>
              Wizualizator „Twoje okno” w sklepie sklep.keika.pl prowadzi {c.legalName}, {c.street}, {c.postalCode} {c.city}, NIP {c.nip}, REGON {c.regon}{" "}
              (dalej: KEIKA). Kontakt: <a href={`mailto:${c.email}`}>{c.email}</a>, {c.phone}. Korzystanie z wizualizatora jest bezpłatne.
              W sprawach nieuregulowanych tu stosuje się <a href="/regulamin">Regulamin sklepu</a>.
            </p>

            <h2>§ 2. Zdjęcie okna</h2>
            <p>
              Wysyłając zdjęcie, zlecasz KEIKA przygotowanie wizualizacji plis na Twoim oknie. Zdjęcie analizują automatycznie narzędzia sztucznej inteligencji:
              rozpoznają okno i szyby, mogą uporządkować zdjęcie (usunąć osoby, zwierzęta, bałagan i zamontowane osłony) i dobierają tkaniny do wnętrza.
              Jeśli na zdjęciu są osoby, oryginał usuwamy zaraz po uporządkowaniu. Zdjęcia i wizualizacje przechowujemy przez 30 dni, a potem je kasujemy.
              Nie używamy ich w reklamach.
            </p>

            <h2>§ 3. Wizualizacja i wymiary</h2>
            <p>
              Wizualizacja jest poglądowa – kolory, faktura i proporcje mogą się różnić od produktu. Wymiary odczytane ze zdjęcia są wyłącznie szacunkowe.
              Plisy produkujemy na wymiar podany przez Ciebie: zamówienie z wizualizatora jest możliwe dopiero po wpisaniu wymiarów zmierzonych według instrukcji
              i potwierdzeniu pomiaru przy każdej szybie. Za wymiary odpowiada osoba, która je podaje.
            </p>

            <h2>§ 4. Adres e-mail, oferty i promocje</h2>
            <p>
              Podając adres e-mail i akceptując ten regulamin, prosisz o przesłanie linku do wizualizacji z wyceną oraz wyrażasz zgodę na otrzymywanie od KEIKA
              e-mailem informacji handlowych – ofert i promocji sklepu (w rozumieniu przepisów o świadczeniu usług drogą elektroniczną i prawa komunikacji
              elektronicznej). Wysyłamy: link do wizualizacji z wyceną, jedno przypomnienie po około 24 godzinach, jeśli nie dokończysz wyceny, oraz oferty
              i promocje KEIKA.
            </p>
            <p>
              Zgodę na oferty i promocje możesz wycofać w każdej chwili – linkiem „Nie chcę więcej wiadomości” w każdej wiadomości albo pisząc na{" "}
              <a href={`mailto:${c.email}`}>{c.email}</a>. Wycofanie zgody nie wpływa na wizualizację i złożone zamówienia. Podanie adresu e-mail jest dobrowolne –
              z wizualizatora możesz korzystać bez niego.
            </p>

            <h2>§ 5. Dane osobowe</h2>
            <p>
              Administratorem danych (zdjęcia, adresu e-mail, danych o korzystaniu z wizualizatora) jest KEIKA. Dane przetwarzamy, aby przygotować wizualizację
              i wycenę, wysłać wiadomości opisane w § 4 oraz rozwijać sklep. Szczegóły, w tym Twoje prawa (dostęp, sprostowanie, usunięcie, sprzeciw, skarga do
              Prezesa UODO), opisuje <a href="/legal/prywatnosc">Polityka prywatności</a>.
            </p>
          </div>
        </article>
      </div>
    </main>
  );
}
