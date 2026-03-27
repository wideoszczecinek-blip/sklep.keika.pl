import { runtimeConfig } from "@/lib/runtime-config";

import type { AllegroConfiguratorConfig, SavedQuote } from "./types";

const DEFAULT_CRM_BASE = "https://crm-keika.groovemedia.pl";

const crmBase =
  runtimeConfig.crmApiBaseUrl.trim() || DEFAULT_CRM_BASE;

const apiUrl = (path: string) => `${crmBase}${path}`;

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const method = String(init?.method || "GET").toUpperCase();
  const hasBody = init?.body !== undefined && init?.body !== null;

  const response = await fetch(input, {
    ...init,
    headers: {
      ...(hasBody || (method !== "GET" && method !== "HEAD")
        ? { "Content-Type": "application/json" }
        : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchShopConfiguratorConfig() {
  return fetchJson<{ ok: boolean; config: AllegroConfiguratorConfig }>(
    apiUrl("/views/biuro/api/shop/configurator_public.php"),
    {
      method: "GET",
    },
  );
}

export async function saveShopQuote(payload: Record<string, unknown>) {
  return fetchJson<{ ok: boolean; quote: SavedQuote }>(
    apiUrl("/views/biuro/api/shop/quote_save.php"),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function resumeShopQuote(params: {
  quoteCode?: string;
  resumeToken?: string;
}) {
  const url = new URL(
    apiUrl("/views/biuro/api/shop/quote_resume.php"),
  );

  if (params.quoteCode) {
    url.searchParams.set("quote_code", params.quoteCode);
  }

  if (params.resumeToken) {
    url.searchParams.set("resume_token", params.resumeToken);
  }

  return fetchJson<{ ok: boolean; quote: SavedQuote | null }>(url.toString(), {
    method: "GET",
  });
}

export async function pingShopPresence(payload: Record<string, unknown>) {
  return fetchJson<{ ok: boolean; presence: { session_token: string; online_count: number } }>(
    apiUrl("/views/biuro/api/shop/presence_ping.php"),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function buildMarketplaceOfferUrl(offerId: string) {
  const normalized = String(offerId || "").trim();
  return normalized
    ? `https://allegro.pl/oferta/${encodeURIComponent(normalized)}`
    : "";
}
