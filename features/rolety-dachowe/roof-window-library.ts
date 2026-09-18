// Roof-window model library for the rolety-dachowe configurator - a port of
// keika-allegro-configurator-prod/app/_lib/roof-window-library.ts (the
// Allegro configurator at konfiguruj.com.pl/dachowa), so the shop searches
// the SAME 420-model library with the same scoring, reads the same nameplate
// photo recognition (Gemini, via the CRM) and uploads to the same attachment
// store. Shop-side additions: a 24 h localStorage cache of the library, the
// bundled 2026-08-30 snapshot (roof-windows-data.ts) as the offline fallback,
// client-side photo downscaling before upload and the "channel: shop" flag
// the CRM logs AI cost under.
import { getSessionToken } from "@/lib/analytics-context";
import { ROOF_WINDOW_MODELS } from "./roof-windows-data";

export type RoofWindowLibraryItem = {
  id: number;
  producer_name: string;
  window_model: string;
  alternate_window_model: string;
  window_width: string;
  window_height: string;
  blind_width: string;
  blind_height: string;
  control_dimension_a: string;
  control_dimension_b: string;
  measurement_confidence: "certain" | "uncertain";
  is_certain: boolean;
  notes: string;
  content_tokens: Record<string, string>;
  content_token_map: Record<string, string>;
};

export type RoofWindowSearchRange = [number, number];

export type RoofWindowSearchHighlights = {
  producer_name: RoofWindowSearchRange[];
  window_model: RoofWindowSearchRange[];
  control_dimension_a: RoofWindowSearchRange[];
  control_dimension_b: RoofWindowSearchRange[];
};

export type RoofWindowSearchResult = {
  item: RoofWindowLibraryItem;
  score: number;
  highlights: RoofWindowSearchHighlights;
};

const CRM_ALLEGRO_API = "https://crm-keika.groovemedia.pl/biuro/api/allegro";
const ROOF_WINDOW_LIBRARY_ENDPOINT = `${CRM_ALLEGRO_API}/roof_windows_public`;
const ROOF_WINDOW_NAMEPLATE_RECOGNIZE_ENDPOINT = `${CRM_ALLEGRO_API}/roof_window_nameplate_recognize`;
const ATTACHMENT_UPLOAD_ENDPOINT = `${CRM_ALLEGRO_API}/configurator_quote_attachment_upload.php`;
const LIBRARY_CACHE_KEY = "keika_roof_window_library_v1";
const LIBRARY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function readLibraryCache(): RoofWindowLibraryItem[] | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(LIBRARY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: number; items?: unknown[] };
    if (!parsed || !Array.isArray(parsed.items) || !parsed.savedAt) return null;
    if (Date.now() - parsed.savedAt > LIBRARY_CACHE_TTL_MS) return null;
    const items = parsed.items.map(normalizeRoofWindowLibraryItem).filter(Boolean) as RoofWindowLibraryItem[];
    return items.length ? items : null;
  } catch {
    return null;
  }
}

function writeLibraryCache(items: RoofWindowLibraryItem[]) {
  try {
    window.localStorage.setItem(LIBRARY_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), items }));
  } catch {
    /* quota / private mode - the cache is a convenience only */
  }
}

/** The bundled 2026-08-30 snapshot mapped into the live item shape. Ids are
 * negative (position-based) so they never collide with real CRM ids; a
 * position added from the snapshot carries producer/model/size, which is all
 * the CRM needs to produce the blind. */
export function bundledRoofWindowLibrary(): RoofWindowLibraryItem[] {
  return ROOF_WINDOW_MODELS.map((entry, index) => ({
    id: -(index + 1),
    producer_name: entry.producer,
    window_model: entry.model,
    alternate_window_model: entry.altModel,
    window_width: String(entry.windowWidthMm || ""),
    window_height: String(entry.windowHeightMm || ""),
    blind_width: String(entry.blindWidthMm || ""),
    blind_height: String(entry.blindHeightMm || ""),
    control_dimension_a: String(entry.blindWidthMm || ""),
    control_dimension_b: String(entry.blindHeightMm || ""),
    measurement_confidence: entry.certain ? "certain" : "uncertain",
    is_certain: entry.certain,
    notes: "",
    content_tokens: {},
    content_token_map: {},
  }));
}

