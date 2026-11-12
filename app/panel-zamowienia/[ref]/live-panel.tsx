"use client";

// Panel zamówienia na prawdziwych danych (właściciel 12.11.2026: „wdrażaj”). Dane z CRM po tokenie z linku
// (shop-public/order_panel.php); przewidywany termin liczony tutaj - zawsze jako przedział / orientacyjny,
// nigdy jako deklaracja.
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import OrderPanel, { type PanelData, type PanelOrder } from "../order-panel";
import { CRM_PUBLIC_BASE } from "@/app/components/payment-methods";
import { dzienWysylki } from "@/features/plisy/Premium";
import { dataZCrm, dniProdukcji } from "@/lib/delivery-eta";
import { trackShopStep } from "@/lib/track-step";

const API = `${CRM_PUBLIC_BASE}/order_panel.php`;
const OFFICE_PHONE = "+48 790 215 251";
const DZIEN_KROTKO = ["niedz.", "pon.", "wt.", "śr.", "czw.", "pt.", "sob."];

type ApiItem = { name: string; qty: number; price: number | null; params: [string, string][] };
type ApiOrder = {
  number: string;
  temp_code: string;
  placed_at: string;
  status: string;
  stages: string[];
  stage: number;
  cancelled: boolean;
  done: boolean;
  delivery_kind: "shipping" | "pickup" | "montage";
  planned: string | null;
  installation_date: string | null;
  paid_at: string | null;
  slugs: string[];
  items_note: string;
  items: ApiItem[];
  subtotal: number | null;
  discounts: [string, number][];
  extras: [string, number][];
  delivery: { method: string; name: string; address: string; phone: string; fee: number | null };
  payment: { method: string; state: string; pay_url: string };
  total: number;
  total_label: string;
  documents: { label: string; note: string }[];
  shipment: { carrier: string; number: string; link: string } | null;
  changes_open: boolean;
  can_claim: boolean;
  claims: { number: string; status_label: string; date: string }[];
  requests: { kind: string; topic: string; item: string; message: string; date: string }[];
};
type ApiResponse = {
  ok: boolean;
  error?: string;
  kind: "shop" | "local";
  first_name: string;
  order: ApiOrder;
  orders: PanelData["orders"];
  discounts: PanelData["discounts"];
};

