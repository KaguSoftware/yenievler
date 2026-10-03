import { Reveal } from "./Reveal";

export function TechSheet() {
  return (
    <section
      aria-label="Performance"
      className="bg-gun px-[var(--pad)] pt-[clamp(40px,6vw,80px)] pb-[clamp(96px,13vw,200px)] text-paper"
    >
      <Reveal>
        <p className="wide max-w-[24ch] text-[clamp(30px,4.6vw,76px)] leading-[1.04] font-bold tracking-[-0.03em] text-paper/90">
          <b className="font-extrabold text-signal">7.6 litres</b> a minute, half the
          water of a standard head, and it feels heavier. Hot stays hot to within{" "}
          <b className="font-extrabold text-signal">0.5 °C</b>, even when someone
          opens a tap downstairs. Every brass body and ceramic cartridge is
          guaranteed for <b className="font-extrabold text-signal">25 years</b>.
        </p>
      </Reveal>
    </section>
  );
}
