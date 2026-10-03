"use client";

import { useEffect, useRef } from "react";
import { Reveal } from "./Reveal";

const PARTS = [
  { n: "01", title: "Body", body: "A 4.2 kg billet of solid brass, polished in four stages." },
  { n: "02", title: "Air chamber", body: "Twenty-four vanes pull air into the flow. Fuller drops, half the water." },
  { n: "03", title: "Diffuser", body: "96 channels even out the pressure across the whole face." },
  { n: "04", title: "Nozzles", body: "Silicone. Rub them with a thumb and the limescale falls off." },
  { n: "05", title: "Face ring", body: "Hand-polished, sealed to the body with a single gasket." },
];

export function Exploded() {
  const sec = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stage.current;
    const section = sec.current;
    if (!el || !section) return;
    let dispose: (() => void) | undefined;
    let dead = false;
    import("@/lib/three/exploded")
      .then(({ initExploded }) => {
        if (dead) return;
        dispose = initExploded(el, {
          section,
          labels: () => labels.current,
          bar: () => bar.current,
        });
      })
      .catch(console.error);
    return () => {
      dead = true;
      dispose?.();
    };
  }, []);

  return (
    <section
      id="inside"
      ref={sec}
      aria-label="Inside the R-360 rain head"
      className="relative h-[340vh] bg-gun text-paper"
    >
      <div className="sticky top-0 h-[100svh] min-h-[620px] overflow-hidden">
        <div ref={stage} className="absolute inset-0" aria-hidden />
        <Reveal className="pointer-events-none absolute top-[clamp(28px,6vh,64px)] left-[var(--pad)] max-w-[600px]">
          <h2 className="display text-[clamp(40px,5.4vw,92px)]">
            Take it <span className="text-signal">apart.</span>
          </h2>
          <p className="mt-4 max-w-[26ch] text-[17px] leading-[1.4] text-paper/70">
            Scroll. The R-360 comes apart into five parts, and none of them is plastic.
          </p>
        </Reveal>
        <div ref={labels} className="pointer-events-none absolute inset-0">
          {PARTS.map((p) => (
            <div
              key={p.n}
              data-part=""
              className="absolute top-0 left-0 flex items-center opacity-0 will-change-[transform,opacity]"
            >
              <div className="compact:hidden -ml-[3px] size-[7px] flex-none rounded-full bg-signal shadow-[0_0_0_4px_oklch(0.65_0.205_38/0.22)]" />
              <div
                data-line=""
                className="compact:hidden h-px w-[120px] flex-none bg-gradient-to-r from-paper/70 to-paper/20"
              />
              <div className="compact:w-auto compact:pl-0 flex w-[290px] flex-col gap-1.5 pl-3 sm:pl-4">
                <div className="compact:rounded-[3px] compact:bg-signal compact:px-2 compact:py-[5px] compact:text-ink compact:shadow-[0_4px_12px_oklch(0.19_0.015_45/0.45)] flex items-baseline gap-3 compact:gap-1.5">
                  <span className="narrow num compact:text-ink/60 compact:text-[11px] text-[14px] font-semibold text-signal">{p.n}</span>
                  <span className="wide whitespace-nowrap text-[16px] leading-none font-bold tracking-[-0.02em] compact:text-[13px] sm:text-[22px]">{p.title}</span>
                </div>
                <span data-body="" className="compact:hidden text-[14px] leading-[1.45] text-paper/70">
                  {p.body}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div
          aria-hidden
          className="absolute right-[var(--pad)] bottom-8 left-[var(--pad)] flex items-center gap-4 text-[12px] font-semibold tracking-[0.06em] text-paper/50 uppercase"
        >
          <span>Assembled</span>
          <div className="h-px flex-1 overflow-hidden bg-paper/15">
            <div
              ref={bar}
              className="h-full origin-left bg-signal"
              style={{ transform: "scaleX(0)" }}
            />
          </div>
          <span>Exploded</span>
        </div>
      </div>
    </section>
  );
}
