"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { easeIn, motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Reveal } from "./Reveal";
import { EXPO } from "@/lib/motion";
import { useWorldStatus } from "@/lib/useWorldStatus";
import { useStage } from "@/lib/useStage";
import { sinkUi } from "@/lib/three/sinkState";
import { fill, useI18n } from "@/i18n/provider";

type Outlet = "tap" | "falls" | "cups" | "ro";
type Mode = "stream" | "spray" | "blade";
/** Parts of the drawing a feature row can point at. */
type Area = Outlet | "keys" | "floor";

const OUTLET_IDS: Outlet[] = ["tap", "falls", "cups", "ro"];
const MODE_IDS: Mode[] = ["stream", "spray", "blade"];
const AREAS: Area[] = ["keys", "tap", "falls", "cups", "ro", "floor"];

/** The copy for the current locale, in the shapes the components below iterate over. */
function useCopy() {
  const { t, lang } = useI18n();
  return {
    t,
    lang,
    OUTLETS: OUTLET_IDS.map((id) => ({ id, ...t.sink.outlets[id] })),
    MODES: MODE_IDS.map((id) => ({ id, label: t.sink.modes[id] })),
    FEATURES: AREAS.map((area) => ({ area, ...t.sink.features[area] })),
  };
}
type Feat = ReturnType<typeof useCopy>["FEATURES"][number];

/** Hex for the SVG; the swatches use the same oklch language as the basin builder. */
const FINISHES = [
  {
    name: "Black PVD",
    swatch: "oklch(0.27 0.008 255)",
    rim: "#383a3f",
    rimHi: "#54575d",
    deck: "#303237",
    face: "#1c1d20",
    wall: "#2a2c30",
    side: "#1d1e21",
    floor: "#313338",
    groove: "#50535a",
    metal: ["#83868c", "#44464b"],
    grille: "#5d6067",
    glass: "#ffffff",
    // Water reads light on dark steel.
    cold: [0.9, 0.06, 230],
    hot: [0.86, 0.11, 52],
  },
  {
    name: "Brushed steel",
    swatch: "linear-gradient(135deg, oklch(0.92 0.004 255), oklch(0.66 0.008 255))",
    rim: "#c9cdd2",
    rimHi: "#eceef0",
    deck: "#c0c4c9",
    face: "#959aa1",
    wall: "#aeb3b9",
    side: "#959aa0",
    floor: "#c2c6cb",
    groove: "#989da4",
    metal: ["#eceef0", "#999da3"],
    grille: "#e3e6e9",
    glass: "#5f646b",
    // And darker on bright steel.
    cold: [0.58, 0.12, 238],
    hot: [0.6, 0.17, 38],
  },
] as const;
type Finish = (typeof FINISHES)[number];

const T_MIN = 18;
const T_MAX = 60;

/** Same key faces as the shower mixer in the hero. */
const KEY_UP = "0 5px 0 #8d8f93, 0 8px 12px rgba(0,0,0,0.55), inset 0 1px 0 #fff";
const KEY_DOWN =
  "0 1px 0 #8d8f93, 0 2px 4px rgba(0,0,0,0.6), inset 0 2px 4px rgba(0,0,0,0.14)";

/** Water motion for the drawing: dashes run down (or up, for the rinser), rings spread and fade. */
const WATER_CSS = `
@keyframes sink-fall { to { stroke-dashoffset: -32; } }
@keyframes sink-rise { to { stroke-dashoffset: 32; } }
@keyframes sink-ripple { from { transform: scale(0.3); opacity: 0.9; } to { transform: scale(1.35); opacity: 0; } }
.sink-fall { animation: sink-fall 0.42s linear infinite; }
.sink-rise { animation: sink-rise 0.32s linear infinite; }
.sink-ripple { transform-box: fill-box; transform-origin: center; animation: sink-ripple 1.4s cubic-bezier(0.25, 1, 0.5, 1) infinite; }
@media (prefers-reduced-motion: reduce) {
  .sink-fall, .sink-rise, .sink-ripple { animation: none; }
  .sink-ripple { opacity: 0.5; }
}`;

/**
 * Water tint follows the temperature knob, cold blue to warm. Blended in OKLab, straight through
 * neutral, so lukewarm water is clear instead of passing round the hue wheel through green.
 */
function waterColor(f: Finish, temp: number) {
  const t = (temp - T_MIN) / (T_MAX - T_MIN);
  const lab = ([l, c, h]: readonly number[]) => [l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)];
  const a = lab(f.cold);
  const b = lab(f.hot);
  const [l, x, y] = a.map((v, i) => v + (b[i] - v) * t);
  return `oklab(${l.toFixed(3)} ${x.toFixed(3)} ${y.toFixed(3)})`;
}

/**
 * Piano, the kitchen sink. Sits between the range and the basin, where the world is still paper
 * with rain falling through it, so the section needs no colour change of its own.
 */
