/**
 * The Piano kitchen sink: where it sits in the world, and the bridge from the DOM console.
 * No three.js import here, so timeline.ts can read the placement.
 *
 * The basin is drawn at twice real size (its Ø 500 mm bowl is 1 world unit across), so the sink
 * is too: the model is built in real metres and scaled by SINK_SCALE, 1.5 x 0.9 world units.
 */

/** World scale of the sink model (real millimetres x SCALE / 1000 = world units). */
export const SINK_SCALE = 2;
/** Rim top, world y. Below the range, above the basin's ground (-11). */
export const SINK_Y = -7.4;
/** Centre of the rim, world x/z. On the fall axis. */
export const SINK_X = 0;
export const SINK_Z = 0;
/** Drain centre in sink-local metres (before SINK_SCALE). */
export const DRAIN_LOCAL: [number, number] = [0.1, 0.035];
/** Bowl depth in sink-local metres. */
export const BOWL_DEPTH = 0.215;

/** Drain centre in world units: the camera dives through here. */
export const SINK_DRAIN: [number, number, number] = [
  SINK_X + DRAIN_LOCAL[0] * SINK_SCALE,
  SINK_Y - BOWL_DEPTH * SINK_SCALE,
  SINK_Z + DRAIN_LOCAL[1] * SINK_SCALE,
];

export type SinkOutlet = "tap" | "falls" | "cups" | "ro";
export type SinkMode = "stream" | "spray" | "blade";

/**
 * What the console in the Sink section has picked. The world reads it every frame while the
 * sink is live, so pressing a key never re-renders anything on the scroll path.
 */
export const sinkUi = {
  tap: true,
  falls: true,
  cups: true,
  ro: true,
  mode: "stream" as SinkMode,
  temp: 38,
  plug: true,
  /** 0 black PVD, 1 brushed steel. */
  finish: 0,
};

export const SINK_T_MIN = 18;
export const SINK_T_MAX = 60;
