"use client";

// Zdjęcie tabliczki znamionowej - wspólny kawałek wydzielony z
// RoofWindowSearchSelector (Z01, 2026-10-28), żeby ten sam aparat działał
// w kroku "model okna" konfiguratora i w szybkich wycenach na landingach
// (RoofQuickPrice, PdQuickPrice):
// - useNameplatePhotoPicker: dwa ukryte inputy (aparat z capture="environment"
//   i zwykły wybór pliku) + okienko "Jak chcesz dodać zdjęcie?";
// - recognizeNameplateFromFile: wgranie zdjęcia do CRM i odczyt AI, z tymi
//   samymi zdarzeniami nameplate_photo_* co konfiguratory;
// - useQuickNameplatePhoto: całość dla szybkiej wyceny (przycisk + wynik).
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { optimizeImageUrl } from "@/lib/image-optim";
import { trackShopStep } from "@/lib/track-step";
import {
  buildRoofWindowDisplayLabel,
  classifyNameplateResult,
  recognizeRoofWindowNameplate,
  uploadNameplatePhoto,
  type RoofWindowLibraryItem,
  type RoofWindowNameplateOutcome,
  type RoofWindowNameplateRecognizeResult,
} from "./roof-window-library";

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

export type NameplatePhotoPicker = {
  /** Otwiera okienko wyboru: aparat albo plik. */
  open: () => void;
  close: () => void;
  isOpen: boolean;
  /** Ukryte inputy + okienko wyboru - wyrenderuj raz w komponencie. */
  element: ReactNode;
};

export function useNameplatePhotoPicker({
  onFile,
  helpImageUrl,
  manageEscape = true,
}: {
  onFile: (file: File) => void;
  helpImageUrl?: string;
  /** false, gdy rodzic sam obsługuje Escape i blokadę przewijania (np. ma
   * jeszcze swoje okienko pomocy pod spodem). */
  manageEscape?: boolean;
}): NameplatePhotoPicker {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!manageEscape || !isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [manageEscape, isOpen]);

  const handleFiles = (list: FileList | null) => {
    const file = Array.from(list || [])[0];
    if (file) onFile(file);
  };

  const element = (
    <>
      <input
        ref={cameraInputRef}
        type="file"
        accept={ACCEPT}
        capture="environment"
        className="rd-hidden-input"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept={ACCEPT}
        className="rd-hidden-input"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="instruction-modal rd-modal rd-modal--top" role="dialog" aria-modal="true" aria-label="Jak dodać zdjęcie" onClick={() => setIsOpen(false)}>
              <div className="rd-modal-shell rd-modal-shell--narrow" onClick={(event) => event.stopPropagation()}>
                <button type="button" className="instruction-modal-close" aria-label="Zamknij" onClick={() => setIsOpen(false)}>
                  ×
                </button>
                <p className="rd-modal-eyebrow">Zdjęcie tabliczki</p>
                <h3 className="rd-modal-title">Jak chcesz dodać zdjęcie?</h3>
                <div className="rd-upload-grid">
                  {helpImageUrl ? <img className="rd-upload-image" src={optimizeImageUrl(helpImageUrl, 500)} alt="Gdzie szukać tabliczki znamionowej" loading="lazy" /> : null}
                  <div className="rd-upload-copy">
                    <p>Zrób czytelne, dobrze oświetlone zdjęcie tabliczki znamionowej na oknie — odczytamy z niej producenta i model.</p>
                    <p className="rd-upload-ai">
                      <strong>Analiza AI:</strong> zdjęcie analizuje automat, który może się pomylić — sprawdź wynik, zanim go zapiszesz.
                    </p>
                    <div className="rd-upload-actions">
                      <button
                        type="button"
                        className="rd-btn rd-btn--primary rd-btn--camera"
                        onClick={() => {
                          setIsOpen(false);
                          cameraInputRef.current?.click();
                        }}
                      >
                        📷 Zrób zdjęcie
                      </button>
                      <button
                        type="button"
                        className="rd-btn"
                        onClick={() => {
                          setIsOpen(false);
                          galleryInputRef.current?.click();
                        }}
                      >
                        🖼️ Wybierz plik
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );

  return { open, close, isOpen, element };
}

export type NameplateRecognition = {
  attachmentId: string;
  /** null = asystent niedostępny (limit/budżet/błąd) - zostaje ścieżka ręczna. */
  result: RoofWindowNameplateRecognizeResult;
  outcome: RoofWindowNameplateOutcome;
};

/** Wgrywa zdjęcie i odczytuje tabliczkę. Rzuca błąd tylko, gdy nie udało się
 * wgrać pliku (komunikat do pokazania klientowi). */
