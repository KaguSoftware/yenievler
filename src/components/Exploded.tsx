"use client";

import { Reveal } from "./Reveal";
import { useI18n } from "@/i18n/provider";

/**
 * Captions for the dive. The head itself is in the shared world: world.ts pulls it apart as this
 * section scrolls, places the labels on the parts, and then drops the camera through them.
 */
export function Exploded() {
  const { t } = useI18n();
  const PARTS = t.exploded.parts.map((p, i) => ({ ...p, n: String(i + 1).padStart(2, "0") }));
  return (
    <section
      id="inside"
      data-station="inside"
      aria-label={t.exploded.aria}
      className="relative bg-gun text-paper world:h-[440vh] world:bg-transparent motion-reduce:world:h-[100svh]"
    >
      <div className="noworld:static noworld:h-auto noworld:min-h-0 noworld:overflow-visible noworld:px-[var(--pad)] noworld:py-[clamp(64px,9vw,120px)] sticky top-0 h-[100svh] min-h-[620px] overflow-hidden">
        <div data-world-caption="" className="noworld:static noworld:opacity-100">
          <Reveal className="pointer-events-none absolute top-[clamp(28px,6vh,64px)] left-[var(--pad)] max-w-[min(100%,720px)] noworld:static">
            <h2 className="display text-[clamp(40px,5.4vw,92px)]">
              {t.exploded.titleA} <span className="text-signal">{t.exploded.titleB}</span>
            </h2>
            <p className="mt-4 max-w-[26ch] text-[17px] leading-[1.4] text-paper/75">
              {t.exploded.lede}
            </p>
          </Reveal>
        </div>
        <div
          data-world-labels=""
          className="noworld:static noworld:mt-12 noworld:grid noworld:gap-8 noworld:sm:grid-cols-2 pointer-events-none absolute inset-0"
        >
          {PARTS.map((p) => (
            <div
              key={p.n}
              data-part=""
              className="noworld:relative noworld:opacity-100 absolute top-0 left-0 flex items-center opacity-0 will-change-[transform,opacity]"
            >
              <div className="noworld:hidden compact:hidden -ml-[3px] size-[7px] flex-none rounded-full bg-signal shadow-[0_0_0_4px_oklch(0.65_0.205_38/0.22)]" />
              <div
                data-line=""
                className="noworld:hidden compact:hidden h-px w-[120px] flex-none bg-paper/50"
              />
              <div className="compact:w-auto compact:pl-0 noworld:pl-0 flex w-[290px] flex-col gap-1.5 pl-3 sm:pl-4">
                <div className="compact:rounded-[3px] compact:bg-signal compact:px-2 compact:py-[5px] compact:text-ink-deep compact:shadow-[0_4px_12px_oklch(0.19_0.015_45/0.45)] flex items-baseline gap-3 compact:gap-1.5">
                  <span className="narrow num compact:text-ink-deep compact:text-[11px] text-[14px] font-semibold text-[oklch(0.74_0.15_42)]">{p.n}</span>
                  <span className="wide whitespace-nowrap text-[16px] leading-none font-bold tracking-[-0.02em] compact:text-[13px] sm:text-[22px]">{p.title}</span>
                </div>
                <span data-body="" className="compact:hidden text-[14px] leading-[1.45] text-paper/75">
                  {p.body}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div
          aria-hidden
          data-world-caption=""
          className="noworld:hidden absolute right-[var(--pad)] bottom-8 left-[var(--pad)] flex items-center gap-4 text-[12px] font-semibold tracking-[0.06em] text-paper/60 uppercase"
        >
          <span>{t.exploded.assembled}</span>
          <div className="h-px flex-1 overflow-hidden bg-paper/15">
            <div
              data-world-bar=""
              className="h-full origin-left bg-signal"
              style={{ transform: "scaleX(0)" }}
            />
          </div>
          <span>{t.exploded.exploded}</span>
        </div>
      </div>
    </section>
  );
}
