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
<p>Plisę dostajesz gotową do zawieszenia. W paczce jest wszystko, czego potrzebujesz:</p>
<ul>
<li><strong>uchwyty</strong> do wybranego montażu,</li>
<li><strong>wkręty</strong> (montaż STANDARD),</li>
<li><strong>specjalny przymiar — uchwyt montażowy</strong>, który ustawia uchwyty w dokładnie tym samym miejscu na obu listwach,</li>
<li><strong>czytelna instrukcja montażu</strong> krok po kroku.</li>
</ul>
<ul>
<li><strong>STANDARD:</strong> przykładasz przymiar do narożników listew przyszybowych, przykręcasz cztery uchwyty wkrętakiem (wiertarka niepotrzebna — wkręty wchodzą w PCV), potem wpinasz górną i dolną listwę plisy.</li>
<li><strong>Bezinwazyjny:</strong> uchwyty zakładasz na górną i dolną krawędź skrzydła — bez wiercenia i bez śladów, zdejmiesz je w każdej chwili. Uchwyty są w kolorze wybranym w konfiguratorze: białym, jasnym brązie lub ciemnym brązie.</li>
</ul>
<p>Plisy szersze niż 100 cm mają po dwa uchwyty do przesuwania na każdej listwie — ciągnij za oba naraz, listwa idzie równo. Po zawieszeniu przesuń obie listwy do końca w górę i w dół. Jeśli sznurki są za luźne albo za sztywne, napięcie regulujesz supełkiem pod górną listwą.</p>
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
