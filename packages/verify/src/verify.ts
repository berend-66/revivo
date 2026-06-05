import { z } from "zod";
import { createVisionClient, type LLMClient } from "@revivo/llm";
import { screenshot, type Viewport } from "./screenshot";

/**
 * The verification pass — the scraper-accuracy MEASUREMENT instrument.
 *
 * It screenshots (1) the rendered mockup and (2) the salon's real Treatwell page,
 * then runs a TWO-STAGE vision judge:
 *
 *   1. FIND  — one call lists candidate discrepancies (wrong prices/services/team/
 *              rating/hours, and invented atmosphere claims in the about-prose).
 *   2. CONFIRM — each candidate gets an INDEPENDENT, narrow, refute-on-doubt re-check.
 *              A focused "read this one value on both images" call is far more reliable
 *              than the omnibus find call, which (proven on the first real run) can
 *              hallucinate a specific number — it claimed €35 where the mockup and the
 *              listing both clearly show €55. Only CONFIRMED issues are counted.
 *
 * Styling / colour / fonts / photography / voice are explicitly ignored; only checkable
 * content matters. `mistakeCount` (critical + major) is recomputed in code from the
 * confirmed issues, so it never depends on the model's own arithmetic.
 *
 * Built as an evaluation tool first (Phase 6.5 decides whether it ever becomes a runtime
 * `--push` gate), not a committed per-mockup cost.
 */

export const VerifySeverity = z.enum(["critical", "major", "minor"]);
export type VerifySeverity = z.infer<typeof VerifySeverity>;

export const VerifyIssueSchema = z.object({
  /** Which fact disagrees, e.g. "price: balayage", "team", "rating", "about prose". */
  field: z.string(),
  /** What the real Treatwell listing shows (or "absent" when the mockup invented it). */
  expected: z.string(),
  /** What the mockup shows. */
  got: z.string(),
  severity: VerifySeverity,
  note: z.string().optional(),
});
export type VerifyIssue = z.infer<typeof VerifyIssueSchema>;

/** A candidate issue the confirm pass rejected — kept for transparency, never counted. */
export interface RefutedIssue extends VerifyIssue {
  reason: string;
  observedOnMockup: string;
  observedOnListing: string;
}

/** Raw FIND output (before confirmation + deterministic counting). */
const FindReportSchema = z.object({
  issues: z.array(VerifyIssueSchema).default([]),
  summary: z.string().default(""),
});

/** Raw CONFIRM output for one candidate issue. */
const ConfirmSchema = z.object({
  observedOnMockup: z.string().default(""),
  observedOnListing: z.string().default(""),
  confirmed: z.boolean(),
  reason: z.string().default(""),
});

export interface VerifyResult {
  /** True iff there are no confirmed critical or major issues (minor drift is allowed). */
  match: boolean;
  /** Confirmed critical + major issues — the headline accuracy metric. */
  mistakeCount: number;
  bySeverity: Record<VerifySeverity, number>;
  /** Issues that survived confirmation. */
  issues: VerifyIssue[];
  /** Candidates the confirm pass rejected (e.g. a hallucinated price). */
  refuted: RefutedIssue[];
  /** How many candidates the FIND pass raised before confirmation. */
  candidateCount: number;
  summary: string;
  model: string;
  mockupUrl: string;
  treatwellUrl: string;
  viewport: Viewport;
}

export interface VerifyInput {
  mockupUrl: string;
  treatwellUrl: string;
  /** Salon name, surfaced to the judge so it anchors on the right business. */
  salonName?: string;
  viewport?: Viewport;
  /** Inject a client to override the model; defaults to `createVisionClient()`. */
  client?: LLMClient;
}

