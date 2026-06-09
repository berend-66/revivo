import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseTreatwellHtml, treatwellListingToFacts } from "../src/treatwell";
import { crossCheckListing } from "../src/fact-check";

/**
 * The deterministic cross-source fidelity check (A2): re-extract the salon's
 * scalars from `window.__state__` and from JSON-LD independently and compare.
 * A real, faithful page agrees on every scalar both sources expose; a corrupted
 * state parse disagrees. Offline, no network, no LLM/vision.
 */

const FIXTURE_URL = "https://www.treatwell.nl/salon/utrecht-hairstyle/";

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/treatwell/${name}`, import.meta.url), "utf8");
}

describe("crossCheckListing", () => {
  it("PASSES when both embedded sources agree (the real, faithful page)", () => {
    const raw = parseTreatwellHtml(fixture("utrecht-hairstyle.html"), FIXTURE_URL);
    const facts = treatwellListingToFacts(raw);

    const report = crossCheckListing(raw, facts);

    expect(report.crossCheckable).toBe(true);
    expect(report.verdict).toBe("pass");
    expect(report.mismatches).toEqual([]);
    // every scalar both sources expose is comparable and agrees
    expect(report.checks).toHaveLength(6);
    for (const check of report.checks) {
      expect(check.comparable).toBe(true);
      expect(check.agree).toBe(true);
    }
  });

  it("FLAGS a mismatch when the state parse is corrupted but JSON-LD is intact", () => {
    const raw = parseTreatwellHtml(fixture("utrecht-hairstyle.html"), FIXTURE_URL);

    // Simulate a silently-broken state parse: mangle the state's opening hours
    // (close Tuesday) while leaving the JSON-LD block untouched. This is exactly
    // the failure batch volume would otherwise multiply across every prospect.
    const mangled = structuredClone(raw);
    const v = (mangled.state as any)?.venue?.venue ?? (mangled.state as any)?.venue;
    const tuesday = (v?.openingHours ?? []).find(
      (o: any) => String(o?.dayOfWeek).toLowerCase() === "tuesday",
    );
    expect(tuesday).toBeDefined(); // guard: fixture really had Tuesday hours
    tuesday.open = false;
    tuesday.from = null;

    const facts = treatwellListingToFacts(mangled);
    const report = crossCheckListing(mangled, facts);

    expect(report.crossCheckable).toBe(true);
    expect(report.verdict).toBe("mismatch");
    const hours = report.mismatches.find((m) => m.field === "hours");
    expect(hours).toBeDefined();
    expect(hours?.comparable).toBe(true);
    expect(hours?.agree).toBe(false);
    expect(hours?.stateValue).not.toBe(hours?.jsonLdValue);
    // the untouched scalars still agree — only hours is flagged
    for (const check of report.checks) {
      if (check.field !== "hours") expect(check.agree).toBe(true);
    }
  });

  it("reports UNCHECKABLE when only one embedded source is present", () => {
    const raw = parseTreatwellHtml(fixture("no-state.html"), FIXTURE_URL);
    const facts = treatwellListingToFacts(raw);

    const report = crossCheckListing(raw, facts);

    expect(raw.state).toBeNull();
    expect(report.crossCheckable).toBe(false);
    expect(report.verdict).toBe("uncheckable");
    expect(report.summary).toContain("window.__state__");
  });
});
