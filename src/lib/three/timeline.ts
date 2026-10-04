/**
 * THE FALL: the one place that decides what the world looks like at every scroll position.
 *
 * Read it as a table. Each key says "when the page has scrolled to HERE, the world is like THIS".
 * A key only lists what changes; everything else carries over from the key before it.
 * Between two keys every channel is blended with smoothstep (or linearly, with `linear: true`).
 *
 * Positions are anchored to the DOM so the choreography survives any viewport height:
 *   top("range", -1)   the section's top edge is at the bottom of the viewport (it is just arriving)
 *   top("inside", 2)   the section's top edge is 2 viewport heights above the viewport top
 *   end("cfg", 0)      the section's bottom edge is at the bottom of the viewport
 * The table is resolved against the real layout on every resize, and the result is a plain
 * master progress value (0 to 1 over the whole document) per key.
 *
 * No three.js import here: this file is pure maths, colours are OKLCH like the CSS tokens.
 */

import { SINK_DRAIN, SINK_Y } from "./sinkState";

export type V3 = [number, number, number];
/** OKLCH: lightness 0..1, chroma, hue in degrees. */
export type LCH = [number, number, number];

export interface Anchor {
  id: string;
  vh: number;
  from: "top" | "end";
}
export const top = (id: string, vh = 0): Anchor => ({ id, vh, from: "top" });
export const end = (id: string, vh = 0): Anchor => ({ id, vh, from: "end" });

/* ---------------------------------------------------------------- colours */

// Same tuples as the tokens in globals.css.
export const SIGNAL: LCH = [0.65, 0.205, 38];
export const SIGNAL_DEEP: LCH = [0.52, 0.18, 36];
export const GUN: LCH = [0.255, 0.01, 255];
export const PAPER: LCH = [0.955, 0.012, 78];
export const MIST: LCH = [0.91, 0.006, 250];
export const INK: LCH = [0.19, 0.015, 45];
/** Wet floor on a vermilion ground: close to the ground so text over it keeps its contrast. */
const WET_SIGNAL: LCH = [0.58, 0.19, 37];
/** Wet floor on ink: a dark ember, ripples read as lighter rings. */
const WET_INK: LCH = [0.33, 0.1, 36];
/** Inside the drain: near-black, warm like the ink. */
const PIPE: LCH = [0.12, 0.01, 45];

export function lchToLab(c: LCH, out: Float64Array, o = 0) {
  const h = (c[2] * Math.PI) / 180;
  out[o] = c[0];
  out[o + 1] = c[1] * Math.cos(h);
  out[o + 2] = c[1] * Math.sin(h);
}