let libraryPromise: Promise<{ items: RoofWindowLibraryItem[]; source: "live" | "cache" | "bundled" }> | null = null;

/** Live library (420+ models) with a 24 h cache and the bundled snapshot as
 * the last resort. Never throws. */
export function fetchRoofWindowLibrary(): Promise<{ items: RoofWindowLibraryItem[]; source: "live" | "cache" | "bundled" }> {
  if (!libraryPromise) {
    libraryPromise = (async () => {
      const cached = readLibraryCache();
      if (cached) return { items: cached, source: "cache" as const };
      try {
        const response = await fetch(ROOF_WINDOW_LIBRARY_ENDPOINT, { method: "GET", cache: "no-store" });
        if (!response.ok) throw new Error(`Roof window library HTTP ${response.status}`);
        const payload = (await response.json()) as { ok?: boolean; data?: { items?: unknown[] } };
        const rawItems = Array.isArray(payload?.data?.items) ? payload.data.items : [];
        const items = rawItems.map(normalizeRoofWindowLibraryItem).filter(Boolean) as RoofWindowLibraryItem[];
        if (!items.length) throw new Error("empty library");
        writeLibraryCache(items);
        return { items, source: "live" as const };
      } catch {
        return { items: bundledRoofWindowLibrary(), source: "bundled" as const };
      }
    })();
  }
  return libraryPromise;
}

/** Producers present in the library, most models first - the "420 modeli ·
 * Velux, Fakro, Roto…" teaser and the missing-model form's select. */
export function libraryProducers(items: RoofWindowLibraryItem[]): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    // "Fakro FTP-V U3" -> family "Fakro"; keeps the teaser to real brands.
    const brand = item.producer_name.trim().split(/\s+/)[0] || "";
    if (!brand) continue;
    const key = brand.toLocaleLowerCase("pl-PL");
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ name: key.charAt(0).toUpperCase() + key.slice(1), count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "pl"));
}

/** Producer names exactly as stored (for the missing-model select). */
export function libraryProducerNames(items: RoofWindowLibraryItem[]): string[] {
  const set = new Set<string>();
  for (const item of items) {
    const name = item.producer_name.trim();
    if (name) set.add(name);
  }
  return Array.from(set).sort((left, right) => left.localeCompare(right, "pl", { sensitivity: "base" }));
}

/** Blind size for a library window - same precedence as the Allegro shell:
 * blind size, else control dimensions, else the window's nominal size. */
export function resolveRoofWindowDimensions(item: RoofWindowLibraryItem): { widthMm: number; heightMm: number } {
  const pick = (...values: string[]) => {
    for (const value of values) {
      const n = Number(String(value || "").replace(",", "."));
      if (Number.isFinite(n) && n > 0) return Math.round(n);
    }
    return 0;
  };
  return {
    widthMm: pick(item.blind_width, item.control_dimension_a, item.window_width),
    heightMm: pick(item.blind_height, item.control_dimension_b, item.window_height),
  };
}

// ---------------------------------------------------------------------------
// Nameplate photo -> library match (Gemini in the CRM)
// ---------------------------------------------------------------------------

export type RoofWindowNameplateAiRead = {
  producer: string;
  model: string;
  confidence: "high" | "medium" | "low" | "none";
};

export type RoofWindowNameplateRecognizeResult = {
  status: "matched" | "no_match";
  libraryItem: RoofWindowLibraryItem | null;
  candidates: RoofWindowLibraryItem[];
  plateVisible: boolean;
  aiRead: RoofWindowNameplateAiRead;
  attachmentId: string;
} | null; // null = the assistant is unavailable (no key / limit / error) - manual path

/** The four outcomes the UI shows - see RoofWindowSearchSelector:
 * - "unrecognized": no nameplate visible on the photo (or assistant down);
 * - "candidates": something was read but not confidently - pick from a few;
 * - "no_match": read a producer/model we do not have in the library;
 * - "matched": confident hit, the customer confirms before it is applied. */
