import { FLOWS } from "./three/flows";

/**
 * Timeline of the "Give it a minute" section, shared by the DOM (framer-motion)
 * and the three.js scene so both read the same clock. Pure maths, no three import.
 */

/** Jug capacity in litres. */
export const CAPACITY = 16;
/** Half of 7.6 is what the site claims, so a standard head runs twice the R-360. */
export const RATE_NIMBO = FLOWS.rain.rate;
export const RATE_STANDARD = RATE_NIMBO * 2;

/** Scroll progress at which the tap opens and closes. */
export const T_ON = 0.1;
export const T_OFF = 0.8;

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Exponential ease-out, no overshoot. */
export const expoOut = (x: number) => {
  const t = clamp01(x);
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
};

/** Seconds on the clock face. Runs a hair past 60 so the last digits can roll over. */
export const clockSeconds = (p: number) => 60.4 * clamp01((p - T_ON) / (T_OFF - T_ON));
/** Seconds of water actually run, capped at one minute. */
export const seconds = (p: number) => Math.min(60, clockSeconds(p));
export const litres = (p: number, rate: number) => (rate * seconds(p)) / 60;
export const fill = (p: number, rate: number) => litres(p, rate) / CAPACITY;

/** 0..1 how hard the tap is running (ramps up at T_ON, down at T_OFF). */
export const flowAt = (p: number) =>
  smoothstep(T_ON - 0.015, T_ON + 0.02, p) * (1 - smoothstep(T_OFF, T_OFF + 0.03, p));

/** Heads lower into place over the first stretch of the pin. */
export const arrive = (p: number) => smoothstep(0, 0.07, p);

/** The comparison (guide line, band) draws in after the tap closes. */
export const reveal = (p: number, a: number, b: number) => expoOut((p - a) / (b - a));

/**
 * Odometer position for a digit: sits still, then rolls to the next value in
 * the first quarter-second of each tick.
 */
export const tick = (n: number, k: number) => {
  const f = Math.floor(n);
  return Math.max(0, f - 1 + expoOut((n - f) * k));
};
export const unitsPos = (s: number) => tick(s, 4) % 10;
export const tensPos = (s: number) => tick(s / 10, 40) % 6;
export const minutesPos = (s: number) => tick(s / 60, 240);

export const fmtLitres = (n: number) => n.toFixed(1);
