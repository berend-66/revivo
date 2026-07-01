/**
 * One-off: create a lead + mockup for Leelawadee Health Massage (inbound lead).
 * Config hand-authored from leelawadee.nl + fresha.com listing — real data only.
 *
 *   pnpm tsx scripts/push-leelawadee.ts
 */
import dotenv from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
dotenv.config({ path: resolve(fileURLToPath(import.meta.url), "../../.env") });

import { createServiceClient, insertLeadIfNew, setLeadStatus, upsertMockupBySlug } from "@revivo/db";
import { SiteConfigSchema } from "@revivo/shared";
import type { SiteConfig } from "@revivo/shared";

const client = createServiceClient();

const config: SiteConfig = {
  slug: "leelawadee-health-massage",
  layout: "atelier",

  brand: {
    name: "Leelawadee Health Massage",
    tagline: "Touch the body, heal the mind & calm the spirit",
    logoUrl: "https://leelawadee.nl/wp-content/uploads/2019/05/leelawadee-middel-e1558710824729.png",
    colors: {
      primary: "#1d4e3a",
      accent:  "#c8a96e",
      ink:     "#1a1c19",
      surface: "#faf7f2",
    },
  },

  hero: {
    headline: "Herstel. Rust. Balans.",
    subheadline: "Traditionele Thaise massage in Amsterdam — al meer dan 18 jaar door gediplomeerde therapeuten.",
    images: [
      "https://leelawadee.nl/wp-content/uploads/2016/08/aroma-800x534.jpg",
      "https://leelawadee.nl/wp-content/uploads/2019/06/FE582287-0E5E-4F0B-B368-4DEB03CF53ED-800x565.jpeg",
      "https://leelawadee.nl/wp-content/uploads/2023/05/B4AC2A4D-AF5C-4DE6-A376-FBFA3676DA1C-400x300.jpeg",
    ],
    cta: {
      label: "Boek een behandeling",
      href: "https://www.fresha.com/nl/lvp/leelawadee-health-massage-van-heenvlietlaan-amsterdam-ovEwrx",
    },
  },

  about: {
    heading: "Professionele massage, precies zoals het hoort",
    body: [
      "Leelawadee opende haar deuren in 2006 met één doel: echte, therapeutische massage beschikbaar maken voor iedereen in Amsterdam. Geen franje — alleen vakkundige behandelingen door gediplomeerde therapeuten.",
      "Onze specialiteit is de traditionele Thaise massage: een eeuwenoude methode die werkt op spieren, gewrichten én energiebanen. Warme oliën, traditionele Thaise balsems en verwarmde massagetafels zorgen voor een omgeving waarin je écht tot rust komt.",
      "Wij verwelkomen mannen, vrouwen en koppels, en bieden uitsluitend professionele gezondheidsmassages aan.",
    ],
    portrait: "https://images.unsplash.com/photo-1639162906614-0603b0ae95fd?w=800&q=80&fit=crop",
    stats: [
      { label: "Jaar ervaring", value: "18+" },
      { label: "Dagen per week open", value: "7" },
      { label: "Open tot", value: "22:00" },
    ],
  },

  services: [
    {
      category: "Massages",
      items: [
        {
          name: "Traditionele Thaise Massage",
          description: "Druk- en stretchtechnieken op spieren, gewrichten én energiebanen.",
          price: 70,
          durationMin: 60,
        },
        {
          name: "Traditionele Thaise Massage",
          description: "Uitgebreide sessie voor volledig herstel.",
          price: 95,
          durationMin: 90,
        },
        {
          name: "Aromamassage",
          description: "Ontspannende massage met warme aromatische oliën.",
          price: 70,
          durationMin: 60,
        },
        {
          name: "Aromamassage",
          description: "Uitgebreide aromamassage voor diepe ontspanning.",
          price: 95,
          durationMin: 90,
        },
        {
          name: "Voetmassage",
          description: "Reflexologie en drukpuntmassage op voeten en onderbenen.",
          price: 70,
          durationMin: 60,
        },
        {
          name: "Voet, Nek & Schouder",
          description: "Gecombineerde behandeling van voeten, nek en schouders.",
          price: 95,
          durationMin: 90,
        },
        {
          name: "Nek & Schouder Massage",
          description: "Gerichte behandeling voor spanning in nek en schouders.",
          price: 45,
          durationMin: 30,
        },
        {
          name: "Duo Massage",
          description: "Samen genieten — twee behandelingen tegelijkertijd.",
          price: null,
        },
      ],
    },
  ],

  gallery: [
    { url: "https://leelawadee.nl/wp-content/uploads/2023/05/B4AC2A4D-AF5C-4DE6-A376-FBFA3676DA1C-400x300.jpeg", aspect: "landscape" },
    { url: "https://leelawadee.nl/wp-content/uploads/2023/05/BE062EC5-AAF2-4C61-B9ED-14A35ECD57C0-400x865.jpeg", aspect: "portrait" },
    { url: "https://leelawadee.nl/wp-content/uploads/2023/05/3D145FE3-A1CC-44C9-9FF6-7D0159BE75B6-400x300.jpeg", aspect: "landscape" },
    { url: "https://leelawadee.nl/wp-content/uploads/2023/05/2D11A84A-6729-4CBF-B225-E7C6F9D5573B-400x518.jpeg", aspect: "portrait" },
    { url: "https://leelawadee.nl/wp-content/uploads/2016/08/aroma-800x534.jpg",                               aspect: "landscape" },
    { url: "https://leelawadee.nl/wp-content/uploads/2019/06/FE582287-0E5E-4F0B-B368-4DEB03CF53ED-800x565.jpeg", aspect: "landscape" },
    { url: "https://leelawadee.nl/wp-content/uploads/2016/08/leelawadee-nek-massage-800x534.jpg",              aspect: "landscape" },
    { url: "https://leelawadee.nl/wp-content/uploads/2016/08/leelawadee-duo-massage-800x531.jpg",              aspect: "landscape" },
  ],

  hours: [
    { day: "Maandag",   open: "10:00", close: "22:00" },
    { day: "Dinsdag",   open: "10:00", close: "22:00" },
    { day: "Woensdag",  open: "10:00", close: "22:00" },
    { day: "Donderdag", open: "10:00", close: "22:00" },
    { day: "Vrijdag",   open: "10:00", close: "22:00" },
    { day: "Zaterdag",  open: "10:00", close: "22:00" },
    { day: "Zondag",    open: "10:00", close: "22:00" },
  ],

  location: {
    address:  "Van Heenvlietlaan 9",
    postcode: "1083 CK",
    city:     "Amsterdam",
    country:  "Nederland",
  },

  booking: {
    provider:    "custom",
    externalUrl: "https://www.fresha.com/nl/lvp/leelawadee-health-massage-van-heenvlietlaan-amsterdam-ovEwrx",
    label:       "Boek via Fresha",
  },

  team: [
    {
      name: "Ons team",
      role: "Zes ervaren therapeuten",
      specialty: "Al meer dan 18 jaar bieden wij vakkundige traditionele Thaise massage door gediplomeerde therapeuten — zeven dagen per week.",
      photoUrl: "https://leelawadee.nl/wp-content/uploads/2021/04/03CEB067-D22C-4EFC-A73D-2B315BC54388-400x300.jpeg",
    },
  ],

  contact: {
    phone: "+31207723889",
  },

  meta: {
    title:       "Leelawadee Health Massage Amsterdam",
    description: "Traditionele Thaise massage in Amsterdam Buitenveldert. Gediplomeerde therapeuten, 7 dagen open, 10:00–22:00.",
    locale:      "nl-NL",
  },
};

