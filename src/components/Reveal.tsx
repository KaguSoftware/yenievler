"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { EXPO } from "@/lib/motion";

export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  /** Milliseconds. */
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.9, ease: EXPO, delay: delay / 1000 }}
    >
      {children}
    </motion.div>
  );
}
