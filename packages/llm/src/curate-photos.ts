import { z } from "zod";
import { createVisionClient, type LLMClient } from "./client";

/**
 * Photo curation — vision classification + DETERMINISTIC slotting.
 *
 * Measured 2026-06-10 across all 159 listing photos of the 14 live Utrecht
 * mockups: 58% interior, 28% product bottles, 6% storefronts, and only 3%
 * actual work results — and listing order ≠ quality order (avg 2.2 of the 4
 * hero slots were hero-worthy; one salon had 0/4 with its best shots at
 * indices 8–9). `applyListingFacts` used to slot photos blindly by listing
 * order, so storefronts and shampoo bottles landed in heroes.
 *
 * Same split as everywhere else in this repo: the LLM only LOOKS (one cheap
 * vision call labels every photo: kind + heroScore + duplicates) while the
 * slotting is pure code (`curatePhotoSlots`) — model drift can change a
 * label, never the rules. Classification failure degrades to the old
 * listing-order behaviour, reported via `MockupGates.photoCuration` but
 * never gating the verdict — the soft posture of the fidelity checks.
 *
 * Why a vision model here while the screenshot verifier was shelved: that one
 * failed at fine-grained OCR (misreading prices/digits off a downscaled
 * page); coarse scene classification — "is this a haircut, a room, or a
 * bottle of shampoo" — is the easy end of vision tasks, and the labels feed
 * deterministic rules instead of a verdict.
 */

export const PHOTO_KINDS = [
  "work",
  "interior",
  "exterior",
  "team",
  "product",
  "menu",
  "other",
] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

export interface PhotoLabel {
  /** 0-based index into the photos array. */
  index: number;
  kind: PhotoKind;
  /** 0 = unusable as hero, 1 = decent, 2 = striking. */
  heroScore: 0 | 1 | 2;
  /** Index of the EARLIER photo this one (nearly) duplicates. The listing
   * photos are already URL-deduped by the scraper; this catches the same
   * content re-uploaded under a different image id (measured: 2 of 14 salons). */
  duplicateOf?: number;
  /** 2–6 Dutch words describing the content — becomes caption grounding. */
  note?: string;
}

export interface PhotoSlots {
  hero: string[];
  /** Final gallery in order; kind + note ride along so the generation prompt
   * can ground captions in what each photo actually shows. */
  gallery: { url: string; kind: PhotoKind; note?: string }[];
  portrait?: string;
  droppedDuplicates: number;
  /** Post-dedupe kind counts — the operator-facing one-line summary. */
  counts: Partial<Record<PhotoKind, number>>;
}

/** The bundle threaded through the pipeline: labels (LLM) + slots (code). */
export interface PhotoCuration {
  labels: PhotoLabel[];
  slots: PhotoSlots;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}

// ── classification (the ONE vision call per salon) ──────────────────────────

const CLASSIFY_SYSTEM = `Je bent fotoredacteur voor revivo, dat websites maakt voor kapsalons en beautysalons. Je krijgt de foto's van het Treatwell-profiel van één salon, genummerd 1 t/m N in de aangeleverde volgorde. Classificeer ELKE foto.

kind (precies één):
- "work": een kapsel-/beauty-RESULTAAT of behandeling (gestyled haar, kleurresultaat, nagels, wimpers, before/after)
- "interior": interieur/sfeer van de salon (stoelen, spiegels, inrichting)
- "exterior": gevel, straat, pand van buiten
- "team": portret- of teamfoto van medewerkers (niet midden in een behandeling)
- "product": productflessen of schappen met producten
- "menu": prijslijst, menukaart, tekstafbeelding of logo
- "other": al het andere

heroScore — hoe goed staat deze foto groot bovenaan een website:
2 = opvallend mooi (scherp, mooi licht, verkoopt de salon) · 1 = prima · 0 = ongeschikt (rommelig, donker, saai, lege ruimte, alleen flessen).

duplicateOf: ALLEEN als de foto (vrijwel) identiek is aan een EERDERE foto — het nummer van die eerdere foto. Anders weglaten.

note: 2–6 Nederlandse woorden over wat er te zien is (bijv. "balayage close-up", "wachtruimte met planten").

Geef ALLEEN dit JSON-object, zonder tekst eromheen:
{ "photos": [ { "n": 1, "kind": "...", "heroScore": 0, "note": "..." }, { "n": 2, "kind": "...", "heroScore": 0, "duplicateOf": 1, "note": "..." }, ... ] }
met precies één entry per foto, n = 1 t/m N.`;