export type RoofWindowNameplateOutcome =
  | { kind: "unrecognized" }
  | { kind: "candidates"; producer: string; model: string; items: RoofWindowLibraryItem[] }
  | { kind: "no_match"; producer: string; model: string }
  | { kind: "matched"; item: RoofWindowLibraryItem };

export type UploadedAttachment = { id: string; fileName: string; mimeType: string; fileSize: number };

const UPLOAD_MAX_EDGE_PX = 1600;
const UPLOAD_TARGET_BYTES = 1_100_000;

/** Downscales a photo in the browser (phones shoot 12 MP; the nameplate
 * reader needs nothing near that) - JPEG, longest edge 1600 px, quality
 * stepped down until ~1 MB. HEIC and anything the browser cannot decode is
 * sent as-is (the CRM accepts HEIC). */
async function downscaleImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || /heic|heif/i.test(file.type)) return file;
  if (file.size < 700_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, UPLOAD_MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    let quality = 0.86;
    let blob: Blob | null = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (!blob || blob.size <= UPLOAD_TARGET_BYTES) break;
      quality -= 0.14;
    }
    if (!blob) return file;
    const name = file.name.replace(/\.[a-z0-9]+$/i, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

/** Uploads a photo to the CRM attachment store under this browser session
 * (same store the Allegro configurator uses; the CRM order/quote view opens
 * it by attachment id). */
export async function uploadNameplatePhoto(file: File): Promise<UploadedAttachment> {
  const sessionToken = getSessionToken();
  if (!sessionToken) throw new Error("Brak identyfikatora sesji - odśwież stronę i spróbuj ponownie.");
  const prepared = await downscaleImage(file);
  const formData = new FormData();
  formData.append("file", prepared);
  formData.append("session_token", sessionToken);
  const response = await fetch(ATTACHMENT_UPLOAD_ENDPOINT, { method: "POST", body: formData, cache: "no-store" });
  const json = (await response.json().catch(() => null)) as {
    ok?: boolean;
    attachment?: { id?: string; file_name?: string; mime_type?: string; file_size?: number };
    error?: string;
  } | null;
  if (!response.ok || !json?.ok || !json.attachment?.id) {
    throw new Error((json && typeof json.error === "string" && json.error) || "Nie udało się wgrać zdjęcia.");
  }
  return {
    id: String(json.attachment.id),
    fileName: String(json.attachment.file_name || prepared.name),
    mimeType: String(json.attachment.mime_type || prepared.type),
    fileSize: Number(json.attachment.file_size || prepared.size) || 0,
  };
}

export async function recognizeRoofWindowNameplate(attachmentId: string): Promise<RoofWindowNameplateRecognizeResult> {
  const response = await fetch(ROOF_WINDOW_NAMEPLATE_RECOGNIZE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      attachment_id: attachmentId,
      session_token: getSessionToken(),
      channel: "shop",
    }),
  });

  const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!json || typeof json !== "object" || json.ok !== true) {
    throw new Error((json && typeof json.error === "string" && json.error) || "Nie udało się rozpoznać zdjęcia.");
  }
  if (json.disabled === true || !json.match) {
    return null;
  }

  const match = json.match as Record<string, unknown>;
  const aiReadRaw = (match.ai_read || {}) as Record<string, unknown>;
  const confidenceRaw = String(aiReadRaw.confidence || "none");
  const confidence: RoofWindowNameplateAiRead["confidence"] =
    confidenceRaw === "high" || confidenceRaw === "medium" || confidenceRaw === "low" ? confidenceRaw : "none";
  const rawCandidates = Array.isArray(match.candidates) ? match.candidates : [];

  return {
    status: match.status === "matched" ? "matched" : "no_match",
    libraryItem: normalizeRoofWindowLibraryItem(match.library_item),
    candidates: rawCandidates.map(normalizeRoofWindowLibraryItem).filter((item): item is RoofWindowLibraryItem => Boolean(item)),
    plateVisible: Boolean(match.plate_visible),
    aiRead: {
      producer: String(aiReadRaw.producer || "").trim(),
      model: String(aiReadRaw.model || "").trim(),
      confidence,
    },
    attachmentId: String(match.attachment_id || attachmentId),
  };
}