/** OKLab to linear sRGB (not clamped). */
export function labToLinear(L: number, a: number, b: number, out: Float64Array, o = 0) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  out[o] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  out[o + 1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  out[o + 2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const toSRGB8 = (lin: number) => {
  const c = clamp01(lin);
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(v * 255);
};

/* --------------------------------------------------------------- channels */

/** Flat index of every animated channel. Samples are Float64Arrays indexed with these. */
export const C = {
  camX: 0, camY: 1, camZ: 2,
  lookX: 3, lookY: 4, lookZ: 5,
  fov: 6,
  bgL: 7, bgA: 8, bgB: 9,
  fogN: 10, fogF: 11,
  /** Stage visibility, 0..1. head/stack flip at 0.5 so exactly one of them is drawn. */
  head: 12, stack: 13, basin: 14, floor: 15,
  /** Speed lines and near-lens drops. */
  fx: 16,
  /** Exploded view: separation 0..1, stack tilt (rad), spin (rad), label fade, caption fade. */
  explode: 17, tilt: 18, spin: 19, labels: 20, caption: 21,
  /** Water: drop count 0..1, emitter height and radius, drop colour 0 cream .. 1 steel. */
  water: 22, emitY: 23, emitR: 24, tone: 25,
  /** Ground: world y of the floor, forced wetness, forced spread, ripple height. */
  ground: 26, wet: 27, spread: 28, amp: 29,
  tintL: 30, tintA: 31, tintB: 32,
  fadeA: 33, fadeB: 34,
  /** Basin overflow sheet, ambient field of rain, basin sinking under the water. */
  overflow: 35, field: 36, sink: 37,
  /** Configurator live (pointer events, orbit), and basin pinned to its DOM window. */
  cfg: 38, pin: 39,
  /** Pointer parallax on the camera. */
  para: 40,
  /** Floor gloss: how much sky and sparkle the water shows, 0 matte .. 1 wet. */
  gloss: 41,
  /** Kitchen sink: visibility, keys pressed in order (0..4, 4..5 fades the captions), drain dive 0..1, console live. */
  sinkOn: 42, sinkSeq: 43, sinkDrain: 44, sinkLive: 45,
  /** Lens shift for an unpinned shot, in NDC: positive moves the subject right / up. */
  shiftX: 46, shiftY: 47,
  /** Fades the whole canvas into the page background, 0 clear .. 1 gone. */
  veil: 48,
} as const;
export const N_CH = 49;

export interface KeyDef {
  /** Used by reduced motion (rest poses) and by the docs table. */
  name?: string;
  at: Anchor;
  /** Ease of the segment that ENDS at this key. Default smoothstep. */
  linear?: boolean;
  cam?: V3;
  look?: V3;
  fov?: number;
  bg?: LCH;
  fog?: [number, number];
  head?: number;
  stack?: number;
  basin?: number;
  floor?: number;
  fx?: number;
  explode?: number;
  tilt?: number;
  spin?: number;
  labels?: number;
  caption?: number;
  water?: number;
  emit?: [number, number];
  tone?: number;
  ground?: number;
  wet?: number;
  spread?: number;
  amp?: number;
  tint?: LCH;
  fade?: [number, number];
  overflow?: number;
  field?: number;
  sink?: number;
  cfg?: number;
  pin?: number;
  para?: number;
  gloss?: number;
  sinkOn?: number;
  sinkSeq?: number;
  sinkDrain?: number;
  sinkLive?: number;
  shift?: [number, number];
  veil?: number;
}

/* ------------------------------------------------------------- world scale */

export const HEAD_Y = 4.3;
export const HEAD_R = 1.25;
/** Ground height while the hero is on screen, and far below, where the basin waits. */
export const GROUND_HI = 0;
export const GROUND_LO = -11;
/** Basin cluster origin: its local floor (-1.2) sits on the ground, its stream sits on the axis. */
export const BASIN_BASE = GROUND_LO + 1.2;
export const BASIN_Z = 0.6;
export const SPOUT_Y = BASIN_BASE + 0.665;
export const POOL_Y = BASIN_BASE + 0.13;

const G = GROUND_LO;
const SK = SINK_Y;
const BF: V3 = [0, G + 1.5, 0.15]; // basin focus

/* ---------------------------------------------------------------- desktop */

const DESKTOP: KeyDef[] = [
  // 1 HERO. Exactly the old hero shot (head offset right by moving the camera left).
  {
    name: "hero",
    at: top("hero", 0),
    cam: [-1.9, 2.4, 10.5], look: [-1.1, 2.25, 0], fov: 36,
    bg: SIGNAL, fog: [60, 120],
    head: 1, stack: 0, basin: 0, floor: 1, fx: 0,
    explode: 0, tilt: -0.42, spin: 0, labels: 0, caption: 0,
    water: 1, emit: [HEAD_Y - 0.05, 1.125], tone: 0,
    ground: GROUND_HI, wet: 0, spread: 0, amp: 0.06, tint: SIGNAL_DEEP, fade: [4.2, 7.6],
    overflow: 0, field: 0, sink: 0, cfg: 0, pin: 0, para: 1, gloss: 1,
  },
  { name: "hero-hold", at: top("hero", 0.4) },

  // 2 DIVE, first half: the head comes apart in front of us.
  {
    name: "dive-pre",
    at: top("inside", 0),
    cam: [0.1, 3.3, 9.8], look: [1.4, 4.6, 0], fov: 30, para: 0,
  },
  { name: "swap-a", at: top("inside", 0.12), head: 1, stack: 0 },
  { name: "swap-b", at: top("inside", 0.2), head: 0, stack: 1 },
  { name: "dim-start", at: top("inside", 0.25), bg: SIGNAL, explode: 0, fog: [60, 120] },
  // The title waits for the dark: its accent word is the same vermilion as the hero.
  { name: "gun", at: top("inside", 0.6), bg: GUN, fog: [14, 46], floor: 0, caption: 0 },
  { name: "title", at: top("inside", 0.8), caption: 1 },
  {
    name: "explode",
    at: top("inside", 1.1),
    explode: 1, spin: 0.7, cam: [0.1, 3.3, 9.2],
  },
  { name: "labels", at: top("inside", 1.55), labels: 1 },
  { name: "labels-hold", at: top("inside", 2.1), labels: 1, caption: 1 },
  { name: "labels-out", at: top("inside", 2.25), labels: 0, caption: 0 },

  // 2 DIVE, second half: over the rim, then straight down through the five layers.
  {
    name: "crane",
    at: top("inside", 2.5),
    cam: [2.6, 8.4, 6.8], look: [0.3, 4.7, 0], fov: 34, tilt: 0, spin: 1.3, fx: 0.15,
    ground: GROUND_LO,
  },
  {
    name: "rim",
    at: top("inside", 2.85),
    cam: [0.6, 7.5, 1.5], look: [0.3, 3.6, 0.1], fov: 42, spin: 1.5, fx: 0.55,
  },
  {
    name: "through",
    at: top("inside", 3.25),
    linear: true,
    cam: [0.45, 2.1, 0.5], look: [0.3, -3.5, 0.1], fov: 46, fx: 1,
  },
  // 3 RANGE, part one: out of the nozzles into open air, the rain thins around the camera.
  {
    name: "exit",
    at: end("inside", 0),
    cam: [0.4, 1.2, 0.7], look: [0.15, -5, 0], fov: 42, fx: 0.8,
    head: 0, stack: 0, water: 0.7, floor: 0,
    explode: 1,
  },
  {
    name: "tech",
    at: top("tech", -0.35),
    cam: [0.4, 0.3, 0.8], look: [0.15, -5.5, 0], fx: 0.5, water: 0.55,
  },
  // gunmetal eases to paper in empty scroll (the "air" spacer), with the drops darkening in step.
  {
    name: "air-a",
    at: top("air", -0.15),
    cam: [0.4, -0.7, 0.8], look: [0.1, -6.5, 0], bg: GUN,
  },
  {
    name: "range",
    at: top("range", -0.9),
    cam: [0.4, -1.7, 0.9], look: [0.1, -7.2, 0], bg: PAPER, tone: 1, fx: 0.18, water: 0.45,
    fog: [8, 26],
  },
  {
    name: "range-end",
    at: end("range", 0),
    cam: [0.5, -4.9, 1.4], look: [0.1, -10, 0], fog: [7, 22], basin: 0, pin: 0,
    emit: [HEAD_Y - 0.05, 1.125],
  },

  // 4 SINK: the world veils to paper, the sink is switched in behind the veil, the veil lifts on it and
  // the rain stops. Then the four keys press themselves while the camera walks round to each outlet.
  {
    name: "sink-veil",
    at: top("sink", -0.5),
    cam: [0.7, -5.4, 1.8], look: [0, -9, 0], water: 0.3, fx: 0, sinkOn: 0, shift: [0, 0], veil: 1,
  },
  { name: "sink-pop", at: top("sink", -0.44), sinkOn: 1, sinkSeq: 0, shift: [0.24, -0.06] },
  {
    name: "sink-in",
    at: top("sink", 0),
    cam: [1.45, SK + 2.45, 2.45], look: [0, SK - 0.05, -0.05], fov: 30, water: 0, veil: 0,
  },
  {
    name: "sink-k1",
    at: top("sink", 0.55),
    cam: [1.05, SK + 2.1, 2.15], look: [0.05, SK, -0.08], sinkSeq: 1,
  },
  {
    name: "sink-k2",
    at: top("sink", 1.35),
    cam: [0.2, SK + 1.5, 2.6], look: [0, SK - 0.1, -0.1], sinkSeq: 2,
  },
  {
    name: "sink-k3",
    at: top("sink", 2.15),
    cam: [-1.3, SK + 2.0, 2.0], look: [-0.1, SK, -0.12], sinkSeq: 3,
  },
  {
    name: "sink-k4",
    at: top("sink", 2.95),
    cam: [1.75, SK + 2.1, 1.55], look: [0.1, SK, -0.1], sinkSeq: 4,
  },
  {
    name: "sink-wide",
    at: end("sink", 0),
    cam: [1.4, SK + 2.6, 2.45], look: [0, SK - 0.05, -0.05], sinkSeq: 4.6,
  },
  // The console: the sink is framed in its DOM window and follows the keys there. The pin narrows the
  // lens by the window's share of the screen, which magnifies by 1/k^2 of the window; the window here
  // is about 0.56 of the screen, so the lens starts wide (86 deg pinned is about 50 deg) and the sink
  // fills some 80% of it.
  {
    name: "sink-spec",
    at: top("sink-spec", 0),
    cam: [1.1, SK + 1.95, 1.75], look: [0, SK - 0.02, -0.05], fov: 86, sinkLive: 1, pin: 1,
  },
  { name: "sink-spec-hold", at: end("sink-spec", 0.1) },
  // Still pinned while the last spec rows leave, so the sink goes up and away with its window and
  // nothing dark slides in behind the text. Everything after this is in the empty "drain" spacer.
  { name: "sink-spec-out", at: end("sink-spec", 1) },

  // Down the drain: the plug lifts, the bowl empties in a vortex, the camera drops through the hole
  // and the world veils to near-black. In the dark it is moved to the basin; the veil lifts there.
  {
    name: "drain-a",
    at: top("drain", 0.2),
    cam: [0.35, SK + 1.45, 0.8], look: SINK_DRAIN, fov: 36, pin: 0, sinkDrain: 0.35, shift: [0, 0],
  },
  // A beat at the brink, then the plunge.
  {
    name: "drain-mouth",
    at: top("drain", 0.5),
    cam: [SINK_DRAIN[0] + 0.02, SINK_DRAIN[1] + 0.55, SINK_DRAIN[2] + 0.12], look: SINK_DRAIN, fov: 44, sinkDrain: 0.8,
  },
  {
    name: "drain-b",
    at: top("drain", 0.68),
    veil: 1,
    cam: [SINK_DRAIN[0], SINK_DRAIN[1] - 0.25, SINK_DRAIN[2] + 0.001],
    look: [SINK_DRAIN[0], SINK_DRAIN[1] - 3, SINK_DRAIN[2]],
    fov: 64, bg: PIPE, fx: 0.7, sinkDrain: 1,
  },
  {
    name: "pipe",
    at: top("drain", 0.76),
    cam: [1.6, G + 6.2, 3.2], look: BF, fov: 34, fx: 0.2,
    sinkOn: 0, sinkLive: 0, basin: 1, pin: 1, water: 0.15, emit: [SPOUT_Y, 0.012],
  },
  // Up out of the dark onto mist while the spacer is still empty, before the basin builder scrolls in.
  { name: "pipe-out", at: top("drain", 1.1), bg: MIST, veil: 0 },

  // 4 BASIN: the curtain narrows into the stream, the basin rises out of the fog, the camera settles.
  {
    name: "approach",
    at: top("cfg", -0.5),
    cam: [1.6, G + 6.2, 3.2], look: BF, fov: 34, bg: MIST, basin: 1, fx: 0.2, veil: 0,
    water: 0.15, emit: [SPOUT_Y, 0.012], fog: [8, 20], pin: 1,
  },
  {
    name: "basin",
    at: top("cfg", -0.15),
    cam: [2.04, G + 2.85, 3.47], look: BF, fov: 26, fog: [7, 14],
    fx: 0, water: 0.1, cfg: 1, pin: 1,
  },
  { name: "basin-hold", at: end("cfg", 0.1) },

  // 5 OVERFLOW: the pool brims, a sheet goes over the slab edge, the floor wets out and the camera backs away.
  {
    name: "spill-a",
    at: top("spill", 0),
    cam: [2.6, G + 3.3, 4.6], look: [0, G + 1.1, 0.3], fov: 28, cfg: 0, pin: 0.4,
    overflow: 0.6, floor: 1, wet: 0.2, spread: 0.1, bg: MIST, tint: WET_SIGNAL,
  },
  {
    name: "spill-b",
    at: top("spill", 0.35),
    cam: [3.0, G + 4.6, 6.0], look: [0, G + 0.8, 0.6], fov: 32, pin: 0,
    overflow: 1, wet: 0.7, spread: 0.55, bg: [0.78, 0.09, 55], sink: 0.2, water: 0.08,
    tone: 0.6, amp: 0.05, gloss: 0.8,
  },
  {
    name: "spill-c",
    at: top("rooms", -1),
    cam: [1.4, G + 7.4, 6.8], look: [0, G + 0.2, 0.7], fov: 34,
    bg: SIGNAL, wet: 1, spread: 1, sink: 1, water: 0, overflow: 0.5, field: 0.3, fade: [6, 11],
    tone: 0, gloss: 0.55,
  },

  // 6 SHOWROOMS: the pool is the backdrop, the camera creeps up and turns to look down.
  {
    name: "rooms",
    at: end("rooms", 0),
    cam: [0.3, G + 8.4, 4.4], look: [0, G, 0.6], fov: 36, basin: 0, overflow: 0, field: 1,
    amp: 0.055, fade: [8, 14], gloss: 0.45,
  },

  // 7 FOOTER: straight down into the ripple field; the ground goes to ink and only the rings are left.
  {
    name: "pool",
    at: top("pool", 0.2),
    cam: [0, G + 9.6, 0.45], look: [0, G, 0], fov: 38, amp: 0.06, fade: [11, 18], gloss: 0.4,
  },
  {
    name: "foot",
    at: top("foot", -0.9),
    bg: INK, tint: WET_INK, amp: 0.07, gloss: 0.16,
  },
  { name: "foot-end", at: end("foot", 0) },
];

/* ----------------------------------------------------------------- mobile */

/**
 * Phones and any portrait screen. Not a squeezed desktop: closer cameras so the head fills the
 * width, the basin pushed up into the window above the controls, and shorter holds.
 * Keys are matched by name; anything not listed here is inherited from the desktop key.
 */
const MOBILE: Record<string, Partial<KeyDef>> = {
  hero: { cam: [0, 2.7, 14], look: [0, 1.0, 0], fov: 42 },
  "dive-pre": { cam: [0, 3.2, 8.6], look: [0, 4.8, 0], fov: 46 },
  explode: { cam: [0, 3.2, 8.4], look: [0, 4.8, 0] },
  crane: { cam: [1.6, 8.0, 5.6], look: [0.2, 4.7, 0], fov: 46 },
  rim: { cam: [0.5, 7.2, 1.4], look: [0.3, 3.6, 0.1], fov: 52 },
  through: { fov: 56 },
  exit: { fov: 52 },
  tech: { fov: 52 },
  "air-a": { fov: 52 },
  range: { fov: 52 },
  "range-end": { fov: 52 },
  "sink-veil": { fov: 52 },
  "sink-pop": { shift: [0, -0.22] },
  "sink-in": { cam: [1.7, SK + 3.0, 4.2], look: [0, SK + 0.1, -0.05], fov: 44 },
  "sink-k1": { cam: [1.1, SK + 2.0, 3.2], look: [0.05, SK + 0.2, -0.08] },
  "sink-k2": { cam: [0.25, SK + 1.9, 4.0], look: [-0.05, SK - 0.05, -0.12] },
  "sink-k3": { cam: [-2.0, SK + 2.0, 2.6], look: [-0.3, SK + 0.05, -0.2] },
  "sink-k4": { cam: [2.1, SK + 2.2, 2.4], look: [0.2, SK + 0.1, -0.15] },
  // Phones: the console heading comes up where the sink sits, so the sink drops off the bottom first.
  "sink-wide": { cam: [1.6, SK + 2.7, 3.8], look: [0, SK + 0.05, -0.05], shift: [0, -1.6] },
  // The phone window is square, about 0.42 of the screen: a wider lens still.
  "sink-spec": { cam: [1.3, SK + 2.0, 2.2], fov: 113 },
  "drain-a": { cam: [0.3, SK + 1.9, 1.0], fov: 44 },
  "drain-mouth": { fov: 52 },
  "drain-b": { fov: 70 },
  approach: { at: top("cfg", -0.2), cam: [1.9, G + 6.6, 3.6], fov: 40 },
  basin: { at: top("cfg", 0.1), cam: [3.8, G + 4.4, 7.4], fov: 38 },
  "basin-hold": { at: end("cfg", 0.1) },
  "spill-a": { cam: [2.8, G + 3.6, 5.4], fov: 40 },
  "spill-b": { cam: [3.2, G + 5.2, 7.6], fov: 42 },
  "spill-c": { cam: [1.4, G + 8.4, 8.2], fov: 42 },
  rooms: { cam: [0.3, G + 9.6, 5.2], fov: 44 },
  pool: { cam: [0, G + 10.4, 0.5], fov: 44 },
};

/* ------------------------------------------------------------ compilation */

export interface Timeline {
  names: string[];
  defs: KeyDef[];
  /** Flat channel values per key. */
  data: Float64Array[];
  /** Resolved master progress per key, strictly ascending. */
  p: Float64Array;
  linear: Uint8Array;
  /** Last segment used, so sampling is O(1) while scrolling. */
  cur: number;
}

const lab = new Float64Array(3);

function flatten(prev: Float64Array | null, k: KeyDef): Float64Array {
  const f = prev ? Float64Array.from(prev) : new Float64Array(N_CH);
  const set = (i: number, v: number | undefined) => {
    if (v !== undefined) f[i] = v;
  };
  if (k.cam) {
    f[C.camX] = k.cam[0];
    f[C.camY] = k.cam[1];
    f[C.camZ] = k.cam[2];
  }
  if (k.look) {
    f[C.lookX] = k.look[0];
    f[C.lookY] = k.look[1];
    f[C.lookZ] = k.look[2];
  }
  set(C.fov, k.fov);
  if (k.bg) {
    lchToLab(k.bg, lab);
    f[C.bgL] = lab[0];
    f[C.bgA] = lab[1];
    f[C.bgB] = lab[2];
  }
  if (k.fog) {
    f[C.fogN] = k.fog[0];
    f[C.fogF] = k.fog[1];
  }
  set(C.head, k.head);
  set(C.stack, k.stack);
  set(C.basin, k.basin);
  set(C.floor, k.floor);
  set(C.fx, k.fx);
  set(C.explode, k.explode);
  set(C.tilt, k.tilt);
  set(C.spin, k.spin);
  set(C.labels, k.labels);
  set(C.caption, k.caption);
  set(C.water, k.water);
  if (k.emit) {
    f[C.emitY] = k.emit[0];
    f[C.emitR] = k.emit[1];
  }
  set(C.tone, k.tone);
  set(C.ground, k.ground);
  set(C.wet, k.wet);
  set(C.spread, k.spread);
  set(C.amp, k.amp);
  if (k.tint) {
    lchToLab(k.tint, lab);
    f[C.tintL] = lab[0];
    f[C.tintA] = lab[1];
    f[C.tintB] = lab[2];
  }
  if (k.fade) {
    f[C.fadeA] = k.fade[0];
    f[C.fadeB] = k.fade[1];
  }
  set(C.overflow, k.overflow);
  set(C.field, k.field);
  set(C.sink, k.sink);
  set(C.cfg, k.cfg);
  set(C.pin, k.pin);
  set(C.para, k.para);
  set(C.gloss, k.gloss);
  set(C.sinkOn, k.sinkOn);
  set(C.sinkSeq, k.sinkSeq);
  set(C.sinkDrain, k.sinkDrain);
  set(C.sinkLive, k.sinkLive);
  set(C.veil, k.veil);
  if (k.shift) {
    f[C.shiftX] = k.shift[0];
    f[C.shiftY] = k.shift[1];
  }
  return f;
}

export type Kind = "desktop" | "mobile";

export function buildTimeline(kind: Kind): Timeline {
  const defs = DESKTOP.map((d) => {
    const m = kind === "mobile" && d.name ? MOBILE[d.name] : undefined;
    return m ? { ...d, ...m } : d;
  });
  const data: Float64Array[] = [];
  defs.forEach((d, i) => data.push(flatten(i ? data[i - 1] : null, d)));
  return {
    names: defs.map((d) => d.name ?? ""),
    defs,
    data,
    p: new Float64Array(defs.length),
    linear: Uint8Array.from(defs.map((d) => (d.linear ? 1 : 0))),
    cur: 0,
  };
}

export interface Geometry {
  /** Document-space top and bottom of every anchored section, in px. */
  rects: Record<string, { top: number; bottom: number }>;
  vh: number;
  maxScroll: number;
}

/** Document pixel for an anchor, or NaN if the section does not exist. */
export function anchorY(a: Anchor, g: Geometry): number {
  const r = g.rects[a.id];
  if (!r) return NaN;
  return a.from === "top" ? r.top + a.vh * g.vh : r.bottom - g.vh + a.vh * g.vh;
}

/** Turn anchors into master progress. Keys keep their order; every key is at least 1px after the last. */
export function resolveTimeline(tl: Timeline, g: Geometry) {
  const max = Math.max(1, g.maxScroll);
  let last = -1e9;
  for (let i = 0; i < tl.defs.length; i++) {
    let y = anchorY(tl.defs[i].at, g);
    if (Number.isNaN(y)) y = last + 1;
    y = Math.min(max, Math.max(0, y));
    y = Math.max(y, last + 1);
    tl.p[i] = y / max;
    last = y;
  }
  // The last key can run past 1 when keys pile up at the end; squeeze them in.
  const n = tl.p.length;
  for (let i = n - 1; i >= 0; i--) {
    const cap = 1 - (n - 1 - i) / max;
    if (tl.p[i] > cap) tl.p[i] = cap;
  }
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** Blend every channel at master progress `P` into `out`. No allocation. */
export function sampleTimeline(tl: Timeline, P: number, out: Float64Array) {
  const n = tl.p.length;
  if (P <= tl.p[0]) {
    out.set(tl.data[0]);
    return;
  }
  if (P >= tl.p[n - 1]) {
    out.set(tl.data[n - 1]);
    return;
  }
  let i = tl.cur;
  if (i >= n - 1) i = n - 2;
  while (i > 0 && P < tl.p[i]) i--;
  while (i < n - 2 && P >= tl.p[i + 1]) i++;
  tl.cur = i;
  const a = tl.data[i];
  const b = tl.data[i + 1];
  const span = tl.p[i + 1] - tl.p[i];
  const t = span > 0 ? (P - tl.p[i]) / span : 1;
  const s = tl.linear[i + 1] ? t : smoothstep(t);
  for (let c = 0; c < N_CH; c++) out[c] = a[c] + (b[c] - a[c]) * s;
}

/* ---------------------------------------------------------- reduced motion */

/**
 * With prefers-reduced-motion nothing travels. Each station has one rest pose (a named key
 * above) and the world cross-fades between them when a station boundary passes.
 */
export const REST_STATIONS: { pose: string; from: Anchor }[] = [
  { pose: "hero", from: top("hero", -9) },
  { pose: "labels-hold", from: top("inside", 0) },
  { pose: "range", from: top("range", -0.9) },
  { pose: "sink-k4", from: top("sink", -0.4) },
  { pose: "sink-spec", from: top("sink-spec", -0.5) },
  { pose: "basin", from: top("cfg", -0.5) },
  { pose: "spill-c", from: top("spill", 0) },
  { pose: "foot", from: top("foot", -1) },
];

export function restIndex(tl: Timeline, g: Geometry, scrollY: number): number {
  let idx = 0;
  for (let i = 0; i < REST_STATIONS.length; i++) {
    const y = anchorY(REST_STATIONS[i].from, g);
    if (!Number.isNaN(y) && scrollY >= y) idx = i;
  }
  return idx;
}

export function sampleRest(tl: Timeline, idx: number, out: Float64Array) {
  const k = tl.names.indexOf(REST_STATIONS[idx].pose);
  out.set(tl.data[Math.max(0, k)]);
}

/* ----------------------------------------------------------------- helpers */

/** Station for debugging and the report: which named key a progress value is closest after. */
export function keyAt(tl: Timeline, P: number): string {
  let k = 0;
  for (let i = 0; i < tl.p.length; i++) if (tl.p[i] <= P) k = i;
  return tl.names[k];
}
