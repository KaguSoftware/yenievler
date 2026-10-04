"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Reveal } from "./Reveal";
import { EXPO } from "@/lib/motion";
import { useI18n } from "@/i18n/provider";

const IN = { once: true, amount: 0.4 } as const;

type Room = { city: string; where: string; hours: string };

export function Showrooms() {
  const { t } = useI18n();
  const ROOMS = t.showrooms.rooms;
  return (
    <section
      id="showrooms"
      data-station="rooms"
      className="bg-signal px-[var(--pad)] py-[clamp(80px,11vw,160px)] text-ink-deep world:bg-transparent"
    >
      <Reveal className="flex flex-wrap items-end justify-between gap-x-12 gap-y-6">
        <h2 className="display text-[clamp(40px,14vw,56px)] text-paper sm:text-[clamp(56px,9vw,152px)]">
          {t.showrooms.title}
        </h2>
        <p className="max-w-[30ch] text-[18px] leading-[1.4] font-medium">
          {t.showrooms.lede}
        </p>
      </Reveal>

      <ul className="relative mt-[clamp(40px,6vw,88px)]">
        <motion.span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[2px] origin-left bg-ink"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={IN}
          transition={{ duration: 1.3, ease: EXPO }}
        />
        {ROOMS.map((r, i) => (
          <Row key={r.city} room={r} i={i} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Hover state lives in React and every layer animates from it, so each element
 * has an explicit target. (A motion element with whileHover="label" stops
 * inheriting its parent's entrance labels, which is how a fill gets stuck open.)
 */
function Row({ room: r, i }: { room: Room; i: number }) {
  const { t: copy } = useI18n();
  const [hov, setHov] = useState(false);
  const t = { duration: 0.5, ease: EXPO };
  return (
    <li className="relative">
      <motion.a
        href={`mailto:visit@yenievleryapi.example?subject=${copy.showrooms.bookSubject}`}
        onHoverStart={() => setHov(true)}
        onHoverEnd={() => setHov(false)}
        onFocus={() => setHov(true)}
        onBlur={() => setHov(false)}
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={IN}
        transition={{ duration: 1, ease: EXPO, delay: 0.1 + i * 0.12 }}
        className={`relative isolate -mx-[var(--pad)] grid items-baseline gap-x-8 gap-y-1 px-[var(--pad)] py-5 transition-colors duration-300 ease-out lg:grid-cols-[minmax(max-content,2.2fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_auto] ${hov ? "text-paper" : ""}`}
      >
        <motion.span
          aria-hidden
          className="absolute inset-0 -z-10 origin-bottom bg-ink"
          initial={false}
          animate={{ scaleY: hov ? 1 : 0 }}
          transition={t}
        />
        <motion.span
          className="display text-[clamp(32px,10.5vw,44px)] sm:text-[clamp(44px,8vw,64px)] lg:text-[clamp(44px,5.4vw,88px)]"
          initial={false}
          animate={{ x: hov ? 12 : 0 }}
          transition={t}
        >
          {r.city}
        </motion.span>
        <span className="text-[17px] font-medium">{r.where}</span>
        <span className="num text-[17px] font-medium">{r.hours}</span>
        <span className="text-[17px] font-bold lg:text-right">
          {copy.showrooms.book}{" "}
          <motion.span
            className="inline-block"
            initial={false}
            animate={{ x: hov ? 6 : 0 }}
            transition={t}
          >
            →
          </motion.span>
        </span>
      </motion.a>
      <motion.span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-ink"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={IN}
        transition={{ duration: 1.3, ease: EXPO, delay: 0.2 + i * 0.12 }}
      />
    </li>
  );
}
