import type { FlowId } from "./flows";

/**
 * Mutable bridge between React and the world. The world reads these every frame, so changing
 * a picker or a mixer key never re-renders anything on the scroll path.
 */
export const ui = {
  flow: "rain" as FlowId,
  stone: 0,
  finish: 0,
  water: true,
};

export type WorldStatus = "idle" | "on" | "failed";

let status: WorldStatus = "idle";
const subs = new Set<() => void>();

export const worldStatus = {
  get: () => status,
  set(next: WorldStatus) {
    if (next === status) return;
    status = next;
    subs.forEach((f) => f());
  },
  subscribe(f: () => void) {
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  },
};

/** Debug and test hook: where the world is, readable without touching React. */
export const probe = { p: 0, target: 0, key: "", w: 0, frames: 0, follow: 0, keyP: {} as Record<string, number> };
