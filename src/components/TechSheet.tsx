"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useSmoothProgress } from "@/lib/motion";

/** [text, is a number worth lighting up in signal] */
const COPY: [string, boolean][] = (
  [
    ["7.6 litres", true],
    [
      " a minute, half the water of a standard head, and it feels heavier. Hot stays hot to within ",
      false,
    ],
    ["0.5 °C", true],
    [
      ", even when someone opens a tap downstairs. Every brass body and ceramic cartridge is guaranteed for ",
      false,
    ],
    ["25 years", true],
    [".", false],
  ] as [string, boolean][]
).flatMap(([text, hl]) =>
  text
    .split(/(?<= )/)
    .filter(Boolean)
    .map((w): [string, boolean] => [w, hl]),
);

export function TechSheet() {
  const ref = useRef<HTMLElement>(null);
  const reduced = !!useReducedMotion();
  // Words light up in reading order as the paragraph crosses the middle of the screen.
  const p = useSmoothProgress(ref, ["start 0.85", "end 0.55"], reduced);
  const n = COPY.length;

  return (
    <section
      ref={ref}
      aria-label="Performance"
      data-station="tech"
      className="bg-gun px-[var(--pad)] pt-[clamp(40px,6vw,80px)] pb-[clamp(96px,13vw,200px)] text-paper world:bg-transparent"
    >
      <p className="wide max-w-[24ch] text-[clamp(30px,4.6vw,76px)] leading-[1.04] font-bold tracking-[-0.03em] text-paper/90">
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
