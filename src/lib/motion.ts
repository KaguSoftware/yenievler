import { useEffect, useRef, type RefObject } from "react";
import {
  useMotionValueEvent,
  useScroll,
  useSpring,
  type MotionValue,
  type UseScrollOptions,
} from "framer-motion";

/** Same curve as --ease-out-expo in globals.css. Every transition on the site uses it: no bounce, no overshoot. */
export const EXPO = [0.16, 1, 0.3, 1] as const;
export const QUART = [0.25, 1, 0.5, 1] as const;

/** Spring damping ratio is above 1 (32 / (2 * sqrt(140)) = 1.35), so it settles without overshoot. */
export const SOFT_SPRING = {
  stiffness: 140,
  damping: 32,
  mass: 1,
  restDelta: 0.0002,
} as const;

/** Shared variants: a parent staggers its children into place. */
export const STAGGER = (gap = 0.09, delay = 0) => ({
  hidden: {},
  shown: { transition: { staggerChildren: gap, delayChildren: delay } },
});
export const RISE = (y = 40, duration = 1.1) => ({
  hidden: { opacity: 0, y },
  shown: { opacity: 1, y: 0, transition: { duration, ease: EXPO } },
});

/**
 * Scroll progress of an element, smoothed by a spring. With `reduced` it is pinned
 * to `rest` (the end state), so scroll-linked content is simply shown.
 */
export function useSmoothProgress(
  ref: RefObject<HTMLElement | null>,
  offset: NonNullable<UseScrollOptions["offset"]>,
  reduced = false,
  rest = 1,
): MotionValue<number> {
  const { scrollYProgress } = useScroll({ target: ref, offset });
  const p = useSpring(0, SOFT_SPRING);
  const seen = useRef(false);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (reduced) return;
    if (!seen.current) {
      // First reading can land mid-element (reload, anchor link): start there, don't scrub from 0.
      seen.current = true;
      p.jump(v);
    } else p.set(v);
  });
  useEffect(() => {
    p.jump(reduced ? rest : scrollYProgress.get());
  }, [reduced, rest, p, scrollYProgress]);
  return p;
}
