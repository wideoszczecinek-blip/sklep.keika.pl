"use client";

// Step 4 of the rolety-dachowe configurator: find the customer's roof window
// in the library (search with highlighted matches), or read it off a photo
// of the window's nameplate (Gemini in the CRM - the same assistant the
// Allegro configurator uses), or fall through to the manual "Nie ma mojego
// okna" form. A port of keika-allegro-configurator-prod's
// roof-window-search-selector.tsx in the shop's own visual language
// (.rd-* classes in app/globals.css, no Tailwind).
//
// The "Skąd wziąć model okna" help modal doubles as the place the photo
// outcome is shown (matched / candidates / no_match / unrecognized), so it
// is controlled by the parent: the camera button opens it with the result.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { optimizeImageUrl } from "@/lib/image-optim";
import {
  buildRoofWindowDisplayLabel,
  resolveRoofWindowDimensions,
  splitRoofWindowHighlightedText,
  type RoofWindowLibraryItem,
  type RoofWindowNameplateOutcome,
  type RoofWindowSearchResult,
} from "./roof-window-library";

export type RoofWindowModelHelp = { eyebrow: string; title: string; body: string; imageUrl: string };

type Props = {
  query: string;
  results: RoofWindowSearchResult[];
  selectedItem: RoofWindowLibraryItem | null;
  isLoading: boolean;
  onQueryChange: (value: string) => void;
  onSelect: (item: RoofWindowLibraryItem) => void;
  onMissingModelClick: () => void;
  /** Per-item price label ("od 174 zł") for the result rows. */
  resolvePriceLabel?: (item: RoofWindowLibraryItem) => string | null;
  modelHelp: RoofWindowModelHelp;
  isHelpOpen: boolean;
  onHelpOpenChange: (open: boolean) => void;
  /** Photo path - undefined hides every camera button (assistant off). */
  onPhotoUpload?: (file: File) => void;
  isRecognizing?: boolean;
  nameplateOutcome?: RoofWindowNameplateOutcome | null;
  nameplateError?: string;
  /** True once the CRM answered "disabled" (budget/limit) - the camera
   * buttons stay but explain that the manual path is the way now. */
  assistantUnavailable?: boolean;
  onNameplateConfirmMatch?: () => void;
  onNameplateSelectCandidate?: (item: RoofWindowLibraryItem) => void;
  onNameplateRejectMatch?: () => void;
  onNameplateReportMissing?: () => void;
  autoFocus?: boolean;
};

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

function Highlighted({ value, ranges }: { value: string; ranges: Array<[number, number]> }): ReactNode {
  return splitRoofWindowHighlightedText(value, ranges).map((part, index) => (
    <span key={`${index}-${part.highlighted ? "hit" : "base"}`} className={part.highlighted ? "rd-hit" : undefined}>
      {part.text}
    </span>
  ));
}

