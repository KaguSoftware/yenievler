"use client";

import { useEffect, useRef, useState } from "react";
import { FLOWS, FLOW_NAME, KEYS, type FlowId } from "@/lib/three/flows";

const LINKS = [
  { href: "#range", label: "Range" },
  { href: "#inside", label: "Inside" },
  { href: "#basin", label: "Basin builder" },
  { href: "#showrooms", label: "Showrooms" },
];

export function Hero() {
  const stage = useRef<HTMLDivElement>(null);
  const [flow, setFlow] = useState<FlowId>("rain");
  const flowRef = useRef<FlowId>("rain");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    flowRef.current = flow;
  }, [flow]);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let dispose: (() => void) | undefined;
    let dead = false;
    import("@/lib/three/hero")
      .then(({ initHero }) => {
        if (dead) return;
        dispose = initHero(el, { getFlow: () => flowRef.current });
      })
      .catch((e) => {
        console.error(e);
        setFailed(true);
      });
    return () => {
      dead = true;
      dispose?.();
    };
  }, []);

  const rate = FLOWS[flow].rate;

  return (
    <section
      id="top"
      aria-label="Nimbo"
      className="relative isolate h-[100svh] min-h-[780px] overflow-hidden max-sm:min-h-[700px] bg-signal text-ink"
    >
      <div ref={stage} className="absolute inset-0" aria-hidden />
      {failed && (
        <p className="absolute right-[var(--pad)] top-1/3 max-w-60 text-sm">
          The 3D scene needs WebGL. The rest of the page works without it.
        </p>
      )}

      <nav className="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 px-[var(--pad)] py-6 max-sm:py-4">
        <div className="flex flex-wrap items-center gap-x-12 gap-y-3 max-sm:contents">
          <a
            href="#top"
            className="wide text-[28px] font-black leading-none tracking-[-0.05em] text-paper max-sm:order-1"
          >
            nimbo
          </a>
          <ul className="flex flex-wrap gap-x-7 gap-y-0 text-[15px] font-medium max-sm:order-3 max-sm:w-full max-sm:gap-x-5 max-sm:text-[14px]">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="inline-block underline-offset-[6px] transition-[text-decoration-color] hover:underline max-sm:py-1.5"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <a
          href="#showrooms"
          className="rounded-full bg-ink px-5 py-2.5 text-[15px] font-semibold text-paper max-sm:order-2 max-sm:px-4 max-sm:py-2 max-sm:text-[14px] transition-transform duration-300 ease-[var(--ease-out-quart)] hover:-translate-y-0.5"
        >
          Find a showroom
        </a>
      </nav>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-end justify-between gap-x-10 gap-y-8 px-[var(--pad)] pb-[clamp(24px,5vh,56px)]">
        <div className="max-w-[760px]">
          <h1 className="display text-[clamp(52px,17.5vw,68px)] text-paper sm:text-[clamp(68px,10vw,168px)]">
            <span className="rise block" style={{ "--d": "100ms" } as React.CSSProperties}>
              Rain,
            </span>
            <span className="rise block" style={{ "--d": "220ms" } as React.CSSProperties}>
              played.
            </span>
          </h1>
          <div
            className="rise mt-7 max-sm:mt-5 flex flex-wrap items-center gap-x-8 gap-y-4"
            style={{ "--d": "420ms" } as React.CSSProperties}
          >
            <p className="max-w-[34ch] text-[17px] leading-[1.45] font-medium">
              Thermostatic shower systems with a seven-key mixer, in solid
              brass. Press a key, change the weather.
            </p>
            <a
              href="#range"
              className="pointer-events-auto rounded-full bg-paper px-6 py-3 text-[15px] font-semibold transition-transform duration-300 ease-[var(--ease-out-quart)] hover:-translate-y-0.5"
            >
              See the range
            </a>
          </div>
        </div>

        <div
          className="rise pointer-events-auto w-[min(100%,580px)] max-md:w-full md:ml-auto"
          style={{ "--d": "560ms" } as React.CSSProperties}
        >
          <Console flow={flow} rate={rate} onPick={setFlow} />
          <p className="mt-3 text-right text-[13px] font-medium max-md:hidden">
            Move your cursor through the rain.
          </p>
        </div>
      </div>
    </section>
  );
}

