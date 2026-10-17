// Profil żaluzji po stronie serwera: lista modeli do generateStaticParams,
// nazwa i cena "od" do metadanych i JSON-LD stron /zaluzje/<model>.
// Odpowiedź CRM trzymana w pamięci podręcznej Next przez godzinę - zmiany
// właściciela w CRM i tak widać od razu w konfiguratorze (pobiera na żywo).
import { CONFIGURATOR_PUBLIC_URL, roletyProfileFromCatalogJson, type RoletyProfile } from "./shared";

export async function fetchZaluzjeProfileServer(): Promise<RoletyProfile | null> {
  try {
    const response = await fetch(`${CONFIGURATOR_PUBLIC_URL}?slug=zaluzje`, { next: { revalidate: 3600 } });
    if (!response.ok) return null;
    return roletyProfileFromCatalogJson(await response.json(), "zaluzje");
  } catch {
    return null;
  }
}
