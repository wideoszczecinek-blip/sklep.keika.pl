import InfoPageShell from "@/app/components/info-page-shell";

export default function TermsPage() {
  return (
    <InfoPageShell
      eyebrow="Regulamin"
      title="Sekcja regulaminu jest przygotowana pod rozwój sklepu."
      lead="W tej chwili porządkujemy ścieżkę produktu i konfiguratora. Pełny regulamin sklepu oraz polityki zakupowe podłączymy przed uruchomieniem finalnego checkoutu."
    >
      <p>
        Ten adres jest już zarezerwowany, żeby menu sklepu prowadziło do właściwego miejsca i nie kończyło się błędem 404 podczas
        dalszej rozbudowy.
      </p>
      <p>
        Gdy tylko domkniemy checkout i płatność, uzupełnimy tu pełne treści prawne, warunki zamówienia oraz zasady reklamacji i zwrotów.
      </p>
    </InfoPageShell>
  );
}
