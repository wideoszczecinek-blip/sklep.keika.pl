"use client";

// Proactive "save or share this configuration" - unlike the exit-intent
// rescue modal (lib/rescue.ts), this is voluntary, can show every visit
// (not a one-shot-per-browser), and carries no discount of its own. This
// is a retention play, not a configuration-specific tool: "some share of
// customers will bookmark the page and come back later, e.g. once they've
// actually measured their windows" - so sharing must work regardless of
// whether there's a complete draft right now. Three-tier fallback in
// ensureLink() below: an in-progress draft, then whatever's already in the
// cart, then just the plain page URL with no backend call at all - there's
// always *something* to share.
//
// The icon + its teaser bubble portal into a slot inside the real header
// row (app/page.tsx's #header-save-share-slot, right next to the chat
// icon) rather than floating as a fixed pill - a fixed-position element
// mounted from inside <ConfiguratorPanel> hits the exact same "ancestor
// has a permanent CSS transform, so position:fixed computes relative to
// it instead of the real viewport" problem documented for
// MobileOverlayPortal/RescueModal, and portaling into an actual header
// slot (a normal position:relative element in ordinary flow) sidesteps
// it entirely rather than fighting it with more fixed-position math.
// The modal itself still portals straight to <body>, same reasoning.
//
// State ownership still lives in ConfiguratorPanel.tsx (same lesson as
// the rescue modal) - this component only renders UI for whatever
// buildPosition/priceLine it's handed each render.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { readCartItems } from "@/lib/cart";
import { PROMO_CODE, isPromoActive } from "@/lib/promo";
import { buildRescuePosition, type RescueSavePosition } from "@/lib/rescue";
import { buildResumeUrl, saveQuoteForSharing, sendShareLink, type ShareLink } from "@/lib/share";

const TEASER_DELAY_MS = 5000;
const TEASER_VISIBLE_MS = 5000;
const TEASER_DISMISSED_KEY = "keika_save_share_teaser_dismissed";

function looksLikeEmail(value: string): boolean {
  return /.+@.+\..+/.test(value);
}

function looksLikePhone(value: string): boolean {
  return value.replace(/\D/g, "").length >= 9;
}

