"use client";

import { useI18n } from "@/i18n/provider";
import { LOCALES, LOCALE_COOKIE, type Locale } from "@/i18n/config";

const NAME: Record<Locale, string> = { en: "English", tr: "Türkçe" };

/** Saves the pick for a year, so a bare "/" lands on it next time. */
const remember = (l: Locale) => {
  document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
};

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
          onClick={() => remember(l)}
          className={l === lang ? "font-semibold text-paper" : "hover:text-paper"}
        >
          {NAME[l]}
        </a>
      ))}
    </span>
  );
}

/** A globe for the top bar. One tap switches to the other language, so there is no menu. */
export function LangGlobe() {
  const { lang, t } = useI18n();
  const next = LOCALES.find((l) => l !== lang) ?? lang;
  return (
    <a
      href={`/${next}`}
      lang={next}
      hrefLang={next}
      aria-label={`${t.footer.switchLabel}: ${NAME[next]}`}
      onClick={() => remember(next)}
      className="flex h-10 items-center gap-1.5 rounded-full border border-ink/25 px-3 text-[13px] font-semibold uppercase tracking-wide transition-colors hover:border-ink max-sm:h-9"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="9.25" />
        <ellipse cx="12" cy="12" rx="4" ry="9.25" />
        <path d="M3 9.5h18M3 14.5h18" />
      </svg>
      {next}
    </a>
  );
}
