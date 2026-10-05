"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  motion,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "framer-motion";
import * as M from "@/lib/minute";
import { EXPO, useSmoothProgress } from "@/lib/motion";

const TICKS = [5, 10, 15];
const SAVED = M.fmtLitres(M.RATE_STANDARD - M.RATE_YENI_EVLER_YAPI);

export function Minute() {
  const sec = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const reduced = !!useReducedMotion();
  const p = useSmoothProgress(sec, ["start start", "end end"], reduced);

  useEffect(() => {
    const el = stage.current;
    const section = sec.current;
    const h = host.current;
    if (!el || !section || !h) return;
    let dispose: (() => void) | undefined;
    let dead = false;
    import("@/lib/three/minute")
      .then(({ initMinute }) => {
        if (dead) return;
        dispose = initMinute(el, {
          section,
          host: h,
          getProgress: () => p.get(),
        });
      })
      .catch((e) => {
        console.error(e);
        setFailed(true);
      });
    return () => {
      dead = true;
      dispose?.();
    };
  }, [p]);

  const secs = useTransform(p, M.clockSeconds);
  const litresA = useTransform(p, (v) =>
    M.fmtLitres(M.litres(v, M.RATE_STANDARD)),
  );
  const litresB = useTransform(p, (v) =>
    M.fmtLitres(M.litres(v, M.RATE_YENI_EVLER_YAPI)),
  );

  // Captions: three beats, cross-faded in place.
  const aO = useTransform(p, (v) => 1 - M.reveal(v, 0.05, 0.1));
  const aY = useTransform(p, (v) => -14 * M.reveal(v, 0.05, 0.1));
  const bO = useTransform(
    p,
    (v) => M.reveal(v, 0.1, 0.15) * (1 - M.reveal(v, 0.77, 0.82)),
  );
  const bY = useTransform(
    p,
    (v) => 14 * (1 - M.reveal(v, 0.1, 0.15)) - 14 * M.reveal(v, 0.77, 0.82),
  );
  const cO = useTransform(p, (v) => M.reveal(v, 0.85, 0.92));
  const cY = useTransform(p, (v) => 14 * (1 - M.reveal(v, 0.85, 0.92)));

  // The comparison draws after the tap closes: a guide at 7.6 L across both jugs, and the extra water as a band.
  const lineX = useTransform(p, (v) => M.reveal(v, 0.83, 0.92));
  const bandY = useTransform(p, (v) => M.reveal(v, 0.86, 0.96));
  const bandLabel = useTransform(p, (v) => M.reveal(v, 0.93, 0.99));

  const halfFill = M.RATE_YENI_EVLER_YAPI / M.CAPACITY;
  const fullFill = M.RATE_STANDARD / M.CAPACITY;
  const at = (f: number) => `calc(var(--jb, 520px) - var(--jh, 380px) * ${f})`;

  return (
    <section
      id="minute"
      ref={sec}
      aria-label="One minute under a standard head and the R-360"
      className="relative h-[380vh] bg-signal text-ink motion-reduce:h-[100svh]"
    >
      <div
        ref={host}
        className="sticky top-0 h-[100svh] min-h-[620px] overflow-hidden short:min-h-0!"
      >
        <div ref={stage} className="absolute inset-0" aria-hidden />
        <p className="sr-only">
          In one minute a standard head runs {M.fmtLitres(M.RATE_STANDARD)}{" "}
          litres. The R-360 runs {M.fmtLitres(M.RATE_YENI_EVLER_YAPI)}.
        </p>
        {failed && (
          <p className="absolute top-1/3 right-[var(--pad)] max-w-60 text-sm">
            The 3D scene needs WebGL. The numbers still hold:{" "}
            {M.fmtLitres(M.RATE_STANDARD)} litres against{" "}
            {M.fmtLitres(M.RATE_YENI_EVLER_YAPI)}.
          </p>
        )}

        <div className="pointer-events-none absolute inset-0">
          {/* Litre scale between the jugs. */}
          {TICKS.map((n, i) => (
            <In
              key={n}

              delay={0.5 + i * 0.08}
              className="absolute flex -translate-y-1/2 items-center gap-1.5"
              style={{
                left: "calc(var(--ax, 40%) + var(--jw, 200px) / 2 + 6px)",
                width:
                  "calc(var(--bx, 70%) - var(--ax, 40%) - var(--jw, 200px) - 12px)",
                top: at(n / M.CAPACITY),
              }}
            >
              <span className="h-px flex-1 bg-ink/40" />
              <span className="narrow num text-[12px] font-semibold text-ink/75 sm:text-[13px]">
                {n}
                {n === 15 && <span className="ml-0.5 font-medium">L</span>}
              </span>
              <span className="h-px flex-1 bg-ink/40" />
            </In>
          ))}

          {/* Guide at half, and the extra water as a band on the standard jug. */}
          <motion.div
            className="absolute h-[2px] origin-left bg-ink"
            style={{
              left: "calc(var(--ax, 40%) - var(--jw, 200px) / 2 - 12px)",
              width:
                "calc(var(--bx, 70%) - var(--ax, 40%) + var(--jw, 200px) + 24px)",
              top: at(halfFill),
              scaleX: lineX,
            }}
          />
          <motion.div
            className="absolute origin-bottom rounded-[3px] bg-ink/80"
            style={{
              left: "calc(var(--ax, 40%) - var(--jw, 200px) * 0.45)",
              width: "calc(var(--jw, 200px) * 0.9)",
              top: at(fullFill),
              height: `calc(var(--jh, 380px) * ${fullFill - halfFill})`,
              scaleY: bandY,
            }}
          />
          <motion.div
            className="absolute flex -translate-x-1/2 flex-col items-center justify-center text-center text-paper"
            style={{
              left: "var(--ax, 40%)",
              top: at(fullFill),
              height: `calc(var(--jh, 380px) * ${fullFill - halfFill})`,
              width: "calc(var(--jw, 200px) * 0.9)",
              opacity: bandLabel,
            }}
          >
            <span className="display num text-[clamp(26px,2.9vw,46px)]">
              {SAVED} L
            </span>
            <span className="mt-1.5 text-[13px] font-semibold sm:text-[15px]">
              more
            </span>
          </motion.div>

          {/* Readouts under each jug. */}
          <Readout
            left="var(--ax, 40%)"
            litres={litresA}
            name="Standard head"
            rate={`${M.fmtLitres(M.RATE_STANDARD)} L/min`}
            delay={0.6}
            tone="text-ink"
          />
          <Readout
            left="var(--bx, 70%)"
            litres={litresB}
            name="R-360 rain head"
            rate={`${M.fmtLitres(M.RATE_YENI_EVLER_YAPI)} L/min`}
            delay={0.72}
            tone="text-paper"
          />

          {/* Title, caption beats and the clock share one box so phone and desktop read as separate compositions. */}
          <div className="absolute inset-x-[var(--pad)] top-[clamp(28px,6vh,64px)] bottom-[clamp(24px,5vh,56px)] flex flex-col stack:top-auto stack:grid stack:grid-cols-[1fr_auto] stack:items-end stack:gap-x-4 stack:gap-y-3">
            <motion.h2
              className="display text-[clamp(40px,5.4vw,92px)] text-paper stack:col-span-2 stack:text-[clamp(40px,9vw,92px)]"
              initial="hidden"
              whileInView="shown"
              viewport={{ once: true, amount: 0.3 }}
            >
              <Line delay={0}>Give it</Line>
              <Line delay={0.1}>
                <span className="text-ink">a minute.</span>
              </Line>
            </motion.h2>

            <In
              delay={0.35}
              className="mt-4 grid max-w-[26ch] text-[17px] leading-[1.4] font-medium stack:mt-0 stack:max-w-[30ch] stack:text-[clamp(15px,2.4vw,22px)]"
            >
              <Caption o={aO} y={aY} hidden>
                Two heads over two jugs. Scroll to open the tap.
              </Caption>
              <Caption o={bO} y={bY} hidden>
                Same tap, same jug. The levels follow the clock.
              </Caption>
              <Caption o={cO} y={cY}>
                Half the water in the same minute. Twenty-four vanes pull air
                into the flow, so the drops land fuller.
              </Caption>
            </In>

            <In delay={0.45} className="mt-auto stack:mt-0 stack:self-end">
              <Clock secs={secs} />
            </In>
          </div>
        </div>
      </div>
    </section>
  );
}

