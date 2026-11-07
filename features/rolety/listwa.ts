// Listwa przyszybowa - instrukcja dla klienta (właściciel 7.11.2026: „trzeba
// klientowi zrobić instrukcję, znajdź konkretne przykłady listew
// przyszybowych i określ, które są półokrągłe, a które proste”). Dotyczy
// tylko rolety w kasecie z prowadnicą płaską (systemy.ts: systemAsksListwa).
//
// Przykłady tylko potwierdzone źródłem (research 7.11.2026):
// - Drutex: katalog okien PVC (drutex.pl/media/_upload/_promotion/katalog/fbc/okna_pvc_pl.pdf)
//   - Iglo 5: listwa standardowo zaokrąglona, kanciasta w opcji; Iglo Light zaokrąglona;
//   - Iglo Energy Alucover i Iglo-HS Alucover: kanciasta (prostokątna) w standardzie.
// - Oknoplast: Pixel - listwa prostokątna (katalog 2025); Prolux - zaokrąglona (oknoplast.com).
// - Salamander: bluEvolution 82 kanciasta w standardzie, Streamline 76 do wyboru (fensterblick.de).
// - Aluplast Ideal 4000 (m.in. Eko-Okna): linia classic (wyraźne kontury) albo round (zaokrąglona) - do wyboru.
// - REHAU Synego / Geneo: od 2025 listwa Edge PULS o kanciastej optyce (rehau.com).
// - VEKA Softline 70 AD: występuje z listwą zaokrągloną (sklepy z oknami).
// Wielu producentów daje wybór listwy przy zamówieniu okna, dlatego o wyborze
// decyduje wygląd listwy, a tabela jest tylko podpowiedzią.
// Montaż (rolmajster.pl, sun-systems.pl, rol-mol.pl): na listwę prostą idzie
// zwykła prowadnica płaska, na półokrągłą - prowadnica łukowa (ze stopką),
// inaczej zwykła płaska słabiej trzyma się zaokrąglonego lica.

export const LISTWA_JAK_SPRAWDZIC: string[] = [
  "Listwa przyszybowa to wąska listwa, która od strony pokoju dociska szybę do ramy skrzydła - to na niej leży płaska prowadnica rolety.",
  "Najłatwiej ocenić ją w rogu szyby: tam listwy schodzą się pod kątem 45° i widać ich przekrój.",
  "Przyłóż linijkę albo kartę płatniczą w poprzek listwy, od szyby do ramy.",
  "Leży płasko i się nie kołysze, a czoło listwy ma kilka milimetrów płaskiej powierzchni? Masz listwę prostą.",
  "Dotyka listwy w jednym miejscu i daje się przechylać, bo listwa jest łukiem od szyby aż do ramy? Masz listwę półokrągłą - dobierzemy do niej prowadnicę łukową.",
  "Listwa skośna, ozdobna (retro) albo nie masz pewności? Zrób zdjęcie rogu szyby z bliska i wyślij nam przed zamówieniem - odpowiemy, którą wybrać.",
];

export const LISTWA_PRZYKLADY: Array<{ system: string; listwa: string }> = [
  { system: "Oknoplast Pixel", listwa: "prosta (prostokątna)" },
  { system: "Drutex Iglo Energy Alucover, Iglo-HS Alucover", listwa: "prosta (kanciasta)" },
  { system: "Salamander bluEvolution 82", listwa: "zwykle prosta (kanciasta)" },
  { system: "REHAU Synego, Geneo (okna od 2025)", listwa: "zwykle prosta (kanciasta)" },
  { system: "Drutex Iglo 5, Iglo Light", listwa: "zwykle półokrągła (prosta w opcji)" },
  { system: "Oknoplast Prolux", listwa: "półokrągła" },
  { system: "VEKA Softline 70 AD", listwa: "często półokrągła" },
  { system: "Aluplast Ideal 4000 (m.in. Eko-Okna), Salamander Streamline 76", listwa: "obie wersje - sprawdź linijką" },
];
