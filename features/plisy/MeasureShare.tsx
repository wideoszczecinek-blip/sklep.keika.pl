"use client";

// "Wyślij instrukcję" pod animacją pomiaru (właściciel, 2026-09-26: "w
// modalu jak mierzyć w plisach daj CTA wyślij instrukcję - po kliknięciu
// opcja na email, sms lub udostępnienie oraz opcja skopiowania linku i qr
// kodu").
//
// Po co: przy wymiarach połowa osób odpada, bo okno jest w drugim pokoju
// albo mierzyć ma ktoś inny. Tu nie wysyłamy wyceny (od tego jest
// PromoSaveModal z zapisem konfiguracji) - wysyłamy sam link do instrukcji,
// więc nie zbieramy żadnych danych kontaktowych: e-mail i SMS otwierają
// aplikację na telefonie klienta z gotową treścią, a udostępnianie idzie
// przez systemowy arkusz. Żadnych zgód, żadnych kosztów SMS, zero tarcia.
import { useEffect, useState } from "react";
import { trackShopStep } from "@/lib/track-step";
import type { MeasureMode } from "./MeasureGuide";

const SITE = "https://sklep.keika.pl";
const GUIDE_PATH = "/plisy/jak-mierzyc";

/** Link do instrukcji; montaż bezinwazyjny mierzy się inaczej, więc jedzie
 * w adresie i strona otwiera się od razu na właściwym wariancie. */
export function measureGuideUrl(mode?: MeasureMode | null): string {
  return mode === "bezinwazyjny" ? `${SITE}${GUIDE_PATH}?montaz=bezinwazyjny` : `${SITE}${GUIDE_PATH}`;
}

const MAIL_SUBJECT = "Jak zmierzyć okno pod plisę - instrukcja KEIKA";
const messageFor = (url: string) =>
  `Instrukcja pomiaru okna pod plisę KEIKA (animacja krok po kroku): ${url}`;

export default function MeasureShare({
  mode,
  source,
}: {
  /** Montaż wybrany w konfiguratorze - jedzie w linku i w statystyce. */
  mode?: MeasureMode;
  /** Skąd otwarto: "configurator" / "landing" / "guide_page". */
  source: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  // Liczone po hydracji - navigator.share nie istnieje na serwerze, a na
  // desktopie zwykle też nie, więc kafelek pojawia się tylko tam, gdzie
  // naprawdę zadziała.
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const url = measureGuideUrl(mode);
  const message = messageFor(url);
  const mailHref = `mailto:?subject=${encodeURIComponent(MAIL_SUBJECT)}&body=${encodeURIComponent(message)}`;
  // "sms:?&body=" to jedyny zapis, który łyka i iOS, i Android.
  const smsHref = `sms:?&body=${encodeURIComponent(message)}`;

  function track(channel: string) {
    trackShopStep("measure_guide_share", channel, { mount: mode || "standard", source });
  }

  async function handleCopy() {
    track("copy_link");
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Schowek zablokowany - adres jest widoczny pod kafelkami do
      // przepisania/zaznaczenia.
    }
  }

  async function handleNativeShare() {
    try {
      await navigator.share({ title: MAIL_SUBJECT, text: message, url });
      track("native_share");
    } catch {
      // Zamknięty arkusz udostępniania - nic się nie dzieje.
    }
  }

  return (
    <div className="plisy-measure-share">
      <button
        type="button"
        className="plisy-measure-share-cta"
        aria-expanded={open ? "true" : "false"}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) trackShopStep("measure_guide_share_open", source, { mount: mode || "standard" });
        }}
      >
        <span aria-hidden="true">✉️</span> Wyślij instrukcję
      </button>

      {open ? (
        <div className="plisy-measure-share-panel">
          <p className="plisy-measure-share-hint">
            Wyślij sobie na telefon albo komuś, kto zmierzy okno — link otwiera tę samą animację.
          </p>
          <div className="plisy-measure-share-grid">
            <a className="plisy-measure-share-option" href={mailHref} onClick={() => track("email")}>
              <span aria-hidden="true">✉️</span> E-mail
            </a>
            <a className="plisy-measure-share-option" href={smsHref} onClick={() => track("sms")}>
              <span aria-hidden="true">💬</span> SMS
            </a>
            {canNativeShare ? (
              <button type="button" className="plisy-measure-share-option" onClick={handleNativeShare}>
                <span aria-hidden="true">📤</span> Udostępnij
              </button>
            ) : null}
            <button type="button" className="plisy-measure-share-option" onClick={handleCopy}>
              <span aria-hidden="true">🔗</span> {copied ? "Skopiowano!" : "Kopiuj link"}
            </button>
            <button
              type="button"
              className="plisy-measure-share-option"
              aria-pressed={qrVisible ? "true" : "false"}
              onClick={() => {
                const next = !qrVisible;
                setQrVisible(next);
                if (next) track("qr");
              }}
            >
              <span aria-hidden="true">📷</span> Kod QR
            </button>
          </div>
          {qrVisible ? (
            <div className="plisy-measure-share-qr">
              {/* Ten sam generator, co przy kodzie QR do wznowienia wyceny
                  (app/components/rescue-modal.tsx) - adres instrukcji jest
                  publiczny, więc nic wrażliwego tam nie trafia. */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(url)}`}
                alt="Kod QR z linkiem do instrukcji pomiaru"
                width={150}
                height={150}
              />
              <span>Zeskanuj telefonem, żeby mieć instrukcję przy oknie</span>
            </div>
          ) : null}
          <span className="plisy-measure-share-url">{url.replace(/^https:\/\//, "")}</span>
        </div>
      ) : null}
    </div>
  );
}
