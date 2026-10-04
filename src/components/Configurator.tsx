"use client";

import { useEffect, useState } from "react";
import { FINISHES, STONES } from "@/lib/three/stone";
import { ui } from "@/lib/three/state";
import { useI18n } from "@/i18n/provider";

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

  const st = STONES[stone];
  const fi = FINISHES[finish];
  return (
    <section
      id="basin"
      data-station="cfg"
      aria-label={c.aria}
      className="grid border-y border-ink/10 bg-mist world:bg-transparent world:lg:grid-cols-[minmax(0,1.7fr)_minmax(380px,1fr)] noworld:lg:grid-cols-[minmax(0,1fr)]"
    >
      {/* The basin is drawn by the shared canvas, centred on this window (data-world-pin). */}
      <div className="noworld:hidden relative min-h-[min(86vh,820px)] min-w-0 max-lg:min-h-[min(56svh,480px)]">
        <div data-world-pin="" className="pointer-events-none absolute inset-0" />
        <p className="pointer-events-none absolute top-7 left-[var(--pad)] rounded-full bg-paper/85 px-3 py-1 text-[14px] font-semibold text-ink">
          {c.orbit}
        </p>
        <button
          type="button"
          data-live=""
          aria-pressed={water}
          onClick={() => setWater((w) => !w)}
          className="absolute bottom-7 left-[var(--pad)] flex items-center gap-2.5 rounded-full border border-ink/25 bg-paper/80 px-[18px] py-2.5 text-[14px] font-semibold transition-colors duration-200 hover:border-ink"
        >
          <span
            className="size-2 rounded-full"
            style={{ background: water ? "var(--color-signal)" : "oklch(0.6 0.01 250)" }}
          />
          {water ? c.waterOn : c.waterOff}
        </button>
      </div>

      <div data-live="" className="world:bg-mist flex flex-col gap-7 border-ink/10 px-[var(--pad)] py-[clamp(32px,4vw,56px)] lg:border-l noworld:lg:border-l-0">
        <div className="flex flex-col gap-3.5">
          <h2 className="display text-[clamp(40px,4.4vw,72px)]">{c.title}</h2>
          <p className="max-w-[34ch] text-[17px] leading-[1.45]">
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

        <dl className="flex flex-col border-t border-ink/15 text-[15px]">
          {[
            [c.specBasin, c.valBasin],
            [c.specWeight, stone === 2 ? c.valWeightLight : c.valWeightHeavy],
            [c.specSpout, c.valSpout],
            [c.specFlow, c.valFlow],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-ink/15 py-2.5">
              <dt className="text-ink/65">{k}</dt>
              <dd className="num font-semibold">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[14px] font-semibold text-ink/65">{c.from}</p>
            <p className="display num text-[clamp(44px,4.4vw,64px)]" aria-live="polite">
              {fmt(st.price + fi.price)}
            </p>
          </div>
          <a
            href="#showrooms"
            className="rounded-full bg-signal px-7 py-4 text-[16px] font-bold text-ink transition-transform duration-300 ease-[var(--ease-out-quart)] hover:-translate-y-0.5"
          >
            {t.common.requestQuote}
          </a>
        </div>
      </div>
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
      <div className="grid max-w-[400px] grid-cols-4 gap-2.5" role="radiogroup" aria-label={label}>
        {items.map((s, i) => (
          <button
            key={s.name}
            type="button"
            role="radio"
            aria-checked={i === active}
            aria-label={names[i]}
            onClick={() => onPick(i)}
            className="aspect-square rounded-full border-2 bg-transparent p-1 transition-colors duration-200"
            style={{ borderColor: i === active ? "var(--color-ink)" : "oklch(0.19 0.015 45 / 0.14)" }}
          >
            <span className="block size-full rounded-full" style={{ background: s.swatch }} />
          </button>
        ))}
      </div>
    </div>
  );
}
