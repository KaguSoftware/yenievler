"use client";

import { useEffect, useRef, useState } from "react";
import { useMotionValue } from "framer-motion";

/**
 * The phone stage (the `stage` variant in globals.css).
 *
 * On desktop a 3D subject sits in a sticky window beside its words, so it is in shot from the moment
 * the section arrives until the camera leaves it. A phone has no room beside the words, and a window
 * in the flow scrolls away with them, which leaves the camera nothing to leave from. So on a phone the
 * section becomes a sticky stage, one screen tall: the window is a band across its top, and the words
 * ride up beneath it, one pixel per pixel scrolled, clipped at the band's lower edge.
 *
 *   track  not sticky; carries `--stage: 1` while the stage is on, and receives `--stage-run`,
 *          the height of the empty scroll that follows the stage
 *   stage  the sticky screen
 *   band   the window (the world's pin target)
 *   tail   the last block that rides; the run ends when its bottom edge passes under the band
 *
 * CSS decides whether the stage is on; this only follows it, and `y` is zero while it is off, so
 * the riding blocks can carry it always. Riding blocks also carry `data-stage-ride`: where the browser
 * has scroll-driven animations, the ride is a CSS animation on the compositor (globals.css) and `y`
 * stays zero, because a scroll listener only runs when the main thread, busy with the world, gets a
 * frame, which leaves the words a step behind the page. `after` is how many screens of scroll
 * follow the run while the stage still holds (negative: the run's end overlaps whatever comes next).
 */
export function useStage(after = 0) {
  const track = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const band = useRef<HTMLDivElement>(null);
  const tail = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  /** Offset of everything that rides, in px (0 or negative). */
  const y = useMotionValue(0);
  /** 1 while there are words left to pass under the band, 0 once the last of them has. */
  const fade = useMotionValue(1);

  useEffect(() => {
    const tr = track.current;
    const st = stage.current;
    const bd = band.current;
    const tl = tail.current;
    if (!tr || !st || !bd || !tl) return;
    const geo = { on: false, top: 0, run: 0 };
    const native = CSS.supports("animation-range", "exit-crossing 0% exit-crossing 10px");
    /** Layout offset inside the stage: transforms do not count, so the ride cannot feed back. */
    const within = (el: HTMLElement) => {
      let o = 0;
      for (let n: HTMLElement | null = el; n && n !== st; n = n.offsetParent as HTMLElement | null) o += n.offsetTop;
      return o;
    };
    const apply = () => {
      const gone = geo.on ? Math.min(geo.run, Math.max(0, window.scrollY - geo.top)) : 0;
      y.set(native ? 0 : -gone);
      fade.set(geo.on ? Math.min(1, Math.max(0, (geo.run - gone) / 80)) : 0);
    };
    let run = "";
    const measure = () => {
      geo.on = getComputedStyle(tr).getPropertyValue("--stage").trim() === "1";
      let next = "";
      if (geo.on) {
        geo.top = tr.getBoundingClientRect().top + window.scrollY;
        // A little further than the tail's own edge, so no sliver of its last row is left on the line.
        geo.run = Math.max(0, within(tl) + tl.offsetHeight - (within(bd) + bd.offsetHeight)) + 16;
        next = `${Math.max(0, Math.round(geo.run + st.offsetHeight * after))}px`;
      }
      if (next !== run) {
        run = next;
        if (next) tr.style.setProperty("--stage-run", next);
        else tr.style.removeProperty("--stage-run");
        if (next && native) {
          tr.style.setProperty("--stage-ride", `${Math.round(geo.run)}px`);
          tr.dataset.ride = "";
        } else {
          tr.style.removeProperty("--stage-ride");
          delete tr.dataset.ride;
        }
      }
      setOn(geo.on);
      apply();
    };
    const ro = new ResizeObserver(measure);
    // Two levels down: a child with `display: contents` has no box of its own to observe.
    const kids = Array.from(st.children).flatMap((c) => [c, ...Array.from(c.children)]);
    for (const n of new Set([document.body, st, tl, ...kids])) ro.observe(n);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", apply, { passive: true });
    measure();
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", apply);
    };
  }, [y, fade, after]);

  return { track, stage, band, tail, on, y, fade };
}