// `.catch()` on the label fields: an off-enum kind or a non-numeric heroScore
// downgrades that FIELD, never the whole call (same posture as check-about's
// kind enum). Coverage, by contrast, is all-or-nothing — see below.
const ModelLabelSchema = z.object({
  n: z.number().int().min(1),
  kind: z.enum(PHOTO_KINDS).catch("other"),
  heroScore: z.number().catch(0),
  duplicateOf: z.number().int().min(1).optional().catch(undefined),
  note: z.string().optional().catch(undefined),
});
const ModelSchema = z.object({ photos: z.array(ModelLabelSchema) });

export interface ClassifyPhotosInput {
  photos: string[];
  /** Injected for tests; defaults to the env-configured VISION_LLM_MODEL client. */
  client?: LLMClient;
}

export interface PhotoClassification {
  labels: PhotoLabel[];
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}

/** One multimodal call: every listing photo → {kind, heroScore, duplicateOf, note}.
 * Throws on an incomplete/garbled labelling — the caller degrades to listing
 * order (a PARTIAL labelling would silently drop the unlabelled photos). */
export async function classifyListingPhotos(input: ClassifyPhotosInput): Promise<PhotoClassification> {
  const { photos } = input;
  if (!photos.length) throw new Error("classifyListingPhotos: geen foto's om te classificeren");
  const client = input.client ?? createVisionClient();

  const res = await client.complete({
    system: CLASSIFY_SYSTEM,
    user: `Dit zijn de ${photos.length} foto's van de salon, foto 1 t/m ${photos.length} in deze volgorde. Geef het JSON-object.`,
    json: true,
    maxTokens: 3000,
    temperature: 0,
    // "low" is deliberate: scene classification needs no fine detail, and it
    // caps the per-photo token cost (<€0.01 per salon all-in).
    images: photos.map((url) => ({ url, detail: "low" as const })),
  });

  const parsed = ModelSchema.parse(extractJsonObject(res.text));

  // All-or-nothing coverage: every photo labelled exactly once (1-based in the
  // prompt — models miscount 0-based numbering), or reject the whole call.
  const byIndex = new Map<number, (typeof parsed.photos)[number]>();
  for (const p of parsed.photos) {
    const index = p.n - 1;
    if (index < 0 || index >= photos.length || byIndex.has(index)) {
      throw new Error(`foto-classificatie ongeldig (n=${p.n} bij ${photos.length} foto's)`);
    }
    byIndex.set(index, p);
  }
  if (byIndex.size !== photos.length) {
    throw new Error(`foto-classificatie dekt ${byIndex.size}/${photos.length} foto's`);
  }

  const labels: PhotoLabel[] = [...byIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, p]) => {
      const heroScore = Math.max(0, Math.min(2, Math.round(p.heroScore))) as 0 | 1 | 2;
      const label: PhotoLabel = { index, kind: p.kind, heroScore };
      // Only an EARLIER photo can be the original — a forward/self reference is
      // model confusion; ignore the flag rather than drop a unique photo.
      const dup = p.duplicateOf !== undefined ? p.duplicateOf - 1 : undefined;
      if (dup !== undefined && dup >= 0 && dup < index) label.duplicateOf = dup;
      const note = p.note?.trim();
      if (note) label.note = note.slice(0, 80);
      return label;
    });

  return { labels, model: client.model, usage: res.usage };
}

// ── slotting (pure code — the rules, not the model) ─────────────────────────

const HERO_MAX = 4;
/** Pad a thin gallery with product shots up to this size — under ~4 items the
 * variant grids look sparse. Products are filler, never lead content. */