/** Maps a recognition result onto the four UI outcomes (same rules as the
 * Allegro shell's handleNameplatePhotoUpload). */
export function classifyNameplateResult(result: RoofWindowNameplateRecognizeResult): RoofWindowNameplateOutcome {
  const aiProducer = result?.aiRead.producer.trim() || "";
  const aiModel = result?.aiRead.model.trim() || "";
  if (result && result.status === "matched" && result.libraryItem) return { kind: "matched", item: result.libraryItem };
  if (result && !result.plateVisible) return { kind: "unrecognized" };
  if (result && result.candidates.length > 0) return { kind: "candidates", producer: aiProducer, model: aiModel, items: result.candidates };
  if (aiProducer || aiModel) return { kind: "no_match", producer: aiProducer, model: aiModel };
  return { kind: "unrecognized" };
}

function normalizeRoofWindowLibraryItem(value: unknown): RoofWindowLibraryItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const normalizeMap = (input: unknown): Record<string, string> => {
    if (!input || typeof input !== "object") return {};
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>)
        .map(([key, entryValue]) => [String(key || "").trim(), String(entryValue || "").trim()])
        .filter(([key, entryValue]) => Boolean(key) && Boolean(entryValue)),
    );
  };
  const measurementConfidence = String(item.measurement_confidence || "").trim().toLowerCase() === "certain" ? "certain" : "uncertain";
  return {
    id: Number(item.id || 0) || 0,
    producer_name: String(item.producer_name || "").trim(),
    window_model: String(item.window_model || "").trim(),
    alternate_window_model: String(item.alternate_window_model || "").trim(),
    window_width: String(item.window_width || "").trim(),
    window_height: String(item.window_height || "").trim(),
    blind_width: String(item.blind_width || "").trim(),
    blind_height: String(item.blind_height || "").trim(),
    control_dimension_a: String(item.control_dimension_a || "").trim(),
    control_dimension_b: String(item.control_dimension_b || "").trim(),
    measurement_confidence: measurementConfidence,
    is_certain: measurementConfidence === "certain" || Boolean(item.is_certain),
    notes: String(item.notes || "").trim(),
    content_tokens: normalizeMap(item.content_tokens),
    content_token_map: normalizeMap(item.content_token_map),
  };
}

export function buildRoofWindowDisplayLabel(item: RoofWindowLibraryItem): string {
  return [item.producer_name, item.window_model].filter(Boolean).join(" ").trim();
}

// ---------------------------------------------------------------------------
// Search - verbatim scoring from the Allegro configurator
// ---------------------------------------------------------------------------

export function searchRoofWindowLibrary(items: RoofWindowLibraryItem[], query: string): RoofWindowSearchResult[] {
  const normalizedQuery = normalizeRoofWindowsSearchText(query);
  const tokens = tokenizeRoofWindowsSearchQuery(normalizedQuery);
  if (!tokens.length) return [];

  return items
    .map((item) => {
      const match = scoreRoofWindowsSearchMatch(item, normalizedQuery);
      if (!match.isMatch) return null;
      return { item, score: match.score, highlights: match.highlights } satisfies RoofWindowSearchResult;
    })
    .filter((result): result is RoofWindowSearchResult => Boolean(result))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      const producerCompare = left.item.producer_name.localeCompare(right.item.producer_name, "pl", { sensitivity: "base" });
      if (producerCompare !== 0) return producerCompare;
      return left.item.window_model.localeCompare(right.item.window_model, "pl", { sensitivity: "base" });
    });
}

type RoofWindowSearchMatchInternal = { isMatch: boolean; score: number; highlights: RoofWindowSearchHighlights };

const emptyHighlights = (): RoofWindowSearchHighlights => ({
  producer_name: [],
  window_model: [],
  control_dimension_a: [],
  control_dimension_b: [],
});

