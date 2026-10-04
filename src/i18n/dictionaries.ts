import type { Locale } from "./config";
import type { Dict } from "./en";

const dictionaries: Record<Locale, () => Promise<Dict>> = {
  en: () => import("./en").then((m) => m.default),
  tr: () => import("./tr").then((m) => m.default),
};

export const getDictionary = (lang: Locale) => dictionaries[lang]();
