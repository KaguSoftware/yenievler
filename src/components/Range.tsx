"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useScroll,
  useTransform,
} from "framer-motion";
import { Reveal } from "./Reveal";
import { EXPO, RISE, STAGGER } from "@/lib/motion";
import { useI18n } from "@/i18n/provider";

const U = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1000&q=75`;

/** Photos only; names, materials and descriptions come from the dictionary, in the same order. */
const IMGS = [
  [
    "1576678433413-202829a1ab98",
    "1652662700928-5a4685e87d64",
    "1643081262278-807976f7f2f7",
    "1561361398-d1f7b6cfee79",
  ],
  [
    "1595514535116-d0401260e7cf",
    "1644916925497-109cbd92087d",
    "1600488999585-e4364713b90a",
    "1576698483491-8c43f0862543",
  ],
  [
    "1619365566184-272a34acfeb9",
    "1542855368-ca6ea825bca2",
    "1495647688236-ed6ef40cb28b",
    "1637939157373-2198d933afdf",
  ],
  [
    "1620626011761-996317b8d101",
    "1586798271654-0471bb1b0517",
    "1733426107854-ee00a25d72a7",
    "1631889993959-41b4e9c6e3c5",
  ],
];

const ITEMS = STAGGER(0.06);
const ITEM = RISE(14, 0.7);

export function Range() {
  const { t, lang } = useI18n();
  const COLLECTIONS = t.range.collections.map((x, ci) => ({
    ...x,
    items: x.items.map((it, ii) => ({ ...it, img: IMGS[ci][ii] })),
  }));
  const [c, setC] = useState(0);
  const [i, setI] = useState(0);
  const col = COLLECTIONS[c];
  // The photo drifts slightly against the page as it scrolls past.
  const panel = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: panel,
    offset: ["start end", "end start"],
  });
  const drift = useTransform(scrollYProgress, [0, 1], ["-5%", "5%"]);

  return (
    <section
      id="range"
      data-station="range"
      className="bg-paper px-[var(--pad)] py-[clamp(80px,11vw,160px)] world:bg-transparent"
    >
      <Reveal>
        <h2 className="display max-w-[20ch] text-[clamp(44px,6.4vw,108px)] text-balance">
          {t.range.title}
        </h2>
      </Reveal>

      <div className="mt-[clamp(48px,7vw,104px)] grid gap-x-[clamp(32px,5vw,88px)] gap-y-10 lg:grid-cols-[1.05fr_1fr]">
        <div className="flex flex-col">
          <div
            role="tablist"
            aria-label={t.range.tabsLabel}
            className="flex flex-col"
          >
            {COLLECTIONS.map((x, idx) => (
              <Tab
                key={x.name}
                idx={idx}
                name={x.name}
                on={idx === c}
                pick={() => {
                  setC(idx);
                  setI(0);
                }}
                hoverPick={() => {
                  if (idx !== c) {
                    setC(idx);
                    setI(0);
                  }
                }}
              />
            ))}
          </div>
        </div>

        <div
          id="range-panel"
          role="tabpanel"
          aria-labelledby={`tab-${c}`}
          className="flex flex-col gap-8"
        >
          <div
            ref={panel}
            className="relative aspect-[5/4] overflow-hidden bg-mist-2"
          >
            <motion.div className="absolute -inset-[7%]" style={{ y: drift }}>
              <AnimatePresence initial={false}>
                <motion.div
                  key={c}
                  className="absolute inset-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.7, ease: EXPO }}
                >
                  {col.items.map((it, idx) => (
                    <motion.div
                      key={it.img}
                      className="absolute inset-0"
                      initial={false}
                      animate={{
                        opacity: idx === i ? 1 : 0,
                        scale: idx === i ? 1 : 1.06,
                      }}
                      transition={{ duration: 0.8, ease: EXPO }}
                    >
                      <Image
                        src={U(it.img)}
                        alt={`${it.name}, ${it.mat.toLocaleLowerCase(lang)}`}
                        fill
                        sizes="(min-width: 1024px) 45vw, 100vw"
                        priority={c === 0 && idx === 0}
                        className="object-cover"
                        style={{ filter: "saturate(0.9) contrast(1.04)" }}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </div>
          <motion.p
            key={c}
            className="max-w-[36ch] text-[19px] leading-[1.4] font-medium"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EXPO }}
          >
            {col.desc}
          </motion.p>
          <motion.ul
            key={`l${c}`}
            className="flex flex-col"
            variants={ITEMS}
            initial="hidden"
            animate="shown"
          >
            {col.items.map((it, idx) => (
              <motion.li
                key={it.name}
                variants={ITEM}
                className="border-t border-ink/15 last:border-b"
              >
                <button
                  type="button"
                  onMouseEnter={() => setI(idx)}
                  onFocus={() => setI(idx)}
                  onClick={() => setI(idx)}
                  className="flex w-full items-baseline justify-between gap-4 py-3.5 text-left text-[17px]"
                  style={{ fontWeight: idx === i ? 700 : 450 }}
                >
                  <span>{it.name}</span>
                  <span className="text-ink/72" style={{ fontWeight: 450 }}>
                    {it.mat}
                  </span>
                </button>
              </motion.li>
            ))}
          </motion.ul>
        </div>
      </div>
    </section>
  );
}

/** One big collection name. Hover state is local, so the nudge and the colour have explicit targets. */
function Tab({
  idx,
  name,
  on,
  pick,
  hoverPick,
}: {
  idx: number;
  name: string;
  on: boolean;
  pick: () => void;
  hoverPick: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <motion.button
      role="tab"
      id={`tab-${idx}`}
      aria-selected={on}
      aria-controls="range-panel"
      type="button"
      onClick={pick}
      onHoverStart={() => {
        setHov(true);
        hoverPick();
      }}
      onHoverEnd={() => setHov(false)}
      initial={{ opacity: 0, y: 56 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 1.2, ease: EXPO, delay: idx * 0.09 }}
      className="display flex items-baseline gap-5 border-t border-ink/15 py-[0.12em] text-left text-[clamp(40px,14vw,64px)] last:border-b sm:text-[clamp(64px,10vw,168px)]"
    >
      <span className="narrow num w-8 shrink-0 text-[15px] font-semibold tracking-normal text-ink/72">
        0{idx + 1}
      </span>
      <motion.span
        initial={false}
        animate={{
          x: hov ? 12 : 0,
          color: on ? "oklch(0.65 0.205 38)" : "oklch(0.19 0.015 45 / 0.92)",
        }}
        transition={{ duration: 0.5, ease: EXPO }}
      >
        {name}
      </motion.span>
    </motion.button>
  );
}
