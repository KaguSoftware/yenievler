export const LOCALES = ["en", "tr"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "tr";

export const hasLocale = (value: string): value is Locale =>
  (LOCALES as readonly string[]).includes(value);

/** Set when a visitor picks a language, so a bare "/" returns them to it. */
export const LOCALE_COOKIE = "locale";

/** The saved choice if there is one, otherwise Turkish. Browser language is deliberately not consulted. */
export const pickLocale = (saved: string | undefined): Locale =>
  saved && hasLocale(saved) ? saved : DEFAULT_LOCALE;
