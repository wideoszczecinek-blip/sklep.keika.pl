"use client";

// "Nie ma mojego okna" - the manual path of step 4: producer (from the
// library, or "Inny"), model as printed on the nameplate, measured A/B in
// mm (or cm), optional nameplate photos. Photos go to the CRM attachment
// store and the first one is run through the nameplate reader: a confident
// hit is offered as a one-click pick, anything readable pre-fills the
// fields. The result is a MissingModelRequest carried through the cart to
// the CRM quote/order (the model gets checked before production and lands
// in the window library as "pending").
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { trackShopStep } from "@/lib/track-step";
import { ROLETY_DACHOWE_MIN_DIMENSION_MM, type MissingModelRequest } from "./shared";
import {
  buildRoofWindowDisplayLabel,
  classifyNameplateResult,
  recognizeRoofWindowNameplate,
  uploadNameplatePhoto,
  type RoofWindowLibraryItem,
  type RoofWindowNameplateOutcome,
  type UploadedAttachment,
} from "./roof-window-library";

const OTHER = "__other__";
const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

type Unit = "mm" | "cm";

function toMm(raw: string, unit: Unit): number {
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return unit === "cm" ? Math.round(n * 10) : Math.round(n);
}

export default function MissingModelForm({
  producers,
  initial,
  maxWidthMm,
  maxHeightMm,
  photoEnabled,
  onClose,
  onSubmit,
  onPickLibraryItem,
  onOpenMeasureGuide,
}: {
  producers: string[];
  /** Pre-fill from the nameplate reader / a previous submission. */
  initial?: Partial<MissingModelRequest> & { prefilledFrom?: "ai" | "draft" };
  maxWidthMm: number;
  maxHeightMm: number;
  photoEnabled: boolean;
  onClose: () => void;
  onSubmit: (request: MissingModelRequest) => void;
  /** A photo run from inside the form recognised a library window. */
  onPickLibraryItem: (item: RoofWindowLibraryItem, attachmentId: string) => void;
  onOpenMeasureGuide: () => void;
}) {
  const initialProducer = initial?.producer?.trim() || "";
  const producerInList = producers.includes(initialProducer);
  const [producer, setProducer] = useState(initialProducer ? (producerInList ? initialProducer : OTHER) : "");
  const [customProducer, setCustomProducer] = useState(producerInList ? "" : initialProducer);
  const [model, setModel] = useState(initial?.model || "");
  const [unit, setUnit] = useState<Unit>("mm");
  const [dimA, setDimA] = useState(initial?.dimensionAMm ? String(initial.dimensionAMm) : "");
  const [dimB, setDimB] = useState(initial?.dimensionBMm ? String(initial.dimensionBMm) : "");
  const [attachments, setAttachments] = useState<UploadedAttachment[]>(
    (initial?.attachmentIds || []).map((id) => ({ id, fileName: "zdjęcie", mimeType: "image/jpeg", fileSize: 0 })),
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [aiRead, setAiRead] = useState<{ producer: string; model: string; confidence: string }>({
    producer: initial?.aiProducer || "",
    model: initial?.aiModel || "",
    confidence: initial?.aiConfidence || "",
  });
  const [outcome, setOutcome] = useState<RoofWindowNameplateOutcome | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const widthMm = toMm(dimA, unit);
  const heightMm = toMm(dimB, unit);
  const widthOk = widthMm >= ROLETY_DACHOWE_MIN_DIMENSION_MM && widthMm <= maxWidthMm;
  const heightOk = heightMm >= ROLETY_DACHOWE_MIN_DIMENSION_MM && heightMm <= maxHeightMm;
  const producerValue = producer === OTHER ? customProducer.trim() : producer.trim();
  const producerOk = producerValue.length > 0;
  const modelOk = model.trim().length > 0;
  const canSubmit = producerOk && modelOk && widthOk && heightOk;

  async function handleFiles(list: FileList | null) {
    const files = Array.from(list || []).filter(Boolean);
    if (!files.length) return;
    setUploadError("");
    setUploading(true);
    trackShopStep("nameplate_photo_upload_start", "rolety-dachowe", { source: "missing_form", files: files.length });
    const uploaded: UploadedAttachment[] = [];
    try {
      for (const file of files.slice(0, 4)) {
        uploaded.push(await uploadNameplatePhoto(file));
      }
      setAttachments((prev) => [...prev, ...uploaded].slice(0, 6));
    } catch (error) {
      setUploadError(error instanceof Error && error.message ? error.message : "Nie udało się wgrać zdjęcia.");
    } finally {
      setUploading(false);
    }
    const first = uploaded[0];
    if (!first || !photoEnabled) return;
    try {
      const result = await recognizeRoofWindowNameplate(first.id);
      const classified = classifyNameplateResult(result);
      trackShopStep("nameplate_photo_result", "rolety-dachowe", { source: "missing_form", kind: classified.kind });
      if (classified.kind === "matched" || classified.kind === "candidates") {
        setOutcome(classified);
      }
      const producerRead = result?.aiRead.producer.trim() || "";
      const modelRead = result?.aiRead.model.trim() || "";
      if (producerRead || modelRead) {
        setAiRead({ producer: producerRead, model: modelRead, confidence: result?.aiRead.confidence || "" });
        if (producerRead && !producerValue) {
          if (producers.includes(producerRead)) setProducer(producerRead);
          else {
            setProducer(OTHER);
            setCustomProducer(producerRead);
          }
        }
        if (modelRead && !model.trim()) setModel(modelRead);
      }
    } catch {
      /* the photo stays attached; the customer fills the fields by hand */
    }
  }

  function submit() {
    setTouched(true);
    if (!canSubmit) return;
    onSubmit({
      producer: producerValue,
      model: model.trim(),
      dimensionAMm: widthMm,
      dimensionBMm: heightMm,
      attachmentIds: attachments.map((entry) => entry.id),
      aiProducer: aiRead.producer || undefined,
      aiModel: aiRead.model || undefined,
      aiConfidence: aiRead.confidence || undefined,
    });
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="instruction-modal rd-modal" role="dialog" aria-modal="true" aria-label="Podaj dane swojego okna" onClick={onClose}>
      <div className="rd-modal-shell" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="instruction-modal-close" aria-label="Zamknij" onClick={onClose}>
          ×
        </button>
        <p className="rd-modal-eyebrow">Okno spoza biblioteki</p>
        <h3 className="rd-modal-title">Podaj dane swojego okna</h3>
        <p className="rd-modal-body">
          Roletę wykonamy dokładnie pod podane wymiary. Przed produkcją sprawdzimy dobór — jeśli coś będzie wymagało
          potwierdzenia, skontaktujemy się z Tobą.
        </p>

        {outcome?.kind === "matched" ? (
          <div className="rd-nameplate-card is-good">
            <strong>Rozpoznaliśmy model ze zdjęcia</strong>
            <p>
              To wygląda na <strong>{buildRoofWindowDisplayLabel(outcome.item)}</strong> — mamy go w bibliotece, więc nie musisz mierzyć.
            </p>
            <div className="rd-nameplate-actions">
              <button type="button" className="rd-btn rd-btn--primary" onClick={() => onPickLibraryItem(outcome.item, attachments[0]?.id || "")}>
                Tak, użyj tego modelu
              </button>
              <button type="button" className="rd-btn" onClick={() => setOutcome(null)}>
                To nie moje okno
              </button>
            </div>
          </div>
        ) : outcome?.kind === "candidates" ? (
          <div className="rd-nameplate-card">
            <strong>Czy to jeden z tych modeli?</strong>
            <ul className="rd-candidates">
              {outcome.items.map((item) => (
                <li key={item.id}>
                  <button type="button" className="rd-result" onClick={() => onPickLibraryItem(item, attachments[0]?.id || "")}>
                    <span className="rd-result-main">
                      <strong>{buildRoofWindowDisplayLabel(item)}</strong>
                    </span>
                    <span className="rd-result-meta">Wybierz</span>
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="rd-btn" onClick={() => setOutcome(null)}>
              Żaden — wypełnię dane ręcznie
            </button>
          </div>
        ) : null}

        <div className="rd-form-grid">
          <label className="rd-form-field">
            <span>Producent</span>
            <select value={producer} onChange={(event) => setProducer(event.target.value)} className={touched && !producerOk ? "is-invalid" : ""}>
              <option value="">Wybierz producenta</option>
              {producers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              <option value={OTHER}>Inny producent</option>
            </select>
          </label>
          {producer === OTHER ? (
            <label className="rd-form-field">
              <span>Nazwa producenta</span>
              <input type="text" value={customProducer} onChange={(event) => setCustomProducer(event.target.value)} placeholder="np. Optilight" className={touched && !producerOk ? "is-invalid" : ""} />
            </label>
          ) : null}
          <label className="rd-form-field">
            <span>Model okna (z tabliczki)</span>
            <input type="text" value={model} onChange={(event) => setModel(event.target.value)} placeholder="np. FTP-V U5 78x118" className={touched && !modelOk ? "is-invalid" : ""} />
          </label>
        </div>

        <div className="rd-form-measure-head">
          <div>
            <strong>Wymiar A i B</strong>
            <p>Mierz na rancie ramy skrzydła, w miejscu montażu rolety — nie przy samej szybie.</p>
          </div>
          <button type="button" className="rd-chip rd-chip--help" onClick={onOpenMeasureGuide}>
            📐 Instrukcja pomiaru
          </button>
        </div>
        <div className="rd-unit-toggle" role="radiogroup" aria-label="Jednostka">
          {(["mm", "cm"] as Unit[]).map((option) => (
            <button key={option} type="button" role="radio" aria-checked={unit === option} className={`rd-unit ${unit === option ? "is-active" : ""}`} onClick={() => setUnit(option)}>
              {option}
            </button>
          ))}
        </div>
        <div className="rd-form-grid rd-form-grid--dims">
          <label className="rd-form-field">
            <span>Wymiar A — szerokość ({unit})</span>
            <input type="number" inputMode="decimal" value={dimA} onChange={(event) => setDimA(event.target.value)} placeholder={unit === "cm" ? "np. 78" : "np. 780"} className={touched && !widthOk ? "is-invalid" : ""} />
          </label>
          <label className="rd-form-field">
            <span>Wymiar B — wysokość ({unit})</span>
            <input type="number" inputMode="decimal" value={dimB} onChange={(event) => setDimB(event.target.value)} placeholder={unit === "cm" ? "np. 118" : "np. 1180"} className={touched && !heightOk ? "is-invalid" : ""} />
          </label>
        </div>
        {(touched || dimA || dimB) && ((dimA && !widthOk) || (dimB && !heightOk)) ? (
          <p className="hero-product-dimensions-error">
            Szerokość {ROLETY_DACHOWE_MIN_DIMENSION_MM}–{maxWidthMm} mm, wysokość {ROLETY_DACHOWE_MIN_DIMENSION_MM}–{maxHeightMm} mm. Większe okno? Napisz do nas z zakładki Kontakt.
          </p>
        ) : null}

        <div className="rd-form-photos">
          <div>
            <strong>Zdjęcie tabliczki znamionowej (opcjonalnie)</strong>
            <p>Pomaga nam potwierdzić dobór. {photoEnabled ? "Spróbujemy też odczytać z niego model automatycznie." : ""}</p>
          </div>
          <label className={`rd-btn ${uploading ? "is-busy" : ""}`}>
            {uploading ? <span className="rd-spinner" aria-hidden="true" /> : <span aria-hidden="true">📷</span>} {uploading ? "Wgrywamy…" : "Dodaj zdjęcie"}
            <input
              type="file"
              accept={ACCEPT}
              multiple
              className="rd-hidden-input"
              disabled={uploading}
              onChange={(event) => {
                void handleFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        </div>
        {attachments.length ? (
          <ul className="rd-attachments">
            {attachments.map((entry) => (
              <li key={entry.id}>
                <span aria-hidden="true">🖼️</span> {entry.fileName}
                <button type="button" aria-label="Usuń zdjęcie" onClick={() => setAttachments((prev) => prev.filter((item) => item.id !== entry.id))}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {uploadError ? <p className="rd-nameplate-error">{uploadError}</p> : null}

        <div className="rd-modal-foot rd-modal-foot--split">
          <button type="button" className="rd-btn" onClick={onClose}>
            Anuluj
          </button>
          <button type="button" className="rd-btn rd-btn--primary" onClick={submit} disabled={touched && !canSubmit}>
            Zatwierdź wymiary
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
