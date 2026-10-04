"use client";

import { Reveal } from "./Reveal";

const PARTS = [
  { n: "01", title: "Tap", body: "Pull-out head, three sprays." },
  { n: "02", title: "Waterfalls", body: "A slot and a grille, hands free." },
  { n: "03", title: "Glass rinser", body: "Turn a glass over, jets wash it." },
  { n: "04", title: "Drinking water", body: "Filtered, on its own tap." },
];

const PIPS = ["Tap", "Falls", "Rinse", "Drink"];

/**
 * Captions for the sink show. The sink itself is in the shared world: sink.ts presses the four keys
 * as this section scrolls, places these captions on the outlets and lights the pips at the bottom.
 */
export function SinkShow() {
  return (
    <section
      id="sink"
      data-station="sink"
      aria-labelledby="sink-title"
      className="relative bg-paper world:h-[460vh] world:bg-transparent motion-reduce:world:h-[100svh]"
    >
      <div className="noworld:static noworld:h-auto noworld:min-h-0 noworld:overflow-visible noworld:px-[var(--pad)] noworld:pt-[clamp(80px,11vw,160px)] sticky top-0 h-[100svh] min-h-[620px] overflow-hidden">
        <Reveal className="pointer-events-none absolute top-[clamp(28px,6vh,64px)] left-[var(--pad)] max-w-[560px] noworld:static">
          <h2 id="sink-title" className="display text-[clamp(40px,5.4vw,92px)]">
            Washing up, <span className="text-signal-deep">played.</span>
          </h2>
          <p className="mt-4 max-w-[30ch] text-[17px] leading-[1.4] font-medium text-ink/78">
            Piano, our kitchen sink. Four keys on the deck. Keep scrolling and it plays them.
          </p>
        </Reveal>

        <ul className="sr-only">
          {PARTS.map((p) => (
            <li key={p.n}>
              {p.title}: {p.body}
            </li>
          ))}
        </ul>

        <div aria-hidden data-sink-labels="" className="noworld:hidden pointer-events-none absolute inset-0">
          {PARTS.map((p) => (
            <div
              key={p.n}
              data-sink-part=""
              className="group absolute top-0 left-0 opacity-0 will-change-[transform,opacity]"
            >
              <span className="absolute size-[9px] -translate-1/2 rounded-full bg-signal shadow-[0_0_0_5px_oklch(0.65_0.205_38/0.22)]" />
              <span className="compact:h-7 absolute bottom-0 left-0 h-12 w-px -translate-x-1/2 bg-ink/45" />
              <span className="compact:bottom-7 compact:px-2.5 compact:py-1.5 absolute bottom-12 left-0 flex -translate-x-3 flex-col gap-0.5 group-data-[side=l]:right-0 group-data-[side=l]:left-auto group-data-[side=l]:translate-x-3 rounded-[3px] bg-paper px-3 py-2 whitespace-nowrap shadow-[0_6px_18px_oklch(0.19_0.015_45/0.16)]">
                <span className="flex items-baseline gap-2">
                  <span className="narrow num text-[13px] font-semibold text-signal-deep">{p.n}</span>
                  <span className="wide compact:text-[14px] text-[17px] leading-none font-bold tracking-[-0.02em]">
                    {p.title}
                  </span>
                </span>
                <span className="compact:hidden text-[13px] leading-[1.35] text-ink/78">{p.body}</span>
              </span>
            </div>
          ))}
        </div>

        <div
          aria-hidden
          className="noworld:hidden absolute right-[var(--pad)] bottom-8 left-[var(--pad)] flex items-center gap-5 text-[12px] font-semibold tracking-[0.06em] text-ink/78 uppercase"
        >
          <div className="flex gap-1.5 rounded-[6px] bg-[#0b0c0e] p-1.5">
            {PIPS.map((label) => (
              <div
                key={label}
                data-sink-pip=""
                className="group flex h-9 w-9 flex-col items-center justify-end rounded-[2px_2px_5px_5px] pb-1.5 transition-transform duration-200 [background:linear-gradient(180deg,#fff_0%,#ecebe8_70%,#d4d4d2_100%)] data-[on=1]:translate-y-[2px] sm:w-11"
              >
                <span className="h-[3px] w-4 rounded-sm bg-[#c9c9c7] transition-colors duration-300 group-data-[on=1]:bg-signal group-data-[on=1]:shadow-[0_0_7px_oklch(0.65_0.205_38)]" />
              </div>
            ))}
          </div>
          <span className="max-sm:hidden">Off</span>
          <div className="h-px flex-1 overflow-hidden bg-ink/15">
            <div data-sink-bar="" className="h-full origin-left bg-signal" style={{ transform: "scaleX(0)" }} />
          </div>
          <span className="max-sm:hidden">All four running</span>
        </div>
      </div>
    </section>
  );
}
