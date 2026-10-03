"use client";

import Image from "next/image";
import { useState } from "react";
import { Reveal } from "./Reveal";

const U = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1000&q=75`;

const COLLECTIONS = [
  {
    name: "Rain",
    desc: "Heads, hand showers and the seven-key mixer that runs them.",
    items: [
      { name: "R-360 Rain Head", mat: "Brass", img: "1576678433413-202829a1ab98" },
      { name: "R-220 Wall Rain", mat: "Brass", img: "1652662700928-5a4685e87d64" },
      { name: "Halo Hand Shower", mat: "Brass", img: "1643081262278-807976f7f2f7" },
      { name: "P7 Piano Mixer", mat: "Brass", img: "1561361398-d1f7b6cfee79" },
    ],
  },
  {
    name: "Basin",
    desc: "Turned from one block of stone, or cast in fine fireclay.",
    items: [
      { name: "Monolith", mat: "Marble", img: "1595514535116-d0401260e7cf" },
      { name: "Bowl 48", mat: "Fireclay", img: "1644916925497-109cbd92087d" },
      { name: "Trough 120", mat: "Limestone", img: "1600488999585-e4364713b90a" },
      { name: "Cove", mat: "Fireclay", img: "1576698483491-8c43f0862543" },
    ],
  },
  {
    name: "Spout",
    desc: "Taps and mixers machined from solid brass, in four finishes.",
    items: [
      { name: "Line Wall Spout", mat: "Brass", img: "1619365566184-272a34acfeb9" },
      { name: "Arc Mixer", mat: "Brass", img: "1542855368-ca6ea825bca2" },
      { name: "Stem", mat: "Brass", img: "1495647688236-ed6ef40cb28b" },
      { name: "Bridge 3-hole", mat: "Brass", img: "1637939157373-2198d933afdf" },
    ],
  },
  {
    name: "Soak",
    desc: "Freestanding baths in stone resin and enamelled cast iron.",
    items: [
      { name: "Ellipse 170", mat: "Stone resin", img: "1620626011761-996317b8d101" },
      { name: "Cistern", mat: "Cast iron", img: "1586798271654-0471bb1b0517" },
      { name: "Ofuro 110", mat: "Stone resin", img: "1733426107854-ee00a25d72a7" },
      { name: "Basin Bath", mat: "Marble", img: "1631889993959-41b4e9c6e3c5" },
    ],
  },
];

export function Range() {
  const [c, setC] = useState(0);
  const [i, setI] = useState(0);
  const col = COLLECTIONS[c];

  return (
    <section
      id="range"
      className="bg-paper px-[var(--pad)] py-[clamp(80px,11vw,160px)]"
    >
      <Reveal>
        <h2 className="display max-w-[20ch] text-[clamp(44px,6.4vw,108px)] text-balance">
          Four ways to get wet.
        </h2>
      </Reveal>

      <div className="mt-[clamp(48px,7vw,104px)] grid gap-x-[clamp(32px,5vw,88px)] gap-y-10 lg:grid-cols-[1.05fr_1fr]">
        <div className="flex flex-col">
          <div role="tablist" aria-label="Collections" className="flex flex-col">
            {COLLECTIONS.map((x, idx) => {
              const on = idx === c;
              return (
                <button
                  key={x.name}
                  role="tab"
                  id={`tab-${idx}`}
                  aria-selected={on}
                  aria-controls="range-panel"
                  type="button"
                  onClick={() => {
                    setC(idx);
                    setI(0);
                  }}
                  onMouseEnter={() => {
                    if (idx !== c) {
                      setC(idx);
                      setI(0);
                    }
                  }}
                  className="display group flex items-baseline gap-5 border-t border-ink/15 py-[0.12em] text-left text-[clamp(64px,10vw,168px)] transition-colors duration-300 last:border-b"
                  style={{ color: on ? "var(--color-signal)" : "var(--color-ink)", opacity: on ? 1 : 0.9 }}
                >
                  <span className="narrow num w-8 shrink-0 text-[15px] font-semibold tracking-normal text-ink/60">
                    0{idx + 1}
                  </span>
                  <span className="transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:translate-x-3">
                    {x.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div id="range-panel" role="tabpanel" aria-labelledby={`tab-${c}`} className="flex flex-col gap-8">
          <div className="relative aspect-[5/4] overflow-hidden bg-mist-2">
            {col.items.map((it, idx) => (
              <Image
                key={`${c}-${it.img}`}
                src={U(it.img)}
                alt={`${it.name}, ${it.mat.toLowerCase()}`}
                fill
                sizes="(min-width: 1024px) 45vw, 100vw"
                priority={c === 0 && idx === 0}
                className="object-cover transition-opacity duration-500 ease-out"
                style={{ opacity: idx === i ? 1 : 0, filter: "saturate(0.9) contrast(1.04)" }}
              />
            ))}
          </div>
          <p className="max-w-[36ch] text-[19px] leading-[1.4] font-medium">{col.desc}</p>
          <ul className="flex flex-col">
            {col.items.map((it, idx) => (
              <li key={it.name} className="border-t border-ink/15 last:border-b">
                <button
                  type="button"
                  onMouseEnter={() => setI(idx)}
                  onFocus={() => setI(idx)}
                  onClick={() => setI(idx)}
                  className="flex w-full items-baseline justify-between gap-4 py-3.5 text-left text-[17px] transition-colors duration-200"
                  style={{ fontWeight: idx === i ? 700 : 450 }}
                >
                  <span>{it.name}</span>
                  <span className="text-ink/60" style={{ fontWeight: 450 }}>
                    {it.mat}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
