import type { Metadata } from "next";
import SamplesClient from "./samples-client";

// Próbki tkanin plis (27.10.2026) - do akceptacji właściciela strona działa tylko z linkiem testowym
// (lib/samples.ts), dlatego nie jest indeksowana.
export const metadata: Metadata = {
  title: "Bezpłatne próbki tkanin do plis | KEIKA",
  description: "Zamów do 5 bezpłatnych próbek tkanin plisowanych i zobacz kolor przy swoim oknie. Płacisz tylko za dostawę.",
  alternates: { canonical: "https://sklep.keika.pl/probki" },
  robots: { index: false, follow: true },
};

export default function SamplesPage() {
  return <SamplesClient />;
}
