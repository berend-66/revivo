import type { SiteConfig } from "@revivo/shared";

/**
 * Studio's numbered "NN / TT" section rail.
 *
 * The two optional sections — Team and Testimonials, both filled from real
 * listing facts — shift every later number AND the total, so the rail is
 * computed from `config` rather than hardcoded per section. Fixed order:
 *   01 Hero · 02 Manifesto · 03 Services · 04 Index ·
 *   [Team] · [Testimonials] · Details · Booking
 * `total` is the last section's number (= the section count, Hero included).
 */
export function studioRail(config: SiteConfig) {
  const hasTeam = !!config.team?.length;
  const hasReviews = !!config.testimonials?.length;
  const pad = (n: number) => String(n).padStart(2, "0");

  let n = 4; // Index is fixed at 04; optional + trailing sections number after it
  const team = hasTeam ? pad((n += 1)) : null;
  const reviews = hasReviews ? pad((n += 1)) : null;
  const details = pad((n += 1));
  const booking = pad((n += 1));

  return {
    manifesto: "02",
    services: "03",
    index: "04",
    team,
    reviews,
    details,
    booking,
    total: pad(n),
  } as const;
}
