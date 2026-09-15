// Instruction steps for the plisy landing ("Instrukcje" tab) and the
// configurator's "Jak mierzyć?" popup, which opens the step whose title
// contains "pomiar" (see openMeasurementInstructions in home-client.tsx).
//
// Step 1 renders the animated MeasureGuide instead of a photo/video
// (customMedia). The measurement rules in the body match the guide exactly
// - owner, 2026-09-16: STANDARD = seal centre to seal centre for both
// dimensions; BEZINWAZYJNY = bead/frame line to bead/frame line for width,
// whole sash for height.
//
// Steps 2-3 are deliberately text-only: the owner has no montage video for
// plisy yet, and a stock clip would be the wrong product.

export type PlisyInstructionStep = {
  title: string;
  body: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  customMedia?: "plisy-measure";
};

export const PLISY_INSTRUCTION_STEPS: PlisyInstructionStep[] = [
  {
    title: "1. Pomiar — dwa sposoby, zależnie od montażu",
    customMedia: "plisy-measure",
    body: `
<p>Najpierw zdecyduj, jak zamontujesz plisę — bo od tego zależy, co mierzysz. Mierz metalową miarką, dwa razy, i zapisz wynik w milimetrach.</p>
<h4>Montaż STANDARD (wkręcany przy szybie)</h4>
<p>Profil plisy siedzi między listwami przyszybowymi, dlatego mierzysz w świetle szyby:</p>
<ul>
<li><strong>Szerokość:</strong> od połowy lewej uszczelki do połowy prawej uszczelki.</li>
<li><strong>Wysokość:</strong> od połowy górnej uszczelki do połowy dolnej uszczelki.</li>
</ul>
<p>Nic nie odejmuj — połowa uszczelki z każdej strony to dokładnie luz, którego potrzebuje profil. Szerokość zmierz na górze i na dole; jeśli wyniki się różnią, wpisz mniejszy.</p>
<h4>Montaż BEZINWAZYJNY (uchwyty na skrzydło)</h4>
<p>Plisa zasłania szybę razem z listwami, a uchwyty zakładasz na skrzydło:</p>
<ul>
<li><strong>Szerokość:</strong> od kreseczki do kreseczki — kreseczka to cienka linia, w której listwa przyszybowa łączy się z ramą skrzydła.</li>
<li><strong>Wysokość:</strong> całe skrzydło, od górnej do dolnej krawędzi ramy.</li>
</ul>
<p>Nic nie odejmuj. Sprawdź tylko, czy między profilem a klamką zostaje co najmniej 5 mm.</p>
<p>Każde okno mierz osobno — nawet „takie same" okna potrafią różnić się o kilka milimetrów.</p>
`,
  },
  {
    title: "2. Montaż — kwadrans na okno, wkrętak wystarczy",
    body: `
<p>Plisę dostajesz gotową, z uchwytami i wkrętami w komplecie.</p>
<ul>
<li><strong>STANDARD:</strong> przykręcasz cztery uchwyty w narożnikach listew przyszybowych, potem wpinasz górną i dolną listwę plisy. Wiertarka niepotrzebna — wkręty wchodzą w PCV wkrętakiem.</li>
<li><strong>Bezinwazyjny PCV:</strong> uchwyty zakładasz na górną i dolną krawędź skrzydła, bez żadnych śladów. Zdejmiesz je w każdej chwili.</li>
<li><strong>Bezinwazyjny METAL:</strong> jak wyżej, ale stalowe, sztywniejsze zaczepy — do szerokich i wysokich plis, drzwi balkonowych i cięższych tkanin DUO.</li>
</ul>
<p>Po zawieszeniu przesuń obie listwy do końca w górę i w dół. Jeśli sznurki są za luźne albo za sztywne, napięcie regulujesz supełkiem pod górną listwą.</p>
`,
  },
  {
    title: "3. Codzienne używanie i czyszczenie",
    body: `
<p>Obie listwy przesuwasz za uchwyty na środku — plisa zatrzymuje się tam, gdzie ją puścisz. Do otwierania i uchylania okna nic nie trzeba zdejmować: plisa jedzie razem ze skrzydłem.</p>
<p>Kurz zbierasz odkurzaczem z miękką końcówką albo suchą ściereczką, przy złożonej plisie. Plamę przetrzyj lekko wilgotną gąbką — bez moczenia całej tkaniny i bez środków chemicznych. Tkaniny mają powłokę antystatyczną, więc brudzą się wolniej, niż się spodziewasz.</p>
`,
  },
];
