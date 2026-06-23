import { nl } from "./nl";
import { en } from "./en";

export const locales = ["nl", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "nl";

const dicts: Record<Locale, Record<string, string>> = { nl, en };

export type TranslationKey = keyof typeof nl;

/** Returns a `t(key)` lookup bound to a locale, falling back to NL then the key. */
export function useTranslations(locale: Locale) {
  const dict = dicts[locale] ?? dicts[defaultLocale];
  return (key: TranslationKey): string => dict[key] ?? nl[key] ?? key;
}

/**
 * The language toggle. With real per-locale routes there is no JS swap — the
 * toggle is just a link to the counterpart URL. The site is a single page, so
 * the counterpart of `/` is `/en/` and vice-versa.
 */
export function otherLocale(locale: Locale): {
  href: string;
  label: string;
  hreflang: Locale;
} {
  return locale === "nl"
    ? { href: "/en/", label: "EN", hreflang: "en" }
    : { href: "/", label: "NL", hreflang: "nl" };
}
