import InfoPageShell from "@/app/components/info-page-shell";

export default function ContactPage() {
  return (
    <InfoPageShell
      eyebrow="Kontakt"
      title="Potrzebujesz pomocy przed zamówieniem?"
      lead="Jeśli chcesz potwierdzić pomiar, wariant profilu albo termin realizacji, napisz lub zadzwoń do nas przed złożeniem zamówienia."
    >
      <p>
        Najszybciej pomożemy wtedy, gdy od razu podasz typ produktu, kolor profilu, kolor siatki i przybliżone wymiary okna. Dzięki temu
        od razu przejdziemy do konkretów.
      </p>
      <p>
        W kolejnej iteracji sklepu dodamy tutaj pełny formularz kontaktowy oraz prosty status zamówienia. Na teraz ta sekcja jest gotowa
        jako punkt kontaktowy i wejście do dalszej obsługi klienta.
      </p>
    </InfoPageShell>
  );
}