function scoreRoofWindowsSearchMatch(item: RoofWindowLibraryItem, query: string): RoofWindowSearchMatchInternal {
  const normalizedQuery = normalizeRoofWindowsSearchText(query);
  const tokens = tokenizeRoofWindowsSearchQuery(normalizedQuery);
  if (!tokens.length) return { isMatch: true, score: 0, highlights: emptyHighlights() };

  const tokenMapValues = Object.values(item.content_token_map || {});
  const contentTokenValues = Object.values(item.content_tokens || {});

  const fields = [
    { key: "producer_name", text: item.producer_name, weight: 18, highlightable: true },
    { key: "window_model", text: item.window_model, weight: 22, highlightable: true },
    { key: "alternate_window_model", text: item.alternate_window_model, weight: 16, highlightable: false },
    { key: "control_dimension_a", text: item.control_dimension_a, weight: 14, highlightable: true },
    { key: "control_dimension_b", text: item.control_dimension_b, weight: 14, highlightable: true },
    { key: "aliases", text: contentTokenValues.concat(tokenMapValues).filter(Boolean).join(" "), weight: 9, highlightable: false },
    { key: "notes", text: item.notes, weight: 4, highlightable: false },
  ];

  const highlights = emptyHighlights();
  const matchedFields = new Set<string>();
  let score = 0;

  for (const token of tokens) {
    let bestMatch: { score: number; ranges: RoofWindowSearchRange[]; fieldKey: string; highlightable: boolean } | null = null;
    for (const field of fields) {
      const fieldMatch = scoreRoofWindowsSearchTokenInField(token, field.text, field.weight);
      if (!fieldMatch) continue;
      if (!bestMatch || fieldMatch.score > bestMatch.score) {
        bestMatch = { ...fieldMatch, fieldKey: field.key, highlightable: field.highlightable };
      }
    }
    if (!bestMatch) return { isMatch: false, score: 0, highlights: emptyHighlights() };
    score += bestMatch.score;
    matchedFields.add(bestMatch.fieldKey);
    if (bestMatch.highlightable && Array.isArray(highlights[bestMatch.fieldKey as keyof RoofWindowSearchHighlights])) {
      highlights[bestMatch.fieldKey as keyof RoofWindowSearchHighlights].push(...bestMatch.ranges);
    }
  }

  score += scoreRoofWindowsSearchPhraseBonus(fields, normalizedQuery);
  score += matchedFields.size * 40;

  return {
    isMatch: score > 0,
    score,
    highlights: {
      producer_name: mergeRoofWindowsHighlightRanges(highlights.producer_name),
      window_model: mergeRoofWindowsHighlightRanges(highlights.window_model),
      control_dimension_a: mergeRoofWindowsHighlightRanges(highlights.control_dimension_a),
      control_dimension_b: mergeRoofWindowsHighlightRanges(highlights.control_dimension_b),
    },
  };
}

function scoreRoofWindowsSearchPhraseBonus(
  fields: Array<{ key: string; text: string; weight: number; highlightable: boolean }>,
  normalizedQuery: string,
): number {
  if (!normalizedQuery) return 0;
  let bestBonus = 0;
  fields.forEach((field) => {
    const normalizedField = normalizeRoofWindowsComparableText(field.text);
    if (!normalizedField) return;
    if (normalizedField === normalizedQuery) {
      bestBonus = Math.max(bestBonus, field.weight * 120);
      return;
    }
    if (normalizedField.startsWith(normalizedQuery)) {
      bestBonus = Math.max(bestBonus, field.weight * 90);
      return;
    }
    const containsIndex = normalizedField.indexOf(normalizedQuery);
    if (containsIndex >= 0) bestBonus = Math.max(bestBonus, field.weight * 70 - containsIndex * 2);
  });
  return Math.max(bestBonus, 0);
}

