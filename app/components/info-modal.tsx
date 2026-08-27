"use client";

import { useEffect, useState } from "react";

type InfoModalProps = {
  slug: string;
  onClose: () => void;
};

/** Same "legal-modal-*" look as the cart's regulamin modal (globals.css) -
 * a dialog with an always-visible sticky close button, fetching one CRM
 * legal-page slug (regulamin, o-nas, kontakt, bezpieczenstwo, ...) client
 * side. Used by the main menu so those links open in place instead of
 * navigating away. */
export default function InfoModal({ slug, onClose }: InfoModalProps) {
  const [content, setContent] = useState<{ title: string; bodyHtml: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setError("");
    setLoading(true);
    fetch(`https://crm-keika.groovemedia.pl/biuro/api/shop-public/legal?slug=${encodeURIComponent(slug)}`, {
      cache: "no-store",
    })
      .then((response) => response.json())
      .then((json: { ok: boolean; page?: { title: string; body_html: string }; error?: string }) => {
        if (cancelled) return;
        if (!json.ok || !json.page) throw new Error(json.error || "Nie udało się wczytać treści.");
        setContent({ title: json.page.title, bodyHtml: json.page.body_html || "" });
      })
      .catch((fetchError) => {
        if (cancelled) return;
        setError(fetchError instanceof Error ? fetchError.message : "Nie udało się wczytać treści.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div className="legal-modal-overlay" role="dialog" aria-modal="true" aria-label={content?.title || "Informacje"}>
      <div className="legal-modal-shell">
        <div className="legal-modal-topbar">
          <button type="button" className="legal-modal-close" aria-label="Zamknij" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="legal-modal-inner">
          {loading ? (
            <div className="cart-payment-waiting">
              <span className="cart-invoice-nip-spinner" aria-hidden="true" />
              Wczytujemy…
            </div>
          ) : error ? (
            <div className="cart-checkout-error">{error}</div>
          ) : content ? (
            <>
              <h3>{content.title}</h3>
              <div className="legal-modal-body" dangerouslySetInnerHTML={{ __html: content.bodyHtml }} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
