/**
 * One-off: upsert the Leeleewadee Massage lotus-variant mockup.
 * Uses HR photos uploaded to Supabase Storage (bucket: salon-photos).
 *
 *   pnpm tsx scripts/push-leelawadee-lotus.ts
 */
import dotenv from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
dotenv.config({ path: resolve(fileURLToPath(import.meta.url), "../../.env") });

import { createServiceClient, insertLeadIfNew, setLeadStatus, upsertMockupBySlug } from "@revivo/db";
import { SiteConfigSchema } from "@revivo/shared";
import type { SiteConfig } from "@revivo/shared";

const BASE = "https://qznrutduzadnuamzcpsz.supabase.co/storage/v1/object/public/salon-photos/leelawadee";
const client = createServiceClient();

const config: SiteConfig = {
  slug:   "leeleewadee-massage",
  layout: "lotus",

  brand: {
    name:    "Leeleewadee Massage",
    tagline: "Authentieke Thaise massage in Amsterdam",
    logoUrl: "https://leelawadee.nl/wp-content/uploads/2019/05/leelawadee-middel-e1558710824729.png",
    colors: {
      primary: "#1d4e3a",
      accent:  "#c8923a",
      ink:     "#1a1109",
      surface: "#ede4cd",
    },
  },

  reputation: {
    rating:      4.7,
    reviewCount: 500,
    source:      "Google",
  },

  hero: {
    headline:    "Authentieke Thaise Massage in Amsterdam",
    subheadline: "Al bijna 20 jaar de specialist in traditionele Thaise massages voor ontspanning, herstel en pijnverlichting.",
    images: [`${BASE}/MMK-4368-HR.jpeg`],
    cta: {
      label: "Boek Direct",
      href:  "https://www.fresha.com/nl/lvp/leelawadee-health-massage-van-heenvlietlaan-amsterdam-ovEwrx",
    },
  },

  about: {
    heading: "Ontspanning voor lichaam en geest",
    body: [
      "In het hart van Amsterdam biedt Leelawadee al bijna 20 jaar een rustplaats in de stad — een plek waar u de drukte achter u laat en voelt wat een echte, authentieke Thaise massage doet.",
      "Onze gediplomeerde therapeuten combineren eeuwenoude Thaise technieken met moderne kennis van het menselijk lichaam. Elke behandeling is gericht op uw persoonlijke behoeften — of dat nu ontspanning, herstel of pijnverlichting is.",
      "Wij verwelkomen mannen, vrouwen en koppels, zeven dagen per week van 10:00 tot 22:00.",
    ],
    portrait: `${BASE}/MMK-4449-HR.jpeg`,
    stats: [
      { label: "Jaar ervaring",  value: "20+"  },
      { label: "Therapeuten",    value: "5"    },
      { label: "Open tot",       value: "22:00"},
    ],
  },

  services: [
    {
      category: "Massages",
      items: [
        {
          name:        "Traditionele Thaise Massage",
          description: "Eeuwenoude druk- en stretchtechnieken op spieren, gewrichten en energiebanen — de essentie van de Thaise massage.",
          price:       60,
          from:        true,
          durationMin: 60,
        },
        {
          name:        "Aroma Massage",
          description: "Ontspannende massage met warme aromatische oliën voor diepe ontspanning van lichaam en geest.",
          price:       65,
          from:        true,
          durationMin: 60,
        },
        {
          name:        "Voetmassage",
          description: "Reflexologie en drukpuntmassage op voeten en onderbenen — ideaal na een drukke dag in de stad.",
          price:       35,
          from:        true,
          durationMin: 45,
        },
        {
          name:        "Duo Massage",
          description: "Samen genieten van een Thaise massage — twee behandelingen tegelijkertijd in onze duo-kamer.",
          price:       110,
          from:        true,
          durationMin: 60,
        },
        {
          name:        "Deep Tissue Massage",
          description: "Diepe massagetechnieken gericht op chronische spierspanning en herstel na sportief gebruik.",
          price:       65,
          from:        true,
          durationMin: 60,
        },
        {
          name:        "Hot Stone Massage",
          description: "Verwarmde vulkanische stenen in combinatie met therapeutische massagetechnieken voor ultieme ontspanning.",
          price:       70,
          from:        true,
          durationMin: 60,
        },
      ],
    },
  ],

  // First 6 slots map to service card photos (Traditional Thai, Aroma, Voet, Duo, Deep Tissue, Hot Stone)
  gallery: [
    { url: `${BASE}/MMK-4395-HR.jpeg`, aspect: "landscape" },
    { url: `${BASE}/MMK-4467-HR.jpeg`, aspect: "landscape" },
    { url: `${BASE}/MMK-4473-HR.jpeg`, aspect: "landscape" },
    { url: `${BASE}/MMK-4420-HR.jpeg`, aspect: "landscape" },
    { url: `${BASE}/MMK-4411-HR.jpeg`, aspect: "landscape" },
    { url: `${BASE}/MMK-4501-HR.jpeg`, aspect: "landscape" },
    { url: `${BASE}/MMK-4378-HR.jpeg`, aspect: "landscape" },
    { url: `${BASE}/MMK-4492-HR.jpeg`, aspect: "square"    },
    { url: `${BASE}/MMK-4540-HR.jpeg`, aspect: "square"    },
    { url: `${BASE}/MMK-4562-HR.jpeg`, aspect: "portrait"  },
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
    label:       "Boek Direct",
  },

  team: [
    { name: "Nok", role: "Therapeute", specialty: "18 jaar ervaring, specialist traditionele Thaise massage" },
    { name: "Pim", role: "Therapeute", specialty: "14 jaar ervaring, specialist aromamassage"                },
    { name: "Fon", role: "Therapeute", specialty: "12 jaar ervaring in traditionele Thaise massage"          },
    { name: "Nam", role: "Therapeute", specialty: "10 jaar ervaring, specialist deep tissue massage"         },
    { name: "Ple", role: "Therapeute", specialty: "8 jaar ervaring, specialist hot stone massage"            },
  ],

  testimonials: [
    {
      author: "Patrick",
      quote:  "Werkelijk een geweldige ervaring. Ik kom hier al jaren en de kwaliteit is altijd hoog. De traditionele Thaise massage is hier op zijn best.",
      rating: 5,
      source: "Google",
    },
    {
      author: "Marloes",
      quote:  "Heerlijke massage in een prachtige omgeving. Eindelijk een salon die serieus aandacht besteedt aan de traditionele Thaise technieken — absoluut aanrader.",
      rating: 5,
      source: "Google",
    },
    {
      author: "Dennis",
      quote:  "Beste Thaise massage in Amsterdam. Al drie jaar vaste klant — de aroma massage is elke keer weer een feest voor lichaam en geest.",
      rating: 5,
      source: "Google",
    },
  ],

  contact: { phone: "+31207723889" },

  meta: {
    title:       "Leeleewadee Massage Amsterdam",
    description: "Authentieke Thaise massage in Amsterdam. Al bijna 20 jaar gediplomeerde therapeuten, 7 dagen open, 10:00–22:00.",
    locale:      "nl-NL",
  },
};

const parsed = SiteConfigSchema.safeParse(config);
if (!parsed.success) {
  console.error("✗ SiteConfig valideert niet:");
  console.error(parsed.error.flatten());
  process.exit(1);
}

const { lead, inserted } = await insertLeadIfNew(client, {
  source:     "marketplace",
  listingUrl: "https://www.fresha.com/nl/lvp/leelawadee-health-massage-van-heenvlietlaan-amsterdam-ovEwrx",
  name:       "Leelawadee Health Massage",
  city:       "Amsterdam",
  postcode:   "1083 CK",
});
console.log(`${inserted ? "✓ Lead aangemaakt" : "↻ Lead al aanwezig"} — id: ${lead.id}`);

const mockup = await upsertMockupBySlug(client, {
  slug:   parsed.data.slug,
  config: parsed.data,
  source: "manual",
  leadId: lead.id,
  model:  "hand-authored",
});
console.log(`✓ Mockup upsert — slug: ${mockup.slug}`);

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
console.log("✓ Lead status → mockup_generated");

const base = (process.env.REVIVO_MOCK_BASE_URL ?? "https://revivo-mockups-nelson.vercel.app").replace(/\/$/, "");
console.log(`\n🔗 Mockup URL: ${base}/${mockup.slug}`);