// Validate before pushing — catch schema drift early.
const parsed = SiteConfigSchema.safeParse(config);
if (!parsed.success) {
  console.error("✗ SiteConfig valideert niet:");
  console.error(parsed.error.flatten());
  process.exit(1);
}

// Lead: use the Fresha listing URL as dedup key (source=marketplace).
const { lead, inserted } = await insertLeadIfNew(client, {
  source:     "marketplace",
  listingUrl: "https://www.fresha.com/nl/lvp/leelawadee-health-massage-van-heenvlietlaan-amsterdam-ovEwrx",
  name:       "Leelawadee Health Massage",
  city:       "Amsterdam",
  postcode:   "1083 CK",
});
console.log(`${inserted ? "✓ Lead aangemaakt" : "↻ Lead al aanwezig"} — id: ${lead.id}`);

// Mockup upsert.
const mockup = await upsertMockupBySlug(client, {
  slug:   parsed.data.slug,
  config: parsed.data,
  source: "manual",
  leadId: lead.id,
  model:  "hand-authored",
});
console.log(`✓ Mockup upsert — slug: ${mockup.slug}`);

// Advance lead status to mockup_generated, record has_website = true.
await setLeadStatus(client, lead.id, "mockup_generated", {
  listingFacts: {
    sourceUrl:  "https://www.fresha.com/nl/lvp/leelawadee-health-massage-van-heenvlietlaan-amsterdam-ovEwrx",
    name:       "Leelawadee Health Massage",
    phone:      "+31207723889",
    address:    "Van Heenvlietlaan 9",
    city:       "Amsterdam",
    postcode:   "1083 CK",
    websiteUrl: "https://leelawadee.nl",
    bookingUrl: "https://www.fresha.com/nl/lvp/leelawadee-health-massage-van-heenvlietlaan-amsterdam-ovEwrx",
  },
});
console.log(`✓ Lead status → mockup_generated  (has_website: true)`);

const base = (process.env.REVIVO_MOCK_BASE_URL ?? "https://revivo-mockups-nelson.vercel.app").replace(/\/$/, "");
console.log(`\n🔗 Mockup URL: ${base}/${mockup.slug}`);
