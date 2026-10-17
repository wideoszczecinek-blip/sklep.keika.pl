import type { Metadata } from "next";
import { buildRoletyMetadata, RoletyProductPage } from "@/features/rolety/page-factory";

// Strona produktu "Żaluzje poziome na wymiar" (konfigurator + koszyk) na
// mechanizmie rolet mini (features/rolety/). Treść landingu z CRM
// (product_groups), modele, kolory i cennik z configurator_public.
// Do akceptacji właściciela widoczna tylko w podglądzie (proxy.ts).
const SLUG = "zaluzje";

export const metadata: Metadata = buildRoletyMetadata(SLUG);

export default function Page() {
  return <RoletyProductPage slug={SLUG} />;
}
