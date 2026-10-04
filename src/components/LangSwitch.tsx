"use client";

import { useI18n } from "@/i18n/provider";
import { LOCALES, type Locale } from "@/i18n/config";

const NAME: Record<Locale, string> = { en: "English", tr: "Türkçe" };

/** Plain links: the language lives in the URL, so a switch is a normal navigation. */
export function LangSwitch() {
  const { lang, t } = useI18n();
  return (
    <span className="flex gap-3" role="group" aria-label={t.footer.switchLabel}>
      {LOCALES.map((l) => (
        <a
          key={l}
          href={`/${l}`}
          lang={l}
          hrefLang={l}
          aria-current={l === lang ? "true" : undefined}
          className={l === lang ? "font-semibold text-paper" : "hover:text-paper"}
        >
          {NAME[l]}
        </a>
      ))}
    </span>
  );
}
