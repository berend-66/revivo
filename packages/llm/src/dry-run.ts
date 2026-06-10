import { slugify, type SiteConfig, type SalonBrief } from "@revivo/shared";

/**
 * Deterministic stub SiteConfig built from a brief WITHOUT calling the LLM.
 * Lets us verify the whole pipeline — generate → validate → write → render —
 * without spending tokens. Production quality comes from `generateMockup`.
 */
export function stubMockup(brief: SalonBrief): SiteConfig {
  const slug = slugify(brief.name);
  const layout = brief.preferLayout ?? "atelier";
  const pic = (role: string, w: number, h: number) =>
    `https://picsum.photos/seed/${slug}-${role}/${w}/${h}`;

  return {
    slug,
    layout,
    brand: {
      name: brief.name,
      tagline: brief.vibe ?? `${brief.type === "beauty" ? "Beautysalon" : "Kapsalon"} in ${brief.city}`,
      colors: { primary: "#7a3a2a", accent: "#c98a64", ink: "#2b1d18", surface: "#f1e9dc" },
    },
    hero: {
      headline: `Welkom bij ${brief.name}.`,
      subheadline: brief.vibe ?? "Vakmanschap en aandacht, in jouw buurt.",
      images: [pic("hero-1", 1800, 2200), pic("hero-2", 1200, 1500)],
    },
    about: {
      heading: "Over ons.",
      body: [
        `${brief.name} is een ${brief.type === "beauty" ? "beautysalon" : "kapsalon"} in ${brief.city}. (Dit is een dry-run stub — echte copy komt van het model.)`,
        "Tweede alinea placeholder tekst voor de over-ons sectie.",
      ],
      portrait: pic("portrait", 1200, 1500),
      stats: [
        { label: "Sinds", value: "2020" },
        { label: "Stylisten", value: "3" },
      ],
    },
    services: [
      {
        category: "Knippen",
        items: [
          { name: "Knippen dames", price: 55, durationMin: 60 },
          { name: "Knippen heren", price: 35, durationMin: 30 },
        ],
      },
      {
        category: "Kleur",
        items: [{ name: "Balayage", price: 180, durationMin: 180 }],
      },
    ],
    gallery: [
      { url: pic("g1", 1200, 1500), aspect: "portrait" },
      { url: pic("g2", 1600, 1100), aspect: "landscape" },
      { url: pic("g3", 1200, 1200), aspect: "square" },
      { url: pic("g4", 1200, 1500), aspect: "portrait" },
    ],
    hours: [
      { day: "Maandag", closed: true },
      { day: "Dinsdag", open: "09:00", close: "18:00" },
      { day: "Woensdag", open: "09:00", close: "18:00" },
      { day: "Donderdag", open: "09:00", close: "20:00" },
      { day: "Vrijdag", open: "09:00", close: "18:00" },
      { day: "Zaterdag", open: "09:00", close: "17:00" },
      { day: "Zondag", closed: true },
    ],
    location: {
      address: brief.address ?? "Voorbeeldstraat 1",
      // Like the real generator: a postcode is verifiable — only from the brief.
      ...(brief.postcode ? { postcode: brief.postcode } : {}),
      city: brief.city,
      country: "Nederland",
    },
    booking: {
      provider: "treatwell",
      externalUrl: "https://www.treatwell.nl/salon/example",
      label: "Boek een afspraak",
    },
    contact: {
      email: `hallo@${slug}.nl`,
      instagram: brief.instagram ?? slug,
    },
    legal: { kvk: "12345678", btw: "NL000000000B01" },
    meta: { locale: brief.language === "en" ? "en-NL" : "nl-NL" },
  };
}
