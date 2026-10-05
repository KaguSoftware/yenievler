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

/** Splits [text, is a number worth lighting up in signal] pairs into words, keeping the trailing space. */
const toWords = (copy: [string, boolean][]) =>
  copy.flatMap(([text, hl]) =>
    text
      .split(/(?<= )/)
      .filter(Boolean)
      .map((w): [string, boolean] => [w, hl]),
  );

export function TechSheet() {
  const ref = useRef<HTMLElement>(null);
  const reduced = !!useReducedMotion();
  const { t } = useI18n();
  const COPY = toWords(t.tech.copy);
  // Words light up in reading order as the paragraph crosses the middle of the screen.
  const p = useSmoothProgress(ref, ["start 0.85", "end 0.55"], reduced);
  const n = COPY.length;

  return (
    <section
      ref={ref}
      aria-label={t.tech.aria}
      data-station="tech"
      className="bg-gun px-[var(--pad)] pt-[clamp(40px,6vw,80px)] pb-[clamp(96px,13vw,200px)] text-paper world:bg-transparent"
    >
      <p className="wide max-w-[24ch] text-[clamp(23px,4.6vw,76px)] max-sm:leading-[1.1] leading-[1.04] font-bold tracking-[-0.03em] text-paper/90">
        {COPY.map(([w, hl], i) => (
          <Word key={i} p={p} from={i / n} to={(i + 1.6) / n} hl={hl}>
            {w}
          </Word>
        ))}
      </p>
    </section>
  );
}

function Word({
  p,
  from,
  to,
  hl,
  children,
}: {
  p: MotionValue<number>;
  from: number;
  to: number;
  hl: boolean;
  children: string;
}) {
  const opacity = useTransform(p, [from * 0.92, to * 0.92], [0.6, 1], {
    clamp: true,
  });
  return (
    <motion.span
      className={hl ? "font-extrabold text-signal" : undefined}
      style={{ opacity }}
    >
      {children}
    </motion.span>
  );
}
