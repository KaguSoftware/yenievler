import { Reveal } from "./Reveal";

const ROOMS = [
  { city: "Istanbul", where: "Teşvikiye", hours: "Tue to Sat, 10 to 19" },
  { city: "Milan", where: "Tortona district", hours: "Tue to Sat, 10 to 19" },
  { city: "Copenhagen", where: "Frederiksstaden", hours: "Tue to Sat, 10 to 18" },
  { city: "London", where: "Clerkenwell", hours: "Mon to Sat, 10 to 18" },
];

export function Showrooms() {
  return (
    <section
      id="showrooms"
      className="bg-signal px-[var(--pad)] py-[clamp(80px,11vw,160px)] text-ink"
    >
      <Reveal className="flex flex-wrap items-end justify-between gap-x-12 gap-y-6">
        <h2 className="display text-[clamp(40px,14vw,56px)] text-paper sm:text-[clamp(56px,9vw,152px)]">Stand under one.</h2>
        <p className="max-w-[30ch] text-[18px] leading-[1.4] font-medium">
          Every showroom has working showers. Bring a towel, or borrow ours.
        </p>
      </Reveal>

      <ul className="mt-[clamp(40px,6vw,88px)] border-t-2 border-ink">
        {ROOMS.map((r) => (
          <li key={r.city} className="border-b-2 border-ink">
            <a
              href="mailto:visit@nimbo.example?subject=Book%20a%20visit"
              className="group -mx-[var(--pad)] grid items-baseline gap-x-8 gap-y-1 px-[var(--pad)] py-5 transition-colors duration-300 ease-out hover:bg-ink hover:text-paper lg:grid-cols-[minmax(max-content,2.2fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_auto]"
            >
              <span className="display text-[clamp(32px,10.5vw,44px)] transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:translate-x-3 sm:text-[clamp(44px,8vw,64px)] lg:text-[clamp(44px,5.4vw,88px)]">
                {r.city}
              </span>
              <span className="text-[17px] font-medium">{r.where}</span>
              <span className="num text-[17px] font-medium">{r.hours}</span>
              <span className="text-[17px] font-bold lg:text-right">Book a visit →</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
