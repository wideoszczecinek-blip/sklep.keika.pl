// Treści lejka stron plis i rolet dachowych (features/dachowe/LejekDachowy.tsx) w zwykłym module, żeby czytało je
// też /api/landing-facts - Agencja AI (AGN-915/916, 3.11) nie widziała sekcji z 2.11 i zlecała je jeszcze raz.

export type ProduktDachowy = "plisy-dachowe" | "rolety-dachowe";

/** Dni robocze produkcji (agent-catalog.ts). */
export const DNI_PRODUKCJI: Record<ProduktDachowy, number> = { "plisy-dachowe": 7, "rolety-dachowe": 5 };

export const OPIS: Record<ProduktDachowy, { lead: string; tekst: string; cechy: [string, string][] }> = {
  "plisy-dachowe": {
    lead: "Plisa, która na skosie trzyma się szyby.",
    tekst:
      "Dwie aluminiowe belki pracują w bocznych prowadnicach, więc tkanina zostaje przy szybie przy każdym nachyleniu dachu i przy uchylonym oknie. Każdą belkę ustawiasz osobno – zasłonisz całe okno, samą górę, dół albo pas na środku. Robimy ją pod model Twojego okna dachowego: wystarczy symbol z tabliczki znamionowej.",
    cechy: [
      ["Dobrana do modelu okna", "{modeli} modeli w bibliotece, model odczytamy też ze zdjęcia tabliczki"],
      ["Nie wybrzusza się na skosie", "aluminiowe prowadnice boczne, bez prześwitów po bokach"],
      ["Zasłaniasz dowolny fragment", "górna i dolna belka niezależnie – zostaje tam, gdzie ją puścisz"],
      ["150 tkanin w 5 kolekcjach", "od rozpraszających światło po zaciemniające DUO TERMO z powłoką termiczną"],
      ["3 kolory osprzętu", "biały, anoda (szary) albo sosna – do ramy Twojego okna"],
      ["Montaż w 10–15 minut", "śrubokręt PZ1, wszystkie elementy i instrukcja w paczce"],
    ],
  },
  "rolety-dachowe": {
    lead: "Ciemno w sypialni na poddaszu – albo miękkie światło. W kasecie, nie na haczykach.",
    tekst:
      "Tkanina chowa się w aluminiowej kasecie, jest stale napięta sprężyną i prowadzona w bocznych prowadnicach, a hamulec w belce zatrzymuje ją na dowolnej wysokości. Bez łańcuszka i bez wiszących sznurków. Robimy ją pod model Twojego okna dachowego: wystarczy symbol z tabliczki znamionowej.",
    cechy: [
      ["Dobrana do modelu okna", "{modeli} modeli w bibliotece, model odczytamy też ze zdjęcia tabliczki"],
      ["TERMO: zaciemnia i chroni przed upałem", "blackout ze srebrną warstwą od strony szyby, 19 kolorów"],
      ["DEKO: rozprasza światło", "54 kolory – pokój zostaje jasny, a ostre słońce znika"],
      ["Zatrzymasz ją w dowolnym miejscu", "hamulec MULTISTOP w dolnej belce"],
      ["Aluminium, nie plastik", "kaseta, prowadnice i belka w 3 kolorach: biały, anoda, jasna sosna"],
      ["Komplet do montażu", "wkręty i instrukcja w paczce, montaż do skrzydła bez specjalistycznych narzędzi"],
    ],
  },
};

/** Najczęstsze okna dachowe: [wyszukiwanie w bibliotece, napis „do okna …”]. */
export const TYPOWE_OKNA: [string, string][] = [
  ["Velux MK04", "do okna VELUX MK04 (78 × 98 cm)"],
  ["Velux MK06", "do okna VELUX MK06 (78 × 118 cm)"],
  ["Fakro 78x118", "do okna FAKRO 78 × 118 cm"],
  ["Velux MK08", "do okna VELUX MK08 (78 × 140 cm)"],
  ["Velux FK06", "do okna VELUX FK06 (66 × 118 cm)"],
];

/** Kolejność sekcji strony (home-client.tsx) - opis dla Agencji, zmieniaj razem z układem strony. */
export const SEKCJE_LEJKA = [
  "zdjęcia produktu",
  "pasek: cena od, liczba modeli okien, Polski producent, 5 lat gwarancji, 30 dni na zwrot, darmowa dostawa od 79 zł",
  "opis sprzedażowy: lead, akapit i 6 wypunktowanych korzyści, cena przykładowego okna VELUX MK06, przycisk „Sprawdź cenę dla swojego okna”",
  "dowód społeczny: ocena firmy i liczba opinii klientów, ponad 7 000 zamówień w 2026 r., cytat z opinii 5★ (ukryty, gdy brak oceny)",
  "Kupujesz bez ryzyka: dobór do modelu okna po tabliczce znamionowej (wpisz albo zdjęcie, sprawdzamy przed produkcją), 30 dni na zwrot także na wymiar, 5 lat gwarancji (produkujemy sami), pomyłka przy wyborze okna – poprawimy przed produkcją, dane firmy i płatności, data wysyłki (dni produkcji + kurier 24 h)",
  "jak to działa",
  "ceny najczęstszych okien z cennika konfiguratora (na żywo, klik = wycena okna) + przykład CAŁY DOM dla 2 i 3 okien",
  "konfigurator (wycena)",
  "tkaniny / kolekcje",
  "pomiar po tabliczce znamionowej + film i czat",
  "opinie",
  "FAQ ułożone od obiekcji",
] as const;
