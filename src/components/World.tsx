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

  return <div ref={host} className="pointer-events-none fixed inset-0 z-0" />;
}
