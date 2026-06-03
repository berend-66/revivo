import type { PlaceDetails } from "./places";
import type { InstagramLight } from "./instagram";

/**
 * Deterministic stand-ins for a real Google Place + Instagram profile. Two uses:
 *   1. `--dry-run` places mode and offline development before a Places key exists.
 *   2. A realistic end-to-end LLM test: this fixture → placeToBrief → real model
 *      → SiteConfig, exercising everything except the network calls.
 *
 * Shaped like a believable mid-market Utrecht salon: real-looking hours, reviews
 * with genuine voice, a 4.x rating. Distinct from the committed example configs.
 */
export const FIXTURE_PLACE: PlaceDetails = {
  placeId: "FIXTURE_ChIJ_kapsalon_mira_utrecht",
  name: "Kapsalon Mira",
  formattedAddress: "Twijnstraat 18, 3511 ZH Utrecht, Nederland",
  street: "Twijnstraat 18",
  postcode: "3511 ZH",
  city: "Utrecht",
  lat: 52.0851,
  lng: 5.1226,
  phone: "+31 30 234 5678",
  websiteUri: undefined,
  googleMapsUri: "https://maps.google.com/?cid=fixturemira",
  weekdayDescriptions: [
    "maandag: Gesloten",
    "dinsdag: 09:00–18:00",
    "woensdag: 09:00–18:00",
    "donderdag: 09:00–21:00",
    "vrijdag: 09:00–18:00",
    "zaterdag: 09:00–17:00",
    "zondag: Gesloten",
  ],
  rating: 4.8,
  userRatingCount: 213,
  primaryType: "hair_salon",
  primaryTypeDisplay: "Kapsalon",
  types: ["hair_salon", "hair_care", "point_of_interest", "establishment"],
  editorialSummary: undefined,
  reviews: [
    {
      author: "Sanne D.",
      rating: 5,
      text: "Al jaren mijn vaste salon. Mira en haar team nemen echt de tijd, luisteren goed en mijn balayage is elke keer precies goed. Je komt binnen voor een knipbeurt en gaat weg met een goed humeur.",
    },
    {
      author: "Joost K.",
      rating: 5,
      text: "Rustige, warme sfeer, geen gehaast. Eerlijk advies — ze praten je niet iets aan wat niet bij je past. Koffie is ook top.",
    },
    {
      author: "Fleur B.",
      rating: 4,
      text: "Mooie kleur en fijne mensen. Soms wat druk op zaterdag, dus boek op tijd. Kwaliteit blijft constant goed.",
    },
  ],
  photoNames: [
    "places/FIXTURE_ChIJ_kapsalon_mira_utrecht/photos/fixture-1",
    "places/FIXTURE_ChIJ_kapsalon_mira_utrecht/photos/fixture-2",
  ],
};

export const FIXTURE_INSTAGRAM: InstagramLight = {
  handle: "kapsalonmira",
  fullName: "Kapsalon Mira — Utrecht",
  bio: "Warme kapsalon in hartje Utrecht · specialisten in natuurlijke kleur & balayage · de tijd nemen voor jou",
  captions: [
    "Zachte, zonnige balayage voor Sanne ☀️ #utrechthair",
    "Nieuwe week, nieuwe kleur. Boeken kan via de link in bio.",
  ],
};
