"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useSmoothProgress } from "@/lib/motion";
import { useI18n } from "@/i18n/provider";
import { LangSwitch } from "./LangSwitch";

const LINES = ["yeni evler", "yapı"].map((l) => Array.from(l));

export function Footer() {
  const ref = useRef<HTMLElement>(null);
  const reduced = !!useReducedMotion();
  const { t } = useI18n();
  // The wordmark rises out of the floor, one letter after another, as the page runs out.
  const p = useSmoothProgress(ref, ["start end", "end end"], reduced);

  return (
    <footer
      ref={ref}
      data-station="foot"
      className="overflow-hidden bg-ink px-[var(--pad)] pt-[clamp(48px,6vw,80px)] pb-9 text-paper world:bg-transparent"
    >
      <div
        aria-hidden
        className="display -ml-[0.05em] overflow-hidden pt-[0.1em] whitespace-nowrap text-[clamp(36px,11.5vw,400px)] leading-[0.8] tracking-[-0.06em] text-signal"
        style={{ fontWeight: 900 }}
      >
        {LINES.map((line, li) => (
          <div key={li}>
            {line.map((ch, ci) => {
              const i = LINES.slice(0, li).reduce((n, l) => n + l.length, 0) + ci;
              return (
                <Letter key={ci} p={p} i={i}>
                  {ch === " " ? "\u00A0" : ch}
                </Letter>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap justify-between gap-x-8 gap-y-4 text-[14px] text-paper/80">
        <span>{t.footer.tagline}</span>
        <div className="flex flex-wrap gap-x-7 gap-y-2">
          <a href="mailto:trade@yenievleryapi.example" className="hover:text-paper">
            {t.footer.trade}
          </a>
          <a href="mailto:care@yenievleryapi.example" className="hover:text-paper">
            {t.footer.care}
          </a>
          <a href="#top" className="hover:text-paper">
            {t.footer.top}
          </a>
          <LangSwitch />
        </div>
      </div>
    </footer>
  );
}

function Letter({
  p,
  i,
  children,
}: {
  p: MotionValue<number>;
  i: number;
  children: string;
}) {
  const y = useTransform(p, [i * 0.03, i * 0.03 + 0.5], ["110%", "0%"], {
    clamp: true,
    ease: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  });
  return (
    <motion.span className="inline-block" style={{ y }}>
      {children}
    </motion.span>
  );
}