function scoreRoofWindowsSearchTokenInField(token: string, text: string, weight: number): { score: number; ranges: RoofWindowSearchRange[] } | null {
  const normalizedText = normalizeRoofWindowsComparableText(text);
  if (!token || !normalizedText) return null;
  if (normalizedText === token) return { score: weight * 1000 + token.length * 20, ranges: [[0, text.length || normalizedText.length]] };
  if (normalizedText.startsWith(token)) return { score: weight * 780 + token.length * 18, ranges: [[0, token.length]] };
  const containsIndex = normalizedText.indexOf(token);
  if (containsIndex >= 0) return { score: weight * 560 + token.length * 16 - containsIndex * 4, ranges: [[containsIndex, containsIndex + token.length]] };
  if (token.length >= 2) {
    const compactText = compactRoofWindowsSearchText(text);
    const compactToken = compactRoofWindowsSearchText(token);
    if (compactToken && compactText.startsWith(compactToken)) {
      return { score: weight * 430 + compactToken.length * 12, ranges: findRoofWindowsSubsequenceRanges(normalizedText, compactToken) };
    }
  }
  if (token.length >= 3) {
    const ranges = findRoofWindowsSubsequenceRanges(normalizedText, token);
    if (ranges.length) {
      const spread = ranges[ranges.length - 1][1] - ranges[0][0];
      return { score: weight * 300 + token.length * 12 - Math.max(0, spread - token.length), ranges };
    }
  }
  return null;
}

function mergeRoofWindowsHighlightRanges(ranges: RoofWindowSearchRange[]): RoofWindowSearchRange[] {
  if (!Array.isArray(ranges) || !ranges.length) return [];
  const sorted = ranges
    .filter((range) => Array.isArray(range) && range.length >= 2)
    .map((range) => [Number(range[0] || 0), Number(range[1] || 0)] as RoofWindowSearchRange)
    .sort((left, right) => left[0] - right[0]);
  if (!sorted.length) return [];
  const merged: RoofWindowSearchRange[] = [sorted[0]];
  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const previous = merged[merged.length - 1];
    if (current[0] <= previous[1]) {
      previous[1] = Math.max(previous[1], current[1]);
      continue;
    }
    merged.push(current);
  }
  return merged;
}

function findRoofWindowsSubsequenceRanges(haystack: string, needle: string): RoofWindowSearchRange[] {
  if (!haystack || !needle) return [];
  const ranges: RoofWindowSearchRange[] = [];
  let searchIndex = 0;
  for (let index = 0; index < needle.length; index += 1) {
    const foundIndex = haystack.indexOf(needle[index], searchIndex);
    if (foundIndex < 0) return [];
    ranges.push([foundIndex, foundIndex + 1]);
    searchIndex = foundIndex + 1;
  }
  return mergeRoofWindowsHighlightRanges(ranges);
}

function tokenizeRoofWindowsSearchQuery(query: string): string[] {
  return normalizeRoofWindowsSearchText(query)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function normalizeRoofWindowsSearchText(value: string): string {
  return normalizeRoofWindowsComparableText(value).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function normalizeRoofWindowsComparableText(value: string): string {
  return String(value || "")
    .toLocaleLowerCase("pl-PL")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function compactRoofWindowsSearchText(value: string): string {
  return normalizeRoofWindowsComparableText(value).replace(/[^\p{L}\p{N}]+/gu, "");
}

export function splitRoofWindowHighlightedText(value: string, ranges: RoofWindowSearchRange[]): Array<{ text: string; highlighted: boolean }> {
  const text = String(value || "");
  const mergedRanges = mergeRoofWindowsHighlightRanges(ranges);
  if (!text || !mergedRanges.length) return [{ text: text || "—", highlighted: false }];
  const parts: Array<{ text: string; highlighted: boolean }> = [];
  let lastIndex = 0;
  mergedRanges.forEach(([start, end]) => {
    const safeStart = Math.max(0, Math.min(text.length, start));
    const safeEnd = Math.max(safeStart, Math.min(text.length, end));
    if (safeStart > lastIndex) parts.push({ text: text.slice(lastIndex, safeStart), highlighted: false });
    parts.push({ text: text.slice(safeStart, safeEnd), highlighted: true });
    lastIndex = safeEnd;
  });
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), highlighted: false });
  return parts.length ? parts : [{ text: text || "—", highlighted: false }];
}
