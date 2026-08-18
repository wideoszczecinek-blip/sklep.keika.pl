/**
 * Curated real customer reviews for "Moskitiery ramkowe", copied verbatim
 * (dates, masked Allegro logins, and text) from the live Allegro listing.
 *
 * Why curated and not "all": Allegro's review UI renders the star rating as
 * an icon, not text, so a copy/paste of the review list carries no per-review
 * star value — there is no reliable way to tell which of these are the "4-5
 * star" ones from the text alone. Rather than guess or fabricate a rating,
 * this list only includes reviews with clearly positive, substantive text
 * (the aggregate average/count/distribution shown above them on the shop
 * page comes from Allegro's real rating API instead, see
 * allegro_offer_rating_public.php in the CRM).
 *
 * Do not add entries here that weren't actually provided by the business —
 * this list is meant to stay 100% real, not "representative".
 */
export type AllegroReviewEntry = {
  date: string;
  maskedLogin: string;
  storeAccount: string;
  body: string;
  pros?: string;
  cons?: string;
  hasPhotos?: boolean;
};

export const MOSKITIERY_RAMKOWE_ALLEGRO_REVIEWS: AllegroReviewEntry[] = [
  {
    date: "13 sierpnia 2026",
    maskedLogin: "C...8",
    storeAccount: "keika_pl",
    body: "Wspaniały, rewelacyjny produkt pod każdym względem, już nie obawiamy się o owady a szczególnie te najgroźniejsze - szerszenie, solidne mocowania, po montażu bardzo dobrze dopasowana do okna, na zewnątrz świetnie wkomponowana w okno. Rewelacyjny stosunek cena-jakość. Zdecydowanie POLECAM!!!",
    pros: "Solidna konstrukcja, bardzo łatwy montaż",
    cons: "Brak",
  },
  {
    date: "8 kwietnia 2026",
    maskedLogin: "m...7",
    storeAccount: "keikarolety",
    body: "Moskitiera spełnia moje oczekiwania, profile są dobrej jakości, siatka również jest dobrej jakości. Czas pokaże ile wytrzyma na oknie. Montaż jest banalnie prosty. System mocowania moskitiery w oknie za pomocą sprężynek jest o 100% lepszy od blaszek.",
    pros: "Jakość materiałów, system mocowania",
    cons: "Brak",
  },
  {
    date: "2 lipca 2026",
    maskedLogin: "c...4",
    storeAccount: "keikarolety",
    body: "Genialny sposób zamawiania. Solidne profile nie odkształcają się nawet na większych długościach. Z zewnątrz zlewają się z ramą okna i wyglądają jak jego integralna część. Ogólnie rzecz biorąc polecam, bo warto.",
  },
  {
    date: "5 czerwca 2026",
    maskedLogin: "C...5",
    storeAccount: "keikarolety",
    body: "To bardzo dobry produkt. Ładnie wykonany. Siatka dobrej jakości. Łatwy montaż. Należy zwrócić uwagę, aby zbyt mocno nie napinać siatki przy wciskaniu uszczelek, bo rama się zniekształca. Polecam tego sprzedawcę i ten produkt.",
    pros: "Ładny wygląd",
  },
  {
    date: "11 sierpnia 2026",
    maskedLogin: "S..._",
    storeAccount: "keika_pl",
    body: "Spełnia swoje zadanie, montaż stosunkowo prosty, wszystkie niezbędne akcesoria są, nawet przyrząd do wciskania uszczelki z siatką. Instrukcja w zestawie. Na tą chwilę jestem zadowolony. Ogólnie polecam zakup.",
  },
  {
    date: "18 czerwca 2026",
    maskedLogin: "C...0",
    storeAccount: "keikarolety",
    body: "Firma dobrze opisała procedurę pomiarów okna przed złożeniem zamówienia, wątpliwości zostały wyjaśnione w rozmowie telefonicznej, moskitiera dotarła dobrze zabezpieczona, montaż był bezproblemowy, jakość bez zastrzeżeń.",
  },
  {
    date: "5 sierpnia 2026",
    maskedLogin: "m...8",
    storeAccount: "keikarolety",
    body: "Montaż bardzo łatwy, pomogły wcześniej nawiercone otworki za co bardzo dziękuję! Montaż był na drewniane okno, gdzie nie ma ram z uszczelkami a listewki zewnętrzne - mimo to Państwo znaleźli idealne rozwiązanie dla mnie! Bardzo polecam i wrócę po kilka moskitier na inne okna!",
    pros: "Szybki i łatwy montaż, duża pomoc sprzedającego",
    cons: "Brak",
  },
  {
    date: "28 czerwca 2026",
    maskedLogin: "C...0",
    storeAccount: "keikarolety",
    body: "Coś czego szukałem od dawna, prosty montaż, mega jakość i pasuje do rolet zewnętrznych! Na pewno będę zamawiał na resztę okien.",
    pros: "Prosty montaż, wysoka jakość produktów, szybkość realizacji zamówienia",
    cons: "Brak",
  },
  {
    date: "8 maja 2026",
    maskedLogin: "j...t",
    storeAccount: "keikarolety",
    body: "Idealne, siatka mocna, mam już jedną przetestowaną 2 lata. Dalej nic się z nią nie dzieje. Teraz zakupiłam kolejne. Bardzo łatwy montaż.",
    pros: "Same",
    cons: "Brak",
  },
  {
    date: "25 kwietnia 2026",
    maskedLogin: "k...e",
    storeAccount: "keikarolety",
    hasPhotos: true,
    body: "Super rozwiązanie. Sprężynki pozwalają na dociągnięcie tam, gdzie okno jest nierówne. Montaż bardzo łatwy. Szary kolor gubi się i siatkę tylko nieznacznie widać. Polecam dla niezdecydowanych.",
    pros: "Łatwo ściągać i zakładać, siatka jest stabilna",
    cons: "Brak",
  },
  {
    date: "13 kwietnia 2026",
    maskedLogin: "C...0",
    storeAccount: "keikarolety",
    hasPhotos: true,
    body: "Jestem bardzo zadowolona! Perfekcyjna i pomocna obsługa, siatka będzie docelowo zamontowana w terrarium, dopasowana idealnie. Dziękuję bardzo! Na pewno wrócę.",
  },
  {
    date: "22 kwietnia 2026",
    maskedLogin: "C...8",
    storeAccount: "keikarolety",
    hasPhotos: true,
    body: "Moskitiera super, montaż prosty, bo firma elegancko podocinała i oznaczyła poszczególne elementy do każdego okna.",
    pros: "Dobrze chroni przed owadami i wygląda elegancko",
    cons: "Brak",
  },
  {
    date: "11 sierpnia 2026",
    maskedLogin: "P...7",
    storeAccount: "keika_pl",
    hasPhotos: true,
    body: "Produkt super, lekki, szybko się składa. Polecam.",
    pros: "Lekka i stabilna",
  },
  {
    date: "6 sierpnia 2026",
    maskedLogin: "5...t",
    storeAccount: "keika_pl",
    body: "W prosty sposób się wylicza wymiar, proste w montażu, elegancko wyglądają.",
  },
  {
    date: "9 sierpnia 2026",
    maskedLogin: "m...3",
    storeAccount: "keikarolety",
    body: "Świetna siatka, polecam. Produkt zgodny z zamówieniem.",
  },
  {
    date: "1 czerwca 2026",
    maskedLogin: "j...7",
    storeAccount: "keika_pl",
    body: "Jakość, przygotowanie elementów i łatwość montażu - wszystko na 5+. Czytelna instrukcja w języku polskim. Polecam :)",
  },
  {
    date: "10 maja 2026",
    maskedLogin: "r...a",
    storeAccount: "keikarolety",
    body: "Produkt zgodny z zamówieniem, wykonany bardzo profesjonalnie. Czytelna instrukcja. Udało się złożyć i zamontować bez problemów. Zamówiona jedna sztuka na próbę, ale na pewno jeszcze zamówię do pozostałych okien.",
  },
  {
    date: "16 lipca 2026",
    maskedLogin: "c...4",
    storeAccount: "keikarolety",
    hasPhotos: true,
    body: "Dobra jakość, montaż prosty i intuicyjny.",
  },
  {
    date: "9 czerwca 2026",
    maskedLogin: "C...9",
    storeAccount: "keika_pl",
    hasPhotos: true,
    body: "Polecam, szybki i łatwy sposób złożenia ramki i założenia siatki. Dobrze trzyma się okna.",
  },
  {
    date: "25 kwietnia 2026",
    maskedLogin: "a...8",
    storeAccount: "keikarolety",
    hasPhotos: true,
    body: "Dobrze wymierzone.",
    pros: "Mocne sprężynki, dobrze trzymają",
  },
  {
    date: "12 sierpnia 2026",
    maskedLogin: "C...9",
    storeAccount: "keikarolety",
    body: "Polecam. Produkt do własnego montażu. Łatwa instrukcja. Moskitiera wisi już miesiąc, nic się z nią nie dzieje. Dobra jakość.",
  },
  {
    date: "13 sierpnia 2026",
    maskedLogin: "C...6",
    storeAccount: "keika_pl",
    body: "Podany przeze mnie wymiar pasuje idealnie. Montaż zajął mi 15 min. Bardzo, bardzo polecam.",
  },
  {
    date: "21 lipca 2026",
    maskedLogin: "C...6",
    storeAccount: "keika_pl",
    body: "Produkt dobrej jakości, bezproblemowy i prosty montaż. Wystarczy uważnie przeczytać wskazówki producenta dotyczące pomiarów, a pasuje idealnie. Konfigurator świetna sprawa.",
  },
];