const dzien = (d: Date) => `${DZIEN_KROTKO[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;

function today(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Przewidywany termin - przedział, nigdy pojedyncza „obietnica” (poza odbiorem/montażem z planu biura). */
function computeEta(o: ApiOrder): PanelOrder["eta"] {
  if (o.cancelled || o.done || o.shipment) return null;
  const t = today();
  const planned = dataZCrm(o.planned);
  if (o.delivery_kind === "pickup") {
    if (!planned || planned < t) return null;
    return {
      from: dzien(planned),
      to: dzien(planned),
      productionDays: 0,
      label: "Przewidywany termin odbioru",
      note: "To termin z planu produkcji - orientacyjny, a nie gwarantowany. Jeśli plan się zmieni, zobaczysz to tutaj. Gdy zamówienie będzie gotowe, zadzwonimy albo napiszemy SMS i umówimy odbiór.",
    };
  }
  if (o.delivery_kind === "montage") {
    const inst = dataZCrm(o.installation_date);
    if (inst && inst >= t) {
      return { from: dzien(inst), to: dzien(inst), productionDays: 0, label: "Umówiony termin montażu", note: "Termin uzgodniony z Tobą. Jeśli musisz go zmienić, zadzwoń - znajdziemy inny." };
    }
    if (!planned || planned < t) return null;
    return {
      from: dzien(planned),
      to: dzien(planned),
      productionDays: 0,
      label: "Przewidywane zakończenie produkcji",
      note: "To termin orientacyjny z planu produkcji. Gdy wszystko będzie gotowe, zadzwonimy, żeby umówić montaż.",
    };
  }
  // wysyłka
  if (planned) {
    const base = planned < t ? t : planned;
    const from = dzienWysylki(base, 1);
    const to = dzienWysylki(base, 3);
    return {
      from: dzien(from),
      to: dzien(to),
      productionDays: 0,
      note: "To nasze przewidywanie na podstawie planu produkcji tego zamówienia, a nie gwarantowany termin. Jeśli plan się zmieni, zobaczysz to tutaj. Pewną informację dostaniesz w dniu nadania paczki - z numerem przesyłki.",
    };
  }
  const slugs = o.slugs.filter(Boolean);
  if (!slugs.length) return null;
  const start = dataZCrm(o.paid_at) || t;
  const dni = Math.max(...slugs.map(dniProdukcji));
  const to = dzienWysylki(dzienWysylki(start, dni), 1);
  let from = dzienWysylki(dzienWysylki(start, Math.max(1, dni - 2)), 1);
  if (to < t) return null;
  if (from <= t) from = dzienWysylki(t, 1);
  return { from: dzien(from), to: dzien(to), productionDays: dni };
}

function toPanel(j: ApiResponse): PanelData {
  const o = j.order;
  return {
    firstName: j.first_name,
    phone: OFFICE_PHONE,
    orders: j.orders,
    discounts: j.discounts,
    order: {
      number: o.number,
      tempCode: o.temp_code,
      placedAt: o.placed_at,
      status: o.status,
      stages: o.stages,
      stage: o.stage,
      eta: computeEta(o),
      itemsNote: o.items_note || undefined,
      items: o.items,
      subtotal: o.subtotal,
      discounts: o.discounts,
      extras: o.extras,
      delivery: o.delivery,
      payment: { method: o.payment.method, state: o.payment.state, payUrl: o.payment.pay_url || undefined },
      total: o.total,
      totalLabel: o.total_label,
      documents: o.documents,
      shipment: o.shipment,
      changesOpen: o.changes_open,
      canClaim: o.can_claim,
      cancelled: o.cancelled,
      claims: o.claims,
      requests: o.requests,
      pickup: o.delivery_kind === "pickup",
      claimNote:
        j.kind === "local"
          ? "Coś jest nie tak po odbiorze albo po montażu? Opisz krótko, co się stało - oddzwonimy i umówimy poprawkę. Na wszystko masz 5 lat gwarancji."
          : undefined,
    },
  };
}

export default function LivePanel({ refCode }: { refCode: string }) {
  const params = useSearchParams();
  const token = params.get("t") || "";
  const [data, setData] = useState<PanelData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const error = token ? loadError : "Ten link do zamówienia jest niepełny. Otwórz go jeszcze raz z maila albo zadzwoń do nas - wyślemy nowy.";

  const fetchPanel = useCallback(async (): Promise<{ data?: PanelData; error?: string }> => {
    try {
      const res = await fetch(`${API}?ref=${encodeURIComponent(refCode)}&t=${encodeURIComponent(token)}`, { cache: "no-store" });
      const j = (await res.json()) as ApiResponse;
      return j.ok ? { data: toPanel(j) } : { error: j.error || "Nie udało się wczytać zamówienia." };
    } catch {
      return { error: `Nie udało się wczytać zamówienia. Spróbuj za chwilę albo zadzwoń: ${OFFICE_PHONE}.` };
    }
  }, [refCode, token]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    void fetchPanel().then((r) => {
      if (!alive) return;
      if (r.data) setData(r.data);
      else setLoadError(r.error || "");
    });
    return () => {
      alive = false;
    };
  }, [fetchPanel, token, reloadKey]);

  useEffect(() => {
    trackShopStep("order_panel", "open", { ref: refCode });
  }, [refCode]);

  if (error) {
    return (
      <div className="op">
        <section className="op-card">
          <h2 style={{ marginTop: 0 }}>Nie możemy otworzyć zamówienia</h2>
          <p className="op-muted">{error}</p>
          <a className="op-btn" href={`tel:${OFFICE_PHONE.replace(/[^\d+]/g, "")}`}>
            Zadzwoń {OFFICE_PHONE}
          </a>
        </section>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="op">
        <section className="op-card op-loading">Wczytuję zamówienie…</section>
      </div>
    );
  }
  return (
    <OrderPanel
      data={data}
      submit={async (p) => {
        trackShopStep("order_panel", p.kind, { ref: refCode });
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ref: refCode, t: token, ...p }),
        });
        const j = (await res.json()) as { ok: boolean; message?: string; error?: string };
        if (j.ok) setReloadKey((k) => k + 1);
        return { ok: j.ok, message: j.ok ? j.message || "Zgłoszenie przyjęte." : j.error || "Nie udało się wysłać - zadzwoń do nas." };
      }}
    />
  );
}