export function Sink() {
  const { t, lang, OUTLETS, MODES, FEATURES } = useCopy();
  // Starts where the show above leaves the sink: everything running, plug in, bowl full.
  const [on, setOn] = useState<Record<Outlet, boolean>>({
    tap: true,
    falls: true,
    cups: true,
    ro: true,
  });
  const [mode, setMode] = useState<Mode>("stream");
  const [temp, setTemp] = useState(38);
  const [plug, setPlug] = useState(true);
  // The bowl fills while the plug is in and anything runs, and stays full until the plug comes out.
  const [full, setFull] = useState(true);
  const [finish, setFinish] = useState(0);
  const [focus, setFocus] = useState<Area | null>(null);
  const f = FINISHES[finish];

  // The 3D sink reads the console straight from here; nothing re-renders on the scroll path.
  useEffect(() => {
    Object.assign(sinkUi, { ...on, mode, temp, plug, finish });
  }, [on, mode, temp, plug, finish]);

  // The dive: once the last rows are read, the words and the console drop away and leave the sink
  // alone in its window, then the camera goes into the bowl and down the drain (timeline: sink-dive).
  // Only with the 3D world on: without it the outro is collapsed and there is nothing to dive into.
  const outro = useRef<HTMLDivElement>(null);
  const world = useWorldStatus() === "on";
  const reduced = useReducedMotion();
  const { scrollYProgress: dive } = useScroll({ target: outro, offset: ["start end", "start start"] });
  const dropY = useTransform(dive, [0.45, 0.85], [0, 140], { ease: easeIn });
  const dropO = useTransform(dive, [0.45, 0.8], [1, 0]);
  const dropV = useTransform(dive, (v) => (v >= 0.8 ? "hidden" : "visible"));
  const drop = world && !reduced ? { y: dropY, opacity: dropO, visibility: dropV } : undefined;

  // Phones: the section is a sticky stage (useStage). The sink keeps a band at the top, and the
  // heading, the console and the rows ride up beneath it. So the sink is in shot the whole way and
  // the dive starts from it, exactly as on desktop. The last half screen of the ride overlaps the
  // outro, so the dive follows the last row without a pause.
  const { track, stage, band, tail, on: staged, y: paneY, fade: fadeO } = useStage(-0.5);
  const ride = staged ? { y: paneY } : undefined;

  const running = OUTLETS.filter((o) => on[o.id]);

  const toggle = (id: Outlet) => {
    const next = !on[id];
    setOn((s) => ({ ...s, [id]: next }));
    if (next && plug) setFull(true);
  };
  const pickMode = (m: Mode) => {
    setMode(m);
    if (!on.tap) toggle("tap");
  };
  const flipPlug = () => {
    const next = !plug;
    setPlug(next);
    setFull(next && running.length > 0);
  };

  return (
    <section
      id="sink-spec"
      data-station="sink-spec"
      aria-labelledby="sink-spec-title"
      className="bg-paper px-[var(--pad)] py-[clamp(56px,11vw,160px)] world:bg-transparent stage:py-0"
    >
      <style href="yeni-evler-yapi-sink" precedence="default">
        {WATER_CSS}
      </style>
      {/* Two columns from the top edge: words on the left, and on the right a sticky window the 3D
          sink glides into from the show above, so it never crosses the text. */}
      <div
        ref={track}
        className="grid items-start gap-x-[clamp(32px,5vw,88px)] gap-y-8 sm:gap-y-12 lg:grid-cols-[minmax(340px,1fr)_minmax(0,1.3fr)] side:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] stage:block stage:[--stage:1]"
      >
        {/* Desktop: no box, its children are the grid's. Phones: the sticky stage, one screen tall,
            with the sink's window as a band across its top and everything else clipped below it. */}
        <div
          ref={stage}
          className="contents stage:sticky stage:top-0 stage:-mx-[var(--pad)] stage:block stage:h-lvh stage:px-[var(--pad)] stage:pt-[calc(var(--band)+26px)] stage:[--band:40lvh] stage:[clip-path:inset(var(--band)_0_0_0)]"
        >
        {/* The words fade into the paper as they reach the band, instead of being cut by a line. */}
        <motion.div
          aria-hidden
          style={{ opacity: fadeO }}
          className="pointer-events-none absolute inset-x-0 top-[var(--band)] z-10 hidden h-7 bg-[linear-gradient(to_bottom,var(--bg),transparent)] stage:block"
        />
        <motion.div style={ride} className="lg:col-start-1 lg:row-start-1 side:col-start-1 stage:will-change-transform">
          <Reveal className="flex flex-col gap-6">
            <h2 id="sink-spec-title" className="display max-w-[14ch] text-[clamp(34px,6.4vw,108px)] text-balance">
              {t.sink.title}
            </h2>
            <p className="max-w-[34ch] text-[15px] leading-[1.4] font-medium sm:text-[18px]">
              {t.sink.lede}
            </p>
          </Reveal>
        </motion.div>
        <div className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 side:contents stage:contents">
          {/* With WebGL the shared canvas draws the sink centred on this window (data-world-pin). */}
          <div
            ref={band}
            className="noworld:hidden relative aspect-square max-h-[62svh] min-h-[220px] lg:aspect-auto lg:h-[min(56vh,560px)] lg:max-h-none side:sticky side:top-[22lvh] side:col-start-2 side:row-span-4 side:row-start-1 side:aspect-auto side:h-[56lvh] side:max-h-none side:min-h-0 stage:absolute stage:inset-x-0 stage:top-0 stage:aspect-auto stage:h-[var(--band)] stage:max-h-none stage:min-h-0"
          >
            <div data-world-pin="sink" className="pointer-events-none absolute inset-0" />
          </div>
          <Reveal className="world:hidden">
            <div className="bg-mist px-[clamp(8px,2vw,28px)] pt-[clamp(16px,3vw,40px)] pb-[clamp(8px,1.5vw,20px)]">
              <Drawing f={f} on={on} mode={mode} temp={temp} plug={plug} full={full} focus={focus} />
            </div>
          </Reveal>
          <motion.div style={ride ?? drop} className="side:col-start-1 stage:mt-7 stage:will-change-transform">
            <Reveal delay={120}>
              <Console
                on={on}
                toggle={toggle}
                temp={temp}
                setTemp={setTemp}
                plug={plug}
                flipPlug={flipPlug}
                setFocus={setFocus}
              />
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
                <span className="text-[14px] font-semibold text-ink/78">{t.sink.tapHead}</span>
                <div role="radiogroup" aria-label={t.sink.tapHead} className="flex flex-wrap gap-2">
                  {MODES.map((m) => {
                    const sel = mode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        role="radio"
                        aria-checked={sel}
                        onClick={() => pickMode(m.id)}
                        className="rounded-full border px-3.5 py-1.5 text-[13px] font-semibold sm:px-4 sm:py-2 sm:text-[14px] transition-colors duration-200"
                        style={{
                          borderColor: sel ? "var(--color-ink)" : "oklch(0.19 0.015 45 / 0.25)",
                          background: sel ? "var(--color-ink)" : "transparent",
                          color: sel ? "var(--color-paper)" : "var(--color-ink)",
                        }}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <span className="sr-only" aria-live="polite">
                {running.length
                  ? fill(t.sink.runningList, { list: running.map((o) => o.label.toLocaleLowerCase(lang)).join(", ") })
                  : t.sink.nothingRunning}
                {full ? t.sink.bowlFull : ""}
              </span>
            </Reveal>
          </motion.div>
        </div>

        <motion.div
          ref={tail}
          style={ride ?? drop}
          className="flex flex-col gap-8 sm:gap-10 lg:col-start-1 lg:row-start-2 side:col-start-1 stage:mt-9 stage:will-change-transform"
        >
          <ul className="flex flex-col" onMouseLeave={() => setFocus(null)}>
            {FEATURES.map((ft, i) => (
              <Feature key={ft.title} n={i + 1} ft={ft} hot={focus === ft.area} onHover={() => setFocus(ft.area)} />
            ))}
          </ul>

          <div className="flex flex-col gap-3.5">
            <div className="flex items-baseline justify-between text-[15px]">
              <span className="font-semibold">{t.sink.finish}</span>
              <span className="text-ink/78">{t.sink.finishes[finish].name}</span>
            </div>
            <div className="grid max-w-[400px] grid-cols-4 gap-2.5 max-sm:flex max-sm:flex-wrap" role="radiogroup" aria-label={t.sink.finish}>
              {FINISHES.map((s, i) => (
                <button
                  key={s.name}
                  type="button"
                  role="radio"
                  aria-checked={i === finish}
                  aria-label={t.sink.finishes[i].name}
                  onClick={() => setFinish(i)}
                  className="aspect-square rounded-full border-2 bg-transparent p-1 transition-colors duration-200 max-sm:size-11 max-sm:p-[3px]"
                  style={{ borderColor: i === finish ? "var(--color-ink)" : "oklch(0.19 0.015 45 / 0.14)" }}
                >
                  <span className="block size-full rounded-full" style={{ background: s.swatch }} />
                </button>
              ))}
            </div>
          </div>

          <dl className="flex flex-col border-t border-ink/15 text-[14px] sm:text-[15px]">
            {t.sink.specs.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-ink/15 py-2 sm:py-2.5">
                <dt className="text-ink/78">{k}</dt>
                <dd className="num text-right font-semibold">{v}</dd>
              </div>
            ))}
          </dl>

          <p className="max-w-[46ch] text-[15px] leading-[1.5] text-ink/75">
            <span className="font-semibold text-ink">{t.sink.inBoxLead}</span>
            {fill(t.sink.inBox, { board: t.sink.finishes[finish].board })}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-5">
            <p className="max-w-[24ch] text-[15px] leading-[1.4] font-medium">
              {t.sink.showroomNote}
            </p>
            <a
              href="#showrooms"
              className="rounded-full bg-signal px-7 py-4 text-[16px] font-bold max-sm:px-5 max-sm:py-3 max-sm:text-[15px] text-ink transition-transform duration-300 ease-[var(--ease-out-quart)] hover:-translate-y-0.5"
            >
              {t.common.requestQuote}
            </a>
          </div>
        </motion.div>
        </div>

        {/* Phones: the scroll the words need to pass under the band while the stage holds. */}
        <div aria-hidden className="hidden stage:block stage:h-[var(--stage-run)]" />

        {/* Empty scroll that keeps the sticky sink window on screen after the words have gone. */}
        <div
          ref={outro}
          data-station="sink-dive"
          aria-hidden
          className="hidden h-[130vh] world:block motion-reduce:hidden lg:col-start-1 lg:row-start-3 side:col-start-1"
        />
      </div>
    </section>
  );
}

function Feature({
  n,
  ft,
  hot,
  onHover,
}: {
  n: number;
  ft: Feat;
  hot: boolean;
  onHover: () => void;
}) {
  return (
    <li onMouseEnter={onHover} className="border-t border-ink/15 py-4 last:border-b">
      <div className="flex items-baseline gap-4">
        <span
          className="narrow num w-6 shrink-0 text-[14px] font-semibold transition-colors duration-300"
          style={{ color: hot ? "var(--color-signal-deep)" : "oklch(0.19 0.015 45 / 0.72)" }}
        >
          0{n}
        </span>
        <div className="flex flex-col gap-1">
          <motion.span
            className="wide text-[16px] leading-tight sm:text-[19px] font-bold tracking-[-0.02em]"
            initial={false}
            animate={{ x: hot ? 8 : 0 }}
            transition={{ duration: 0.5, ease: EXPO }}
          >
            {ft.title}
          </motion.span>
          <span className="max-w-[44ch] text-[14px] leading-[1.45] text-ink/75 sm:text-[15px]">{ft.body}</span>
        </div>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ console */

function Console({
  on,
  toggle,
  temp,
  setTemp,
  plug,
  flipPlug,
  setFocus,
}: {
  on: Record<Outlet, boolean>;
  toggle: (id: Outlet) => void;
  temp: number;
  setTemp: (t: number) => void;
  plug: boolean;
  flipPlug: () => void;
  setFocus: (a: Area | null) => void;
}) {
  const { t, OUTLETS } = useCopy();
  const hot = on.tap || on.falls;
  const count = OUTLETS.filter((o) => on[o.id]).length;
  return (
    <div
      role="group"
      aria-label={t.sink.keysLabel}
      className="flex flex-wrap items-center gap-3 rounded-[14px] p-3 max-[480px]:grid max-[480px]:grid-cols-[1fr_auto] max-[480px]:gap-2.5 max-[480px]:p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-7px_0_rgba(0,0,0,0.38),0_22px_44px_rgba(40,30,20,0.28),0_2px_0_#0b0c0e] [background:linear-gradient(180deg,oklch(0.42_0.01_255)_0%,oklch(0.31_0.01_255)_34%,oklch(0.23_0.01_255)_100%)] sm:gap-4 sm:p-4"
    >
      <div className="flex h-[76px] min-w-[104px] shrink-0 flex-col justify-center gap-1.5 rounded-[6px] bg-[oklch(0.15_0.008_255)] px-4 shadow-[inset_0_2px_7px_rgba(0,0,0,0.95),0_1px_0_rgba(255,255,255,0.09)] max-[480px]:h-14 max-[480px]:min-w-0 max-[480px]:gap-1">
        <div
          aria-hidden
          className="narrow num flex items-baseline gap-1 text-[40px] leading-none font-semibold text-signal max-[480px]:text-[28px] transition-opacity duration-300 [text-shadow:0_0_14px_oklch(0.65_0.205_38/0.7)]"
          style={{ opacity: hot ? 1 : 0.35 }}
        >
          <span>{temp}</span>
          <span className="text-[13px] font-medium tracking-wider">°C</span>
        </div>
        <div aria-hidden className="text-[11px] leading-[12px] font-semibold tracking-[0.08em] text-signal/80 uppercase">
          {count ? fill(t.sink.running, { n: count }) : t.sink.standby}
        </div>
      </div>

      <div className="min-w-[200px] flex-1 max-[480px]:order-last max-[480px]:col-span-2 max-[480px]:min-w-0">
        <div className="grid grid-cols-4 gap-[3px] px-[3px]">
          {OUTLETS.map((o) => (
            <div key={o.id} aria-hidden className="flex h-3 items-end justify-center" style={{ color: on[o.id] ? "#f3efe8" : "#7d7f83" }}>
              <Glyph id={o.id} />
            </div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-4 gap-[3px] rounded-[7px] bg-[#0b0c0e] px-[3px] pt-[3px] pb-1.5 shadow-[inset_0_2px_5px_rgba(0,0,0,0.95),0_1px_0_rgba(255,255,255,0.08)]">
          {OUTLETS.map((o) => {
            const down = on[o.id];
            return (
              <motion.button
                key={o.id}
                type="button"
                aria-label={o.label}
                aria-pressed={down}
                onClick={() => toggle(o.id)}
                onHoverStart={() => setFocus(o.id)}
                onHoverEnd={() => setFocus(null)}
                onFocus={() => setFocus(o.id)}
                onBlur={() => setFocus(null)}
                initial={false}
                animate={{ y: down ? 4 : 0, boxShadow: down ? KEY_DOWN : KEY_UP }}
                whileTap={{ y: 5, boxShadow: KEY_DOWN }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="flex h-[58px] cursor-pointer flex-col items-center justify-end rounded-[3px_3px_8px_8px] border-0 pb-[9px] max-sm:h-11 max-sm:pb-[7px] [background:linear-gradient(180deg,#fff_0%,#f0f0ef_62%,#d6d6d4_100%)] focus-visible:outline-signal"
              >
                <span
                  className="h-[3px] w-4 rounded-sm"
                  style={{
                    background: down ? "oklch(0.65 0.205 38)" : "#c9c9c7",
                    boxShadow: down ? "0 0 7px oklch(0.65 0.205 38)" : "none",
                  }}
                />
              </motion.button>
            );
          })}
        </div>
        <div className="mt-2 grid grid-cols-4 gap-[3px] px-[3px]">
          {OUTLETS.map((o) => (
            <span
              key={o.id}
              className="narrow text-center text-[11px] font-semibold uppercase sm:text-[12px] sm:tracking-[0.04em]"
              style={{ color: on[o.id] ? "#f3efe8" : "#8e9094" }}
            >
              {o.short}
            </span>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 gap-3 max-[480px]:gap-2">
        <TempKnob value={temp} onChange={setTemp} />
        <Knob label={t.sink.drain} angle={plug ? 90 : 0}>
          <button
            type="button"
            aria-label={t.sink.drainPlug}
            aria-pressed={plug}
            onClick={flipPlug}
            onMouseEnter={() => setFocus("floor")}
            onMouseLeave={() => setFocus(null)}
            className="absolute inset-0 cursor-pointer rounded-full focus-visible:outline-signal"
          />
        </Knob>
      </div>
    </div>
  );
}

/** Round metal knob with a vermilion mark at `angle` degrees (0 is twelve o'clock). */
function Knob({ label, angle, children }: { label: string; angle: number; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 max-sm:gap-1">
      <div className="relative size-[52px] max-sm:size-11 rounded-full shadow-[0_4px_0_#0b0c0e,0_8px_14px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.35)] [background:radial-gradient(circle_at_38%_30%,#a3a6ab,#55585d_55%,#2e3034_100%)]">
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          initial={false}
          animate={{ rotate: angle }}
          transition={{ duration: 0.35, ease: EXPO }}
        >
          <span className="absolute top-[5px] left-1/2 h-[12px] w-[3px] -translate-x-1/2 rounded-full bg-signal shadow-[0_0_6px_oklch(0.65_0.205_38)]" />
        </motion.span>
        {children}
      </div>
      <span className="narrow text-[11px] font-semibold text-[#8e9094] uppercase sm:text-[12px] sm:tracking-[0.04em]">
        {label}
      </span>
    </div>
  );
}

/** Drag up or right to heat, arrow keys for single degrees. */
function TempKnob({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { t } = useI18n();
  const drag = useRef<{ x: number; y: number; v: number } | null>(null);
  const set = (v: number) => onChange(Math.min(T_MAX, Math.max(T_MIN, Math.round(v))));
  const onKey = (e: KeyboardEvent) => {
    const step: Record<string, number> = {
      ArrowUp: 1,
      ArrowRight: 1,
      ArrowDown: -1,
      ArrowLeft: -1,
      PageUp: 5,
      PageDown: -5,
    };
    if (e.key in step) set(value + step[e.key]);
    else if (e.key === "Home") set(T_MIN);
    else if (e.key === "End") set(T_MAX);
    else return;
    e.preventDefault();
  };
  const angle = -135 + ((value - T_MIN) / (T_MAX - T_MIN)) * 270;
  return (
    <Knob label={t.sink.temp} angle={angle}>
      <div
        role="slider"
        tabIndex={0}
        aria-label={t.sink.waterTemp}
        aria-valuemin={T_MIN}
        aria-valuemax={T_MAX}
        aria-valuenow={value}
        aria-valuetext={`${value} °C`}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, v: value };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d) set(d.v + (e.clientX - d.x - (e.clientY - d.y)) / 4);
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        className="absolute inset-0 cursor-grab touch-none rounded-full focus-visible:outline-signal active:cursor-grabbing"
      />
    </Knob>
  );
}

function Glyph({ id }: { id: Outlet }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const };
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden>
      {id === "tap" && <path d="M4 12V5a4 4 0 0 1 8 0v2" {...p} />}
      {id === "falls" && <path d="M1.5 1.5h13M4 4v7M8 4v7M12 4v7" {...p} />}
      {id === "cups" && <path d="M3 11.2 5 1.5h6l2 9.7Z" {...p} />}
      {id === "ro" && <path d="M8 1C6.2 3.8 4.2 5.6 4.2 7.8a3.8 3.8 0 0 0 7.6 0C11.8 5.6 9.8 3.8 8 1Z" {...p} />}
    </svg>
  );
}

/* ------------------------------------------------------------------ drawing */

const BOWL = "138,330 862,330 938,522 62,522";
const FLOOR = "146,392 854,392 930,584 70,584";
const DRAIN: [number, number] = [500, 488];

/**
 * The sink from the front and above, in its own units (1 = about 0.75 mm across the deck).
 * Every outlet listens to the keys; water is dashed strokes that run down (sink-fall in globals.css).
 */
function Drawing({
  f,
  on,
  mode,
  temp,
  plug,
  full,
  focus,
}: {
  f: Finish;
  on: Record<Outlet, boolean>;
  mode: Mode;
  temp: number;
  plug: boolean;
  full: boolean;
  focus: Area | null;
}) {
  const { t, lang, OUTLETS } = useCopy();
  const w = waterColor(f, temp);
  const fade = (a: Area) => ({
    opacity: focus && focus !== a ? 0.22 : 1,
    transition: "opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
  });
  const show = (v: boolean) => ({
    initial: false as const,
    animate: { opacity: v ? 1 : 0 },
    transition: { duration: 0.45, ease: EXPO },
  });
  const running = OUTLETS.filter((o) => on[o.id]).map((o) => o.label.toLocaleLowerCase(lang));
  const finishName = t.sink.finishes[FINISHES.indexOf(f)].name.toLocaleLowerCase(lang);
  const label = `${fill(t.sink.drawing, { finish: finishName })} ${
    running.length ? fill(t.sink.runningList, { list: running.join(", ") }) : t.sink.nothingRunning
  }${full ? t.sink.bowlFull : ""}`;
  const ink = (o = 1) => ({ stroke: w, strokeOpacity: o });
  // Temperature knob mark on the knob's top face (an ellipse seen from above).
  const ta = ((-135 + ((temp - T_MIN) / (T_MAX - T_MIN)) * 270) * Math.PI) / 180;

  return (
    <svg viewBox="0 0 1000 620" role="img" aria-label={label} className="block h-auto w-full">
      <defs>
        <linearGradient id="sink-rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={f.rimHi} />
          <stop offset="1" stopColor={f.rim} />
        </linearGradient>
        <linearGradient id="sink-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={f.side} />
          <stop offset="1" stopColor={f.wall} />
        </linearGradient>
        <linearGradient id="sink-metal" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={f.metal[0]} />
          <stop offset="1" stopColor={f.metal[1]} />
        </linearGradient>
        <pattern id="sink-brush" width="8" height="3" patternUnits="userSpaceOnUse">
          <line x1="0" y1="1" x2="8" y2="1" stroke="#fff" strokeOpacity="0.05" />
        </pattern>
        <pattern id="sink-holes" width="6" height="5" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="2.5" r="1.1" fill={f.face} />
        </pattern>
        <clipPath id="sink-bowl">
          <polygon points={BOWL} />
        </clipPath>
      </defs>

      {/* Shadow on the counter, then the rim and its front edge. */}
      <ellipse cx="500" cy="566" rx="480" ry="20" fill="oklch(0.19 0.015 45 / 0.12)" />
      <polygon points="118,314 882,314 962,540 38,540" fill="url(#sink-rim)" />
      <polygon points="118,314 882,314 962,540 38,540" fill="url(#sink-brush)" />
      <polygon points="38,540 962,540 960,554 40,554" fill={f.face} />

      {/* Inside the bowl. */}
      <g clipPath="url(#sink-bowl)">
        <rect x="0" y="320" width="1000" height="300" fill={f.side} />
        <polygon points="138,330 862,330 854,392 146,392" fill="url(#sink-wall)" />
        <line x1="141" y1="346" x2="859" y2="346" stroke={f.rimHi} strokeOpacity="0.35" strokeWidth="2" />
        <polygon points={FLOOR} fill={f.floor} />
        <polygon points={FLOOR} fill="url(#sink-brush)" />
        <g style={fade("floor")}>
          {[
            [146, 392],
            [854, 392],
            [70, 584],
            [930, 584],
          ].map(([x, y]) => (
            <line key={x} x1={x} y1={y} x2={DRAIN[0]} y2={DRAIN[1]} stroke={f.groove} strokeWidth="2.5" />
          ))}
          <ellipse cx={DRAIN[0]} cy={DRAIN[1]} rx="36" ry="12" fill={f.face} />
          <ellipse cx={DRAIN[0]} cy={DRAIN[1]} rx="24" ry="8" fill={plug ? f.metal[1] : "#0b0c0e"} />
          <motion.ellipse
            cx={DRAIN[0]}
            cy={DRAIN[1]}
            rx="31"
            ry="10"
            fill="none"
            stroke="#6f86ff"
            strokeWidth="3"
            {...show(!plug)}
          />
        </g>
        <motion.polygon
          points="146,370 854,370 930,562 70,562"
          style={{ fill: w }}
          initial={false}
          animate={{ opacity: full ? 0.3 : 0 }}
          transition={{ duration: full ? 2.6 : 0.9, ease: EXPO }}
        />
      </g>
      <polygon points={BOWL} fill="none" stroke={f.rimHi} strokeOpacity="0.5" strokeWidth="2" />

      {/* Deck: top face and the front face that carries the keys. */}
      <polygon points="126,262 874,262 882,288 118,288" fill={f.deck} />
      <polygon points="118,288 882,288 882,314 118,314" fill={f.face} />

      {/* Glass rinser plate and its brass nozzle. */}
      <g style={fade("cups")}>
        <polygon points="148,266 228,266 231,284 145,284" fill={f.grille} />
        {[160, 172, 204, 216].map((x) => (
          <line key={x} x1={x} y1="268" x2={x} y2="282" stroke={f.face} strokeOpacity="0.5" />
        ))}
        <rect x="182" y="266" width="12" height="10" fill="#cfa650" />
        <ellipse cx="188" cy="266" rx="6" ry="2.5" fill="#f0cf7a" />
      </g>

      {/* Soap dispenser. */}
      <rect x="252" y="236" width="20" height="42" rx="3" fill="url(#sink-metal)" />
      <rect x="256" y="226" width="12" height="10" rx="2" fill={f.metal[1]} />
      <path d="M262 228V218H282" fill="none" stroke={f.metal[1]} strokeWidth="4" strokeLinecap="round" />

      {/* Temperature knob. */}
      <rect x="299" y="250" width="26" height="26" fill="url(#sink-metal)" />
      <ellipse cx="312" cy="276" rx="13" ry="5" fill={f.metal[1]} />
      <ellipse cx="312" cy="250" rx="13" ry="5" fill={f.metal[0]} />
      <line
        x1="312"
        y1="250"
        x2={312 + 10 * Math.sin(ta)}
        y2={250 - 4 * Math.cos(ta)}
        stroke="oklch(0.65 0.205 38)"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Waterfall slot, keys and display on the deck face. */}
      <rect x="350" y="297" width="120" height="6" rx="3" fill="#0b0c0e" style={fade("falls")} />
      <g style={fade("keys")}>
        {OUTLETS.map((o, i) => (
          <g key={o.id}>
            <rect x={492 + i * 28} y={on[o.id] ? 292 : 290} width="24" height="18" rx="2" fill="#ecebe8" />
            <line
              x1={498 + i * 28}
              x2={510 + i * 28}
              y1={on[o.id] ? 305 : 303}
              y2={on[o.id] ? 305 : 303}
              stroke={on[o.id] ? "oklch(0.65 0.205 38)" : "#c9c9c7"}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        ))}
        <rect x="612" y="291" width="60" height="19" rx="2" fill="#0b0c0e" />
        <text
          x="642"
          y="305"
          textAnchor="middle"
          className="narrow num"
          fontSize="13"
          fontWeight="600"
          fill="oklch(0.65 0.205 38)"
          opacity={on.tap || on.falls ? 1 : 0.35}
        >
          {temp}°
        </text>
      </g>

      {/* Drain knob. */}
      <g style={fade("floor")}>
        <rect x="680" y="252" width="20" height="24" fill="url(#sink-metal)" />
        <ellipse cx="690" cy="276" rx="10" ry="4" fill={f.metal[1]} />
        <ellipse cx="690" cy="252" rx="10" ry="4" fill={f.metal[0]} />
        <line
          x1="690"
          y1="252"
          x2={plug ? 698 : 690}
          y2={plug ? 252 : 248.5}
          stroke="oklch(0.65 0.205 38)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>

      {/* Waterfall grille. */}
      <g style={fade("falls")}>
        <polygon points="728,266 790,266 792,284 726,284" fill={f.grille} />
        <polygon points="728,266 790,266 792,284 726,284" fill="url(#sink-holes)" />
      </g>

      {/* Water. Under the taps, over the bowl. */}
      <motion.g style={fade("falls")} {...show(on.falls)}>
        <Sheet top={[350, 470, 303]} bottom={[344, 476, 410]} w={w} />
        <Sheet top={[726, 792, 288]} bottom={[720, 798, 410]} w={w} />
        <Ripple cx={410} cy={410} rx={66} w={w} />
        <Ripple cx={759} cy={410} rx={40} w={w} />
      </motion.g>

      <motion.g style={fade("tap")} {...show(on.tap)}>
        {mode === "stream" && (
          <>
            <line x1="712" y1="200" x2="712" y2="472" strokeWidth="8" strokeDasharray="26 6" className="sink-fall" style={ink()} />
            <line x1="710" y1="200" x2="710" y2="472" strokeWidth="2" stroke="#fff" strokeOpacity="0.45" />
          </>
        )}
        {mode === "spray" &&
          [0, 1, 2, 3, 4].map((i) => (
            <line
              key={i}
              x1={704 + i * 4}
              y1="200"
              x2={680 + i * 16}
              y2="472"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="8 24"
              className="sink-fall"
              style={{ ...ink(), animationDelay: `${-i * 0.09}s` }}
            />
          ))}
        {mode === "blade" && (
          <>
            <polygon points="708,200 716,200 754,472 670,472" style={{ fill: w }} opacity="0.3" />
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <line
                key={i}
                x1={709 + i}
                y1="200"
                x2={674 + i * 12.5}
                y2="472"
                strokeWidth="1.5"
                strokeDasharray="10 22"
                className="sink-fall"
                style={{ ...ink(), animationDelay: `${-i * 0.07}s` }}
              />
            ))}
          </>
        )}
        <Ripple cx={712} cy={472} rx={mode === "blade" ? 52 : 30} w={w} />
      </motion.g>

      <motion.g style={fade("ro")} {...show(on.ro)}>
        <line x1="812" y1="166" x2="812" y2="452" strokeWidth="3" strokeDasharray="14 18" className="sink-fall" style={ink()} />
        <Ripple cx={812} cy={452} rx={14} w={w} />
      </motion.g>

      {/* Pull-out tap. Drawn after its water so the head sits over the stream. */}
      <g style={fade("tap")}>
        <ellipse cx="640" cy="276" rx="12" ry="5" fill={f.metal[1]} />
        <path d="M640 276V118C640 62 712 62 712 118V144" fill="none" stroke="url(#sink-metal)" strokeWidth="12" strokeLinecap="round" />
        <rect x="700" y="140" width="24" height="58" rx="9" fill="url(#sink-metal)" />
        <ellipse cx="712" cy="198" rx="10" ry="3" fill={f.face} />
      </g>

      {/* Drinking-water tap. */}
      <g style={fade("ro")}>
        <ellipse cx="846" cy="276" rx="7" ry="3" fill={f.metal[1]} />
        <path d="M846 276V150C846 116 812 116 812 150V164" fill="none" stroke="url(#sink-metal)" strokeWidth="5" strokeLinecap="round" />
      </g>

      {/* An upturned glass on the rinser, washed from inside. */}
      <motion.g style={fade("cups")} {...show(on.cups)}>
        {[
          [188, 204],
          [176, 208],
          [200, 208],
          [170, 226],
          [206, 226],
        ].map(([x, y], i) => (
          <line
            key={i}
            x1="188"
            y1="264"
            x2={x}
            y2={y}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="8 24"
            className="sink-rise"
            style={{ ...ink(), animationDelay: `${-i * 0.11}s` }}
          />
        ))}
        <path d="M164 280 171 196Q188 190 205 196L212 280" fill={f.glass} fillOpacity="0.12" stroke={f.glass} strokeOpacity="0.7" strokeWidth="2" />
      </motion.g>
    </svg>
  );
}

/** A waterfall: a translucent sheet with streaks running down it. */
function Sheet({ top, bottom, w }: { top: [number, number, number]; bottom: [number, number, number]; w: string }) {
  const [tl, tr, ty] = top;
  const [bl, br, by] = bottom;
  const n = Math.round((tr - tl) / 11);
  return (
    <>
      <polygon points={`${tl},${ty} ${tr},${ty} ${br},${by} ${bl},${by}`} style={{ fill: w }} opacity="0.28" />
      {Array.from({ length: n + 1 }, (_, i) => {
        const t = i / n;
        return (
          <line
            key={i}
            x1={tl + (tr - tl) * t}
            y1={ty}
            x2={bl + (br - bl) * t}
            y2={by}
            strokeWidth="2"
            strokeDasharray="20 12"
            className="sink-fall"
            style={{ stroke: w, animationDelay: `${-((i * 7) % 5) * 0.08}s` }}
          />
        );
      })}
    </>
  );
}

/** Two rings spreading where water lands. */
function Ripple({ cx, cy, rx, w }: { cx: number; cy: number; rx: number; w: string }) {
  return (
    <>
      {[0, 0.7].map((d) => (
        <ellipse
          key={d}
          cx={cx}
          cy={cy}
          rx={rx}
          ry={rx * 0.3}
          fill="none"
          strokeWidth="2"
          className="sink-ripple"
          style={{ stroke: w, animationDelay: `${d}s` }}
        />
      ))}
    </>
  );
}