export async function recognizeNameplateFromFile(file: File, productSlug: string, source: string): Promise<NameplateRecognition> {
  trackShopStep("nameplate_photo_upload_start", productSlug, { source, size_kb: Math.round(file.size / 1024) });
  let uploadedId = "";
  try {
    uploadedId = (await uploadNameplatePhoto(file)).id;
  } catch (error) {
    trackShopStep("nameplate_photo_result", productSlug, { source, kind: "upload_failed" });
    throw error instanceof Error && error.message ? error : new Error("Nie udało się wgrać zdjęcia.");
  }
  let result: RoofWindowNameplateRecognizeResult = null;
  try {
    result = await recognizeRoofWindowNameplate(uploadedId);
  } catch {
    result = null;
  }
  const outcome = classifyNameplateResult(result);
  trackShopStep("nameplate_photo_result", productSlug, {
    source,
    kind: outcome.kind,
    confidence: result?.aiRead.confidence || "n/a",
    assistant: result === null ? "unavailable" : "ok",
  });
  return { attachmentId: uploadedId, result, outcome };
}

const QUICK_MAX_RECOGNITIONS = 5;

/** Zdjęcie tabliczki w szybkiej wycenie na landingu (RoofQuickPrice,
 * PdQuickPrice): przycisk otwiera aparat/plik, trafiony model od razu
 * ustawia wycenę (jak wybór z listy), kilka kandydatów - krótka lista do
 * kliknięcia, brak modelu - podpowiedź "podam wymiary". */
export function useQuickNameplatePhoto({
  productSlug,
  helpImageUrl,
  onPick,
  onManual,
}: {
  productSlug: string;
  helpImageUrl?: string;
  onPick: (item: RoofWindowLibraryItem) => void;
  onManual: () => void;
}): { open: () => void; isRecognizing: boolean; reset: () => void; element: ReactNode } {
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [outcome, setOutcome] = useState<RoofWindowNameplateOutcome | null>(null);
  const [assistantUnavailable, setAssistantUnavailable] = useState(false);
  const [error, setError] = useState("");
  const recognitionsRef = useRef(0);

  async function handleFile(file: File) {
    if (recognitionsRef.current >= QUICK_MAX_RECOGNITIONS) {
      setOutcome(null);
      setError("Wykorzystano limit rozpoznań na tę sesję — wpisz model ręcznie albo podaj wymiary.");
      return;
    }
    setError("");
    setOutcome(null);
    setIsRecognizing(true);
    try {
      const recognition = await recognizeNameplateFromFile(file, productSlug, "quick_price");
      recognitionsRef.current += 1;
      setAssistantUnavailable(recognition.result === null);
      setOutcome(recognition.outcome);
      if (recognition.outcome.kind === "matched") onPick(recognition.outcome.item);
    } catch (uploadError) {
      setError(uploadError instanceof Error && uploadError.message ? uploadError.message : "Nie udało się wgrać zdjęcia.");
    } finally {
      setIsRecognizing(false);
    }
  }

  const picker = useNameplatePhotoPicker({ onFile: (file) => void handleFile(file), helpImageUrl });
  const reset = useCallback(() => {
    setOutcome(null);
    setError("");
  }, []);
  const goManual = () => {
    reset();
    onManual();
  };

  const status = isRecognizing ? (
    <p className="rd-quick-photo-status">
      <span className="rd-spinner" aria-hidden="true" /> Rozpoznajemy zdjęcie tabliczki…
    </p>
  ) : error ? (
    <p className="rd-nameplate-error">{error}</p>
  ) : outcome?.kind === "matched" ? (
    <p className="rd-quick-photo-status">
      Rozpoznaliśmy ze zdjęcia: <strong>{buildRoofWindowDisplayLabel(outcome.item)}</strong> — sprawdź, czy to Twoje okno.
    </p>
  ) : outcome?.kind === "candidates" ? (
    <div className="rd-quick-photo-status">
      <p>
        {outcome.producer || outcome.model ? (
          <>
            Odczytaliśmy: <strong>{[outcome.producer, outcome.model].filter(Boolean).join(" ")}</strong>. Czy to jeden z tych modeli?
          </>
        ) : (
          "Czy to jeden z tych modeli?"
        )}
      </p>
      <ul className="rd-quick-results">
        {outcome.items.slice(0, 6).map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => {
                setOutcome(null);
                onPick(item);
              }}
            >
              <strong>{buildRoofWindowDisplayLabel(item)}</strong>
              <span>Wybierz</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="rd-link" onClick={goManual}>
        Żaden z nich — podam wymiary
      </button>
    </div>
  ) : outcome?.kind === "no_match" || outcome?.kind === "unrecognized" ? (
    <div className="rd-quick-photo-status">
      <p>
        {outcome.kind === "no_match"
          ? `${outcome.producer || outcome.model ? `Odczytaliśmy: ${[outcome.producer, outcome.model].filter(Boolean).join(" ")}. ` : ""}Nie mamy tego modelu w bibliotece — podaj wymiary okna, wykonamy na miarę.`
          : assistantUnavailable
            ? "Rozpoznawanie chwilowo niedostępne — wpisz model okna albo podaj wymiary."
            : "Nie widać tabliczki na zdjęciu. Zrób zdjęcie bliżej tabliczki (zwykle na górnej lub bocznej krawędzi otwartego skrzydła) albo podaj wymiary."}
      </p>
      <button type="button" className="rd-link" onClick={goManual}>
        Podam wymiary
      </button>
    </div>
  ) : null;

  return {
    open: picker.open,
    isRecognizing,
    reset,
    element: (
      <>
        {picker.element}
        {status}
      </>
    ),
  };
}
