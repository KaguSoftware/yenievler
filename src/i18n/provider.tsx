"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "./config";
import en, { type Dict } from "./en";

const Ctx = createContext<{ lang: Locale; t: Dict }>({ lang: "en", t: en });

export function I18nProvider({ lang, dict, children }: { lang: Locale; dict: Dict; children: ReactNode }) {
  return <Ctx.Provider value={{ lang, t: dict }}>{children}</Ctx.Provider>;
}

/** Without a provider this is English, so the page still renders. `t` is the whole dictionary for the current locale; `lang` drives number formatting and case. */
export function useI18n() {
  return useContext(Ctx);
}

/** Fills {name} placeholders. */
export const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