const GALLERY_TARGET = 4;
/** SiteConfig requires gallery.min(2). A curated gallery CAN dip below this
 * (a salon with one unique photo) — both consumers must then stand down: the
 * grounding must not instruct "geef exact 1 item" (the model would obey and
 * fail schema validation) and applyListingFacts falls back to listing order.
 * Exported so the two guards can never disagree with the padding here. */
export const GALLERY_SCHEMA_MIN = 2;

/**
 * Deterministic slotting over validated labels:
 *  - duplicates dropped (keep the first occurrence);
 *  - hero = usable work shots, then usable interiors, then 0-scored
 *    work/interior — never exterior/product/menu; only a salon with NEITHER
 *    work nor interior falls back to best-ranked anything (hero needs ≥1);
 *  - gallery = work + interior + team ranked by (heroScore desc, listing
 *    order), padded with products below GALLERY_TARGET, with exterior/menu/
 *    other only as a last resort to reach the schema minimum;
 *  - portrait = best team shot, else best interior outside the hero, else
 *    anything outside the hero, else the last hero image.
 */
export function curatePhotoSlots(photos: string[], labels: PhotoLabel[]): PhotoSlots {
  if (labels.length !== photos.length) {
    throw new Error(`curatePhotoSlots: ${labels.length} labels voor ${photos.length} foto's`);
  }

  const keep = [...labels]
    .sort((a, b) => a.index - b.index)
    .filter((l) => l.duplicateOf === undefined);
  const droppedDuplicates = labels.length - keep.length;

  const ranked = [...keep].sort((a, b) => b.heroScore - a.heroScore || a.index - b.index);
  const of = (...kinds: PhotoKind[]) => ranked.filter((l) => kinds.includes(l.kind));

  const counts: Partial<Record<PhotoKind, number>> = {};
  for (const l of keep) counts[l.kind] = (counts[l.kind] ?? 0) + 1;

  // Hero. Work sells the salon better than any interior, but a 0-scored work
  // shot (blurry, cluttered) must not beat a striking interior.
  const usable = (l: PhotoLabel) => l.heroScore > 0;
  let heroLabels = [
    ...of("work").filter(usable),
    ...of("interior").filter(usable),
    ...of("work", "interior").filter((l) => !usable(l)),
  ].slice(0, HERO_MAX);
  if (!heroLabels.length) heroLabels = ranked.slice(0, HERO_MAX);

  // Gallery. Hero photos may repeat here (they always did) — with libraries
  // this thin, exclusion would starve the grid.
  const gallery = [...of("work", "interior", "team")];
  if (gallery.length < GALLERY_TARGET) {
    gallery.push(...of("product").slice(0, GALLERY_TARGET - gallery.length));
  }
  if (gallery.length < GALLERY_SCHEMA_MIN) {
    gallery.push(...of("exterior", "menu", "other").slice(0, GALLERY_SCHEMA_MIN - gallery.length));
  }

  const heroSet = new Set(heroLabels.map((l) => l.index));
  const portraitLabel =
    of("team")[0] ??
    of("interior").find((l) => !heroSet.has(l.index)) ??
    ranked.find((l) => !heroSet.has(l.index)) ??
    heroLabels[heroLabels.length - 1];

  return {
    hero: heroLabels.map((l) => photos[l.index]!),
    gallery: gallery.map((l) => ({
      url: photos[l.index]!,
      kind: l.kind,
      ...(l.note ? { note: l.note } : {}),
    })),
    ...(portraitLabel ? { portrait: photos[portraitLabel.index]! } : {}),
    droppedDuplicates,
    counts,
  };
}

/** Extract a JSON object from model output, tolerating ```json fences and prose.
 * (Local copy by convention — check-about and mockup-generator keep their own.) */
function extractJsonObject(text: string): unknown {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`foto-classificatie gaf geen JSON-object. Begin: ${text.slice(0, 200)}`);
  }
  return JSON.parse(s.slice(start, end + 1));
}
