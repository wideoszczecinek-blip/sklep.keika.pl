import InfoPageShell from "@/app/components/info-page-shell";

export default function OrdersPage() {
  return (
    <InfoPageShell
      eyebrow="Moje zamówienia"
      title="Panel zamówień rozwijamy jako osobny etap sklepu."
      lead="Ta sekcja będzie docelowo miejscem do sprawdzenia statusu, historii wycen i danych do zamówienia bezpośrednio z poziomu sklepu."
    >
      <p>
        Na teraz główna ścieżka zakupowa prowadzi przez konfigurator moskitier. Statusy i zapisane wyceny są już rozdzielone po stronie
        sklepu WWW, a widok klienta do przeglądania zamówień dołożymy w następnym kroku.
      </p>
      <p>
        Jeśli masz już kod wyceny albo chcesz wrócić do konfiguracji, zacznij od strony moskitier i przejdź do zapisanej wyceny.
      </p>
    </InfoPageShell>
  );
}