export default function SaveShareWidget({
  productSlug,
  productLabel,
  priceLine,
  buildPosition,
  quoteCode,
  resumeToken: resumeTokenProp,
  headerSlotId,
}: {
  productSlug: string;
  productLabel: string;
  priceLine: string;
  /** Null when there's no complete draft right now - ensureLink() then
   * falls back to the cart, then to the plain page URL. */
  buildPosition: () => RescueSavePosition | null;
  /** Pass the already-known quote_code once one exists (e.g. after the
   * rescue modal or a first share already created one) to re-touch the
   * same quote instead of minting a new one every time. */
  quoteCode?: string;
  /** The resume token already tied to `quoteCode`, if the caller has one.
   * Required alongside quoteCode to avoid rotating/orphaning it - see
   * lib/share.ts's saveQuoteForSharing() doc comment. */
  resumeToken?: string;
  headerSlotId: string;
}) {
  const [slotEl, setSlotEl] = useState<Element | null>(null);
  const [teaserVisible, setTeaserVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [link, setLink] = useState<ShareLink | null>(null);
  const [configLabel, setConfigLabel] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [sendOpen, setSendOpen] = useState(false);
  const [sendValue, setSendValue] = useState("");
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    setSlotEl(document.getElementById(headerSlotId));
  }, [headerSlotId]);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.sessionStorage.getItem(TEASER_DISMISSED_KEY) === "1";
    } catch {
      // sessionStorage niedostępny - pokaż tak czy inaczej.
    }
    if (dismissed) return;
    const showTimer = window.setTimeout(() => setTeaserVisible(true), TEASER_DELAY_MS);
    return () => window.clearTimeout(showTimer);
  }, []);

  useEffect(() => {
    if (!teaserVisible) return;
    const hideTimer = window.setTimeout(() => collapseTeaser(), TEASER_VISIBLE_MS);
    return () => window.clearTimeout(hideTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teaserVisible]);

  function collapseTeaser() {
    setTeaserVisible(false);
    try {
      window.sessionStorage.setItem(TEASER_DISMISSED_KEY, "1");
    } catch {
      // nic do zrobienia
    }
  }

  function openModal() {
    collapseTeaser();
    setModalOpen(true);
    setSendOpen(false);
    setSendValue("");
    setSendStatus("idle");
    void ensureLink();
  }

  /** Always resolves to something shareable - never a dead end. Priority:
   * 1) the current in-progress draft, 2) whatever's already in the cart
   * (a real cross-device recovery link for it, as a side benefit),
   * 3) the plain page URL, no save call at all. */
  async function ensureLink(): Promise<ShareLink> {
    if (link) return link;

    let sessionToken = "";
    try {
      sessionToken = window.sessionStorage.getItem("keika_shop_session_token") || "";
    } catch {
      // sessionStorage niedostępny - link i tak się utworzy.
    }

    const activePromoCode = isPromoActive() ? PROMO_CODE : undefined;

    const draft = buildPosition();
    if (draft || quoteCode) {
      setIsSaving(true);
      const result = await saveQuoteForSharing({
        quoteCode,
        // Only ever non-empty when a resumeToken prop comes in alongside an
        // already-known quoteCode - see lib/share.ts's saveQuoteForSharing()
        // doc comment for why this must be forwarded whenever we have it.
        resumeToken: quoteCode ? resumeTokenProp : undefined,
        position: quoteCode ? undefined : draft || undefined,
        sessionToken,
        productSlug,
        promoCode: activePromoCode,
      });
      setIsSaving(false);
      if (result) {
        setConfigLabel(`${productLabel}${priceLine}`);
        setLink(result);
        return result;
      }
    }

    const cartItems = readCartItems();
    if (cartItems.length > 0) {
      setIsSaving(true);
      const positions = cartItems.map((item) =>
        buildRescuePosition({
          productSlug: item.productSlug,
          productLabel: item.productLabel,
          hardwareLabel: item.hardwareLabel,
          meshLabel: item.meshLabel,
          widthMm: item.widthMm,
          heightMm: item.heightMm,
          qty: item.qty,
          total: item.total,
        }),
      );
      const result = await saveQuoteForSharing({ positions, sessionToken, productSlug, promoCode: activePromoCode });
      setIsSaving(false);
      if (result) {
        const itemsWord = cartItems.length === 1 ? "pozycja" : "pozycje";
        setConfigLabel(`Twój koszyk (${cartItems.length} ${itemsWord})`);
        setLink(result);
        return result;
      }
    }

    const fallback: ShareLink = { quoteCode: "", resumeToken: "", url: window.location.href };
    setConfigLabel("");
    setLink(fallback);
    return fallback;
  }

  async function handleCopyLink() {
    const result = await ensureLink();
    try {
      await navigator.clipboard.writeText(result.url);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2200);
    } catch {
      // Clipboard niedostępny (rzadkie, brak uprawnień) - link jest już
      // widoczny w modalu do ręcznego skopiowania.
    }
  }

  // No more "Kopiuj kod wyceny" option (replaced by "Wyślij" below, per
  // explicit request) - kept handleCopyLink/handleNativeShare, this one's
  // gone along with the button that used to call it.

  async function handleSendSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = sendValue.trim();
    const isEmail = looksLikeEmail(value);
    const isPhone = !isEmail && looksLikePhone(value);
    if (!isEmail && !isPhone) return;
    const result = await ensureLink();
    if (!result.quoteCode) {
      setSendStatus("error");
      return;
    }
    setSendStatus("sending");
    const sendResult = await sendShareLink({
      quoteCode: result.quoteCode,
      resumeToken: result.resumeToken,
      email: isEmail ? value : undefined,
      phone: isPhone ? value : undefined,
    });
    // Defensive only (see sendShareLink()'s doc comment) - normally
    // sendResult.resumeToken === result.resumeToken since we just passed it
    // in, so this is a no-op. If it ever differs, the link/QR/native-share
    // still showing in this modal would otherwise keep pointing at a token
    // the CRM just rotated away from under us.
    if (sendResult.resumeToken && sendResult.resumeToken !== result.resumeToken) {
      setLink({
        quoteCode: result.quoteCode,
        resumeToken: sendResult.resumeToken,
        url: buildResumeUrl(sendResult.resumeToken, productSlug),
      });
    }
    setSendStatus(sendResult.ok ? "sent" : "error");
  }

  async function handleNativeShare() {
    const result = await ensureLink();
    try {
      await navigator.share({
        title: "KEIKA",
        text: configLabel ? `Zapisałem: ${configLabel}. Link do wznowienia:` : "Zobacz KEIKA:",
        url: result.url,
      });
    } catch {
      // Użytkownik zamknął arkusz udostępniania albo API nie jest wsparte -
      // link jest już widoczny w modalu jako fallback.
    }
  }

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const iconAndTeaser = (
    <div className="header-save-share-wrap">
      <button
        type="button"
        className="header-save-share-button"
        onClick={openModal}
        aria-label="Zapisz / udostępnij stronę"
      >
        {/* Proper "share" glyph (box + outward arrow) - same one used on the
            modal's own "Udostępnij" option - not a download/save-to-disk
            arrow, which is what this looked like before. */}
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M14 3h7v7M21 3 10 14M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {!teaserVisible ? <span className="header-save-share-hint" role="tooltip">Zapisz / udostępnij stronę</span> : null}
      </button>
      {teaserVisible ? (
        <div className="header-save-share-teaser" role="status">
          <button
            type="button"
            className="header-save-share-teaser-close"
            aria-label="Zamknij"
            onClick={(event) => {
              event.stopPropagation();
              collapseTeaser();
            }}
          >
            ✕
          </button>
          <button type="button" className="header-save-share-teaser-text" onClick={openModal}>
            Zapisujemy Twoje konfiguracje. W każdej chwili możesz do nich wrócić. Kliknij ikonę, aby zapisać lub
            udostępnić stronę.
          </button>
        </div>
      ) : null}
    </div>
  );

  const modal = modalOpen ? (
    <div className="save-share-modal-overlay" role="presentation" onClick={() => setModalOpen(false)}>
      <div
        className="save-share-modal-shell"
        role="dialog"
        aria-modal="true"
        aria-label="Zapisz lub udostępnij stronę"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="save-share-modal-close" onClick={() => setModalOpen(false)} aria-label="Zamknij">
          ✕
        </button>
        <h3>Zapisz lub udostępnij</h3>
        <p className="save-share-modal-lead">
          Zapisujemy każdą zmianę automatycznie - wróć do tej konfiguracji w każdej chwili, na dowolnym urządzeniu,
          bez wypełniania niczego od nowa.
        </p>
        {configLabel ? <p className="save-share-modal-config">{configLabel}</p> : null}

        {isSaving && !link ? (
          <div className="save-share-modal-loading">Zapisuję…</div>
        ) : (
          <>
            <div className="save-share-modal-options">
              {canNativeShare ? (
                <button type="button" className="save-share-option is-primary" onClick={handleNativeShare}>
                  <span aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path
                        d="M14 3h7v7M21 3 10 14M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  Udostępnij
                </button>
              ) : null}
              <button type="button" className="save-share-option" onClick={handleCopyLink}>
                <span aria-hidden="true">🔗</span>
                {copyState === "copied" ? "Skopiowano!" : "Kopiuj link"}
              </button>
              {link?.quoteCode ? (
                <button
                  type="button"
                  className="save-share-option"
                  onClick={() => setSendOpen((v) => !v)}
                >
                  <span aria-hidden="true">✉️</span>
                  Wyślij
                </button>
              ) : null}
            </div>
            {link?.quoteCode && sendOpen ? (
              <form className="save-share-send-form" onSubmit={handleSendSubmit}>
                <input
                  type="text"
                  inputMode="email"
                  placeholder="E-mail albo numer telefonu"
                  value={sendValue}
                  onChange={(event) => {
                    setSendValue(event.target.value);
                    if (sendStatus !== "sending") setSendStatus("idle");
                  }}
                  autoFocus
                />
                <button type="submit" disabled={sendStatus === "sending" || !sendValue.trim()}>
                  {sendStatus === "sending" ? "Wysyłam…" : "Wyślij"}
                </button>
                {sendStatus === "sent" ? <p className="save-share-send-status is-ok">Wysłano!</p> : null}
                {sendStatus === "error" ? (
                  <p className="save-share-send-status is-error">Nie udało się wysłać. Spróbuj ponownie.</p>
                ) : null}
              </form>
            ) : null}
            {link ? (
              <div className="save-share-modal-linkbox">
                <code>{link.url}</code>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      {slotEl ? createPortal(iconAndTeaser, slotEl) : null}
      {modal && typeof document !== "undefined" ? createPortal(modal, document.body) : null}
    </>
  );
}
