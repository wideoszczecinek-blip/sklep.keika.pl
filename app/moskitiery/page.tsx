import type { Metadata } from "next";
import { fetchLandingContent, fetchLegalPage, fetchProductContent, fetchSiteContent } from "@/lib/shop-public";
import MoskitieryLandingClient from "./landing-client";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const [{ site }, { landing }] = await Promise.all([
      fetchSiteContent(),
      fetchLandingContent("moskitiery"),
    ]);

    return {
      title: landing.seo_title || `${site.site_title} | Moskitiery`,
      description: landing.seo_description,
      alternates: {
        canonical: `${site.primary_domain || "https://sklep.keika.pl"}/moskitiery`,
      },
    };
  } catch {
    return {
      title: "Moskitiery | KEIKA",
      description: "Moskitiery ramkowe na wymiar z konfiguracją online.",
    };
  }
}

export default async function MoskitieryPage() {
  const [{ site }, { landing }, { product }, regulamin, prywatnosc, cookies, dostawa, reklamacje] =
    await Promise.all([
      fetchSiteContent(),
      fetchLandingContent("moskitiery"),
      fetchProductContent("moskitiery-ramkowe"),
      fetchLegalPage("regulamin"),
      fetchLegalPage("prywatnosc"),
      fetchLegalPage("cookies"),
      fetchLegalPage("dostawa-i-platnosc"),
      fetchLegalPage("reklamacje"),
    ]);

  return (
    <MoskitieryLandingClient
      site={site}
      landing={landing}
      product={product}
      legalPages={{
        regulamin: regulamin.page,
        prywatnosc: prywatnosc.page,
        cookies: cookies.page,
        "dostawa-i-platnosc": dostawa.page,
        reklamacje: reklamacje.page,
      }}
    />
  );
}