const FIND_SYSTEM = `You are a meticulous QA reviewer for a service that builds personalized websites ("mockups") for hair & beauty salons in the Netherlands. Each mockup is sent to the REAL salon owner as a cold opener, so it must never be confidently WRONG about their own business.

You are given TWO full-page screenshots:
- IMAGE 1 = the MOCKUP we generated for the salon.
- IMAGE 2 = the salon's REAL listing on Treatwell (the GROUND TRUTH).

Your job: find every place where the mockup asserts a FACT that the real listing contradicts, or that the listing does not support at all (an invented fact). Report each as a discrepancy. Read values carefully and quote the EXACT text/number you see on each image.

CHECK these fact categories:
- Prices: a service price on the mockup that differs from the listing (note "vanaf/from" prices — the listing often shows a starting price).
- Services: a treatment presented as offered that the listing does not list, or a clear core service that's misrepresented. (Reasonable category grouping/renaming is fine — only flag genuine invention or contradiction.)
- Team: stylist names/roles/count that don't match the listing's team.
- Reputation: the star rating and the number of reviews must match the listing.
- Opening hours, address, city, phone number.
- ATMOSPHERE / STORY CLAIMS IN THE PROSE: any concrete, checkable claim in the "about"/intro text that is NOT supported by the listing — a specific music genre (e.g. "vaak klinkt er Spaanse muziek"), drinks served, scents, interior details, awards, a founding year, "X years of experience", or a founder backstory. These are high-impact: one invented detail tells the owner the text isn't really about them. Flag them even if they sound plausible.

IGNORE (these are NOT discrepancies):
- Visual styling: colours, fonts, layout, spacing, photography choice, which photos are shown.
- Voice/tone/marketing phrasing and general atmosphere words ("warm", "persoonlijk", "rustig") that make no specific checkable claim.
- The mockup curating, reordering, or rephrasing content, or showing fewer items than the listing.
- Language differences. Both are Dutch; judge the meaning.

SEVERITY:
- "critical" = a wrong checkable number/identity the owner would spot instantly: wrong price, wrong rating, wrong review count, wrong phone, wrong opening hours, a named service/team member that is plainly wrong.
- "major" = an INVENTED concrete claim not on the listing (music/drinks/awards/years/backstory), or a missing/extra named team member.
- "minor" = small paraphrase drift, rounding, ordering, or a soft claim that is plausible and not clearly contradicted.

Return ONLY a JSON object, no prose around it:
{
  "issues": [
    { "field": "<which fact>", "expected": "<EXACT value on the listing, or 'absent'>", "got": "<EXACT value on the mockup>", "severity": "critical|major|minor", "note": "<optional short note>" }
  ],
  "summary": "<one or two sentences: how faithful is the mockup, and the worst problem if any>"
}
If the mockup is fully faithful, return an empty "issues" array and say so in the summary.`;

const CONFIRM_SYSTEM = `You are double-checking ONE claim from a first-pass review that compared a salon's generated website ("the mockup", IMAGE 1) to its real Treatwell listing ("the listing", IMAGE 2).

You are given a single claimed discrepancy. Decide whether it is REAL by reading the images yourself — do NOT assume the first reviewer was right (it sometimes misreads small text).

Method:
1. Locate the relevant fact on the MOCKUP (image 1); write the EXACT value you see as observedOnMockup. If you cannot find or clearly read it, write "unreadable".
2. Locate the same fact on the LISTING (image 2); write it as observedOnListing. If absent or unreadable, say so.
3. confirmed = true ONLY if you can clearly read the value on the mockup AND it genuinely contradicts, or is unsupported by, the listing.

Bias strongly toward confirmed=false when uncertain: if you cannot clearly read the value on either image, or they actually agree, or the difference is only wording/styling/ordering/curation, mark it refuted. A false alarm is worse than a missed issue here.

Return ONLY JSON: {"observedOnMockup":"...","observedOnListing":"...","confirmed":true|false,"reason":"<short>"}`;

function buildFindPrompt(salonName?: string): string {
  const who = salonName ? ` for the salon "${salonName}"` : "";
  return `Compare the MOCKUP (image 1)${who} against its REAL Treatwell listing (image 2). List every factual discrepancy as specified, classify severity, quote exact values, and summarize. Remember: ignore all styling/voice; flag invented atmosphere claims in the about-text. Output the JSON object only.`;
}

