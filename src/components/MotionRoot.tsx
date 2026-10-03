"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/** One place that decides how the whole site moves: transforms switch off under prefers-reduced-motion. */
export function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
