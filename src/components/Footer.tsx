"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useSmoothProgress } from "@/lib/motion";

const WORD = Array.from("nimbo");

export function Footer() {
  const ref = useRef<HTMLElement>(null);
  const reduced = !!useReducedMotion();
  // The wordmark rises out of the floor, one letter after another, as the page runs out.
  const p = useSmoothProgress(ref, ["start end", "end end"], reduced);

  return (
    <footer
      ref={ref}
      className="overflow-hidden bg-ink px-[var(--pad)] pt-[clamp(48px,6vw,80px)] pb-9 text-paper"
    >
      <div
        aria-hidden
        className="display -ml-[0.05em] overflow-hidden pt-[0.1em] text-[clamp(60px,22vw,140px)] sm:text-[clamp(88px,24vw,560px)] leading-[0.8] tracking-[-0.06em] text-signal"
        style={{ fontWeight: 900 }}
      >
        {WORD.map((ch, i) => (
          <Letter key={i} p={p} i={i}>
            {ch}
          </Letter>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap justify-between gap-x-8 gap-y-4 text-[14px] text-paper/60">
        <span>© 2026 Nimbo. Showers, basins, taps and baths.</span>
        <div className="flex flex-wrap gap-x-7 gap-y-2">
          <a href="mailto:trade@nimbo.example" className="hover:text-paper">
            Trade programme
          </a>
          <a href="mailto:care@nimbo.example" className="hover:text-paper">
            Care and warranty
          </a>
          <a href="#top" className="hover:text-paper">
            Back to top
          </a>
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
  const y = useTransform(p, [i * 0.07, i * 0.07 + 0.55], ["110%", "0%"], {
    clamp: true,
    ease: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  });
  return (
    <motion.span className="inline-block" style={{ y }}>
      {children}
    </motion.span>
  );
}