function Caption({
  o,
  y,
  hidden,
  children,
}: {
  o: MotionValue<number>;
  y: MotionValue<number>;
  hidden?: boolean;
  children: ReactNode;
}) {
  return (
    <motion.p
      aria-hidden={hidden}
      className="col-start-1 row-start-1"
      style={{ opacity: o, y }}
    >
      {children}
    </motion.p>
  );
}

function Readout({
  left,
  litres,
  name,
  rate,
  delay,
  tone,
}: {
  left: string;
  litres: MotionValue<string>;
  name: string;
  rate: string;
  delay: number;
  tone: string;
}) {
  return (
    <In
      delay={delay}
      className={`absolute -translate-x-1/2 text-center whitespace-nowrap ${tone}`}
      style={{
        left,
        top: "calc(var(--jbase, 600px) + clamp(14px, 2.4vh, 26px))",
      }}
    >
      <p className="display num text-[clamp(30px,4.2vw,68px)] stack:text-[clamp(30px,6vw,64px)]">
        <motion.span>{litres}</motion.span>
        <span className="ml-[0.12em] text-[0.42em] font-bold tracking-normal">
          L
        </span>
      </p>
      <p className="mt-2 text-[14px] leading-tight font-bold sm:text-[17px]">
        {name}
      </p>
      <p className="mt-0.5 text-[13px] leading-tight font-medium opacity-80 sm:text-[15px]">
        {rate}
      </p>
    </In>
  );
}

