import InfoPageShell from "@/app/components/info-page-shell";

export default function AboutPage() {
  return (
    <InfoPageShell
      eyebrow="KEIKA"
      title="Tworzymy osłony dopasowane do realnych okien i realnych domów."
      lead="Łączymy doświadczenie produkcyjne z prostą konfiguracją online, żeby wybór moskitiery był czytelny, szybki i bez zgadywania."
    >
      <p>
        Zależy nam na tym, żeby klient najpierw rozumiał produkt, a dopiero potem przechodził do wyboru koloru, siatki i wymiarów.
        Dlatego sklep KEIKA rozwijamy wokół czytelnego opisu, podglądu wariantu i wyceny krok po kroku.
      </p>
      <p>
        W praktyce oznacza to mniej pomyłek przy zamówieniu, lepsze dopasowanie do stolarki i prostszy kontakt wtedy, gdy potrzebujesz
        wsparcia przed zakupem lub po nim.
      </p>
    </InfoPageShell>
  );
}