function RichHtml({ html, className }: { html: string; className: string }) {
  if (!html.trim()) return null;
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function RoofWindowSearchSelector({
  query,
  results,
  selectedItem,
  isLoading,
  onQueryChange,
  onSelect,
  onMissingModelClick,
  resolvePriceLabel,
  modelHelp,
  isHelpOpen,
  onHelpOpenChange,
  onPhotoUpload,
  isRecognizing = false,
  nameplateOutcome = null,
  nameplateError = "",
  assistantUnavailable = false,
  onNameplateConfirmMatch,
  onNameplateSelectCandidate,
  onNameplateRejectMatch,
  onNameplateReportMissing,
  autoFocus = false,
}: Props) {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadChoiceOpen, setIsUploadChoiceOpen] = useState(false);
  const trimmedQuery = query.trim();
  const hasTypedQuery = trimmedQuery.length > 0;
  const selectedLabel = selectedItem ? buildRoofWindowDisplayLabel(selectedItem).trim().toLowerCase() : "";
  const isShowingSelectedState = Boolean(selectedItem) && (!hasTypedQuery || trimmedQuery.toLowerCase() === selectedLabel);
  const visibleResults = results.slice(0, 15);
  const showMissingCta = hasTypedQuery && !isLoading && !isShowingSelectedState;

  // Escape closes whichever layer is on top; the body scroll is locked while
  // a layer is open (same as the plisy measure guide).
  useEffect(() => {
    if (!isHelpOpen && !isUploadChoiceOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (isUploadChoiceOpen) setIsUploadChoiceOpen(false);
      else onHelpOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [isHelpOpen, isUploadChoiceOpen, onHelpOpenChange]);

  const handleFiles = (list: FileList | null) => {
    const file = Array.from(list || [])[0];
    if (file && onPhotoUpload) onPhotoUpload(file);
  };

  const photoButton = (className: string, label: string) =>
    onPhotoUpload ? (
      <button type="button" className={className} onClick={() => setIsUploadChoiceOpen(true)} disabled={isRecognizing}>
        {isRecognizing ? <span className="rd-spinner" aria-hidden="true" /> : <span aria-hidden="true">📷</span>}
        {isRecognizing ? "Rozpoznajemy zdjęcie…" : label}
      </button>
    ) : null;

  return (
    <>
      <div className="rd-search">
        <p className="rd-search-lead">
          Wpisz producenta i model okna albo zrób zdjęcie tabliczki znamionowej — model odczytamy automatycznie i dobierzemy
          wymiar rolety.
        </p>
        <div className="rd-search-actions">
          {photoButton("rd-chip rd-chip--photo", "Wgraj zdjęcie tabliczki")}
          <button type="button" className="rd-chip rd-chip--help" onClick={() => onHelpOpenChange(true)}>
            <span aria-hidden="true">?</span> Skąd wziąć model okna
          </button>
          <button type="button" className="rd-chip" onClick={onMissingModelClick}>
            Nie ma mojego okna
          </button>
        </div>

        <label className="rd-search-field">
          <span className="sr-only">Szukaj modelu okna dachowego</span>
          <input
            type="text"
            inputMode="search"
            autoComplete="off"
            autoFocus={autoFocus}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="np. Velux MK04, Fakro 78x118, Roto"
            className="rd-search-input"
          />
          {query ? (
            <button type="button" className="rd-search-clear" aria-label="Wyczyść" onClick={() => onQueryChange("")}>
              ×
            </button>
          ) : null}
        </label>

        {onPhotoUpload ? (
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
          </>
        ) : null}

        {isLoading ? (
          <div className="rd-search-note">
            <span className="rd-spinner" aria-hidden="true" /> Ładujemy bibliotekę okien dachowych…
          </div>
        ) : isShowingSelectedState && selectedItem ? (
          <div className="rd-search-selected">
            <span className="rd-search-selected-check" aria-hidden="true">
              ✓
            </span>
            <span>
              Wybrane okno: <strong>{buildRoofWindowDisplayLabel(selectedItem)}</strong>
              {(() => {
                const dims = resolveRoofWindowDimensions(selectedItem);
                return dims.widthMm && dims.heightMm ? (
                  <>
                    {" "}
                    · roleta {dims.widthMm} × {dims.heightMm} mm
                    {!selectedItem.is_certain ? " · wymiar orientacyjny" : ""}
                  </>
                ) : null;
              })()}
            </span>
          </div>
        ) : !hasTypedQuery ? (
          <div className="rd-search-note">Zacznij wpisywać producenta lub model okna — podpowiemy pasujące modele.</div>
        ) : (
          <div className="rd-results">
            {visibleResults.length ? (
              <ul className="rd-results-list">
                {visibleResults.map(({ item, highlights }) => {
                  const isSelected = selectedItem?.id === item.id;
                  const dims = resolveRoofWindowDimensions(item);
                  const priceLabel = resolvePriceLabel?.(item) ?? null;
                  return (
                    <li key={item.id}>
                      <button type="button" className={`rd-result ${isSelected ? "is-selected" : ""}`} onClick={() => onSelect(item)}>
                        <span className="rd-result-main">
                          <strong>
                            <Highlighted value={item.producer_name || "—"} ranges={highlights.producer_name} />
                          </strong>
                          <span className="rd-result-sep" aria-hidden="true">
                            •
                          </span>
                          <span>
                            <Highlighted value={item.window_model || "—"} ranges={highlights.window_model} />
                          </span>
                          {item.alternate_window_model ? <span className="rd-result-alt">({item.alternate_window_model})</span> : null}
                        </span>
                        <span className="rd-result-meta">
                          {dims.widthMm && dims.heightMm ? (
                            <span>
                              roleta {dims.widthMm} × {dims.heightMm} mm{!item.is_certain ? " · wymiar orientacyjny" : ""}
                            </span>
                          ) : null}
                          {priceLabel ? <span className="rd-result-price">{priceLabel}</span> : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {showMissingCta ? (
                  <li>
                    <button type="button" className="rd-result rd-result--missing" onClick={onMissingModelClick}>
                      <span className="rd-result-main">
                        <strong>Nie ma mojego okna na liście</strong>
                      </span>
                      <span className="rd-result-meta">Podaj producenta i wymiar A / B — roletę wykonamy na miarę</span>
                    </button>
                  </li>
                ) : null}
              </ul>
            ) : (
              <div className="rd-results-empty">
                <p>Nie znaleźliśmy pasującego modelu. Sprawdź pisownię (np. „MK04”, „78x118”) albo wybierz opcję poniżej.</p>
                {showMissingCta ? (
                  <button type="button" className="rd-result rd-result--missing" onClick={onMissingModelClick}>
                    <span className="rd-result-main">
                      <strong>Nie ma mojego okna na liście</strong>
                    </span>
                    <span className="rd-result-meta">Podaj producenta i wymiar A / B — roletę wykonamy na miarę</span>
                  </button>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>

      {isHelpOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="instruction-modal rd-modal" role="dialog" aria-modal="true" aria-label="Skąd wziąć model okna" onClick={() => onHelpOpenChange(false)}>
              <div className="rd-modal-shell" onClick={(event) => event.stopPropagation()}>
                <button type="button" className="instruction-modal-close" aria-label="Zamknij" onClick={() => onHelpOpenChange(false)}>
                  ×
                </button>
                {modelHelp.eyebrow ? (
                  <RichHtml html={modelHelp.eyebrow} className="rd-modal-eyebrow" />
                ) : (
                  <p className="rd-modal-eyebrow">Pomoc</p>
                )}
                {modelHelp.title ? <RichHtml html={modelHelp.title} className="rd-modal-title" /> : <h3 className="rd-modal-title">Skąd wziąć model okna</h3>}
                {modelHelp.body ? (
                  <RichHtml html={modelHelp.body} className="rd-modal-body" />
                ) : (
                  <p className="rd-modal-body">
                    Model okna znajdziesz na tabliczce znamionowej producenta. Zwykle jest widoczna po otwarciu skrzydła okna
                    dachowego — na jego górnej lub bocznej krawędzi.
                  </p>
                )}

                <div className="rd-help-grid">
                  {modelHelp.imageUrl ? (
                    <img className="rd-help-image" src={optimizeImageUrl(modelHelp.imageUrl, 700)} alt="Gdzie szukać tabliczki znamionowej okna dachowego" loading="lazy" />
                  ) : null}
                  <div className="rd-help-tips">
                    <div className="rd-help-tip">
                      <strong>Szukaj wpisu</strong>
                      <p>
                        Producent i symbol modelu, np. <strong>VELUX GGL MK04</strong>, <strong>FAKRO FTP-V U3 78x118</strong> albo
                        podobny kod z tabliczki.
                      </p>
                    </div>
                    <div className="rd-help-tip">
                      <strong>Nie ma na liście?</strong>
                      <p>
                        Użyj opcji <strong>„Nie ma mojego okna”</strong> i podaj producenta oraz wymiar A / B — roletę wykonamy na
                        miarę, a dobór potwierdzimy przed produkcją.
                      </p>
                    </div>
                  </div>
                </div>

                {onPhotoUpload ? (
                  <div className="rd-nameplate">
                    {isRecognizing ? (
                      <div className="rd-nameplate-card">
                        <span className="rd-spinner" aria-hidden="true" />
                        <div>
                          <strong>Rozpoznajemy zdjęcie tabliczki…</strong>
                          <p>To zwykle zajmuje kilka sekund.</p>
                        </div>
                      </div>
                    ) : nameplateOutcome?.kind === "matched" ? (
                      <div className="rd-nameplate-card is-good">
                        <strong>Rozpoznano model</strong>
                        <p>
                          Wygląda na to, że to <strong>{buildRoofWindowDisplayLabel(nameplateOutcome.item)}</strong>. Sprawdź, czy się
                          zgadza, zanim zapiszemy go w konfiguracji.
                        </p>
                        <div className="rd-nameplate-actions">
                          <button type="button" className="rd-btn rd-btn--primary" onClick={onNameplateConfirmMatch}>
                            Tak, to moje okno
                          </button>
                          <button type="button" className="rd-btn" onClick={onNameplateRejectMatch}>
                            To nie moje okno
                          </button>
                        </div>
                      </div>
                    ) : nameplateOutcome?.kind === "candidates" ? (
                      <div className="rd-nameplate-card">
                        <strong>Zaznacz właściwy model</strong>
                        <p>
                          {nameplateOutcome.producer || nameplateOutcome.model ? (
                            <>
                              Odczytaliśmy ze zdjęcia: <strong>{[nameplateOutcome.producer, nameplateOutcome.model].filter(Boolean).join(" ")}</strong>,
                              ale nie jesteśmy pewni na tyle, żeby wybrać automatycznie. Czy to jeden z tych modeli?
                            </>
                          ) : (
                            "Nie jesteśmy pewni odczytu na tyle, żeby wybrać automatycznie. Czy to jeden z tych modeli?"
                          )}
                        </p>
                        <ul className="rd-candidates">
                          {nameplateOutcome.items.map((item) => (
                            <li key={item.id}>
                              <button type="button" className="rd-result" onClick={() => onNameplateSelectCandidate?.(item)}>
                                <span className="rd-result-main">
                                  <strong>{buildRoofWindowDisplayLabel(item)}</strong>
                                </span>
                                <span className="rd-result-meta">Wybierz</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                        <div className="rd-nameplate-actions">
                          <button type="button" className="rd-btn" onClick={onNameplateReportMissing}>
                            Żaden z nich — podam wymiar
                          </button>
                          <button type="button" className="rd-btn" onClick={() => setIsUploadChoiceOpen(true)}>
                            Spróbuj innym zdjęciem
                          </button>
                        </div>
                      </div>
                    ) : nameplateOutcome?.kind === "no_match" ? (
                      <div className="rd-nameplate-card">
                        <strong>Nie mamy tego okna w bibliotece</strong>
                        <p>
                          {nameplateOutcome.producer || nameplateOutcome.model ? (
                            <>
                              Odczytaliśmy ze zdjęcia: <strong>{[nameplateOutcome.producer, nameplateOutcome.model].filter(Boolean).join(" ")}</strong>.
                              Podaj wymiar A / B — roletę wykonamy na miarę, a dane z tabliczki podpowiemy w formularzu.
                            </>
                          ) : (
                            "Podaj wymiar A / B — roletę wykonamy na miarę."
                          )}
                        </p>
                        <div className="rd-nameplate-actions">
                          <button type="button" className="rd-btn rd-btn--primary" onClick={onNameplateReportMissing}>
                            Podaj wymiar okna
                          </button>
                          <button type="button" className="rd-btn" onClick={() => setIsUploadChoiceOpen(true)}>
                            Spróbuj innym zdjęciem
                          </button>
                        </div>
                      </div>
                    ) : nameplateOutcome?.kind === "unrecognized" ? (
                      <div className="rd-nameplate-card">
                        <strong>{assistantUnavailable ? "Rozpoznawanie chwilowo niedostępne" : "Nie widać tabliczki"}</strong>
                        <p>
                          {assistantUnavailable
                            ? "Zdjęcie zostało zapisane — dołączymy je do zamówienia. Wpisz model okna w wyszukiwarce albo podaj wymiar A / B."
                            : "Nie znaleźliśmy na tym zdjęciu modelu okna. Zrób zdjęcie bliżej tabliczki znamionowej (zwykle na górnej lub bocznej krawędzi otwartego skrzydła) albo wpisz dane ręcznie."}
                        </p>
                        <div className="rd-nameplate-actions">
                          {!assistantUnavailable ? (
                            <button type="button" className="rd-btn rd-btn--primary" onClick={() => setIsUploadChoiceOpen(true)}>
                              Spróbuj ponownie
                            </button>
                          ) : null}
                          <button type="button" className="rd-btn" onClick={onNameplateReportMissing}>
                            Podaj wymiar okna
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rd-nameplate-card">
                        <strong>Szybsza ścieżka: zdjęcie tabliczki</strong>
                        <p>Zrób zdjęcie tabliczki znamionowej na oknie — odczytamy producenta i model automatycznie.</p>
                        {nameplateError ? <p className="rd-nameplate-error">{nameplateError}</p> : null}
                        <button type="button" className="rd-btn rd-btn--primary" onClick={() => setIsUploadChoiceOpen(true)}>
                          📷 Prześlij zdjęcie tabliczki
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="rd-modal-foot">
                  <button type="button" className="rd-btn" onClick={() => onHelpOpenChange(false)}>
                    Zamknij
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {isUploadChoiceOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="instruction-modal rd-modal rd-modal--top" role="dialog" aria-modal="true" aria-label="Jak dodać zdjęcie" onClick={() => setIsUploadChoiceOpen(false)}>
              <div className="rd-modal-shell rd-modal-shell--narrow" onClick={(event) => event.stopPropagation()}>
                <button type="button" className="instruction-modal-close" aria-label="Zamknij" onClick={() => setIsUploadChoiceOpen(false)}>
                  ×
                </button>
                <p className="rd-modal-eyebrow">Zdjęcie tabliczki</p>
                <h3 className="rd-modal-title">Jak chcesz dodać zdjęcie?</h3>
                <div className="rd-upload-grid">
                  {modelHelp.imageUrl ? (
                    <img className="rd-upload-image" src={optimizeImageUrl(modelHelp.imageUrl, 500)} alt="Gdzie szukać tabliczki znamionowej" loading="lazy" />
                  ) : null}
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
                          setIsUploadChoiceOpen(false);
                          cameraInputRef.current?.click();
                        }}
                      >
                        📷 Zrób zdjęcie
                      </button>
                      <button
                        type="button"
                        className="rd-btn"
                        onClick={() => {
                          setIsUploadChoiceOpen(false);
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
}