/** Entrance: opacity and transform only, exponential ease-out. */
function In({
  delay = 0,
  className,
  style,
  children,
}: {
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 1.1, ease: EXPO, delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * One masked line of the title rising into place. The trigger lives on the h2:
 * an observer on the line itself never fires, because the mask clips it to nothing.
 */
function Line({ delay, children }: { delay: number; children: ReactNode }) {
  return (
    <span className="block overflow-hidden pb-[0.06em]">
      <motion.span
        className="block"
        variants={{
          hidden: { y: "108%" },
          shown: { y: 0, transition: { duration: 1.2, ease: EXPO, delay } },
        }}
      >
        {children}
      </motion.span>
    </span>
  );
}

/** Odometer: each digit is a strip that slides by translateY, nothing else moves. */
function Roll({
  pos,
  items,
  label,
}: {
  pos: MotionValue<number>;
  items: number;
  label: (i: number) => number;
}) {
  const y = useTransform(pos, (v) => `${(-v / items) * 100}%`);
  return (
    <span className="relative inline-block h-[1em] w-[0.74em] overflow-hidden align-top">
      <motion.span
        className="absolute inset-x-0 top-0 flex flex-col will-change-transform"
        style={{ y }}
      >
        {Array.from({ length: items }, (_, i) => (
          <span key={i} className="block h-[1em] text-center leading-[1em]">
            {label(i)}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

function Clock({ secs }: { secs: MotionValue<number> }) {
  const mins = useTransform(secs, M.minutesPos);
  const tens = useTransform(secs, M.tensPos);
  const units = useTransform(secs, M.unitsPos);
  return (
    <div aria-hidden>
      <div className="display num flex items-start text-[clamp(56px,13vw,230px)] leading-none stack:text-[clamp(56px,13vw,150px)]">
        <Roll pos={mins} items={2} label={(i) => i} />
        <span className="inline-block h-[1em] w-[0.3em] text-center leading-[0.92em]">
          :
        </span>
        <Roll pos={tens} items={7} label={(i) => i % 6} />
        <Roll pos={units} items={11} label={(i) => i % 10} />
      </div>
      <p className="mt-1 text-[14px] font-semibold sm:text-[16px]">Elapsed</p>
    </div>
  );
}
