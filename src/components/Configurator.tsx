"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FINISHES, STONES } from "@/lib/three/stone";
import { ui } from "@/lib/three/state";
import { useI18n } from "@/i18n/provider";
import { useStage } from "@/lib/useStage";

export function Configurator() {
  const { t } = useI18n();
  const c = t.configurator;
  const fmt = (n: number) => "€ " + n.toLocaleString(t.numberLocale);
  const [stone, setStone] = useState(0);
  const [finish, setFinish] = useState(0);
  const [water, setWater] = useState(true);

  // The world reads the picks straight from here; the basin updates without a render.
  useEffect(() => {
    ui.stone = stone;
    ui.finish = finish;
    ui.water = water;
  }, [stone, finish, water]);

  // Phones: a sticky stage (useStage). The basin keeps a band at the top of the screen while the
  // pickers ride up beneath it, so every pick is seen on the basin, and the overflow starts from a
  // basin that is still in shot. Half a screen of scroll follows the ride, for the camera to let go in.
  const { track, stage, band, tail, y: paneY, fade: fadeO } = useStage(0.5);

  const st = STONES[stone];
  const fi = FINISHES[finish];
  return (
    <section
      ref={track}
      id="basin"
      data-station="cfg"
      aria-label={c.aria}
      className="grid border-y border-ink/10 bg-mist world:bg-transparent world:lg:grid-cols-[minmax(0,1.7fr)_minmax(380px,1fr)] noworld:lg:grid-cols-[minmax(0,1fr)] side:grid-cols-[minmax(0,1.15fr)_minmax(300px,1fr)] stage:block stage:border-y-0 stage:[--stage:1]"
    >
      {/* Desktop: no box, its children are the grid's. Phones: the sticky stage, one screen tall. */}
      <div ref={stage} className="contents stage:sticky stage:top-0 stage:flex stage:h-lvh stage:flex-col stage:[&_:is(a,button,input)]:scroll-mt-[calc(40lvh+40px)]">
      {/* The basin is drawn by the shared canvas, centred on this window (data-world-pin). */}
      <div
        ref={band}
        className="noworld:hidden relative min-h-[min(86vh,820px)] min-w-0 max-lg:min-h-[min(56svh,480px)] motion-reduce:stack:h-[40lvh]! motion-reduce:stack:min-h-0! side:sticky side:top-0 side:h-lvh side:min-h-0 side:self-start stage:h-[40lvh] stage:min-h-0 stage:shrink-0"
      >
        <div data-world-pin="" className="pointer-events-none absolute inset-0" />
        <p className="pointer-events-none absolute top-7 left-[var(--pad)] rounded-full bg-paper/85 px-3 py-1 text-[12px] font-semibold sm:text-[14px] text-ink">
          {c.orbit}
        </p>
        <button
          type="button"
          data-live=""
          aria-pressed={water}
          onClick={() => setWater((w) => !w)}
          className="absolute bottom-7 left-[var(--pad)] flex items-center gap-2.5 rounded-full border border-ink/25 bg-paper/80 px-3.5 py-2 text-[12px] font-semibold sm:px-[18px] sm:py-2.5 sm:text-[14px] transition-colors duration-200 hover:border-ink"
        >
          <span
            className="size-2 rounded-full"
            style={{ background: water ? "var(--color-signal)" : "oklch(0.6 0.01 250)" }}
          />
          {water ? c.waterOn : c.waterOff}
        </button>
      </div>

      {/* Phones: what is left of the screen under the band; the panel rides up through it. */}
      <div className="contents stage:relative stage:block stage:min-h-0 stage:flex-1 stage:[clip-path:inset(0)]">
      <motion.div
        aria-hidden
        style={{ opacity: fadeO }}
        className="pointer-events-none absolute inset-x-0 top-0 z-10 hidden h-7 bg-[linear-gradient(to_bottom,var(--bg),transparent)] stage:block"
      />
      <motion.div
        ref={tail}
        data-live=""
        style={{ y: paneY }}
        className="world:bg-mist flex flex-col gap-6 sm:gap-7 border-ink/10 px-[var(--pad)] py-[clamp(32px,4vw,56px)] lg:border-l noworld:lg:border-l-0 side:border-l stage:border-l-0 stage:will-change-transform stage:[mask-image:linear-gradient(to_bottom,black_calc(100%-36px),transparent)]"
      >
        <div className="flex flex-col gap-3.5">
          <h2 className="display text-[clamp(34px,4.4vw,72px)]">{c.title}</h2>
          <p className="max-w-[34ch] text-[15px] leading-[1.45] sm:text-[17px]">
            {c.lede}
          </p>
        </div>

        <Picker
          label={c.stone}
          value={c.stones[stone]}
          names={c.stones}
          items={STONES}
          active={stone}
          onPick={setStone}
        />
        <Picker
          label={c.metal}
          value={c.finishes[finish]}
          names={c.finishes}
          items={FINISHES}
          active={finish}
          onPick={setFinish}
        />

        <dl className="flex flex-col border-t border-ink/15 text-[14px] sm:text-[15px]">
          {[
            [c.specBasin, c.valBasin],
            [c.specWeight, stone === 2 ? c.valWeightLight : c.valWeightHeavy],
            [c.specSpout, c.valSpout],
            [c.specFlow, c.valFlow],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-ink/15 py-2 sm:py-2.5">
              <dt className="text-ink/65">{k}</dt>
              <dd className="num font-semibold">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[14px] font-semibold text-ink/65">{c.from}</p>
            <p className="display num text-[clamp(36px,4.4vw,64px)]" aria-live="polite">
              {fmt(st.price + fi.price)}
            </p>
          </div>
          <a
            href="#showrooms"
            className="rounded-full bg-signal px-7 py-4 text-[16px] font-bold max-sm:px-5 max-sm:py-3 max-sm:text-[15px] text-ink transition-transform duration-300 ease-[var(--ease-out-quart)] hover:-translate-y-0.5"
          >
            {t.common.requestQuote}
          </a>
        </div>
      </motion.div>
      </div>
      </div>

      {/* Phones: the scroll the panel needs to pass under the band while the stage holds. */}
      <div aria-hidden className="hidden stage:block stage:h-[var(--stage-run,120lvh)]" />
    </section>
  );
}

function Picker({
  label,
  value,
  names,
  items,
  active,
  onPick,
}: {
  label: string;
  value: string;
  names: string[];
  items: { name: string; swatch: string }[];
  active: number;
  onPick: (i: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between text-[15px]">
        <span className="font-semibold">{label}</span>
        <span className="text-ink/70">{value}</span>
      </div>
      <div className="grid max-w-[400px] grid-cols-4 gap-2.5 max-sm:flex max-sm:flex-wrap" role="radiogroup" aria-label={label}>
        {items.map((s, i) => (
          <button
            key={s.name}
            type="button"
            role="radio"
            aria-checked={i === active}
            aria-label={names[i]}
            onClick={() => onPick(i)}
            className="aspect-square rounded-full border-2 bg-transparent p-1 transition-colors duration-200 max-sm:size-11 max-sm:p-[3px]"
            style={{ borderColor: i === active ? "var(--color-ink)" : "oklch(0.19 0.015 45 / 0.14)" }}
          >
            <span className="block size-full rounded-full" style={{ background: s.swatch }} />
          </button>
        ))}
      </div>
    </div>
  );
}
