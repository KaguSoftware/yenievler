"use client";

import { useEffect, useRef } from "react";

/**
 * The one canvas. Fixed behind the whole page, no pointer events until the basin station
 * switches them on. All of the scene lives in lib/three/world.ts.
 */
export function World() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    // The probe in layout.tsx found no WebGL: keep the plain page and say so in the hero.
    if (document.documentElement.dataset.world === "off") {
      import("@/lib/three/state").then(({ worldStatus }) => worldStatus.set("failed"));
      return;
    }
    let dead = false;
    let dispose: (() => void) | undefined;
    import("@/lib/three/world")
      .then(({ initWorld }) => {
        if (dead) return;
        dispose = initWorld(el).dispose;
      })
      .catch(async (e) => {
        console.error(e);
        const { worldStatus } = await import("@/lib/three/state");
        document.documentElement.dataset.world = "off";
        worldStatus.set("failed");
      });
    return () => {
      dead = true;
      dispose?.();
    };
  }, []);

  // As tall as the large viewport, not the visible one: a phone's toolbar sliding away on scroll then
  // uncovers more canvas instead of resizing it (a resize clears the frame and re-lays the timeline).
  return <div ref={host} className="pointer-events-none fixed inset-x-0 top-0 z-0 h-lvh" />;
}
