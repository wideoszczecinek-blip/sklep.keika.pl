import type { Metadata } from "next";
import Home from "./home-client";

const SITE = "https://sklep.keika.pl";

export const metadata: Metadata = {
  title: "KEIKA | Rolety, moskitiery i markizy na wymiar",
  description:
    "Sklep producenta KEIKA: moskitiery ramkowe, rolety i plisy na wymiar z wyceną online w 30 sekund. 5 lat gwarancji, darmowa dostawa od 79 zł.",
  alternates: { canonical: SITE + "/" },
  openGraph: {
    type: "website",
    locale: "pl_PL",
    siteName: "KEIKA",
    url: SITE + "/",
    title: "KEIKA | Rolety, moskitiery i markizy na wymiar",
    description: "Osłony okienne na wymiar od producenta z wyceną online. 5 lat gwarancji, darmowa dostawa od 79 zł.",
  },
};

// The homepage stays a static shell (client-side product switching via
// ?produkt=... still works for every product); the live product has its own
// statically rendered route - see app/moskitiery-ramkowe/page.tsx and the
// redirect in next.config.ts.
export default function Page() {
  return <Home />;
}
