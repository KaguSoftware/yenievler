"use client";

import { useEffect, useRef, useState } from "react";
import { FINISHES, STONES } from "@/lib/three/stone";
import type { BasinHandle } from "@/lib/three/basin";

const fmt = (n: number) => "€ " + n.toLocaleString("en-US");

export function Configurator() {
  const stage = useRef<HTMLDivElement>(null);
  const handle = useRef<BasinHandle | null>(null);
  const [stone, setStone] = useState(0);
  const [finish, setFinish] = useState(0);
  const [water, setWater] = useState(true);
  const state = useRef({ stone, finish, water });

  useEffect(() => {
    state.current = { stone, finish, water };
    handle.current?.apply();
  }, [stone, finish, water]);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let dead = false;
    import("@/lib/three/basin")
      .then(({ initBasin }) => {
        if (dead) return;
        handle.current = initBasin(el, () => state.current);
      })
      .catch(console.error);
    return () => {
      dead = true;
      handle.current?.dispose();
      handle.current = null;
    };
  }, []);

  const st = STONES[stone];
  const fi = FINISHES[finish];

  return (
    <section
      id="basin"
      aria-label="Basin builder"
      className="grid border-y border-ink/10 bg-mist lg:grid-cols-[minmax(0,1.7fr)_minmax(380px,1fr)]"
    >
      <div className="relative min-h-[min(86vh,820px)] min-w-0 max-lg:min-h-[480px]">
        <div
          ref={stage}
          className="absolute inset-0 cursor-grab touch-pan-y"
          role="img"
          aria-label={`3D basin in ${st.name} with ${fi.name.toLowerCase()} fittings. Drag to orbit.`}
        />
        <p className="pointer-events-none absolute top-7 left-[var(--pad)] text-[14px] font-semibold text-ink/60">
          Drag to orbit
        </p>
        <button
          type="button"
          aria-pressed={water}
          onClick={() => setWater((w) => !w)}
          className="absolute bottom-7 left-[var(--pad)] flex items-center gap-2.5 rounded-full border border-ink/25 bg-paper/80 px-[18px] py-2.5 text-[14px] font-semibold transition-colors duration-200 hover:border-ink"
        >
          <span
            className="size-2 rounded-full"
            style={{ background: water ? "var(--color-signal)" : "oklch(0.6 0.01 250)" }}
          />
          {water ? "Water running" : "Water off"}
        </button>
      </div>

      <div className="flex flex-col gap-7 border-ink/10 px-[var(--pad)] py-[clamp(32px,4vw,56px)] lg:border-l">
        <div className="flex flex-col gap-3.5">
          <h2 className="display text-[clamp(40px,4.4vw,72px)]">Build a basin.</h2>
          <p className="max-w-[34ch] text-[17px] leading-[1.45]">
            One block of stone, one wall spout. Pick the stone and the metal;
            the price follows.
          </p>
        </div>

        <Picker
          label="Stone"
          value={st.name}
          items={STONES}
          active={stone}
          onPick={setStone}
        />
        <Picker
          label="Metal"
          value={fi.name}
          items={FINISHES}
          active={finish}
          onPick={setFinish}
        />

        <dl className="flex flex-col border-t border-ink/15 text-[15px]">
          {[
            ["Basin", "Ø 500 × 300 mm"],
            ["Weight", stone === 2 ? "52 kg" : "64 kg"],
            ["Spout projection", "230 mm"],
            ["Flow", "5 L/min"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-ink/15 py-2.5">
              <dt className="text-ink/65">{k}</dt>
              <dd className="num font-semibold">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[14px] font-semibold text-ink/65">From</p>
            <p className="display num text-[clamp(44px,4.4vw,64px)]" aria-live="polite">
              {fmt(st.price + fi.price)}
            </p>
          </div>
          <a
            href="#showrooms"
            className="rounded-full bg-signal px-7 py-4 text-[16px] font-bold text-ink transition-transform duration-300 ease-[var(--ease-out-quart)] hover:-translate-y-0.5"
          >
            Request a quote
          </a>
        </div>
      </div>
    </section>
  );
}

function Picker({
  label,
  value,
  items,
  active,
  onPick,
}: {
  label: string;
  value: string;
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
            aria-label={s.name}
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
