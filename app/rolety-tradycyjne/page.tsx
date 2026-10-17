import type { Metadata } from "next";
import { buildRoletyMetadata, RoletyProductPage } from "@/features/rolety/page-factory";

// Strona produktu "Rolety mini na wymiar - Deko i Termo" (konfigurator + koszyk).
// Treść landingu z CRM (product_groups), cennik i opcje z configurator_public.
const SLUG = "rolety-tradycyjne";

export const metadata: Metadata = buildRoletyMetadata(SLUG);

export default function Page() {
  return <RoletyProductPage slug={SLUG} />;
}