function buildConfirmPrompt(issue: VerifyIssue, salonName?: string): string {
  return `Salon: ${salonName ?? "(unknown)"}.
Claimed discrepancy to verify:
- field: ${issue.field}
- the first reviewer said the MOCKUP shows: "${issue.got}"
- and the LISTING shows: "${issue.expected}"
- claimed severity: ${issue.severity}

Read both images yourself and decide whether this is a REAL discrepancy. Output the JSON only.`;
}

function toDataUrl(jpeg: Buffer): string {
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

/** Tolerant JSON extraction: strips ``` fences and trailing prose, parses the first object. */
function extractJsonObject(text: string): unknown {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`vision model returned no JSON object. Raw: ${text.slice(0, 300)}`);
  }
  return JSON.parse(s.slice(start, end + 1));
}

/** Stage 2: independently re-check one candidate issue; refute on any doubt. */
async function confirmIssue(
  client: LLMClient,
  mockupDataUrl: string,
  listingDataUrl: string,
  issue: VerifyIssue,
  salonName?: string,
): Promise<{ issue: VerifyIssue; confirmed: boolean; reason: string; observedOnMockup: string; observedOnListing: string }> {
  try {
    const res = await client.complete({
      system: CONFIRM_SYSTEM,
      user: buildConfirmPrompt(issue, salonName),
      images: [
        { dataUrl: mockupDataUrl, detail: "high" },
        { dataUrl: listingDataUrl, detail: "high" },
      ],
      json: true,
      maxTokens: 700,
      temperature: 0,
    });
    const parsed = ConfirmSchema.parse(extractJsonObject(res.text));
    return { issue, ...parsed };
  } catch (err) {
    // If the confirm call itself fails, keep the issue (don't silently drop a possible
    // real bug) but mark the failure in the reason so it's visible.
    return {
      issue,
      confirmed: true,
      reason: `confirm pass errored, kept conservatively: ${(err as Error).message}`,
      observedOnMockup: "",
      observedOnListing: "",
    };
  }
}

export async function verifyMockupAgainstListing(input: VerifyInput): Promise<VerifyResult> {
  const client = input.client ?? createVisionClient();
  const viewport: Viewport = input.viewport ?? "desktop";

  const [mockupShot, listingShot] = await Promise.all([
    screenshot(input.mockupUrl, { viewport }),
    screenshot(input.treatwellUrl, { viewport, dismissConsent: true }),
  ]);
  const mockupDataUrl = toDataUrl(mockupShot);
  const listingDataUrl = toDataUrl(listingShot);

  // Stage 1: FIND candidate discrepancies.
  const findRes = await client.complete({
    system: FIND_SYSTEM,
    user: buildFindPrompt(input.salonName),
    images: [
      { dataUrl: mockupDataUrl, detail: "high" },
      { dataUrl: listingDataUrl, detail: "high" },
    ],
    json: true,
    maxTokens: 2500,
    temperature: 0,
  });
  const find = FindReportSchema.parse(extractJsonObject(findRes.text));

  // Stage 2: CONFIRM each candidate independently (parallel), refute on doubt.
  const checked = await Promise.all(
    find.issues.map((issue) => confirmIssue(client, mockupDataUrl, listingDataUrl, issue, input.salonName)),
  );

  const issues: VerifyIssue[] = [];
  const refuted: RefutedIssue[] = [];
  for (const c of checked) {
    if (c.confirmed) {
      issues.push(c.issue);
    } else {
      refuted.push({
        ...c.issue,
        reason: c.reason,
        observedOnMockup: c.observedOnMockup,
        observedOnListing: c.observedOnListing,
      });
    }
  }

  // Headline metric: confirmed criticals + majors, recomputed in code.
  const bySeverity: Record<VerifySeverity, number> = { critical: 0, major: 0, minor: 0 };
  for (const issue of issues) bySeverity[issue.severity] += 1;
  const mistakeCount = bySeverity.critical + bySeverity.major;

  return {
    match: mistakeCount === 0,
    mistakeCount,
    bySeverity,
    issues,
    refuted,
    candidateCount: find.issues.length,
    summary: find.summary,
    model: client.model,
    mockupUrl: input.mockupUrl,
    treatwellUrl: input.treatwellUrl,
    viewport,
  };
}