function Console({
  flow,
  rate,
  onPick,
}: {
  flow: FlowId;
  rate: number;
  onPick: (f: FlowId) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Shower mixer"
      className="flex items-center gap-3 rounded-[44px_14px_14px_44px] p-3 pr-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-7px_0_rgba(0,0,0,0.38),0_26px_50px_rgba(60,15,0,0.45),0_2px_0_#0b0c0e] [background:linear-gradient(180deg,oklch(0.42_0.01_255)_0%,oklch(0.31_0.01_255)_34%,oklch(0.23_0.01_255)_100%)] max-[420px]:flex-col max-[420px]:items-stretch max-[420px]:rounded-[40px_14px_14px_40px] max-[420px]:pr-3 sm:gap-4 sm:p-4 sm:pr-5"
    >
      <div
        className="flex h-[76px] min-w-[104px] shrink-0 flex-col justify-center gap-1.5 rounded-[30px_6px_6px_30px] bg-[oklch(0.15_0.008_255)] py-3 pr-3 pl-5 max-[420px]:h-14 max-[420px]:min-w-0 max-[420px]:flex-row max-[420px]:items-center max-[420px]:justify-between max-[420px]:py-2 max-[420px]:pr-5 shadow-[inset_0_2px_7px_rgba(0,0,0,0.95),0_1px_0_rgba(255,255,255,0.09)] sm:min-w-[120px]"
        aria-live="polite"
      >
        <div className="narrow num flex items-baseline gap-1 text-[40px] leading-none font-semibold tracking-[0.01em] text-signal [text-shadow:0_0_14px_oklch(0.65_0.205_38/0.7)]">
          {rate.toFixed(1)}
          <span className="text-[13px] font-medium tracking-wider">L/min</span>
        </div>
        <div className="text-[11px] leading-none font-semibold tracking-[0.08em] text-signal/80 uppercase">
          {FLOW_NAME[flow]}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="grid grid-cols-7 gap-[3px] px-[3px]">
          {KEYS.map((k) => {
            const on = flow === k.id;
            return (
              <div key={k.id} className="flex h-3 items-end justify-center gap-[3px]" aria-hidden>
                {k.icon.map((b, i) => (
                  <span
                    key={i}
                    style={{
                      width: b.w,
                      height: b.h,
                      borderRadius: b.r,
                      border: k.id === "off" ? `1.5px solid ${on ? "#f3efe8" : "#7d7f83"}` : 0,
                      background: k.id === "off" ? "transparent" : on ? "#f3efe8" : "#7d7f83",
                    }}
                  />
                ))}
              </div>
            );
          })}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-[3px] rounded-[7px] bg-[#0b0c0e] px-[3px] pt-[3px] pb-1.5 shadow-[inset_0_2px_5px_rgba(0,0,0,0.95),0_1px_0_rgba(255,255,255,0.08)]">
          {KEYS.map((k) => {
            const on = flow === k.id;
            return (
              <button
                key={k.id}
                type="button"
                aria-label={k.label}
                aria-pressed={on}
                onClick={() => onPick(on && k.id !== "off" ? "off" : k.id)}
                className="flex h-[58px] cursor-pointer flex-col items-center justify-end rounded-[3px_3px_8px_8px] border-0 pb-[9px] transition-[transform,box-shadow] duration-150 ease-out [background:linear-gradient(180deg,#fff_0%,#f0f0ef_62%,#d6d6d4_100%)] focus-visible:outline-signal"
                style={{
                  transform: on ? "translateY(4px)" : "none",
                  boxShadow: on
                    ? "0 1px 0 #8d8f93, 0 2px 4px rgba(0,0,0,0.6), inset 0 2px 4px rgba(0,0,0,0.14)"
                    : "0 5px 0 #8d8f93, 0 8px 12px rgba(0,0,0,0.55), inset 0 1px 0 #fff",
                }}
              >
                <span
                  className="h-[3px] w-4 rounded-sm"
                  style={{
                    background: on ? "oklch(0.65 0.205 38)" : "#c9c9c7",
                    boxShadow: on ? "0 0 7px oklch(0.65 0.205 38)" : "none",
                  }}
                />
              </button>
            );
          })}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-[3px] px-[3px]">
          {KEYS.map((k) => (
            <span
              key={k.id}
              className="narrow text-center text-[11px] font-semibold uppercase sm:text-[12px] sm:tracking-[0.04em]"
              style={{ color: flow === k.id ? "#f3efe8" : "#8e9094" }}
            >
              {k.short}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
