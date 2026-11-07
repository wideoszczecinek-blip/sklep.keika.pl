import type { Metadata } from "next";
import { buildRoletyMetadata, RoletyProductPage } from "@/features/rolety/page-factory";

// Rolety tradycyjne - system rolety-mini (właściciel, 7.11.2026): własny opis, galeria
// i cennik w CRM (product_groups + product_configurators), pomiar systemu w
// features/rolety/systemy.ts, konfigurator features/rolety/SystemyPanel.tsx.
// Do akceptacji cen przez właściciela widoczna tylko w podglądzie (proxy.ts).
const SLUG = "rolety-mini";

export const metadata: Metadata = buildRoletyMetadata(SLUG);

export default function Page() {
  return <RoletyProductPage slug={SLUG} />;
}
